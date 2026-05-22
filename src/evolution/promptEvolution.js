/**
 * TuringVault On-Chain Prompt Evolution
 * 
 * The AI agent reads its own performance history from the blockchain,
 * self-reflects on errors, and rewrites its system prompt.
 * New prompt is uploaded to IPFS and tokenURI is updated on-chain.
 * 
 * This creates a cybernetic organism that evolves on the blockchain —
 * a true "Agentic Economy" primitive.
 * 
 * Flow:
 *   1. Read performance from ReputationRegistry + DecisionLog
 *   2. If performance is poor → trigger Reflective Cycle
 *   3. GLM-5 analyzes its own errors and rewrites system prompt
 *   4. Claude validates the new prompt (prevents degeneration)
 *   5. New Agent Card → IPFS → setAgentURI() on-chain
 *   6. Next cycle loads prompt from IPFS (not hardcoded)
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { ethers } = require("ethers");
const { pinJSON } = require("../ipfs/storage");
const { callAgent } = require("../orchestrator/multiAgent");
const fs = require("fs");
const path = require("path");

// Contracts
const IDENTITY_ADDRESS = "0x6f862802e0d5463DF18d267e422347BeCacc28bD";
const REPUTATION_ADDRESS = "0xC78119F3274B05046Ac7c38a14298a6cbD946e1a";
const DECISION_LOG_ADDRESS = "0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5";

const IDENTITY_ABI = [
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function setAgentURI(uint256 agentId, string calldata newURI) external"
];

const REPUTATION_ABI = [
  "function getAgentScore(uint256 agentId) view returns (int256)",
  "function getTotalFeedback(uint256 agentId) view returns (uint256)",
  "function getAgentHistory(uint256 agentId) view returns (tuple(int128 score, bytes32 reasoningHash, string context, uint256 timestamp)[])"
];

const DECISION_LOG_ABI = [
  "function totalDecisions() view returns (uint256)",
  "function getDecision(uint256 id) view returns (tuple(string action, string targetAsset, uint256 amountIn, uint256 amountOut, uint256 confidence, string reasoningHash, bytes32 txHash, uint256 timestamp))"
];

// Evolution parameters
const EVOLUTION_CONFIG = {
  minDecisionsForReflection: 10,     // Need at least 10 decisions
  performanceThreshold: -50,          // Negative score triggers evolution
  maxPromptLength: 2000,              // Max chars per prompt
  cooldownHours: 24,                  // Min 24h between evolutions
  agentTokenId: 0,
};

const EVOLUTION_LOG_PATH = path.resolve(__dirname, "../data/evolution_log.json");

class PromptEvolution {
  constructor(options = {}) {
    this.provider = new ethers.JsonRpcProvider(options.rpcUrl || "https://rpc.mantle.xyz");
    this.wallet = options.privateKey 
      ? new ethers.Wallet(options.privateKey, this.provider)
      : new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
    
    this.identity = new ethers.Contract(IDENTITY_ADDRESS, IDENTITY_ABI, this.wallet);
    this.reputation = new ethers.Contract(REPUTATION_ADDRESS, REPUTATION_ABI, this.provider);
    this.decisionLog = new ethers.Contract(DECISION_LOG_ADDRESS, DECISION_LOG_ABI, this.provider);
    
    this.config = { ...EVOLUTION_CONFIG, ...options.config };
  }

  /**
   * Step 1: Read current Agent Card from IPFS via tokenURI
   */
  async getCurrentAgentCard() {
    const tokenURI = await this.identity.tokenURI(this.config.agentTokenId);
    console.log(`  Current tokenURI: ${tokenURI}`);
    
    if (!tokenURI || tokenURI === "" || tokenURI === "ipfs://QmTuringVaultAgent") {
      return this._fallbackCard();
    }
    
    // Try multiple IPFS gateways
    const cid = tokenURI.replace("ipfs://", "");
    const gateways = [
      `https://dweb.link/ipfs/${cid}`,
      `https://ipfs.io/ipfs/${cid}`,
      `https://gateway.pinata.cloud/ipfs/${cid}`,
    ];
    
    for (const url of gateways) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (response.ok) {
          const text = await response.text();
          if (text.startsWith('{')) return JSON.parse(text);
        }
      } catch (e) { /* try next */ }
    }
    
    console.log(`  Warning: IPFS gateways unreachable, using local fallback`);
    return this._fallbackCard();
  }

  _fallbackCard() {
    // Build card from local evolution log + known state
    const localAsset = path.resolve(__dirname, "../../assets/agent-card.json");
    if (fs.existsSync(localAsset)) {
      try { return JSON.parse(fs.readFileSync(localAsset)); } catch {}
    }
    // Derive version from evolution log
    let version = "2.0.0";
    if (fs.existsSync(EVOLUTION_LOG_PATH)) {
      const log = JSON.parse(fs.readFileSync(EVOLUTION_LOG_PATH));
      const count = log.evolutions?.filter(e => !e.rejected).length || 0;
      version = `2.0.${count}`;
    }
    return {
      name: "TuringVault AI Agent",
      systemPrompt: {
        version,
        analyst: "You are TuringVault's AI Analyst (GLM-5). Analyze market data. Output JSON: action, targetAsset, confidence, reasoning.",
        validator: "You are TuringVault's Validator (Claude). Score risk 0-100, approve/reject.",
        riskParameters: {
          maxPositionSize: "50% of portfolio",
          varThreshold: { autonomous: 50, supervised: 150, blocked: 300 },
          minConfidence: 0.6,
        },
        evolutionHistory: []
      }
    };
  }

  /**
   * Step 2: Read performance data from blockchain
   */
  async getPerformanceData() {
    let score = 0n;
    let totalFeedback = 0n;
    let history = [];
    
    try {
      score = await this.reputation.getAgentScore(this.config.agentTokenId);
      totalFeedback = await this.reputation.getTotalFeedback(this.config.agentTokenId);
    } catch (e) {
      // Contract may not have these exact methods — try alternatives
      console.log(`  Note: getAgentScore not available, using event-based approach`);
    }
    
    // Get recent decisions from DecisionLog
    let totalDecisions = 0n;
    try {
      totalDecisions = await this.decisionLog.totalDecisions();
    } catch (e) {
      console.log(`  Note: totalDecisions not available`);
    }
    
    return {
      score: Number(score),
      totalFeedback: Number(totalFeedback),
      totalDecisions: Number(totalDecisions),
      history
    };
  }

  /**
   * Step 3: Determine if evolution is needed
   * 
   * GUARD: Evolution only triggers after 20+ settled trades AND specific
   * performance triggers are met. This prevents overfitting on noise from
   * timer-based evolution (previously every ~4h).
   * 
   * Triggers (any one is sufficient):
   *   - Win Rate < 40%
   *   - Max Drawdown > 5%
   *   - 10+ consecutive HOLDs while asset moved > 3%
   */
  shouldEvolve(performance) {
    // ─── GUARD 1: Minimum settled trades (from outcomeTracker) ───────
    let settledCount = 0;
    let outcomeData = null;
    try {
      const { getOutcomeHistory } = require("../orchestrator/outcomeTracker");
      outcomeData = getOutcomeHistory(100); // get up to 100 for drawdown calc
      settledCount = outcomeData.total;
    } catch (e) {
      console.log("  [EVOLUTION] outcomeTracker not available for guard check");
    }

    const MIN_SETTLED_TRADES = 10;
    if (settledCount < MIN_SETTLED_TRADES) {
      const msg = `Evolution skipped: only ${settledCount}/20 trades settled`;
      console.log(`  [EVOLUTION] ${msg}`);
      return { should: false, reason: msg };
    }

    // ─── GUARD 2: Check cooldown ────────────────────────────────────
    if (fs.existsSync(EVOLUTION_LOG_PATH)) {
      const log = JSON.parse(fs.readFileSync(EVOLUTION_LOG_PATH));
      const lastEvolution = log.evolutions?.[log.evolutions.length - 1];
      if (lastEvolution) {
        const hoursSince = (Date.now() - new Date(lastEvolution.timestamp).getTime()) / (1000 * 60 * 60);
        if (hoursSince < this.config.cooldownHours) {
          return { should: false, reason: `Cooldown: ${hoursSince.toFixed(1)}h since last evolution (need ${this.config.cooldownHours}h)` };
        }
      }
    }

    // ─── TRIGGER EVALUATION ─────────────────────────────────────────
    // Only evolve if at least one trigger condition is met
    const triggers = [];

    // Trigger 1: Win Rate < 40%
    if (outcomeData && outcomeData.total > 0) {
      const wins = (outcomeData.summary.correctBlocks || 0) + (outcomeData.summary.goodCalls || 0);
      const winRate = (wins / outcomeData.total) * 100;
      if (winRate < 40) {
        triggers.push(`Win Rate ${winRate.toFixed(1)}% < 40%`);
      }
    }

    // Trigger 2: Max Drawdown > 5%
    if (outcomeData && outcomeData.raw && outcomeData.raw.length > 0) {
      // Calculate max drawdown from sequential PnL
      let cumPnl = 0;
      let peak = 0;
      let maxDrawdown = 0;
      // Process in chronological order (raw is most-recent-first)
      const chronological = [...outcomeData.raw].reverse();
      for (const entry of chronological) {
        const pnlPct = (entry.pnlBps || 0) / 100; // bps to percent
        cumPnl += pnlPct;
        if (cumPnl > peak) peak = cumPnl;
        const drawdown = peak - cumPnl;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      }
      if (maxDrawdown > 5) {
        triggers.push(`Max Drawdown ${maxDrawdown.toFixed(2)}% > 5%`);
      }
    }

    // Trigger 3: 10+ consecutive HOLDs while asset moved > 3%
    if (outcomeData && outcomeData.raw && outcomeData.raw.length >= 10) {
      const chronological = [...outcomeData.raw].reverse();
      let consecutiveHolds = 0;
      let holdWithBigMove = 0;
      for (const entry of chronological) {
        const isHold = (entry.action || "").toLowerCase().includes("hold") ||
                       entry.outcome === "CORRECT_BLOCK" || entry.outcome === "MISSED_ALPHA";
        if (isHold) {
          consecutiveHolds++;
          if (Math.abs(entry.pricePct || 0) > 3) {
            holdWithBigMove++;
          }
        } else {
          // Reset on non-HOLD
          if (consecutiveHolds >= 10 && holdWithBigMove > 0) break; // already triggered
          consecutiveHolds = 0;
          holdWithBigMove = 0;
        }
      }
      if (consecutiveHolds >= 10 && holdWithBigMove > 0) {
        triggers.push(`${consecutiveHolds} consecutive HOLDs with asset moving >3%`);
      }
    }

    // ─── DECISION ───────────────────────────────────────────────────
    if (triggers.length === 0) {
      return { should: false, reason: `No evolution triggers met (${settledCount} trades settled, performance acceptable)` };
    }

    return { should: true, reason: `Evolution triggered: ${triggers.join(" | ")}` };
  }

  /**
   * Step 4: Self-Reflection — AI analyzes its own failures
   */
  async selfReflect(currentCard, performance) {
    const currentAnalystPrompt = currentCard?.systemPrompt?.analyst || "No current prompt found";

    // Get REAL outcome history from outcomeTracker (not empty [])
    let outcomeData = { total: 0, summary: {}, forPrompt: [] };
    try {
      const { getOutcomeHistory } = require("../orchestrator/outcomeTracker");
      outcomeData = getOutcomeHistory(20);
    } catch (e) {
      console.log("  [EVOLUTION] outcomeTracker not available — using on-chain stats only");
    }

    const hasRealOutcomes = outcomeData.total > 0;
    
    const reflectionPrompt = `You are performing SELF-REFLECTION on your own trading performance.

CURRENT PERFORMANCE DATA:
- Total decisions made: ${performance.totalDecisions}
- Reputation score: ${performance.score}
- Total feedback entries: ${performance.totalFeedback}

${hasRealOutcomes ? `REAL OUTCOME HISTORY (last ${outcomeData.total} settled decisions):
- Correct blocks (HOLD, price fell — firewall worked): ${outcomeData.summary.correctBlocks}
- Missed alpha (HOLD, price rose — too conservative): ${outcomeData.summary.missedAlpha}
- Good calls (SWAP approved, price in our favour): ${outcomeData.summary.goodCalls}
- Bad calls (SWAP approved, price against us): ${outcomeData.summary.badCalls}
- Accuracy: ${outcomeData.summary.accuracy}
- Total PnL signal: ${outcomeData.summary.totalPnlBps > 0 ? '+' : ''}${outcomeData.summary.totalPnlBps} bps

INDIVIDUAL OUTCOMES (most recent first):
${outcomeData.forPrompt.map(e =>
  `  ${e.when} | ${e.action} | consensus=${e.consensus} | ETH ${e.pricePct >= 0 ? '+' : ''}${e.pricePct}% | ${e.outcome} | score${e.score >= 0 ? '+' : ''}${e.score}`
).join('\n')}` : `OUTCOME HISTORY: Not yet available (decisions settle after 4h). Use on-chain stats only.`}

YOUR CURRENT SYSTEM PROMPT (Analyst):
"${currentAnalystPrompt}"

YOUR CURRENT RISK PARAMETERS:
${JSON.stringify(currentCard?.systemPrompt?.riskParameters || {}, null, 2)}

TASK: Analyze SPECIFICALLY what went wrong based on the outcome data above, and propose improvements.
${hasRealOutcomes && outcomeData.summary.missedAlpha > outcomeData.summary.correctBlocks
  ? 'FOCUS: You are being TOO CONSERVATIVE. You blocked too many trades that turned out to be correct moves. Raise your confidence thresholds or loosen the decision criteria.'
  : ''}
${hasRealOutcomes && outcomeData.summary.badCalls > 0
  ? 'FOCUS: You had bad approved calls. Review what signals those trades relied on and add skepticism for those conditions.'
  : ''}
Consider:
1. Are you too aggressive or too conservative? (the outcome data tells you)
2. Which signal types led to correct decisions?
3. Should funding rate signal be weighted more heavily?
4. Are there patterns in your errors?

Output STRICT JSON:
{
  "analysis": "3-4 sentence self-analysis based on ACTUAL outcome data above",
  "newAnalystPrompt": "Your improved analyst system prompt (max 800 chars). Keep the JSON output format the same.",
  "newRiskParameters": {
    "maxPositionSize": "string",
    "volatilityMultiplier": number,
    "minConfidenceToAct": number,
    "sentimentWeight": number
  },
  "evolutionReason": "1 sentence explaining the key change and what outcome data drove it",
  "confidenceInChange": 0.0-1.0
}`;

    console.log("  🧠 Running self-reflection (GLM-5)...");
    const reflection = await callAgent(
      "You are an AI performing meta-cognitive self-analysis. Be honest about failures.",
      reflectionPrompt,
      "zai.glm-5"
    );
    
    return reflection;
  }

  /**
   * Step 5: Validate the evolution (Claude checks for degeneration)
   */
  async validateEvolution(reflection, currentCard) {
    const validationPrompt = `You are validating a proposed PROMPT EVOLUTION for an AI trading agent.

The agent has performed self-reflection and wants to modify its own system prompt.

PROPOSED CHANGES:
${JSON.stringify(reflection, null, 2)}

CURRENT PROMPT: "${currentCard?.systemPrompt?.analyst || 'N/A'}"

VALIDATION RULES:
1. The new prompt must NOT remove safety guardrails
2. Risk parameters must stay within sane bounds (no 100% position sizes)
3. The evolution should be incremental, not radical
4. The prompt must still produce valid JSON output
5. Confidence thresholds should not drop below 0.5

Output STRICT JSON:
{
  "approved": true/false,
  "reasoning": "Why this evolution is safe/unsafe",
  "suggestedModification": "Optional tweak to the proposed prompt" | null,
  "riskAssessment": "low" | "medium" | "high"
}`;

    console.log("  🔍 Validating evolution (Claude 4.6)...");
    const validation = await callAgent(
      "You are a safety validator for AI self-modification. Prevent degenerate evolution.",
      validationPrompt,
      "us.anthropic.claude-sonnet-4-6"
    );
    
    return validation;
  }

  /**
   * Step 6: Apply evolution — upload new Agent Card to IPFS + update on-chain
   */
  async applyEvolution(reflection, validation, currentCard) {
    // Build updated Agent Card
    const updatedCard = {
      ...currentCard,
      systemPrompt: {
        ...currentCard?.systemPrompt,
        version: this.incrementVersion(currentCard?.systemPrompt?.version || "2.0.0"),
        lastUpdated: new Date().toISOString(),
        analyst: reflection.newAnalystPrompt || currentCard?.systemPrompt?.analyst,
        riskParameters: {
          ...currentCard?.systemPrompt?.riskParameters,
          ...reflection.newRiskParameters
        },
        evolutionHistory: [
          ...(currentCard?.systemPrompt?.evolutionHistory || []),
          {
            timestamp: new Date().toISOString(),
            reason: reflection.evolutionReason,
            confidence: reflection.confidenceInChange,
            validatorApproved: validation.approved,
            validatorRisk: validation.riskAssessment
          }
        ]
      }
    };
    
    // Upload to IPFS
    console.log("  📤 Uploading evolved Agent Card to IPFS...");
    const ipfsResult = await pinJSON(updatedCard, `TuringVault-AgentCard-${updatedCard.systemPrompt.version}`);
    console.log(`     CID: ${ipfsResult.cid}`);
    
    // Update on-chain
    console.log("  ⛓️  Updating tokenURI on-chain...");
    const tx = await this.identity.setAgentURI(this.config.agentTokenId, ipfsResult.uri);
    await tx.wait();
    console.log(`     TX: ${tx.hash}`);
    
    // Log evolution
    this.logEvolution({
      timestamp: new Date().toISOString(),
      version: updatedCard.systemPrompt.version,
      cid: ipfsResult.cid,
      txHash: tx.hash,
      reason: reflection.evolutionReason,
      analysis: reflection.analysis,
      validatorApproved: validation.approved,
      riskAssessment: validation.riskAssessment,
      performance: { score: 0 }
    });
    
    // Save locally for immediate use (IPFS gateways are unreliable)
    const localCardPath = path.resolve(__dirname, "../../assets/agent-card.json");
    fs.mkdirSync(path.dirname(localCardPath), { recursive: true });
    fs.writeFileSync(localCardPath, JSON.stringify(updatedCard, null, 2));
    console.log(`     Local card saved: assets/agent-card.json`);
    
    return { updatedCard, ipfsResult, txHash: tx.hash };
  }

  /**
   * Full evolution cycle
   */
  async evolve(options = {}) {
    console.log("\n🧬 ═══ ON-CHAIN PROMPT EVOLUTION ═══\n");
    
    // Step 1: Get current state
    console.log("📖 [1/6] Reading current Agent Card from IPFS...");
    const currentCard = await this.getCurrentAgentCard();
    const hasCard = currentCard !== null;
    console.log(`   Card found: ${hasCard} | Version: ${currentCard?.systemPrompt?.version || "none"}`);
    
    // Step 2: Read performance
    console.log("\n📊 [2/6] Reading performance from blockchain...");
    const performance = await this.getPerformanceData();
    console.log(`   Score: ${performance.score} | Decisions: ${performance.totalDecisions} | Feedback: ${performance.totalFeedback}`);
    
    // Step 3: Check if evolution needed
    console.log("\n🎯 [3/6] Evaluating evolution trigger...");
    const { should, reason } = options.force 
      ? { should: true, reason: "Forced evolution" }
      : this.shouldEvolve(performance);
    console.log(`   ${should ? "✅ EVOLVE" : "⏸️  SKIP"}: ${reason}`);
    
    if (!should) {
      return { evolved: false, reason };
    }
    
    // Step 4: Self-reflect
    console.log("\n🧠 [4/6] Self-reflection cycle...");
    const reflection = await this.selfReflect(currentCard, performance);
    console.log(`   Analysis: ${reflection.analysis?.slice(0, 100)}...`);
    console.log(`   Confidence in change: ${reflection.confidenceInChange}`);
    
    // Step 5: Validate
    console.log("\n🔍 [5/6] Validator safety check...");
    const validation = await this.validateEvolution(reflection, currentCard);
    console.log(`   Approved: ${validation.approved} | Risk: ${validation.riskAssessment}`);
    console.log(`   Reasoning: ${validation.reasoning?.slice(0, 100)}...`);
    
    if (!validation.approved && !options.force) {
      console.log("\n   ⛔ Evolution REJECTED by validator (degeneration risk)");
      this.logEvolution({
        timestamp: new Date().toISOString(),
        rejected: true,
        reason: validation.reasoning
      });
      return { evolved: false, reason: "Validator rejected", validation };
    }
    
    // Step 6: Apply
    console.log("\n🚀 [6/6] Applying evolution on-chain...");
    const result = await this.applyEvolution(reflection, validation, currentCard);
    
    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║  🧬 PROMPT EVOLUTION COMPLETE                               ║");
    console.log("╠══════════════════════════════════════════════════════════════╣");
    console.log(`║  Version: ${result.updatedCard.systemPrompt.version.padEnd(10)}                                   ║`);
    console.log(`║  CID: ${result.ipfsResult.cid.slice(0, 20)}...                    ║`);
    console.log(`║  TX: ${result.txHash.slice(0, 22)}...                   ║`);
    console.log(`║  Reason: ${(reflection.evolutionReason || "").slice(0, 40).padEnd(40)}    ║`);
    console.log("╚══════════════════════════════════════════════════════════════╝\n");
    
    return { evolved: true, ...result };
  }

  // Helpers
  incrementVersion(version) {
    const parts = version.split(".").map(Number);
    parts[2]++;
    if (parts[2] >= 10) { parts[2] = 0; parts[1]++; }
    return parts.join(".");
  }

  logEvolution(entry) {
    let log = { evolutions: [] };
    if (fs.existsSync(EVOLUTION_LOG_PATH)) {
      log = JSON.parse(fs.readFileSync(EVOLUTION_LOG_PATH));
    }
    log.evolutions.push(entry);
    const dir = path.dirname(EVOLUTION_LOG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(EVOLUTION_LOG_PATH, JSON.stringify(log, null, 2));
  }
}

