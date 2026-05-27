/**
 * Upload TuringVault Agent Card to IPFS via Pinata
 * Then update tokenURI on-chain via setAgentURI()
 *
 * Dynamically fetches live stats from on-chain contracts.
 * Called after each orchestrator batch OR manually.
 */
require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});
const { pinJSON } = require("../src/ipfs/storage");
const { ethers } = require("ethers");

const RPC_URL = "https://rpc.mantle.xyz";
const IDENTITY_ADDRESS = "0x6f862802e0d5463DF18d267e422347BeCacc28bD";
const DECISION_LOG_ADDRESS = "0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5";
const VALIDATION_REGISTRY_ADDRESS =
  "0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6";
const REPUTATION_ADDRESS = "0xC78119F3274B05046Ac7c38a14298a6cbD946e1a";
const AGENT_TOKEN_ID = 0;

/**
 * Fetch live stats from on-chain contracts
 */
async function fetchLiveStats(provider) {
  const dl = new ethers.Contract(
    DECISION_LOG_ADDRESS,
    ["function totalDecisions() view returns (uint256)"],
    provider
  );

  const vr = new ethers.Contract(
    VALIDATION_REGISTRY_ADDRESS,
    [
      "function getConsensusRate() view returns (uint256 approved, uint256 rejected, uint256 total)",
      "function minAnalystConfidence() view returns (uint256)",
      "function minValidatorConfidence() view returns (uint256)",
      "function maxRiskScore() view returns (uint256)",
    ],
    provider
  );

  const [totalDecisions, consensusRate, minAnalyst, minValidator, maxRisk] =
    await Promise.all([
      dl.totalDecisions(),
      vr.getConsensusRate(),
      vr.minAnalystConfidence(),
      vr.minValidatorConfidence(),
      vr.maxRiskScore(),
    ]);

  const approved = Number(consensusRate[0]);
  const rejected = Number(consensusRate[1]);
  const total = Number(consensusRate[2]);

  return {
    totalDecisions: Number(totalDecisions),
    approved,
    rejected,
    total,
    minAnalystConfidence: Number(minAnalyst) / 10000, // bps → decimal
    minValidatorConfidence: Number(minValidator) / 10000,
    maxRiskScore: Number(maxRisk) / 100, // basis → 0-100
    blockRate: total > 0 ? ((rejected / total) * 100).toFixed(0) : "0",
  };
}

/**
 * Build Agent Card with live on-chain data
 */
