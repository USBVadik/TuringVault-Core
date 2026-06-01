const {
  deriveOutcomeSourceAsset,
  normalizeDecisionAsset,
} = require("../../frontend/app/api/decisions/sourceAsset.js");

describe("decision API source asset derivation", () => {
  test("normalizes known Mantle and ETH source assets", () => {
    expect(normalizeDecisionAsset("WMNT")).toBe("WMNT");
    expect(normalizeDecisionAsset("Mantle")).toBe("MNT");
    expect(normalizeDecisionAsset("mETH")).toBe("mETH");
    expect(normalizeDecisionAsset("ETH")).toBe("WETH");
  });

  test("uses explicit settlement source before swap fallbacks", () => {
    expect(
      deriveOutcomeSourceAsset({
        sourceAsset: "mETH",
        settlementSourceAsset: "WMNT",
        directionalSwap: { from: "WMNT" },
      })
    ).toBe("mETH");
  });

  test("falls back to directional swap from asset for stable-bound sells", () => {
    expect(
      deriveOutcomeSourceAsset({
        targetAsset: "mUSD",
        directionalSwap: { from: "WMNT", to: "USDT0", direction: "risk-off" },
      })
    ).toBe("WMNT");
  });

  test("does not treat RWA source labels as token assets", () => {
    expect(
      deriveOutcomeSourceAsset({
        rwaIntent: { source: "Ondo Finance" },
      })
    ).toBe(null);
  });
});
