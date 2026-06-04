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

module.exports = {
  validationDenominator,
  buildDenominatorNote,
};
