const KNOWN_GATES = ["tx_proof", "price_freshness", "drift_detection"];

function emptyGateStats() {
  return { pass: 0, fail: 0, warn: 0, skip: 0 };
}

function buildSummary(history) {
  const counts = { ACCEPTED: 0, BLOCKED: 0, SKIPPED: 0, ERROR: 0, UNKNOWN: 0 };
  const gateStats = {};
  for (const gate of KNOWN_GATES) gateStats[gate] = emptyGateStats();

  let cyclesWithTx = 0;
  let cyclesWithoutTx = 0;
  let txProofPassCount = 0;
  let txProofFailCount = 0;
  let txProofSkipCount = 0;

  for (const entry of Array.isArray(history) ? history : []) {
    const verdict = entry?.verdict ?? "UNKNOWN";
    counts[verdict] = (counts[verdict] ?? 0) + 1;

    for (const check of entry?.checks ?? []) {
      if (!KNOWN_GATES.includes(check.name)) continue;
      const status = String(check.status ?? "").toLowerCase();
      const stats = gateStats[check.name];
      if (status === "pass") stats.pass++;
      else if (status === "fail") stats.fail++;
      else if (status === "warn") stats.warn++;
      else if (status === "skip") stats.skip++;
    }

    const txProof = (entry?.checks ?? []).find((check) => check.name === "tx_proof");
    const txStatus = String(txProof?.status ?? "").toLowerCase();
    if (txStatus === "skip") {
      cyclesWithoutTx++;
      txProofSkipCount++;
    } else if (txStatus === "pass" || txStatus === "fail" || txStatus === "warn") {
      cyclesWithTx++;
      if (txStatus === "pass") txProofPassCount++;
      else if (txStatus === "fail") txProofFailCount++;
    }
  }

  const gatePassRates = {};
  for (const gate of KNOWN_GATES) {
    const stats = gateStats[gate];
    const total = stats.pass + stats.fail + stats.warn;
    gatePassRates[gate] =
      total > 0 ? Math.round((stats.pass / total) * 1000) / 10 : null;
  }

  const executedDenominator = txProofPassCount + txProofFailCount + gateStats.tx_proof.warn;

  return {
    totalEntries: Array.isArray(history) ? history.length : 0,
    acceptedCount: counts.ACCEPTED,
    blockedCount: counts.BLOCKED,
    skippedCount: counts.SKIPPED,
    errorCount: counts.ERROR,
    gatePassRates,
    firstCycleAt: history?.[0]?.at ?? null,
    latestCycleAt: history?.[history.length - 1]?.at ?? null,
    cyclesWithTx,
    cyclesWithoutTx,
    txProofPassCount,
    txProofFailCount,
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
};
