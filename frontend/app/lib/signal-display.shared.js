function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatSignalPrice(price) {
  const n = toNumber(price);
  if (n <= 0) return "price sync";
  const digits = n >= 100 ? 0 : 2;
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function isEthLikeAsset(value) {
  const asset = String(value || "").toLowerCase();
  if (!asset) return false;
  return (
    asset.includes("meth") ||
    asset.includes("weth") ||
    (asset.includes("eth") && !asset.includes("mnt"))
  );
}

function isMntLikeAsset(value) {
  const asset = String(value || "").toLowerCase();
  if (!asset) return false;
  return asset.includes("wmnt") || asset === "mnt" || asset.includes("mantle");
}

function inferBaseAsset({ latestDecision, targetAsset, sourceAsset } = {}) {
  const target = targetAsset || (latestDecision && latestDecision.targetAsset);
  const source = sourceAsset || (latestDecision && latestDecision.sourceAsset);

  if (isMntLikeAsset(target) || isMntLikeAsset(source)) return "MNT";
  if (isEthLikeAsset(target) || isEthLikeAsset(source)) return "mETH";
  return "mETH";
}

function pickMethReferencePrice({ perfData, marketData, fallbackEthPrice }) {
  const perfMeth = toNumber(perfData && perfData.prices && perfData.prices.mETH);
  if (perfMeth > 0) return perfMeth;
  const marketEth = toNumber(marketData && marketData.ethPrice);
  if (marketEth > 0) return marketEth;
  return toNumber(fallbackEthPrice);
}

function pickMntReferencePrice({
  perfData,
  marketData,
  strategyPrice,
  fallbackMntPrice,
}) {
  const perfMnt = toNumber(perfData && perfData.prices && perfData.prices.MNT);
  if (perfMnt > 0) return perfMnt;
  const perfWmnt = toNumber(perfData && perfData.prices && perfData.prices.WMNT);
  if (perfWmnt > 0) return perfWmnt;
  const marketMnt = toNumber(marketData && marketData.mantlePrice);
  if (marketMnt > 0) return marketMnt;
  if (strategyPrice > 0) return strategyPrice;
  return toNumber(fallbackMntPrice);
}

function fallbackMarkerLeft(signalMode) {
  if (signalMode === "risk-on") return 24;
  if (signalMode === "risk-off") return 82;
  return 54;
}

function deriveSignalDisplay({
  latestDecision,
  targetAsset,
  sourceAsset,
  strategyData,
  marketData,
  perfData,
  signalMode,
  fallbackEthPrice = 0,
  fallbackMntPrice = 0,
  baseAsset,
} = {}) {
  const resolvedBaseAsset =
    baseAsset || inferBaseAsset({ latestDecision, targetAsset, sourceAsset });
  const channel = (strategyData && strategyData.channel) || {};
  const support = toNumber(channel.support);
  const resistance = toNumber(channel.resistance);
  const current = toNumber(
    (strategyData && strategyData.currentPrice) || channel.currentPrice
  );
  const channelAsset =
    channel.asset ||
    (strategyData && strategyData.channelAsset) ||
    (strategyData && strategyData.asset) ||
    (strategyData && strategyData.symbol) ||
    "";
  const explicitChannelAsset = String(channelAsset || "").trim();
  const channelLooksEth = isEthLikeAsset(channelAsset);
  const channelLooksMnt =
    isMntLikeAsset(channelAsset) ||
    (resolvedBaseAsset === "MNT" && !explicitChannelAsset);
  const channelLooksPrimary =
    resolvedBaseAsset === "MNT" ? channelLooksMnt : channelLooksEth;
  const hasPrimaryChannel =
    channelLooksPrimary && resistance > support && support > 0 && current > 0;
  const channelPosition = hasPrimaryChannel
    ? (current - support) / (resistance - support)
    : null;
  const markerLeft =
    channelPosition != null
      ? clamp(8 + channelPosition * 84, 8, 92)
      : fallbackMarkerLeft(signalMode);
  const referencePrice = hasPrimaryChannel
    ? current
    : resolvedBaseAsset === "MNT"
      ? pickMntReferencePrice({
          perfData,
          marketData,
          strategyPrice: current,
          fallbackMntPrice,
        })
      : pickMethReferencePrice({ perfData, marketData, fallbackEthPrice });
  const displayAsset = resolvedBaseAsset === "MNT" ? "MNT" : "mETH";

  return {
    baseAsset: resolvedBaseAsset,
    displayAsset,
    gridLabel: `${displayAsset} flip grid`,
    axisLeft: displayAsset,
    axisRight: "mUSD",
    channelLooksEth,
    channelLooksMnt,
    channelLooksPrimary,
    referenceLabel: hasPrimaryChannel
      ? "Channel cursor"
      : `${displayAsset} ref price`,
    referencePrice,
    referencePriceLabel: formatSignalPrice(referencePrice),
    markerLeft,
    support,
    resistance,
    priceAtChannelPct(pct) {
      if (!hasPrimaryChannel) return null;
      return support + (resistance - support) * (clamp(pct, 0, 100) / 100);
    },
  };
}

function deriveMethSignalDisplay(input = {}) {
  return deriveSignalDisplay({ ...input, baseAsset: "mETH" });
}

module.exports = {
  deriveSignalDisplay,
  deriveMethSignalDisplay,
  formatSignalPrice,
};
