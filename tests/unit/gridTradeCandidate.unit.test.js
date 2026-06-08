const {
  buildGridTradeCandidate,
  formatGridTradeCandidateForPrompt,
} = require("../../src/orchestrator/gridTradeCandidate");

function stableHeavySummary(overrides = {}) {
  return {
    stableUsd: 106,
    tradableRiskUsd: 15,
    stableShare: 0.875,
    riskShare: 0.125,
    stableHeavy: true,
    ...overrides,
  };
}

function structuredSignals(overrides = {}) {
  return {
    regime: { regime: "RANGING", confidence: 55 },
    consensus: "BEARISH",
    signals: {
      onChainFlow: { signal: "NEUTRAL", netUsd: 0 },
      funding: { signal: "NEUTRAL", value: 0.6 },
      yieldSpread: { signal: "BEARISH", spread: -1 },
      ranging: {
        action: "EXIT_RANGING",
        confidence: 0.65,
        breakoutDirection: "UNKNOWN",
        regimeHint: "HOLD",
        channel: {
          support: 2006.7,
          resistance: 2029.5,
          currentPrice: 2007.3,
          channelPosition: 0.03,
        },
        multiAsset: {
          primary: "ethereum",
          ethereum: {
            action: "EXIT_RANGING",
            confidence: 0.65,
            breakoutDirection: "UNKNOWN",
            regimeHint: "HOLD",
            channel: {
              support: 2006.7,
              resistance: 2029.5,
              currentPrice: 2007.3,
              channelPosition: 0.03,
            },
          },
          mantle: {
            action: "HOLD",
            confidence: 0.5,
            channel: {
              support: 0.65,
              resistance: 0.69,
              currentPrice: 0.665,
              channelPosition: 0.47,
            },
          },
        },
      },
    },
    ...overrides,
  };
}

