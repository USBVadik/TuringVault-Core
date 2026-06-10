const {
  formatHeldPosition,
  formatHoldingUsd,
  formatPositionGuardrail,
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

  test("keeps MNT grid context separate from a held mETH position", () => {
    const strategy = {
      channelAsset: "MNT",
      channel: { asset: "MNT", support: 0.531, resistance: 0.5506 },
      heldPosition: {
        asset: "mETH",
        entry: "$1,651.90",
        tp: "$1,677.43",
        sl: "$1,622.09",
        riskReward: "0.9",
        allocationPct: 25,
        sameAssetAsActiveGrid: false,
      },
    };

    expect(formatStrategyChannel(strategy)).toEqual({
      label: "Grid Channel (MNT)",
      value: "MNT $0.5310 – $0.5506",
    });
    expect(formatHeldPosition(strategy)).toEqual({
      label: "Held Position (mETH)",
      value: "mETH $1,651.90 · 25% target",
      tone: "held",
    });
    expect(formatPositionGuardrail(strategy)).toEqual({
      label: "mETH Guardrail",
      value: "$1,677.43 / $1,622.09 · held R:R 0.9:1",
      tone: "held",
    });
  });

  test("keeps active-grid wording when the position and channel match", () => {
    const strategy = {
      channelAsset: "MNT",
      channel: { asset: "MNT", support: 0.531, resistance: 0.5506 },
      heldPosition: {
        asset: "MNT",
        entry: "$0.54",
        tp: "$0.55",
        sl: "$0.53",
        riskReward: "1.8",
        sameAssetAsActiveGrid: true,
      },
    };

    expect(formatHeldPosition(strategy).label).toBe("Active Position (MNT)");
    expect(formatPositionGuardrail(strategy)).toEqual({
      label: "TP / SL",
      value: "$0.55 / $0.53 · held R:R 1.8:1",
      tone: "active",
    });
  });
});
