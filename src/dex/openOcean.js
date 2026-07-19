/**
 * OpenOcean DEX Aggregator — Live Execution on Mantle
 * Replaces Merchant Moe direct router (which has liquidity issues)
 */
/* global URLSearchParams */
const { ethers } = require("ethers");
const { transactionGasMnt } = require("../metrics/gasCost");
const {
  describeTransactionError,
  preflightTransaction,
} = require("./transactionPreflight");

const ADDRESSES = {
  WMNT: "0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8",
  mETH: "0xcDA86A272531e8640cD7F1a92c01839911B90bb0",
  USDT: "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE",
  // USDT0 (LayerZero Tether) is our primary stable hub. It was missing
  // here, so getQuote("USDT0", ...) sent the literal "USDT0" string as the
  // token address and the aggregator returned code=400 "No intoken
  // information obtained". Verified on-chain: with the address present,
  // USDT0->WMNT/mETH route cleanly where the Merchant Moe multi-hop can't.
  USDT0: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
  USDY: "0x5bE26527e817998A7206475496fDE1E68957c5A6",
};

// Token decimals on Mantle. USDT and USDT0 are 6-decimal; everything else
// we route (WMNT, mETH, WETH, mUSD) is 18. Centralised so quote-output
// parsing and balance reads stay correct as tokens are added.
const DECIMALS = { USDT: 6, USDT0: 6 };
const DEFAULT_ESTIMATED_GAS = 500000n;
const MAX_SWAP_GAS_LIMIT = 2000000n;
const OPENOCEAN_SLIPPAGE_BPS = 30;
const DEFAULT_ROUTER_ALLOWLIST = String(
  process.env.OPENOCEAN_MANTLE_ROUTERS || ""
)
  .split(",")
  .map((address) => address.trim())
  .filter((address) => ethers.isAddress(address))
  .map((address) => ethers.getAddress(address));

function isAllowedRouter(address, allowlist = []) {
  try {
    const normalized = ethers.getAddress(address);
    return allowlist.some((allowed) => ethers.getAddress(allowed) === normalized);
  } catch {
    return false;
  }
}

function decimalsOf(symbol) {
  return DECIMALS[symbol] ?? 18;
}

function rawAmountForToken(amount, symbol) {
  const decimals = decimalsOf(symbol);
  const [whole, fraction = ""] = String(amount).split(".");
  const normalized = decimals
    ? `${whole}.${fraction.slice(0, decimals) || "0"}`
    : whole;
  return ethers.parseUnits(normalized, decimals);
}

function boundedGasLimit(estimatedGas) {
  let estimate = DEFAULT_ESTIMATED_GAS;
  try {
    const parsed = BigInt(estimatedGas ?? DEFAULT_ESTIMATED_GAS);
    if (parsed > 0n) estimate = parsed;
  } catch {
    estimate = DEFAULT_ESTIMATED_GAS;
  }
  const padded = estimate * 2n;
  return padded > MAX_SWAP_GAS_LIMIT ? MAX_SWAP_GAS_LIMIT : padded;
}

class OpenOceanDEX {
  constructor(provider, wallet, options = {}) {
    this.provider = provider;
    this.wallet = wallet;
    this.dryRun = options.dryRun !== false;
    this.baseUrl = "https://open-api.openocean.finance/v3/mantle";
    // Do not let an external quote service choose the approval spender. The
    // production workflow keeps this adapter disabled, but any manual
    // re-enable must also pin a verified Mantle router address explicitly.
    this.routerAllowlist = options.routerAllowlist || DEFAULT_ROUTER_ALLOWLIST;
    this.tokenContractFactory =
      options.tokenContractFactory ||
      ((address, abi, signerOrProvider) =>
        new ethers.Contract(address, abi, signerOrProvider));
  }

  async getQuote(tokenIn, tokenOut, amountIn) {
    const inAddr = ADDRESSES[tokenIn] || tokenIn;
    const outAddr = ADDRESSES[tokenOut] || tokenOut;
    const amountStr = ethers.formatUnits(
      rawAmountForToken(ethers.formatEther(amountIn), tokenIn),
      decimalsOf(tokenIn)
    );

    const url =
      `${this.baseUrl}/swap_quote?` +
      new URLSearchParams({
        inTokenAddress: inAddr,
        outTokenAddress: outAddr,
        amount: amountStr,
        gasPrice: "0.02",
        slippage: String(OPENOCEAN_SLIPPAGE_BPS / 100),
        account:
          this.wallet?.address || "0x0000000000000000000000000000000000000000",
      });

    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (resp.ok === false) {
      return { viable: false, error: `Aggregator HTTP ${resp.status}` };
    }
    const data = await resp.json();

    if (data.code !== 200 || !data.data) {
      return { viable: false, error: data.data?.error || "No route found" };
    }

    let outAmountRaw;
    let minimumOutRaw;
    try {
      outAmountRaw = BigInt(data.data.outAmount);
      minimumOutRaw = data.data.minOutAmount
        ? BigInt(data.data.minOutAmount)
        : (outAmountRaw * BigInt(10000 - OPENOCEAN_SLIPPAGE_BPS)) / 10000n;
      if (
        outAmountRaw <= 0n ||
        minimumOutRaw <= 0n ||
        minimumOutRaw > outAmountRaw
      ) {
        return { viable: false, error: "Aggregator returned invalid output" };
      }
    } catch {
      return { viable: false, error: "Aggregator returned invalid output" };
    }
    const outAmount = Number(
      ethers.formatUnits(outAmountRaw, decimalsOf(tokenOut))
    );
    const minimumOut = Number(
      ethers.formatUnits(minimumOutRaw, decimalsOf(tokenOut))
    );
    const inAmount = parseFloat(amountStr);
    let txValue;
    try {
      txValue = BigInt(data.data.value ?? 0);
    } catch {
      return { viable: false, error: "Aggregator returned invalid transaction value" };
    }
    if (
      !ethers.isAddress(data.data.to) ||
      !isAllowedRouter(data.data.to, this.routerAllowlist) ||
      typeof data.data.data !== "string" ||
      !/^0x[0-9a-f]+$/i.test(data.data.data) ||
      txValue !== 0n
    ) {
      return { viable: false, error: "Aggregator returned invalid or untrusted transaction" };
    }

    return {
      tokenIn,
      tokenOut,
      amountIn: inAmount,
      amountInRaw: rawAmountForToken(amountStr, tokenIn),
      estimatedOut: outAmount,
      minimumOut,
      minimumOutRaw,
      slippageBps: OPENOCEAN_SLIPPAGE_BPS,
      price: outAmount / inAmount,
      priceImpact: parseFloat(
        data.data.priceImpact ?? data.data.price_impact ?? 0
      ),
      viable: true,
      routerAddress: data.data.to,
      txData: data.data.data,
      txValue: "0",
      estimatedGas: data.data.estimatedGas,
    };
  }

