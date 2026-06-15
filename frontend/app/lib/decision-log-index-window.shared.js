const DEFAULT_DECISION_LOG_SEARCH_WINDOW = 32;

function buildDecisionLogCandidateWindow({
  decisionId,
  totalDecisions,
  windowSize = DEFAULT_DECISION_LOG_SEARCH_WINDOW,
}) {
  const id = Number(decisionId);
  const total = Number(totalDecisions);
  const size = Math.max(1, Number(windowSize) || DEFAULT_DECISION_LOG_SEARCH_WINDOW);
  if (!Number.isFinite(id) || !Number.isFinite(total) || id < 0 || total <= 0) {
    return [];
  }

  const start = Math.min(Math.floor(id), Math.floor(total) - 1);
  const end = Math.max(0, start - size + 1);
  const out = [];
  for (let idx = start; idx >= end; idx -= 1) {
    out.push(idx);
  }
  return out;
}

module.exports = {
  DEFAULT_DECISION_LOG_SEARCH_WINDOW,
  buildDecisionLogCandidateWindow,
};
