function validationDenominator(validation) {
  if (!validation) return null;
  const total = Number(validation.totalProposals);
  if (Number.isFinite(total) && total > 0) return total;
  const approved = Number(validation.totalApproved ?? 0);
  const rejected = Number(validation.totalRejected ?? 0);
  const sum = approved + rejected;
  return sum > 0 ? sum : null;
}

function buildDenominatorNote({ totalDecisions, validation }) {
  const proposalTotal = validationDenominator(validation);
  if (!proposalTotal) {
    return "Decision rows come from DecisionLog; proposal approval counts load from ValidationRegistry.";
  }

  if (proposalTotal !== totalDecisions) {
    return `DecisionLog rows (${totalDecisions}) and ValidationRegistry proposals (${proposalTotal}) use different counters; approved + blocked is proposal-scoped.`;
  }

  return `Decision rows and proposal counts are aligned at ${totalDecisions}.`;
}

function extractDecisionTier(reasoningHash) {
  const match = String(reasoningHash || "").match(/^\[([A-Z0-9_]+)\]/);
  return match?.[1] || null;
}

function displayTier(decision = {}) {
  const explicit = decision.displayTier || decision._displayTier || null;
  const legacy = extractDecisionTier(decision.reasoningHash);
  const tier = explicit || legacy;
  if (tier === "EXECUTED_SWAP" && decision.executedOnChain === false) {
    return "INTENT_SWAP_NO_EXEC";
  }
  return tier;
}

function classifyDecisionForDisplay(decision = {}) {
  const tier = displayTier(decision);
  const validatorStatus = decision.status || null;

  if (tier) {
    return {
      label: tier,
      blocked:
        tier.startsWith("BLOCKED") ||
        tier === "INTENT_SWAP_NO_EXEC" ||
        tier === "EXECUTION_PROOF_PENDING",
      executed: tier === "EXECUTED_SWAP" || tier === "HEARTBEAT_SWAP",
      validatorStatus,
      tier,
    };
  }

  const status = String(validatorStatus || "").toUpperCase();
  if (status === "REJECTED" || status === "PENDING") {
    return {
      label: status,
      blocked: true,
      executed: false,
      validatorStatus,
      tier: null,
    };
  }

  if (String(decision.action || "").toLowerCase() === "hold") {
    return {
      label: "HOLD_ATTESTED",
      blocked: false,
      executed: false,
      validatorStatus,
      tier: null,
    };
  }

  return {
    label: status || "UNKNOWN",
    blocked: false,
    executed: false,
    validatorStatus,
    tier: null,
  };
}

function buildValidationStatCopy(validation) {
  const total = validationDenominator(validation);
  const rejected = Number(validation?.totalRejected ?? 0);
  const approved = Number(validation?.totalApproved ?? 0);
  return {
    approvedLabel: "Validator-approved proposals",
    rejectedLabel: "Validator-rejected proposals",
    rateLabel: "Validator rejection rate",
    note: total
      ? `${approved} approved / ${rejected} rejected validator outcomes; these are proposal verdicts, not executed trades.`
      : "Validation counters are proposal verdicts, not executed trades.",
  };
}

module.exports = {
  buildValidationStatCopy,
  classifyDecisionForDisplay,
  displayTier,
  extractDecisionTier,
  validationDenominator,
  buildDenominatorNote,
};
