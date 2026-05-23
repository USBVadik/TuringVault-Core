/**
 * TuringVault Integrated Orchestrator v2
 * 
 * Full pipeline with Phase 2 modules integrated:
 *   Market Data → AI Decision → DEX Quote → RWA Allocation → 
 *   Pre-Action Check → KMS Sign → Execute → On-chain Record
 * 
 * NEW: "Human vs AI" mode
 *   - VaR (Value at Risk) threshold determines autonomy level
 *   - Below threshold: AI executes autonomously
 *   - Above threshold: AI proposes, human approves via intent queue
 */

const path = require("path");
const fs = require("fs");
const envPath = path.resolve(__dirname, "../../.env");
if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
  const _env = require("dotenv").parse(fs.readFileSync(envPath));
  if (_env.AWS_ACCESS_KEY_ID) process.env.AWS_ACCESS_KEY_ID = _env.AWS_ACCESS_KEY_ID;
  if (_env.AWS_SECRET_ACCESS_KEY) process.env.AWS_SECRET_ACCESS_KEY = _env.AWS_SECRET_ACCESS_KEY;
} else {
  require("dotenv").config();
}

const { ethers } = require("ethers");
const { getMultiAgentDecision } = require("./multiAgent");
const { getUnifiedMarketContext } = require("./unifiedMarketData");
const { MerchantMoeDEX } = require("../dex/merchantMoe");
const { RWAModule } = require("../rwa/usdyModule");
const { TencentKMSCrypto } = require("../kms/tencentKMS");

// ═══ Configuration ═══
const CONFIG = {
  // VaR threshold for Human vs AI autonomy
  varThreshold: {
    autonomous: 50,   // VaR < 50 bps → AI acts alone
    supervised: 150,  // 50 < VaR < 150 → AI proposes, human reviews
    blocked: 300,     // VaR > 300 → no action (too risky)
  },
  // Execution limits
  maxSwapSizeUSD: 100,     // Max $100 per swap (hackathon demo)
  maxDailySwaps: 10,       // Max 10 swaps per day
  minConfidence: 0.6,      // Minimum AI confidence to proceed
  // Mode
  mode: process.env.ORCHESTRATOR_MODE || "autonomous", // autonomous | supervised | paper
};

// ═══ Contract Addresses (Mantle Mainnet) ═══
const CONTRACTS = {
  REGISTRY: "0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6",
  DECISION_LOG: "0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5",
  REPUTATION: "0xC78119F3274B05046Ac7c38a14298a6cbD946e1a",
  VALIDATION: "0x0aeEd88959fCFC665284225dB93DED3e8A3Ff705",
  IDENTITY: "0x6f862802e0d5463DF18d267e422347BeCacc28bD",
};

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

const REPUTATION_ABI = [
  "function submitFeedback(uint256 agentId, int128 score, bytes32 reasoningHash, string context) external",
  "function recordPnL(uint256 agentId, int128 pnlBps, bytes32 reasoningHash) external"
];

// ═══ Intent Queue (Human vs AI) ═══
const INTENT_QUEUE_PATH = path.resolve(__dirname, "../../data/intent_queue.json");

class IntentQueue {
  constructor() {
    this.queuePath = INTENT_QUEUE_PATH;
    this._ensureDir();
  }

  _ensureDir() {
    const dir = path.dirname(this.queuePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(this.queuePath)) fs.writeFileSync(this.queuePath, "[]");
  }

