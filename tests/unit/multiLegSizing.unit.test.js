const {
  _private: { calculateDirectionalSwapSizing, chooseNextLegAmount },
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

  test("sizes mETH exits in USD instead of requiring 0.5 mETH", () => {
    const sizing = calculateDirectionalSwapSizing({
      sourceToken: "mETH",
      sourceBalance: 0.011938,
      allocationPct: 72,
      market: { ethPrice: 2000 },
      cycleCapUsd: 5,
      minTradeUsd: 0.3,
    });

    expect(sizing.sourceUsdPrice).toBe(2000);
    expect(sizing.minSourceAmount).toBeCloseTo(0.00015, 8);
    expect(sizing.finalSourceAmount).toBeCloseTo(0.0025, 8);
    expect(sizing.canExecute).toBe(true);
  });

  test("default live sizing blocks old $5 micro-swaps", () => {
    const sizing = calculateDirectionalSwapSizing({
      sourceToken: "USDT0",
      sourceBalance: 5,
      allocationPct: 100,
      market: { ethPrice: 1700, mntPrice: 0.52 },
    });

    expect(sizing.minTradeUsd).toBe(10);
    expect(sizing.cycleCapUsd).toBe(15);
    expect(sizing.finalSourceAmount).toBe(5);
    expect(sizing.canExecute).toBe(false);
  });

  test("default live sizing rescues valid signals to the economic floor", () => {
    const sizing = calculateDirectionalSwapSizing({
      sourceToken: "USDT0",
      sourceBalance: 72,
      allocationPct: 10,
      market: { ethPrice: 1700, mntPrice: 0.52 },
    });

    expect(sizing.rescued).toBe(true);
    expect(sizing.finalSourceAmount).toBeGreaterThanOrEqual(10);
    expect(sizing.finalSourceAmount).toBeLessThanOrEqual(15);
    expect(sizing.canExecute).toBe(true);
  });
});
