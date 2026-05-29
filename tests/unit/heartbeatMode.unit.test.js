/**
 * Heartbeat Mode unit tests — pure-function tests for the gate decision
 * (`shouldFireHeartbeat`). No I/O, no clock drift, no on-chain calls.
 *
 * The function MUST honour every safety gate documented in
 * src/orchestrator/heartbeatMode.js. These tests are the contract.
 */

const {
  shouldFireHeartbeat,
  HEARTBEAT_TIER,
} = require("../../src/orchestrator/heartbeatMode");

const NOW = new Date("2026-05-29T12:00:00Z").getTime();
const HOUR_MS = 3600_000;

function quietCycles(n, override = {}) {
  return Array.from({ length: n }).map((_, i) => ({
    decisionId: 100 + i,
    tier: "BLOCKED_BY_REGIME",
    hasRealSwap: false,
    recordedAt: new Date(NOW - (n - i) * HOUR_MS).toISOString(),
    ...override,
  }));
}

function tradingCycle(decisionId, hoursAgo = 1) {
  return {
    decisionId,
    tier: "EXECUTED_SWAP",
    hasRealSwap: true,
    recordedAt: new Date(NOW - hoursAgo * HOUR_MS).toISOString(),
  };
}

function heartbeatCycle(decisionId, hoursAgo) {
  return {
    decisionId,
    tier: HEARTBEAT_TIER,
    // Heartbeats produce on-chain TXs but DON'T reset the quiet counter
    // (they're not alpha — this is the contract-level honesty rule).
    hasRealSwap: false,
    recordedAt: new Date(NOW - hoursAgo * HOUR_MS).toISOString(),
  };
}

const ENABLED_ENV = { HEARTBEAT_MODE_ENABLED: "true" };

describe("shouldFireHeartbeat — gating", () => {
  test("disabled by default (no env flag)", () => {
    const r = shouldFireHeartbeat({
      env: {},
      regime: "RANGING",
      recentCycles: quietCycles(10),
      balances: { WMNT: 10, USDT0: 10 },
      prices: { mntPriceUsd: 0.65 },
      now: NOW,
    });
    expect(r.fire).toBe(false);
    expect(r.reason).toMatch(/disabled/);
  });

  test("refuses to fire in CRISIS regime", () => {
    const r = shouldFireHeartbeat({
      env: ENABLED_ENV,
      regime: "CRISIS",
      recentCycles: quietCycles(10),
      balances: { WMNT: 10, USDT0: 10 },
      prices: { mntPriceUsd: 0.65 },
      now: NOW,
    });
    expect(r.fire).toBe(false);
    expect(r.reason).toMatch(/unsafe-regime/);
  });

  test("refuses to fire in TREND_DOWN regime", () => {
    const r = shouldFireHeartbeat({
      env: ENABLED_ENV,
      regime: "TREND_DOWN",
      recentCycles: quietCycles(10),
      balances: { WMNT: 10, USDT0: 10 },
      prices: { mntPriceUsd: 0.65 },
      now: NOW,
    });
    expect(r.fire).toBe(false);
    expect(r.reason).toMatch(/unsafe-regime/);
  });

  test("refuses if pipeline is active (real swap < threshold ago)", () => {
    const cycles = [
      ...quietCycles(2),
      tradingCycle(105, 0.5),
      ...quietCycles(3),
    ];
    const r = shouldFireHeartbeat({
      env: ENABLED_ENV,
      regime: "RANGING",
      recentCycles: cycles,
      balances: { WMNT: 10, USDT0: 10 },
      prices: { mntPriceUsd: 0.65 },
      now: NOW,
    });
    expect(r.fire).toBe(false);
    expect(r.reason).toMatch(/pipeline-active/);
  });

  test("respects 6h cooldown after a heartbeat", () => {
    const recent = [
      ...quietCycles(7),
      heartbeatCycle(108, 2), // 2 hours ago — too recent
    ];
    const r = shouldFireHeartbeat({
      env: ENABLED_ENV,
      regime: "RANGING",
      recentCycles: recent,
      balances: { WMNT: 10, USDT0: 10 },
      prices: { mntPriceUsd: 0.65 },
      now: NOW,
    });
    expect(r.fire).toBe(false);
    expect(r.reason).toMatch(/cooldown/);
  });

  test("daily cap enforced", () => {
    const recent = [
      heartbeatCycle(100, 23),
      heartbeatCycle(102, 17),
      heartbeatCycle(104, 11),
      heartbeatCycle(106, 5),
      ...quietCycles(7),
    ];
    const r = shouldFireHeartbeat({
      env: { ...ENABLED_ENV, HEARTBEAT_COOLDOWN_HOURS: "1" }, // disable cooldown for this test
      regime: "RANGING",
      recentCycles: recent,
      balances: { WMNT: 10, USDT0: 10 },
      prices: { mntPriceUsd: 0.65 },
      now: NOW,
    });
    expect(r.fire).toBe(false);
    expect(r.reason).toMatch(/daily-cap/);
  });

  test("refuses when portfolio is too thin", () => {
    const r = shouldFireHeartbeat({
      env: ENABLED_ENV,
      regime: "RANGING",
      recentCycles: quietCycles(10),
      balances: { WMNT: 0.1, USDT0: 0.1 }, // ~$0.16 total
      prices: { mntPriceUsd: 0.65 },
      now: NOW,
    });
    expect(r.fire).toBe(false);
    expect(r.reason).toMatch(/insufficient-portfolio/);
  });
});

