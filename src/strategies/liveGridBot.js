/**
 * TuringVault — Live Grid Trading Bot
 *
 * Uses Odos aggregator for swaps on Mantle.
 * Trades WMNT ↔ USDT based on ranging grid strategy signals.
 *
 * INITIAL FUNDING (2026-05-22T07:30Z):
 *   WMNT: 1.195793 (~$0.81)
 *   USDT: 0.676892 (~$0.68)
 *   Total: ~$1.49
 *   MNT for gas: 3.255
 *   mETH: 0.000823 (not traded)
 */

require("dotenv").config({
  path: require("path").resolve(__dirname, "../../.env"),
});
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const ADDRESSES = {
  WMNT: "0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8",
  USDT: "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE",
  ODOS_ROUTER: "0xD9F4e85489aDCD0bAF0Cd63b4231c6af58c26745",
};

const LOG_PATH = path.resolve(__dirname, "../data/grid_trades.json");
const STATE_PATH = path.resolve(__dirname, "../data/grid_bot_state.json");

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

class LiveGridBot {
  constructor() {
    this.provider = new ethers.JsonRpcProvider("https://rpc.mantle.xyz");
    this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
    this.trades = this._loadTrades();
    this.state = this._loadState();
  }

  _loadTrades() {
    try {
      return JSON.parse(fs.readFileSync(LOG_PATH, "utf8"));
    } catch {
      return [];
    }
  }

  _saveTrades() {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.writeFileSync(LOG_PATH, JSON.stringify(this.trades, null, 2));
  }

  _loadState() {
    try {
      return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    } catch {
      return {
        initialFunding: {
          WMNT: 1.195793540372515899,
          USDT: 0.676892,
          MNT_gas: 3.255073,
          timestamp: "2026-05-22T07:30:00Z",
          mntPriceUsd: 0.677,
        },
        position: "SPLIT", // WMNT_HEAVY | USDT_HEAVY | SPLIT
        cycleCount: 0,
        totalSwaps: 0,
        totalGasSpent: 0,
      };
    }
  }

