/**
 * TuringVault — Position State Manager
 *
 * Persistent memory of the current grid position.
 * Survives agent restarts (stored in src/data/position_state.json).
 *
 * Problem it solves:
 *   Without this, every cycle the agent sees "price at $2118 = BUY_mETH"
 *   and proposes a BUY even if we already bought at $2118 last cycle.
 *   This causes double-buying and destroys the mean-reversion logic.
 *
 * State machine:
 *   FLAT      → no position, looking for entry
 *   IN_mETH   → bought mETH at entryPrice, waiting for take-profit or stop
 *   IN_MNT    → bought WMNT/MNT exposure, managed by multi-asset grid candidate
 *   IN_mUSD   → sold mETH (defensive or take-profit), waiting for re-entry
 *
 * Used by:
 *   rangingGrid.js  — to modify grid signal based on current state
 *   multiAgentLoop.js — to update state after execution
 */

const path = require("path");
const fs = require("fs");

const STATE_PATH = process.env.POSITION_STATE_PATH
  ? path.resolve(process.env.POSITION_STATE_PATH)
  : path.resolve(__dirname, "../data/position_state.json");

const INITIAL_STATE = {
  status: "FLAT", // FLAT | IN_mETH | IN_MNT | IN_mUSD
  entryPrice: null, // price when we entered current position
  entryTime: null, // ISO timestamp of entry
  targetExit: null, // take-profit price (from rangingGrid at entry)
  stopLoss: null, // stop-loss price (from rangingGrid at entry — SINGLE SOURCE OF TRUTH)
  highWaterMark: null, // highest price since entry (for trailing stop)
  allocationPct: null, // how much % of portfolio was moved
  executionEntryPrice: null, // actual stablecoin cost per received target token
  executionCostUsd: null,
  executionAmountOut: null,
  executionSourceAsset: null,
  executionTargetAsset: null,
  executionTxHash: null,
  scaleInCount: 0, // controlled same-asset scale-ins used in this position
  lastScaleInAt: null,
  cycleCount: 0, // how many cycles in current position (prevent infinite hold)
  // ISO of when we became FLAT. Used by rwaAllocator idle-parking
  // to know how long the wallet has been idle. Null while in a position.
  // Spec: rwa-allocation-active R2.3 / design §C5.
  flatSince: null,
  lastUpdated: null,
};

const MAX_CYCLES_IN_POSITION = 20; // ~60 hours at the canonical 3h cadence; force re-evaluation if stuck

function load() {
  if (!fs.existsSync(STATE_PATH)) return { ...INITIAL_STATE };
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  } catch {
    return { ...INITIAL_STATE };
  }
}