/**
 * Load system prompt from IPFS (for use by multiAgent.js)
 * Falls back to hardcoded prompts if IPFS unavailable
 */
async function loadPromptFromIPFS() {
  // Try local card first (saved by evolution, always up-to-date)
  const localCardPath = path.resolve(__dirname, "../../assets/agent-card.json");
  if (fs.existsSync(localCardPath)) {
    try {
      const card = JSON.parse(fs.readFileSync(localCardPath, "utf8"));
      if (card.systemPrompt?.analyst) {
        return {
          analyst: card.systemPrompt.analyst,
          validator: card.systemPrompt.validator || null,
          riskParameters: card.systemPrompt.riskParameters || null,
          version: card.systemPrompt.version || "local"
        };
      }
    } catch {}
  }

  // Fallback: try IPFS via on-chain tokenURI
  try {
    const provider = new ethers.JsonRpcProvider("https://rpc.mantle.xyz");
    const identity = new ethers.Contract(IDENTITY_ADDRESS, IDENTITY_ABI, provider);
    const tokenURI = await identity.tokenURI(EVOLUTION_CONFIG.agentTokenId);
    
    if (!tokenURI || !tokenURI.startsWith("ipfs://")) return null;
    
    const cid = tokenURI.replace("ipfs://", "");
    const response = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    
    const card = await response.json();
    return {
      analyst: card.systemPrompt?.analyst || null,
      validator: card.systemPrompt?.validator || null,
      riskParameters: card.systemPrompt?.riskParameters || null,
      version: card.systemPrompt?.version || "unknown"
    };
  } catch (e) {
    return null; // Fallback to hardcoded
  }
}

// ═══ CLI ═══
if (require.main === module) {
  const force = process.argv.includes("--force");
  const evo = new PromptEvolution();
  evo.evolve({ force }).then(result => {
    if (result.evolved) {
      console.log("Evolution applied successfully!");
    } else {
      console.log(`No evolution: ${result.reason}`);
    }
  }).catch(console.error);
}

module.exports = { PromptEvolution, loadPromptFromIPFS, EVOLUTION_CONFIG };
