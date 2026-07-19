/**
 * Aggregator fallback for directional swaps.
 *
 * WHY: the hand-rolled Merchant Moe LB multi-hop route for risk-on buys
 * (USDT0 -> USDT -> WMNT [-> WETH -> mETH]) fails preflight at the thin
 * `USDT -> WMNT` hop ("leg2 USDT->WMNT not viable"), which is why
 * consensus=true risk-on cycles landed as INTENT_SWAP_NO_EXEC for the
 * 24-Jun RANGING window. The production fallback uses LI.FI's same-chain
 * Mantle route, whose fixed Diamond target and exact calldata are both
 * checked before broadcast. OpenOcean remains an optional diagnostic
 * adapter and is fail-closed unless a router is explicitly pinned.
 *
 * SAFETY: this is a money path. Each adapter is independently gated:
 * LI.FI uses `RWA_LIFI_FALLBACK_ENABLED`; OpenOcean uses
 * `RWA_AGGREGATOR_FALLBACK_ENABLED` and stays default-OFF. The DEX is
 * injectable (`dexFactory`) so the decision/orchestration logic is
 * unit-tested with a mock and no network/chain access.
 *
 * NOTE: adapters receive a parseEther-encoded human amount to preserve the
 * existing fallback interface. Each adapter then converts to its token's
 * actual decimals before requesting a route. The on-chain amount is taken
 * from adapter-validated calldata, never from a float conversion here.
 */
const { ethers } = require("ethers");

/**
 * Attempt a direct fromToken -> toToken swap through the aggregator.
 *
 * @returns {null} when the fallback is disabled (caller keeps its original
 *          failure result), otherwise an object:
 *          { executed: true, via, from, to, amountIn, amountOut, txHash,
 *            blockNumber, legs } on success, or
 *          { executed: false, reason } on a handled failure.
 */
