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

function pickMethReferencePrice({ perfData, marketData, fallbackEthPrice }) {
  const perfMeth = toNumber(perfData && perfData.prices && perfData.prices.mETH);
  if (perfMeth > 0) return perfMeth;
  const marketEth = toNumber(marketData && marketData.ethPrice);
  if (marketEth > 0) return marketEth;
  return toNumber(fallbackEthPrice);
}

function fallbackMarkerLeft(signalMode) {
  if (signalMode === "risk-on") return 24;
  if (signalMode === "risk-off") return 82;
  return 54;
}

function deriveMethSignalDisplay({
  strategyData,
  marketData,
  perfData,
  signalMode,
  fallbackEthPrice = 0,
} = {}) {
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
  const channelLooksEth = isEthLikeAsset(channelAsset);
  const hasEthChannel =
    channelLooksEth && resistance > support && support > 0 && current > 0;
  const channelPosition = hasEthChannel
    ? (current - support) / (resistance - support)
    : null;
  const markerLeft =
    channelPosition != null
      ? clamp(8 + channelPosition * 84, 8, 92)
      : fallbackMarkerLeft(signalMode);
  const referencePrice = hasEthChannel
    ? current
    : pickMethReferencePrice({ perfData, marketData, fallbackEthPrice });

  return {
    channelLooksEth,
    referenceLabel: hasEthChannel ? "Channel cursor" : "mETH ref price",
    referencePrice,
    referencePriceLabel: formatSignalPrice(referencePrice),
    markerLeft,
    support,
    resistance,
    priceAtChannelPct(pct) {
      if (!hasEthChannel) return null;
      return support + (resistance - support) * (clamp(pct, 0, 100) / 100);
    },
  };
}

module.exports = {
  deriveMethSignalDisplay,
  formatSignalPrice,
};
