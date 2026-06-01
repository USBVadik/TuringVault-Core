const {
  formatHoldingUsd,
  formatStrategyChannel,
  resolveHoldingPrice,
} = require("../../frontend/app/lib/wallet-display.shared.js");

describe("dashboard wallet display helpers", () => {
  test("prices native, wrapped, and staking balances when token prices exist as aliases", () => {
    const perfData = {
      prices: {
        MNT: null,
        WMNT: null,
        mETH: null,
      },
      mntPrice: 0.644545,
      ethPrice: 2159.64,
    };
    const marketData = { mantlePrice: 0.65, ethPrice: 2160 };

    expect(resolveHoldingPrice("MNT", perfData, marketData)).toBe(0.644545);
    expect(resolveHoldingPrice("WMNT", perfData, marketData)).toBe(0.644545);
    expect(resolveHoldingPrice("mETH", perfData, marketData)).toBe(2159.64);
    expect(formatHoldingUsd("mETH", 0.011938, perfData, marketData)).toBe(
      "$25.78"
    );
  });

  test("formats grid channel with an explicit ticker", () => {
    expect(
      formatStrategyChannel({
        channelAsset: "MNT",
        channel: { support: 0.6476, resistance: 0.6833 },
      })
    ).toEqual({
      label: "Grid Channel (MNT)",
      value: "MNT $0.6476 – $0.6833",
    });
  });
});
