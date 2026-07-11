const {
  assertLegacyExecutionEnabled,
  isLegacyExecutionEnabled,
} = require("../../src/strategies/liveGridBot");

describe("legacy grid bot execution guard", () => {
  test("is disabled by default", () => {
    expect(isLegacyExecutionEnabled({})).toBe(false);
    expect(() => assertLegacyExecutionEnabled({})).toThrow(/disabled/i);
  });

  test("requires the exact explicit opt-in", () => {
    expect(isLegacyExecutionEnabled({ LEGACY_GRID_BOT_EXECUTION_ENABLED: "true" })).toBe(true);
    expect(isLegacyExecutionEnabled({ LEGACY_GRID_BOT_EXECUTION_ENABLED: "1" })).toBe(false);
  });
});
