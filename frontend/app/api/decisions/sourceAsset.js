function normalizeDecisionAsset(value) {
  const asset = String(value || "").trim().toLowerCase();
  if (!asset || asset === "null" || asset === "none" || asset === "n/a") {
    return null;
  }

  if (asset.includes("meth")) return "mETH";
  if (asset === "weth" || asset === "eth") return "WETH";
  if (asset.includes("wmnt") || asset.includes("wrappedmnt")) return "WMNT";
  if (asset === "mnt" || asset.includes("mantle")) return "MNT";
  if (asset.includes("usdt0")) return "USDT0";
  if (asset === "usdt") return "USDT";
  if (asset.includes("musd")) return "mUSD";
  if (asset.includes("usdy")) return "USDY";
  return null;
}

function deriveOutcomeSourceAsset(row) {
  const legs = Array.isArray(row && row.directionalSwap && row.directionalSwap.legs)
    ? row.directionalSwap.legs
    : [];
  const firstLeg = legs.find((leg) => leg && (leg.from || leg.sourceAsset));

  const candidates = [
    row && row.sourceAsset,
    row && row.settlementSourceAsset,
    row && row.directionalSwap && row.directionalSwap.from,
    row && row.directionalSwap && row.directionalSwap.sourceAsset,
    firstLeg && firstLeg.from,
    firstLeg && firstLeg.sourceAsset,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeDecisionAsset(candidate);
    if (normalized) return normalized;
  }

  return null;
}

module.exports = {
  deriveOutcomeSourceAsset,
  normalizeDecisionAsset,
};
