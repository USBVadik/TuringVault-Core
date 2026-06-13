function normalizeTxHash(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

function effectiveOutcomeTier(row) {
  return row?.displayTier ?? row?._displayTier ?? row?.decisionTier ?? null;
}

function isTierCompatible(row, fallbackDecisionTier) {
  if (!fallbackDecisionTier) return true;
  return (
    row?.decisionTier === fallbackDecisionTier ||
    effectiveOutcomeTier(row) === fallbackDecisionTier
  );
}

function buildOutcomeIndexes(rows = []) {
  const byDecisionId = new Map();
  const byDecisionLogTxHash = new Map();

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    if (typeof row.decisionId === "number") {
      byDecisionId.set(row.decisionId, row);
    }
    const hash = normalizeTxHash(row.decisionLogTxHash);
    if (hash) byDecisionLogTxHash.set(hash, row);
  }

  return { byDecisionId, byDecisionLogTxHash };
}

function selectOutcomeRow({
  decisionLogId,
  decisionLogTxHash = null,
  fallbackDecisionTier = null,
  byDecisionId,
  byDecisionLogTxHash,
}) {
  const hash = normalizeTxHash(decisionLogTxHash);
  if (hash && byDecisionLogTxHash?.has(hash)) {
    return byDecisionLogTxHash.get(hash);
  }

  const shifted = byDecisionId?.get(decisionLogId + 1) ?? null;
  const exact = byDecisionId?.get(decisionLogId) ?? null;
  const candidates = [shifted, exact].filter(Boolean);
  const compatible = candidates.find((row) =>
    isTierCompatible(row, fallbackDecisionTier)
  );

  if (compatible) return compatible;

  // When we have an on-chain DecisionLogged tx hash but no matching
  // outcome row, a nearby id is likely a skipped/stale cron commit. In
  // that case the on-chain reasoning prefix is more honest than a
  // shifted outcome from a different cycle.
  if (hash) return null;

  return shifted || exact || null;
}

module.exports = {
  buildOutcomeIndexes,
  effectiveOutcomeTier,
  normalizeTxHash,
  selectOutcomeRow,
};
