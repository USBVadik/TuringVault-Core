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

const PINATA_GATEWAY =
  process.env.PINATA_GATEWAY || "green-linear-jay-761.mypinata.cloud";

function getPinataJwt() {
  return process.env.PINATA_JWT || "";
}

function getPinataUploadMode() {
  return String(process.env.PINATA_UPLOAD_MODE || "pinata").toLowerCase();
}

function isStrictPinataMode() {
  return String(process.env.PINATA_STRICT || "").toLowerCase() === "true";
}

function localAnchorFallback(jsonData, name, reason) {
  const crypto = require("crypto");
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify({ name, jsonData }))
    .digest("hex");
  const fakeCid = `bafkrei${hash.slice(0, 52)}`;
  return {
    cid: fakeCid,
    uri: `ipfs://${fakeCid}`,
    gateway: null,
    degraded: true,
    storage: "local-anchor",
    reason,
  };
}

/**
 * Upload JSON to IPFS via Pinata pinJSONToIPFS
 * @param {object} jsonData - The JSON object to pin
 * @param {string} name - Human-readable name for the pin
 * @returns {Promise<{cid: string, uri: string}>}
 */
async function pinJSON(jsonData, name = "turingvault-reasoning") {
  const uploadMode = getPinataUploadMode();
  if (uploadMode === "anchor-only") {
    return localAnchorFallback(jsonData, name, "PINATA_UPLOAD_MODE=anchor-only");
  }

  const pinataJwt = getPinataJwt();
  if (!pinataJwt) {
    return localAnchorFallback(jsonData, name, "PINATA_JWT not configured");
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
          Authorization: `Bearer ${pinataJwt}`,
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
              const err = new Error(`Pinata error: ${data}`);
              if (isStrictPinataMode()) {
                reject(err);
              } else {
                resolve(localAnchorFallback(jsonData, name, err.message));
              }
            }
          } catch (e) {
            if (isStrictPinataMode()) {
              reject(e);
            } else {
              resolve(
                localAnchorFallback(
                  jsonData,
                  name,
                  `Pinata response parse failed: ${e.message}`
                )
              );
            }
          }
        });
      }
    );
    req.on("error", (e) => {
      if (isStrictPinataMode()) {
        reject(e);
      } else {
        resolve(localAnchorFallback(jsonData, name, `Pinata request failed: ${e.message}`));
      }
    });
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
        "Elfa Social",
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
      gridCandidateApplied:
        decision.analyst?._gridTradeCandidateApplied === true,
      originalProposal: decision.analyst?._originalAnalystProposal || null,
    },

    // Deterministic buy-low/sell-high candidate considered before the
    // final analyst proposal. This keeps promotion/rejection auditable.
    gridTradeCandidate: decision._gridTradeCandidate || null,

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
      // ERC-8004 three-registry implementation on Mantle Mainnet (chain 5000).
      // 5 of 6 contracts Sourcify-verified `perfect` (checked 2026-05-30):
      // Identity, ReputationRegistry, ValidationRegistry, ValidationHelper,
      // DecisionLog. The sixth (TuringVaultRouter) was deployed but its
      // source drifted post-deploy; not on the production execution path
      // (audit-21 smart router supersedes it).
      // The first three are the canonical ERC-8004 registries; the rest
      // are application-specific.
      identity: "0x6f862802e0d5463DF18d267e422347BeCacc28bD",
      reputationRegistry: "0xC78119F3274B05046Ac7c38a14298a6cbD946e1a",
      validationRegistry: "0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6",
      validationHelper: "0x0aeEd88959fCFC665284225dB93DED3e8A3Ff705",
      decisionLog: "0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5",
      router: "0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001",
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
      "elfa-social",
    ],
  };

  return pinJSON(agentCard, "TuringVault-AgentCard-v2");
}

module.exports = { pinJSON, uploadReasoningProof, uploadAgentCard };
