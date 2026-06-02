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

const STATE_PATH = path.resolve(__dirname, "../data/position_state.json");

const INITIAL_STATE = {
  status: "FLAT", // FLAT | IN_mETH | IN_MNT | IN_mUSD
  entryPrice: null, // price when we entered current position
  entryTime: null, // ISO timestamp of entry
  targetExit: null, // take-profit price (from rangingGrid at entry)
  stopLoss: null, // stop-loss price (from rangingGrid at entry — SINGLE SOURCE OF TRUTH)
  highWaterMark: null, // highest price since entry (for trailing stop)
  allocationPct: null, // how much % of portfolio was moved
  cycleCount: 0, // how many cycles in current position (prevent infinite hold)
  // ISO of when we became FLAT. Used by rwaAllocator (Path B idle-parking)
  // to know how long the wallet has been idle. Null while in a position.
  // Spec: rwa-allocation-active R2.3 / design §C5.
  flatSince: null,
  lastUpdated: null,
};

const MAX_CYCLES_IN_POSITION = 20; // ~1 hour at 3min cycles — force re-eval if stuck

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
function enterPosition({
  status,
  entryPrice,
  targetExit,
  stopLoss,
  allocationPct,
}) {
  const state = {
    status, // 'IN_mETH', 'IN_MNT', or 'IN_mUSD'
    entryPrice,
    entryTime: new Date().toISOString(),
    targetExit: targetExit || null,
    stopLoss: stopLoss || null,
    highWaterMark: entryPrice, // starts at entry
    allocationPct: allocationPct || null,
    cycleCount: 0,
    flatSince: null, // not flat anymore
    lastUpdated: null,
  };
  return save(state);
}

/**
 * Record that we exited a position (flat again)
 * Called after take-profit, stop-loss, or channel exit swap
 */
function exitPosition(reason) {
  const prev = load();
  const state = {
    ...INITIAL_STATE,
    flatSince: new Date().toISOString(), // start the FLAT clock for rwaAllocator
    lastExitReason: reason || "manual",
    lastExitTime: new Date().toISOString(),
    lastEntryPrice: prev.entryPrice,
    lastExitPrice: null, // caller can set this
  };
  return save(state);
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
function applyPositionAwareness(rawSignal, currentPrice) {
  const state = load();
  const signal = { ...rawSignal, positionState: state };

  // ── Already IN mETH ─────────────────────────────────────────────
  if (state.status === "IN_mETH") {
    // Take-profit check — FIRST (highest priority)
    if (state.targetExit && currentPrice >= state.targetExit) {
      return {
        ...signal,
        action: "SELL_mETH",
        reason: `TAKE PROFIT: Current $${currentPrice} reached target $${
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
        reason: `STOP LOSS: Current $${currentPrice} hit stop $${
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
        reason: `MAX HOLD TIME: In mETH for ${state.cycleCount} cycles (entry $${state.entryPrice}). Exiting to re-evaluate channel.`,
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
        reason: `Already IN_mETH since $${state.entryPrice} (${state.cycleCount} cycles). Waiting for take-profit at $${state.targetExit} or stop at $${state.stopLoss}.`,
        overrideReason: "ALREADY_IN_POSITION",
      };
    }

    // Still holding — HOLD
    return {
      ...signal,
      action: "HOLD",
      reason: `Holding mETH (cycle ${state.cycleCount}/${MAX_CYCLES_IN_POSITION}). Entry: $${state.entryPrice}, Target: $${state.targetExit}, Stop: $${state.stopLoss}, Current: $${currentPrice}`,
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

module.exports = {
  getState,
  enterPosition,
  exitPosition,
  tickCycle,
  updateHWM,
  applyPositionAwareness,
  STATE_PATH,
};
