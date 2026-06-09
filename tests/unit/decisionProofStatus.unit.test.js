const {
  deriveDisplayTier,
  deriveExecutionProofStatus,
  extractDecisionTier,
} = require("../../frontend/app/api/decisions/proofStatus.js");

describe("decision API proof status helpers", () => {
  test("extracts decision tier from on-chain reasoning prefix", () => {
    expect(
      extractDecisionTier(
        "[BLOCKED_BY_REGIME] Analyst: ranging exit | Validator: APPROVED"
      )
    ).toBe("BLOCKED_BY_REGIME");
    expect(extractDecisionTier("[EXECUTED_SWAP] Analyst: sell")).toBe(
      "EXECUTED_SWAP"
    );
    expect(extractDecisionTier("Analyst: no prefix")).toBeNull();
    expect(extractDecisionTier("")).toBeNull();
  });

  test("missing proof checks are UNKNOWN, not implicitly accepted", () => {
    expect(deriveExecutionProofStatus({})).toBe("UNKNOWN");
    expect(deriveExecutionProofStatus({ executionProofStatus: "ACCEPTED" })).toBe(
      "UNKNOWN"
    );
    expect(
      deriveExecutionProofStatus({
        disciplineDetail: { checks: [{ name: "portfolio_guard", status: "PASS" }] },
      })
    ).toBe("UNKNOWN");
  });

  test("derives proof status from tx proof checks", () => {
    expect(
      deriveExecutionProofStatus({
        disciplineDetail: {
          checks: [
            { name: "tx_exists", status: "PASS" },
            { name: "tx_sender", status: "PASS" },
            { name: "tx_confirmed", status: "PASS" },
            { name: "tx_success", status: "PASS" },
            { name: "tx_proof", status: "PASS" },
          ],
        },
      })
    ).toBe("ACCEPTED");

    expect(
      deriveExecutionProofStatus({
        disciplineDetail: {
          checks: [{ name: "tx_confirmed", status: "WARN" }],
        },
      })
    ).toBe("WARN");

    expect(
      deriveExecutionProofStatus({
        disciplineDetail: {
          checks: [{ name: "tx_success", status: "ERROR" }],
        },
      })
    ).toBe("ERROR");
  });

  test("does not accept partial or mixed tx proofs", () => {
    expect(
      deriveExecutionProofStatus({
        disciplineDetail: {
          checks: [
            { name: "tx_exists", status: "PASS" },
            { name: "tx_sender", status: "PASS" },
            { name: "tx_success", status: "PASS" },
            { name: "tx_proof", status: "PASS" },
          ],
        },
      })
    ).toBe("UNKNOWN");

    expect(
      deriveExecutionProofStatus({
        disciplineDetail: {
          checks: [
            { name: "tx_exists", status: "PASS" },
            { name: "tx_sender", status: "PASS" },
            { name: "tx_confirmed", status: "PASS" },
            { name: "tx_success", status: "PASS" },
          ],
        },
      })
    ).toBe("UNKNOWN");

    expect(
      deriveExecutionProofStatus({
        disciplineDetail: {
          checks: [
            { name: "tx_exists", status: "PASS" },
            { name: "tx_sender", status: "PASS" },
            { name: "tx_confirmed", status: "PASS" },
            { name: "tx_success", status: "SKIP" },
            { name: "tx_proof", status: "PASS" },
          ],
        },
      })
    ).toBe("UNKNOWN");
  });

  test("all skipped tx proof checks are explicitly skipped", () => {
    expect(
      deriveExecutionProofStatus({
        disciplineDetail: {
          checks: [{ name: "tx_proof", status: "SKIP" }],
        },
      })
    ).toBe("SKIPPED");
  });

  test("real tx checks override stale stored proof status", () => {
    expect(
      deriveExecutionProofStatus({
        executionProofStatus: "ACCEPTED",
        disciplineDetail: {
          checks: [{ name: "tx_confirmed", status: "WARN" }],
        },
      })
    ).toBe("WARN");
  });

  test("EXECUTED_SWAP only renders as executed with accepted proof", () => {
    expect(
      deriveDisplayTier({
        decisionTier: "EXECUTED_SWAP",
        executedOnChain: true,
        executionProofStatus: "UNKNOWN",
      })
    ).toBe("EXECUTION_PROOF_PENDING");

    expect(
      deriveDisplayTier({
        decisionTier: "EXECUTED_SWAP",
        executedOnChain: true,
        executionProofStatus: "ACCEPTED",
      })
    ).toBe("EXECUTED_SWAP");
  });

  test("non-executed swaps remain intent-only even before proof demotion", () => {
    expect(
      deriveDisplayTier({
        decisionTier: "EXECUTED_SWAP",
        executedOnChain: false,
        executionProofStatus: "UNKNOWN",
      })
    ).toBe("INTENT_SWAP_NO_EXEC");

    expect(
      deriveDisplayTier({
        decisionTier: "APPROVED",
        displayTier: "EXECUTED_SWAP",
        executedOnChain: false,
        executionProofStatus: "ACCEPTED",
      })
    ).toBe("INTENT_SWAP_NO_EXEC");
  });

  test("explicit stale EXECUTED_SWAP display tier is still proof-gated", () => {
    expect(
      deriveDisplayTier({
        decisionTier: "APPROVED",
        displayTier: "EXECUTED_SWAP",
        executedOnChain: true,
        executionProofStatus: "UNKNOWN",
      })
    ).toBe("EXECUTION_PROOF_PENDING");
  });

  test("stale proof-pending display tier recovers after proof is accepted", () => {
    expect(
      deriveDisplayTier({
        decisionTier: "EXECUTED_SWAP",
        displayTier: "EXECUTION_PROOF_PENDING",
        executedOnChain: true,
        executionProofStatus: "ACCEPTED",
      })
    ).toBe("EXECUTED_SWAP");
  });
});
