const MIN_EDGE_SCORE = 0.72;
const MAX_CONTRARIAN_ALLOCATION_PCT = 6;
const MIN_CONTRARIAN_ALLOCATION_PCT = 3;
const LOWER_BAND_CONTRARIAN_MAX = 0.08;
const TARGET_RISK_SHARE = 0.5;
const DEFAULT_GAMMA = 0.8;

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function upper(v) {
  return String(v || "").toUpperCase();
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function isFlat(positionState = {}) {
  return !positionState?.status || upper(positionState.status) === "FLAT";
}

function channelPosition(signal = {}) {
  const direct = signal.channel?.channelPosition;
  if (Number.isFinite(Number(direct))) return Number(direct);
  return null;
}

function isConfirmedDownBreak(signal = {}) {
  return (
    upper(signal.breakoutDirection) === "DOWN" ||
    upper(signal.regimeHint) === "TREND_DOWN"
  );
}

function riskTargetForAsset(asset) {
  return asset === "mantle" ? "MNT" : "mETH";
}

function sourceForTarget() {
  return "USDT0";
}

function volatilityPctFromSignal(signal = {}) {
  const explicit = num(signal.channel?.channelWidthPct, 0);
  if (explicit > 0) return explicit > 1 ? explicit / 100 : explicit;

  const support = num(signal.channel?.support, 0);
  const resistance = num(signal.channel?.resistance, 0);
  const mid = support > 0 && resistance > support ? (support + resistance) / 2 : 0;
  if (mid > 0) return (resistance - support) / mid;
  return 0.04;
}

function midPriceFromSignal(signal = {}) {
  const support = num(signal.channel?.support, 0);
  const resistance = num(signal.channel?.resistance, 0);
  if (support > 0 && resistance > support) return (support + resistance) / 2;
  return num(signal.channel?.currentPrice, 0);
}

function buildInventoryAwareQuote({
  signal = {},
  portfolioSummary = {},
  gamma = DEFAULT_GAMMA,
  targetRiskShare = TARGET_RISK_SHARE,
} = {}) {
  const currentPrice = num(signal.channel?.currentPrice, 0);
  const midPrice = midPriceFromSignal(signal) || currentPrice;
  const sigma = clamp(volatilityPctFromSignal(signal), 0.006, 0.25);
  const currentRiskShare = clamp(num(portfolioSummary.riskShare, 0), 0, 1);
  const inventorySkew = currentRiskShare - targetRiskShare;

  // Avellaneda-Stoikov inspired inventory skew. We adapt the reservation
  // price to slow cron/DEX execution by scaling with percentage volatility.
  // Stable-heavy inventory (negative skew) raises the reservation bid;
  // risk-heavy inventory lowers it and makes sells easier.
  const reservationPrice =
    midPrice * (1 - inventorySkew * gamma * sigma);
  const spread = midPrice * clamp(sigma * 0.35, 0.006, 0.04);

  return {
    currentPrice,
    midPrice,
    sigma,
    currentRiskShare,
    targetRiskShare,
    inventorySkew,
    reservationPrice,
    buyTrigger: reservationPrice - spread / 2,
    sellTrigger: reservationPrice + spread / 2,
    spread,
  };
}

function scoreExternalEdge({ structuredSignals = {}, signal = {}, portfolioSummary = {} } = {}) {
  const signals = structuredSignals.signals || {};
  const funding = signals.funding || {};
  const flow = signals.onChainFlow || {};
  const fearGreed = signals.fearGreed || structuredSignals.fearGreed || {};
  const yieldSpread = signals.yieldSpread || {};
  const pos = channelPosition(signal);

  if (isConfirmedDownBreak(signal)) {
    return {
      score: 0,
      hardBlock: "confirmed down-break",
      components: {},
    };
  }

  if (upper(flow.signal) === "BEARISH" && num(flow.netUsd ?? flow.netFlowUsd, 0) <= -1_000_000) {
    return {
      score: 0,
      hardBlock: "strong smart-money outflow",
      components: {},
    };
  }

  const fundingStrength =
    upper(funding.signal) === "BULLISH" ? clamp(num(funding.strength, 0), 0, 1) : 0;
  const rsi = num(funding.rsi ?? signals.technical?.rsi, 50);
  const fear = num(fearGreed.value ?? fearGreed.score, 50);
  const stableShare = clamp(num(portfolioSummary.stableShare, 0), 0, 1);

  const components = {
    lowerBand:
      pos != null && pos <= LOWER_BAND_CONTRARIAN_MAX
        ? 0.25 * (1 - pos / LOWER_BAND_CONTRARIAN_MAX)
        : 0,
    funding: 0.35 * fundingStrength + (num(funding.value, 0) <= -20 ? 0.1 : 0),
    rsi: rsi <= 25 ? 0.3 : rsi <= 30 ? 0.22 : 0,
    fear: fear <= 10 ? 0.2 : fear <= 15 ? 0.15 : 0,
    inventory: stableShare >= 0.8 ? clamp((stableShare - 0.8) * 0.8, 0.04, 0.15) : 0,
    flow: upper(flow.signal) === "BULLISH" ? 0.08 : 0,
    yieldPenalty: upper(yieldSpread.signal) === "BEARISH" ? -0.06 : 0,
  };

  const score = clamp(
    Object.values(components).reduce((sum, v) => sum + v, 0),
    0,
    1
  );

  return {
    score,
    hardBlock: null,
    components,
  };
}

function buildInventoryAwareGridCandidate({
  structuredSignals = {},
  portfolioSummary = {},
  positionState = {},
  gridSignals = [],
} = {}) {
  const regime = upper(structuredSignals.regime?.regime);
  if (!portfolioSummary.stableHeavy || !isFlat(positionState)) {
    return { active: false, reason: "inventory-aware grid requires stable-heavy FLAT posture" };
  }
  if (regime === "CRISIS") {
    return { active: false, reason: "inventory-aware contrarian buy blocked in CRISIS" };
  }

  const lowerBand = gridSignals
    .map(({ asset, signal }) => ({
      asset,
      signal,
      pos: channelPosition(signal),
      confidence: num(signal?.confidence, 0),
    }))
    .filter(({ pos }) => pos != null && pos <= LOWER_BAND_CONTRARIAN_MAX)
    .sort((a, b) => a.pos - b.pos || b.confidence - a.confidence)[0];

  if (!lowerBand) {
    return { active: false, reason: "no inventory-aware lower-band edge" };
  }

  const edge = scoreExternalEdge({
    structuredSignals,
    signal: lowerBand.signal,
    portfolioSummary,
  });
  if (edge.hardBlock) {
    return { active: false, reason: `inventory-aware risk-on blocked by ${edge.hardBlock}` };
  }
  if (edge.score < MIN_EDGE_SCORE) {
    return {
      active: false,
      reason: `inventory-aware edge score ${edge.score.toFixed(2)} below ${MIN_EDGE_SCORE}`,
      edge,
    };
  }

  const quote = buildInventoryAwareQuote({
    signal: lowerBand.signal,
    portfolioSummary,
  });
  if (!quote.currentPrice || quote.currentPrice > quote.buyTrigger) {
    return {
      active: false,
      reason: "price is not below inventory-aware reservation bid",
      edge,
      quote,
    };
  }

  const allocationPct = clamp(
    Math.round(edge.score * MAX_CONTRARIAN_ALLOCATION_PCT),
    MIN_CONTRARIAN_ALLOCATION_PCT,
    MAX_CONTRARIAN_ALLOCATION_PCT
  );
  const targetAsset = riskTargetForAsset(lowerBand.asset);

  return {
    active: true,
    kind: "inventory-aware-contrarian-buy",
    asset: lowerBand.asset,
    targetAsset,
    sourceAsset: sourceForTarget(targetAsset),
    allocationPct,
    confidence: clamp(0.56 + edge.score * 0.14, 0.56, 0.72),
    signal: lowerBand.signal,
    edge,
    quote,
    reasoning:
      `${lowerBand.asset.toUpperCase()} inventory-aware reservation bid fired: ` +
      `price ${quote.currentPrice.toFixed(6)} <= buy trigger ${quote.buyTrigger.toFixed(6)}; ` +
      `stable-heavy wallet is under target risk and capitulation edge score is ${edge.score.toFixed(2)}.`,
    riskFactors: [
      "Counter-trend micro-entry can be wrong if breakdown accelerates",
      "Validator must reject if Nansen flow turns strongly bearish",
      "Size is capped by inventory-aware contrarian allocation",
    ],
  };
}

module.exports = {
  buildInventoryAwareGridCandidate,
  buildInventoryAwareQuote,
  scoreExternalEdge,
  MIN_EDGE_SCORE,
  MAX_CONTRARIAN_ALLOCATION_PCT,
};
