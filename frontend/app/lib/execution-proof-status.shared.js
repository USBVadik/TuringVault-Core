const REQUIRED_TX_PROOF_CHECKS = [
  "tx_exists",
  "tx_sender",
  "tx_confirmed",
  "tx_success",
  "tx_proof",
];

const TX_PROOF_CHECKS = new Set(REQUIRED_TX_PROOF_CHECKS);

function storedNonAcceptedStatus(input = {}) {
  const stored = input?.executionProofStatus;
  return stored && stored !== "ACCEPTED" ? stored : "UNKNOWN";
}

function extractChecks(input = {}) {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input?.checks)) return input.checks;
  if (Array.isArray(input?.disciplineDetail?.checks)) {
    return input.disciplineDetail.checks;
  }
  return null;
}

function deriveExecutionProofStatus(input = {}) {
  const checks = extractChecks(input);
  if (!Array.isArray(checks)) return storedNonAcceptedStatus(input);

  const txChecks = checks.filter((c) => TX_PROOF_CHECKS.has(c?.name));
  if (txChecks.length === 0) return storedNonAcceptedStatus(input);

  if (txChecks.some((c) => ["FAIL", "ERROR"].includes(c?.status))) {
    return "ERROR";
  }
  if (txChecks.some((c) => c?.status === "WARN")) return "WARN";
  if (txChecks.every((c) => c?.status === "SKIP")) return "SKIPPED";

  if (txChecks.some((c) => c?.status !== "PASS")) return "UNKNOWN";

  const passedNames = new Set(txChecks.map((c) => c?.name));
  const hasCompleteProof = REQUIRED_TX_PROOF_CHECKS.every((name) =>
    passedNames.has(name)
  );
  return hasCompleteProof ? "ACCEPTED" : "UNKNOWN";
}

function deriveDisplayTier({
  decisionTier = null,
  displayTier = null,
  executedOnChain = false,
  executionProofStatus = null,
} = {}) {
  const baseTier =
    displayTier === "EXECUTION_PROOF_PENDING" &&
    decisionTier === "EXECUTED_SWAP" &&
    executionProofStatus === "ACCEPTED"
      ? decisionTier
      : displayTier ?? decisionTier;

  if (baseTier === "EXECUTED_SWAP" && executedOnChain !== true) {
    return "INTENT_SWAP_NO_EXEC";
  }

  if (baseTier === "EXECUTED_SWAP" && executionProofStatus !== "ACCEPTED") {
    return "EXECUTION_PROOF_PENDING";
  }
  return baseTier;
}

module.exports = {
  REQUIRED_TX_PROOF_CHECKS,
  TX_PROOF_CHECKS,
  deriveDisplayTier,
  deriveExecutionProofStatus,
};
