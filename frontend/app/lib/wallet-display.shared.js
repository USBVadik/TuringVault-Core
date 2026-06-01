function finitePositive(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function resolveHoldingPrice(symbol, perfData, marketData) {
  const sym = String(symbol || "");
  const direct = finitePositive(perfData && perfData.prices && perfData.prices[sym]);
  if (direct !== null) return direct;

  if (sym === "MNT" || sym === "WMNT") {
    return (
      finitePositive(perfData && perfData.mntPrice) ??
      finitePositive(marketData && marketData.mantlePrice)
    );
  }

  if (sym === "mETH") {
    return (
      finitePositive(perfData && perfData.ethPrice) ??
      finitePositive(marketData && marketData.mETHPrice) ??
      finitePositive(marketData && marketData.ethPrice)
    );
  }

  if (
    sym === "USDT_legacy" ||
    sym === "USDT0" ||
    sym === "mUSD" ||
    sym === "USDY"
  ) {
    return 1;
  }

  return null;
}

function formatUsdAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "price unavailable";
  if (n > 0 && n < 0.01) return "<$0.01";
  return `$${n.toFixed(2)}`;
}

function formatHoldingUsd(symbol, balance, perfData, marketData) {
  const bal = Number(balance);
  if (!Number.isFinite(bal)) return "—";
  const price = resolveHoldingPrice(symbol, perfData, marketData);
  if (price === null) return "price unavailable";
  return formatUsdAmount(bal * price);
}

function inferChannelAsset(strategyData) {
  const explicit =
    strategyData?.channel?.asset ||
    strategyData?.channelAsset ||
    strategyData?.baseAsset;
  if (explicit) return String(explicit);

  const support = Number(strategyData?.channel?.support);
  const resistance = Number(strategyData?.channel?.resistance);
  if (Number.isFinite(support) && Number.isFinite(resistance)) {
    return Math.max(support, resistance) < 10 ? "MNT" : "mETH";
  }

  return "asset";
}

function formatChannelPrice(price) {
  const n = Number(price);
  if (!Number.isFinite(n)) return "—";
  if (n < 10) return `$${n.toFixed(4)}`;
  return `$${n.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

function formatStrategyChannel(strategyData) {
  const asset = inferChannelAsset(strategyData);
  const support = strategyData?.channel?.support;
  const resistance = strategyData?.channel?.resistance;
  if (support == null || resistance == null) {
    return { label: `Grid Channel (${asset})`, value: "—" };
  }
  return {
    label: `Grid Channel (${asset})`,
    value: `${asset} ${formatChannelPrice(support)} – ${formatChannelPrice(
      resistance
    )}`,
  };
}

module.exports = {
  formatHoldingUsd,
  formatStrategyChannel,
  resolveHoldingPrice,
};
