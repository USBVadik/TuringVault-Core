/**
 * Agent pipeline funnel + executed-trade win rate.
 *
 * Honest, data-grounded view of the multi-agent pipeline for the homepage.
 * All values are COUNTS or a win-rate over EXECUTED directional swaps — no
 * per-agent "accuracy %" is fabricated (the ledger does not support per-model
 * hit rates: arbiter votes are recorded in ~4% of rows, and the LLM
 * validator's standalone blocks scored ~26% right, so any "validators caught
 * the bad trades" claim would be false). Rule: no-lying-about-state §3/§5.
 *
 * executed-trade win rate = of swaps that ACTUALLY took a position on-chain
 * (executedOnChain === true && GOOD_CALL/BAD_CALL), how many were GOOD. This
 * excludes holds and non-executed intents (phantom). Display-only.
 *
 * Spec: .kiro/specs/honest-pipeline-funnel.
 */

const DETERMINISTIC_BLOCK_TIERS = [
  "BLOCKED_BY_REGIME",
  "BLOCKED_BY_PORTFOLIO",
  "BLOCKED_BY_LOW_CONFIDENCE",
  "BLOCKED_BY_PARSE_FAILURE",
  "BLOCKED_BY_ECONOMICS",
];

function round1(n) {
  return Math.round(n * 10) / 10;
}

/**
 * @param {Array<{consensus?:boolean, decisionTier?:string, executedOnChain?:boolean, outcome?:string, action?:string}>} settledRows
 */
function computePipelineFunnel(settledRows) {
  const rows = Array.isArray(settledRows) ? settledRows : [];
  const totalDecisions = rows.length;

  const executedDirectional = rows.filter(
    (s) =>
      s.executedOnChain === true &&
      (s.outcome === "GOOD_CALL" || s.outcome === "BAD_CALL")
  );
  const executedTradeWins = executedDirectional.filter(
    (s) => s.outcome === "GOOD_CALL"
  ).length;
  const executedTradeLosses = executedDirectional.filter(
    (s) => s.outcome === "BAD_CALL"
  ).length;
  const executedTradeTotal = executedDirectional.length;
  const executedTradeWinRate =
    executedTradeTotal > 0
      ? round1((executedTradeWins / executedTradeTotal) * 100)
      : null;

  const consensusApproved = rows.filter((s) => s.consensus === true).length;
  const noActionHolds = rows.filter(
    (s) => s.decisionTier === "HOLD_NO_ACTION" || s.outcome === "NO_ACTION"
  ).length;
  const isBlocked = (s) =>
    s.decisionTier !== "HOLD_NO_ACTION" &&
    s.outcome !== "NO_ACTION" &&
    (s.consensus === false ||
      DETERMINISTIC_BLOCK_TIERS.includes(s.decisionTier) ||
      s.decisionTier === "BLOCKED_BY_VALIDATOR");
  const blockedTotal = rows.filter(isBlocked).length;
  const blockedDeterministic = rows.filter(
    (s) =>
      isBlocked(s) &&
      DETERMINISTIC_BLOCK_TIERS.includes(s.decisionTier)
  ).length;
  const blockedValidator = rows.filter(
    (s) => isBlocked(s) && s.decisionTier === "BLOCKED_BY_VALIDATOR"
  ).length;
  const blockedOther = blockedTotal - blockedDeterministic - blockedValidator;

  return {
    executedTradeWinRate,
    executedTradeWins,
    executedTradeLosses,
    executedTradeTotal,
    pipelineFunnel: {
      totalDecisions,
      consensusApproved,
      executed: executedTradeTotal,
      executedWon: executedTradeWins,
      noActionHolds,
      blockedTotal,
      blockedDeterministic,
      blockedValidator,
      blockedOther,
    },
  };
}

module.exports = { computePipelineFunnel, DETERMINISTIC_BLOCK_TIERS };
