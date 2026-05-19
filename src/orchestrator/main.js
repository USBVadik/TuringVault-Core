/**
 * TuringVault Orchestrator — Main Loop
 * 
 * Runs every 60 seconds:
 *   1. Fetch real market data (DeFiLlama, CoinGecko, Fear&Greed)
 *   2. Call Claude AI for decision
 *   3. Validate with Zod
 *   4. Log decision on-chain (Mantle Sepolia)
 *   5. Execute swap if confidence >= threshold
 * 
 * Usage: node src/orchestrator/main.js
 * Stop: Ctrl+C
 */
require("dotenv").config();
const { ethers } = require("ethers");
const cron = require("node-cron");
const { getAIDecision } = require("./aiEngine");
const { getMarketData } = require("./marketData");
const config = require("./config");

// ABI fragments
const DECISION_LOG_ABI = [
  "function logDecision(string action, string targetAsset, uint256 amountIn, uint256 amountOut, uint256 confidence, string reasoningHash, bytes32 txHash) external returns (uint256)",
  "function totalDecisions() view returns (uint256)"
];

// State
let isRunning = false;
let cycleCount = 0;

// Setup blockchain connection
const provider = new ethers.JsonRpcProvider(process.env.MANTLE_SEPOLIA_RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const decisionLog = new ethers.Contract(config.CONTRACTS.DECISION_LOG, DECISION_LOG_ABI, wallet);

async function runCycle() {
  if (isRunning) {
    console.log("[SKIP] Previous cycle still running");
    return;
  }

  isRunning = true;
  cycleCount++;
  const startTime = Date.now();

  console.log(`\n${"═".repeat(60)}`);
  console.log(`[Cycle ${cycleCount}] ${new Date().toISOString()}`);
  console.log("═".repeat(60));

  try {
    // 1. Fetch market data
    console.log("[1/4] Fetching market data...");
    const marketData = await getMarketData();
    console.log(`      ETH: $${marketData.ethPrice} | Sentiment: ${marketData.sentiment} (${marketData.fearGreedValue}) | mETH Yield: ${marketData.mETHYield}%`);

    // 2. Get AI decision
    console.log("[2/4] Calling Claude AI...");
    const portfolioState = {
      totalValueUSD: 5000,
      mUSD: 3500,
      mETH: 1500,
      currentAllocation: { mUSD: 70, mETH: 30 }
    };
    
    const decision = await getAIDecision(marketData, portfolioState);
    console.log(`      Action: ${decision.action} | Direction: ${decision.direction} | Confidence: ${decision.confidence}`);
    console.log(`      Reasoning: "${decision.reasoning}"`);

    // 3. Check if we should execute
    const shouldExecute = decision.action === "swap" && decision.confidence >= config.RISK_PARAMS.minConfidence;
    console.log(`[3/4] Should execute: ${shouldExecute} (confidence ${decision.confidence} vs threshold ${config.RISK_PARAMS.minConfidence})`);

    // 4. Log on-chain
    console.log("[4/4] Logging decision on-chain...");
    const confidenceBps = Math.round(decision.confidence * 10000);
    const reasoningHash = JSON.stringify({
      model: "claude-sonnet-4.6",
      market: { eth: marketData.ethPrice, sentiment: marketData.sentiment, fgi: marketData.fearGreedValue },
      decision: { action: decision.action, confidence: decision.confidence, target: decision.targetAsset }
    }).substring(0, 200);

    const tx = await decisionLog.logDecision(
      decision.action,
      decision.targetAsset,
      ethers.parseEther("0"),
      ethers.parseEther("0"),
      confidenceBps,
      reasoningHash,
      ethers.zeroPadBytes("0x", 32)
    );

    const receipt = await tx.wait();
    const totalDecisions = await decisionLog.totalDecisions();

    console.log(`      ✅ TX: ${tx.hash}`);
    console.log(`      Block: ${receipt.blockNumber} | Gas: ${receipt.gasUsed} | Total decisions: ${totalDecisions}`);

    if (shouldExecute) {
      console.log(`\n      🔥 SWAP SIGNAL: ${decision.targetAsset} (${decision.allocationPct}%)`);
      console.log(`      ⚠️  Swap execution disabled on testnet (no real liquidity)`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n[Done] Cycle ${cycleCount} completed in ${elapsed}s`);

  } catch (err) {
    console.error(`[ERROR] Cycle ${cycleCount} failed:`, err.message);
  } finally {
    isRunning = false;
  }
}

// Main
async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log(" TuringVault AI Orchestrator v1.0");
  console.log(" Model: Claude Sonnet 4.6 (AWS Bedrock)");
  console.log(" Network: Mantle Sepolia (5003)");
  console.log(" Interval: 60 seconds");
  console.log("═══════════════════════════════════════════════════");
  console.log(` Wallet: ${wallet.address}`);
  const bal = await provider.getBalance(wallet.address);
  console.log(` Balance: ${ethers.formatEther(bal)} MNT`);
  console.log(` DecisionLog: ${config.CONTRACTS.DECISION_LOG}`);
  console.log("═══════════════════════════════════════════════════\n");

  // Run immediately
  await runCycle();

  // Then every 60 seconds
  cron.schedule("* * * * *", runCycle);
  console.log("\n[CRON] Scheduled: running every 60 seconds. Press Ctrl+C to stop.");
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
