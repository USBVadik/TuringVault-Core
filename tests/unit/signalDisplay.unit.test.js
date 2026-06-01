const {
  deriveMethSignalDisplay,
} = require("../../frontend/app/lib/signal-display.shared.js");

describe("mETH signal display data binding", () => {
  test("does not use MNT strategy channel price for the mETH hero", () => {
    const display = deriveMethSignalDisplay({
      strategyData: {
        currentPrice: 0.65,
        channel: { support: 0.61, resistance: 0.7 },
      },
      marketData: { ethPrice: 1974.39 },
      perfData: { prices: { mETH: 1981.12 } },
      signalMode: "blocked",
    });

    expect(display.channelLooksEth).toBe(false);
    expect(display.referenceLabel).toBe("mETH ref price");
    expect(display.referencePrice).toBe(1981.12);
    expect(display.referencePriceLabel).toBe("$1,981");
    expect(display.markerLeft).toBe(54);
    expect(display.priceAtChannelPct(42)).toBe(null);
  });

  test("uses channel math only when the strategy channel is explicitly ETH-like", () => {
    const display = deriveMethSignalDisplay({
      strategyData: {
        currentPrice: 2000,
        channelAsset: "mETH",
        channel: { support: 1900, resistance: 2100 },
      },
      marketData: { ethPrice: 1974.39 },
      perfData: { prices: { mETH: 1981.12 } },
      signalMode: "risk-on",
    });

    expect(display.channelLooksEth).toBe(true);
    expect(display.referenceLabel).toBe("Channel cursor");
    expect(display.referencePrice).toBe(2000);
    expect(display.referencePriceLabel).toBe("$2,000");
    expect(display.markerLeft).toBe(50);
    expect(display.priceAtChannelPct(50)).toBe(2000);
  });
});