  async addIntent(intent) {
    const queue = this._read();
    const entry = {
      id: `intent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      status: "pending_human_approval",
      ...intent,
    };
    queue.push(entry);
    this._write(queue);
    return entry;
  }

  getPending() {
    return this._read().filter(i => i.status === "pending_human_approval");
  }

  approve(intentId) {
    const queue = this._read();
    const intent = queue.find(i => i.id === intentId);
    if (intent) {
      intent.status = "approved";
      intent.approvedAt = new Date().toISOString();
      this._write(queue);
    }
    return intent;
  }

  reject(intentId, reason) {
    const queue = this._read();
    const intent = queue.find(i => i.id === intentId);
    if (intent) {
      intent.status = "rejected";
      intent.rejectedAt = new Date().toISOString();
      intent.rejectReason = reason;
      this._write(queue);
    }
    return intent;
  }

  _read() {
    try { return JSON.parse(fs.readFileSync(this.queuePath, "utf8")); }
    catch { return []; }
  }
  _write(data) { fs.writeFileSync(this.queuePath, JSON.stringify(data, null, 2)); }
}

// ═══ VaR Calculator ═══
function calculateVaR(marketData, decision) {
  // Simplified VaR estimation in basis points
  // Based on: volatility, position size, confidence, sentiment
  const fearGreed = marketData.fearGreedIndex || 50;
  const confidence = decision.analyst?.confidence || 0.5;
  const volatility = Math.abs(marketData.ethChange24h || 0);

  // Higher VaR when: low confidence, high volatility, extreme sentiment
  let var_bps = 0;
  
  // Volatility component (1% daily move = 100 bps VaR)
  var_bps += volatility * 100;
  
  // Confidence inverse (low confidence = high VaR)
  var_bps += (1 - confidence) * 200;
  
  // Extreme sentiment premium
  if (fearGreed < 20 || fearGreed > 80) var_bps += 50;
  
  // Action type premium
  if (decision.analyst?.action === "swap" || decision.analyst?.action === "buy") var_bps += 30;
  if (decision.analyst?.action === "hold") var_bps *= 0.3;

  return Math.round(var_bps);
}

// ═══ Main Orchestrator ═══
async function runIntegratedCycle(options = {}) {
  const mode = options.mode || CONFIG.mode;
  const provider = new ethers.JsonRpcProvider("https://rpc.mantle.xyz");
  const wallet = new ethers.Wallet(
    (process.env.PRIVATE_KEY?.startsWith("0x") ? "" : "0x") + process.env.PRIVATE_KEY,
    provider
  );

  // Initialize modules
  const dex = new MerchantMoeDEX({ privateKey: wallet.privateKey, dryRun: mode !== "autonomous" });
  const rwa = new RWAModule({ privateKey: wallet.privateKey });
  const kms = new TencentKMSCrypto({ simulate: true }); // Always simulate until real KMS
  const intentQueue = new IntentQueue();

  // Contracts
  const registry = new ethers.Contract(CONTRACTS.REGISTRY, REGISTRY_ABI, wallet);
  const decisionLog = new ethers.Contract(CONTRACTS.DECISION_LOG, DECISION_LOG_ABI, wallet);
  const reputation = new ethers.Contract(CONTRACTS.REPUTATION, REPUTATION_ABI, wallet);

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  TURINGVAULT INTEGRATED ORCHESTRATOR v2                      ║");
  console.log(`║  Mode: ${mode.toUpperCase().padEnd(12)} | Chain: Mantle (5000)              ║`);
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // ─── Step 1: Market Intelligence ───
  console.log("📊 [1/7] Fetching unified market intelligence...");
  const unified = await getUnifiedMarketContext();
  const market = {
    ethPrice: unified.ethPrice,
    ethChange24h: unified.ethChange24h || 0,
    mntPrice: unified.mntPrice,
    mantleTVL: unified.mantleTVL,
    fearGreedIndex: unified.fearGreedValue,
    sentiment: unified.fearGreedLabel?.toLowerCase() || "neutral",
    mETHYield: unified.mETHYield || 3.5,
    nansenInsight: unified.nansenInsight,
    byrealSignals: unified.byrealSignals,
    promptContext: unified.promptContext
  };
  console.log(`   ETH: $${market.ethPrice} (${market.ethChange24h > 0 ? "+" : ""}${market.ethChange24h?.toFixed(1)}%) | MNT: $${market.mntPrice}`);
  console.log(`   Sentiment: ${market.sentiment} (F&G: ${market.fearGreedIndex}) | TVL: $${((market.mantleTVL||0)/1e6).toFixed(0)}M\n`);

  // ─── Step 2: Portfolio + DEX Quotes ───
  console.log("💰 [2/7] Portfolio scan + DEX quotes...");
  const balances = await dex.getBalances(wallet.address);
  const rwaPosition = await rwa.getPosition(wallet.address);
  
  console.log("   Balances:");
  for (const [token, bal] of Object.entries(balances)) {
    if (bal > 0.0001) console.log(`     ${token}: ${bal.toFixed(6)}`);
  }
  console.log(`   USDY: ${rwaPosition.balance.toFixed(4)} ($${rwaPosition.balance.toFixed(2)}, ${rwaPosition.apy}% APY)`);

  // Get live DEX quote for context
  let mntQuote = null;
  try {
    mntQuote = await dex.getQuote("WMNT", "USDT", ethers.parseEther("1"));
    console.log(`   DEX: 1 MNT = $${mntQuote.estimatedOut?.toFixed(4)} USDT (impact: ${mntQuote.priceImpact?.toFixed(1)}%)\n`);
  } catch (e) {
    console.log(`   DEX: quote unavailable (${e.message?.slice(0, 40)})\n`);
  }

  // ─── Step 3: RWA Allocation Analysis ───
  console.log("🏛️  [3/7] RWA allocation analysis...");
  const allocation = await rwa.calculateAllocation(
    { ...balances, USDY: rwaPosition.balance, MNT_PRICE: market.mntPrice || 0.62 },
    {
      volatilityIndex: Math.min(100, Math.abs(market.ethChange24h || 0) * 20 + 30),
      trendStrength: (market.ethChange24h || 0) / 10,
      riskScore: 100 - (market.fearGreedIndex || 50),
    }
  );
  console.log(`   Portfolio: $${allocation.totalPortfolioValue.toFixed(2)} | RWA target: ${allocation.targetRWAAllocation.toFixed(1)}%`);
  console.log(`   Action: ${allocation.action} | Yield: $${allocation.yieldProjection.annual}/yr\n`);

  // ─── Step 4: Multi-Agent Decision ───
  console.log("🧠 [4/7] Multi-agent consensus (GLM-5 + Claude 4.6)...");
  
  // Enrich prompt with DEX + RWA context
  const enrichedMarket = {
    ...market,
    promptContext: [
      market.promptContext,
      `\n[DEX] Merchant Moe: 1 MNT = $${mntQuote?.estimatedOut?.toFixed(4) || "N/A"} USDT (LB v2.1, binStep 15)`,
      `[RWA] USDY position: $${rwaPosition.balance.toFixed(2)} | Target allocation: ${allocation.targetRWAAllocation.toFixed(0)}% | Action: ${allocation.action}`,
      `[PORTFOLIO] Total: $${allocation.totalPortfolioValue.toFixed(2)} | MNT: ${balances.MNT?.toFixed(2)}`,
    ].join("\n"),
  };

  const decision = await getMultiAgentDecision(enrichedMarket);
  
  console.log(`   ANALYST: ${decision.analyst?.action} ${decision.analyst?.targetAsset} (${(decision.analyst?.confidence * 100).toFixed(0)}%)`);
  console.log(`   VALIDATOR: ${decision.validator?.approved ? "✅" : "❌"} (${(decision.validator?.validatorConfidence * 100).toFixed(0)}% conf, risk=${decision.validator?.riskScore})`);
  console.log(`   CONSENSUS: ${decision.consensus ? "✅ REACHED" : "❌ BLOCKED"}\n`);

  // ─── Step 5: VaR + Human vs AI Decision ───
  console.log("⚖️  [5/7] VaR assessment + autonomy level...");
  const var_bps = calculateVaR(market, decision);
  
  let autonomyLevel;
  if (var_bps < CONFIG.varThreshold.autonomous) {
    autonomyLevel = "AUTONOMOUS";
  } else if (var_bps < CONFIG.varThreshold.supervised) {
    autonomyLevel = "SUPERVISED";
  } else if (var_bps < CONFIG.varThreshold.blocked) {
    autonomyLevel = "BLOCKED";
  } else {
    autonomyLevel = "BLOCKED";
  }

  console.log(`   VaR: ${var_bps} bps | Threshold: ${CONFIG.varThreshold.autonomous}/${CONFIG.varThreshold.supervised}/${CONFIG.varThreshold.blocked}`);
  console.log(`   Autonomy: ${autonomyLevel}`);

  // If supervised mode AND high VaR, queue for human
  if (mode === "supervised" && autonomyLevel === "SUPERVISED") {
    console.log("\n   📋 Queuing intent for human approval...");
    const intent = await intentQueue.addIntent({
      decision,
      market: { ethPrice: market.ethPrice, mntPrice: market.mntPrice, sentiment: market.sentiment },
      var_bps,
      allocation,
      dexQuote: mntQuote ? { price: mntQuote.price, impact: mntQuote.priceImpact } : null,
    });
    console.log(`   Intent queued: ${intent.id}`);
    console.log(`   ⏸️  Waiting for human approval in: ${INTENT_QUEUE_PATH}\n`);
    
    // Still record on-chain (proposal only, not execution)
    autonomyLevel = "QUEUED";
  }

  if (autonomyLevel === "BLOCKED") {
    console.log("   ⛔ VaR too high — no execution. Recording observation only.\n");
  }

  // ─── Step 6: KMS Signing (simulation) ───
  console.log("🔐 [6/7] KMS signing pipeline...");
  const intentPayload = JSON.stringify({
    action: decision.analyst?.action,
    asset: decision.analyst?.targetAsset,
    confidence: decision.analyst?.confidence,
    var_bps,
    autonomyLevel,
    rwaAction: allocation.action,
    timestamp: Date.now(),
  });
  const intentDigest = ethers.keccak256(ethers.toUtf8Bytes(intentPayload));
  const kmsSig = await kms.signDigest(intentDigest);
  console.log(`   Intent digest: ${intentDigest.slice(0, 20)}...`);
  console.log(`   KMS signature: r=${kmsSig.r.slice(0, 14)}... v=${kmsSig.v} (${kmsSig.simulated ? "simulated" : "hardware"})`);
  console.log(`   DER round-trip: ${kmsSig.derRoundTrip ? "✅" : "mock"}\n`);

  // ─── Step 7: On-chain Recording ───
  console.log("⛓️  [7/7] Recording on-chain (4 TXs)...");
  
  const currentNonce = await provider.getTransactionCount(wallet.address, "latest");
  const confidenceBps = Math.round((decision.analyst?.confidence || 0) * 10000);
  const validatorConfBps = Math.round((decision.validator?.validatorConfidence || 0) * 10000);
  const riskScore = decision.validator?.riskScore || 100;

  // TX 1: Submit proposal
  const tx1 = await registry.submitProposal(
    decision.analyst?.action || "hold",
    decision.analyst?.targetAsset || "mUSD",
    ethers.parseEther("0"),
    confidenceBps,
    `[v2] ${decision.analyst?.reasoning?.substring(0, 150) || "no reasoning"} | VaR:${var_bps}bps | ${autonomyLevel}`,
    { nonce: currentNonce }
  );
  await tx1.wait();
  const proposalId = (await registry.totalProposals()) - 1n;
  console.log(`   ✅ Proposal #${proposalId} (${tx1.hash.slice(0, 18)}...)`);

  // TX 2: Validate
  const tx2 = await registry.validateProposal(
    proposalId,
    validatorConfBps,
    riskScore * 100,
    `[v2] ${decision.validator?.reasoning?.substring(0, 100) || ""} | RWA:${allocation.action}`,
    decision.validator?.approved || false,
    { nonce: currentNonce + 1 }
  );
  await tx2.wait();
  console.log(`   ✅ Validation (${tx2.hash.slice(0, 18)}...)`);

  // TX 3: Decision Log
  const { uploadReasoningProof } = require("../ipfs/storage");
  const ipfsResult = await uploadReasoningProof(decision, enrichedMarket);
  
  const tx3 = await decisionLog.logDecision(
    decision.action,
    decision.analyst?.targetAsset || "mUSD",
    ethers.parseEther("0"),
    ethers.parseEther("0"),
    confidenceBps,
    `[v2-integrated] VaR:${var_bps} | ${autonomyLevel} | RWA:${allocation.action} | IPFS:${ipfsResult.cid?.slice(0, 12)}`,
    ethers.keccak256(ethers.toUtf8Bytes(ipfsResult.cid || "none")),
    { nonce: currentNonce + 2 }
  );
  await tx3.wait();
  console.log(`   ✅ DecisionLog (${tx3.hash.slice(0, 18)}...)`);

  // TX 4: Reputation
  try {
    const repScore = decision.consensus ? Math.round((decision.analyst?.confidence || 0.5) * 50) : 0;
    const ctx = `v2_${decision.analyst?.action}_${autonomyLevel}_var${var_bps}`;
    const tx4 = await reputation.submitFeedback(
      0, repScore,
      ethers.keccak256(ethers.toUtf8Bytes(ipfsResult.cid || "none")),
      ctx,
      { nonce: currentNonce + 3 }
    );
    await tx4.wait();
    console.log(`   ✅ Reputation +${repScore} (${tx4.hash.slice(0, 18)}...)`);
  } catch (e) {
    console.log(`   ⚠️  Reputation: ${e.message?.slice(0, 50)}`);
  }

  // ─── Step 8: EXECUTE SWAP (if consensus + autonomous) ───
  let executionResult = null;
  if (decision.consensus && autonomyLevel === "AUTONOMOUS" && decision.analyst?.action === "swap") {
    console.log("\n💱 [8/8] Executing real swap on Merchant Moe...");
    try {
      const targetAsset = decision.analyst?.targetAsset;
      const allocationPct = Math.min(decision.analyst?.allocationPct || 30, CONFIG.maxSwapSizeUSD);
      
      // Calculate swap amount based on portfolio
      const mntBalance = balances.MNT || 0;
      const swapAmountMNT = Math.min(
        mntBalance * (allocationPct / 100),
        CONFIG.maxSwapSizeUSD / (market.mntPrice || 0.72) // Cap at $100
      );
      
      if (swapAmountMNT < 1) {
        console.log(`   ⚠️  Swap amount too small (${swapAmountMNT.toFixed(2)} MNT). Skipping.`);
      } else {
        const tokenIn = targetAsset === "mETH" ? "WMNT" : "WMNT";
        const tokenOut = targetAsset === "mETH" ? "mETH" : "USDT";
        const amountWei = ethers.parseEther(swapAmountMNT.toFixed(6));
        
        console.log(`   Swapping ${swapAmountMNT.toFixed(2)} MNT → ${tokenOut} (${allocationPct}% allocation)`);
        executionResult = await dex.executeSwap(tokenIn, tokenOut, amountWei);
        
        if (executionResult.executed) {
          console.log(`   ✅ SWAP EXECUTED: ${executionResult.txHash}`);
          console.log(`   Gas: ${executionResult.gasUsed} | Block: ${executionResult.blockNumber}`);
        } else {
          console.log(`   ⚠️  Swap not executed: ${executionResult.reason}`);
        }
      }
    } catch (execErr) {
      console.log(`   ❌ Execution failed: ${execErr.message?.slice(0, 100)}`);
      executionResult = { executed: false, error: execErr.message };
    }
  } else if (decision.consensus && decision.analyst?.action === "hold") {
    console.log("\n📌 [8/8] HOLD — no swap needed.");
  } else {
    console.log("\n⛔ [8/8] No execution — consensus not reached or VaR blocked.");
  }

  // ─── Update Agent Card on IPFS ───
  try {
    const { uploadAndUpdateAgentCard } = require("../../scripts/uploadAgentCard");
    console.log("\n🔄 Updating Agent Card on IPFS...");
    const cardResult = await uploadAndUpdateAgentCard();
    console.log(`   ✅ Agent Card synced — CID: ${cardResult.cid.slice(0, 16)}...`);
  } catch (e) {
    console.log(`   ⚠️  Agent Card update failed: ${e.message?.slice(0, 80)}`);
  }

  // ─── Summary ───
  const totalApproved = await registry.totalApproved();
  const totalRejected = await registry.totalRejected();

  const boxW = 60; // inner width between ║ chars
  const pad = (s) => s.padEnd(boxW);
  console.log(`\n╔${'═'.repeat(boxW)}╗`);
  console.log(`║${pad('  CYCLE COMPLETE — INTEGRATED v2')}║`);
  console.log(`╠${'═'.repeat(boxW)}╣`);
  console.log(`║${pad(`  Consensus: ${decision.consensus ? "APPROVED ✅" : "BLOCKED ❌"}  VaR: ${var_bps} bps`)}║`);
  console.log(`║${pad(`  Autonomy:  ${autonomyLevel}  Mode: ${mode}`)}║`);
  console.log(`║${pad(`  RWA:       ${allocation.action}  Target: ${allocation.targetRWAAllocation.toFixed(0)}%`)}║`);
  console.log(`║${pad(`  DEX:       1 MNT = $${(mntQuote?.estimatedOut || 0).toFixed(4)}`)}║`);
  console.log(`║${pad(`  On-chain:  ${totalApproved} approved / ${totalRejected} rejected`)}║`);
  console.log(`║${pad(`  KMS:       ${kmsSig.simulated ? "simulated" : "HARDWARE"}  DER: ${kmsSig.derRoundTrip ? "✅" : "mock"}`)}║`);
  console.log(`╚${'═'.repeat(boxW)}╝\n`);

  return {
    decision,
    var_bps,
    autonomyLevel,
    allocation,
    dexQuote: mntQuote,
    kmsSig,
    proposalId: Number(proposalId),
    execution: executionResult,
    mode,
  };
}

// ═══ CLI ═══
if (require.main === module) {
  const mode = process.argv[2] || "autonomous";
  runIntegratedCycle({ mode }).catch(console.error);
}

module.exports = { runIntegratedCycle, IntentQueue, calculateVaR, CONFIG };
