const {
  assessTradeInventory,
  formatPortfolioForPrompt,
  summarizePortfolio,
  SCALE_IN_ALLOCATION_PCT,
} = require("../../src/orchestrator/portfolioGuard");

const PRICES = {
  MNT: 0.67,
  WMNT: 0.67,
  mETH: 2200,
  ETH: 2200,
  USDT0: 1,
  USDT: 1,
  mUSD: 1,
};

describe("portfolioGuard", () => {
  test("blocks repeated risk-off when the wallet is already stable-heavy and flat", () => {
    const balances = {
      MNT: 20,
      WMNT: 0.55,
      mETH: 0.006,
      USDT0: 109,
      USDT: 0,
      mUSD: 0,
    };

    const result = assessTradeInventory({
      direction: "risk-off",
      targetAsset: "mUSD",
      balances,
      prices: PRICES,
      regime: "RANGING",
      positionState: { status: "FLAT" },
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/stable-heavy/i);
    expect(result.reason).toMatch(/refusing repeated risk-off/i);
  });

  test("allows risk-on deployment from a stable-heavy wallet", () => {
    const result = assessTradeInventory({
      direction: "risk-on",
      targetAsset: "MNT",
      balances: {
        MNT: 20,
        WMNT: 0.1,
        mETH: 0,
        USDT0: 109,
        USDT: 0,
        mUSD: 0,
      },
      prices: PRICES,
      regime: "RANGING",
      positionState: { status: "FLAT" },
    });

    expect(result.allowed).toBe(true);
    expect(result.reason).toMatch(/stable inventory available/i);
  });

  test("blocks same-asset risk-on when already in position without a fresh lower grid level", () => {
    const result = assessTradeInventory({
      direction: "risk-on",
      targetAsset: "MNT",
      balances: {
        MNT: 20,
        WMNT: 20,
        mETH: 0,
        USDT0: 80,
        USDT: 0,
        mUSD: 0,
      },
      prices: PRICES,
      regime: "RANGING",
      positionState: {
        status: "IN_MNT",
        entryPrice: 0.67,
        scaleInCount: 0,
      },
      structuredSignals: {
        signals: {
          ranging: {
            multiAsset: {
              mantle: {
                action: "BUY_mETH",
                confidence: 0.8,
                channel: {
                  currentPrice: 0.668,
                  channelPosition: 0.04,
                },
              },
            },
          },
        },
      },
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/scale-in blocked/i);
    expect(result.reason).toMatch(/not below prior entry/i);
  });

  test("allows controlled same-asset scale-in after a deeper lower-band move", () => {
    const result = assessTradeInventory({
      direction: "risk-on",
      targetAsset: "WMNT",
      balances: {
        MNT: 20,
        WMNT: 20,
        mETH: 0,
        USDT0: 80,
        USDT: 0,
        mUSD: 0,
      },
      prices: PRICES,
      regime: "RANGING",
      positionState: {
        status: "IN_MNT",
        entryPrice: 0.67,
        scaleInCount: 0,
      },
      structuredSignals: {
        signals: {
          onChainFlow: { signal: "NEUTRAL", netUsd: 0 },
          ranging: {
            multiAsset: {
              mantle: {
                action: "BUY_mETH",
                confidence: 0.82,
                channel: {
                  currentPrice: 0.642,
                  channelPosition: 0.03,
                },
              },
            },
          },
        },
      },
    });

    expect(result.allowed).toBe(true);
    expect(result.reason).toMatch(/controlled scale-in/i);
    expect(result.suggestedAllocationPct).toBe(SCALE_IN_ALLOCATION_PCT);
  });

  test("blocks controlled scale-in during confirmed down-break", () => {
    const result = assessTradeInventory({
      direction: "risk-on",
      targetAsset: "WMNT",
      balances: {
        MNT: 20,
        WMNT: 20,
        mETH: 0,
        USDT0: 80,
        USDT: 0,
        mUSD: 0,
      },
      prices: PRICES,
      regime: "TREND_DOWN",
      positionState: {
        status: "IN_MNT",
        entryPrice: 0.67,
        scaleInCount: 0,
      },
      structuredSignals: {
        signals: {
          ranging: {
            multiAsset: {
              mantle: {
                action: "BUY_mETH",
                confidence: 0.82,
                breakoutDirection: "DOWN",
                regimeHint: "TREND_DOWN",
                channel: {
                  currentPrice: 0.642,
                  channelPosition: 0.03,
                },
              },
            },
          },
        },
      },
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/confirmed down-break/i);
  });

  test("allows risk-off exits when an actual grid position is open", () => {
    const result = assessTradeInventory({
      direction: "risk-off",
      targetAsset: "mUSD",
      balances: {
        MNT: 20,
        WMNT: 0.2,
        mETH: 0.01,
        USDT0: 100,
        USDT: 0,
        mUSD: 0,
      },
      prices: PRICES,
      regime: "RANGING",
      positionState: { status: "IN_mETH" },
    });

    expect(result.allowed).toBe(true);
    expect(result.reason).toMatch(/open position/i);
  });

  test("summary excludes native MNT gas reserve from tradable risk inventory", () => {
    const summary = summarizePortfolio({
      balances: {
        MNT: 20,
        WMNT: 0,
        mETH: 0,
        USDT0: 100,
        USDT: 0,
        mUSD: 0,
      },
      prices: PRICES,
    });

    expect(summary.tradableRiskUsd).toBe(0);
    expect(summary.nativeMntUsd).toBeCloseTo(13.4, 2);
    expect(summary.stableShare).toBe(1);
  });

  test("prompt context tells the validator when risk-off should become hold", () => {
    const text = formatPortfolioForPrompt(
      summarizePortfolio({
        balances: {
          MNT: 20,
          WMNT: 0.55,
          mETH: 0.006,
          USDT0: 109,
          USDT: 0,
          mUSD: 0,
        },
        prices: PRICES,
      })
    );

    expect(text).toMatch(/LIVE PORTFOLIO/);
    expect(text).toMatch(/stable-heavy/i);
    expect(text).toMatch(/risk_off.*HOLD/i);
  });
});
