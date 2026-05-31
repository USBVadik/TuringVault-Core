const {
  _private: { getSettlementSnapshot, inferSettlementSourceAsset },
} = require("../../src/orchestrator/multiAgentLoop");

function marketWithPrimary(primary, action = "SELL_mETH") {
  const mantleAction = primary === "mantle" ? action : "HOLD";
  const ethereumAction = primary === "ethereum" ? action : "HOLD";
  return {
    ethPrice: 2200,
    mntPrice: 0.65,
    structuredSignals: {
      signals: {
        ranging: {
          action,
          multiAsset: {
            primary,
            ethereum: { action: ethereumAction },
            mantle: { action: mantleAction },
          },
        },
      },
    },
  };
}

describe("multiAgentLoop settlement snapshot", () => {
  test("uses WETH benchmark for mETH entries because live market uses ETH spot", () => {
    expect(getSettlementSnapshot({ ethPrice: 2200 }, "mETH")).toEqual({
      settlementAsset: "WETH",
      priceAtDecision: 2200,
      sourceAsset: null,
      missingPriceReason: null,
    });
  });

  test("keeps legacy mETH price aliases for replay/challenge callers", () => {
    expect(getSettlementSnapshot({ mETHPrice: 2210 }, "mETH")).toEqual({
      settlementAsset: "WETH",
      priceAtDecision: 2210,
      sourceAsset: null,
      missingPriceReason: null,
    });
    expect(getSettlementSnapshot({ methPrice: 2220 }, "mETH")).toEqual({
      settlementAsset: "WETH",
      priceAtDecision: 2220,
      sourceAsset: null,
      missingPriceReason: null,
    });
  });

  test("infers MNT source for blocked stable risk-off when MNT grid is primary", () => {
    const market = marketWithPrimary("mantle");

    expect(
      inferSettlementSourceAsset({ market, targetAsset: "mUSD" })
    ).toBe("WMNT");
    expect(getSettlementSnapshot(market, "mUSD")).toEqual({
      settlementAsset: "MNT",
      priceAtDecision: 0.65,
      sourceAsset: "WMNT",
      missingPriceReason: null,
    });
  });

  test("infers mETH source for blocked stable risk-off when ETH grid is primary", () => {
    const market = marketWithPrimary("ethereum");

    expect(
      inferSettlementSourceAsset({ market, targetAsset: "mUSD" })
    ).toBe("mETH");
    expect(getSettlementSnapshot(market, "mUSD")).toEqual({
      settlementAsset: "WETH",
      priceAtDecision: 2200,
      sourceAsset: "mETH",
      missingPriceReason: null,
    });
  });

  test("keeps legacy WETH fallback for stable hold or non-grid risk-off history", () => {
    expect(getSettlementSnapshot({ ethPrice: 2200 }, "mUSD")).toEqual({
      settlementAsset: "WETH",
      priceAtDecision: 2200,
      sourceAsset: "mETH",
      missingPriceReason: null,
    });
  });

  test("does not infer source when both grids can explain a blocked risk-off", () => {
    const market = {
      ethPrice: 2200,
      mntPrice: 0.65,
      structuredSignals: {
        signals: {
          ranging: {
            multiAsset: {
              primary: "mantle",
              ethereum: { action: "SELL_mETH" },
              mantle: { action: "SELL_mETH" },
            },
          },
        },
      },
    };

    expect(
      inferSettlementSourceAsset({ market, targetAsset: "mUSD" })
    ).toBeNull();
    expect(getSettlementSnapshot(market, "mUSD")).toEqual({
      settlementAsset: null,
      priceAtDecision: null,
      sourceAsset: null,
      missingPriceReason: "ambiguous-risk-off-source",
    });
  });

  test("explicit analyst source overrides primary grid ambiguity", () => {
    const market = marketWithPrimary("mantle");

    expect(getSettlementSnapshot(market, "mUSD", "mETH")).toEqual({
      settlementAsset: "WETH",
      priceAtDecision: 2200,
      sourceAsset: "mETH",
      missingPriceReason: null,
    });
  });

  test("does not fall back to ETH price when MNT benchmark is missing", () => {
    const market = marketWithPrimary("mantle");
    delete market.mntPrice;

    expect(getSettlementSnapshot(market, "mUSD")).toEqual({
      settlementAsset: "MNT",
      priceAtDecision: null,
      sourceAsset: "WMNT",
      missingPriceReason: "missing-MNT-price",
    });
  });
});
