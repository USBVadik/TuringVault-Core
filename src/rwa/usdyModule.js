/**
 * TuringVault RWA Module — USDY (Ondo Finance) Integration
 * 
 * Real World Asset yield-bearing stablecoin allocation logic.
 * USDY = tokenized US Treasuries yield (~5% APY), redeemable 1:1 for USDC.
 * 
 * Architecture:
 *   Portfolio Analysis → RWA Allocation Signal → Swap via Merchant Moe → USDY Position
 *   USDY accrues yield automatically (rebasing) — no staking needed.
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });
const { ethers } = require("ethers");

// Mantle Mainnet USDY (Ondo Finance)
const USDY_ADDRESS = "0x5bE26527e817998A7206475496fDE1E68957c5A6";
const USDT_ADDRESS = "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE";
const WMNT_ADDRESS = "0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8";

// USDY yield parameters (based on current Ondo Finance rates)
const USDY_PARAMS = {
  currentAPY: 0.0525, // 5.25% APY from US Treasuries
  minAllocation: 0.1, // 10% portfolio minimum for RWA
  maxAllocation: 0.5, // 50% portfolio maximum
  rebalanceThreshold: 0.05, // 5% deviation triggers rebalance
};

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function totalSupply() view returns (uint256)",
];

class RWAModule {
  constructor(options = {}) {
    this.provider = new ethers.JsonRpcProvider(options.rpcUrl || "https://rpc.mantle.xyz");
    this.wallet = options.privateKey
      ? new ethers.Wallet(options.privateKey, this.provider)
      : null;
    this.params = { ...USDY_PARAMS, ...options.params };
    
    this.usdy = new ethers.Contract(USDY_ADDRESS, ERC20_ABI, this.provider);
    this.usdt = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, this.provider);
  }

  /**
   * Get current USDY position and yield metrics
   */
  async getPosition(address) {
    const addr = address || this.wallet?.address;
    if (!addr) throw new Error("No address");

    const [balance, decimals, totalSupply] = await Promise.all([
      this.usdy.balanceOf(addr),
      this.usdy.decimals(),
      this.usdy.totalSupply(),
    ]);

    const balanceFloat = parseFloat(ethers.formatUnits(balance, decimals));
    const totalSupplyFloat = parseFloat(ethers.formatUnits(totalSupply, decimals));

    return {
      token: "USDY",
      address: USDY_ADDRESS,
      balance: balanceFloat,
      decimals: Number(decimals),
      totalSupply: totalSupplyFloat,
      poolShare: totalSupplyFloat > 0 ? (balanceFloat / totalSupplyFloat) * 100 : 0,
      estimatedDailyYield: balanceFloat * (this.params.currentAPY / 365),
      estimatedMonthlyYield: balanceFloat * (this.params.currentAPY / 12),
      estimatedAnnualYield: balanceFloat * this.params.currentAPY,
      apy: this.params.currentAPY * 100,
      underlying: "US Treasury Bills (T-Bills)",
      issuer: "Ondo Finance",
    };
  }

  /**
   * Calculate optimal RWA allocation based on portfolio and market conditions
   * Returns allocation signal for the AI decision engine
   */
  async calculateAllocation(portfolioBalances, marketConditions = {}) {
    const {
      volatilityIndex = 50, // 0-100 (VIX-like)
      trendStrength = 0, // -1 to 1 (bearish to bullish)
      riskScore = 50, // 0-100 from AI model
    } = marketConditions;

    // Calculate total portfolio value in USDT terms
    const mntPrice = portfolioBalances.MNT_PRICE || 0.62;
    const mETHPrice = portfolioBalances.METH_PRICE || 2500;
    
    const totalValue = 
      (portfolioBalances.MNT || 0) * mntPrice +
      (portfolioBalances.WMNT || 0) * mntPrice +
      (portfolioBalances.mETH || 0) * mETHPrice +
      (portfolioBalances.USDT || 0) +
      (portfolioBalances.USDY || 0) * 1.0 + // USDY ≈ $1
      (portfolioBalances.mUSD || 0);

    // Current RWA allocation
    const currentRWA = (portfolioBalances.USDY || 0) / (totalValue || 1);

    // Adaptive allocation based on market conditions:
    // - High volatility → increase RWA (flight to safety)
    // - Strong bull trend → decrease RWA (risk-on)
    // - High risk score → increase RWA (preserve capital)
    let targetAllocation = this.params.minAllocation;
    
    // Volatility factor (high vol → more RWA)
    targetAllocation += (volatilityIndex / 100) * 0.2;
    
    // Trend factor (bearish → more RWA)
    targetAllocation += (1 - trendStrength) * 0.1;
    
    // Risk factor (high risk → more RWA)
    targetAllocation += (riskScore / 100) * 0.15;
    
    // Clamp
    targetAllocation = Math.max(this.params.minAllocation, 
      Math.min(this.params.maxAllocation, targetAllocation));

    // Determine action
    const allocationDiff = targetAllocation - currentRWA;
    const needsRebalance = Math.abs(allocationDiff) > this.params.rebalanceThreshold;

    let action = "HOLD";
    let amount = 0;
    
    if (needsRebalance) {
      if (allocationDiff > 0) {
        action = "INCREASE_RWA";
        amount = allocationDiff * totalValue; // USDT amount to convert to USDY
      } else {
        action = "DECREASE_RWA";
        amount = Math.abs(allocationDiff) * totalValue; // USDY to convert back
      }
    }

    return {
      totalPortfolioValue: totalValue,
      currentRWAAllocation: currentRWA * 100,
      targetRWAAllocation: targetAllocation * 100,
      action,
      amount: amount.toFixed(2),
      needsRebalance,
      reasoning: this._generateReasoning(volatilityIndex, trendStrength, riskScore, targetAllocation),
      yieldProjection: {
        daily: (targetAllocation * totalValue * this.params.currentAPY / 365).toFixed(4),
        monthly: (targetAllocation * totalValue * this.params.currentAPY / 12).toFixed(2),
        annual: (targetAllocation * totalValue * this.params.currentAPY).toFixed(2),
      },
      swapRoute: action === "INCREASE_RWA" 
        ? { from: "USDT", to: "USDY", via: "Merchant Moe LB", pair: "USDY/USDT (binStep 25)" }
        : action === "DECREASE_RWA"
        ? { from: "USDY", to: "USDT", via: "Merchant Moe LB", pair: "USDY/USDT (binStep 25)" }
        : null,
    };
  }

  _generateReasoning(vol, trend, risk, target) {
    const factors = [];
    if (vol > 60) factors.push(`High volatility (${vol}/100) → flight to safety`);
    else if (vol < 30) factors.push(`Low volatility (${vol}/100) → risk appetite`);
    if (trend < -0.3) factors.push(`Bearish trend (${trend.toFixed(2)}) → capital preservation`);
    else if (trend > 0.5) factors.push(`Strong bull (${trend.toFixed(2)}) → reduce RWA, deploy risk`);
    if (risk > 70) factors.push(`High risk score (${risk}/100) → prioritize safety`);
    factors.push(`Target allocation: ${(target * 100).toFixed(1)}% in USDY (${(this.params.currentAPY * 100).toFixed(2)}% APY)`);
    return factors.join("; ");
  }

  /**
   * Generate RWA context for AI decision prompt
   */
  async getContextForAI(address) {
    const position = await this.getPosition(address);
    return {
      rwa_position: position,
      usdy_info: {
        description: "USDY is a tokenized note secured by short-term US Treasuries (Ondo Finance)",
        apy: `${this.params.currentAPY * 100}%`,
        risk: "Low (US T-Bills backing)",
        liquidity: "USDY/USDT pair on Merchant Moe (binStep 25)",
        rebase: "Yield accrues via token price appreciation (not rebasing)",
      },
      allocation_rules: {
        min: `${this.params.minAllocation * 100}%`,
        max: `${this.params.maxAllocation * 100}%`,
        rebalance_trigger: `${this.params.rebalanceThreshold * 100}% deviation`,
      },
    };
  }
}

