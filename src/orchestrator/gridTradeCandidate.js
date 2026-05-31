const MIN_CANDIDATE_CONFIDENCE = 0.55;
const LOWER_BAND_MAX = 0.2;
const UPPER_BAND_MIN = 0.8;
const STABLE_REENTRY_ALLOCATION_PCT = 12;
const GRID_BUY_ALLOCATION_PCT = 15;
const GRID_SELL_ALLOCATION_PCT = 20;

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function upper(v) {
  return String(v || "").toUpperCase();
}

function isFlat(positionState = {}) {
  return !positionState?.status || upper(positionState.status) === "FLAT";
}

function isConfirmedDownBreak(signal = {}) {
  return (
    upper(signal.breakoutDirection) === "DOWN" ||
    upper(signal.regimeHint) === "TREND_DOWN"
  );
}

function isConfirmedUpBreak(signal = {}) {
  return (
    upper(signal.breakoutDirection) === "UP" ||
    upper(signal.regimeHint) === "TREND_UP"
  );
}

function channelPosition(signal = {}) {
  const direct = signal.channel?.channelPosition;
  if (Number.isFinite(Number(direct))) return Number(direct);

  const support = Number(signal.channel?.support);
  const resistance = Number(signal.channel?.resistance);
  const current = Number(signal.channel?.currentPrice);
  if (
    Number.isFinite(support) &&
    Number.isFinite(resistance) &&
    Number.isFinite(current) &&
    resistance > support
  ) {
    return Math.max(0, Math.min(1, (current - support) / (resistance - support)));
  }
  return null;
}

function collectGridSignals(ranging = {}) {
  const multi = ranging.multiAsset || {};
  const out = [];
  if (multi.ethereum) out.push({ asset: "ethereum", signal: multi.ethereum });
  if (multi.mantle) out.push({ asset: "mantle", signal: multi.mantle });
  if (out.length === 0 && ranging.action) {
    out.push({ asset: "ethereum", signal: ranging });
  }
  return out;
}

function riskTargetForAsset(asset) {
  return asset === "mantle" ? "MNT" : "mETH";
}

function riskSourceForTarget(targetAsset) {
  return targetAsset === "mETH" ? "USDT0" : "USDT0";
}

function routeForTarget(targetAsset) {
  return targetAsset === "mETH"
    ? ["USDT0", "USDT", "WMNT", "mETH"]
    : ["USDT0", "USDT", "WMNT"];
}

function compactSignal(signal = {}) {
  return {
    action: signal.action || null,
    confidence: num(signal.confidence, 0),
    breakoutDirection: signal.breakoutDirection || null,
    regimeHint: signal.regimeHint || null,
    channelPosition: channelPosition(signal),
    support: signal.channel?.support ?? null,
    resistance: signal.channel?.resistance ?? null,
    currentPrice: signal.channel?.currentPrice ?? null,
  };
}

function activeCandidate({
  kind,
  asset,
  targetAsset,
  sourceAsset,
  allocationPct,
  confidence,
  reasoning,
  riskFactors = [],
  signal,
}) {
  return {
    active: true,
    kind,
    asset,
    action: "swap",
    direction: targetAsset === "mUSD" ? "risk_off" : "risk_on",
    targetAsset,
    sourceAsset,
    allocationPct,
    confidence: Math.max(MIN_CANDIDATE_CONFIDENCE, num(confidence, 0.56)),
    reasoning,
    riskFactors,
    routeHint: targetAsset === "mUSD" ? null : routeForTarget(targetAsset),
    gridSignal: compactSignal(signal),
  };
}

function inactive(reason, extra = {}) {
  return { active: false, reason, ...extra };
}

function hasStrongRiskOnBlock(structuredSignals = {}, signal = {}) {
  const flow = structuredSignals.signals?.onChainFlow || {};
  const netUsd = num(flow.netUsd, 0);
  if (upper(flow.signal) === "BEARISH" && netUsd <= -1_000_000) {
    return "strong smart-money outflow";
  }
  if (isConfirmedDownBreak(signal)) {
    return "confirmed down-break";
  }
  return null;
}

