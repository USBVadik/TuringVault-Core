/**
 * TuringVault — Multi-Source Price Ticker Fetcher
 *
 * Sister module to candleSources.js (audit 19). Same problem class:
 * production cron sometimes hits CoinGecko's free-tier `simple/price`
 * endpoint and gets HTTP 429 from a runner-pool IP, leaving the
 * unified market context with `ethPrice: 0` and `mntPrice: 0` —
 * which downstream blocks the analyst's reasoning even when the
 * grid signal itself is healthy.
 *
 * Fix: try a chain of independent free sources, return the first
 * one that yields a valid `(ethPrice, mntPrice)` pair, with both
 * 24h change values where available.
 *
 * Sources (in order):
 *
 *   1. CoinGecko    — primary, returns both prices + 24h change in
 *                     one call. Free tier 30 calls/min/IP.
 *   2. Binance + Bybit (parallel) — Binance has ETHUSDT + 24hChg,
 *                     Bybit has MNTUSDT + 24hChg. Both return both
 *                     fields cleanly. Independent rate limits.
 *   3. Hyperliquid  — bottom layer, has both ETH and MNT mids but
 *                     no 24h change in `allMids`. We surface change
 *                     as null in that case rather than fake a value.
 *   4. Disk snapshot — last successful (ethPrice, mntPrice, change)
 *                     pair. 1h max age before refused.
 *
 * Honesty contract: every returned price set carries
 *   { ethPrice, mntPrice, ethChange24h, mntChange24h, source,
 *     fetchedAt, fromDiskSnapshot, snapshotAgeSec? }
 * Callers MUST surface `source` + `fromDiskSnapshot` in the
 * downstream context.
 *
 * Audit ref: .kiro/audits/19-blind-grid-rate-limit.md (extension
 * to the simple/price call path).
 */

const fs = require("fs");
const path = require("path");

const SNAPSHOT_PATH = path.resolve(
  __dirname,
  "../../src/data/price_cache.json"
);
const SNAPSHOT_MAX_AGE_SEC = 60 * 60; // 1 hour; price moves fast

const FETCH_TIMEOUT_MS = 5000;

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
    if (!r.ok) {
      throw new Error(`HTTP ${r.status}`);
    }
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// ── source: CoinGecko simple/price ────────────────────────────────
async function fromCoinGecko() {
  const url =
    "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,mantle&vs_currencies=usd&include_24hr_change=true";
  const data = await fetchJson(url);
  const ethPrice = Number(data?.ethereum?.usd);
  const mntPrice = Number(data?.mantle?.usd);
  if (!Number.isFinite(ethPrice) || ethPrice <= 0)
    throw new Error("invalid eth price");
  if (!Number.isFinite(mntPrice) || mntPrice <= 0)
    throw new Error("invalid mnt price");
  return {
    ethPrice,
    mntPrice,
    ethChange24h: Number(data.ethereum?.usd_24h_change) || null,
    mntChange24h: Number(data.mantle?.usd_24h_change) || null,
  };
}

// ── source: Binance + Bybit in parallel ───────────────────────────
async function fromBinanceBybit() {
  // Binance has ETHUSDT (we want USDT spot price as our $ proxy).
  // Bybit has MNTUSDT.
  // Run both in parallel to keep latency low; fail if either is missing.
  const [bin, byb] = await Promise.all([
    fetchJson(
      "https://api.binance.com/api/v3/ticker/24hr?symbol=ETHUSDT"
    ),
    fetchJson(
      "https://api.bybit.com/v5/market/tickers?category=spot&symbol=MNTUSDT"
    ),
  ]);
  const ethPrice = parseFloat(bin?.lastPrice);
  const ethChange24h = parseFloat(bin?.priceChangePercent);
  const t = byb?.result?.list?.[0];
  const mntPrice = parseFloat(t?.lastPrice);
  // Bybit returns price24hPcnt as a fraction string ("0.0354" = 3.54%).
  const mntChange24hRaw = parseFloat(t?.price24hPcnt);
  const mntChange24h = Number.isFinite(mntChange24hRaw)
    ? mntChange24hRaw * 100
    : null;
  if (!Number.isFinite(ethPrice) || ethPrice <= 0)
    throw new Error("Binance: invalid eth price");
  if (!Number.isFinite(mntPrice) || mntPrice <= 0)
    throw new Error("Bybit: invalid mnt price");
  return {
    ethPrice,
    mntPrice,
    ethChange24h: Number.isFinite(ethChange24h) ? ethChange24h : null,
    mntChange24h,
  };
}

