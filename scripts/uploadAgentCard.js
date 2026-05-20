/**
 * Upload TuringVault Agent Card to IPFS via Pinata
 * Then update tokenURI on-chain via setAgentURI()
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { pinJSON } = require("../src/ipfs/storage");
const { ethers } = require("ethers");

const IDENTITY_ADDRESS = "0x6f862802e0d5463DF18d267e422347BeCacc28bD";
const AGENT_TOKEN_ID = 0;

const AGENT_CARD = {
  type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  name: "TuringVault AI Agent",
  description: "Autonomous multi-agent trading system with Proof-of-Reasoning attestation on Mantle. Dual-model consensus (Z.ai GLM-5 Analyst + Claude Sonnet 4.6 Validator) with VaR-based autonomy, hardware KMS signing, and on-chain reputation tracking.",
  image: "https://raw.githubusercontent.com/USBVadik/TuringVault-Core/main/assets/agent-avatar.png",
  
  // ERC-8004 standard fields
  capabilities: [
    "market_analysis",
    "multi_agent_consensus",
    "dex_trading",
    "rwa_allocation",
    "risk_assessment",
    "self_reflection"
  ],
  
  // Custom TuringVault fields
  models: {
    analyst: {
      provider: "Z.ai (via AWS Bedrock)",
      model: "GLM-5",
      role: "Aggressive market analyst — identifies alpha opportunities"
    },
    validator: {
      provider: "Anthropic (via AWS Bedrock)",
      model: "Claude Sonnet 4.6",
      role: "Conservative risk manager — validates proposals, assigns risk scores"
    }
  },
  
  systemPrompt: {
    version: "2.0.0",
    lastUpdated: new Date().toISOString(),
    analyst: "You are TuringVault's AI Analyst (GLM-5). Analyze market data from CoinGecko, DeFiLlama, Fear&Greed Index, and on-chain DEX state. Output: action (hold/swap/provide_liquidity), targetAsset, confidence (0-1), reasoning (max 200 chars). Be aggressive but data-driven.",
    validator: "You are TuringVault's Validator (Claude). Review the Analyst's proposal against current market conditions. Score risk 0-100, provide validatorConfidence 0-1, and approve/reject. Protect capital above all.",
    riskParameters: {
      maxPositionSize: "50% of portfolio",
      varThreshold: { autonomous: 50, supervised: 150, blocked: 300 },
      maxDailySwaps: 10,
      minConfidence: 0.6,
      rwaAllocationRange: "10-50%"
    }
  },
  
  contracts: {
    chain: "Mantle Mainnet (5000)",
    identity: "0x6f862802e0d5463DF18d267e422347BeCacc28bD",
    decisionLog: "0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5",
    validationRegistry: "0x0aeEd88959fCFC665284225dB93DED3e8A3Ff705",
    reputationRegistry: "0xC78119F3274B05046Ac7c38a14298a6cbD946e1a",
    router: "0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001"
  },
  
  dataSources: [
    "CoinGecko (ETH/MNT price, 24h change)",
    "DeFiLlama (Mantle TVL)",
    "Fear & Greed Index (market sentiment)",
    "Merchant Moe LB v2.1 (on-chain DEX state, active bins)",
    "Ondo Finance USDY (RWA yield rates)"
  ],
  
  executionPipeline: [
    "1. Unified market data aggregation (5 sources)",
    "2. Multi-agent consensus (GLM-5 proposes, Claude validates)",
    "3. VaR calculation → autonomy level assignment",
    "4. DEX quote + RWA allocation signal",
    "5. KMS signing (Tencent Cloud HSM / simulation)",
    "6. On-chain recording (4 TXs: proposal, validation, decision log, reputation)"
  ],
  
  stats: {
    totalDecisions: "60+",
    consensusRate: "100%",
    avgVaR: "~100 bps",
    gasEfficiency: "~0.005 MNT per TX"
  }
};

async function main() {
  console.log("📋 Agent Card prepared:");
  console.log(JSON.stringify(AGENT_CARD, null, 2).slice(0, 500) + "...\n");
  
  // Upload to IPFS
  console.log("📤 Uploading Agent Card to IPFS via Pinata...");
  const result = await pinJSON(AGENT_CARD, "TuringVault-AgentCard-v2");
  console.log(`   ✅ CID: ${result.cid}`);
  console.log(`   ✅ URI: ${result.uri}`);
  console.log(`   ✅ Gateway: https://gateway.pinata.cloud/ipfs/${result.cid}\n`);
  
  // Update tokenURI on-chain
  console.log("⛓️  Updating tokenURI on-chain (setAgentURI)...");
  const provider = new ethers.JsonRpcProvider("https://rpc.mantle.xyz");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  const identityABI = [
    "function setAgentURI(uint256 agentId, string calldata newURI) external",
    "function tokenURI(uint256 tokenId) view returns (string)"
  ];
  const identity = new ethers.Contract(IDENTITY_ADDRESS, identityABI, wallet);
  
  const ipfsUri = result.uri; // ipfs://Qm... or ipfs://bafk...
  const tx = await identity.setAgentURI(AGENT_TOKEN_ID, ipfsUri);
  console.log(`   TX: ${tx.hash}`);
  await tx.wait();
  console.log(`   ✅ tokenURI updated on-chain!`);
  
  // Verify
  const storedURI = await identity.tokenURI(AGENT_TOKEN_ID);
  console.log(`   ✅ Verified tokenURI: ${storedURI}\n`);
  
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  AGENT CARD DEPLOYED TO IPFS + ON-CHAIN");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  IPFS CID: ${result.cid}`);
  console.log(`  Token URI: ${storedURI}`);
  console.log(`  Contract: ${IDENTITY_ADDRESS}`);
  console.log(`  Token ID: ${AGENT_TOKEN_ID}`);
  console.log("═══════════════════════════════════════════════════════════");
}

main().catch(console.error);