async function attemptAggregatorSwap({
  enabled,
  provider,
  wallet,
  fromToken,
  toToken,
  sourceAmount,
  dexFactory,
  quoteValidator,
  quoteRetryDelayMs = 200,
  providerName = "aggregator",
  providerVia = "openocean-aggregator",
} = {}) {
  if (!enabled) return null;

  const amount = Number(sourceAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      executed: false,
      executionBlocked: true,
      reason: `${providerName}: non-positive source amount`,
    };
  }
  if (!fromToken || !toToken || fromToken === toToken) {
    return {
      executed: false,
      executionBlocked: true,
      reason: `${providerName}: invalid token pair`,
    };
  }

  let dex;
  try {
    const makeDex =
      dexFactory ||
      ((p, w) => {
        const { OpenOceanDEX } = require("./openOcean");
        return new OpenOceanDEX(p, w, { dryRun: false });
      });
    dex = makeDex(provider, wallet);
  } catch (err) {
    return {
      executed: false,
      executionBlocked: true,
      reason: `${providerName}: init failed ${String(err.message || err).slice(0, 60)}`,
    };
  }

  if (!dex || typeof dex.executeSwap !== "function") {
    return {
      executed: false,
      executionBlocked: true,
      reason: `${providerName}: dex has no executeSwap()`,
    };
  }

  let amountWei;
  try {
    // OpenOcean's API contract: it formatEther()s this back to a human
    // amount string, so encode with parseEther for every token.
    amountWei = ethers.parseEther(amount.toString());
  } catch (err) {
    return {
      executed: false,
      executionBlocked: true,
      reason: `${providerName}: bad amount ${String(err.message || err).slice(0, 40)}`,
    };
  }

  try {
    let validatedQuote = null;
    if (typeof quoteValidator === "function") {
      if (typeof dex.getQuote !== "function") {
        return {
          executed: false,
          executionBlocked: true,
          reason: `${providerName}: quote validation unavailable`,
        };
      }
      let quote;
      let quoteError;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          quote = await dex.getQuote(fromToken, toToken, amountWei);
          quoteError = null;
          break;
        } catch (error) {
          quoteError = error;
          if (attempt < 2 && quoteRetryDelayMs > 0) {
            await new Promise((resolve) =>
              setTimeout(resolve, quoteRetryDelayMs)
            );
          }
        }
      }
      if (!quote && quoteError) throw quoteError;
      if (!quote?.viable || !Number.isFinite(Number(quote.estimatedOut))) {
        return {
          executed: false,
          executionBlocked: true,
          reason: `${providerName}: quote unavailable ${String(
            quote?.error || "invalid output"
          ).slice(0, 60)}`,
        };
      }
      const executableAmountOut = Number(
        quote.minimumOut ?? quote.estimatedOut
      );
      const profitabilityGate = await quoteValidator({
        amountIn: amount,
        amountOut: executableAmountOut,
        quotedAmountOut: Number(quote.estimatedOut),
        quote,
      });
      if (!profitabilityGate || profitabilityGate.allowed !== true) {
        return {
          executed: false,
          reason:
            profitabilityGate?.reason ||
            `${providerName}: quote rejected by economic gate`,
          profitabilityGate: profitabilityGate || { allowed: false },
          quote,
        };
      }
      validatedQuote = quote;
    }

    let balancesBefore = null;
    if (typeof dex.getBalances === "function") {
      try {
        balancesBefore = await dex.getBalances(wallet?.address);
      } catch {
        balancesBefore = null;
      }
    }
    const res = await dex.executeSwap(
      fromToken,
      toToken,
      amountWei,
      validatedQuote ? { quote: validatedQuote } : undefined
    );
    if (res && res.executed === true && res.txHash) {
      let actualAmountIn = amount;
      let actualAmountOut = res.estimatedOut ?? res.amountOut ?? null;
      let measuredFromWallet = false;
      if (balancesBefore && typeof dex.getBalances === "function") {
        try {
          const balancesAfter = await dex.getBalances(wallet?.address);
          const measuredIn =
            Number(balancesBefore[fromToken]) - Number(balancesAfter[fromToken]);
          const measuredOut =
            Number(balancesAfter[toToken]) - Number(balancesBefore[toToken]);
          if (Number.isFinite(measuredIn) && measuredIn > 0) {
            actualAmountIn = measuredIn;
          }
          if (Number.isFinite(measuredOut) && measuredOut > 0) {
            actualAmountOut = measuredOut;
            measuredFromWallet = true;
          }
        } catch {
          // Receipt is final; retain the quote as an explicitly best-effort fallback.
        }
      }
      return {
        executed: true,
        via: providerVia,
        from: fromToken,
        to: toToken,
        amountIn: actualAmountIn,
        amountOut: actualAmountOut,
        amountSource: measuredFromWallet
          ? "wallet-balance-delta"
          : "aggregator-quote",
        txHash: res.txHash,
        blockNumber: res.blockNumber ?? null,
        gasCostMnt: Number(res.gasCostMnt) || 0,
        legs: [
          {
            leg: 1,
            from: fromToken,
            to: toToken,
            txHash: res.txHash,
            amountIn: actualAmountIn,
            amountOut: actualAmountOut,
            op: "aggregator-swap",
            gasCostMnt: Number(res.gasCostMnt) || 0,
          },
        ],
      };
    }
    return {
      executed: false,
      // At this point a route adapter has been asked to execute and did not
      // produce a receipt. Surface that deterministic stop to the tier
      // classifier instead of letting the UI relabel it as an unproven intent.
      executionBlocked:
        res?.executionBlocked === true || res?.executed === false,
      failedTxHash: res?.failedTxHash || null,
      quote: res?.viable ? res : null,
      reason: `${providerName}: ${String(res?.reason || "not-executed").slice(0, 120)}`,
    };
  } catch (err) {
    return {
      executed: false,
      executionBlocked: true,
      reason: `${providerName}: threw ${String(err.message || err).slice(0, 100)}`,
    };
  }
}

module.exports = { attemptAggregatorSwap };
