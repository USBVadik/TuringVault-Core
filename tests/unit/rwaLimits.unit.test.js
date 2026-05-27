/**
 * Unit tests for src/config/rwaLimits.js
 *
 * Validates defaults and env-override behaviour. Run via:
 *   node_modules/.bin/jest tests/unit/rwaLimits.unit.test.js
 *
 * Spec: rwa-allocation-active T5.
 */

describe("rwaLimits", () => {
  // Each test isolates its env mutation via beforeEach/afterEach so the
  // module cache is fresh and other tests aren't affected.
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.resetModules();
    delete process.env.RWA_MAX_PER_CYCLE_USD;
    delete process.env.RWA_MAX_PER_DAY_USD;
    delete process.env.RWA_MIN_BALANCE_USD;
    delete process.env.RWA_IDLE_PARKING_MIN_FLAT_MS;
    delete process.env.RWA_IDLE_PARKING_FRACTION;
  });

  test("exports all 9 expected constants", () => {
    const limits = require("../../src/config/rwaLimits");
    const keys = [
      "MAX_PER_CYCLE_USD",
      "MAX_PER_DAY_USD",
      "MIN_BALANCE_USD",
      "MAX_PRICE_IMPACT_BPS",
      "DEFAULT_SLIPPAGE_BPS",
      "IDLE_PARKING_COOLDOWN_MS",
      "IDLE_PARKING_MIN_FLAT_MS",
      "IDLE_PARKING_FRACTION",
    ];
    for (const k of keys) {
      expect(typeof limits[k]).toBe("number");
      expect(Number.isFinite(limits[k])).toBe(true);
    }
  });

  test("defaults match spec", () => {
    const limits = require("../../src/config/rwaLimits");
    expect(limits.MAX_PER_CYCLE_USD).toBe(5);
    expect(limits.MAX_PER_DAY_USD).toBe(25);
    expect(limits.MIN_BALANCE_USD).toBe(2);
    expect(limits.MAX_PRICE_IMPACT_BPS).toBe(100);
    expect(limits.DEFAULT_SLIPPAGE_BPS).toBe(50);
    expect(limits.IDLE_PARKING_COOLDOWN_MS).toBe(6 * 60 * 60 * 1000);
    expect(limits.IDLE_PARKING_MIN_FLAT_MS).toBe(24 * 60 * 60 * 1000);
    expect(limits.IDLE_PARKING_FRACTION).toBe(0.2);
  });

  test("numeric env vars override defaults", () => {
    process.env.RWA_MAX_PER_CYCLE_USD = "10";
    process.env.RWA_MAX_PER_DAY_USD = "100";
    const limits = require("../../src/config/rwaLimits");
    expect(limits.MAX_PER_CYCLE_USD).toBe(10);
    expect(limits.MAX_PER_DAY_USD).toBe(100);
  });

  test("invalid env vars fall back to default", () => {
    process.env.RWA_MAX_PER_CYCLE_USD = "NaN-please";
    process.env.RWA_IDLE_PARKING_FRACTION = "";
    const limits = require("../../src/config/rwaLimits");
    expect(limits.MAX_PER_CYCLE_USD).toBe(5);
    expect(limits.IDLE_PARKING_FRACTION).toBe(0.2);
  });

  test("zero is a valid override (not falsy fallback)", () => {
    process.env.RWA_MIN_BALANCE_USD = "0";
    const limits = require("../../src/config/rwaLimits");
    expect(limits.MIN_BALANCE_USD).toBe(0);
  });

  test("low MIN_FLAT_MS via env enables faster smoke testing", () => {
    process.env.RWA_IDLE_PARKING_MIN_FLAT_MS = "60000";
    const limits = require("../../src/config/rwaLimits");
    expect(limits.IDLE_PARKING_MIN_FLAT_MS).toBe(60000);
  });
});
