const fs = require("fs");
const path = require("path");

const LEDGER_PATH = process.env.TRADE_LEDGER_PATH
  ? path.resolve(process.env.TRADE_LEDGER_PATH)
  : path.resolve(__dirname, "../data/trade_ledger.json");
const STABLE_ASSETS = new Set(["USDT", "USDT0", "mUSD"]);
const DEFAULT_EXIT_SLIPPAGE_BUFFER_BPS = 75;
const DEFAULT_MIN_NET_PROFIT_BPS = 10;
const DEFAULT_MIN_NET_PROFIT_USD = 0.01;

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeRiskAsset(asset) {
  if (asset === "MNT" || asset === "WMNT") return "WMNT";
  if (asset === "mETH" || asset === "WETH") return "mETH";
  return null;
}

function createSummary() {
  return {
    openedTrades: 0,
    closedTrades: 0,
    profitableClosedTrades: 0,
    losingClosedTrades: 0,
    realizedGrossPnlUsd: 0,
    realizedNetPnlUsd: 0,
    matchedCostBasisUsd: 0,
    matchedProceedsUsd: 0,
    swapGasUsd: 0,
    matchedSwapGasUsd: 0,
    proofGasUsd: 0,
    unknownBasisExitUsd: 0,
    netStrategyPnlUsd: 0,
  };
}

function createEmptyLedger(startedAt = new Date().toISOString()) {
  return {
    schemaVersion: 1,
    startedAt,
    updatedAt: startedAt,
    entries: [],
    lots: { WMNT: [], mETH: [] },
    summary: createSummary(),
  };
}

function cloneLedger(input) {
  const ledger = input && typeof input === "object" ? input : createEmptyLedger();
  return {
    ...createEmptyLedger(ledger.startedAt || new Date().toISOString()),
    ...JSON.parse(JSON.stringify(ledger)),
    entries: Array.isArray(ledger.entries)
      ? JSON.parse(JSON.stringify(ledger.entries))
      : [],
    lots: {
      WMNT: Array.isArray(ledger.lots?.WMNT)
        ? JSON.parse(JSON.stringify(ledger.lots.WMNT))
        : [],
      mETH: Array.isArray(ledger.lots?.mETH)
        ? JSON.parse(JSON.stringify(ledger.lots.mETH))
        : [],
    },
    summary: { ...createSummary(), ...(ledger.summary || {}) },
  };
}

function refreshNetStrategyPnl(summary) {
  summary.netStrategyPnlUsd =
    num(summary.realizedGrossPnlUsd) -
    num(summary.swapGasUsd) -
    num(summary.proofGasUsd);
}

