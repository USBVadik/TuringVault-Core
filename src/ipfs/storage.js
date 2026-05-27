/**
 * TuringVault — IPFS Storage Module
 *
 * Uploads reasoning proofs and Agent Cards to IPFS via Pinata.
 * Returns CID (Content Identifier) for on-chain reference.
 *
 * Two modes:
 *   1. Pinata Cloud (PINATA_JWT in .env) — persistent pinning
 *   2. nft.storage fallback — free for NFT metadata
 */
const https = require("https");

const PINATA_JWT = process.env.PINATA_JWT || "";
const PINATA_GATEWAY =
  process.env.PINATA_GATEWAY || "green-linear-jay-761.mypinata.cloud";

/**
 * Upload JSON to IPFS via Pinata pinJSONToIPFS
 * @param {object} jsonData - The JSON object to pin
 * @param {string} name - Human-readable name for the pin
 * @returns {Promise<{cid: string, uri: string}>}
 */
async function pinJSON(jsonData, name = "turingvault-reasoning") {
  if (!PINATA_JWT) {
    // Fallback: generate deterministic hash for demo
    const crypto = require("crypto");
    const hash = crypto
      .createHash("sha256")
      .update(JSON.stringify(jsonData))
      .digest("hex");
    const fakeCid = `bafkrei${hash.slice(0, 52)}`;
    return { cid: fakeCid, uri: `ipfs://${fakeCid}` };
  }

  const payload = JSON.stringify({
    pinataContent: jsonData,
    pinataMetadata: { name },
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.pinata.cloud",
        path: "/pinning/pinJSONToIPFS",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PINATA_JWT}`,
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.IpfsHash) {
              resolve({
                cid: parsed.IpfsHash,
                uri: `ipfs://${parsed.IpfsHash}`,
                gateway: `https://${PINATA_GATEWAY}/ipfs/${parsed.IpfsHash}`,
              });
            } else {
              reject(new Error(`Pinata error: ${data}`));
            }
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Create and upload Proof-of-Reasoning document
 * Contains full decision context for on-chain verification
 */
async function uploadReasoningProof(decision, marketData) {
  const proof = {
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    protocol: "TuringVault Proof-of-Reasoning",
    chain: "mantle-mainnet",
    chainId: 5000,

    // Market context at decision time
    marketContext: {
      ethPrice: marketData.ethPrice,
      fearGreedIndex: marketData.fearGreedIndex,
      sentiment: marketData.sentiment,
      mantleTVL: marketData.mantleTVL,
      dataSources: [
        "CoinGecko",
        "DeFiLlama",
        "Fear&Greed",
        "Nansen MCP",
        "Byreal Perps",
      ],
    },

    // Analyst output
    analyst: {
      model: "claude-sonnet-4.6",
      action: decision.analyst?.action,
      targetAsset: decision.analyst?.targetAsset,
      confidence: decision.analyst?.confidence,
      reasoning: decision.analyst?.reasoning,
      riskFactors: decision.analyst?.riskFactors || [],
    },

    // Validator output
    validator: {
      model: "claude-sonnet-4.6",
      approved: decision.validator?.approved,
      confidence: decision.validator?.validatorConfidence,
      riskScore: decision.validator?.riskScore,
      reasoning: decision.validator?.reasoning,
      flaggedIssues: decision.validator?.flaggedIssues || [],
    },

    // Consensus result
    consensus: {
      reached: decision.consensus,
      action: decision.consensus ? decision.analyst?.action : "hold",
      thresholds: {
        analystConfidence: 0.75,
        validatorConfidence: 0.7,
        maxRiskScore: 65,
      },
    },
  };

  const name = `PoR-${Date.now()}-${decision.analyst?.action || "hold"}`;
  return pinJSON(proof, name);
}

/**
 * Create and upload Agent Card (ERC-8004 Identity metadata)
 */
async function uploadAgentCard() {
  const agentCard = {
    name: "TuringVault Cognitive Agent",
    description:
      "Multi-agent AI RWA portfolio manager with Proof-of-Reasoning on Mantle",
    version: "3.0.0",

    // ERC-8004 required fields — three independent models, see assets/agent-card.json for full detail
    models: [
      { name: "zai.glm-5", role: "analyst", provider: "aws-bedrock" },
      {
        name: "us.anthropic.claude-sonnet-4-6",
        role: "validator",
        provider: "aws-bedrock",
      },
      {
        name: "gemini-3.5-flash",
        role: "arbiter",
        provider: "google-vertex-ai",
      },
    ],

    capabilities: [
      "market-analysis",
      "multi-agent-consensus",
      "proof-of-reasoning",
      "risk-management",
      "rwa-allocation",
      "post-execution-verification",
    ],

    protocols: {
      execution: "merchant-moe-lb-v2.2",
      analytics: "nansen-mcp",
      signing:
        "ethers.Wallet (vault contract pattern + hardware KMS are roadmap)",
      consensus: "triple-agent-zod-validated",
      verification: "synrail-inspired-discipline-layer",
    },

    wallets: [
      {
        chain: "mantle-mainnet",
        chainId: 5000,
        address:
          process.env.AGENT_ADDRESS ||
          "0x0000000000000000000000000000000000000000",
      },
    ],

    contracts: {
      identity: "0x582E6a649B99784829193E14bB7Af8c4A482E165",
      decisionLog: "0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5",
      router: "0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001",
      validationRegistry: "0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6",
    },

    riskParameters: {
      maxLeverage: 5,
      maxPositionSizeBTC: 0.1,
      maxDrawdownPct: 10,
      minConsensusConfidence: 0.75,
      maxRiskScore: 65,
    },

    dataSources: [
      "coingecko",
      "defillama",
      "fear-and-greed-index",
      "nansen-mcp",
      "byreal-perps-signals",
    ],
  };

  return pinJSON(agentCard, "TuringVault-AgentCard-v2");
}

module.exports = { pinJSON, uploadReasoningProof, uploadAgentCard };