// ── source: Hyperliquid allMids ───────────────────────────────────
async function fromHyperliquid() {
  const data = await fetchJson("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "allMids" }),
  });
  const ethPrice = parseFloat(data?.ETH);
  const mntPrice = parseFloat(data?.MNT);
  if (!Number.isFinite(ethPrice) || ethPrice <= 0)
    throw new Error("Hyperliquid: invalid eth price");
  if (!Number.isFinite(mntPrice) || mntPrice <= 0)
    throw new Error("Hyperliquid: invalid mnt price");
  // Hyperliquid allMids has no 24h change. Honest null vs fake zero.
  return {
    ethPrice,
    mntPrice,
    ethChange24h: null,
    mntChange24h: null,
  };
}

// ── disk snapshot ──────────────────────────────────────────────────

function readSnapshot() {
  try {
    if (!fs.existsSync(SNAPSHOT_PATH)) return null;
    return JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8"));
  } catch {
    return null;
  }
}

function writeSnapshot(prices, source) {
  try {
    const cache = {
      ...prices,
      source,
      savedAt: Date.now(),
    };
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(cache, null, 2));
  } catch {
    /* ignored */
  }
}

// ── public surface ─────────────────────────────────────────────────

const SOURCES = [
  { name: "coingecko", fn: fromCoinGecko },
  { name: "binance+bybit", fn: fromBinanceBybit },
  { name: "hyperliquid", fn: fromHyperliquid },
];

/**
 * Fetch ETH + MNT spot prices via the configured fallback chain.
 *
 * @returns {Promise<{
 *   ethPrice: number,
 *   mntPrice: number,
 *   ethChange24h: number|null,
 *   mntChange24h: number|null,
 *   source: string,
 *   fetchedAt: number,
 *   fromDiskSnapshot: boolean,
 *   snapshotAgeSec?: number,
 *   errors: string[],
 * }>}
 */
async function fetchPricesMultiSource() {
  const errors = [];
  for (const { name, fn } of SOURCES) {
    try {
      const prices = await fn();
      writeSnapshot(prices, name);
      return {
        ...prices,
        source: name,
        fetchedAt: Date.now(),
        fromDiskSnapshot: false,
        errors,
      };
    } catch (e) {
      errors.push(`${name}: ${(e.message || "unknown").slice(0, 80)}`);
    }
  }

  // All upstream failed — try disk snapshot.
  const snap = readSnapshot();
  if (snap?.ethPrice > 0 && snap?.mntPrice > 0) {
    const ageSec = Math.floor((Date.now() - (snap.savedAt || 0)) / 1000);
    if (ageSec <= SNAPSHOT_MAX_AGE_SEC) {
      return {
        ethPrice: snap.ethPrice,
        mntPrice: snap.mntPrice,
        ethChange24h: snap.ethChange24h ?? null,
        mntChange24h: snap.mntChange24h ?? null,
        source: `${snap.source || "unknown"}-snapshot`,
        fetchedAt: snap.savedAt,
        fromDiskSnapshot: true,
        snapshotAgeSec: ageSec,
        errors,
      };
    }
    errors.push(`disk-snapshot: too old (${ageSec}s)`);
  }

  // Total failure — return zeros + provenance so caller can flag honestly.
  return {
    ethPrice: 0,
    mntPrice: 0,
    ethChange24h: null,
    mntChange24h: null,
    source: "none",
    fetchedAt: Date.now(),
    fromDiskSnapshot: false,
    errors,
  };
}

module.exports = {
  fetchPricesMultiSource,
  // Exposed for unit tests only.
  _readSnapshot: readSnapshot,
  _writeSnapshot: writeSnapshot,
  _SNAPSHOT_PATH: SNAPSHOT_PATH,
  _SNAPSHOT_MAX_AGE_SEC: SNAPSHOT_MAX_AGE_SEC,
  _SOURCES: SOURCES.map((s) => s.name),
};
