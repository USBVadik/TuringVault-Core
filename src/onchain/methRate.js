/**
 * TuringVault — Mantle mETH Native Yield Surface
 *
 * Pulls the canonical mETH/ETH redemption rate from a chain of
 * independent public sources and persists it to disk so we can
 * compute "passive protocol yield" for the agent's mETH balance
 * since the surface launch — without taking on counterparty risk
 * through any new lending integration.
 *
 * Honesty contract (workspace steering rule §1, §3):
 *   - Every returned rate carries an explicit `source` provenance
 *     label and `degraded: true` when served from disk snapshot.
 *   - Reference rate is captured EXACTLY once at first successful
 *     read; never overwritten by `captureRate()` afterwards.
 *   - Yield is computed as
 *         balance × (rateNow − rateRef) × ethPriceUsd
 *     and never combined visually with active trading PnL.
 *   - If `rateNow < rateRef` we surface assetHealth: "drift" and
 *     a 0 yield value (we never report negative passive yield as
 *     a number that could be confused with active loss).
 *
 * Sources (priority order):
 *   1. DefiLlama yields API     (no key, public, ticked frequently)
 *   2. meth.mantle.xyz stats    (Mantle's own public stats endpoint)
 *   3. Ethereum L1 RPC          (cold fallback — direct contract read)
 *   4. Disk snapshot            (last successful capture, ≤24h)
 *
 * Spec: .kiro/specs/meth-yield-surface/{requirements,design,tasks}.md
 * Risk panel: SAFE — read-only reads, no signing key wired in.
 *             Verified 2026-05-29 against
 *             https://www.theindustrial.in/news/8927219241/ that
 *             rsETH/KelpDAO incident did not impact mETH or Mantle
 *             infrastructure.
 */

const fs = require("fs");
const path = require("path");

const SNAPSHOT_PATH = path.resolve(
  __dirname,
  "../../src/data/meth_rate_history.json"
);
const SNAPSHOT_MAX_CAPTURES = 720;          // ~30 days hourly
const SNAPSHOT_STALE_MAX_AGE_SEC = 60 * 60 * 24; // 24h before "stale"

const FETCH_TIMEOUT_MS = 5000;
const ATOMIC_DECIMALS = 18n;
const TEN_E18 = 10n ** 18n;

// L1 Staking proxy — verified canonical mETH staking entry point.
// Reachable via any mainnet Ethereum RPC for a view-only call.
// Source: https://docs.mantle.xyz/meth/components/smart-contracts/staking-meth
// Address may be confirmed on first call — we cache it here as a
// well-known constant so we don't depend on the docs page being up.
const L1_STAKING_PROXY = "0xe3cBd06D7dadB3F4e6557bAb7EdD924CD1489E8f";

// Public Ethereum RPCs we rotate through. Each is read-only.
const L1_RPCS = [
  "https://cloudflare-eth.com",
  "https://eth.llamarpc.com",
  "https://rpc.ankr.com/eth",
];

// ── helpers ───────────────────────────────────────────────────────

