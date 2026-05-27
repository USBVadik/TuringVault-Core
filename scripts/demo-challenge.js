#!/usr/bin/env node
/**
 * Demo: invoke a live multi-agent challenge from the local CLI.
 *
 * This is the "until v3 lands" workaround for live challenge demos.
 * The Vercel function returns 503 for LIVE mode (backend deps too
 * heavy to bundle); meanwhile the operator can run this script
 * locally to demonstrate the full pipeline reacting to attacks.
 *
 * Usage:
 *   node scripts/demo-challenge.js flash_crash
 *   node scripts/demo-challenge.js pump_signal
 *   node scripts/demo-challenge.js oracle_conflict
 *   node scripts/demo-challenge.js sybil_consensus
 *
 * With on-chain anchor:
 *   ANCHOR=true node scripts/demo-challenge.js flash_crash
 *
 * Output: full ChallengeResponse JSON to stdout, also written to
 * data/challenge-results/<ts>-<type>.json so the frontend (in a
 * future v3) can poll and render it.
 *
 * Spec: human-vs-ai-challenge-v2 + future v3.
 */

const path = require("path");
const fs = require("fs");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { runChallenge } = require("../src/orchestrator/runChallenge");

const VALID_TYPES = [
  "flash_crash",
  "pump_signal",
  "oracle_conflict",
  "sybil_consensus",
];
const RESULTS_DIR = path.resolve(__dirname, "../data/challenge-results");

async function main() {
  const type = process.argv[2];
  if (!type || !VALID_TYPES.includes(type)) {
    console.error(
      `Usage: node scripts/demo-challenge.js <${VALID_TYPES.join("|")}>`
    );
    process.exit(1);
  }

  const anchorOnChain = process.env.ANCHOR === "true";
  console.log(`\n=== Adversarial Challenge: ${type} ===`);
  console.log(`anchor on-chain: ${anchorOnChain ? "YES" : "no"}\n`);

  const t0 = Date.now();
  let result;
  try {
    result = await runChallenge({ type, anchorOnChain });
  } catch (e) {
    console.error("Fatal:", e?.message || e);
    process.exit(2);
  }

  // Print summary
  console.log(`\n--- Result ---`);
  console.log(`mode:           ${result.mode}`);
  console.log(`pipelinePath:   ${result.pipelinePath}`);
  console.log(`consensus:      ${result.consensus}`);
  console.log(`decisionTier:   ${result.decisionTier}`);
  console.log(
    `verdict:        ${result.verdict.label} (blocked=${result.verdict.blocked})`
  );
  console.log(`disagreement:   ${result.disagreementSignal ? "YES" : "no"}`);
  if (result.disagreementSummary) {
    console.log(`  → ${result.disagreementSummary}`);
  }
  console.log(`\n--- Analyst (${result.agents.analyst.model}) ---`);
  console.log(
    `  action:     ${result.agents.analyst.action} ${
      result.agents.analyst.targetAsset || ""
    }`
  );
  console.log(
    `  confidence: ${(result.agents.analyst.confidence * 100).toFixed(0)}%`
  );
  console.log(`  timing:     ${result.agents.analyst.timing_ms}ms`);
  console.log(
    `  reasoning:  ${result.agents.analyst.reasoning?.slice(0, 200)}...`
  );

  console.log(`\n--- Validator (${result.agents.validator.model}) ---`);
  console.log(`  approved:   ${result.agents.validator.approved}`);
  console.log(
    `  confidence: ${(result.agents.validator.confidence * 100).toFixed(0)}%`
  );
  console.log(`  riskScore:  ${result.agents.validator.riskScore}/100`);
  console.log(`  timing:     ${result.agents.validator.timing_ms}ms`);
  console.log(
    `  reasoning:  ${result.agents.validator.reasoning?.slice(0, 200)}...`
  );
  if (result.agents.validator.flaggedIssues?.length) {
    console.log(
      `  flagged:    ${result.agents.validator.flaggedIssues.join(", ")}`
    );
  }

  if (result.agents.arbiter) {
    console.log(`\n--- Arbiter (${result.agents.arbiter.model}) ---`);
    console.log(`  vote:       ${result.agents.arbiter.vote}`);
    console.log(
      `  confidence: ${(result.agents.arbiter.confidence * 100).toFixed(0)}%`
    );
    console.log(
      `  reasoning:  ${result.agents.arbiter.reasoning?.slice(0, 200)}...`
    );
  }

  if (result.ipfsCid) {
    console.log(`\n--- IPFS pin ---`);
    console.log(`  cid: ${result.ipfsCid}`);
    console.log(`  url: https://gateway.pinata.cloud/ipfs/${result.ipfsCid}`);
  }

  if (result.onChain.anchored) {
    console.log(`\n--- On-chain anchor ---`);
    console.log(`  txHash:     ${result.onChain.txHash}`);
    console.log(`  block:      ${result.onChain.blockNumber}`);
    console.log(`  mantlescan: ${result.onChain.mantlescan}`);
  } else {
    console.log(`\non-chain anchor: skipped (${result.onChain.reason})`);
  }

  console.log(`\nTotal: ${Date.now() - t0}ms`);

  // Persist to data/challenge-results/
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const outPath = path.join(RESULTS_DIR, `${Date.now()}-${type}.json`);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\nResult saved: ${path.relative(process.cwd(), outPath)}`);
}

main().catch((e) => {
  console.error("Fatal:", e?.message || e);
  process.exit(99);
});