describe("shouldFireHeartbeat — happy path", () => {
  test("fires after 6 quiet cycles, no prior heartbeat", () => {
    const r = shouldFireHeartbeat({
      env: ENABLED_ENV,
      regime: "RANGING",
      recentCycles: quietCycles(8),
      balances: { WMNT: 10, USDT0: 50 }, // ~$56 portfolio, USDT0-heavy
      prices: { mntPriceUsd: 0.65 },
      now: NOW,
    });
    expect(r.fire).toBe(true);
    expect(r.plan.tier).toBe(HEARTBEAT_TIER);
    expect(r.plan.amountUsd).toBeGreaterThan(0);
    expect(r.plan.amountUsd).toBeLessThanOrEqual(1.0);
    // USDT0-heavy → drift-correcting direction is risk-on (push to WMNT).
    expect(r.plan.direction).toBe("risk-on");
    expect(r.plan.from).toBe("USDT0");
    expect(r.plan.to).toBe("WMNT");
  });

  test("alternates direction when wallet is balanced", () => {
    const balancedBalances = { WMNT: 30, USDT0: 19.5 }; // ~$19.5 each side
    const recent = [...quietCycles(7), heartbeatCycle(100, 10)];
    const r1 = shouldFireHeartbeat({
      env: ENABLED_ENV,
      regime: "RANGING",
      recentCycles: recent,
      balances: balancedBalances,
      prices: { mntPriceUsd: 0.65 },
      directionLastUsed: "risk-on",
      now: NOW,
    });
    expect(r1.fire).toBe(true);
    expect(r1.plan.direction).toBe("risk-off");

    const r2 = shouldFireHeartbeat({
      env: ENABLED_ENV,
      regime: "RANGING",
      recentCycles: recent,
      balances: balancedBalances,
      prices: { mntPriceUsd: 0.65 },
      directionLastUsed: "risk-off",
      now: NOW,
    });
    expect(r2.fire).toBe(true);
    expect(r2.plan.direction).toBe("risk-on");
  });

  test("plan respects MAX_USD cap", () => {
    const r = shouldFireHeartbeat({
      env: { ...ENABLED_ENV, HEARTBEAT_MAX_USD: "1" },
      regime: "RANGING",
      recentCycles: quietCycles(8),
      balances: { WMNT: 10, USDT0: 10000 },
      prices: { mntPriceUsd: 0.65 },
      now: NOW,
    });
    expect(r.fire).toBe(true);
    expect(r.plan.amountUsd).toBeLessThanOrEqual(1);
  });

  test("rationale string is honest about what this is", () => {
    const r = shouldFireHeartbeat({
      env: ENABLED_ENV,
      regime: "RANGING",
      recentCycles: quietCycles(8),
      balances: { WMNT: 10, USDT0: 50 },
      prices: { mntPriceUsd: 0.65 },
      now: NOW,
    });
    expect(r.fire).toBe(true);
    expect(r.plan.rationale).toMatch(/Heartbeat/i);
    expect(r.plan.rationale).toMatch(/NOT alpha-seeking/i);
  });
});
