/**
 * TuringVault Agent Trust SDK
 * 
 * Minimal SDK for building Proof-of-Reasoning enabled agents on Mantle.
 * Any AI agent can use this to record verifiable decisions on-chain.
 * 
 * @example
 * const { TuringVaultSDK } = require('@turingvault/sdk');
 * 
 * const sdk = new TuringVaultSDK({
 *   privateKey: process.env.PRIVATE_KEY,
 *   rpcUrl: 'https://rpc.mantle.xyz',
 * });
 * 
 * const proof = await sdk.createPoRDecision({
 *   analyst: { model: 'gpt-4', action: 'swap', confidence: 0.85, reasoning: 'ETH oversold' },
 *   validator: { model: 'claude-4', riskScore: 35, approved: true, reasoning: 'Risk acceptable' },
 * });
 * // proof.txHash, proof.ipfsCid, proof.decisionId
 */

const { ethers } = require('ethers');
const https = require('https');

// ═══ Contract ABIs (minimal) ═══
const DECISION_LOG_ABI = [
  'function logDecision(string action, string targetAsset, uint256 amountIn, uint256 amountOut, uint256 confidence, string reasoningHash, bytes32 txHash) returns (uint256)',
  'function totalDecisions() view returns (uint256)',
  'function getRecentDecisions(uint256 count) view returns (tuple(uint256 timestamp, string action, string targetAsset, uint256 amountIn, uint256 amountOut, uint256 confidence, string reasoningHash, bytes32 txHash)[])',
];

const VALIDATION_ABI = [
  'function validationRequest(uint256 agentId, string calldata requestURI, string calldata tag) returns (bytes32)',
  'function validationResponse(bytes32 requestHash, uint8 score, string calldata responseURI) external',
];

// ═══ Default Mantle Mainnet Addresses ═══
const DEFAULT_CONTRACTS = {
  decisionLog: '0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5',
  validation: '0x0aeEd88959fCFC665284225dB93DED3e8A3Ff705',
  identity: '0x6f862802e0d5463DF18d267e422347BeCacc28bD',
  reputation: '0xC78119F3274B05046Ac7c38a14298a6cbD946e1a',
};

class TuringVaultSDK {
  constructor(config = {}) {
    this.rpcUrl = config.rpcUrl || 'https://rpc.mantle.xyz';
    this.contracts = { ...DEFAULT_CONTRACTS, ...config.contracts };
    this.pinataJwt = config.pinataJwt || process.env.PINATA_JWT || '';
    
    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
    
    if (config.privateKey) {
      this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    }
  }

  /**
   * Create a Proof-of-Reasoning decision and record it on-chain
   * 
   * @param {object} params
   * @param {object} params.analyst - Analyst model output
   * @param {string} params.analyst.model - Model name (e.g., 'gpt-4')
   * @param {string} params.analyst.action - Proposed action (hold/swap/provide_liquidity)
   * @param {number} params.analyst.confidence - Confidence 0-1
   * @param {string} params.analyst.reasoning - Short reasoning text
   * @param {object} params.validator - Validator model output
   * @param {string} params.validator.model - Model name
   * @param {number} params.validator.riskScore - Risk score 0-100
   * @param {boolean} params.validator.approved - Whether validator approves
   * @param {string} params.validator.reasoning - Validation reasoning
   * @param {string} [params.targetAsset] - Target asset (default: 'ETH')
   * @param {string} [params.tag] - Decision tag (e.g., 'trade', 'rebalance')
   * @returns {Promise<{decisionId, txHash, ipfsCid, approved}>}
   */
  async createPoRDecision(params) {
    if (!this.wallet) throw new Error('Private key required for write operations');
    
    const { analyst, validator, targetAsset = 'ETH', tag = 'trade' } = params;
    
    // Validate inputs
    if (!analyst?.action || !analyst?.confidence) throw new Error('analyst.action and analyst.confidence required');
    if (!validator?.riskScore === undefined) throw new Error('validator.riskScore required');
    
    // Build reasoning proof document
    const proofDocument = {
      version: '1.0.0',
      protocol: 'TuringVault Proof-of-Reasoning',
      timestamp: new Date().toISOString(),
      chain: 'mantle-mainnet',
      chainId: 5000,
      analyst: {
        model: analyst.model || 'unknown',
        action: analyst.action,
        confidence: analyst.confidence,
        reasoning: analyst.reasoning || '',
      },
      validator: {
        model: validator.model || 'unknown',
        riskScore: validator.riskScore,
        approved: validator.approved,
        reasoning: validator.reasoning || '',
      },
      consensus: {
        reached: validator.approved && analyst.confidence >= 0.6,
        action: validator.approved ? analyst.action : 'hold',
      },
    };
    
    // Upload proof to IPFS
    let ipfsCid = '';
    if (this.pinataJwt) {
      ipfsCid = await this._pinToIPFS(proofDocument, `PoR-${Date.now()}`);
    } else {
      // Deterministic hash fallback
      const crypto = require('crypto');
      ipfsCid = crypto.createHash('sha256').update(JSON.stringify(proofDocument)).digest('hex');
    }
    
    // Record on-chain
    const decisionLog = new ethers.Contract(this.contracts.decisionLog, DECISION_LOG_ABI, this.wallet);
    
    const confidenceBps = Math.round(analyst.confidence * 10000);
    const tx = await decisionLog.logDecision(
      analyst.action,
      targetAsset,
      0, // amountIn (0 for non-execution decisions)
      0, // amountOut
      confidenceBps,
      ipfsCid,
      ethers.ZeroHash, // txHash (filled post-execution if approved)
    );
    
    const receipt = await tx.wait();
    const decisionId = await decisionLog.totalDecisions() - 1n;
    
    return {
      decisionId: Number(decisionId),
      txHash: receipt.hash,
      ipfsCid,
      approved: validator.approved,
      gasUsed: receipt.gasUsed.toString(),
      proofDocument,
    };
  }

  /**
   * Read recent decisions from chain
   */
  async getRecentDecisions(count = 10) {
    const decisionLog = new ethers.Contract(this.contracts.decisionLog, DECISION_LOG_ABI, this.provider);
    const decisions = await decisionLog.getRecentDecisions(count);
    return decisions.map(d => ({
      timestamp: Number(d[0]),
      action: d[1],
      targetAsset: d[2],
      confidence: Number(d[5]) / 100,
      reasoningHash: d[6],
    }));
  }

  /**
   * Get total decision count
   */
  async getTotalDecisions() {
    const decisionLog = new ethers.Contract(this.contracts.decisionLog, DECISION_LOG_ABI, this.provider);
    return Number(await decisionLog.totalDecisions());
  }

  // ═══ Internal ═══
  
  async _pinToIPFS(json, name) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({ pinataContent: json, pinataMetadata: { name } });
      const req = https.request({
        hostname: 'api.pinata.cloud',
        path: '/pinning/pinJSONToIPFS',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.pinataJwt}`,
          'Content-Length': Buffer.byteLength(payload),
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.IpfsHash || '');
          } catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }
}

module.exports = { TuringVaultSDK, DEFAULT_CONTRACTS };
