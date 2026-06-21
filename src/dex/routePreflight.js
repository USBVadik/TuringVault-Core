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

const LIQUIDITY_RETRY_DEPTH_FRACTION = 0.45;

function amountToUnits(amount, token) {
  const decimals = TOKEN_DECIMALS[token] ?? 18;
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`invalid amount for ${token}: ${amount}`);
  }
  return ethers.parseUnits(n.toFixed(decimals), decimals);
}

function suggestedInitialAmountFromDepth({
  initialAmount,
  depthFraction,
  targetDepthFraction = LIQUIDITY_RETRY_DEPTH_FRACTION,
} = {}) {
  const initial = Number(initialAmount);
  const depth = Number(depthFraction);
  const target = Number(targetDepthFraction);
  if (
    !Number.isFinite(initial) ||
    initial <= 0 ||
    !Number.isFinite(depth) ||
    depth <= target ||
    !Number.isFinite(target) ||
    target <= 0
  ) {
    return null;
  }

  return Number((initial * (target / depth)).toFixed(8));
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
      depthFraction: Number.isFinite(Number(quote?.depthFraction))
        ? Number(Number(quote.depthFraction).toFixed(6))
        : null,
    };

    if (quote?.viable !== true) {
      const suggestedInitialAmount = suggestedInitialAmountFromDepth({
        initialAmount,
        depthFraction: quote?.depthFraction,
      });
      return {
        ok: false,
        reason:
          `leg${i + 1} ${from}->${to} not viable` +
          (quote?.error ? `: ${quote.error}` : ""),
        legs: [...legs, leg],
        suggestedInitialAmount,
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

async function retryPreflightWithLiquidityCap({
  dex,
  path,
  initialAmount,
  minInitialAmount = 0,
} = {}) {
  const first = await preflightSwapPath({ dex, path, initialAmount });
  if (first.ok) {
    return {
      ...first,
      initialAmount: Number(initialAmount),
      originalInitialAmount: Number(initialAmount),
      liquidityAdjusted: false,
    };
  }

  const suggested = Number(first.suggestedInitialAmount);
  const min = Number(minInitialAmount);
  if (
    !Number.isFinite(suggested) ||
    suggested <= 0 ||
    suggested >= Number(initialAmount) ||
    (Number.isFinite(min) && suggested < min)
  ) {
    return {
      ...first,
      initialAmount: Number(initialAmount),
      originalInitialAmount: Number(initialAmount),
      liquidityAdjusted: false,
    };
  }

  const second = await preflightSwapPath({
    dex,
    path,
    initialAmount: suggested,
  });
  return {
    ...second,
    initialAmount: suggested,
    originalInitialAmount: Number(initialAmount),
    liquidityAdjusted: true,
    retryReason: first.reason,
    priorPreflight: first,
  };
}

module.exports = {
  TOKEN_DECIMALS,
  LIQUIDITY_RETRY_DEPTH_FRACTION,
  amountToUnits,
  getDirectionalSwapOptions,
  preflightSwapPath,
  retryPreflightWithLiquidityCap,
  suggestedInitialAmountFromDepth,
};
