#!/usr/bin/env node
/**
 * Smoke test: run N multi-agent cycles in dry-run mode and report:
 *   - Tier distribution
 *   - Parse success rate
 *   - Confidence path distribution
 *   - Disagreement signals
 *
 * Hits real Bedrock (not mocked) so it costs a few cents per run.
 * No on-chain TX, no IPFS pin, no reputation feedback (dryRun gate
 * inside runMultiAgentCycle).
 *
 * Usage:
 *   npm run smoke:reasoning              # default 5 cycles
 *   SMOKE_CYCLES=10 npm run smoke:reasoning
 *
 * Exits non-zero if parse rate < 0.95 (self-evolving prompt acceptance threshold).
 *
 * Spec: .kiro/specs/agent-reasoning-quality/{requirements,design,tasks}.md (T12)
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

// Force-load .env values for Bedrock — multiAgentLoop does the same trick.
const fs = require("fs");
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const _env = require("dotenv").parse(fs.readFileSync(envPath));
  if (_env.AWS_ACCESS_KEY_ID)
    process.env.AWS_ACCESS_KEY_ID = _env.AWS_ACCESS_KEY_ID;
  if (_env.AWS_SECRET_ACCESS_KEY)
    process.env.AWS_SECRET_ACCESS_KEY = _env.AWS_SECRET_ACCESS_KEY;
}

const { runMultiAgentCycle } = require("../src/orchestrator/multiAgentLoop");
const { getRollingMetrics } = require("../src/orchestrator/parseMetrics");

const N = parseInt(process.env.SMOKE_CYCLES ?? "5", 10);
const PARSE_RATE_TARGET = 0.95;

async function main() {
  console.log(`\n=== smoke-reasoning ${N}-cycle dry-run start ===\n`);

  const tiers = {};
  const paths = {};
  let succeeded = 0;
  let crashed = 0;
  let disagreements = 0;

  for (let i = 1; i <= N; i++) {
    console.log(`\n──── cycle ${i}/${N} ────`);
    try {
      const out = await runMultiAgentCycle({ dryRun: true });
      succeeded++;
      const tier = out.decisionTier ?? "UNKNOWN";
      tiers[tier] = (tiers[tier] ?? 0) + 1;
      const cpath = out.decision?.analyst?._confidencePath ?? "unknown";
      paths[cpath] = (paths[cpath] ?? 0) + 1;
      if (out.disagreementSignal) disagreements++;
    } catch (e) {
      crashed++;
      console.error(`Cycle ${i} crashed: ${e?.message?.slice(0, 100)}`);
    }
    // Small backoff to avoid Bedrock TPM clipping.
    if (i < N) await new Promise((r) => setTimeout(r, 1500));
  }

  console.log(`\n=== smoke-reasoning RESULTS ===`);
  console.log(`Cycles attempted:  ${N}`);
  console.log(`Cycles succeeded:  ${succeeded}`);
  console.log(`Cycles crashed:    ${crashed}`);
  console.log(`Disagreements:     ${disagreements}`);

  console.log(`\nTier distribution:`);
  for (const [tier, count] of Object.entries(tiers).sort()) {
    console.log(`  ${tier.padEnd(28)} ${count}`);
  }

  console.log(`\nConfidence path distribution:`);
  for (const [p, count] of Object.entries(paths).sort()) {
    console.log(`  ${p.padEnd(20)} ${count}`);
  }

  const m = getRollingMetrics(24);
  console.log(`\nParse metrics rolling 24h:`);
  console.log(`  total:       ${m.total}`);
  console.log(`  json_ok:     ${m.jsonOk}`);
  console.log(`  yaml_ok:     ${m.yamlOk}`);
  console.log(`  failed:      ${m.failed}`);
  if (m.successRate != null) {
    console.log(`  success:     ${(m.successRate * 100).toFixed(1)}%`);
  } else {
    console.log(`  success:     n/a`);
  }

  console.log(`\n=== Self-evolution readiness gate ===`);
  if (m.successRate == null) {
    console.log("No parse data — inconclusive.");
    process.exit(2);
  }
  if (m.successRate >= PARSE_RATE_TARGET) {
    console.log(
      `✅ Parse rate ${(m.successRate * 100).toFixed(1)}% ≥ ${
        PARSE_RATE_TARGET * 100
      }% — self-evolution claim is viable.`
    );
    process.exit(0);
  } else {
    console.log(
      `⚠ Parse rate ${(m.successRate * 100).toFixed(1)}% < ${
        PARSE_RATE_TARGET * 100
      }% — keep self-evolution claim disabled until parse reliability improves.`
    );
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(99);
});