function save(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  state.lastUpdated = new Date().toISOString();
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  return state;
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function executionFieldsFromEntry(entry = {}) {
  return {
    executionEntryPrice: entry.executionEntryPrice || null,
    executionCostUsd: entry.executionCostUsd || null,
    executionAmountOut: entry.executionAmountOut || null,
    executionSourceAsset: entry.executionSourceAsset || null,
    executionTargetAsset: entry.executionTargetAsset || null,
    executionTxHash: entry.executionTxHash || null,
  };
}

function mergeExecutionFields(prevState = {}, entry = {}) {
  const prevCost = Math.max(0, num(prevState.executionCostUsd, 0));
  const nextCost = Math.max(0, num(entry.executionCostUsd, 0));
  const prevOut = Math.max(0, num(prevState.executionAmountOut, 0));
  const nextOut = Math.max(0, num(entry.executionAmountOut, 0));
  const totalCost = prevCost + nextCost;
  const totalOut = prevOut + nextOut;
  const executionEntryPrice =
    totalCost > 0 && totalOut > 0
      ? totalCost / totalOut
      : entry.executionEntryPrice || prevState.executionEntryPrice || null;

  return {
    executionEntryPrice,
    executionCostUsd: totalCost || entry.executionCostUsd || prevState.executionCostUsd || null,
    executionAmountOut: totalOut || entry.executionAmountOut || prevState.executionAmountOut || null,
    executionSourceAsset:
      entry.executionSourceAsset || prevState.executionSourceAsset || null,
    executionTargetAsset:
      entry.executionTargetAsset || prevState.executionTargetAsset || null,
    executionTxHash: entry.executionTxHash || prevState.executionTxHash || null,
  };
}

function buildEnteredPositionState(prevState = {}, entry = {}, nowIso) {
  const now = nowIso || new Date().toISOString();
  const samePosition =
    prevState.status === entry.status &&
    prevState.status !== "FLAT" &&
    num(prevState.entryPrice, 0) > 0;

  if (!samePosition) {
    return {
      status: entry.status,
      entryPrice: entry.entryPrice,
      entryTime: now,
      targetExit: entry.targetExit || null,
      stopLoss: entry.stopLoss || null,
      highWaterMark: entry.entryPrice,
      allocationPct: entry.allocationPct || null,
      ...executionFieldsFromEntry(entry),
      scaleInCount: 0,
      lastScaleInAt: null,
      cycleCount: 0,
      flatSince: null,
      lastUpdated: null,
    };
  }

  const previousAllocation = Math.max(0, num(prevState.allocationPct, 0));
  const nextAllocation = Math.max(0, num(entry.allocationPct, 0));
  const totalAllocation = previousAllocation + nextAllocation;
  const averagedEntry =
    totalAllocation > 0
      ? (num(prevState.entryPrice) * previousAllocation +
          num(entry.entryPrice) * nextAllocation) /
        totalAllocation
      : entry.entryPrice;

  return {
    status: entry.status,
    entryPrice: averagedEntry,
    entryTime: prevState.entryTime || now,
    targetExit: entry.targetExit || prevState.targetExit || null,
    stopLoss: entry.stopLoss || prevState.stopLoss || null,
    highWaterMark: Math.max(
      num(prevState.highWaterMark, num(prevState.entryPrice)),
      num(entry.entryPrice)
    ),
    allocationPct: totalAllocation || nextAllocation || previousAllocation || null,
    ...mergeExecutionFields(prevState, entry),
    scaleInCount: num(prevState.scaleInCount, 0) + 1,
    lastScaleInAt: now,
    cycleCount: 0,
    flatSince: null,
    lastUpdated: null,
  };
}

/**
 * Get current position state
 */
function getState() {
  return load();
}

/**
 * Record that we entered a position
 * Called by multiAgentLoop after successful swap execution
 */
function enterPosition(entry = {}) {
  const state = buildEnteredPositionState(load(), entry);
  return save(state);
}

function buildStateWithExecutionBasis(prevState = {}, basis = {}) {
  if (!prevState || prevState.status === "FLAT") return { ...prevState };
  if (num(prevState.executionAmountOut, 0) > 0) return { ...prevState };
  const asset = basis.asset;
  if (!sourceMatchesPosition(asset, prevState.status)) return { ...prevState };
  const quantity = Math.max(0, num(basis.quantity, 0));
  const costUsd = Math.max(0, num(basis.costUsd, 0));
  if (!quantity || !costUsd) return { ...prevState };
  return {
    ...prevState,
    executionEntryPrice: costUsd / quantity,
    executionCostUsd: costUsd,
    executionAmountOut: quantity,
    executionSourceAsset: basis.sourceAsset || "USDT0",
    executionTargetAsset: asset,
    executionTxHash: basis.txHash || null,
  };
}

function hydrateExecutionBasis(basis = {}) {
  const prev = load();
  const next = buildStateWithExecutionBasis(prev, basis);
  if (JSON.stringify(next) === JSON.stringify(prev)) return prev;
  return save(next);
}

function exitState(prevState = {}, reason, nowIso) {
  const now = nowIso || new Date().toISOString();
  return {
    ...INITIAL_STATE,
    flatSince: now,
    lastExitReason: reason || "manual",
    lastExitTime: now,
    lastEntryPrice: prevState.entryPrice,
    lastExitPrice: null,
  };
}

function sourceMatchesPosition(sourceAsset, status) {
  if (status === "IN_mETH") return ["mETH", "WETH"].includes(sourceAsset);
  if (status === "IN_MNT" || status === "IN_RISK") {
    return ["MNT", "WMNT"].includes(sourceAsset);
  }
  return false;
}

function buildPositionAfterExit(prevState = {}, exit = {}) {
  const now = exit.nowIso || new Date().toISOString();
  const exitTrackingFloorUsd = Math.max(
    0,
    num(exit.minExitUsd, num(exit.minTradeUsd, 0))
  );
  const remainingSourceUsd = Math.max(0, num(exit.remainingSourceUsd, 0));
  const amountIn = Math.max(0, num(exit.amountIn, 0));
  const reason = exit.reason || "GRID_EXIT";

  if (!sourceMatchesPosition(exit.sourceAsset, prevState.status)) {
    return { ...prevState };
  }

  const trackedQty = Math.max(0, num(prevState.executionAmountOut, 0));
  const remainingTrackedQty = trackedQty
    ? Math.max(0, trackedQty - amountIn)
    : null;
  const trackedLotClosed = trackedQty > 0 && remainingTrackedQty <= 1e-12;
  if (trackedLotClosed || remainingSourceUsd < exitTrackingFloorUsd) {
    return exitState(prevState, reason, now);
  }

  let executionCostUsd = prevState.executionCostUsd ?? null;
  let executionAmountOut = prevState.executionAmountOut ?? null;
  if (trackedQty > 0 && remainingTrackedQty != null) {
    const remainingFraction = remainingTrackedQty / trackedQty;
    executionAmountOut = remainingTrackedQty;
    executionCostUsd = Math.max(
      0,
      num(prevState.executionCostUsd, 0) * remainingFraction
    );
  }

  return {
    ...prevState,
    executionAmountOut,
    executionCostUsd,
    executionEntryPrice:
      executionAmountOut > 0 && executionCostUsd > 0
        ? executionCostUsd / executionAmountOut
        : prevState.executionEntryPrice ?? null,
    allocationPct:
      trackedQty > 0 && remainingTrackedQty != null
        ? num(prevState.allocationPct, 0) * (remainingTrackedQty / trackedQty)
        : prevState.allocationPct,
    cycleCount: 0,
    lastPartialExitAt: now,
    lastPartialExitReason: reason,
    lastPartialExitAmount: amountIn,
    lastUpdated: null,
  };
}

function recordExecutedExit(exit = {}) {
  return save(buildPositionAfterExit(load(), exit));
}

/**
 * Record that we exited a position (flat again)
 * Called after take-profit, stop-loss, or channel exit swap
 */
function exitPosition(reason) {
  const prev = load();
  return save(exitState(prev, reason));
}

/**
 * Increment cycle count (called each loop iteration when in position)
 * Prevents the agent from sitting in a position forever
 */
function tickCycle() {
  const state = load();
  if (state.status === "FLAT") return state;
  state.cycleCount = (state.cycleCount || 0) + 1;
  return save(state);
}

/**
 * Update high water mark for trailing stop tracking.
 * Call every cycle with current price.
 */
function updateHWM(currentPrice) {
  const state = load();
  if (state.status === "FLAT" || !state.entryPrice) return state;
  const hwm = state.highWaterMark || state.entryPrice;
  if (currentPrice > hwm) {
    state.highWaterMark = currentPrice;
    return save(state);
  }
  return state;
}

/**
 * Determine what the grid signal should actually be given current position state.
 * This wraps the raw gridSignal and adjusts for position awareness.
 *
 * @param {object} rawSignal - from rangingGrid.getGridSignal()
 * @param {number} currentPrice - live price
 * @returns {object} adjusted signal with position context
 */
function applyPositionAwarenessToState(rawSignal, currentPrice, state = {}) {
  const signal = { ...rawSignal, positionState: state };

  // ── Already in a tracked risk position ──────────────────────────
  if (["IN_mETH", "IN_MNT", "IN_RISK"].includes(state.status)) {
    const positionLabel = state.status === "IN_mETH" ? "mETH" : "MNT/WMNT";
    // Take-profit check — FIRST (highest priority)
    if (state.targetExit && currentPrice >= state.targetExit) {
      return {
        ...signal,
        action: "SELL_mETH",
        reason: `TAKE PROFIT ${positionLabel}: Current $${currentPrice} reached target $${
          state.targetExit
        }. Entry was $${state.entryPrice}. PnL: +${(
          (currentPrice / state.entryPrice - 1) *
          100
        ).toFixed(2)}%`,
        confidence: 0.9,
        overrideReason: "TAKE_PROFIT",
      };
    }

    // Stop-loss check — SECOND (critical risk management)
    if (state.stopLoss && currentPrice <= state.stopLoss) {
      return {
        ...signal,
        action: "SELL_mETH",
        reason: `STOP LOSS ${positionLabel}: Current $${currentPrice} hit stop $${
          state.stopLoss
        }. Entry was $${state.entryPrice}. PnL: ${(
          (currentPrice / state.entryPrice - 1) *
          100
        ).toFixed(2)}%`,
        confidence: 0.95,
        overrideReason: "STOP_LOSS",
      };
    }

    // Max cycles exceeded — force re-evaluation
    if (state.cycleCount >= MAX_CYCLES_IN_POSITION) {
      return {
        ...signal,
        action: "SELL_mETH",
        reason: `MAX HOLD TIME: In ${positionLabel} for ${state.cycleCount} cycles (entry $${state.entryPrice}). Exiting to re-evaluate channel.`,
        confidence: 0.7,
        overrideReason: "MAX_CYCLES",
      };
    }

    // Grid says SELL or EXIT — follow it
    if (
      rawSignal.action === "SELL_mETH" ||
      rawSignal.action === "EXIT_RANGING"
    ) {
      const pnl = ((currentPrice / state.entryPrice - 1) * 100).toFixed(2);
      return {
        ...signal,
        reason: `${rawSignal.reason} | Position exit: entry $${
          state.entryPrice
        } → current $${currentPrice} (${pnl > 0 ? "+" : ""}${pnl}%)`,
        overrideReason: "GRID_EXIT",
      };
    }

    // Don't buy again — already in position
    if (rawSignal.action === "BUY_mETH") {
      return {
        ...signal,
        action: "HOLD",
        reason: `Already in ${positionLabel} since $${state.entryPrice} (${state.cycleCount} cycles). Waiting for take-profit at $${state.targetExit} or stop at $${state.stopLoss}.`,
        overrideReason: "ALREADY_IN_POSITION",
      };
    }

    // Still holding — HOLD
    return {
      ...signal,
      action: "HOLD",
      reason: `Holding ${positionLabel} (cycle ${state.cycleCount}/${MAX_CYCLES_IN_POSITION}). Entry: $${state.entryPrice}, Target: $${state.targetExit}, Stop: $${state.stopLoss}, Current: $${currentPrice}`,
      overrideReason: "HOLDING",
    };
  }

  // ── Already IN mUSD (defensive) ─────────────────────────────────
  if (state.status === "IN_mUSD") {
    // Don't sell again
    if (rawSignal.action === "SELL_mETH") {
      return {
        ...signal,
        action: "HOLD",
        reason: `Already IN_mUSD (defensive). Waiting for price to return to buy zone. Channel position: ${
          rawSignal.channel
            ? (rawSignal.channel.channelPosition * 100).toFixed(0) + "%"
            : "unknown"
        }`,
        overrideReason: "ALREADY_IN_mUSD",
      };
    }

    // Re-entry signal — follow it
    if (rawSignal.action === "BUY_mETH") {
      return {
        ...signal,
        reason: `Re-entry: ${rawSignal.reason} | Was in mUSD for ${state.cycleCount} cycles`,
        overrideReason: "REENTRY",
      };
    }
  }

  // FLAT — follow raw signal directly
  return signal;
}

function applyPositionAwareness(rawSignal, currentPrice) {
  return applyPositionAwarenessToState(rawSignal, currentPrice, load());
}

/**
 * Decide whether a stuck, past-max-hold position should be reconciled to
 * FLAT.
 *
 * Fires whenever the position is non-FLAT, has been held for at least
 * MAX_CYCLES_IN_POSITION cycles, and NO alpha swap executed this cycle —
 * regardless of *why* it didn't execute (blocked by low-confidence /
 * regime / validator, or a consensus swap that the router couldn't fill
 * because the wallet is already stable-heavy / the residual is sub-floor).
 * Past max-hold the agent is always in forced-exit mode, so a stuck
 * position that can't exit for that long is released to stop it aging and
 * eventually resurfacing as repeated INTENT_SWAP_NO_EXEC.
 *
 * Honesty: the residual holding stays in the wallet and is still shown
 * truthfully in holdings — we only stop tracking it as an *active grid
 * position* so the existing "stable-heavy + FLAT" logic can label cycles
 * cleanly (BLOCKED_BY_PORTFOLIO / HOLD) instead of a failed swap.
 */
function shouldReconcileStalePosition(
  state = {},
  {
    alphaSwapExecuted = false,
    sourceInventoryUsd = null,
    minExitUsd = 1,
  } = {}
) {
  if (alphaSwapExecuted) return false;
  if (!state || state.status === "FLAT") return false;
  if (sourceInventoryUsd == null) return false;
  const inventoryUsd = Number(sourceInventoryUsd);
  return (
    num(state.cycleCount, 0) >= MAX_CYCLES_IN_POSITION &&
    Number.isFinite(inventoryUsd) &&
    inventoryUsd >= 0 &&
    inventoryUsd < Math.max(0, num(minExitUsd, 1))
  );
}

module.exports = {
  getState,
  buildEnteredPositionState,
  buildStateWithExecutionBasis,
  buildPositionAfterExit,
  enterPosition,
  hydrateExecutionBasis,
  recordExecutedExit,
  exitPosition,
  tickCycle,
  updateHWM,
  applyPositionAwareness,
  applyPositionAwarenessToState,
  shouldReconcileStalePosition,
  MAX_CYCLES_IN_POSITION,
  STATE_PATH,
};