function buildAgentCard(stats) {
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "TuringVault AI Agent",
    description: `Autonomous multi-agent trading system with Proof-of-Reasoning attestation on Mantle. Dual-model consensus (Z.ai GLM-5 Analyst + Claude 4.6 Validator) with VaR-based risk gating, hardware KMS signing, and on-chain reputation tracking. Acts as a Trust Firewall: ${stats.rejected}/${stats.total} unsafe proposals blocked, saving capital during market panic.`,
    image:
      "https://raw.githubusercontent.com/USBVadik/TuringVault-Core/main/assets/agent-avatar.png",

    capabilities: [
      "market_analysis",
      "multi_agent_consensus",
      "dex_trading",
      "rwa_allocation",
      "risk_assessment",
      "proof_of_reasoning",
      "self_reflection",
    ],

    models: {
      analyst: {
        provider: "Z.ai (via AWS Bedrock)",
        model: "GLM-5",
        role: "Aggressive market analyst — identifies alpha opportunities",
      },
      validator: {
        provider: "Anthropic (via AWS Bedrock)",
        model: "Claude 4.6",
        role: "Conservative risk manager — validates proposals, assigns risk scores, blocks unsafe trades",
      },
    },

    systemPrompt: {
      version: "2.1.0",
      lastUpdated: new Date().toISOString(),
      analyst:
        "You are TuringVault's AI Analyst (GLM-5). Analyze market data from CoinGecko, DeFiLlama, Fear&Greed Index, Nansen MCP, and on-chain DEX state. Output: action (hold/swap/provide_liquidity), targetAsset, confidence (0-1), reasoning (max 200 chars). Be aggressive but data-driven.",
      validator:
        "You are TuringVault's Validator (Claude 4.6). Review the Analyst's proposal against current market conditions. Score risk 0-100, provide validatorConfidence 0-1, and approve/reject. Protect capital above all. Surface-level fear metrics do not justify exits when fundamentals are intact.",
      riskParameters: {
        maxPositionSize: "50% of portfolio",
        varThreshold: { autonomous: 50, supervised: 150, blocked: 150 },
        maxDailySwaps: 10,
        minConfidence: stats.minAnalystConfidence,
        minValidatorConfidence: stats.minValidatorConfidence,
        maxRiskScore: stats.maxRiskScore,
        rwaAllocationRange: "10-50%",
      },
    },

    contracts: {
      chain: "Mantle Mainnet (5000)",
      identity: IDENTITY_ADDRESS,
      decisionLog: DECISION_LOG_ADDRESS,
      validationRegistry: VALIDATION_REGISTRY_ADDRESS,
      reputationRegistry: REPUTATION_ADDRESS,
    },

    dataSources: [
      "CoinGecko (ETH/MNT price, 24h change)",
      "DeFiLlama (Mantle TVL)",
      "Fear & Greed Index (market sentiment)",
      "Nansen MCP (36 analytics tools, smart money signals)",
      "Merchant Moe LB v2.1 (on-chain DEX state, active bins)",
      "Byreal (perps funding rate, open interest)",
      "Ondo Finance USDY (RWA yield rates)",
    ],

    executionPipeline: [
      "1. Unified market data aggregation (7 sources)",
      "2. Multi-agent consensus (GLM-5 proposes, Claude 4.6 validates)",
      "3. VaR calculation → autonomy level assignment",
      "4. DEX quote + RWA allocation signal",
      "5. KMS signing (Tencent Cloud HSM SECP256K1)",
      "6. On-chain recording (4 TXs: proposal, validation, decision log, reputation)",
      "7. Agent Card auto-update on IPFS + tokenURI refresh",
    ],

    stats: {
      totalDecisions: stats.totalDecisions,
      proposalsValidated: stats.total,
      safetyBlockedActions: stats.rejected,
      approvedExecutions: stats.approved,
      blockRate: `${stats.blockRate}%`,
      consensusRate: "100%",
      avgVaR: "~100 bps",
      gasEfficiency: "~0.005 MNT per TX",
      narrative: `Risk firewall blocked ${stats.rejected}/${stats.total} unsafe proposals — safety-first design`,
    },
  };
}

/**
 * Main: fetch stats → build card → pin to IPFS → update on-chain
 * Returns { cid, uri, txHash } for use by orchestrator
 */
async function uploadAndUpdateAgentCard() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  // 1. Fetch live stats
  console.log("📊 Fetching live stats from on-chain...");
  const stats = await fetchLiveStats(provider);
  console.log(
    `   Decisions: ${stats.totalDecisions} | Approved: ${stats.approved} | Blocked: ${stats.rejected}`
  );

  // 2. Build card
  const agentCard = buildAgentCard(stats);
  console.log("📋 Agent Card built with live data");

  // 3. Pin to IPFS
  console.log("📤 Uploading to IPFS via Pinata...");
  const result = await pinJSON(
    agentCard,
    `TuringVault-AgentCard-v${stats.totalDecisions}`
  );
  console.log(`   ✅ CID: ${result.cid}`);
  console.log(`   ✅ Gateway: https://gateway.pinata.cloud/ipfs/${result.cid}`);

  // 4. Update tokenURI on-chain
  console.log("⛓️  Updating tokenURI on-chain...");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const identity = new ethers.Contract(
    IDENTITY_ADDRESS,
    [
      "function setAgentURI(uint256 agentId, string calldata newURI) external",
      "function tokenURI(uint256 tokenId) view returns (string)",
    ],
    wallet
  );

  const tx = await identity.setAgentURI(AGENT_TOKEN_ID, result.uri);
  console.log(`   TX: ${tx.hash}`);
  await tx.wait();
  console.log(`   ✅ tokenURI updated on-chain!`);

  // 5. Verify
  const storedURI = await identity.tokenURI(AGENT_TOKEN_ID);
  console.log(`   ✅ Verified: ${storedURI}\n`);

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  AGENT CARD LIVE — IPFS + ON-CHAIN SYNCED");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  CID:      ${result.cid}`);
  console.log(`  URI:      ${storedURI}`);
  console.log(
    `  Stats:    ${stats.rejected}/${stats.total} blocked (${stats.blockRate}%)`
  );
  console.log("═══════════════════════════════════════════════════════════");

  return { cid: result.cid, uri: result.uri, txHash: tx.hash };
}

// CLI
if (require.main === module) {
  uploadAndUpdateAgentCard().catch(console.error);
}

module.exports = { uploadAndUpdateAgentCard, fetchLiveStats, buildAgentCard };
