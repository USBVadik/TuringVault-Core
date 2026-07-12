const {
  estimatedGasUsd,
  transactionGasMnt,
} = require("../../src/metrics/gasCost");

describe("transactionGasMnt", () => {
  test("converts gas used times effective gas price to native MNT", () => {
    expect(
      transactionGasMnt({ gasUsed: 21000n, gasPrice: 20_000_000n })
    ).toBeCloseTo(0.00000042, 12);
  });

  test("returns zero when receipt pricing is unavailable", () => {
    expect(transactionGasMnt({ gasUsed: 21000n })).toBe(0);
  });
});

describe("estimatedGasUsd", () => {
  test("budgets every expected transaction in an aggregator route", () => {
    expect(
      estimatedGasUsd({ transactionCount: 2, mntPriceUsd: 0.4 })
    ).toBeCloseTo(0.0144, 12);
  });

  test("fails closed to zero for invalid estimates", () => {
    expect(
      estimatedGasUsd({ transactionCount: -2, mntPriceUsd: "bad" })
    ).toBe(0);
  });
});
