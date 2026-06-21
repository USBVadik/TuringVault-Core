const {
  _private: { priceForPositionState },
} = require("../../src/orchestrator/signalEngine");

describe("signalEngine position price routing", () => {
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
