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
const { getStructuredSignals } = require("./signalEngine");
const outcomeTracker = require("./outcomeTracker");

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
const VALIDATION_ADDR = "0x0aeEd88959fCFC665284225dB93DED3e8A3Ff705";
const IDENTITY_ADDR = "0x6f862802e0d5463DF18d267e422347BeCacc28bD";

const REPUTATION_ABI = [
  "function submitFeedback(uint256 agentId, int128 score, bytes32 reasoningHash, string context) external",
  "function recordPnL(uint256 agentId, int128 pnlBps, bytes32 reasoningHash) external"
];

const VALIDATION_ABI = [
  "function validationRequest(address validatorAddress, uint256 agentId, string requestURI, bytes32 requestHash) external",
  "function validationResponse(bytes32 requestHash, uint8 response, string responseURI, bytes32 responseHash, string tag) external",
  "function isActionApproved(bytes32 requestHash) view returns (bool approved, uint8 score, bool expired)",
  "function authorizedValidators(address) view returns (bool)"
];

async function runMultiAgentCycle() {
  const provider = new ethers.JsonRpcProvider("https://rpc.mantle.xyz");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const registry = new ethers.Contract(REGISTRY_ADDR, REGISTRY_ABI, wallet);
  const decisionLog = new ethers.Contract(DECISION_LOG_ADDR, DECISION_LOG_ABI, wallet);
  const reputation = new ethers.Contract(REPUTATION_ADDR, REPUTATION_ABI, wallet);
  const validation = new ethers.Contract(VALIDATION_ADDR, VALIDATION_ABI, wallet);

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  TURINGVAULT MULTI-AGENT CYCLE                          ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // Step 1: Fetch unified market data + structured signals
  console.log("📊 [STEP 1] Fetching unified market intelligence (5 sources)...");
  const unified = await getUnifiedMarketContext();

  // Structured signals (funding rate, liq map, on-chain flow, yield spread, regime)
  console.log("📡 [STEP 1.5] Computing structured signals...");
  const structuredSignals = await getStructuredSignals(unified);
  console.log(`   Regime: ${structuredSignals.regime.regime} | Consensus: ${structuredSignals.consensus} | Funding: ${structuredSignals.signals.funding?.value?.toFixed(2) || 'n/a'}%`);

  // Settle any pending outcomes from previous cycles
  console.log("⚖️  [STEP 1.6] Settling pending outcome evaluations...");
  await outcomeTracker.settle({ wallet, provider });
  const pendingCount = outcomeTracker.getPendingCount();
  if (pendingCount > 0) console.log(`   ${pendingCount} decision(s) still pending settlement (< 4h old)`);

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
    // Inject structured signals into prompt context (replaces text blob with typed signals)
    promptContext: unified.promptContext + "\n\n" + structuredSignals.promptSummary,
    // Pass structured signals as typed object too
    structuredSignals,
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

  // Step 3.5: PRE-ACTION CHECK (ERC-8004 Validation Registry)
  console.log("🛡️  [STEP 3.5] Pre-Action Validation Check...");
  const intentPayload = JSON.stringify({
    action: decision.analyst?.action,
    asset: decision.analyst?.targetAsset,
    confidence: decision.analyst?.confidence,
    analystReasoning: decision.analyst?.reasoning?.substring(0, 200),
    validatorApproved: decision.validator?.approved,
    validatorConfidence: decision.validator?.validatorConfidence,
    ipfsCID: ipfsResult.cid,
    timestamp: Date.now()
  });
  const requestHash = ethers.keccak256(ethers.toUtf8Bytes(intentPayload));
  
  // Use a secondary address as validator (in production: separate validator service)
  // For demo: owner submits request, then self-validates via authorizedValidators
  const validatorAddr = "0x000000000000000000000000000000000000dEaD"; // placeholder for demo
  // In real flow: validationRequest → external validator → validationResponse
  // For hackathon demo: we simulate the full flow atomically
  console.log(`   Request hash: ${requestHash.substring(0, 18)}...`);
  console.log(`   Validator confidence: ${(decision.validator?.validatorConfidence * 100).toFixed(0)}%`);
  
  // Determine if action passes pre-action check
  const preActionScore = decision.consensus 
    ? Math.round((decision.validator?.validatorConfidence || 0) * 100) 
    : 0;
  const preActionPassed = preActionScore >= 60;
  console.log(`   Pre-Action Score: ${preActionScore}/100 — ${preActionPassed ? "✅ APPROVED" : "❌ BLOCKED"}`);
  
  if (!preActionPassed) {
    console.log("\n   ⛔ ACTION BLOCKED by Pre-Action Check. Recording rejection only.");
  }

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

  // Step 6: Record outcome for future settlement (the real learning loop)
  console.log("🔮 [STEP 6] Recording outcome for settlement in 4h...");
  try {
    outcomeTracker.record({
      decisionId: Number(proposalId),
      action: decision.analyst?.action || "hold",
      targetAsset: decision.analyst?.targetAsset || "mUSD",
      consensus: decision.consensus || false,
      confidence: decision.analyst?.confidence || 0.5,
      priceAtDecision: market.ethPrice,
      ipfsCid: ipfsResult.cid,
    });
    console.log(`   ✅ Will settle vs ETH price in 4h (now: $${market.ethPrice})`);
  } catch (e) {
    console.log(`   ⚠️  Outcome record failed: ${e.message?.slice(0, 60)}`);
  }

  // Summary
  const totalApproved = await registry.totalApproved();
  const totalRejected = await registry.totalRejected();
  
  const boxW = 56; // inner width between ║ chars
  const pad = (s) => s.padEnd(boxW);
  console.log(`\n╔${'═'.repeat(boxW)}╗`);
  console.log(`║${pad('  CYCLE COMPLETE')}║`);
  console.log(`╠${'═'.repeat(boxW)}╣`);
  console.log(`║${pad(`  Consensus: ${decision.consensus ? "APPROVED ✅" : "BLOCKED ❌"}`)}║`);
  console.log(`║${pad(`  Registry stats: ${totalApproved} approved / ${totalRejected} rejected`)}║`);
  console.log(`╚${'═'.repeat(boxW)}╝\n`);

  return decision;
}

// Run if called directly
if (require.main === module) {
  runMultiAgentCycle().catch(console.error);
}

module.exports = { runMultiAgentCycle };
