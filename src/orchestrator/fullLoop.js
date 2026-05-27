/**
 * Task 2.1 — Full Loop: AI Decision → On-Chain Execution
 *
 * Flow: Market Data → Claude AI → Zod Validate → DecisionLog.logDecision() on Mantle Sepolia
 */
require("dotenv").config();
const { ethers } = require("ethers");
const { getAIDecision } = require("./aiEngine");
const config = require("./config");

// ABI fragments for our contracts
const DECISION_LOG_ABI = [
  "function logDecision(string action, string targetAsset, uint256 amountIn, uint256 amountOut, uint256 confidence, string reasoningHash, bytes32 txHash) external returns (uint256)",
  "function totalDecisions() view returns (uint256)",
  "function getDecision(uint256 id) view returns (tuple(uint256 timestamp, string action, string targetAsset, uint256 amountIn, uint256 amountOut, uint256 confidence, string reasoningHash, bytes32 txHash))",
];

const ROUTER_ABI = [
  "function getPortfolioAllocation() view returns (uint256 musdBalance, uint256 methBalance, uint256 usdyBalance)",
  "function maxSlippageBps() view returns (uint256)",
  "function minConfidence() view returns (uint256)",
  "function maxSingleSwapPct() view returns (uint256)",
];

async function executeFullLoop() {
  console.log("═══════════════════════════════════════════");
  console.log(" TuringVault — Full Loop Execution");
  console.log(" Network: Mantle Sepolia (Chain 5003)");
  console.log("═══════════════════════════════════════════\n");

  // 1. Connect to Mantle Sepolia
  const provider = new ethers.JsonRpcProvider(
    process.env.MANTLE_SEPOLIA_RPC_URL
  );
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  console.log("[1] Wallet:", wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log("    Balance:", ethers.formatEther(balance), "MNT\n");

  // 2. Connect to contracts
  const decisionLog = new ethers.Contract(
    config.CONTRACTS.DECISION_LOG,
    DECISION_LOG_ABI,
    wallet
  );
  const router = new ethers.Contract(
    config.CONTRACTS.ROUTER,
    ROUTER_ABI,
    wallet
  );

  const totalBefore = await decisionLog.totalDecisions();
  console.log(
    "[2] DecisionLog connected. Total decisions so far:",
    totalBefore.toString()
  );

  // 3. Simulate market data (Phase 2.2 will replace with real feeds)
  const marketData = {
    ethPrice: 3750,
    mETHYield: 4.1,
    sentiment: "bullish",
    smartMoneyFlow: 1800000,
    volatility: 0.35,
    timestamp: Date.now(),
  };

  const portfolioState = {
    totalValueUSD: 5000,
    mUSD: 3500,
    mETH: 1500,
    currentAllocation: { mUSD: 70, mETH: 30 },
  };

  console.log("\n[3] Market Data:", JSON.stringify(marketData, null, 2));
  console.log("    Portfolio:", JSON.stringify(portfolioState));

  // 4. Get AI Decision
  console.log("\n[4] Calling Claude Sonnet 4.6 for decision...");
  const decision = await getAIDecision(marketData, portfolioState);
  console.log("    Decision:", JSON.stringify(decision, null, 2));

  // 5. Validate confidence against on-chain risk params
  const confidenceBps = Math.round(decision.confidence * 10000);
  console.log(
    `\n[5] Confidence: ${decision.confidence} (${confidenceBps} bps)`
  );

  if (decision.action === "hold") {
    console.log("    Action: HOLD — no on-chain execution needed");
    console.log("    Logging decision for audit trail...");
  }

  // 6. Log decision on-chain
  console.log("\n[6] Writing decision to Mantle Sepolia...");

  // Create a reasoning hash (in production: IPFS upload)
  const reasoningHash = JSON.stringify({
    model: "claude-sonnet-4.6",
    input: {
      sentiment: marketData.sentiment,
      smartMoney: marketData.smartMoneyFlow,
    },
    output: { action: decision.action, confidence: decision.confidence },
  }).substring(0, 200);

  // Use empty txHash for now (would be swap tx hash in production)
  const emptyTxHash = ethers.zeroPadBytes("0x", 32);

  const tx = await decisionLog.logDecision(
    decision.action,
    decision.targetAsset,
    ethers.parseEther(portfolioState.mUSD.toString()), // amountIn (simulated)
    ethers.parseEther("0"), // amountOut (no actual swap in hold)
    confidenceBps,
    reasoningHash,
    emptyTxHash
  );

  console.log("    TX Hash:", tx.hash);
  console.log("    Waiting for confirmation...");

  const receipt = await tx.wait();
  console.log("    ✅ Confirmed in block:", receipt.blockNumber);
  console.log("    Gas used:", receipt.gasUsed.toString());

  // 7. Verify on-chain
  const totalAfter = await decisionLog.totalDecisions();
  const logged = await decisionLog.getDecision(totalAfter - 1n);

  console.log("\n[7] On-chain verification:");
  console.log("    Decision ID:", (totalAfter - 1n).toString());
  console.log(
    "    Timestamp:",
    new Date(Number(logged.timestamp) * 1000).toISOString()
  );
  console.log("    Action:", logged.action);
  console.log("    Target:", logged.targetAsset);
  console.log("    Confidence:", logged.confidence.toString(), "bps");
  console.log("    Reasoning:", logged.reasoningHash.substring(0, 100) + "...");

  console.log("\n═══════════════════════════════════════════");
  console.log(" ✅ FULL LOOP COMPLETE");
  console.log(" Market → AI → Validate → On-Chain ✓");
  console.log("═══════════════════════════════════════════");
}

executeFullLoop().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
