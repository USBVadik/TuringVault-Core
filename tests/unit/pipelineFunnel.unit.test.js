/**
 * Agent pipeline funnel + executed-trade win rate. Counts + executed-only
 * win rate; must not count holds/non-executed intents as trades, and must not
 * fabricate per-agent accuracy.
 * Spec: .kiro/specs/honest-pipeline-funnel.
 */
const {
  computePipelineFunnel,
} = require("../../frontend/app/lib/pipelineFunnel.shared.js");

const row = (o) => ({ consensus: true, executedOnChain: true, ...o });

describe("computePipelineFunnel", () => {
  test("empty / non-array -> zeros, null win rate", () => {
    for (const input of [[], null, undefined]) {
      const r = computePipelineFunnel(input);
      expect(r.executedTradeTotal).toBe(0);
      expect(r.executedTradeWinRate).toBeNull();
      expect(r.pipelineFunnel.totalDecisions).toBe(0);
      expect(r.pipelineFunnel.consensusApproved).toBe(0);
    }
  });

  test("executed win rate counts executed directional only", () => {
    const r = computePipelineFunnel([
      row({ outcome: "GOOD_CALL" }),
      row({ outcome: "GOOD_CALL" }),
      row({ outcome: "BAD_CALL" }),
      // non-executed intent: must NOT count as a trade
      row({ outcome: "GOOD_CALL", executedOnChain: false }),
      // hold: must NOT count as a trade
      { consensus: false, executedOnChain: false, outcome: "CORRECT_BLOCK", decisionTier: "BLOCKED_BY_REGIME" },
    ]);
    expect(r.executedTradeTotal).toBe(3);
    expect(r.executedTradeWins).toBe(2);
    expect(r.executedTradeLosses).toBe(1);
    expect(r.executedTradeWinRate).toBe(66.7);
  });

  test("funnel buckets: deterministic vs validator vs other", () => {
    const r = computePipelineFunnel([
      row({ outcome: "GOOD_CALL" }),
      row({ outcome: "BAD_CALL" }),
      { consensus: false, outcome: "CORRECT_BLOCK", decisionTier: "BLOCKED_BY_REGIME" },
      { consensus: false, outcome: "MISSED_ALPHA", decisionTier: "BLOCKED_BY_PORTFOLIO" },
      { consensus: false, outcome: "CORRECT_BLOCK", decisionTier: "BLOCKED_BY_LOW_CONFIDENCE" },
      { consensus: false, outcome: "MISSED_ALPHA", decisionTier: "BLOCKED_BY_VALIDATOR" },
      { consensus: false, outcome: "NEUTRAL", decisionTier: "SOMETHING_ELSE" },
    ]);
    const f = r.pipelineFunnel;
    expect(f.totalDecisions).toBe(7);
    expect(f.consensusApproved).toBe(2);
    expect(f.executed).toBe(2);
    expect(f.executedWon).toBe(1);
    expect(f.blockedTotal).toBe(5);
    expect(f.blockedDeterministic).toBe(3); // regime + portfolio + low_confidence
    expect(f.blockedValidator).toBe(1);
    expect(f.blockedOther).toBe(1); // SOMETHING_ELSE
  });

  test("blockedOther never goes negative and buckets sum to blockedTotal", () => {
    const r = computePipelineFunnel([
      { consensus: false, decisionTier: "BLOCKED_BY_REGIME", outcome: "CORRECT_BLOCK" },
      { consensus: false, decisionTier: "BLOCKED_BY_VALIDATOR", outcome: "MISSED_ALPHA" },
    ]);
    const f = r.pipelineFunnel;
    expect(f.blockedDeterministic + f.blockedValidator + f.blockedOther).toBe(
      f.blockedTotal
    );
    expect(f.blockedOther).toBeGreaterThanOrEqual(0);
  });

  test("an explicit HOLD_NO_ACTION is not presented as a blocked trade", () => {
    const r = computePipelineFunnel([
      {
        consensus: false,
        executedOnChain: false,
        action: "hold",
        outcome: "NO_ACTION",
        decisionTier: "HOLD_NO_ACTION",
      },
    ]);

    expect(r.pipelineFunnel.totalDecisions).toBe(1);
    expect(r.pipelineFunnel.noActionHolds).toBe(1);
    expect(r.pipelineFunnel.blockedTotal).toBe(0);
  });

  test("an economics veto after consensus is still a deterministic block", () => {
    const r = computePipelineFunnel([
      {
        consensus: true,
        executedOnChain: false,
        outcome: "INTENT_NOT_EXECUTED",
        decisionTier: "BLOCKED_BY_ECONOMICS",
      },
    ]);

    expect(r.pipelineFunnel.consensusApproved).toBe(1);
    expect(r.pipelineFunnel.blockedTotal).toBe(1);
    expect(r.pipelineFunnel.blockedDeterministic).toBe(1);
  });
});
