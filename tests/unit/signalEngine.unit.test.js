const { detectRegime } = require("../../src/orchestrator/signalEngine");

describe("signalEngine.detectRegime", () => {
  test("keeps mild fear dip in RANGING when flow and funding do not confirm downtrend", () => {
    const regime = detectRegime({
      fearGreed: 23,
      ethChange24h: -1.8,
      fundingSignal: { value: 0, signal: "NEUTRAL" },
      flowSignal: { signal: "NEUTRAL" },
    });

    expect(regime.regime).toBe("RANGING");
    expect(regime.implication).toMatch(/Mean-reversion grid OK/);
  });

  test("still classifies confirmed bearish flow plus negative price as TREND_DOWN", () => {
    const regime = detectRegime({
      fearGreed: 28,
      ethChange24h: -1.8,
      fundingSignal: { value: 0, signal: "NEUTRAL" },
      flowSignal: { signal: "BEARISH" },
    });

    expect(regime.regime).toBe("TREND_DOWN");
  });
});
