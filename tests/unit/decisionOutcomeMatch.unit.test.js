const {
  buildOutcomeIndexes,
  selectOutcomeRow,
} = require("../../frontend/app/lib/decision-outcome-match.shared.js");

describe("decision/outcome matching", () => {
  test("prefers exact DecisionLog tx hash over brittle id offset", () => {
    const hash = "0x8b82eff2ab3052451f687b823806e1f601d8dc28aefae513bd45dc272fc0752d";
    const indexes = buildOutcomeIndexes([
      {
        decisionId: 517,
        decisionTier: "BLOCKED_BY_REGIME",
        _displayTier: "BLOCKED_BY_REGIME",
        decisionLogTxHash: "0x361da9e55743572f5760abcf6cb4a478c09ead6875c98152a01fb5194b6e639c",
      },
      {
        decisionId: 519,
        decisionTier: "BLOCKED_BY_PORTFOLIO",
        _displayTier: "BLOCKED_BY_PORTFOLIO",
        decisionLogTxHash: hash,
      },
    ]);

    expect(
      selectOutcomeRow({
        decisionLogId: 517,
        decisionLogTxHash: hash,
        fallbackDecisionTier: "BLOCKED_BY_PORTFOLIO",
        ...indexes,
      })
    ).toMatchObject({ decisionId: 519, _displayTier: "BLOCKED_BY_PORTFOLIO" });
  });

  test("rejects a shifted candidate when it contradicts the on-chain tier", () => {
    const indexes = buildOutcomeIndexes([
      {
        decisionId: 517,
        decisionTier: "BLOCKED_BY_REGIME",
        _displayTier: "BLOCKED_BY_REGIME",
        decisionLogTxHash: "0x361da9e55743572f5760abcf6cb4a478c09ead6875c98152a01fb5194b6e639c",
      },
    ]);

    expect(
      selectOutcomeRow({
        decisionLogId: 516,
        decisionLogTxHash: "0xf2f22ddb7e159eecda8a459bbbbe36997de473c4c208eba46776ade2bebb98e1",
        fallbackDecisionTier: "BLOCKED_BY_PORTFOLIO",
        ...indexes,
      })
    ).toBeNull();
  });

  test("keeps legacy id-offset fallback when no tx hash is available", () => {
    const indexes = buildOutcomeIndexes([
      {
        decisionId: 11,
        decisionTier: "EXECUTED_SWAP",
        _displayTier: "EXECUTED_SWAP",
      },
    ]);

    expect(
      selectOutcomeRow({
        decisionLogId: 10,
        decisionLogTxHash: null,
        fallbackDecisionTier: "EXECUTED_SWAP",
        ...indexes,
      })
    ).toMatchObject({ decisionId: 11, _displayTier: "EXECUTED_SWAP" });
  });
});
