const { preflightSwapPath } = require("../../src/dex/routePreflight");

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
});
