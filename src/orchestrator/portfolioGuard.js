const { GAS_RESERVE_MNT } = require("../dex/walletRouter");

const STABLE_HEAVY_SHARE = 0.8;
const MAX_RISK_SHARE_FOR_BUY = 0.65;
const MIN_STABLE_USD_FOR_RISK_ON = 0.5;
const MIN_RISK_USD_FOR_RISK_OFF = 1.0;

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function priceOf(prices = {}, symbol) {
  if (symbol === "mETH" || symbol === "WETH") {
    return num(prices[symbol] ?? prices.mETH ?? prices.WETH ?? prices.ETH, 0);
  }
  if (symbol === "WMNT" || symbol === "MNT") {
    return num(prices.WMNT ?? prices.MNT ?? prices.mntPrice, 0.65);
  }
  return num(prices[symbol], 1);
}

function inferTradeDirection(targetAsset) {
  if (["mETH", "WETH", "MNT", "WMNT"].includes(targetAsset)) {
    return "risk-on";
  }
  if (["mUSD", "USDT", "USDT0"].includes(targetAsset)) {
    return "risk-off";
  }
  return null;
}

function summarizePortfolio({
  balances = {},
  prices = {},
  gasReserveMnt = GAS_RESERVE_MNT,
} = {}) {
  const stableUsd =
    num(balances.USDT0) * priceOf(prices, "USDT0") +
    num(balances.USDT) * priceOf(prices, "USDT") +
    num(balances.mUSD) * priceOf(prices, "mUSD");

  const wmntUsd = num(balances.WMNT) * priceOf(prices, "WMNT");
  const methUsd = num(balances.mETH) * priceOf(prices, "mETH");
  const tradableRiskUsd = wmntUsd + methUsd;

  // Native MNT is gas/runway first, not a free profit-taking bucket.
  const nativeMnt = num(balances.MNT);
  const nativeMntUsd = nativeMnt * priceOf(prices, "MNT");
  const spendableNativeMnt = Math.max(0, nativeMnt - gasReserveMnt);

  const allocationNavUsd = stableUsd + tradableRiskUsd;
  const totalWalletUsd = allocationNavUsd + nativeMntUsd;
  const stableShare =
    allocationNavUsd > 0 ? stableUsd / allocationNavUsd : 0;
  const riskShare =
    allocationNavUsd > 0 ? tradableRiskUsd / allocationNavUsd : 0;

  return {
    stableUsd,
    tradableRiskUsd,
    wmntUsd,
    methUsd,
    nativeMnt,
    nativeMntUsd,
    spendableNativeMnt,
    gasReserveMnt,
    allocationNavUsd,
    totalWalletUsd,
    stableShare,
    riskShare,
    stableHeavy:
      stableUsd >= MIN_STABLE_USD_FOR_RISK_ON &&
      stableShare >= STABLE_HEAVY_SHARE,
  };
}

function hasOpenRiskPosition(positionState = {}) {
  return ["IN_mETH", "IN_MNT", "IN_RISK"].includes(positionState.status);
}

