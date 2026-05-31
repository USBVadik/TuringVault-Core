const { classifyChannelExit } = require("../../src/strategies/rangingGrid");

describe("rangingGrid.classifyChannelExit", () => {
  test("labels volatility expansion above resistance as an upward breakout", () => {
    const exit = classifyChannelExit(0.685, {
      support: 0.63,
      resistance: 0.65,
      volatilityExpanding: true,
      hasTrend: true,
    });

    expect(exit.shouldExit).toBe(true);
    expect(exit.breakoutDirection).toBe("UP");
    expect(exit.regimeHint).toBe("TREND_UP");
    expect(exit.reason).toMatch(/broke above resistance/i);
  });

  test("labels volatility expansion below support as a downward breakdown", () => {
    const exit = classifyChannelExit(0.615, {
      support: 0.63,
      resistance: 0.65,
      volatilityExpanding: true,
      hasTrend: false,
    });

    expect(exit.shouldExit).toBe(true);
    expect(exit.breakoutDirection).toBe("DOWN");
    expect(exit.regimeHint).toBe("TREND_DOWN");
    expect(exit.reason).toMatch(/broke below support/i);
  });

  test("does not call inside-channel volatility a bearish breakdown", () => {
    const exit = classifyChannelExit(0.64, {
      support: 0.63,
      resistance: 0.65,
      volatilityExpanding: true,
      hasTrend: false,
    });

    expect(exit.shouldExit).toBe(true);
    expect(exit.breakoutDirection).toBe("UNKNOWN");
    expect(exit.regimeHint).toBe("HOLD");
    expect(exit.reason).toMatch(/volatility expanding/i);
    expect(exit.reason).not.toMatch(/breaking down/i);
  });
});
