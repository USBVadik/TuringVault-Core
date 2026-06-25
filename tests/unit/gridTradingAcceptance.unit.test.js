/**
 * Acceptance suite for the post-35ffc9d trading audit.
 *
 * These lock in the five behaviors the audit required to be preserved:
 *   1. a valid lower-band BUY passes,
 *   2. an upper-band SELL passes,
 *   3. a sub-$10 micro-swap is blocked,
 *   4. a stop-loss exit inside RANGING without emergency is blocked,
 *   5. an emergency TREND_DOWN / CRISIS exit still passes.
 *
 * Root cause of the "no trades" window was NOT the guard/sizing (proven
 * here) but a route-preflight failure (leg2 USDT->WMNT not viable). See
 * routePreflight tests for that path.
 */
const { assessTradeInventory } = require("../../src/orchestrator/portfolioGuard");
const {
  _private: { calculateDirectionalSwapSizing },
} = require("../../src/orchestrator/multiAgentLoop");

const PRICES = {
  MNT: 0.65,
  WMNT: 0.65,
  mETH: 1800,
  ETH: 1800,
  USDT0: 1,
  USDT: 1,
  mUSD: 1,
};

describe("grid trading acceptance (audit 35ffc9d follow-up)", () => {
  test("#1 valid lower-band BUY from a flat stable-heavy wallet is allowed", () => {
    const result = assessTradeInventory({
      direction: "risk-on",
      targetAsset: "WMNT",
      sourceAsset: "USDT0",
      balances: { MNT: 20, WMNT: 0.1, mETH: 0, USDT0: 80, USDT: 0, mUSD: 0 },
      prices: PRICES,
      regime: "RANGING",
      positionState: { status: "FLAT" },
      structuredSignals: {
        signals: {
          ranging: {
            multiAsset: {
              mantle: {
                action: "BUY",
                confidence: 0.7,
                channel: { currentPrice: 0.63, channelPosition: 0.06 },
              },
            },
          },
        },
      },
    });
    expect(result.allowed).toBe(true);
    expect(result.direction).toBe("risk-on");
    expect(result.reason).toMatch(/stable inventory available/i);
  });

  test("#2 upper-band grid SELL of a tracked position above fee-buffered entry is allowed", () => {
    const result = assessTradeInventory({
      direction: "risk-off",
      targetAsset: "mUSD",
      sourceAsset: "WMNT",
      balances: { MNT: 20, WMNT: 23, mETH: 0.007, USDT0: 78, USDT: 0, mUSD: 0 },
      prices: { ...PRICES, MNT: 0.534, WMNT: 0.534 },
      regime: "RANGING",
      positionState: {
        status: "IN_MNT",
        entryPrice: 0.527127,
        targetExit: 0.55,
        stopLoss: 0.52,
      },
      structuredSignals: {
        signals: {
          ranging: {
            multiAsset: {
              mantle: { channel: { currentPrice: 0.534, channelPosition: 0.92 } },
            },
          },
        },
      },
      gridTradeCandidate: {
        active: true,
        kind: "grid-sell",
        asset: "mantle",
        sourceAsset: "WMNT",
      },
    });
    expect(result.allowed).toBe(true);
    expect(result.reason).toMatch(/grid trim/i);
  });

  test("#3 a sub-$10 micro-swap is blocked by the economic floor", () => {
    const sizing = calculateDirectionalSwapSizing({
      sourceToken: "USDT0",
      sourceBalance: 5,
      allocationPct: 100,
      market: { ethPrice: 1800, mntPrice: 0.65 },
    });
    expect(sizing.minTradeUsd).toBe(10);
    expect(sizing.canExecute).toBe(false);
  });

  test("#4 a tracked stop-loss exit is blocked while top-level regime is RANGING with no emergency", () => {
    const result = assessTradeInventory({
      direction: "risk-off",
      targetAsset: "mUSD",
      sourceAsset: "mETH",
      balances: { MNT: 24, WMNT: 36, mETH: 0.0118, USDT0: 72, USDT: 0, mUSD: 0 },
      prices: { ...PRICES, MNT: 0.52, WMNT: 0.52, mETH: 1692.3 },
      regime: "RANGING",
      positionState: {
        status: "IN_mETH",
        entryPrice: 1729.83,
        targetExit: 1769.38,
        stopLoss: 1722.8,
      },
      structuredSignals: {
        signals: {
          onChainFlow: { signal: "NEUTRAL", netUsd: 0 },
          ranging: {
            multiAsset: {
              ethereum: {
                breakoutDirection: "DOWN",
                regimeHint: "TREND_DOWN",
                channel: { currentPrice: 1692.3, channelPosition: 0 },
              },
            },
          },
        },
      },
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/stop-loss/i);
    expect(result.reason).toMatch(/ranging/i);
  });

  test("#5a emergency TREND_DOWN exit below entry is allowed", () => {
    const result = assessTradeInventory({
      direction: "risk-off",
      targetAsset: "mUSD",
      balances: { MNT: 20, WMNT: 12, mETH: 0, USDT0: 90, USDT: 0, mUSD: 0 },
      prices: { ...PRICES, MNT: 0.615, WMNT: 0.615 },
      regime: "TREND_DOWN",
      positionState: {
        status: "IN_MNT",
        entryPrice: 0.67,
        targetExit: 0.7,
        stopLoss: 0.62,
      },
    });
    expect(result.allowed).toBe(true);
    expect(result.reason).toMatch(/stop-loss|emergency/i);
  });

  test("#5b emergency CRISIS exit is allowed even without a stop-loss touch", () => {
    const result = assessTradeInventory({
      direction: "risk-off",
      targetAsset: "mUSD",
      balances: { MNT: 20, WMNT: 12, mETH: 0, USDT0: 90, USDT: 0, mUSD: 0 },
      prices: { ...PRICES, MNT: 0.66, WMNT: 0.66 },
      regime: "CRISIS",
      positionState: {
        status: "IN_MNT",
        entryPrice: 0.67,
        targetExit: 0.7,
        stopLoss: 0.62,
      },
    });
    expect(result.allowed).toBe(true);
    expect(result.reason).toMatch(/emergency/i);
  });
});