function assessTradeInventory({
  direction,
  targetAsset,
  balances = {},
  prices = {},
  regime,
  positionState = {},
} = {}) {
  const inferred = direction || inferTradeDirection(targetAsset);
  const summary = summarizePortfolio({ balances, prices });
  const regimeLabel = String(regime || "").toUpperCase();
  const openRiskPosition = hasOpenRiskPosition(positionState);

  if (inferred === "risk-on") {
    if (summary.stableUsd < MIN_STABLE_USD_FOR_RISK_ON) {
      return {
        allowed: false,
        direction: inferred,
        summary,
        reason: `risk-on blocked: stable inventory $${summary.stableUsd.toFixed(2)} < $${MIN_STABLE_USD_FOR_RISK_ON.toFixed(2)}`,
      };
    }
    if (summary.riskShare >= MAX_RISK_SHARE_FOR_BUY) {
      return {
        allowed: false,
        direction: inferred,
        summary,
        reason: `risk-on blocked: risk share ${(summary.riskShare * 100).toFixed(1)}% already above ${(MAX_RISK_SHARE_FOR_BUY * 100).toFixed(0)}% ceiling`,
      };
    }
    return {
      allowed: true,
      direction: inferred,
      summary,
      reason: `risk-on allowed: stable inventory available ($${summary.stableUsd.toFixed(2)})`,
    };
  }

  if (inferred === "risk-off") {
    if (summary.tradableRiskUsd < MIN_RISK_USD_FOR_RISK_OFF) {
      return {
        allowed: false,
        direction: inferred,
        summary,
        reason: `risk-off blocked: tradable risk inventory $${summary.tradableRiskUsd.toFixed(2)} < $${MIN_RISK_USD_FOR_RISK_OFF.toFixed(2)}; native MNT is gas/runway, not sell inventory`,
      };
    }

    if (openRiskPosition) {
      return {
        allowed: true,
        direction: inferred,
        summary,
        reason: `risk-off allowed: open position ${positionState.status} can be exited`,
      };
    }

    const emergencyRegime =
      regimeLabel === "CRISIS" || regimeLabel === "TREND_DOWN";
    if (summary.stableHeavy && !emergencyRegime) {
      return {
        allowed: false,
        direction: inferred,
        summary,
        reason:
          `stable-heavy wallet (${(summary.stableShare * 100).toFixed(1)}% stables, ` +
          `$${summary.stableUsd.toFixed(2)} stable vs $${summary.tradableRiskUsd.toFixed(2)} tradable risk); ` +
          "refusing repeated risk-off while FLAT",
      };
    }

    return {
      allowed: true,
      direction: inferred,
      summary,
      reason: `risk-off allowed: tradable risk inventory $${summary.tradableRiskUsd.toFixed(2)} and regime=${regimeLabel || "UNKNOWN"}`,
    };
  }

  return {
    allowed: false,
    direction: inferred,
    summary,
    reason: `portfolio guard blocked unknown direction for target=${targetAsset || "n/a"}`,
  };
}

function formatUsd(n) {
  return `$${num(n).toFixed(2)}`;
}

function formatPortfolioForPrompt(summary) {
  if (!summary) return "";
  const posture = summary.stableHeavy ? "stable-heavy" : "balanced";
  return [
    "=== LIVE PORTFOLIO / EXECUTION INVENTORY ===",
    `Stable inventory: ${formatUsd(summary.stableUsd)} (${(summary.stableShare * 100).toFixed(1)}% of tradable allocation NAV)`,
    `Tradable risk inventory: ${formatUsd(summary.tradableRiskUsd)} (${(summary.riskShare * 100).toFixed(1)}%) — WMNT ${formatUsd(summary.wmntUsd)}, mETH ${formatUsd(summary.methUsd)}`,
    `Native MNT gas/runway: ${summary.nativeMnt.toFixed(4)} MNT (${formatUsd(summary.nativeMntUsd)}), reserve floor ${summary.gasReserveMnt.toFixed(1)} MNT`,
    `Portfolio posture: ${posture}`,
    "Inventory rule: when portfolio is stable-heavy and position state is FLAT, risk_off should become HOLD unless CRISIS/TREND_DOWN is explicitly confirmed. Do not propose repeated risk_off just to sell native MNT or tiny residual risk; prefer risk_on when grid/funding/flow support a buy.",
    "=== END PORTFOLIO ===",
  ].join("\n");
}

module.exports = {
  assessTradeInventory,
  formatPortfolioForPrompt,
  inferTradeDirection,
  summarizePortfolio,
  STABLE_HEAVY_SHARE,
  MAX_RISK_SHARE_FOR_BUY,
  MIN_STABLE_USD_FOR_RISK_ON,
  MIN_RISK_USD_FOR_RISK_OFF,
};
