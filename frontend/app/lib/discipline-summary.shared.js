const KNOWN_GATES = ["tx_proof", "price_freshness", "drift_detection"];
const TX_PROOF_NAMES = new Set([
  "tx_exists",
  "tx_sender",
  "tx_confirmed",
  "tx_success",
  "tx_proof",
]);
const EXECUTED_TIERS = new Set(["EXECUTED_SWAP", "HEARTBEAT_SWAP"]);

function emptyGateStats() {
  return { pass: 0, fail: 0, warn: 0, error: 0, skip: 0 };
}

function displayTier(entry) {
  return entry?.displayTier || entry?._displayTier || entry?.decisionTier || null;
}

function isBlockedDecisionTier(tier) {
  const normalized = String(tier || "").toUpperCase();
  return (
    normalized.startsWith("BLOCKED") ||
    normalized === "INTENT_SWAP_NO_EXEC" ||
    normalized === "EXECUTION_PROOF_PENDING"
  );
}

function isExecutedDecisionTier(tier) {
  return EXECUTED_TIERS.has(String(tier || "").toUpperCase());
}

function compactCheck(check) {
  return {
    name: check.name,
    status: check.status,
    detail:
      typeof check.detail === "string" ? check.detail.slice(0, 200) : undefined,
  };
}

function replaceTxProofChecks(existingChecks = [], outcomeChecks = []) {
  const replacement = Array.isArray(outcomeChecks)
    ? outcomeChecks.filter((check) => TX_PROOF_NAMES.has(check?.name))
    : [];
  if (replacement.length === 0) return existingChecks;

  const rest = Array.isArray(existingChecks)
    ? existingChecks.filter((check) => !TX_PROOF_NAMES.has(check?.name))
    : [];
  return [...replacement.map(compactCheck), ...rest.map(compactCheck)];
}

function ensureSkippedTxProof(entry) {
  const checks = Array.isArray(entry?.checks) ? entry.checks : [];
  const tier = displayTier(entry);
  const existingIndex = checks.findIndex((check) => check?.name === "tx_proof");
  if (existingIndex !== -1) {
    const existing = checks[existingIndex];
    if (
      String(existing?.status || "").toUpperCase() === "SKIP" &&
      isBlockedDecisionTier(tier) &&
      !String(existing?.detail || "").includes(tier)
    ) {
      const nextChecks = checks.map((check, index) =>
        index === existingIndex
          ? {
              ...compactCheck(check),
              detail: `${tier} — No execution transaction expected for this cycle`,
            }
          : compactCheck(check)
      );
      return { ...entry, checks: nextChecks };
    }
    return entry;
  }

  if (!isBlockedDecisionTier(tier) && entry?.action !== "hold") return entry;

  return {
    ...entry,
    checks: [
      {
        name: "tx_proof",
        status: "SKIP",
        detail: `${tier ? `${tier} — ` : ""}No execution transaction expected for this cycle`,
      },
      ...checks.map(compactCheck),
    ],
  };
}

function buildOutcomeIndex(outcomeRows) {
  const index = new Map();
  const rows = Array.isArray(outcomeRows) ? outcomeRows : [];
  for (const row of rows) {
    if (typeof row?.decisionId !== "number") continue;
    index.set(row.decisionId, row);
  }
  return index;
}

function nearestCycleTier(entry, cycleRows) {
  const at = Date.parse(entry?.at || "");
  if (!Number.isFinite(at) || !Array.isArray(cycleRows)) return null;

  let best = null;
  let bestDelta = Infinity;
  for (const row of cycleRows) {
    const endedAt = Date.parse(row?.cycleEndedAt || "");
    if (!Number.isFinite(endedAt) || !row?.decisionTier) continue;
    const delta = Math.abs(endedAt - at);
    if (delta < bestDelta) {
      best = row;
      bestDelta = delta;
    }
  }

  // Discipline writes within seconds of the cycle ending; allow a wider
  // five-minute window for GitHub runner jitter and RPC waits.
  return best && bestDelta <= 5 * 60 * 1000 ? best.decisionTier : null;
}

