/**
 * Regression: a proposed swap that never executed on-chain must NOT be
 * scored as a realized GOOD_CALL/BAD_CALL. Before this fix, INTENT_SWAP_NO_EXEC
 * cycles (route blocked) were penalized ~-1100 bps each as phantom losing
 * trades, cratering the Outcome Score for trades that never happened.
 * Workspace rule: .kiro/steering/no-lying-about-state.md §3 (no phantom PnL).
 */
const { computePriceMoveOutcome } = require("../../src/orchestrator/outcomeTracker");

const base = { priceAtDecision: 100, confidence: 0.7 };

describe("outcome scoring — phantom non-executed swaps", () => {
  test("executed consensus swap, price rose (risk-on) -> GOOD_CALL", () => {
    const r = computePriceMoveOutcome({
      ...base, consensus: true, targetAsset: "WMNT", currentPrice: 110, executedOnChain: true,
    });
    expect(r.outcome).toBe("GOOD_CALL");
    expect(r.pnlBps).toBeGreaterThan(0);
  });

  test("executed consensus swap, price fell (risk-on) -> BAD_CALL (real loss still counts)", () => {
    const r = computePriceMoveOutcome({
      ...base, consensus: true, targetAsset: "WMNT", currentPrice: 90, executedOnChain: true,
    });
    expect(r.outcome).toBe("BAD_CALL");
    expect(r.pnlBps).toBeLessThan(0);
  });

  test("NON-executed consensus swap, price fell -> INTENT_NOT_EXECUTED, 0 (no phantom loss)", () => {
    const r = computePriceMoveOutcome({
      ...base, consensus: true, targetAsset: "WMNT", currentPrice: 88, executedOnChain: false,
    });
    expect(r.outcome).toBe("INTENT_NOT_EXECUTED");
    expect(r.pnlBps).toBe(0);
    expect(r.scoreDelta).toBe(0);
  });

  test("NON-executed consensus swap, price rose -> still 0 (no phantom gain either)", () => {
    const r = computePriceMoveOutcome({
      ...base, consensus: true, targetAsset: "WMNT", currentPrice: 112, executedOnChain: false,
    });
    expect(r.outcome).toBe("INTENT_NOT_EXECUTED");
    expect(r.pnlBps).toBe(0);
  });

  test("blocked hold (no consensus) still scores CORRECT_BLOCK (unchanged)", () => {
    const r = computePriceMoveOutcome({
      ...base, consensus: false, targetAsset: "WMNT", currentPrice: 90, executedOnChain: false,
    });
    expect(r.outcome).toBe("CORRECT_BLOCK");
    expect(r.scoreDelta).toBeGreaterThan(0);
  });

  test("executedOnChain defaults to true (back-compat) -> consensus swap scored as a call", () => {
    const r = computePriceMoveOutcome({
      ...base, consensus: true, targetAsset: "WMNT", currentPrice: 90,
    });
    expect(["GOOD_CALL", "BAD_CALL"]).toContain(r.outcome);
  });
});
