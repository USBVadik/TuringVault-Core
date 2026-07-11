const {
  _private: {
    gridSignalForPosition,
    priceForPositionState,
    shouldEvaluateGridLifecycle,
  },
} = require("../../src/orchestrator/signalEngine");

describe("signalEngine position price routing", () => {
  test("keeps evaluating TP/SL outside RANGING while a position is open", () => {
    expect(
      shouldEvaluateGridLifecycle("TREND_DOWN", { status: "IN_mETH" })
    ).toBe(true);
    expect(shouldEvaluateGridLifecycle("HOLD", { status: "IN_MNT" })).toBe(
      true
    );
    expect(shouldEvaluateGridLifecycle("HOLD", { status: "FLAT" })).toBe(
      false
    );
  });

  test("uses the tracked asset grid instead of an unrelated primary grid", () => {
    const ethereum = { asset: "ethereum", action: "HOLD" };
    const mantle = { asset: "mantle", action: "SELL_mETH" };

    expect(
      gridSignalForPosition({
        positionState: { status: "IN_mETH" },
        multiAsset: { ethereum, mantle },
        primarySignal: mantle,
      })
    ).toBe(ethereum);
    expect(
      gridSignalForPosition({
        positionState: { status: "IN_MNT" },
        multiAsset: { ethereum, mantle },
        primarySignal: ethereum,
      })
    ).toBe(mantle);
  });

  test("uses MNT price for IN_MNT position state instead of ETH price", () => {
    expect(
      priceForPositionState({
        positionState: { status: "IN_MNT" },
        marketCtx: { ethPrice: 1836, mntPrice: 0.534 },
        multiAsset: {
          mantle: { channel: { currentPrice: 0.533 } },
          ethereum: { channel: { currentPrice: 1835 } },
        },
        fallbackPrice: 1836,
      })
    ).toBe(0.534);
  });

  test("uses ETH price for IN_mETH position state", () => {
    expect(
      priceForPositionState({
        positionState: { status: "IN_mETH" },
        marketCtx: { ethPrice: 1836, mntPrice: 0.534 },
        multiAsset: {
          mantle: { channel: { currentPrice: 0.533 } },
          ethereum: { channel: { currentPrice: 1835 } },
        },
        fallbackPrice: 0.534,
      })
    ).toBe(1836);
  });
});
