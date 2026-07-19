/* global URLSearchParams */
const { ethers } = require("ethers");
const { transactionGasMnt } = require("../metrics/gasCost");
const {
  ADDRESSES,
  boundedGasLimit,
  decimalsOf,
  rawAmountForToken,
} = require("./openOcean");
const {
  asBigInt,
  describeTransactionError,
  preflightTransaction,
} = require("./transactionPreflight");

const MANTLE_CHAIN_ID = 5000;
const LIFI_SLIPPAGE = 0.005;
const MAX_QUOTE_AGE_MS = 45_000;
// Canonical LI.FI Diamond deployment. Restricting both the approval spender
// and transaction target prevents a quote API response from redirecting a
// hot-wallet approval to an arbitrary contract.
const LIFI_DIAMOND = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE";

const ERC20_ABI = [
  "function approve(address spender,uint256 amount) returns (bool)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

function sameAddress(left, right) {
  try {
    return ethers.getAddress(left) === ethers.getAddress(right);
  } catch {
    return false;
  }
}

function validTransaction(transaction) {
  return (
    transaction &&
    ethers.isAddress(transaction.to) &&
    typeof transaction.data === "string" &&
    /^0x[0-9a-f]+$/i.test(transaction.data)
  );
}

function quoteExpired(quote) {
  return Boolean(
    quote?.quotedAt && Date.now() - Number(quote.quotedAt) > MAX_QUOTE_AGE_MS
  );
}

class LifiDEX {
  constructor(provider, wallet, options = {}) {
    this.provider = provider;
    this.wallet = wallet;
    this.dryRun = options.dryRun !== false;
    this.baseUrl = options.baseUrl || "https://li.quest/v1/quote";
    this.slippage = Number(options.slippage ?? LIFI_SLIPPAGE);
    this.tokenContractFactory =
      options.tokenContractFactory ||
      ((address, signerOrProvider) =>
        new ethers.Contract(address, ERC20_ABI, signerOrProvider));
  }

  async getQuote(tokenIn, tokenOut, amountIn) {
    const inAddr = ADDRESSES[tokenIn];
    const outAddr = ADDRESSES[tokenOut];
    if (!inAddr || !outAddr) {
      return { viable: false, error: "LI.FI token is not whitelisted" };
    }

    let amountInRaw;
    let amountStr;
    try {
      // aggregatorFallback passes a parseEther-encoded human amount for all
      // tokens. Keep that established adapter contract, then encode LI.FI's
      // smallest-unit amount with the real token decimals.
      amountStr = ethers.formatEther(amountIn);
      amountInRaw = rawAmountForToken(amountStr, tokenIn);
    } catch {
      return { viable: false, error: "LI.FI received invalid input amount" };
    }

    const query = new URLSearchParams({
      fromChain: String(MANTLE_CHAIN_ID),
      toChain: String(MANTLE_CHAIN_ID),
      fromToken: inAddr,
      toToken: outAddr,
      fromAmount: amountInRaw.toString(),
      fromAddress:
        this.wallet?.address || "0x0000000000000000000000000000000000000000",
      toAddress:
        this.wallet?.address || "0x0000000000000000000000000000000000000000",
      slippage: String(this.slippage),
    });

    let response;
    let payload;
    try {
      response = await fetch(`${this.baseUrl}?${query}`, {
        signal: AbortSignal.timeout(10_000),
      });
      payload = await response.json();
    } catch (error) {
      return {
        viable: false,
        error: `LI.FI quote request failed: ${describeTransactionError(error)}`,
      };
    }
    if (!response.ok || !payload) {
      return {
        viable: false,
        error: `LI.FI HTTP ${response?.status || "error"}: ${String(
          payload?.message || "quote unavailable"
        ).slice(0, 100)}`,
      };
    }

    const action = payload.action || {};
    const estimate = payload.estimate || {};
    const transaction = payload.transactionRequest;
    if (
      Number(action.fromChainId) !== MANTLE_CHAIN_ID ||
      Number(action.toChainId) !== MANTLE_CHAIN_ID ||
      !sameAddress(action.fromToken?.address, inAddr) ||
      !sameAddress(action.toToken?.address, outAddr) ||
      String(action.fromAmount) !== amountInRaw.toString() ||
      !sameAddress(estimate.approvalAddress, LIFI_DIAMOND) ||
      !validTransaction(transaction) ||
      !sameAddress(transaction.to, LIFI_DIAMOND) ||
      (action.fromAddress && !sameAddress(action.fromAddress, this.wallet?.address)) ||
      (action.toAddress && !sameAddress(action.toAddress, this.wallet?.address)) ||
      (transaction.from && !sameAddress(transaction.from, this.wallet?.address)) ||
      (transaction.chainId != null && Number(transaction.chainId) !== MANTLE_CHAIN_ID)
    ) {
      return { viable: false, error: "LI.FI returned an invalid route payload" };
    }

    const txValue = asBigInt(transaction.value);
    if (txValue !== 0n) {
      return { viable: false, error: "LI.FI ERC-20 route requires native value" };
    }

    let outAmountRaw;
    let minimumOutRaw;
    try {
      outAmountRaw = BigInt(estimate.toAmount);
      minimumOutRaw = BigInt(estimate.toAmountMin);
    } catch {
      return { viable: false, error: "LI.FI returned invalid output values" };
    }
    if (outAmountRaw <= 0n || minimumOutRaw <= 0n || minimumOutRaw > outAmountRaw) {
      return { viable: false, error: "LI.FI returned invalid output bounds" };
    }

    const outDecimals = decimalsOf(tokenOut);
    const outAmount = Number(ethers.formatUnits(outAmountRaw, outDecimals));
    const minimumOut = Number(ethers.formatUnits(minimumOutRaw, outDecimals));
    const inAmount = Number(amountStr);
    if (!Number.isFinite(outAmount) || !Number.isFinite(minimumOut) || !(inAmount > 0)) {
      return { viable: false, error: "LI.FI returned non-numeric quote values" };
    }

    return {
      viable: true,
      tokenIn,
      tokenOut,
      amountIn: inAmount,
      amountInRaw,
      estimatedOut: outAmount,
      minimumOut,
      minimumOutRaw,
      price: outAmount / inAmount,
      priceImpact: 0,
      slippageBps: Math.round(this.slippage * 10_000),
      approvalAddress: estimate.approvalAddress,
      routerAddress: transaction.to,
      txData: transaction.data,
      txValue: txValue.toString(),
      estimatedGas: transaction.gasLimit || null,
      routeTool: String(payload.tool || "lifi"),
      quotedAt: Date.now(),
    };
  }

  async executeSwap(tokenIn, tokenOut, amountIn, options = {}) {
    const quote = options.quote || (await this.getQuote(tokenIn, tokenOut, amountIn));
    if (!quote.viable) {
      return {
        ...quote,
        executed: false,
        executionBlocked: true,
        reason: quote.error,
      };
    }
    if (quoteExpired(quote)) {
      return {
        ...quote,
        executed: false,
        executionBlocked: true,
        reason: "LI.FI quote expired before execution",
      };
    }
    if (this.dryRun) {
      return { ...quote, executed: false, wouldExecute: true, reason: "DRY_RUN mode" };
    }

    let setupGasCostMnt = 0;
    try {
      const token = this.tokenContractFactory(ADDRESSES[tokenIn], this.wallet);
      const allowance = await token.allowance(this.wallet.address, quote.approvalAddress);
      if (allowance < quote.amountInRaw) {
        console.log(`   Approving ${tokenIn} to LI.FI route...`);
        const approvalTx = await token.approve(quote.approvalAddress, quote.amountInRaw);
        const approvalReceipt = await approvalTx.wait();
        if (Number(approvalReceipt?.status) !== 1) {
          return {
            ...quote,
            executed: false,
            executionBlocked: true,
            failedTxHash: approvalReceipt?.hash || approvalTx.hash || null,
            reason: "LI.FI approval transaction reverted on-chain",
          };
        }
        setupGasCostMnt += transactionGasMnt(approvalReceipt);
      }
    } catch (error) {
      return {
        ...quote,
        executed: false,
        executionBlocked: true,
        reason: `LI.FI approval failed: ${describeTransactionError(error)}`,
      };
    }

    // An exact approval may consume most of a short-lived quote window. Do
    // not send a route that was fresh before approval but stale by the time
    // its calldata is ready for the final simulation.
    if (quoteExpired(quote)) {
      return {
        ...quote,
        executed: false,
        executionBlocked: true,
        reason: "LI.FI quote expired while preparing token approval",
        gasCostMnt: setupGasCostMnt,
      };
    }

    const transaction = {
      to: quote.routerAddress,
      data: quote.txData,
      value: quote.txValue,
    };
    const preflight = await preflightTransaction({
      provider: this.provider || this.wallet?.provider,
      walletAddress: this.wallet?.address,
      transaction,
    });
    if (!preflight.ok) {
      return {
        ...quote,
        executed: false,
        executionBlocked: true,
        reason: `transaction preflight rejected: ${preflight.reason}`,
        gasCostMnt: setupGasCostMnt,
      };
    }

    try {
      console.log(
        `   Sending LI.FI ${quote.routeTool} swap: ${quote.amountIn} ${tokenIn} → ${quote.estimatedOut.toFixed(6)} ${tokenOut}`
      );
      const tx = await this.wallet.sendTransaction({
        ...transaction,
        gasLimit: boundedGasLimit(preflight.estimatedGas),
      });
      const receipt = await tx.wait();
      if (Number(receipt?.status) !== 1) {
        return {
          ...quote,
          executed: false,
          executionBlocked: true,
          failedTxHash: receipt?.hash || tx.hash || null,
          reason: "LI.FI swap transaction reverted on-chain",
          gasCostMnt: setupGasCostMnt + transactionGasMnt(receipt),
        };
      }
      return {
        ...quote,
        executed: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        gasPriceWei: String(receipt.gasPrice ?? receipt.effectiveGasPrice ?? 0),
        gasCostMnt: setupGasCostMnt + transactionGasMnt(receipt),
      };
    } catch (error) {
      const receipt = error?.receipt;
      return {
        ...quote,
        executed: false,
        executionBlocked: true,
        failedTxHash: receipt?.hash || null,
        reason: `LI.FI swap broadcast rejected: ${describeTransactionError(error)}`,
        gasCostMnt: setupGasCostMnt + transactionGasMnt(receipt),
      };
    }
  }

  async getBalances(address) {
    const holder = address || this.wallet?.address;
    const balances = {};
    balances.MNT = Number(ethers.formatEther(await this.provider.getBalance(holder)));
    await Promise.all(
      Object.entries(ADDRESSES).map(async ([symbol, tokenAddress]) => {
        const token = this.tokenContractFactory(tokenAddress, this.provider);
        const raw = await token.balanceOf(holder);
        balances[symbol] = Number(ethers.formatUnits(raw, decimalsOf(symbol)));
      })
    );
    return balances;
  }
}

module.exports = {
  LifiDEX,
  LIFI_SLIPPAGE,
  MANTLE_CHAIN_ID,
  MAX_QUOTE_AGE_MS,
  LIFI_DIAMOND,
};
