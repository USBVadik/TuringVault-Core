const {
  preflightSwapPath,
  retryPreflightWithLiquidityCap,
} = require("../../src/dex/routePreflight");

describe("routePreflight", () => {
  test("blocks the whole route before broadcast when a later leg is not viable", async () => {
    const calls = [];
    const dex = {
      getQuote: jest.fn(async (from, to) => {
        calls.push(`${from}->${to}`);
        if (from === "USDT0" && to === "USDT") {
          return { viable: true, estimatedOut: 5, priceImpact: 0.0001 };
        }
        if (from === "USDT" && to === "WMNT") {
          return { viable: true, estimatedOut: 7.5, priceImpact: 0.001 };
        }
        return {
          viable: false,
          estimatedOut: 0.002,
          priceImpact: 0.13,
          pairAddress: "0xdead",
        };
      }),
    };

    const result = await preflightSwapPath({
      dex,
      path: ["USDT0", "USDT", "WMNT", "mETH"],
      initialAmount: 5,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/leg3 WMNT->mETH not viable/);
    expect(calls).toEqual(["USDT0->USDT", "USDT->WMNT", "WMNT->mETH"]);
  });

  test("accepts the deeper WETH bridge route into mETH", async () => {
    const dex = {
      getQuote: jest.fn(async (from, to) => {
        const out = {
          "USDT0->USDT": 5,
          "USDT->WMNT": 7.5,
          "WMNT->WETH": 0.0025,
          "WETH->mETH": 0.0024,
        }[`${from}->${to}`];
        return { viable: true, estimatedOut: out, priceImpact: 0.001 };
      }),
    };

    const result = await preflightSwapPath({
      dex,
      path: ["USDT0", "USDT", "WMNT", "WETH", "mETH"],
      initialAmount: 5,
    });

    expect(result).toMatchObject({ ok: true, amountOut: 0.0024 });
    expect(result.legs.map((l) => `${l.from}->${l.to}`)).toEqual([
      "USDT0->USDT",
      "USDT->WMNT",
      "WMNT->WETH",
      "WETH->mETH",
    ]);
  });

  test("suggests a smaller initial amount when a later leg is only depth-limited", async () => {
    const dex = {
      getQuote: jest.fn(async (from, to) => {
        if (from === "USDT0" && to === "USDT") {
          return { viable: true, estimatedOut: 5.000499, priceImpact: 0 };
        }
        return {
          viable: false,
          estimatedOut: 9.35,
          priceImpact: 0.0046,
          depthFraction: 0.508,
          pairAddress: "0xf6",
          binStep: 15,
        };
      }),
    };

    const result = await preflightSwapPath({
      dex,
      path: ["USDT0", "USDT", "WMNT"],
      initialAmount: 5,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not viable/);
    expect(result.suggestedInitialAmount).toBeGreaterThan(4);
    expect(result.suggestedInitialAmount).toBeLessThan(5);
    expect(result.legs[1].depthFraction).toBe(0.508);
  });

  test("retries with the suggested liquidity-aware size", async () => {
    const dex = {
      getQuote: jest.fn(async (from, to, amountIn) => {
        const amount = Number(amountIn) / 1_000_000;
        if (from === "USDT0" && to === "USDT") {
          return { viable: true, estimatedOut: amount, priceImpact: 0 };
        }
        if (amount > 4.5) {
          return {
            viable: false,
            estimatedOut: 9.35,
            priceImpact: 0.0046,
            depthFraction: 0.508,
          };
        }
        return {
          viable: true,
          estimatedOut: 8.2,
          priceImpact: 0.003,
          depthFraction: 0.44,
        };
      }),
    };

    const result = await retryPreflightWithLiquidityCap({
      dex,
      path: ["USDT0", "USDT", "WMNT"],
      initialAmount: 5,
      minInitialAmount: 0.3,
    });

    expect(result.ok).toBe(true);
    expect(result.liquidityAdjusted).toBe(true);
    expect(result.initialAmount).toBeLessThan(5);
    expect(dex.getQuote).toHaveBeenCalledTimes(4);
  });
});
