/**
 * Read-only transaction simulation used by every external swap adapter.
 *
 * Quotes are not execution proof. An aggregator can return calldata whose
 * minimum output is already impossible at the latest chain state, so this
 * guard must run immediately before a wallet broadcasts it.
 */

function asBigInt(value, fallback = 0n) {
  try {
    return value == null ? fallback : BigInt(value);
  } catch {
    return fallback;
  }
}

function describeTransactionError(error) {
  const detail =
    error?.reason ||
    error?.shortMessage ||
    error?.info?.error?.message ||
    error?.error?.message ||
    error?.message ||
    String(error || "unknown transaction error");
  return String(detail).replace(/\s+/g, " ").slice(0, 180);
}

/**
 * Simulate the exact request the wallet would send. This performs no write.
 * `estimateGas` catches most reverts; `call` is a second attempt because some
 * RPCs expose a more useful revert reason through eth_call.
 */
async function preflightTransaction({
  provider,
  walletAddress,
  transaction,
} = {}) {
  if (!provider || !walletAddress || !transaction?.to || !transaction?.data) {
    return {
      ok: false,
      reason: "transaction simulation unavailable: missing provider, wallet, or calldata",
    };
  }

  const request = {
    from: walletAddress,
    to: transaction.to,
    data: transaction.data,
    value: asBigInt(transaction.value),
  };

  try {
    const estimatedGas = await provider.estimateGas(request);
    return { ok: true, estimatedGas: asBigInt(estimatedGas) };
  } catch (estimateError) {
    let reason = describeTransactionError(estimateError);
    try {
      await provider.call(request);
    } catch (callError) {
      reason = describeTransactionError(callError);
    }
    return { ok: false, reason };
  }
}

module.exports = {
  asBigInt,
  describeTransactionError,
  preflightTransaction,
};
