/**
 * RWA Allocator — single decision point for "should we touch RWA
 * this cycle?".
 *
 * Two paths feed in:
 *   • Path A (LLM-driven)         — Analyst's `action` is `rwa_allocate`
 *                                   or `rwa_exit` and consensus reached.
 *   • Path B (idle-parking floor) — agent has been FLAT for ≥ 24 h,
 *                                   regime ≠ TREND_UP, cooldown elapsed,
 *                                   wallet has idle stable USD.
 *
 * Output:
 *   • RWAIntent  — execute this swap
 *   • RWASkip    — gated off; reason in `_gate`
 *   • null       — no RWA action this cycle (default)
 *
 * The cycle integrator (multiAgentLoop.js) treats both null and skip
 * as "no swap"; the difference is just logging granularity.
 *
 * Spec: rwa-allocation-active (R2, design §C3, CP1–CP4).
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const limits = require("../config/rwaLimits");
const { USDT0_ADDRESS } = require("../rwa/usdt0Module");

// Mantle USDT (legacy, Multichain bridge wrap of native USDT).
const USDT_ADDRESS = "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE";

const OUTCOMES_PATH = path.resolve(__dirname, "../data/outcomes.json");

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

function readOutcomesDb() {
  try {
    if (!fs.existsSync(OUTCOMES_PATH)) return null;
    return JSON.parse(fs.readFileSync(OUTCOMES_PATH, "utf-8"));
  } catch {
    return null;
  }
}

/**
 * Sum of `amountInUsd` from outcomes' rwaIntent fields where
 * `executed:true` AND `recordedAt` is within the last 24 h.
 *
 * Used to enforce MAX_PER_DAY_USD (CP3).
 */
function readDailySpendUsd(nowMs = Date.now(), db = readOutcomesDb()) {
  if (!db) return 0;
  const cutoff = nowMs - 24 * 60 * 60 * 1000;
  const all = [...(db.pending ?? []), ...(db.settled ?? [])];
  let sum = 0;
  for (const e of all) {
    const ri = e?.rwaIntent;
    if (!ri || !ri.executed) continue;
    const ts = Date.parse(e.recordedAt ?? e.settledAt ?? "");
    if (Number.isFinite(ts) && ts >= cutoff) {
      sum += Number(ri.amountInUsd ?? 0);
    }
  }
  return sum;
}

/**
 * Pull the latest ISO timestamp from any executed RWA swap.
 * Returns null if there's never been one.
 */
function readLastRwaSwapAt(db = readOutcomesDb()) {
  if (!db) return null;
  const all = [...(db.pending ?? []), ...(db.settled ?? [])];
  let latest = null;
  for (const e of all) {
    const ri = e?.rwaIntent;
    if (!ri || !ri.executed) continue;
    const ts = e.recordedAt ?? e.settledAt ?? null;
    if (ts && (!latest || Date.parse(ts) > Date.parse(latest))) latest = ts;
  }
  return latest;
}

/**
 * True if `posState.flatSince` is ≥ IDLE_PARKING_MIN_FLAT_MS old.
 */
function flatLongEnough(posState, nowMs) {
  if (!posState || posState.status !== "FLAT") return false;
  if (!posState.flatSince) return false;
  const since = Date.parse(posState.flatSince);
  if (!Number.isFinite(since)) return false;
  return nowMs - since >= limits.IDLE_PARKING_MIN_FLAT_MS;
}

/**
 * True if the cooldown after the last successful RWA swap has elapsed.
 * If there's never been a swap, cooldown is trivially elapsed.
 */
function cooldownElapsed(lastSwapAt, nowMs) {
  if (!lastSwapAt) return true;
  const ts = Date.parse(lastSwapAt);
  if (!Number.isFinite(ts)) return true;
  return nowMs - ts >= limits.IDLE_PARKING_COOLDOWN_MS;
}

/**
 * Floor a USD amount to the per-cycle ceiling.
 */
function clampToCycle(usd) {
  return Math.min(Number(usd) || 0, limits.MAX_PER_CYCLE_USD);
}

/**
 * Build a fully-typed RWAIntent given USD inputs and prices.
 * Slippage is encoded into amountOutMinWei.
 */