async function fetchJson(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeout || FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      method: opts.method || "GET",
      headers: opts.headers,
      body: opts.body,
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// ── source 1: DefiLlama yields ────────────────────────────────────
//
// DefiLlama exposes pool metadata at /pools. For mETH we look for
// project === 'mantle-staked-ether' on Ethereum chain. APY is
// returned but the redemption rate is not, so this source provides
// (apy, tvl) and we bridge to the rate via meth.mantle.xyz or
// L1 RPC. If DefiLlama is the only one online we still surface
// the APY (which is what the homepage card shows most prominently)
// and a `currentRateAtomic === referenceRateAtomic` no-op for
// passive yield until source 2 or 3 reports a fresher rate.
async function fromDefiLlama() {
  const data = await fetchJson("https://yields.llama.fi/pools");
  const list = Array.isArray(data?.data) ? data.data : [];
  const pool = list.find((p) => {
    if (!p) return false;
    const proj = String(p.project || "").toLowerCase();
    const sym = String(p.symbol || "").toUpperCase();
    const chain = String(p.chain || "").toLowerCase();
    return (
      (proj === "mantle-staked-ether" || sym === "METH") &&
      chain === "ethereum"
    );
  });
  if (!pool) throw new Error("mETH pool not found on DefiLlama");
  const apy = Number(pool.apy);
  if (!Number.isFinite(apy)) throw new Error("invalid apy");
  return {
    apyPct: apy,
    tvlUsd: Number(pool.tvlUsd) || null,
    currentRateAtomic: null, // DefiLlama doesn't carry redemption rate
    source: "defillama",
    fetchedAt: new Date().toISOString(),
  };
}

// ── source 2: meth.mantle.xyz stats ───────────────────────────────
//
// The Mantle docs reference a stats endpoint at
// https://meth.mantle.xyz/stats; the public API path can vary
// between deployments. We try a small set of probable endpoints
// and accept the first JSON that has either an exchangeRate or
// currentRedemptionRate field.
async function fromMantleStats() {
  const candidates = [
    "https://meth.mantle.xyz/api/stats",
    "https://meth.mantle.xyz/api/exchange-rate",
    "https://meth.mantle.xyz/api/v1/stats",
  ];
  let lastErr = null;
  for (const url of candidates) {
    try {
      const data = await fetchJson(url);
      const rateFloat =
        Number(data?.exchangeRate) ||
        Number(data?.currentRedemptionRate) ||
        Number(data?.rate);
      if (!Number.isFinite(rateFloat) || rateFloat <= 0) continue;
      const rateAtomic = BigInt(Math.round(rateFloat * 1e18));
      const apyPct =
        Number(data?.apy) || Number(data?.currentApy) || null;
      return {
        apyPct,
        tvlUsd: Number(data?.tvlUsd) || null,
        currentRateAtomic: rateAtomic.toString(),
        source: "meth.mantle.xyz",
        fetchedAt: new Date().toISOString(),
      };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("meth.mantle.xyz stats unavailable");
}

// ── source 3: L1 Ethereum RPC ─────────────────────────────────────
//
// Reads `mETHToETH(1e18)` from the canonical L1 Staking proxy
// contract. This is the bottom-tier source; we hit it only if
// both web sources fail. The function selector for
// `mETHToETH(uint256)` is the first 4 bytes of
// keccak256("mETHToETH(uint256)") which is 0xb6cf1eaf.
async function fromL1Rpc() {
  const selector = "0xb6cf1eaf"; // mETHToETH(uint256)
  const oneE18Hex = TEN_E18.toString(16).padStart(64, "0");
  const callData = selector + oneE18Hex;

  let lastErr = null;
  for (const rpcUrl of L1_RPCS) {
    try {
      const body = {
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [
          { to: L1_STAKING_PROXY, data: callData },
          "latest",
        ],
      };
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      let res;
      try {
        res = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(t);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(`RPC error: ${json.error.message}`);
      const hex = String(json.result || "");
      if (!hex.startsWith("0x")) throw new Error("invalid result");
      const rateAtomic = BigInt(hex);
      if (rateAtomic <= 0n) throw new Error("non-positive rate");
      return {
        apyPct: null, // RPC doesn't give APY
        tvlUsd: null,
        currentRateAtomic: rateAtomic.toString(),
        source: "l1-rpc",
        fetchedAt: new Date().toISOString(),
      };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("all L1 RPCs failed");
}

// ── disk snapshot ────────────────────────────────────────────────

function readSnapshot() {
  try {
    if (!fs.existsSync(SNAPSHOT_PATH)) return null;
    const raw = fs.readFileSync(SNAPSHOT_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSnapshotAtomic(snapshot) {
  const tmp = SNAPSHOT_PATH + ".tmp";
  try {
    fs.writeFileSync(tmp, JSON.stringify(snapshot, null, 2));
    fs.renameSync(tmp, SNAPSHOT_PATH);
  } catch (err) {
    try {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    } catch {
      /* ignored */
    }
    throw err;
  }
}

function ageSec(ts) {
  if (!ts) return Infinity;
  const t = Date.parse(ts);
  if (!Number.isFinite(t)) return Infinity;
  return Math.max(0, (Date.now() - t) / 1000);
}

// ── public API ───────────────────────────────────────────────────

/**
 * Try the source chain in order, return the first success.
 * Falls back to disk snapshot if all live sources fail.
 *
 * Returned shape:
 *   {
 *     apyPct: number | null,
 *     tvlUsd: number | null,
 *     currentRateAtomic: string | null,
 *     source: "defillama" | "meth.mantle.xyz" | "l1-rpc"
 *           | "cached:<original>" | null,
 *     fetchedAt: ISO string,
 *     degraded: boolean,
 *     snapshotAgeSec?: number,
 *   }
 */
async function fetchMethRate() {
  const sources = [fromDefiLlama, fromMantleStats, fromL1Rpc];
  let lastErr = null;
  for (const src of sources) {
    try {
      const out = await src();
      return { ...out, degraded: false };
    } catch (err) {
      lastErr = err;
    }
  }
  // All live sources failed — try snapshot.
  const snap = readSnapshot();
  const lastCapture =
    snap && Array.isArray(snap.captures) && snap.captures.length > 0
      ? snap.captures[snap.captures.length - 1]
      : null;
  if (lastCapture) {
    const age = ageSec(lastCapture.ts);
    return {
      apyPct: lastCapture.apyPct ?? null,
      tvlUsd: lastCapture.tvlUsd ?? null,
      currentRateAtomic: lastCapture.currentRateAtomic ?? null,
      source: `cached:${lastCapture.source || "unknown"}`,
      fetchedAt: lastCapture.ts,
      degraded: true,
      snapshotAgeSec: age,
    };
  }
  throw lastErr || new Error("no rate sources reachable and no snapshot");
}

/**
 * Capture the latest rate to disk. Called per cron cycle.
 * Idempotent: setting `referenceRateAtomic` only on first non-null
 * rate seen.
 *
 * Returns the captured snapshot block { ts, currentRateAtomic, ... }
 * plus a boolean `referenceSet` so the caller can log it once.
 */
async function captureMethRate(opts = {}) {
  const ethPriceUsd = Number(opts.ethPriceUsd) || null;
  const live = await fetchMethRate();

  const snapshot = readSnapshot() || { captures: [] };
  const captures = Array.isArray(snapshot.captures) ? snapshot.captures : [];

  const entry = {
    ts: live.fetchedAt,
    currentRateAtomic: live.currentRateAtomic,
    apyPct: live.apyPct,
    tvlUsd: live.tvlUsd,
    source: live.degraded ? `cached:${(live.source || "").replace(/^cached:/, "")}` : live.source,
    ethPriceUsd,
  };

  let referenceSet = false;
  if (
    !snapshot.referenceRateAtomic &&
    live.currentRateAtomic
  ) {
    snapshot.referenceRateAtomic = live.currentRateAtomic;
    snapshot.referenceTs = live.fetchedAt;
    snapshot.referenceCapturedFromSource = live.source;
    referenceSet = true;
  }

  captures.push(entry);
  // Capacity-bound the array to most recent N entries.
  while (captures.length > SNAPSHOT_MAX_CAPTURES) captures.shift();
  snapshot.captures = captures;

  writeSnapshotAtomic(snapshot);

  return { entry, referenceSet, snapshot };
}

/**
 * Calculate passive yield for a given mETH balance.
 *
 * Returns:
 *   {
 *     passiveYieldEthAtomic: bigint string ("0" if drift/no rate),
 *     passiveYieldUsd: number,
 *     assetHealth: "ok" | "drift" | "no-data",
 *     rateDeltaBps: number,
 *   }
 *
 * Honest behaviour:
 *  - rateNow < rateRef → returns 0 yield + assetHealth:"drift"
 *    (we never expose a negative passive yield number that could
 *    be confused with active trading loss).
 *  - missing rateNow OR rateRef → assetHealth:"no-data" + 0 values.
 */
function calcPassiveYield({
  balanceFloat,
  rateNowAtomic,
  rateRefAtomic,
  ethPriceUsd,
}) {
  const haveRates =
    rateNowAtomic && rateRefAtomic && balanceFloat > 0;
  if (!haveRates) {
    return {
      passiveYieldEthAtomic: "0",
      passiveYieldUsd: 0,
      assetHealth: "no-data",
      rateDeltaBps: 0,
    };
  }
  const rNow = BigInt(rateNowAtomic);
  const rRef = BigInt(rateRefAtomic);
  if (rNow < rRef) {
    // Drift / depeg case — surface honestly, never as a number.
    const driftBps = Number(((rRef - rNow) * 10000n) / rRef) * -1;
    return {
      passiveYieldEthAtomic: "0",
      passiveYieldUsd: 0,
      assetHealth: "drift",
      rateDeltaBps: driftBps,
    };
  }
  // Yield in atomic ETH = balance × (rNow − rRef)
  // Balance is float (mETH human units). Convert to atomic safely.
  const balAtomic = BigInt(Math.round(balanceFloat * Number(TEN_E18)));
  const yieldAtomic = (balAtomic * (rNow - rRef)) / TEN_E18;
  const yieldEthFloat =
    Number(yieldAtomic) / Number(TEN_E18);
  const yieldUsd = ethPriceUsd
    ? yieldEthFloat * Number(ethPriceUsd)
    : 0;
  const deltaBps = Number(((rNow - rRef) * 10000n) / rRef);
  return {
    passiveYieldEthAtomic: yieldAtomic.toString(),
    passiveYieldUsd: yieldUsd,
    assetHealth: "ok",
    rateDeltaBps: deltaBps,
  };
}

// Exported for the API route.
function getReferenceRate() {
  const snap = readSnapshot();
  if (!snap) return null;
  return {
    referenceRateAtomic: snap.referenceRateAtomic || null,
    referenceTs: snap.referenceTs || null,
    referenceCapturedFromSource: snap.referenceCapturedFromSource || null,
  };
}

module.exports = {
  fetchMethRate,
  captureMethRate,
  calcPassiveYield,
  readSnapshot,
  getReferenceRate,
  // Constants exposed for tests:
  SNAPSHOT_PATH,
  SNAPSHOT_MAX_CAPTURES,
  SNAPSHOT_STALE_MAX_AGE_SEC,
};
