/**
 * Execution Guard metric — capital preservation from non-executed intents.
 *
 * Consensus-approved swaps that never landed on-chain (INTENT_SWAP_NO_EXEC
 * route-preflight failures) took NO position. The phantom-PnL fix correctly
 * excludes them from the realized Outcome Score. This helper surfaces the
 * complementary, COUNTERFACTUAL view: of those non-executed intents, how many
 * would have moved against us (loss avoided) vs in our favour (gain missed).
 *
 * IMPORTANT (no-lying-about-state §3): every number here is a "would-be"
 * outcome-score bps figure — confidence-weighted price move, NOT realized
 * wallet PnL and NOT dollars. The position never existed. Any UI rendering
 * this MUST label it counterfactual / execution-layer and must not show a
 * `$` sign. This helper is display-only; it never mutates the ledger.
 *
 * Spec: .kiro/specs/execution-guard-metric.
 */

// Mirrors the phantom predicate in /api/backtest and /api/performance.
function isNonExecutedIntent(row) {
  if (!row || row.executedOnChain === true) return false;
  const o = row.outcome;
  return o === "GOOD_CALL" || o === "BAD_CALL" || o === "INTENT_NOT_EXECUTED";
}

/**
 * @param {Array<{outcome?:string, pnlBps?:number, executedOnChain?:boolean}>} settledRows
 * @returns {{
 *   intentNotExecuted:number,
 *   wouldBeLossAvoided:{count:number, scoreBps:number},
 *   wouldBeGainMissed:{count:number, scoreBps:number},
 *   netScoreBpsAvoided:number,
 *   basis:string,
 * }}
 */
function computeExecutionGuard(settledRows) {
  const rows = Array.isArray(settledRows) ? settledRows : [];

  let intentNotExecuted = 0;
  let lossCount = 0;
  let lossBps = 0; // sum of negative pnlBps among non-executed BAD_CALL
  let gainCount = 0;
  let gainBps = 0; // sum of positive pnlBps among non-executed GOOD_CALL

  for (const row of rows) {
    if (!isNonExecutedIntent(row)) continue;
    intentNotExecuted++;
    const pnl = typeof row.pnlBps === "number" ? row.pnlBps : 0;
    if (row.outcome === "BAD_CALL") {
      lossCount++;
      lossBps += pnl; // negative
    } else if (row.outcome === "GOOD_CALL") {
      gainCount++;
      gainBps += pnl; // positive
    }
    // INTENT_NOT_EXECUTED rows (post-fix, pnlBps 0, no direction) count
    // toward intentNotExecuted only.
  }

  // Normalize -0 to 0 (negating a 0 sum yields -0, which trips Object.is
  // equality used by strict comparisons and reads oddly in the UI).
  const z = (n) => (n === 0 ? 0 : n);

  // Avoided loss is the positive magnitude of the negative would-be pnl.
  const wouldBeLossAvoidedBps = z(-lossBps);
  const wouldBeGainMissedBps = z(gainBps);
  const netScoreBpsAvoided = z(wouldBeLossAvoidedBps - wouldBeGainMissedBps);

  return {
    intentNotExecuted,
    wouldBeLossAvoided: { count: lossCount, scoreBps: wouldBeLossAvoidedBps },
    wouldBeGainMissed: { count: gainCount, scoreBps: wouldBeGainMissedBps },
    netScoreBpsAvoided,
    basis: "would-be outcome-score bps (counterfactual; not realized PnL)",
  };
}

module.exports = { computeExecutionGuard, isNonExecutedIntent };
