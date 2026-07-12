const {
  createEmptyLedger,
  applyDirectionalTrade,
  applyOperatingCost,
  getOpenBasis,
  previewFifoExit,
} = require("../../src/metrics/tradeLedger");

describe("tradeLedger", () => {
  test("aggregates open FIFO lots into a position cost basis", () => {
    let ledger = createEmptyLedger("2026-07-10T00:00:00.000Z");
    ledger = applyDirectionalTrade(ledger, {
      decisionId: 1,
      from: "USDT0",
      to: "mETH",
      amountIn: 10,
      amountOut: 0.005,
      txHash: "0x1",
    });
    ledger = applyDirectionalTrade(ledger, {
      decisionId: 2,
      from: "USDT0",
      to: "mETH",
      amountIn: 5,
      amountOut: 0.0024,
      txHash: "0x2",
    });

    expect(getOpenBasis(ledger, "WETH")).toMatchObject({
      asset: "mETH",
      quantity: 0.0074,
      costUsd: 15,
      txHash: "0x2",
    });
  });

  test("blocks a nominal take-profit that is negative after gas and slippage", () => {
    let ledger = createEmptyLedger();
    ledger = applyDirectionalTrade(ledger, {
      from: "USDT0",
      to: "mETH",
      amountIn: 10.5,
      amountOut: 0.005397772829249568,
      gasCostUsd: 0.0148,
      txHash: "0xentry",
    });

    const preview = previewFifoExit(ledger, {
      asset: "mETH",
      quantity: 0.005397772829249568,
      proceedsUsd: 10.5045,
      exitGasUsd: 0.02,
    });

    expect(preview.allowed).toBe(false);
    expect(preview.expectedNetPnlUsd).toBeLessThan(0);
    expect(preview.reason).toMatch(/net-profit/i);
  });

  test("allows an exit with a positive buffered net edge", () => {
    let ledger = createEmptyLedger();
    ledger = applyDirectionalTrade(ledger, {
      from: "USDT0",
      to: "WMNT",
      amountIn: 10,
      amountOut: 20,
      gasCostUsd: 0.01,
      txHash: "0xentry2",
    });

    const preview = previewFifoExit(ledger, {
      asset: "WMNT",
      quantity: 20,
      proceedsUsd: 10.5,
      exitGasUsd: 0.01,
    });

    expect(preview.allowed).toBe(true);
    expect(preview.expectedNetPnlUsd).toBeGreaterThan(0);
  });

  test("allows a profitable exit even when historic operating costs keep strategy PnL negative", () => {
    let ledger = createEmptyLedger();
    ledger = applyDirectionalTrade(ledger, {
      from: "USDT0",
      to: "WMNT",
      amountIn: 10,
      amountOut: 20,
      gasCostUsd: 0.01,
      txHash: "0xstrategy-entry",
    });
    ledger = applyOperatingCost(ledger, {
      decisionId: 91,
      proofGasMnt: 1,
      mntPriceUsd: 0.6,
    });

    const preview = previewFifoExit(ledger, {
      asset: "WMNT",
      quantity: 20,
      proceedsUsd: 10.5,
      exitGasUsd: 0.01,
    });

    expect(preview.expectedNetPnlUsd).toBeGreaterThan(0);
    expect(preview.projectedStrategyPnlUsd).toBeLessThan(0);
    expect(preview.allowed).toBe(true);
    expect(preview.requiredProceedsUsd).toBe(preview.tradeRequiredProceedsUsd);
    expect(preview.strategyRequiredProceedsUsd).toBeGreaterThan(
      preview.requiredProceedsUsd
    );
  });

  test("proof-only cycles do not ratchet the exit threshold of an unchanged lot", () => {
    let ledger = createEmptyLedger();
    ledger = applyDirectionalTrade(ledger, {
      from: "USDT0",
      to: "mETH",
      amountIn: 10.5,
      amountOut: 0.005,
      gasCostUsd: 0.015,
      txHash: "0xratchet-entry",
    });

    const before = previewFifoExit(ledger, {
      asset: "mETH",
      quantity: 0.005,
      proceedsUsd: 10.8,
      exitGasUsd: 0.01,
    });

    for (let decisionId = 100; decisionId < 105; decisionId += 1) {
      ledger = applyOperatingCost(ledger, {
        decisionId,
        proofGasMnt: 0.05,
        mntPriceUsd: 0.43,
      });
    }

    const after = previewFifoExit(ledger, {
      asset: "mETH",
      quantity: 0.005,
      proceedsUsd: 10.8,
      exitGasUsd: 0.01,
    });

    expect(after.requiredProceedsUsd).toBeCloseTo(before.requiredProceedsUsd, 8);
    expect(after.tradeRequiredProceedsUsd).toBeCloseTo(
      before.tradeRequiredProceedsUsd,
      8
    );
    expect(after.strategyRequiredProceedsUsd).toBeGreaterThan(
      before.strategyRequiredProceedsUsd
    );
    expect(after.allowed).toBe(true);
  });

  test("recognizes profit only after a matched exit and subtracts swap gas", () => {
    let ledger = createEmptyLedger("2026-07-10T00:00:00.000Z");
    ledger = applyDirectionalTrade(ledger, {
      decisionId: 1,
      recordedAt: "2026-07-10T01:00:00.000Z",
      from: "USDT0",
      to: "mETH",
      amountIn: 10,
      amountOut: 0.005,
      gasCostUsd: 0.04,
      txHash: "0xbuy",
    });

    expect(ledger.summary.closedTrades).toBe(0);
    expect(ledger.summary.realizedNetPnlUsd).toBe(0);

    ledger = applyDirectionalTrade(ledger, {
      decisionId: 2,
      recordedAt: "2026-07-10T05:00:00.000Z",
      from: "mETH",
      to: "USDT0",
      amountIn: 0.005,
      amountOut: 10.5,
      gasCostUsd: 0.05,
      txHash: "0xsell",
    });

    expect(ledger.summary.closedTrades).toBe(1);
    expect(ledger.summary.profitableClosedTrades).toBe(1);
    expect(ledger.summary.realizedGrossPnlUsd).toBeCloseTo(0.5, 8);
    expect(ledger.summary.swapGasUsd).toBeCloseTo(0.09, 8);
    expect(ledger.summary.realizedNetPnlUsd).toBeCloseTo(0.41, 8);
  });

  test("does not fabricate PnL when the sold inventory has unknown cost basis", () => {
    const ledger = applyDirectionalTrade(createEmptyLedger(), {
      decisionId: 3,
      recordedAt: "2026-07-10T06:00:00.000Z",
      from: "WMNT",
      to: "USDT0",
      amountIn: 4,
      amountOut: 1.8,
      gasCostUsd: 0.03,
      txHash: "0xunknown",
    });

    expect(ledger.summary.closedTrades).toBe(0);
    expect(ledger.summary.unknownBasisExitUsd).toBeCloseTo(1.8, 8);
    expect(ledger.summary.realizedNetPnlUsd).toBe(0);
  });

  test("tracks proof gas as operating cost separately from matched trade PnL", () => {
    const ledger = applyOperatingCost(createEmptyLedger(), {
      decisionId: 4,
      recordedAt: "2026-07-10T07:00:00.000Z",
      proofGasMnt: 0.05,
      mntPriceUsd: 0.43,
    });

    expect(ledger.summary.proofGasUsd).toBeCloseTo(0.0215, 8);
    expect(ledger.summary.netStrategyPnlUsd).toBeCloseTo(-0.0215, 8);
  });

  test("charges gas from a partial failed route even without a completed trade", () => {
    const ledger = applyOperatingCost(createEmptyLedger(), {
      decisionId: 41,
      proofGasMnt: 0.02,
      mntPriceUsd: 0.5,
      unmatchedSwapGasUsd: 0.03,
    });

    expect(ledger.summary.proofGasUsd).toBeCloseTo(0.01, 8);
    expect(ledger.summary.swapGasUsd).toBeCloseTo(0.03, 8);
    expect(ledger.summary.netStrategyPnlUsd).toBeCloseTo(-0.04, 8);
  });

  test("is idempotent for the same transaction hash", () => {
    const trade = {
      decisionId: 5,
      recordedAt: "2026-07-10T08:00:00.000Z",
      from: "USDT0",
      to: "WMNT",
      amountIn: 10,
      amountOut: 23,
      gasCostUsd: 0.03,
      txHash: "0xduplicate",
    };
    const once = applyDirectionalTrade(createEmptyLedger(), trade);
    const twice = applyDirectionalTrade(once, trade);

    expect(twice.entries).toHaveLength(1);
    expect(twice.lots.WMNT).toHaveLength(1);
  });
});
