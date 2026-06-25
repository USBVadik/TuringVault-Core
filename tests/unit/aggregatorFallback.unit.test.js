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
