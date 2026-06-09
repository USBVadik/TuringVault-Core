const {
  buildDenominatorNote,
  buildValidationStatCopy,
  classifyDecisionForDisplay,
  validationDenominator,
} = require("../../frontend/app/lib/proof-explorer-consistency.shared.js");

describe("proof explorer denominator honesty", () => {
  test("uses ValidationRegistry totalProposals as approval denominator", () => {
    expect(
      validationDenominator({
        totalApproved: 212,
        totalRejected: 76,
        totalProposals: 288,
      })
    ).toBe(288);
  });

  test("falls back to approved + rejected when totalProposals is missing", () => {
    expect(
      validationDenominator({
        totalApproved: 211,
        totalRejected: 76,
      })
    ).toBe(287);
  });

  test("explains DecisionLog vs ValidationRegistry denominator drift", () => {
    expect(
      buildDenominatorNote({
        totalDecisions: 287,
        validation: {
          totalApproved: 212,
          totalRejected: 76,
          totalProposals: 288,
        },
      })
    ).toContain("DecisionLog rows (287) and ValidationRegistry proposals (288)");
  });

  test("labels validation counters as validator outcomes, not trade execution", () => {
    const copy = buildValidationStatCopy({
      totalApproved: 281,
      totalRejected: 102,
      totalProposals: 383,
    });

    expect(copy.approvedLabel).toBe("Validator-approved proposals");
    expect(copy.rejectedLabel).toBe("Validator-rejected proposals");
    expect(copy.note).toMatch(/not executed trades/i);
  });

  test("prefers bracketed decision tier over validator status for display", () => {
    const display = classifyDecisionForDisplay({
      status: "Approved",
      action: "hold",
      reasoningHash:
        "[BLOCKED_BY_REGIME] Analyst: MNT grid blocked | Validator: APPROVED",
    });

    expect(display.label).toBe("BLOCKED_BY_REGIME");
    expect(display.blocked).toBe(true);
    expect(display.validatorStatus).toBe("Approved");
  });

  test("prefers API displayTier over stale reasoning prefix", () => {
    const display = classifyDecisionForDisplay({
      status: "Approved",
      action: "swap",
      displayTier: "INTENT_SWAP_NO_EXEC",
      executedOnChain: false,
      reasoningHash:
        "[EXECUTED_SWAP] Analyst: grid wanted a buy | Validator: APPROVED",
    });

    expect(display.label).toBe("INTENT_SWAP_NO_EXEC");
    expect(display.blocked).toBe(true);
    expect(display.executed).toBe(false);
  });

  test("demotes legacy EXECUTED_SWAP when API says no execution happened", () => {
    const display = classifyDecisionForDisplay({
      action: "swap",
      executedOnChain: false,
      reasoningHash:
        "[EXECUTED_SWAP] Analyst: grid wanted a buy | Validator: APPROVED",
    });

    expect(display.label).toBe("INTENT_SWAP_NO_EXEC");
    expect(display.blocked).toBe(true);
    expect(display.executed).toBe(false);
  });
});
