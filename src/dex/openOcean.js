/**
 * OpenOcean DEX Aggregator — Live Execution on Mantle
 * Replaces Merchant Moe direct router (which has liquidity issues)
 */
const { ethers } = require("ethers");

const ADDRESSES = {
  WMNT: "0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8",
  mETH: "0xcDA86A272531e8640cD7F1a92c01839911B90bb0",
  USDT: "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE",
  USDY: "0x5bE26527e817998A7206475496fDE1E68957c5A6",
};

class OpenOceanDEX {
  constructor(provider, wallet, options = {}) {
    this.provider = provider;
    this.wallet = wallet;
    this.dryRun = options.dryRun !== false;
    this.baseUrl = "https://open-api.openocean.finance/v3/mantle";
  }

  async getQuote(tokenIn, tokenOut, amountIn) {
    const inAddr = ADDRESSES[tokenIn] || tokenIn;
    const outAddr = ADDRESSES[tokenOut] || tokenOut;
    const amountStr = ethers.formatEther(amountIn);

    const url = `${this.baseUrl}/swap_quote?` + new URLSearchParams({
      inTokenAddress: inAddr,
      outTokenAddress: outAddr,
      amount: amountStr,
      gasPrice: "0.02",
      slippage: "1",
      account: this.wallet?.address || "0x0000000000000000000000000000000000000000",
    });

    const resp = await fetch(url);
    const data = await resp.json();

    if (data.code !== 200 || !data.data) {
      return { viable: false, error: data.data?.error || "No route found" };
    }

    const outAmount = parseFloat(data.data.outAmount) / (tokenOut === "USDT" ? 1e6 : 1e18);
    const inAmount = parseFloat(amountStr);

    return {
      tokenIn, tokenOut,
      amountIn: inAmount,
      estimatedOut: outAmount,
      price: outAmount / inAmount,
      priceImpact: parseFloat(data.data.priceImpact || 0),
      viable: true,
      routerAddress: data.data.to,
      txData: data.data.data,
      txValue: data.data.value,
      estimatedGas: data.data.estimatedGas,
    };
  }

  async executeSwap(tokenIn, tokenOut, amountIn) {
    const quote = await this.getQuote(tokenIn, tokenOut, amountIn);
    if (!quote.viable) {
      return { ...quote, executed: false, reason: quote.error };
    }

    if (this.dryRun) {
      return { ...quote, executed: false, reason: "DRY_RUN mode", wouldExecute: true };
    }

    // Approve
    const inAddr = ADDRESSES[tokenIn] || tokenIn;
    const tokenContract = new ethers.Contract(inAddr, [
      "function approve(address,uint256) returns (bool)",
      "function allowance(address,address) view returns (uint256)"
    ], this.wallet);

    const allowance = await tokenContract.allowance(this.wallet.address, quote.routerAddress);
    if (allowance < amountIn) {
      console.log(`   Approving ${tokenIn} to OpenOcean router...`);
      const appTx = await tokenContract.approve(quote.routerAddress, ethers.MaxUint256);
      await appTx.wait();
    }

    // Execute
    console.log(`   Sending swap TX: ${quote.amountIn} ${tokenIn} → ${quote.estimatedOut.toFixed(6)} ${tokenOut}`);
    const tx = await this.wallet.sendTransaction({
      to: quote.routerAddress,
      data: quote.txData,
      value: quote.txValue || "0",
      gasLimit: BigInt(quote.estimatedGas || 500000) * 2n
    });

    const receipt = await tx.wait();
    return {
      ...quote,
      executed: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    };
  }

  async getBalances(address) {
    const addr = address || this.wallet?.address;
    const balances = {};

    const nativeBalance = await this.provider.getBalance(addr);
    balances.MNT = parseFloat(ethers.formatEther(nativeBalance));

    for (const [symbol, tokenAddr] of Object.entries(ADDRESSES)) {
      const decimals = symbol === "USDT" ? 6 : 18;
      const contract = new ethers.Contract(tokenAddr, ["function balanceOf(address) view returns (uint256)"], this.provider);
      const bal = await contract.balanceOf(addr);
      balances[symbol] = parseFloat(ethers.formatUnits(bal, decimals));
    }
    return balances;
  }
}

module.exports = { OpenOceanDEX, ADDRESSES };