function buildGridTradeCandidate({
  structuredSignals = {},
  portfolioSummary = {},
  positionState = {},
} = {}) {
  const regime = upper(structuredSignals.regime?.regime);
  const ranging = structuredSignals.signals?.ranging || {};
  const signals = collectGridSignals(ranging);

  if (!["RANGING", "CONTRARIAN_LONG", "TREND_UP"].includes(regime)) {
    return inactive(`regime ${regime || "UNKNOWN"} does not allow grid risk-on`);
  }

  if (!portfolioSummary.stableHeavy || !isFlat(positionState)) {
    return inactive("not stable-heavy FLAT inventory");
  }

  const directBuy = signals
    .map(({ asset, signal }) => ({
      asset,
      signal,
      pos: channelPosition(signal),
      confidence: num(signal.confidence, 0),
    }))
    .filter(({ signal }) => upper(signal.action) === "BUY_METH")
    .filter(({ signal }) => !hasStrongRiskOnBlock(structuredSignals, signal))
    .sort((a, b) => b.confidence - a.confidence)[0];

  if (directBuy) {
    const targetAsset = riskTargetForAsset(directBuy.asset);
    return activeCandidate({
      kind: "grid-buy",
      asset: directBuy.asset,
      targetAsset,
      sourceAsset: riskSourceForTarget(targetAsset),
      allocationPct: GRID_BUY_ALLOCATION_PCT,
      confidence: directBuy.confidence,
      signal: directBuy.signal,
      reasoning: `${directBuy.asset.toUpperCase()} grid emitted BUY_mETH with ${(directBuy.confidence * 100).toFixed(0)}% confidence; stable-heavy FLAT wallet has deployable stables.`,
      riskFactors: [
        "False lower-band break could continue lower",
        "Validator must reject if funding/flow contradict the grid edge",
      ],
    });
  }

  const lowerBand = signals
    .map(({ asset, signal }) => ({
      asset,
      signal,
      pos: channelPosition(signal),
      confidence: num(signal.confidence, 0.56),
    }))
    .filter(({ pos }) => pos != null && pos <= LOWER_BAND_MAX)
    .filter(({ signal }) => !hasStrongRiskOnBlock(structuredSignals, signal))
    .sort((a, b) => a.pos - b.pos)[0];

  if (lowerBand) {
    const targetAsset = riskTargetForAsset(lowerBand.asset);
    return activeCandidate({
      kind: "stable-heavy-lower-band-reentry",
      asset: lowerBand.asset,
      targetAsset,
      sourceAsset: riskSourceForTarget(targetAsset),
      allocationPct: STABLE_REENTRY_ALLOCATION_PCT,
      confidence: Math.min(0.64, Math.max(0.56, lowerBand.confidence)),
      signal: lowerBand.signal,
      reasoning: `${lowerBand.asset.toUpperCase()} lower-band re-entry: price is at ${(lowerBand.pos * 100).toFixed(0)}% of channel while wallet is stable-heavy and FLAT; no confirmed down-break, so validate a small buy-low probe.`,
      riskFactors: [
        "Confirmed downward breakout invalidates mean reversion",
        "Keep size small because consensus may still be bearish",
      ],
    });
  }

  const blockedLowerBand = signals
    .map(({ asset, signal }) => ({
      asset,
      signal,
      pos: channelPosition(signal),
      block: hasStrongRiskOnBlock(structuredSignals, signal),
    }))
    .find(({ pos, block }) => pos != null && pos <= LOWER_BAND_MAX && block);

  if (blockedLowerBand) {
    return inactive(`lower-band risk-on blocked by ${blockedLowerBand.block}`);
  }

  const directSell = signals
    .map(({ asset, signal }) => ({
      asset,
      signal,
      pos: channelPosition(signal),
      confidence: num(signal.confidence, 0),
    }))
    .filter(({ signal, pos }) => {
      if (upper(signal.action) === "SELL_METH") return true;
      return isConfirmedUpBreak(signal) && pos != null && pos >= UPPER_BAND_MIN;
    })
    .sort((a, b) => b.confidence - a.confidence)[0];

  if (directSell) {
    return activeCandidate({
      kind: "grid-sell",
      asset: directSell.asset,
      targetAsset: "mUSD",
      sourceAsset: directSell.asset === "mantle" ? "WMNT" : "mETH",
      allocationPct: GRID_SELL_ALLOCATION_PCT,
      confidence: directSell.confidence,
      signal: directSell.signal,
      reasoning: `${directSell.asset.toUpperCase()} grid indicates upper-band/risk-off exit; validate sell-high only if real risk inventory exists.`,
      riskFactors: ["Portfolio guard must block redundant stable-heavy risk-off"],
    });
  }

  return inactive("no actionable lower-band or grid edge", {
    inspectedSignals: signals.map(({ asset, signal }) => ({
      asset,
      ...compactSignal(signal),
    })),
  });
}

function formatGridTradeCandidateForPrompt(candidate) {
  if (!candidate?.active) {
    return "";
  }

  return [
    "=== DETERMINISTIC GRID TRADE CANDIDATE ===",
    `Action: ${candidate.action}`,
    `Direction: ${candidate.direction}`,
    `Target: ${candidate.targetAsset}`,
    `Source: ${candidate.sourceAsset || "auto"}`,
    `Allocation: ${candidate.allocationPct}%`,
    `Confidence: ${(candidate.confidence * 100).toFixed(0)}%`,
    candidate.routeHint ? `Route hint: ${candidate.routeHint.join(" -> ")}` : "",
    `Reasoning: ${candidate.reasoning}`,
    `Risk factors: ${(candidate.riskFactors || []).join("; ") || "none"}`,
    "Claude must validate this candidate against raw signals before execution; reject it if the lower-band edge is contradicted by confirmed breakdown, strong outflow, or route infeasibility.",
    "=== END GRID CANDIDATE ===",
  ]
    .filter(Boolean)
    .join("\n");
}

function toAnalystProposal(candidate) {
  if (!candidate?.active) return null;
  return {
    action: candidate.action,
    direction: candidate.direction,
    targetAsset: candidate.targetAsset,
    sourceAsset: candidate.sourceAsset || null,
    allocationPct: candidate.allocationPct,
    confidence: candidate.confidence,
    reasoning: candidate.reasoning,
    riskFactors: candidate.riskFactors || [],
    expectedYield: undefined,
    _gridTradeCandidateApplied: true,
  };
}

module.exports = {
  buildGridTradeCandidate,
  formatGridTradeCandidateForPrompt,
  toAnalystProposal,
};
