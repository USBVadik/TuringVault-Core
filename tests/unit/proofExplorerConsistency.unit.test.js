const {
  buildDenominatorNote,
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
});