  _saveState() {
    fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify(this.state, null, 2));
  }

  async getBalances() {
    const wmnt = new ethers.Contract(ADDRESSES.WMNT, ERC20_ABI, this.provider);
    const usdt = new ethers.Contract(ADDRESSES.USDT, ERC20_ABI, this.provider);
    const [wmntBal, usdtBal, mntBal] = await Promise.all([
      wmnt.balanceOf(this.wallet.address),
      usdt.balanceOf(this.wallet.address),
      this.provider.getBalance(this.wallet.address),
    ]);
    return {
      WMNT: parseFloat(ethers.formatEther(wmntBal)),
      USDT: parseFloat(ethers.formatUnits(usdtBal, 6)),
      MNT: parseFloat(ethers.formatEther(mntBal)),
    };
  }

  async getMntPrice() {
    // Primary: Odos quote (1 WMNT → USDT)
    try {
      const resp = await fetch("https://api.odos.xyz/sor/quote/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chainId: 5000,
          inputTokens: [
            { tokenAddress: ADDRESSES.WMNT, amount: "1000000000000000000" },
          ],
          outputTokens: [{ tokenAddress: ADDRESSES.USDT, proportion: 1 }],
          userAddr: this.wallet.address,
          slippageLimitPercent: 1,
          compact: true,
        }),
      });
      const data = await resp.json();
      if (data?.outAmounts?.[0]) return parseInt(data.outAmounts[0]) / 1e6;
    } catch {}
    // Fallback: CoinGecko
    try {
      const resp = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=mantle&vs_currencies=usd"
      );
      const data = await resp.json();
      if (data?.mantle?.usd) return data.mantle.usd;
    } catch {}
    return 0.72; // hardcoded fallback
  }

  /**
   * Execute swap via Odos
   * @param {string} direction - "BUY_WMNT" or "SELL_WMNT"
   * @param {number} amount - amount of input token (USDT for BUY, WMNT for SELL)
   */
  async executeSwap(direction, amount) {
    let inputToken, outputToken, amountWei;

    if (direction === "BUY_WMNT") {
      inputToken = ADDRESSES.USDT;
      outputToken = ADDRESSES.WMNT;
      amountWei = Math.floor(amount * 1e6).toString(); // USDT 6 decimals
    } else {
      inputToken = ADDRESSES.WMNT;
      outputToken = ADDRESSES.USDT;
      amountWei = ethers.parseEther(amount.toString()).toString();
    }

    // Quote
    const quoteResp = await fetch("https://api.odos.xyz/sor/quote/v2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chainId: 5000,
        inputTokens: [{ tokenAddress: inputToken, amount: amountWei }],
        outputTokens: [{ tokenAddress: outputToken, proportion: 1 }],
        userAddr: this.wallet.address,
        slippageLimitPercent: 1.5,
        compact: true,
      }),
    });
    const quote = await quoteResp.json();
    if (!quote.pathId)
      throw new Error("No route found: " + JSON.stringify(quote));

    // Assemble
    const assembleResp = await fetch("https://api.odos.xyz/sor/assemble", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userAddr: this.wallet.address,
        pathId: quote.pathId,
        simulate: false,
      }),
    });
    const assembled = await assembleResp.json();
    const txData = assembled.transaction;

    // Ensure approval if needed
    if (direction === "BUY_WMNT") {
      const usdt = new ethers.Contract(ADDRESSES.USDT, ERC20_ABI, this.wallet);
      const allowance = await usdt.allowance(
        this.wallet.address,
        ADDRESSES.ODOS_ROUTER
      );
      if (allowance < BigInt(amountWei)) {
        const appTx = await usdt.approve(
          ADDRESSES.ODOS_ROUTER,
          ethers.MaxUint256
        );
        await appTx.wait();
      }
    }

    // Execute
    const tx = await this.wallet.sendTransaction({
      to: txData.to,
      data: txData.data,
      value: txData.value || "0",
      gasLimit: 500000n,
    });
    const receipt = await tx.wait();

    const gasUsed = parseFloat(
      ethers.formatEther(receipt.gasUsed * (receipt.gasPrice || 50000100000n))
    );

    const trade = {
      timestamp: new Date().toISOString(),
      direction,
      inputAmount: amount,
      outputAmount:
        direction === "BUY_WMNT"
          ? parseFloat(ethers.formatEther(BigInt(quote.outAmounts[0])))
          : parseInt(quote.outAmounts[0]) / 1e6,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsedMNT: gasUsed,
      priceImpact: quote.priceImpact,
    };

    this.trades.push(trade);
    this._saveTrades();
    this.state.totalSwaps++;
    this.state.totalGasSpent += gasUsed;
    this._saveState();

    return trade;
  }

  /**
   * Run one grid cycle: check signal and execute if needed
   */
  async runCycle() {
    const { getGridSignal } = require("./rangingGrid");
    const posState = require("./positionState");

    const balances = await this.getBalances();
    const mntPrice = await this.getMntPrice();
    const ethPrice = mntPrice * 3150; // rough ETH/MNT ratio... wrong

    // Actually get ETH price from the grid strategy
    const rawSignal = await getGridSignal();
    const signal = posState.applyPositionAwareness(
      rawSignal,
      rawSignal.channel?.currentPrice
    );

    const portfolioUsd = balances.WMNT * mntPrice + balances.USDT;

    const result = {
      timestamp: new Date().toISOString(),
      cycle: ++this.state.cycleCount,
      balances,
      mntPrice,
      portfolioUsd,
      signal: signal.action,
      reason: signal.reason,
      confidence: signal.confidence,
      channel: rawSignal.channel
        ? {
            support: rawSignal.channel.support,
            resistance: rawSignal.channel.resistance,
            position: rawSignal.channel.channelPosition,
          }
        : null,
      executed: null,
    };

    // Execute based on signal (map mETH→WMNT logic to WMNT→USDT trades)
    // BUY_mETH in our context = BUY WMNT (risk-on)
    // SELL_mETH = SELL WMNT for USDT (risk-off)
    if (signal.action === "BUY_mETH" && signal.confidence >= 0.65) {
      // Buy WMNT with available USDT
      const buyAmount = balances.USDT * 0.8; // Use 80% of USDT
      if (buyAmount >= 0.1) {
        // min $0.10
        console.log(
          `  → Executing BUY_WMNT: $${buyAmount.toFixed(4)} USDT → WMNT`
        );
        const trade = await this.executeSwap("BUY_WMNT", buyAmount);
        result.executed = trade;
        // Update position state
        posState.enterPosition({
          status: "IN_mETH",
          entryPrice: rawSignal.channel?.currentPrice || mntPrice,
          targetExit: signal.targetExit,
          stopLoss: signal.stopLoss,
          allocationPct: 80,
        });
      } else {
        result.executed = {
          skipped: true,
          reason: `USDT too low: $${buyAmount.toFixed(4)}`,
        };
      }
    } else if (
      (signal.action === "SELL_mETH" ||
        signal.overrideReason === "TAKE_PROFIT" ||
        signal.overrideReason === "STOP_LOSS") &&
      signal.confidence >= 0.65
    ) {
      // Sell WMNT for USDT
      const sellAmount = balances.WMNT * 0.8;
      if (sellAmount >= 0.1) {
        // min 0.1 WMNT
        console.log(
          `  → Executing SELL_WMNT: ${sellAmount.toFixed(4)} WMNT → USDT`
        );
        const trade = await this.executeSwap("SELL_WMNT", sellAmount);
        result.executed = trade;
        posState.exitPosition(signal.overrideReason || "GRID_SELL");
      } else {
        result.executed = {
          skipped: true,
          reason: `WMNT too low: ${sellAmount.toFixed(4)}`,
        };
      }
    } else {
      result.executed = {
        skipped: true,
        reason: `Signal: ${signal.action} (conf: ${signal.confidence.toFixed(
          2
        )})`,
      };
    }

    posState.tickCycle();
    posState.updateHWM(rawSignal.channel?.currentPrice || 0);
    this._saveState();

    return result;
  }

  /**
   * Get performance summary
   */
  async getSummary() {
    const balances = await this.getBalances();
    const mntPrice = await this.getMntPrice();
    const currentUsd = balances.WMNT * mntPrice + balances.USDT;
    const initialUsd =
      this.state.initialFunding.WMNT * this.state.initialFunding.mntPriceUsd +
      this.state.initialFunding.USDT;
    const pnl = currentUsd - initialUsd;
    const pnlPct = (pnl / initialUsd) * 100;

    return {
      initial: { ...this.state.initialFunding, totalUsd: initialUsd },
      current: { ...balances, mntPrice, totalUsd: currentUsd },
      pnl: { usd: pnl, pct: pnlPct },
      stats: {
        cycles: this.state.cycleCount,
        swaps: this.state.totalSwaps,
        gasSpent: this.state.totalGasSpent,
        trades: this.trades.length,
      },
    };
  }
}

module.exports = { LiveGridBot };

// CLI execution
if (require.main === module) {
  const bot = new LiveGridBot();
  const cmd = process.argv[2] || "cycle";

  (async () => {
    if (cmd === "cycle") {
      console.log("=== Grid Bot Cycle ===\n");
      const result = await bot.runCycle();
      console.log(JSON.stringify(result, null, 2));
    } else if (cmd === "summary") {
      console.log("=== Grid Bot Summary ===\n");
      const summary = await bot.getSummary();
      console.log(JSON.stringify(summary, null, 2));
    } else if (cmd === "balances") {
      const bal = await bot.getBalances();
      const price = await bot.getMntPrice();
      console.log("Balances:", bal);
      console.log("MNT price:", price, "USD");
      console.log(
        "Portfolio:",
        (bal.WMNT * price + bal.USDT).toFixed(4),
        "USD"
      );
    }
  })().catch(console.error);
}
