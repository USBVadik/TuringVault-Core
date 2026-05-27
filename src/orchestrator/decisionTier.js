/**
 * Decision Tier classifier.
 *
 * Pure function. Given a multi-agent decision and the market context,
 * returns one of five categorical labels capturing WHY the cycle ended
 * the way it did. Used to:
 *   - Tag outcomes.json entries (replaces opaque consensus=true/false).
 *   - Prefix on-chain reasoning text so a judge sees the reason at
 *     a glance: "[BLOCKED_BY_VALIDATOR] Analyst said …".
 *   - Aggregate per-tier statistics on the dashboard.
 *
 * Pipeline order (a cycle that triggers two reasons surfaces the FIRST):
 *   1. parse_failure
 *   2. low_confidence
 *   3. regime_block
 *   4. validator_veto
 *   5. executed_swap
 *   6. fallthrough → regime_block (covers consensus=true,action=hold)
 *
 * NOTE on order: low_confidence comes before regime_block because the
 * primary user-facing question is "did the model believe its own call?"
 * If confidence was low, that's the more informative explanation than
 * "regime was HOLD".
 *
 * Spec: .kiro/specs/agent-reasoning-quality/{requirements,design,tasks}.md
 *       (R1; design C1)
 */

const TIERS = Object.freeze({
  EXECUTED_SWAP: "EXECUTED_SWAP",
  BLOCKED_BY_VALIDATOR: "BLOCKED_BY_VALIDATOR",
  BLOCKED_BY_LOW_CONFIDENCE: "BLOCKED_BY_LOW_CONFIDENCE",
  BLOCKED_BY_REGIME: "BLOCKED_BY_REGIME",
  BLOCKED_BY_PARSE_FAILURE: "BLOCKED_BY_PARSE_FAILURE",
});

const DEFAULT_THRESHOLD = 0.6;

/**
 * @param {object} decision  - return value of getMultiAgentDecision()
 *   Required (when present): decision.analyst, decision.validator
 *   Optional: decision._activeThreshold (number)
 *             decision.consensus (bool), decision.action (string)
 * @param {object} market    - market context
 *   Optional: market.structuredSignals.regime.regime (string)
 * @returns {string} one of TIERS values
 */
function classifyDecisionTier(decision, market) {
  const safeDecision = decision || {};
  const safeMarket = market || {};

  // 1. Parse failure — at least one agent's output couldn't be Zod-parsed.
  if (!safeDecision.analyst || !safeDecision.validator) {
    return TIERS.BLOCKED_BY_PARSE_FAILURE;
  }

  // 2. Low confidence — analyst's confidence didn't clear the threshold.
  //    Note: precedes regime check on purpose. See header comment.
  const threshold = safeDecision._activeThreshold ?? DEFAULT_THRESHOLD;
  const confidence = Number(safeDecision.analyst.confidence);
  if (Number.isFinite(confidence) && confidence < threshold) {
    return TIERS.BLOCKED_BY_LOW_CONFIDENCE;
  }

  // 3. Regime block — detector said HOLD or UNKNOWN before validator gate.
  const regime = safeMarket?.structuredSignals?.regime?.regime;
  if (regime === "HOLD" || regime === "UNKNOWN") {
    return TIERS.BLOCKED_BY_REGIME;
  }

  // 4. Validator veto — validator rejected the proposal.
  if (safeDecision.validator.approved !== true) {
    return TIERS.BLOCKED_BY_VALIDATOR;
  }

  // 5. Consensus reached and action is a swap → executed.
  if (safeDecision.consensus === true && safeDecision.action === "swap") {
    return TIERS.EXECUTED_SWAP;
  }

  // 6. Fallthrough: consensus reached but action is hold (regime-supported HOLD).
  return TIERS.BLOCKED_BY_REGIME;
}

module.exports = { classifyDecisionTier, TIERS };
