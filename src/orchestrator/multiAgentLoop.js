/**
 * TuringVault Multi-Agent Full Loop
 * 
 * Real market data → Analyst Agent → Validator Agent → On-Chain Consensus
 * 
 * This is the PRODUCTION orchestrator that:
 * 1. Fetches real market data
 * 2. Analyst proposes a decision
 * 3. Validator independently verifies
 * 4. Records consensus result on-chain (ValidationRegistry)
 * 5. If approved + high confidence → executes swap
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });
// Force-override AWS credentials from .env (in case system env vars take priority)
const _env = require("dotenv").parse(require("fs").readFileSync(require("path").resolve(__dirname, "../../.env")));
process.env.AWS_ACCESS_KEY_ID = _env.AWS_ACCESS_KEY_ID;
process.env.AWS_SECRET_ACCESS_KEY = _env.AWS_SECRET_ACCESS_KEY;
const { ethers } = require("ethers");
const { getMultiAgentDecision } = require("./multiAgent");
const { getUnifiedMarketContext } = require("./unifiedMarketData");

// Contract ABIs (minimal)
const REGISTRY_ABI = [
  "function submitProposal(string action, string targetAsset, uint256 amountIn, uint256 confidence, string reasoning) external returns (uint256)",
  "function validateProposal(uint256 proposalId, uint256 validatorConfidence, uint256 riskScore, string validatorReasoning, bool approved) external",
  "function totalProposals() view returns (uint256)",
  "function totalApproved() view returns (uint256)",
  "function totalRejected() view returns (uint256)"
];

const DECISION_LOG_ABI = [
  "function logDecision(string action, string targetAsset, uint256 amountIn, uint256 amountOut, uint256 confidence, string reasoningHash, bytes32 txHash) external returns (uint256)"
];

// Contract addresses
const REGISTRY_ADDR = "0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6";
const DECISION_LOG_ADDR = "0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5";
const REPUTATION_ADDR = "0xC78119F3274B05046Ac7c38a14298a6cbD946e1a";

const REPUTATION_ABI = [
  "function submitFeedback(uint256 agentId, int128 score, bytes32 reasoningHash, string context) external",
  "function recordPnL(uint256 agentId, int128 pnlBps, bytes32 reasoningHash) external"
];

async function runMultiAgentCycle() {
  const provider = new ethers.JsonRpcProvider("https://rpc.mantle.xyz");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const registry = new ethers.Contract(REGISTRY_ADDR, REGISTRY_ABI, wallet);
  const decisionLog = new ethers.Contract(DECISION_LOG_ADDR, DECISION_LOG_ABI, wallet);
  const reputation = new ethers.Contract(REPUTATION_ADDR, REPUTATION_ABI, wallet);

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  TURINGVAULT MULTI-AGENT CYCLE                          ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // Step 1: Fetch unified market data (5 sources: CoinGecko + DeFiLlama + F&G + Nansen MCP + Byreal)
  console.log("📊 [STEP 1] Fetching unified market intelligence (5 sources)...");
  const unified = await getUnifiedMarketContext();
  // Map to legacy format expected by multiAgent.js
  const market = {
    ethPrice: unified.ethPrice,
    ethChange24h: unified.ethChange24h || 0,
    mntPrice: unified.mntPrice,
    mantleTVL: unified.mantleTVL,
    fearGreedIndex: unified.fearGreedValue,
    sentiment: unified.fearGreedLabel?.toLowerCase() || "neutral",
    mETHYield: unified.mETHYield || 3.5,
    nansenSentiment: unified.nansenInsight ? "active" : "n/a",
    nansenInsight: unified.nansenInsight,
    byrealSignals: unified.byrealSignals,
    promptContext: unified.promptContext // full context string for LLM
  };
  console.log(`   ETH: $${market.ethPrice} | Sentiment: ${market.sentiment} | F&G: ${market.fearGreedIndex}`);
  console.log(`   Nansen: ${market.nansenInsight ? "✓ MCP" : "fallback"} | Byreal: ${market.byrealSignals?.length || 0} signals | TVL: $${((market.mantleTVL||0)/1e6).toFixed(0)}M\n`);

  // Step 2: Multi-agent decision
  console.log("🧠 [STEP 2] Multi-agent consensus process...");
  const decision = await getMultiAgentDecision(market);

  console.log(`\n   ANALYST: ${decision.analyst?.action} ${decision.analyst?.targetAsset} (${(decision.analyst?.confidence * 100).toFixed(0)}%)`);
  console.log(`   VALIDATOR: ${decision.validator?.approved ? "✅" : "❌"} (${(decision.validator?.validatorConfidence * 100).toFixed(0)}% conf, risk=${decision.validator?.riskScore})`);
  console.log(`   CONSENSUS: ${decision.consensus ? "✅ REACHED" : "❌ BLOCKED"}\n`);

  // Step 3: Upload reasoning to IPFS
  console.log("📁 [STEP 3] Uploading Proof-of-Reasoning to IPFS...");
  const { uploadReasoningProof } = require("../ipfs/storage");
  const ipfsResult = await uploadReasoningProof(decision, market);
  console.log(`   ✅ IPFS: ${ipfsResult.uri}`);

  // Step 4: Record on-chain
  console.log("⛓️  [STEP 4] Recording on-chain...");
  
  // Get current nonce to avoid replacement issues
  const currentNonce = await provider.getTransactionCount(wallet.address, "latest");
  
  // Submit analyst proposal
  const confidenceBps = Math.round((decision.analyst?.confidence || 0) * 10000);
  const tx1 = await registry.submitProposal(
    decision.analyst?.action || "hold",
    decision.analyst?.targetAsset || "mUSD",
    ethers.parseEther("0"),
    confidenceBps,
    decision.analyst?.reasoning?.substring(0, 200) || "no reasoning",
    { nonce: currentNonce }
  );
  const receipt1 = await tx1.wait();
  const proposalId = (await registry.totalProposals()) - 1n;
  console.log(`   ✅ Proposal #${proposalId} submitted (tx: ${receipt1.hash.substring(0, 18)}...)`);

  // Submit validator assessment
  const validatorConfBps = Math.round((decision.validator?.validatorConfidence || 0) * 10000);
  const riskScore = decision.validator?.riskScore || 100;
  const tx2 = await registry.validateProposal(
    proposalId,
    validatorConfBps,
    riskScore * 100, // scale to bps
    decision.validator?.reasoning?.substring(0, 200) || "no reasoning",
    decision.validator?.approved || false,
    { nonce: currentNonce + 1 }
  );
  const receipt2 = await tx2.wait();
  console.log(`   ✅ Validation recorded (tx: ${receipt2.hash.substring(0, 18)}...)`);

  // Also log to DecisionLog for backward compatibility
  const tx3 = await decisionLog.logDecision(
    decision.action,
    decision.analyst?.targetAsset || "mUSD",
    ethers.parseEther("0"),
    ethers.parseEther("0"),
    confidenceBps,
    `[MULTI-AGENT] Analyst: ${decision.analyst?.reasoning?.substring(0, 80)} | Validator: ${decision.validator?.approved ? "APPROVED" : "REJECTED"} (risk=${riskScore})`.substring(0, 200),
    ethers.keccak256(ethers.toUtf8Bytes(ipfsResult.cid)),
    { nonce: currentNonce + 2 }
  );
  await tx3.wait();
  console.log(`   ✅ Decision logged to DecisionLog`);

  // Step 5: Record reputation feedback
  try {
    const reasoningHashBytes = ethers.keccak256(ethers.toUtf8Bytes(ipfsResult.cid));
    // Score based on consensus: approved = positive (+confidence*50), rejected = neutral (0)
    const repScore = decision.consensus 
      ? Math.round((decision.analyst?.confidence || 0.5) * 50) 
      : 0;
    const context = `${decision.analyst?.action || "hold"}_${decision.analyst?.targetAsset || "mUSD"}_conf${confidenceBps}`;
    const tx4 = await reputation.submitFeedback(
      0, // agentId (our NFT token #0)
      repScore,
      reasoningHashBytes,
      context,
      { nonce: currentNonce + 3 }
    );
    await tx4.wait();
    console.log(`   ✅ Reputation updated: +${repScore} (${context})`);
  } catch (repErr) {
    console.log(`   ⚠️  Reputation recording failed: ${repErr.message?.slice(0, 60)}`);
  }

  // Summary
  const totalApproved = await registry.totalApproved();
  const totalRejected = await registry.totalRejected();
  
  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  CYCLE COMPLETE                                         ║`);
  console.log(`╠══════════════════════════════════════════════════════════╣`);
  console.log(`║  Consensus: ${decision.consensus ? "APPROVED ✅" : "BLOCKED ❌ "}                               ║`);
  console.log(`║  Registry stats: ${totalApproved} approved / ${totalRejected} rejected            ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝\n`);

  return decision;
}

// Run if called directly
if (require.main === module) {
  runMultiAgentCycle().catch(console.error);
}

module.exports = { runMultiAgentCycle };