function applyDirectionalTrade(inputLedger, trade = {}) {
  const ledger = cloneLedger(inputLedger);
  const txHash = String(trade.txHash || "").toLowerCase();
  if (
    txHash &&
    ledger.entries.some(
      (entry) => String(entry.txHash || "").toLowerCase() === txHash
    )
  ) {
    return ledger;
  }

  const from = trade.from;
  const to = trade.to;
  const amountIn = Math.max(0, num(trade.amountIn));
  const amountOut = Math.max(0, num(trade.amountOut));
  const gasCostUsd = Math.max(0, num(trade.gasCostUsd));
  if (!amountIn || !amountOut) return ledger;

  const openedAsset = normalizeRiskAsset(to);
  const closedAsset = normalizeRiskAsset(from);
  const recordedAt = trade.recordedAt || new Date().toISOString();
  const baseEntry = {
    decisionId: trade.decisionId ?? null,
    recordedAt,
    txHash: trade.txHash || null,
    from,
    to,
    amountIn,
    amountOut,
    gasCostUsd,
    amountSource: trade.amountSource || null,
  };

  ledger.summary.swapGasUsd += gasCostUsd;

  if (openedAsset && STABLE_ASSETS.has(from)) {
    ledger.lots[openedAsset].push({
      asset: openedAsset,
      remainingQty: amountOut,
      remainingCostUsd: amountIn,
      remainingEntryGasUsd: gasCostUsd,
      entryDecisionId: trade.decisionId ?? null,
      entryTxHash: trade.txHash || null,
      openedAt: recordedAt,
    });
    ledger.summary.openedTrades += 1;
    ledger.entries.push({ ...baseEntry, type: "ENTRY", asset: openedAsset });
  } else if (closedAsset && STABLE_ASSETS.has(to)) {
    let remainingToMatch = amountIn;
    let matchedQty = 0;
    let matchedCostUsd = 0;
    let matchedEntryGasUsd = 0;
    const matchedEntries = [];

    while (remainingToMatch > 1e-12 && ledger.lots[closedAsset].length > 0) {
      const lot = ledger.lots[closedAsset][0];
      const lotQty = Math.max(0, num(lot.remainingQty));
      if (!lotQty) {
        ledger.lots[closedAsset].shift();
        continue;
      }
      const takeQty = Math.min(remainingToMatch, lotQty);
      const fraction = takeQty / lotQty;
      const takeCost = num(lot.remainingCostUsd) * fraction;
      const takeGas = num(lot.remainingEntryGasUsd) * fraction;
      matchedQty += takeQty;
      matchedCostUsd += takeCost;
      matchedEntryGasUsd += takeGas;
      matchedEntries.push({
        entryDecisionId: lot.entryDecisionId ?? null,
        entryTxHash: lot.entryTxHash || null,
        quantity: takeQty,
        costUsd: takeCost,
      });
      lot.remainingQty = lotQty - takeQty;
      lot.remainingCostUsd = Math.max(0, num(lot.remainingCostUsd) - takeCost);
      lot.remainingEntryGasUsd = Math.max(
        0,
        num(lot.remainingEntryGasUsd) - takeGas
      );
      remainingToMatch -= takeQty;
      if (lot.remainingQty <= 1e-12) ledger.lots[closedAsset].shift();
    }

    const matchedFraction = matchedQty / amountIn;
    const matchedProceedsUsd = amountOut * matchedFraction;
    const matchedExitGasUsd = gasCostUsd * matchedFraction;
    const realizedGrossPnlUsd = matchedProceedsUsd - matchedCostUsd;
    const matchedGasUsd = matchedEntryGasUsd + matchedExitGasUsd;
    const realizedNetPnlUsd = realizedGrossPnlUsd - matchedGasUsd;
    const unknownBasisExitUsd = amountOut * (1 - matchedFraction);

    if (matchedQty > 0) {
      ledger.summary.closedTrades += 1;
      if (realizedNetPnlUsd > 0) ledger.summary.profitableClosedTrades += 1;
      else ledger.summary.losingClosedTrades += 1;
      ledger.summary.realizedGrossPnlUsd += realizedGrossPnlUsd;
      ledger.summary.realizedNetPnlUsd += realizedNetPnlUsd;
      ledger.summary.matchedCostBasisUsd += matchedCostUsd;
      ledger.summary.matchedProceedsUsd += matchedProceedsUsd;
      ledger.summary.matchedSwapGasUsd += matchedGasUsd;
    }
    ledger.summary.unknownBasisExitUsd += unknownBasisExitUsd;
    ledger.entries.push({
      ...baseEntry,
      type: "EXIT",
      asset: closedAsset,
      matchedQty,
      matchedCostUsd,
      matchedProceedsUsd,
      realizedGrossPnlUsd,
      realizedNetPnlUsd,
      unknownBasisQty: Math.max(0, remainingToMatch),
      unknownBasisExitUsd,
      matchedEntries,
    });
  } else {
    ledger.entries.push({ ...baseEntry, type: "UNCLASSIFIED" });
  }

  ledger.updatedAt = recordedAt;
  refreshNetStrategyPnl(ledger.summary);
  return ledger;
}

function applyOperatingCost(inputLedger, cost = {}) {
  const ledger = cloneLedger(inputLedger);
  const key = `proof:${cost.decisionId ?? "unknown"}`;
  if (ledger.entries.some((entry) => entry.key === key)) return ledger;
  const proofGasMnt = Math.max(0, num(cost.proofGasMnt));
  const mntPriceUsd = Math.max(0, num(cost.mntPriceUsd));
  const proofGasUsd = proofGasMnt * mntPriceUsd;
  const unmatchedSwapGasUsd = Math.max(0, num(cost.unmatchedSwapGasUsd));
  const recordedAt = cost.recordedAt || new Date().toISOString();
  ledger.entries.push({
    key,
    type: "OPERATING_COST",
    decisionId: cost.decisionId ?? null,
    recordedAt,
    proofGasMnt,
    mntPriceUsd,
    proofGasUsd,
    unmatchedSwapGasUsd,
  });
  ledger.summary.proofGasUsd += proofGasUsd;
  ledger.summary.swapGasUsd += unmatchedSwapGasUsd;
  ledger.updatedAt = recordedAt;
  refreshNetStrategyPnl(ledger.summary);
  return ledger;
}

function loadLedger() {
  try {
    return cloneLedger(JSON.parse(fs.readFileSync(LEDGER_PATH, "utf8")));
  } catch {
    return createEmptyLedger();
  }
}

function saveLedger(ledger) {
  fs.mkdirSync(path.dirname(LEDGER_PATH), { recursive: true });
  const tmp = `${LEDGER_PATH}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(ledger, null, 2)}\n`);
  fs.renameSync(tmp, LEDGER_PATH);
  return ledger;
}

function getOpenBasis(inputLedger, asset) {
  const normalized = normalizeRiskAsset(asset);
  if (!normalized) return null;
  const ledger = cloneLedger(inputLedger);
  const lots = ledger.lots[normalized] || [];
  const quantity = lots.reduce(
    (sum, lot) => sum + Math.max(0, num(lot.remainingQty)),
    0
  );
  const costUsd = lots.reduce(
    (sum, lot) => sum + Math.max(0, num(lot.remainingCostUsd)),
    0
  );
  if (!quantity || !costUsd) return null;
  const latestLot = lots[lots.length - 1] || {};
  return {
    asset: normalized,
    quantity,
    costUsd,
    sourceAsset: "USDT0",
    txHash: latestLot.entryTxHash || null,
  };
}