function buildIntent({ source, from, to, amountInUsd, prices, reason }) {
  const safeUsd = clampToCycle(amountInUsd);

  // Both USDT and USDT0 are 6-decimal stablecoins on Mantle. We treat
  // any *USD* stable as 6 decimals; if a different decimal asset is
  // ever wired in, callers must override `decimalsIn`.
  const DECIMALS = 6;
  const priceIn = prices?.[from] ?? 1;
  const priceOut = prices?.[to] ?? 1;

  const amountInTokens = safeUsd / priceIn;
  const amountInWei = ethers.parseUnits(
    amountInTokens.toFixed(DECIMALS),
    DECIMALS
  );

  // Expected out (1:1 stables) minus slippage.
  const slip = (10000 - limits.DEFAULT_SLIPPAGE_BPS) / 10000;
  const amountOutTokens = (safeUsd / priceOut) * slip;
  const amountOutMinWei = ethers.parseUnits(
    amountOutTokens.toFixed(DECIMALS),
    DECIMALS
  );

  return {
    source, // 'llm' | 'idle-parking'
    from, // 'USDT' | 'USDT0' | 'mUSD'
    to,
    fromAddress: from === "USDT0" ? USDT0_ADDRESS : USDT_ADDRESS,
    toAddress: to === "USDT0" ? USDT0_ADDRESS : USDT_ADDRESS,
    amountInUsd: safeUsd,
    amountInWei,
    amountOutMinWei,
    decimals: DECIMALS,
    reason: String(reason || "").slice(0, 200),
  };
}

// ───────────────────────────────────────────────────────────────
// Main entry
// ───────────────────────────────────────────────────────────────

/**
 * @param {object} args
 * @param {object} args.decision     — multi-agent decision object
 * @param {object} args.market       — market context (must include regime)
 * @param {object} args.balances     — { USDT, USDT0, mUSD, ... } floats
 * @param {object} args.prices       — { USDT:1, USDT0:1, mUSD:1, ... }
 * @param {string|null} args.lastSwapAt — ISO of most recent RWA swap
 * @param {object} args.posState     — positionState.getState() result
 * @param {object} [args.now]        — Date.now() override for testing
 * @returns {object|null}            — RWAIntent | RWASkip | null
 */
