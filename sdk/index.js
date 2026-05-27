/**
 * TuringVault Decision Provenance SDK
 *
 * Infrastructure SDK for building Proof-of-Reasoning enabled agents on Mantle.
 * Any AI agent can use this to:
 *   1. Submit proposals through adversarial validation
 *   2. Record verifiable decisions on-chain
 *   3. Pin reasoning proofs to IPFS
 *   4. Query decision history and consensus rates
 *
 * @example
 * const { TuringVaultSDK } = require('@turingvault/sdk');
 *
 * const sdk = new TuringVaultSDK({
 *   privateKey: process.env.PRIVATE_KEY,
 *   rpcUrl: 'https://rpc.mantle.xyz',
 *   pinataJwt: process.env.PINATA_JWT,
 * });
 *
 * // Full PoR flow: propose → validate → record
 * const result = await sdk.createValidatedDecision({
 *   analyst: { model: 'glm-5', action: 'swap', confidence: 0.85, reasoning: 'ETH oversold...' },
 *   validator: { model: 'claude-4.6', riskScore: 35, approved: true, reasoning: 'Risk acceptable' },
 *   targetAsset: 'WETH',
 * });
 * // → { proposalId, decisionId, txHash, ipfsCid, approved, gasUsed }
 *
 * // Read-only (no key needed)
 * const stats = await sdk.getConsensusRate();
 * // → { approved: 1, rejected: 19, total: 20 }
 */

const { ethers } = require("ethers");
const https = require("https");

// ═══ Contract ABIs (matching deployed Mantle Mainnet contracts) ═══

const VALIDATION_REGISTRY_ABI = [
  "function submitProposal(string action, string targetAsset, uint256 amountIn, uint256 confidence, string reasoning) returns (uint256)",
  "function validateProposal(uint256 proposalId, uint256 validatorConfidence, uint256 riskScore, string validatorReasoning, bool approved)",
  "function recordExecution(uint256 proposalId, bytes32 txHash)",
  "function totalProposals() view returns (uint256)",
  "function totalApproved() view returns (uint256)",
  "function totalRejected() view returns (uint256)",
  "function getConsensusRate() view returns (uint256 approved, uint256 rejected, uint256 total)",
  "function getRecentProposals(uint256 count) view returns (tuple(uint256 timestamp, string action, string targetAsset, uint256 amountIn, uint256 confidence, string reasoning, uint256 validatorConfidence, string validatorReasoning, uint256 riskScore, uint8 status, uint256 validatedAt, bytes32 executionTxHash)[])",
];

const DECISION_LOG_ABI = [
  "function logDecision(string action, string targetAsset, uint256 amountIn, uint256 amountOut, uint256 confidence, string reasoningHash, bytes32 txHash) returns (uint256)",
  "function totalDecisions() view returns (uint256)",
  "function getRecentDecisions(uint256 count) view returns (tuple(uint256 timestamp, string action, string targetAsset, uint256 amountIn, uint256 amountOut, uint256 confidence, string reasoningHash, bytes32 txHash)[])",
  "function successfulSwaps() view returns (uint256)",
];

const IDENTITY_ABI = [
  "function tokenURI(uint256 tokenId) view returns (string)",
];

const REPUTATION_ABI = [
  "function getReputation(uint256 agentId) view returns (uint256 score, uint256 totalDecisions, uint256 successRate)",
];

// ═══ Deployed Mantle Mainnet Addresses ═══
const DEFAULT_CONTRACTS = {
  validationRegistry: "0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6",
  decisionLog: "0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5",
  identity: "0x6f862802e0d5463DF18d267e422347BeCacc28bD",
  reputation: "0xC78119F3274B05046Ac7c38a14298a6cbD946e1a",
};

class TuringVaultSDK {
  constructor(config = {}) {
    this.rpcUrl = config.rpcUrl || "https://rpc.mantle.xyz";
    this.contracts = { ...DEFAULT_CONTRACTS, ...config.contracts };
    this.pinataJwt = config.pinataJwt || process.env.PINATA_JWT || "";

    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);

