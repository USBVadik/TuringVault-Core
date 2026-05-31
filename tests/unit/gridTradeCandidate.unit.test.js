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

  test("formats an active candidate into a validator-visible prompt block", () => {
    const text = formatGridTradeCandidateForPrompt({
      active: true,
      action: "swap",
      direction: "risk_on",
      targetAsset: "mETH",
      sourceAsset: "USDT0",
      allocationPct: 12,
      confidence: 0.58,
      routeHint: ["USDT0", "USDT", "WMNT", "mETH"],
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
    expect(text).toMatch(/USDT0 -> USDT -> WMNT -> mETH/);
    expect(text).toMatch(/Risk\/reward: 5\.82:1/);
    expect(text).toMatch(/Stop loss: 2004\.42/);
    expect(text).toMatch(/Claude must validate/i);
  });
});
