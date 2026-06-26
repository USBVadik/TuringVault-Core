/**
 * Execution Guard metric — counterfactual capital-preservation view of
 * non-executed consensus swaps. Display-only; must never count executed
 * trades or fabricate state.
 * Spec: .kiro/specs/execution-guard-metric.
 */
const {
  computeExecutionGuard,
  isNonExecutedIntent,
} = require("../../frontend/app/lib/executionGuard.shared.js");

describe("computeExecutionGuard", () => {
  test("empty / non-array input -> all zeros", () => {
    for (const input of [[], null, undefined, {}]) {
      const g = computeExecutionGuard(input);
      expect(g.intentNotExecuted).toBe(0);
      expect(g.wouldBeLossAvoided).toEqual({ count: 0, scoreBps: 0 });
      expect(g.wouldBeGainMissed).toEqual({ count: 0, scoreBps: 0 });
      expect(g.netScoreBpsAvoided).toBe(0);
    }
  });

  test("executed GOOD/BAD calls are ignored (they took a real position)", () => {
    const rows = [
      { outcome: "BAD_CALL", pnlBps: -500, executedOnChain: true },
      { outcome: "GOOD_CALL", pnlBps: 400, executedOnChain: true },
    ];
    const g = computeExecutionGuard(rows);
    expect(g.intentNotExecuted).toBe(0);
    expect(g.netScoreBpsAvoided).toBe(0);
  });

  test("holds (CORRECT_BLOCK/MISSED_ALPHA) are not intents, ignored", () => {
    const rows = [
      { outcome: "CORRECT_BLOCK", pnlBps: 30, executedOnChain: false },
      { outcome: "MISSED_ALPHA", pnlBps: -20, executedOnChain: false },
      { outcome: "NEUTRAL", pnlBps: 0, executedOnChain: false },
    ];
    const g = computeExecutionGuard(rows);
    expect(g.intentNotExecuted).toBe(0);
  });

  test("non-executed BAD_CALL = avoided loss (positive scoreBps)", () => {
    const g = computeExecutionGuard([
      { outcome: "BAD_CALL", pnlBps: -1158, executedOnChain: false },
      { outcome: "BAD_CALL", pnlBps: -842, executedOnChain: false },
    ]);
    expect(g.wouldBeLossAvoided).toEqual({ count: 2, scoreBps: 2000 });
    expect(g.wouldBeGainMissed.count).toBe(0);
    expect(g.netScoreBpsAvoided).toBe(2000);
    expect(g.intentNotExecuted).toBe(2);
  });

  test("non-executed GOOD_CALL = missed gain (reduces net)", () => {
    const g = computeExecutionGuard([
      { outcome: "GOOD_CALL", pnlBps: 300, executedOnChain: false },
    ]);
    expect(g.wouldBeGainMissed).toEqual({ count: 1, scoreBps: 300 });
    expect(g.wouldBeLossAvoided.count).toBe(0);
    expect(g.netScoreBpsAvoided).toBe(-300);
  });

  test("mixed ledger: net = avoided loss - missed gain", () => {
    const g = computeExecutionGuard([
      { outcome: "BAD_CALL", pnlBps: -1000, executedOnChain: false }, // avoided
      { outcome: "BAD_CALL", pnlBps: -500, executedOnChain: false }, // avoided
      { outcome: "GOOD_CALL", pnlBps: 200, executedOnChain: false }, // missed
      { outcome: "INTENT_NOT_EXECUTED", pnlBps: 0, executedOnChain: false }, // total only
      { outcome: "BAD_CALL", pnlBps: -9999, executedOnChain: true }, // executed, ignored
    ]);
    expect(g.intentNotExecuted).toBe(4); // 2 BAD + 1 GOOD + 1 INTENT_NOT_EXECUTED
    expect(g.wouldBeLossAvoided).toEqual({ count: 2, scoreBps: 1500 });
    expect(g.wouldBeGainMissed).toEqual({ count: 1, scoreBps: 200 });
    expect(g.netScoreBpsAvoided).toBe(1300);
  });

  test("INTENT_NOT_EXECUTED counts toward total but not bps split", () => {
    const g = computeExecutionGuard([
      { outcome: "INTENT_NOT_EXECUTED", pnlBps: 0, executedOnChain: false },
      { outcome: "INTENT_NOT_EXECUTED", pnlBps: 0, executedOnChain: false },
    ]);
    expect(g.intentNotExecuted).toBe(2);
    expect(g.wouldBeLossAvoided.scoreBps).toBe(0);
    expect(g.wouldBeGainMissed.scoreBps).toBe(0);
    expect(g.netScoreBpsAvoided).toBe(0);
  });

  test("isNonExecutedIntent guards", () => {
    expect(isNonExecutedIntent({ outcome: "BAD_CALL", executedOnChain: false })).toBe(true);
    expect(isNonExecutedIntent({ outcome: "BAD_CALL", executedOnChain: true })).toBe(false);
    expect(isNonExecutedIntent({ outcome: "CORRECT_BLOCK", executedOnChain: false })).toBe(false);
    expect(isNonExecutedIntent(null)).toBe(false);
  });
});
