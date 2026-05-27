/**
 * Run a single adversarial challenge through the LIVE multi-agent
 * pipeline.
 *
 * This is the orchestrator behind /api/challenge live mode. It mirrors
 * the structure of `runMultiAgentCycle` but with two critical
 * differences:
 *
 *   1. The market context is perturbed via `applyAttack(...)` BEFORE
 *      handoff to `getMultiAgentDecision`.
 *   2. Side effects are minimised — no outcome record, no position
 *      state mutation, no agent-card refresh, no reputation feedback.
 *      Optionally one ValidationRegistry attestation TX (gated by the
 *      `anchorOnChain` flag) so judges can verify on Mantlescan.
 *
 * No production state file is touched by this function (CP2).
 *
 * Spec: human-vs-ai-challenge-v2 (R1, R2, R3, design §C2, CP6).
 */

const { ethers } = require("ethers");

const { applyAttack, ATTACK_TYPES } = require("./attackVectors");
const { getMultiAgentDecision } = require("./multiAgent");
const { getUnifiedMarketContext } = require("./unifiedMarketData");
const { getStructuredSignals } = require("./signalEngine");
const { classifyDecisionTier } = require("./decisionTier");
const { pinJSON } = require("../ipfs/storage");

// Contract addresses — same as production cycle.
const REGISTRY_ADDR = "0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6";
const REGISTRY_ABI = [
  "function submitProposal(string action, string targetAsset, uint256 amountIn, uint256 confidence, string reasoning) external returns (uint256)",
];

/**
 * @typedef {object} ChallengeResult
 *  See design §"Data Models" for full shape.
 */

/**
 * @param {object} args
 * @param {string} args.type            — one of ATTACK_TYPES
 * @param {object} [args.params]        — attack-specific params
 * @param {boolean} [args.anchorOnChain]— if true, submit one ValidationRegistry TX
 * @param {object} [args.deps]          — dependency injection for testing
 * @returns {Promise<ChallengeResult>}
 */