  async executeSwap(tokenIn, tokenOut, amountIn, options = {}) {
    if (!ADDRESSES[tokenIn] || !ADDRESSES[tokenOut]) {
      throw new Error(
        `TOKEN_NOT_WHITELISTED: tokenIn=${tokenIn} tokenOut=${tokenOut}`
      );
    }
    const quote = options.quote || (await this.getQuote(tokenIn, tokenOut, amountIn));
    if (!quote.viable) {
      return {
        ...quote,
        executed: false,
        executionBlocked: true,
        reason: quote.error,
      };
    }
    if (!isAllowedRouter(quote.routerAddress, this.routerAllowlist)) {
      return {
        ...quote,
        executed: false,
        executionBlocked: true,
        reason: "OpenOcean route target is not an approved Mantle router",
      };
    }

    if (this.dryRun) {
      return {
        ...quote,
        executed: false,
        reason: "DRY_RUN mode",
        wouldExecute: true,
      };
    }

    let setupGasCostMnt = 0;

    // Auto-wrap MNT → WMNT if needed
    const inAddr = ADDRESSES[tokenIn] || tokenIn;
    if (tokenIn === "WMNT") {
      const wmntContract = this.tokenContractFactory(
        ADDRESSES.WMNT,
        [
          "function balanceOf(address) view returns (uint256)",
          "function deposit() payable",
        ],
        this.wallet
      );
      const wmntBal = await wmntContract.balanceOf(this.wallet.address);
      if (wmntBal < amountIn) {
        const deficit = amountIn - wmntBal;
        console.log(`   Wrapping ${ethers.formatEther(deficit)} MNT → WMNT...`);
        const wrapTx = await wmntContract.deposit({ value: deficit });
        const wrapReceipt = await wrapTx.wait();
        setupGasCostMnt += transactionGasMnt(wrapReceipt);
        console.log(`   ✅ Wrapped successfully`);
      }
    }

    // Approve
    const tokenContract = this.tokenContractFactory(
      inAddr,
      [
        "function approve(address,uint256) returns (bool)",
        "function allowance(address,address) view returns (uint256)",
      ],
      this.wallet
    );

    const allowance = await tokenContract.allowance(
      this.wallet.address,
      quote.routerAddress
    );
    const approvalAmount = quote.amountInRaw;
    if (allowance < approvalAmount) {
      console.log(`   Approving ${tokenIn} to OpenOcean router...`);
      const appTx = await tokenContract.approve(
        quote.routerAddress,
        approvalAmount
      );
      const approvalReceipt = await appTx.wait();
      setupGasCostMnt += transactionGasMnt(approvalReceipt);
    }

    const transaction = {
      to: quote.routerAddress,
      data: quote.txData,
      value: quote.txValue || "0",
    };

    // The OpenOcean API can return a fresh-looking quote whose minOut is
    // already impossible. Never learn that by broadcasting a real swap.
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
      };
    }

    console.log(
      `   Sending swap TX: ${
        quote.amountIn
      } ${tokenIn} → ${quote.estimatedOut.toFixed(6)} ${tokenOut}`
    );
    try {
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
          reason: "swap transaction reverted on-chain",
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
        reason: `swap broadcast rejected: ${describeTransactionError(error)}`,
        gasCostMnt: setupGasCostMnt + transactionGasMnt(receipt),
      };
    }
  }

  async getBalances(address) {
    const addr = address || this.wallet?.address;
    const balances = {};

    const nativeBalance = await this.provider.getBalance(addr);
    balances.MNT = parseFloat(ethers.formatEther(nativeBalance));

    for (const [symbol, tokenAddr] of Object.entries(ADDRESSES)) {
      const decimals = decimalsOf(symbol);
      const contract = new ethers.Contract(
        tokenAddr,
        ["function balanceOf(address) view returns (uint256)"],
        this.provider
      );
      const bal = await contract.balanceOf(addr);
      balances[symbol] = parseFloat(ethers.formatUnits(bal, decimals));
    }
    return balances;
  }
}

module.exports = {
  OpenOceanDEX,
  ADDRESSES,
  DECIMALS,
  MAX_SWAP_GAS_LIMIT,
  OPENOCEAN_SLIPPAGE_BPS,
  isAllowedRouter,
  boundedGasLimit,
  decimalsOf,
  rawAmountForToken,
};
