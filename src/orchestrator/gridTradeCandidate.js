const MIN_CANDIDATE_CONFIDENCE = 0.55;
const LOWER_BAND_MAX = 0.2;
const STABLE_REENTRY_ALLOCATION_PCT = 12;
const GRID_BUY_ALLOCATION_PCT = 15;
const GRID_SELL_ALLOCATION_PCT = 20;
const {
  executableAllocationPct,
  getMinExitUsd,
  getMinTradeUsd,
} = require("../config/tradingEconomics");
const {
  buildInventoryAwareGridCandidate,
} = require("./inventoryAwareGrid");
const {
  MAX_SCALE_INS_PER_POSITION,
  MIN_SCALE_IN_DIP_PCT,
  SCALE_IN_ALLOCATION_PCT,
  SCALE_IN_LOWER_BAND_MAX,
} = require("./portfolioGuard");

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

function hasOpenPositionForGridAsset(asset, positionState = {}) {
  const status = upper(positionState.status);
  if (asset === "mantle") return ["IN_MNT", "IN_RISK"].includes(status);
  return status === "IN_METH";
}

function isConfirmedDownBreak(signal = {}) {
  return (
    upper(signal.breakoutDirection) === "DOWN" ||
    upper(signal.regimeHint) === "TREND_DOWN"
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

function riskSourceForGridAsset(asset) {
  return asset === "mantle" ? "WMNT" : "mETH";
}

function sourceUsdForGridAsset(asset, portfolioSummary = {}) {
  const explicit =
    asset === "mantle" ? portfolioSummary.wmntUsd : portfolioSummary.methUsd;
  if (Number.isFinite(Number(explicit))) return num(explicit, 0);
  return num(portfolioSummary.tradableRiskUsd, 0);
}

function hasSellInventoryForGridAsset(
  asset,
  portfolioSummary,
  positionState,
  minTradeUsd
) {
  return (
    sourceUsdForGridAsset(asset, portfolioSummary) >= minTradeUsd &&
    (sourceUsdForGridAsset(asset, portfolioSummary) > 0 ||
      hasOpenPositionForGridAsset(asset, positionState))
  );
}

function trackedRiskSource(positionState = {}) {
  const status = upper(positionState.status);
  if (status === "IN_METH") return "mETH";
  if (status === "IN_MNT" || status === "IN_RISK") return "WMNT";
  return null;
}

function buildTrackedPositionExit({
  ranging = {},
  portfolioSummary = {},
  positionState = {},
  minTradeUsd,
} = {}) {
  const exitReason = upper(ranging.overrideReason);
  if (!["TAKE_PROFIT", "STOP_LOSS", "MAX_CYCLES", "GRID_EXIT"].includes(exitReason)) {
    return null;
  }
  const sourceAsset = trackedRiskSource(positionState);
  if (!sourceAsset) return null;
  const sourceUsd =
    sourceAsset === "mETH"
      ? num(portfolioSummary.methUsd, 0)
      : num(portfolioSummary.wmntUsd, 0);
  const allocationPct = executableAllocationPct(sourceUsd, minTradeUsd);
  const residualExit =
    !allocationPct && sourceUsd >= getMinExitUsd() && sourceUsd < minTradeUsd;
  if (!allocationPct && !residualExit) {
    return inactive(
      `tracked ${sourceAsset} exit is below executable $${minTradeUsd.toFixed(2)} floor`
    );
  }
  const confidence =
    exitReason === "STOP_LOSS"
      ? 0.95
      : exitReason === "TAKE_PROFIT"
      ? 0.9
      : Math.max(0.7, num(ranging.confidence, 0.7));
  return activeCandidate({
    kind: "position-exit",
    exitReason,
    asset: sourceAsset === "mETH" ? "ethereum" : "mantle",
    targetAsset: "mUSD",
    sourceAsset,
    allocationPct: residualExit ? 100 : allocationPct,
    residualExit,
    confidence,
    signal: ranging,
    reasoning:
      `${exitReason.replace(/_/g, " ")} for the tracked ${sourceAsset} position has fired. ` +
      `Prioritize the existing position lifecycle over unrelated grid signals; execute only an economically viable partial exit.`,
    riskFactors: [
      "Exit remains capped by the per-cycle USD risk limit",
      "Residual inventory stays tracked after a partial exit",
    ],
  });
}

function routeForTarget(targetAsset) {
  return targetAsset === "mETH"
    ? ["USDT0", "USDT", "WMNT", "WETH", "mETH"]
    : ["USDT0", "USDT", "WMNT"];
}

function roundPrice(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Number(n.toFixed(n >= 10 ? 2 : 6));
}

function buildLongRiskReward(signal = {}) {
  const support = Number(signal.channel?.support);
  const resistance = Number(signal.channel?.resistance);
  const entry = Number(signal.channel?.currentPrice);
  if (
    !Number.isFinite(support) ||
    !Number.isFinite(resistance) ||
    !Number.isFinite(entry) ||
    resistance <= support
  ) {
    return null;
  }

  const width = resistance - support;
  const stopLoss = support - width * 0.1;
  const takeProfit = resistance;
  const risk = entry - stopLoss;
  const reward = takeProfit - entry;
  if (risk <= 0 || reward <= 0) return null;

  return {
    entry: roundPrice(entry),
    stopLoss: roundPrice(stopLoss),
    takeProfit: roundPrice(takeProfit),
    ratio: Number((reward / risk).toFixed(2)),
    riskPct: Number(((risk / entry) * 100).toFixed(2)),
    rewardPct: Number(((reward / entry) * 100).toFixed(2)),
  };
}

function buildShortRiskReward(signal = {}) {
  const support = Number(signal.channel?.support);
  const resistance = Number(signal.channel?.resistance);
  const entry = Number(signal.channel?.currentPrice);
  if (
    !Number.isFinite(support) ||
    !Number.isFinite(resistance) ||
    !Number.isFinite(entry) ||
    resistance <= support
  ) {
    return null;
  }

  const width = resistance - support;
  const stopLoss = resistance + width * 0.1;
  const takeProfit = support;
  const risk = stopLoss - entry;
  const reward = entry - takeProfit;
  if (risk <= 0 || reward <= 0) return null;

  return {
    entry: roundPrice(entry),
    stopLoss: roundPrice(stopLoss),
    takeProfit: roundPrice(takeProfit),
    ratio: Number((reward / risk).toFixed(2)),
    riskPct: Number(((risk / entry) * 100).toFixed(2)),
    rewardPct: Number(((reward / entry) * 100).toFixed(2)),
  };
}

function riskRewardSentence(riskReward) {
  if (!riskReward) return "";
  return ` Risk plan: entry ${riskReward.entry}, stop ${riskReward.stopLoss}, take-profit ${riskReward.takeProfit}, R:R ${riskReward.ratio}:1.`;
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
  exitReason = null,
  asset,
  targetAsset,
  sourceAsset,
  allocationPct,
  confidence,
  reasoning,
  riskFactors = [],
  signal,
  riskReward,
  edge,
  quote,
  residualExit = false,
}) {
  return {
    active: true,
    kind,
    exitReason,
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
    riskReward: riskReward || null,
    inventoryAware: edge || quote ? { edge: edge || null, quote: quote || null } : null,
    residualExit,
  };
}

function inactive(reason, extra = {}) {
  return { active: false, reason, ...extra };
}

function hasStrongRiskOnBlock(structuredSignals = {}, signal = {}) {
  const flow = structuredSignals.signals?.onChainFlow || {};
  const netUsd = num(flow.netUsd ?? flow.netFlowUsd, 0);
  if (upper(flow.signal) === "BEARISH" && netUsd <= -1_000_000) {
    return "strong smart-money outflow";
  }
  if (isConfirmedDownBreak(signal)) {
    return "confirmed down-break";
  }
  return null;
}

function buildTrackedScaleInCandidate({
  structuredSignals = {},
  signals = [],
  portfolioSummary = {},
  positionState = {},
  minTradeUsd,
} = {}) {
  if (isFlat(positionState)) return null;
  if (num(portfolioSummary.stableUsd, 0) < minTradeUsd) return null;
  if (num(positionState.scaleInCount, 0) >= MAX_SCALE_INS_PER_POSITION) {
    return null;
  }

  const sourceAsset = trackedRiskSource(positionState);
  const asset = sourceAsset === "mETH" ? "ethereum" : "mantle";
  const tracked = signals.find((entry) => entry.asset === asset);
  if (!tracked) return null;
  const pos = channelPosition(tracked.signal);
  const currentPrice = num(tracked.signal.channel?.currentPrice, 0);
  const entryPrice = num(positionState.entryPrice, 0);
  if (
    pos == null ||
    pos > SCALE_IN_LOWER_BAND_MAX ||
    !currentPrice ||
    !entryPrice ||
    currentPrice > entryPrice * (1 - MIN_SCALE_IN_DIP_PCT) ||
    hasStrongRiskOnBlock(structuredSignals, tracked.signal)
  ) {
    return null;
  }

  const targetAsset = riskTargetForAsset(asset);
  const riskReward = buildLongRiskReward(tracked.signal);
  return activeCandidate({
    kind: "position-scale-in",
    asset,
    targetAsset,
    sourceAsset: riskSourceForTarget(targetAsset),
    allocationPct: SCALE_IN_ALLOCATION_PCT,
    confidence: tracked.signal.confidence,
    signal: tracked.signal,
    riskReward,
    reasoning:
      `Controlled ${targetAsset} scale-in: the same tracked asset is at ` +
      `${(pos * 100).toFixed(0)}% of its channel and $${currentPrice} is at ` +
      `least ${(MIN_SCALE_IN_DIP_PCT * 100).toFixed(1)}% below the prior ` +
      `$${entryPrice} entry. Validator and portfolio caps remain mandatory.`,
    riskFactors: [
      "A lower-band move can become a confirmed breakdown",
      `Scale-in count is capped at ${MAX_SCALE_INS_PER_POSITION}`,
    ],
  });
}

function buildGridTradeCandidate({
  structuredSignals = {},
  portfolioSummary = {},
  positionState = {},
  minTradeUsd = getMinTradeUsd(),
} = {}) {
  const regime = upper(structuredSignals.regime?.regime);
  const ranging = structuredSignals.signals?.ranging || {};
  const signals = collectGridSignals(ranging);
  const trackedExit = buildTrackedPositionExit({
    ranging,
    portfolioSummary,
    positionState,
    minTradeUsd,
  });
  if (trackedExit) return trackedExit;
  const riskOnRegimeAllowed = ["RANGING", "CONTRARIAN_LONG", "TREND_UP"].includes(
    regime
  );
  const sellRegimeAllowed = ["RANGING", "TREND_UP", "TREND_DOWN", "CRISIS"].includes(
    regime
  );

  if (riskOnRegimeAllowed) {
    const scaleIn = buildTrackedScaleInCandidate({
      structuredSignals,
      signals,
      portfolioSummary,
      positionState,
      minTradeUsd,
    });
    if (scaleIn) return scaleIn;
  }

  let blockedSell = null;
  const directSell = sellRegimeAllowed
    ? signals
        .map(({ asset, signal }) => ({
          asset,
          signal,
          confidence: num(signal.confidence, 0),
        }))
        .filter(({ signal }) => upper(signal.action) === "SELL_METH")
        .sort((a, b) => b.confidence - a.confidence)[0]
    : null;

  if (directSell) {
    const sourceAsset = riskSourceForGridAsset(directSell.asset);
    if (
      hasSellInventoryForGridAsset(
        directSell.asset,
        portfolioSummary,
        positionState,
        minTradeUsd
      )
    ) {
      const riskReward = buildShortRiskReward(directSell.signal);
      return activeCandidate({
        kind: "grid-sell",
        asset: directSell.asset,
        targetAsset: "mUSD",
        sourceAsset,
        allocationPct: GRID_SELL_ALLOCATION_PCT,
        confidence: directSell.confidence,
        signal: directSell.signal,
        riskReward,
        reasoning:
          `${directSell.asset.toUpperCase()} grid indicates upper-band/risk-off exit with existing risk inventory; validate sell-high/trim before execution.` +
          riskRewardSentence(riskReward),
        riskFactors: ["Portfolio guard must block redundant risk-off without sellable inventory"],
      });
    }
    blockedSell = inactive(
      `no executable ${sourceAsset} inventory for grid sell (need at least $${minTradeUsd.toFixed(2)})`,
      {
        inspectedSignal: {
          asset: directSell.asset,
          ...compactSignal(directSell.signal),
        },
      }
    );
  }

  if (!riskOnRegimeAllowed) {
    const inventoryAware = buildInventoryAwareGridCandidate({
      structuredSignals,
      portfolioSummary,
      positionState,
      gridSignals: signals,
    });
    if (inventoryAware.active) {
      const riskReward = buildLongRiskReward(inventoryAware.signal);
      return activeCandidate({
        ...inventoryAware,
        riskReward,
      });
    }
    return inactive(
      inventoryAware.reason ||
        `regime ${regime || "UNKNOWN"} does not allow grid risk-on`,
      {
        sellCandidateBlocked: blockedSell?.reason || null,
        inventoryAwareGrid: inventoryAware,
      }
    );
  }

  if (
    blockedSell &&
    (!portfolioSummary.stableHeavy || !isFlat(positionState))
  ) {
    return blockedSell;
  }

  if (!portfolioSummary.stableHeavy || !isFlat(positionState)) {
    return inactive("not stable-heavy FLAT inventory", {
      sellCandidateBlocked: blockedSell?.reason || null,
    });
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
    const riskReward = buildLongRiskReward(directBuy.signal);
    return activeCandidate({
      kind: "grid-buy",
      asset: directBuy.asset,
      targetAsset,
      sourceAsset: riskSourceForTarget(targetAsset),
      allocationPct: GRID_BUY_ALLOCATION_PCT,
      confidence: directBuy.confidence,
      signal: directBuy.signal,
      riskReward,
      reasoning:
        `${directBuy.asset.toUpperCase()} grid emitted BUY_mETH with ${(directBuy.confidence * 100).toFixed(0)}% confidence; stable-heavy FLAT wallet has deployable stables.` +
        riskRewardSentence(riskReward),
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
    const riskReward = buildLongRiskReward(lowerBand.signal);
    return activeCandidate({
      kind: "stable-heavy-lower-band-reentry",
      asset: lowerBand.asset,
      targetAsset,
      sourceAsset: riskSourceForTarget(targetAsset),
      allocationPct: STABLE_REENTRY_ALLOCATION_PCT,
      confidence: Math.min(0.64, Math.max(0.56, lowerBand.confidence)),
      signal: lowerBand.signal,
      riskReward,
      reasoning:
        `${lowerBand.asset.toUpperCase()} lower-band re-entry: price is at ${(lowerBand.pos * 100).toFixed(0)}% of channel while wallet is stable-heavy and FLAT; no confirmed down-break, so validate a small buy-low probe.` +
        riskRewardSentence(riskReward),
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

  if (blockedSell) return blockedSell;

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
    candidate.exitReason ? `Exit reason: ${candidate.exitReason}` : "",
    candidate.routeHint ? `Route hint: ${candidate.routeHint.join(" -> ")}` : "",
    candidate.riskReward
      ? `Entry: ${candidate.riskReward.entry}`
      : "",
    candidate.riskReward
      ? `Stop loss: ${candidate.riskReward.stopLoss}`
      : "",
    candidate.riskReward
      ? `Take profit: ${candidate.riskReward.takeProfit}`
      : "",
    candidate.riskReward
      ? `Risk/reward: ${candidate.riskReward.ratio}:1`
      : "",
    candidate.inventoryAware?.edge
      ? `Inventory-aware edge score: ${candidate.inventoryAware.edge.score.toFixed(2)}`
      : "",
    candidate.inventoryAware?.quote
      ? `Reservation bid: ${candidate.inventoryAware.quote.buyTrigger.toFixed(6)} (reservation ${candidate.inventoryAware.quote.reservationPrice.toFixed(6)})`
      : "",
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
    riskReward: candidate.riskReward || undefined,
    expectedYield: candidate.riskReward
      ? `Take-profit ${candidate.riskReward.rewardPct}% vs stop ${candidate.riskReward.riskPct}% (R:R ${candidate.riskReward.ratio}:1)`
      : undefined,
    _gridTradeCandidateApplied: true,
  };
}

module.exports = {
  buildGridTradeCandidate,
  formatGridTradeCandidateForPrompt,
  toAnalystProposal,
};