async function runChallenge(args) {
  const t0 = Date.now();
  const { type, params = {}, anchorOnChain = false, deps = {} } = args || {};

  if (!type || !ATTACK_TYPES.includes(type)) {
    throw new Error(
      `runChallenge: invalid attack type '${type}'. Known: ${ATTACK_TYPES.join(
        ", "
      )}`
    );
  }

  // ── Step 1: live market data ─────────────────────────────────────
  const fetchUnified = deps.getUnifiedMarketContext ?? getUnifiedMarketContext;
  const fetchSignals = deps.getStructuredSignals ?? getStructuredSignals;

  const unified = await fetchUnified();
  const structuredSignals = await fetchSignals(unified);

  // Compose the same market shape `multiAgent` consumes in production.
  const baseMarket = {
    ethPrice: unified.ethPrice,
    ethChange24h: unified.ethChange24h || 0,
    mntPrice: unified.mntPrice,
    mantleTVL: unified.mantleTVL,
    fearGreedValue: unified.fearGreedValue,
    fearGreedIndex: unified.fearGreedValue,
    fearGreedLabel: unified.fearGreedLabel,
    sentiment: unified.fearGreedLabel?.toLowerCase() || "neutral",
    mETHYield: unified.mETHYield || 3.5,
    nansenInsight: unified.nansenInsight,
    byrealSignals: unified.byrealSignals,
    promptContext:
      (unified.promptContext ?? "") +
      "\n\n" +
      (structuredSignals.promptSummary ?? ""),
    structuredSignals,
  };

  // ── Step 2: apply attack ─────────────────────────────────────────
  const attackedMarket = applyAttack(baseMarket, type, params);

  // ── Step 3: multi-agent decision (LIVE — same code as production) ─
  const tDecisionStart = Date.now();
  const runDecision = deps.getMultiAgentDecision ?? getMultiAgentDecision;
  const decision = await runDecision(attackedMarket);
  const decisionMs = Date.now() - tDecisionStart;

  // ── Step 4: tier classification ──────────────────────────────────
  const decisionTier = classifyDecisionTier(decision, attackedMarket);

  // ── Step 5: disagreement signal ──────────────────────────────────
  const disagreementSignal =
    (decision.analyst?.confidence ?? 0) > 0.6 &&
    decision.validator?.approved === false;

  const disagreementSummary = disagreementSignal
    ? `Analyst proposed ${decision.analyst?.action ?? "hold"} ${
        decision.analyst?.targetAsset ?? ""
      } at ${Math.round(
        (decision.analyst?.confidence ?? 0) * 100
      )}% confidence. Validator REJECTED — flagged: ${
        decision.validator?.flaggedIssues?.[0] || "risk gate"
      }`
    : null;

  // ── Step 6: IPFS pin (challenge prefix) ──────────────────────────
  let ipfsCid = null;
  try {
    const pinFn = deps.pinJSON ?? pinJSON;
    const proof = {
      version: "1.0.0",
      kind: "challenge",
      challenge: {
        type,
        params,
        injected: attackedMarket.attackProvenance,
      },
      decision,
      decisionTier,
      disagreementSignal,
      disagreementSummary,
      // Snapshot of perturbed market for full audit trail
      market: {
        ethPrice: attackedMarket.ethPrice,
        ethChange24h: attackedMarket.ethChange24h,
        sentiment: attackedMarket.sentiment,
        fearGreedValue: attackedMarket.fearGreedValue,
        regime: attackedMarket.structuredSignals?.regime?.regime ?? null,
      },
      timestamp: new Date().toISOString(),
    };
    const result = await pinFn(proof, `CHALLENGE-${type}-${Date.now()}`);
    ipfsCid = result?.cid ?? null;
  } catch {
    // non-fatal — challenge result still valid without IPFS pin
  }

  // ── Step 7: optional on-chain anchor ─────────────────────────────
  let onChain = { skipped: true, reason: "attestation gate off" };
  if (anchorOnChain) {
    try {
      const provider =
        deps.provider ??
        new ethers.JsonRpcProvider(
          process.env.MANTLE_RPC_URL || "https://rpc.mantle.xyz"
        );
      const wallet =
        deps.wallet ?? new ethers.Wallet(process.env.PRIVATE_KEY, provider);
      const registry =
        deps.registry ??
        new ethers.Contract(REGISTRY_ADDR, REGISTRY_ABI, wallet);

      const action = `[CHALLENGE-${type}] ${
        decision.analyst?.action || "hold"
      }`;
      const targetAsset = decision.analyst?.targetAsset || "mUSD";
      const confidenceBps = Math.round(
        (decision.analyst?.confidence || 0) * 10000
      );
      const reasoning = (decision.analyst?.reasoning || "challenge").substring(
        0,
        200
      );

      const tx = await registry.submitProposal(
        action,
        targetAsset,
        ethers.parseEther("0"),
        confidenceBps,
        reasoning
      );
      const receipt = await tx.wait();
      onChain = {
        anchored: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        mantlescan: `https://mantlescan.xyz/tx/${receipt.hash}`,
      };
    } catch (e) {
      onChain = {
        skipped: true,
        reason: "attestation tx failed",
        error: e?.message?.slice(0, 200) || String(e).slice(0, 200),
      };
    }
  }

  // ── Step 8: assemble response ────────────────────────────────────
  return {
    mode: "LIVE_MULTI_AGENT",
    challenge: {
      type,
      params,
      injected: attackedMarket.attackProvenance,
    },
    agents: {
      analyst: {
        model: "zai.glm-5",
        action: decision.analyst?.action ?? null,
        targetAsset: decision.analyst?.targetAsset ?? null,
        confidence: decision.analyst?.confidence ?? null,
        reasoning: decision.analyst?.reasoning ?? null,
        riskFactors: Array.isArray(decision.analyst?.riskFactors)
          ? decision.analyst.riskFactors
          : [],
        timing_ms: decision._timing?.analyst ?? null,
      },
      validator: {
        model: "us.anthropic.claude-sonnet-4-6",
        approved: decision.validator?.approved ?? null,
        confidence: decision.validator?.validatorConfidence ?? null,
        riskScore: decision.validator?.riskScore ?? null,
        reasoning: decision.validator?.reasoning ?? null,
        flaggedIssues: Array.isArray(decision.validator?.flaggedIssues)
          ? decision.validator.flaggedIssues
          : [],
        timing_ms: decision._timing?.validator ?? null,
      },
      arbiter: decision.arbiter
        ? {
            model: "gemini-3.5-flash",
            vote: decision.arbiter.vote ?? null,
            confidence: decision.arbiter.confidence ?? null,
            reasoning: decision.arbiter.reasoning ?? null,
            timing_ms: decision._timing?.arbiter ?? null,
          }
        : null,
    },
    pipelinePath: decision.arbiter
      ? "analyst-validator-arbiter"
      : "analyst-validator",
    consensus: decision.consensus === true,
    decisionTier,
    disagreementSignal,
    disagreementSummary,
    verdict:
      decision.consensus === true && decision.analyst?.action !== "hold"
        ? { blocked: false, label: "ATTACK SUCCEEDED" }
        : { blocked: true, label: "ATTACK BLOCKED" },
    ipfsCid,
    onChain,
    timing_ms: { decision: decisionMs, total: Date.now() - t0 },
  };
}

module.exports = { runChallenge };
