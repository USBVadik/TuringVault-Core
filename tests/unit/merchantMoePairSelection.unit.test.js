const {
  rankPairCandidatesByNormalizedDepth,
} = require("../../src/dex/merchantMoe");

describe("MerchantMoeDEX pair selection", () => {
  test("ranks candidates by normalized two-sided depth instead of raw reserve sum", () => {
    const shallowRawHeavy = {
      pair: { LBPair: "0xshallow", binStep: 15 },
      reserveX: 1_000_000n, // 1 USDT with 6 decimals
      reserveY: 1_000n * 10n ** 18n, // 1000 WMNT with 18 decimals
      decimalsX: 6,
      decimalsY: 18,
    };
    const balancedDeep = {
      pair: { LBPair: "0xdeep", binStep: 25 },
      reserveX: 2_000_000_000n, // 2000 USDT
      reserveY: 900n * 10n ** 18n, // 900 WMNT
      decimalsX: 6,
      decimalsY: 18,
    };

    const ranked = rankPairCandidatesByNormalizedDepth([
      shallowRawHeavy,
      balancedDeep,
    ]);

    expect(ranked[0].pair.LBPair).toBe("0xdeep");
    expect(ranked[0].normalizedDepth).toBeGreaterThan(
      ranked[1].normalizedDepth
    );
  });
});
