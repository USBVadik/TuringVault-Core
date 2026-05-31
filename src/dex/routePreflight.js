const { ethers } = require("ethers");

const TOKEN_DECIMALS = {
  USDT0: 6,
  USDT: 6,
  WMNT: 18,
  MNT: 18,
  WETH: 18,
  mETH: 18,
  mUSD: 18,
};

function amountToUnits(amount, token) {
  const decimals = TOKEN_DECIMALS[token] ?? 18;
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`invalid amount for ${token}: ${amount}`);
  }
  return ethers.parseUnits(n.toFixed(decimals), decimals);
}

function getDirectionalSwapOptions(path, legIndex) {
  const isFinalLeg = legIndex === path.length - 2;
  const toTok = path[legIndex + 1];
  const isVolatileTarget =
    isFinalLeg && (toTok === "mETH" || toTok === "WETH");
  if (isVolatileTarget) return { maxPriceImpactBps: 250, slippageBps: 75 };
  if (legIndex === 0) return { maxPriceImpactBps: 100, slippageBps: 50 };
  return { maxPriceImpactBps: 200, slippageBps: 50 };
}

async function preflightSwapPath({ dex, path, initialAmount }) {
  if (!dex || typeof dex.getQuote !== "function") {
    throw new Error("preflight requires a dex with getQuote()");
  }
  if (!Array.isArray(path) || path.length < 2) {
    return {
      ok: false,
      reason: "path must contain at least two tokens",
      legs: [],
    };
  }

  const legs = [];
  let nextAmountIn = Number(initialAmount);

  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to = path[i + 1];
    const amountInWei = amountToUnits(nextAmountIn, from);
    const quote = await dex.getQuote(from, to, amountInWei);
    const impactBps = Number(quote?.priceImpact ?? 1) * 10000;
    const opts = getDirectionalSwapOptions(path, i);
    const leg = {
      leg: i + 1,
      from,
      to,
      amountIn: nextAmountIn,
      estimatedOut: quote?.estimatedOut ?? null,
      priceImpactBps: Number.isFinite(impactBps)
        ? Number(impactBps.toFixed(2))
        : null,
      pairAddress: quote?.pairAddress ?? null,
      binStep: quote?.binStep ?? null,
    };

    if (quote?.viable !== true) {
      return {
        ok: false,
        reason:
          `leg${i + 1} ${from}->${to} not viable` +
          (quote?.error ? `: ${quote.error}` : ""),
        legs: [...legs, leg],
      };
    }

    if (!Number.isFinite(impactBps) || impactBps > opts.maxPriceImpactBps) {
      const impactText = Number.isFinite(impactBps)
        ? impactBps.toFixed(1)
        : "unknown";
      return {
        ok: false,
        reason: `leg${i + 1} ${from}->${to} impact ${impactText}bps > ${opts.maxPriceImpactBps}bps`,
        legs: [...legs, leg],
      };
    }

    const estimatedOut = Number(quote.estimatedOut);
    if (!Number.isFinite(estimatedOut) || estimatedOut <= 0) {
      return {
        ok: false,
        reason: `leg${i + 1} ${from}->${to} returned no output`,
        legs: [...legs, leg],
      };
    }

    legs.push(leg);
    nextAmountIn = estimatedOut;
  }

  return { ok: true, reason: "path viable", legs, amountOut: nextAmountIn };
}

module.exports = {
  TOKEN_DECIMALS,
  amountToUnits,
  getDirectionalSwapOptions,
  preflightSwapPath,
};