    if (config.privateKey) {
      this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    }
  }

  // ═══════════════════════════════════════════════════
  // WRITE OPERATIONS (require privateKey)
  // ═══════════════════════════════════════════════════

  /**
   * Full Proof-of-Reasoning flow:
   *   1. Pin reasoning proof to IPFS
   *   2. Submit proposal to ValidationRegistry
   *   3. Submit validation result to ValidationRegistry
   *   4. Log decision to DecisionLog
   *
   * @param {object} params
   * @param {object} params.analyst - Analyst model output
   * @param {string} params.analyst.model - Model name (e.g., 'glm-5')
   * @param {string} params.analyst.action - Proposed action (hold/swap/provide_liquidity/increase_rwa)
   * @param {number} params.analyst.confidence - Confidence 0-1
   * @param {string} params.analyst.reasoning - Analysis reasoning
   * @param {object} params.validator - Validator model output
   * @param {string} params.validator.model - Model name (e.g., 'claude-4.6')
   * @param {number} params.validator.riskScore - Risk score 0-100
   * @param {boolean} params.validator.approved - Whether validator approves
   * @param {string} params.validator.reasoning - Validation reasoning
   * @param {string} [params.targetAsset='ETH'] - Target asset
   * @param {number} [params.amountIn=0] - Input amount in wei
   * @returns {Promise<{proposalId, decisionId, txHash, ipfsCid, approved, gasUsed}>}
   */
  async createValidatedDecision(params) {
    if (!this.wallet)
      throw new Error("Private key required for write operations");

    const { analyst, validator, targetAsset = "ETH", amountIn = 0 } = params;

    if (!analyst?.action || analyst?.confidence === undefined) {
      throw new Error("analyst.action and analyst.confidence required");
    }
    if (validator?.riskScore === undefined) {
      throw new Error("validator.riskScore required");
    }

    // Step 1: Build and pin reasoning proof to IPFS
    const proofDocument = {
      version: "2.0.0",
      protocol: "TuringVault Proof-of-Reasoning",
      timestamp: new Date().toISOString(),
      chain: "mantle-mainnet",
      chainId: 5000,
      analyst: {
        model: analyst.model || "unknown",
        action: analyst.action,
        confidence: analyst.confidence,
        reasoning: analyst.reasoning || "",
      },
      validator: {
        model: validator.model || "unknown",
        riskScore: validator.riskScore,
        approved: validator.approved !== false,
        confidence: validator.confidence || 0,
        reasoning: validator.reasoning || "",
      },
      consensus: {
        reached:
          validator.approved !== false &&
          analyst.confidence >= 0.6 &&
          validator.riskScore <= 65,
        action: validator.approved !== false ? analyst.action : "hold",
      },
    };

    let ipfsCid = "";
    if (this.pinataJwt) {
      ipfsCid = await this._pinToIPFS(proofDocument, `PoR-${Date.now()}`);
    } else {
      const crypto = require("crypto");
      ipfsCid =
        "sha256:" +
        crypto
          .createHash("sha256")
          .update(JSON.stringify(proofDocument))
          .digest("hex");
    }

    const confidenceBps = Math.round(analyst.confidence * 10000);
    const validatorConfidenceBps = Math.round(
      (validator.confidence || analyst.confidence) * 10000
    );
    const riskScoreBps = validator.riskScore * 100; // 0-10000

    // Step 2: Submit proposal to ValidationRegistry
    const registry = new ethers.Contract(
      this.contracts.validationRegistry,
      VALIDATION_REGISTRY_ABI,
      this.wallet
    );

    const proposalTx = await registry.submitProposal(
      analyst.action,
      targetAsset,
      amountIn,
      confidenceBps,
      analyst.reasoning || ipfsCid
    );
    const proposalReceipt = await proposalTx.wait();

    // Extract proposalId from receipt (totalProposals - 1)
    const totalAfterSubmit = await registry.totalProposals();
    const proposalId = Number(totalAfterSubmit) - 1;

    // Step 3: Validate the proposal
    const validateTx = await registry.validateProposal(
      proposalId,
      validatorConfidenceBps,
      riskScoreBps,
      validator.reasoning || "",
      validator.approved !== false
    );
    await validateTx.wait();

    // Step 4: Log to DecisionLog
    const decisionLog = new ethers.Contract(
      this.contracts.decisionLog,
      DECISION_LOG_ABI,
      this.wallet
    );

    const logTx = await decisionLog.logDecision(
      analyst.action,
      targetAsset,
      amountIn,
      0, // amountOut (filled post-execution)
      confidenceBps,
      ipfsCid,
      ethers.ZeroHash
    );
    const logReceipt = await logTx.wait();
    const decisionId = Number(await decisionLog.totalDecisions()) - 1;

    const totalGas =
      proposalReceipt.gasUsed + validateTx.gasUsed + logReceipt.gasUsed;

    return {
      proposalId,
      decisionId,
      txHash: logReceipt.hash,
      proposalTxHash: proposalReceipt.hash,
      validationTxHash: validateTx.hash,
      ipfsCid,
      approved: proofDocument.consensus.reached,
      gasUsed: totalGas.toString(),
      proofDocument,
    };
  }

  /**
   * Simplified: record a pre-validated decision directly to DecisionLog.
   * Use when you handle validation externally and just need provenance.
   */
  async logDecision(params) {
    if (!this.wallet)
      throw new Error("Private key required for write operations");

    const {
      action,
      targetAsset = "ETH",
      amountIn = 0,
      amountOut = 0,
      confidence,
      reasoningHash,
    } = params;

    const decisionLog = new ethers.Contract(
      this.contracts.decisionLog,
      DECISION_LOG_ABI,
      this.wallet
    );
    const confidenceBps = Math.round((confidence || 0) * 10000);

    const tx = await decisionLog.logDecision(
      action,
      targetAsset,
      amountIn,
      amountOut,
      confidenceBps,
      reasoningHash || "",
      ethers.ZeroHash
    );
    const receipt = await tx.wait();
    const decisionId = Number(await decisionLog.totalDecisions()) - 1;

    return {
      decisionId,
      txHash: receipt.hash,
      gasUsed: receipt.gasUsed.toString(),
    };
  }

  // ═══════════════════════════════════════════════════
  // READ OPERATIONS (no key needed)
  // ═══════════════════════════════════════════════════

  /**
   * Get consensus rate from ValidationRegistry
   * @returns {Promise<{approved: number, rejected: number, total: number}>}
   */
  async getConsensusRate() {
    const registry = new ethers.Contract(
      this.contracts.validationRegistry,
      VALIDATION_REGISTRY_ABI,
      this.provider
    );
    const [approved, rejected, total] = await registry.getConsensusRate();
    return {
      approved: Number(approved),
      rejected: Number(rejected),
      total: Number(total),
    };
  }

  /**
   * Get recent proposals with full validation data
   * @param {number} count - Number of recent proposals to fetch
   */
  async getRecentProposals(count = 10) {
    const registry = new ethers.Contract(
      this.contracts.validationRegistry,
      VALIDATION_REGISTRY_ABI,
      this.provider
    );
    const proposals = await registry.getRecentProposals(count);
    return proposals.map((p) => ({
      timestamp: Number(p[0]),
      action: p[1],
      targetAsset: p[2],
      amountIn: p[3].toString(),
      confidence: Number(p[4]),
      reasoning: p[5],
      validatorConfidence: Number(p[6]),
      validatorReasoning: p[7],
      riskScore: Number(p[8]),
      status: ["Pending", "Approved", "Rejected", "Expired"][Number(p[9])],
      validatedAt: Number(p[10]),
    }));
  }

  /**
   * Get recent decisions from DecisionLog
   * @param {number} count - Number of recent decisions
   */
  async getRecentDecisions(count = 10) {
    const decisionLog = new ethers.Contract(
      this.contracts.decisionLog,
      DECISION_LOG_ABI,
      this.provider
    );
    const decisions = await decisionLog.getRecentDecisions(count);
    return decisions.map((d) => ({
      timestamp: Number(d[0]),
      action: d[1],
      targetAsset: d[2],
      amountIn: d[3].toString(),
      amountOut: d[4].toString(),
      confidence: Number(d[5]) / 100,
      reasoningHash: d[6],
      txHash: d[7],
    }));
  }

  /**
   * Get total decision count
   */
  async getTotalDecisions() {
    const decisionLog = new ethers.Contract(
      this.contracts.decisionLog,
      DECISION_LOG_ABI,
      this.provider
    );
    return Number(await decisionLog.totalDecisions());
  }

  /**
   * Get agent identity (ERC-8004 tokenURI from IPFS)
   * @param {number} agentId - Token ID (default: 0)
   */
  async getAgentIdentity(agentId = 0) {
    const identity = new ethers.Contract(
      this.contracts.identity,
      IDENTITY_ABI,
      this.provider
    );
    const uri = await identity.tokenURI(agentId);

    if (!uri) return null;

    const cid = uri.replace("ipfs://", "");
    try {
      const res = await fetch(`https://ipfs.io/ipfs/${cid}`);
      if (res.ok) return await res.json();
    } catch {}

    return { tokenURI: uri, cid };
  }

  // ═══════════════════════════════════════════════════
  // INTERNAL
  // ═══════════════════════════════════════════════════

  async _pinToIPFS(json, name) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        pinataContent: json,
        pinataMetadata: { name },
      });
      const req = https.request(
        {
          hostname: "api.pinata.cloud",
          path: "/pinning/pinJSONToIPFS",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.pinataJwt}`,
            "Content-Length": Buffer.byteLength(payload),
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              const parsed = JSON.parse(data);
              if (parsed.IpfsHash) resolve(parsed.IpfsHash);
              else reject(new Error(`Pinata error: ${data}`));
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
}

module.exports = { TuringVaultSDK, DEFAULT_CONTRACTS };