describe("gridTradeCandidate", () => {
  test("emits a small risk-on mETH re-entry when stable-heavy and ETH grid sits at lower band without confirmed breakdown", () => {
    const candidate = buildGridTradeCandidate({
      structuredSignals: structuredSignals(),
      portfolioSummary: stableHeavySummary(),
      positionState: { status: "FLAT" },
    });

    expect(candidate.active).toBe(true);
    expect(candidate.action).toBe("swap");
    expect(candidate.direction).toBe("risk_on");
    expect(candidate.targetAsset).toBe("mETH");
    expect(candidate.sourceAsset).toBe("USDT0");
    expect(candidate.allocationPct).toBeGreaterThanOrEqual(10);
    expect(candidate.confidence).toBeGreaterThanOrEqual(0.55);
    expect(candidate.reasoning).toMatch(/lower-band/i);
    expect(candidate.riskReward.ratio).toBeGreaterThanOrEqual(1.5);
    expect(candidate.riskReward.stopLoss).toBeLessThan(candidate.riskReward.entry);
    expect(candidate.riskReward.takeProfit).toBeGreaterThan(
      candidate.riskReward.entry
    );
  });

  test("does not emit risk-on when EXIT_RANGING is a confirmed downward break", () => {
    const s = structuredSignals();
    s.signals.ranging.breakoutDirection = "DOWN";
    s.signals.ranging.regimeHint = "TREND_DOWN";
    s.signals.ranging.multiAsset.ethereum.breakoutDirection = "DOWN";
    s.signals.ranging.multiAsset.ethereum.regimeHint = "TREND_DOWN";

    const candidate = buildGridTradeCandidate({
      structuredSignals: s,
      portfolioSummary: stableHeavySummary(),
      positionState: { status: "FLAT" },
    });

    expect(candidate.active).toBe(false);
    expect(candidate.reason).toMatch(/down/i);
  });

  test("emits a tiny inventory-aware contrarian buy in TREND_DOWN only when external evidence confirms capitulation", () => {
    const s = structuredSignals({
      regime: { regime: "TREND_DOWN", confidence: 0.6 },
      consensus: "BEARISH",
    });
    s.signals.funding = {
      signal: "BULLISH",
      strength: 0.86,
      value: -28,
      rsi: 24,
      source: "coinglass",
    };
    s.signals.fearGreed = { value: 11, signal: "EXTREME_FEAR" };
    s.signals.onChainFlow = { signal: "NEUTRAL", netUsd: 0 };
    s.signals.ranging.multiAsset.mantle = {
      action: "HOLD",
      confidence: 0.68,
      breakoutDirection: "UNKNOWN",
      regimeHint: "HOLD",
      channel: {
        support: 0.53,
        resistance: 0.61,
        currentPrice: 0.532,
        channelPosition: 0.03,
        channelWidthPct: 14,
      },
    };

    const candidate = buildGridTradeCandidate({
      structuredSignals: s,
      portfolioSummary: stableHeavySummary({
        stableUsd: 120,
        tradableRiskUsd: 18,
        stableShare: 0.87,
        riskShare: 0.13,
        stableHeavy: true,
      }),
      positionState: { status: "FLAT" },
    });

    expect(candidate.active).toBe(true);
    expect(candidate.kind).toBe("inventory-aware-contrarian-buy");
    expect(candidate.direction).toBe("risk_on");
    expect(candidate.targetAsset).toBe("MNT");
    expect(candidate.allocationPct).toBeLessThanOrEqual(6);
    expect(candidate.reasoning).toMatch(/reservation/i);
    expect(candidate.riskFactors.join(" ")).toMatch(/counter-trend/i);
  });

  test("emits a risk-off sell candidate when an existing mETH position reaches the upper band", () => {
    const s = structuredSignals();
    s.signals.ranging.multiAsset.ethereum = {
      action: "SELL_mETH",
      confidence: 0.74,
      breakoutDirection: "UNKNOWN",
      regimeHint: "HOLD",
      channel: {
        support: 1977.7,
        resistance: 2029.5,
        currentPrice: 2026.2,
        channelPosition: 0.94,
      },
    };

    const candidate = buildGridTradeCandidate({
      structuredSignals: s,
      portfolioSummary: stableHeavySummary({
        stableUsd: 82,
        tradableRiskUsd: 24,
        methUsd: 24,
        stableShare: 0.77,
        riskShare: 0.23,
        stableHeavy: false,
      }),
      positionState: {
        status: "IN_mETH",
        entryPrice: 1983.6,
        targetExit: 2029.5,
      },
    });

    expect(candidate.active).toBe(true);
    expect(candidate.kind).toBe("grid-sell");
    expect(candidate.direction).toBe("risk_off");
    expect(candidate.targetAsset).toBe("mUSD");
    expect(candidate.sourceAsset).toBe("mETH");
    expect(candidate.reasoning).toMatch(/existing risk inventory/i);
  });

  test("does not emit a sell candidate when upper-band grid fires but no matching risk inventory exists", () => {
    const s = structuredSignals();
    s.signals.ranging.multiAsset.ethereum = {
      action: "SELL_mETH",
      confidence: 0.74,
      channel: {
        support: 1977.7,
        resistance: 2029.5,
        currentPrice: 2026.2,
        channelPosition: 0.94,
      },
    };

    const candidate = buildGridTradeCandidate({
      structuredSignals: s,
      portfolioSummary: stableHeavySummary({
        stableUsd: 106,
        tradableRiskUsd: 0,
        methUsd: 0,
        stableShare: 1,
        riskShare: 0,
        stableHeavy: true,
      }),
      positionState: { status: "FLAT" },
    });

    expect(candidate.active).toBe(false);
    expect(candidate.reason).toMatch(/no tradable mETH inventory/i);
  });

  test("formats an active candidate into a validator-visible prompt block", () => {
    const text = formatGridTradeCandidateForPrompt({
      active: true,
      action: "swap",
      direction: "risk_on",
      targetAsset: "mETH",
      sourceAsset: "USDT0",
      allocationPct: 12,
      confidence: 0.58,
      routeHint: ["USDT0", "USDT", "WMNT", "WETH", "mETH"],
      riskReward: {
        entry: 2008.1,
        stopLoss: 2004.42,
        takeProfit: 2029.5,
        ratio: 5.82,
      },
      reasoning: "Stable-heavy lower-band re-entry.",
      riskFactors: ["Confirmed down-break would invalidate entry"],
    });

    expect(text).toMatch(/DETERMINISTIC GRID TRADE CANDIDATE/);
    expect(text).toMatch(/USDT0 -> USDT -> WMNT -> WETH -> mETH/);
    expect(text).toMatch(/Risk\/reward: 5\.82:1/);
    expect(text).toMatch(/Stop loss: 2004\.42/);
    expect(text).toMatch(/Claude must validate/i);
  });
});