function enrichHistoryWithOutcomes(history, outcomeRows, cycleRows = []) {
  const rows = Array.isArray(history) ? history : [];
  const outcomes = buildOutcomeIndex(outcomeRows);
  return rows.map((entry) => {
    const outcome = outcomes.get(entry?.decisionId);
    const fallbackTier = nearestCycleTier(entry, cycleRows);
    if (!outcome) {
      return ensureSkippedTxProof({
        ...entry,
        decisionTier: entry?.decisionTier ?? fallbackTier ?? null,
        displayTier: entry?.displayTier ?? entry?.decisionTier ?? fallbackTier ?? null,
      });
    }

    const outcomeChecks = outcome?.disciplineDetail?.checks;
    const tier = outcome.decisionTier ?? entry.decisionTier ?? fallbackTier ?? null;
    const enriched = {
      ...entry,
      decisionTier: tier,
      displayTier:
        outcome._displayTier ??
        outcome.displayTier ??
        tier ??
        entry.displayTier ??
        entry.decisionTier ??
        null,
      executedOnChain:
        typeof outcome.executedOnChain === "boolean"
          ? outcome.executedOnChain
          : entry.executedOnChain ?? null,
      action: outcome.action ?? entry.action ?? null,
      targetAsset: outcome.targetAsset ?? entry.targetAsset ?? null,
      sourceAsset:
        outcome.sourceAsset ??
        outcome.settlementSourceAsset ??
        entry.sourceAsset ??
        null,
      checks:
        outcome.executedOnChain === true
          ? replaceTxProofChecks(entry.checks, outcomeChecks)
          : entry.checks,
    };
    return ensureSkippedTxProof(enriched);
  });
}

function buildSummary(history) {
  const counts = { ACCEPTED: 0, BLOCKED: 0, SKIPPED: 0, ERROR: 0, UNKNOWN: 0 };
  const gateStats = {};
  for (const gate of KNOWN_GATES) gateStats[gate] = emptyGateStats();

  let decisionBlockedCount = 0;
  let executedSwapCount = 0;
  let holdNoSwapCount = 0;
  let cyclesWithTx = 0;
  let cyclesWithoutTx = 0;
  let txProofPassCount = 0;
  let txProofFailCount = 0;
  let txProofWarnCount = 0;
  let txProofErrorCount = 0;
  let txProofSkipCount = 0;
  const rows = Array.isArray(history) ? history : [];

  for (const entry of rows) {
    const verdict = entry?.verdict ?? "UNKNOWN";
    counts[verdict] = (counts[verdict] ?? 0) + 1;
    const tier = displayTier(entry);
    const blockedDecision = isBlockedDecisionTier(tier);
    const executedDecision =
      isExecutedDecisionTier(tier) || entry?.executedOnChain === true;

    if (blockedDecision) decisionBlockedCount++;
    else if (executedDecision) executedSwapCount++;

    for (const check of entry?.checks ?? []) {
      if (!KNOWN_GATES.includes(check.name)) continue;
      const status = String(check.status ?? "").toLowerCase();
      const stats = gateStats[check.name];
      if (status === "pass") stats.pass++;
      else if (status === "fail") stats.fail++;
      else if (status === "warn") stats.warn++;
      else if (status === "error") stats.error++;
      else if (status === "skip") stats.skip++;
    }

    const txProof = (entry?.checks ?? []).find((check) => check.name === "tx_proof");
    const txStatus = String(txProof?.status ?? "").toLowerCase();
    if (txStatus === "skip") {
      cyclesWithoutTx++;
      txProofSkipCount++;
      if (!blockedDecision && !executedDecision) holdNoSwapCount++;
    } else if (
      txStatus === "pass" ||
      txStatus === "fail" ||
      txStatus === "warn" ||
      txStatus === "error"
    ) {
      cyclesWithTx++;
      if (txStatus === "pass") txProofPassCount++;
      else if (txStatus === "warn") txProofWarnCount++;
      else if (txStatus === "error") {
        txProofFailCount++;
        txProofErrorCount++;
      } else if (txStatus === "fail") txProofFailCount++;
    }
  }

  const gatePassRates = {};
  for (const gate of KNOWN_GATES) {
    const stats = gateStats[gate];
    const total = stats.pass + stats.fail + stats.warn + stats.error;
    gatePassRates[gate] =
      total > 0 ? Math.round((stats.pass / total) * 1000) / 10 : null;
  }

  const executedDenominator =
    txProofPassCount + txProofFailCount + txProofWarnCount;

  return {
    totalEntries: rows.length,
    acceptedCount: counts.ACCEPTED,
    blockedCount: counts.BLOCKED,
    skippedCount: counts.SKIPPED,
    errorCount: counts.ERROR,
    decisionBlockedCount,
    executedSwapCount,
    holdNoSwapCount,
    gatePassRates,
    firstCycleAt: rows.length ? rows[0]?.at ?? null : null,
    latestCycleAt: rows.length ? rows[rows.length - 1]?.at ?? null : null,
    cyclesWithTx,
    cyclesWithoutTx,
    txProofPassCount,
    txProofFailCount,
    txProofWarnCount,
    txProofErrorCount,
    txProofSkipCount,
    txProofPassRateExecutedOnly:
      executedDenominator > 0
        ? Math.round((txProofPassCount / executedDenominator) * 1000) / 10
        : null,
  };
}

module.exports = {
  KNOWN_GATES,
  buildSummary,
  enrichHistoryWithOutcomes,
  isBlockedDecisionTier,
  isExecutedDecisionTier,
};