function previewFifoExit(inputLedger, exit = {}) {
  const normalized = normalizeRiskAsset(exit.asset);
  const requestedQty = Math.max(0, num(exit.quantity));
  const proceedsUsd = Math.max(0, num(exit.proceedsUsd));
  const exitGasUsd = Math.max(0, num(exit.exitGasUsd));
  if (!normalized || !requestedQty || !proceedsUsd) {
    return { allowed: false, reason: "net-profit gate: invalid exit preview" };
  }

  const ledger = cloneLedger(inputLedger);
  let remaining = requestedQty;
  let matchedQty = 0;
  let matchedCostUsd = 0;
  let matchedEntryGasUsd = 0;
  for (const lot of ledger.lots[normalized] || []) {
    if (remaining <= 1e-12) break;
    const lotQty = Math.max(0, num(lot.remainingQty));
    if (!lotQty) continue;
    const takeQty = Math.min(remaining, lotQty);
    const fraction = takeQty / lotQty;
    matchedQty += takeQty;
    matchedCostUsd += Math.max(0, num(lot.remainingCostUsd)) * fraction;
    matchedEntryGasUsd +=
      Math.max(0, num(lot.remainingEntryGasUsd)) * fraction;
    remaining -= takeQty;
  }

  if (matchedQty + 1e-12 < requestedQty) {
    return {
      allowed: false,
      reason: `net-profit gate: cost basis covers ${matchedQty} of ${requestedQty} ${normalized}`,
      matchedQty,
      requestedQty,
    };
  }

  const slippageBufferUsd =
    proceedsUsd *
    (Math.max(
      0,
      num(exit.slippageBufferBps, DEFAULT_EXIT_SLIPPAGE_BUFFER_BPS)
    ) /
      10000);
  const minNetProfitUsd = Math.max(
    DEFAULT_MIN_NET_PROFIT_USD,
    matchedCostUsd *
      (Math.max(
        0,
        num(exit.minNetProfitBps, DEFAULT_MIN_NET_PROFIT_BPS)
      ) /
        10000)
  );
  const expectedNetPnlUsd =
    proceedsUsd - matchedCostUsd - matchedEntryGasUsd - exitGasUsd;
  const pendingOperatingCostUsd = Math.max(
    0,
    num(exit.pendingOperatingCostUsd)
  );
  const currentStrategyPnlUsd = num(ledger.summary.netStrategyPnlUsd);
  const projectedStrategyPnlUsd =
    currentStrategyPnlUsd +
    (proceedsUsd - matchedCostUsd) -
    exitGasUsd -
    pendingOperatingCostUsd;
  const tradeRequiredProceedsUsd =
    matchedCostUsd +
    matchedEntryGasUsd +
    exitGasUsd +
    slippageBufferUsd +
    minNetProfitUsd;
  const strategyRequiredProceedsUsd =
    matchedCostUsd +
    exitGasUsd +
    pendingOperatingCostUsd +
    slippageBufferUsd +
    minNetProfitUsd -
    currentStrategyPnlUsd;
  // A new exit must be profitable on its own after matched entry gas,
  // estimated exit gas, slippage and the minimum edge. Historic proof-only
  // operating costs remain visible in projectedStrategyPnlUsd, but they must
  // not become debt assigned to the current FIFO lot. Requiring one small
  // exit to recover the entire strategy deficit creates a ratchet: every
  // blocked proof cycle raises the next exit threshold and can lock a
  // position forever even when the trade itself is net-profitable.
  const requiredProceedsUsd = tradeRequiredProceedsUsd;
  const allowed = proceedsUsd >= requiredProceedsUsd;
  return {
    allowed,
    reason: allowed
      ? `net-profit gate passed: quote $${proceedsUsd.toFixed(4)} >= required $${requiredProceedsUsd.toFixed(4)}`
      : `net-profit gate blocked: quote $${proceedsUsd.toFixed(4)} < required $${requiredProceedsUsd.toFixed(4)}`,
    asset: normalized,
    requestedQty,
    matchedQty,
    matchedCostUsd,
    matchedEntryGasUsd,
    exitGasUsd,
    slippageBufferUsd,
    minNetProfitUsd,
    expectedNetPnlUsd,
    currentStrategyPnlUsd,
    pendingOperatingCostUsd,
    projectedStrategyPnlUsd,
    tradeRequiredProceedsUsd,
    strategyRequiredProceedsUsd,
    requiredProceedsUsd,
  };
}

function recordCycleEconomics({ trade = null, operatingCost = null } = {}) {
  let ledger = loadLedger();
  if (trade) ledger = applyDirectionalTrade(ledger, trade);
  if (operatingCost) ledger = applyOperatingCost(ledger, operatingCost);
  return saveLedger(ledger);
}

module.exports = {
  LEDGER_PATH,
  applyDirectionalTrade,
  applyOperatingCost,
  createEmptyLedger,
  getOpenBasis,
  previewFifoExit,
  loadLedger,
  recordCycleEconomics,
  saveLedger,
};
