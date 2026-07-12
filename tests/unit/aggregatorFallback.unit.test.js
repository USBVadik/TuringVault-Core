const { ethers } = require("ethers");
const { attemptAggregatorSwap } = require("../../src/dex/aggregatorFallback");

function mockDexFactory(impl) {
  const calls = [];
  const factory = () => ({
    executeSwap: async (from, to, amountWei) => {
      calls.push({ from, to, amountWei });
      return typeof impl === "function" ? impl(from, to, amountWei) : impl;
    },
  });
  factory.calls = calls;
  return factory;
}

describe("attemptAggregatorSwap", () => {
  test("returns null when disabled so caller keeps its original failure", async () => {
    const res = await attemptAggregatorSwap({
      enabled: false,
      fromToken: "USDT0",
      toToken: "WMNT",
      sourceAmount: 12,
      dexFactory: mockDexFactory({ executed: true, txHash: "0xabc" }),
    });
    expect(res).toBeNull();
  });

  test("routes a viable risk-on buy through the aggregator", async () => {
    const factory = mockDexFactory({
      executed: true,
      txHash: "0xfeed",
      blockNumber: 123,
      estimatedOut: 18.4,
    });
    const res = await attemptAggregatorSwap({
      enabled: true,
      fromToken: "USDT0",
      toToken: "WMNT",
      sourceAmount: 12,
      dexFactory: factory,
    });
    expect(res.executed).toBe(true);
    expect(res.via).toBe("openocean-aggregator");
    expect(res.txHash).toBe("0xfeed");
    expect(res.from).toBe("USDT0");
    expect(res.to).toBe("WMNT");
    expect(res.amountIn).toBe(12);
    expect(res.amountOut).toBe(18.4);
    expect(res.legs).toHaveLength(1);
    expect(res.legs[0].op).toBe("aggregator-swap");
    // OpenOcean API contract: amount encoded via parseEther regardless of decimals
    expect(factory.calls[0].amountWei).toBe(ethers.parseEther("12"));
    expect(factory.calls[0].from).toBe("USDT0");
    expect(factory.calls[0].to).toBe("WMNT");
  });

  test("reports a handled failure when the aggregator finds no route", async () => {
    const res = await attemptAggregatorSwap({
      enabled: true,
      fromToken: "USDT0",
      toToken: "mETH",
      sourceAmount: 12,
      dexFactory: mockDexFactory({ executed: false, reason: "No route found" }),
    });
    expect(res.executed).toBe(false);
    expect(res.reason).toMatch(/aggregator: No route found/);
  });

  test("does not broadcast when a risk-off quote fails the economic gate", async () => {
    let executed = false;
    const factory = () => ({
      getQuote: async () => ({ viable: true, estimatedOut: 9.95 }),
      executeSwap: async () => {
        executed = true;
        return { executed: true, txHash: "0xshould-not-broadcast" };
      },
    });

    const res = await attemptAggregatorSwap({
      enabled: true,
      fromToken: "WMNT",
      toToken: "USDT0",
      sourceAmount: 20,
      dexFactory: factory,
      quoteValidator: ({ amountOut }) => ({
        allowed: amountOut >= 10.2,
        reason: "net-profit gate blocked aggregator quote",
      }),
    });

    expect(executed).toBe(false);
    expect(res.executed).toBe(false);
    expect(res.profitabilityGate.allowed).toBe(false);
    expect(res.reason).toMatch(/net-profit gate/i);
  });

  test("validates the executable minimum output instead of the optimistic quote", async () => {
    let validated;
    const factory = () => ({
      getQuote: async () => ({
        viable: true,
        estimatedOut: 10.6,
        minimumOut: 10.4,
      }),
      executeSwap: async () => ({
        executed: true,
        txHash: "0xmin-output",
        estimatedOut: 10.6,
      }),
    });

    const res = await attemptAggregatorSwap({
      enabled: true,
      fromToken: "mETH",
      toToken: "USDT0",
      sourceAmount: 0.005,
      dexFactory: factory,
      quoteValidator: (quote) => {
        validated = quote;
        return { allowed: quote.amountOut >= 10.3 };
      },
    });

    expect(res.executed).toBe(true);
    expect(validated.amountOut).toBe(10.4);
    expect(validated.quotedAmountOut).toBe(10.6);
  });

  test("retries a transient quote timeout without retrying the broadcast", async () => {
    let quoteAttempts = 0;
    let broadcasts = 0;
    const factory = () => ({
      getQuote: async () => {
        quoteAttempts += 1;
        if (quoteAttempts === 1) throw new Error("quote timeout");
        return { viable: true, estimatedOut: 10.7, minimumOut: 10.6 };
      },
      executeSwap: async () => {
        broadcasts += 1;
        return { executed: true, txHash: "0xquote-retry", estimatedOut: 10.7 };
      },
    });

    const res = await attemptAggregatorSwap({
      enabled: true,
      fromToken: "mETH",
      toToken: "USDT0",
      sourceAmount: 0.005,
      dexFactory: factory,
      quoteValidator: () => ({ allowed: true }),
      quoteRetryDelayMs: 0,
    });

    expect(res.executed).toBe(true);
    expect(quoteAttempts).toBe(2);
    expect(broadcasts).toBe(1);
  });

  test("does not throw when the aggregator execution throws", async () => {
    const res = await attemptAggregatorSwap({
      enabled: true,
      fromToken: "USDT0",
      toToken: "WMNT",
      sourceAmount: 12,
      dexFactory: mockDexFactory(() => {
        throw new Error("rpc timeout");
      }),
    });
    expect(res.executed).toBe(false);
    expect(res.reason).toMatch(/aggregator: threw rpc timeout/);
  });

  test("rejects a non-positive source amount", async () => {
    const res = await attemptAggregatorSwap({
      enabled: true,
      fromToken: "USDT0",
      toToken: "WMNT",
      sourceAmount: 0,
      dexFactory: mockDexFactory({ executed: true, txHash: "0x1" }),
    });
    expect(res.executed).toBe(false);
    expect(res.reason).toMatch(/non-positive/);
  });

  test("rejects an invalid token pair", async () => {
    const res = await attemptAggregatorSwap({
      enabled: true,
      fromToken: "WMNT",
      toToken: "WMNT",
      sourceAmount: 12,
      dexFactory: mockDexFactory({ executed: true, txHash: "0x1" }),
    });
    expect(res.executed).toBe(false);
    expect(res.reason).toMatch(/invalid token pair/);
  });

  test("treats an executed result without a txHash as not executed (honest)", async () => {
    const res = await attemptAggregatorSwap({
      enabled: true,
      fromToken: "USDT0",
      toToken: "WMNT",
      sourceAmount: 12,
      dexFactory: mockDexFactory({ executed: true }),
    });
    expect(res.executed).toBe(false);
    expect(res.reason).toMatch(/aggregator:/);
  });
});