function evaluate(args) {
  const { decision, market, balances, prices, lastSwapAt, posState } =
    args || {};
  const nowMs = args?.now ?? Date.now();

  if (!balances || !prices) return null;

  // Idle stable in USD = USDT (legacy) + mUSD (when present).
  // USDT0 is the *target* of allocation, not a source of idle stables
  // for the parking path.
  const idleStableUsd =
    (balances.USDT ?? 0) * (prices.USDT ?? 1) +
    (balances.mUSD ?? 0) * (prices.mUSD ?? 1);

  // Hard floor: dust wallet → never touch RWA.
  if (
    idleStableUsd < limits.MIN_BALANCE_USD &&
    !(decision?.consensus && decision?.analyst?.action === "rwa_exit")
  ) {
    return { skip: true, _gate: "min-balance" };
  }

  // Daily ceiling (CP3).
  const dailySpend = readDailySpendUsd(nowMs);
  if (dailySpend >= limits.MAX_PER_DAY_USD) {
    return { skip: true, _gate: "daily-cap" };
  }

  const action = decision?.analyst?.action;
  const targetAsset = decision?.analyst?.targetAsset;
  const consensus = decision?.consensus === true;
  const regime =
    market?.regime || market?.structuredSignals?.regime?.regime || null;

  // ── Path A: LLM-driven ──────────────────────────────────────
  // Explicit rwa_allocate action
  if (consensus && action === "rwa_allocate") {
    const reason = `LLM allocate: ${
      decision?.analyst?.reasoning?.slice(0, 140) || "no reasoning"
    }`;
    return buildIntent({
      source: "llm",
      from: "USDT",
      to: "USDT0",
      amountInUsd: idleStableUsd, // clamped to MAX_PER_CYCLE_USD inside
      prices,
      reason,
    });
  }

  // ── Path A.1: Implicit RWA allocation ───────────────────────
  // When agent says "swap to mUSD/USDT" in risk-off regime, treat it as
  // RWA allocation intent. This bridges the gap between the old "swap"
  // vocabulary and the new "rwa_allocate" action.
  // Spec: rwa-allocation-active — implicit allocation path.
  if (
    consensus &&
    action === "swap" &&
    (targetAsset === "mUSD" || targetAsset === "USDT") &&
    (regime === "TREND_DOWN" || regime === "CRISIS" || regime === "HOLD")
  ) {
    const reason = `Implicit RWA (swap→${targetAsset} in ${regime}): ${
      decision?.analyst?.reasoning?.slice(0, 120) || "risk-off"
    }`;
    return buildIntent({
      source: "llm-implicit",
      from: "USDT",
      to: "USDT0",
      amountInUsd: idleStableUsd,
      prices,
      reason,
    });
  }

  // ── Path A.2: Implicit RWA exit ─────────────────────────────
  // When agent says "swap to mETH" in TREND_UP, and we hold USDT0,
  // exit RWA position first.
  if (
    consensus &&
    action === "swap" &&
    targetAsset === "mETH" &&
    regime === "TREND_UP"
  ) {
    const usdt0Usd = (balances.USDT0 ?? 0) * (prices.USDT0 ?? 1);
    if (usdt0Usd >= limits.MIN_BALANCE_USD) {
      const reason = `Implicit RWA exit (swap→mETH in TREND_UP): ${
        decision?.analyst?.reasoning?.slice(0, 120) || "risk-on"
      }`;
      return buildIntent({
        source: "llm-implicit",
        from: "USDT0",
        to: "USDT",
        amountInUsd: usdt0Usd,
        prices,
        reason,
      });
    }
  }

  // ── Path A.3: Conservative RWA allocation ───────────────────
  // When agent says HOLD (not confident enough to swap) but regime is
  // risk-off (TREND_DOWN, CRISIS, RANGING, HOLD), park idle stables
  // into USDT0 anyway. This ensures RWA allocation happens even when
  // the agent is uncertain — better to earn yield than sit at 0%.
  // Spec: rwa-allocation-active — conservative allocation path.
  const confidence = decision?.analyst?.confidence ?? 0;
  if (
    action === "hold" &&
    (regime === "TREND_DOWN" ||
      regime === "CRISIS" ||
      regime === "HOLD" ||
      regime === "RANGING")
  ) {
    // Only park a fraction (20%) when uncertain, not the full balance
    const parkFraction = confidence < 0.5 ? 0.15 : 0.25;
    const parkUsd = idleStableUsd * parkFraction;
    if (parkUsd >= limits.MIN_BALANCE_USD) {
      const reason = `Conservative RWA (HOLD in ${regime}, conf=${(
        confidence * 100
      ).toFixed(0)}%): parking ${(parkFraction * 100).toFixed(
        0
      )}% of idle stables`;
      return buildIntent({
        source: "conservative",
        from: "USDT",
        to: "USDT0",
        amountInUsd: parkUsd,
        prices,
        reason,
      });
    }
  }

  // Explicit rwa_exit action
  if (consensus && action === "rwa_exit") {
    const usdt0Usd = (balances.USDT0 ?? 0) * (prices.USDT0 ?? 1);
    if (usdt0Usd < limits.MIN_BALANCE_USD) {
      return { skip: true, _gate: "no-rwa-position-to-exit" };
    }
    const reason = `LLM exit: ${
      decision?.analyst?.reasoning?.slice(0, 140) || "no reasoning"
    }`;
    return buildIntent({
      source: "llm",
      from: "USDT0",
      to: "USDT",
      amountInUsd: usdt0Usd, // clamped inside
      prices,
      reason,
    });
  }

  // ── Path B: deterministic idle-parking ──────────────────────
  // Only fires when LLM said HOLD AND wallet is idle.
  // Note: `regime` already declared above in Path A section.

  if (
    !consensus &&
    posState?.status === "FLAT" &&
    regime !== "TREND_UP" &&
    flatLongEnough(posState, nowMs) &&
    cooldownElapsed(lastSwapAt, nowMs)
  ) {
    const parkUsd = idleStableUsd * limits.IDLE_PARKING_FRACTION;
    if (parkUsd < limits.MIN_BALANCE_USD) {
      return { skip: true, _gate: "park-too-small" };
    }

    const flatHours = posState.flatSince
      ? Math.floor((nowMs - Date.parse(posState.flatSince)) / 3600000)
      : "?";
    const reason =
      `Idle ${flatHours}h FLAT, regime=${regime || "unknown"}, ` +
      `parking ${(limits.IDLE_PARKING_FRACTION * 100).toFixed(
        0
      )}% of idle stables`;

    return buildIntent({
      source: "idle-parking",
      from: "USDT",
      to: "USDT0",
      amountInUsd: parkUsd,
      prices,
      reason,
    });
  }

  return null;
}

module.exports = {
  evaluate,
  // Exported for unit tests + the cycle integrator.
  readDailySpendUsd,
  readLastRwaSwapAt,
  flatLongEnough,
  cooldownElapsed,
  buildIntent,
  USDT_ADDRESS,
  USDT0_ADDRESS,
};