module.exports = { RWAModule, USDY_ADDRESS, USDY_PARAMS };

// Self-test
if (require.main === module) {
  (async () => {
    console.log("═══ RWA Module (USDY / Ondo Finance) ═══\n");
    
    const rwa = new RWAModule({ privateKey: process.env.PRIVATE_KEY });
    
    // Check position
    const position = await rwa.getPosition();
    console.log("USDY Position:");
    console.log(`  Balance: ${position.balance.toFixed(4)} USDY`);
    console.log(`  APY: ${position.apy.toFixed(2)}%`);
    console.log(`  Daily Yield: $${position.estimatedDailyYield.toFixed(4)}`);
    console.log(`  Total Supply: ${(position.totalSupply / 1e6).toFixed(2)}M USDY`);
    
    // Test allocation with sample portfolio
    console.log("\nAllocation Simulation (sample portfolio):");
    const allocation = await rwa.calculateAllocation(
      { MNT: 6.14, WMNT: 0, mETH: 0, USDT: 0, USDY: 0, mUSD: 0, MNT_PRICE: 0.62 },
      { volatilityIndex: 65, trendStrength: -0.2, riskScore: 55 }
    );
    console.log(`  Portfolio Value: $${allocation.totalPortfolioValue.toFixed(2)}`);
    console.log(`  Current RWA: ${allocation.currentRWAAllocation.toFixed(1)}%`);
    console.log(`  Target RWA: ${allocation.targetRWAAllocation.toFixed(1)}%`);
    console.log(`  Action: ${allocation.action} ($${allocation.amount})`);
    console.log(`  Reasoning: ${allocation.reasoning}`);
    console.log(`  Yield if target met: $${allocation.yieldProjection.annual}/yr`);
    
    console.log("\n✅ RWA module operational");
  })().catch(console.error);
}
