const {
  _private: { chooseNextLegAmount },
} = require("../../src/orchestrator/multiAgentLoop");

describe("multi-leg swap sizing", () => {
  test("uses previous leg output instead of sweeping old intermediate inventory", () => {
    const amount = chooseNextLegAmount({
      previousLegOut: 7.6,
      beforeBalance: 12.2,
      afterBalance: 19.8,
      currentBalance: 19.8,
    });

    expect(amount).toBeCloseTo(7.5924, 6);
    expect(amount).toBeLessThan(8);
  });

  test("falls back to non-negative balance delta and never total balance", () => {
    const amount = chooseNextLegAmount({
      previousLegOut: null,
      beforeBalance: 40,
      afterBalance: 43.5,
      currentBalance: 43.5,
    });

    expect(amount).toBeCloseTo(3.4965, 6);
    expect(amount).toBeLessThan(4);
  });

  test("clamps negative balance deltas to zero", () => {
    const amount = chooseNextLegAmount({
      previousLegOut: null,
      beforeBalance: 10,
      afterBalance: 9,
      currentBalance: 9,
    });

    expect(amount).toBe(0);
  });
});
