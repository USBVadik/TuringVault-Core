/**
 * Aggregator fallback for directional swaps.
 *
 * WHY: the hand-rolled Merchant Moe LB multi-hop route for risk-on buys
 * (USDT0 -> USDT -> WMNT [-> WETH -> mETH]) fails preflight at the thin
 * `USDT -> WMNT` hop ("leg2 USDT->WMNT not viable"), which is why
 * consensus=true risk-on cycles landed as INTENT_SWAP_NO_EXEC for the
 * 24-Jun RANGING window. OpenOcean aggregates liquidity across every
 * Mantle venue and can fill the direct from->to swap that the
 * single-venue multi-hop cannot. `openOcean.js` already documents itself
 * as the replacement "(Merchant Moe direct router ... has liquidity
 * issues)" and is the live-execution engine in integratedOrchestrator.
 *
 * SAFETY: this is a money path. The fallback is gated behind
 * `RWA_AGGREGATOR_FALLBACK_ENABLED` (default OFF) — when disabled the
 * caller keeps its original preflight-failed result byte-for-byte. The
 * DEX is injectable (`dexFactory`) so the decision/orchestration logic is
 * unit-tested with a mock and no network/chain access.
 *
 * NOTE: OpenOceanDEX.getQuote consumes `ethers.formatEther(amountWei)` as
 * the human amount string for the aggregator API, so the source amount is
 * encoded with parseEther regardless of token decimals to match that
 * contract. The real on-chain amount is taken from the API-built calldata.
 * Token symbols must exist in OpenOcean's ADDRESSES map (USDT0 was added in
 * the same change). Verified on-chain via read-only quote: USDT0->WMNT and
 * USDT0->mETH route cleanly through OpenOcean. A single real swap should
 * still be smoke-tested before the flag is relied on in production.
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
} = {}) {
  if (!enabled) return null;

  const amount = Number(sourceAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { executed: false, reason: "aggregator: non-positive source amount" };
  }
  if (!fromToken || !toToken || fromToken === toToken) {
    return { executed: false, reason: "aggregator: invalid token pair" };
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
      reason: `aggregator: init failed ${String(err.message || err).slice(0, 60)}`,
    };
  }

  if (!dex || typeof dex.executeSwap !== "function") {
    return { executed: false, reason: "aggregator: dex has no executeSwap()" };
  }

  let amountWei;
  try {
    // OpenOcean's API contract: it formatEther()s this back to a human
    // amount string, so encode with parseEther for every token.
    amountWei = ethers.parseEther(amount.toString());
  } catch (err) {
    return {
      executed: false,
      reason: `aggregator: bad amount ${String(err.message || err).slice(0, 40)}`,
    };
  }

  try {
    const res = await dex.executeSwap(fromToken, toToken, amountWei);
    if (res && res.executed === true && res.txHash) {
      return {
        executed: true,
        via: "openocean-aggregator",
        from: fromToken,
        to: toToken,
        amountIn: amount,
        amountOut: res.estimatedOut ?? res.amountOut ?? null,
        txHash: res.txHash,
        blockNumber: res.blockNumber ?? null,
        legs: [
          {
            leg: 1,
            from: fromToken,
            to: toToken,
            txHash: res.txHash,
            amountIn: amount,
            amountOut: res.estimatedOut ?? res.amountOut ?? null,
            op: "aggregator-swap",
          },
        ],
      };
    }
    return {
      executed: false,
      reason: `aggregator: ${String(res?.reason || "not-executed").slice(0, 80)}`,
    };
  } catch (err) {
    return {
      executed: false,
      reason: `aggregator: threw ${String(err.message || err).slice(0, 60)}`,
    };
  }
}

module.exports = { attemptAggregatorSwap };
