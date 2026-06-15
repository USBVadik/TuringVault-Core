const {
  buildDecisionLogCandidateWindow,
} = require("../../frontend/app/lib/decision-log-index-window.shared.js");

describe("DecisionLog anchor candidate window", () => {
  test("searches beyond fixed -2 drift when registry is further ahead", () => {
    const candidates = buildDecisionLogCandidateWindow({
      decisionId: 561,
      totalDecisions: 560,
    });

    expect(candidates.slice(0, 4)).toEqual([559, 558, 557, 556]);
    expect(candidates).toContain(558);
  });

  test("never emits invalid negative or out-of-range indices", () => {
    expect(
      buildDecisionLogCandidateWindow({
        decisionId: 2,
        totalDecisions: 2,
      })
    ).toEqual([1, 0]);
    expect(
      buildDecisionLogCandidateWindow({
        decisionId: 0,
        totalDecisions: 0,
      })
    ).toEqual([]);
  });

  test("keeps the search bounded for RPC safety", () => {
    expect(
      buildDecisionLogCandidateWindow({
        decisionId: 1000,
        totalDecisions: 1000,
        windowSize: 4,
      })
    ).toEqual([999, 998, 997, 996]);
  });
});
