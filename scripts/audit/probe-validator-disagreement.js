/**
 * Probe: validator disagreement rate over the last N settled cycles.
 *
 * Refutes-or-confirms pipe-1 finding from
 * `.kiro/audits/06-pipeline-data-flow.md` (2026-05-26):
 *   "disagreementSignal=false for ALL 20 most recent settled outcomes"
 *
 * Re-runs against current outcomes.json + ValidationRegistry on-chain
 * counters to know whether the validator structurally rubber-stamps
 * proposals OR meaningfully blocks unsafe ones.
 *
 * Usage:
 *   node scripts/audit/probe-validator-disagreement.js [windowSize]
 *
 * Output: a 1-page summary table for audit 27.
 */

const fs = require("fs");
const path = require("path");

const WINDOW = Number(process.argv[2]) || 50;

function loadOutcomes() {
  const p = path.resolve(__dirname, "../../src/data/outcomes.json");
  return JSON.parse(fs.readFileSync(p, "utf-8")).settled || [];
}

function effectiveTier(r) {
  if (r._displayTier !== undefined && r._displayTier !== null) return r._displayTier;
  return r.decisionTier || null;
}

const settled = loadOutcomes();
const window = settled.slice(-WINDOW);

console.log(`\n=== Validator disagreement probe ===`);
console.log(`Window: last ${window.length} settled cycles (of ${settled.length} total)\n`);

// 1. disagreementSignal field tally
const disagreements = window.filter((r) => r.disagreementSignal === true);
console.log(`disagreementSignal=true: ${disagreements.length} / ${window.length} (${((disagreements.length / window.length) * 100).toFixed(1)}%)`);

// 2. Tier breakdown
const tiers = {};
window.forEach((r) => {
  const t = effectiveTier(r) || "unknown";
  tiers[t] = (tiers[t] || 0) + 1;
});
console.log(`\nTier distribution:`);
Object.entries(tiers).forEach(([t, n]) => {
  const pct = ((n / window.length) * 100).toFixed(1);
  console.log(`  ${t.padEnd(28)} ${String(n).padStart(3)}  (${pct}%)`);
});

// 3. Was the gate reached? (consensus=true means validator approved)
const consensusReached = window.filter((r) => r.consensus === true);
const consensusBlocked = window.filter((r) => r.consensus === false);
console.log(`\nConsensus signal:`);
console.log(`  consensus=true:   ${consensusReached.length} (${((consensusReached.length / window.length) * 100).toFixed(1)}%)`);
console.log(`  consensus=false:  ${consensusBlocked.length} (${((consensusBlocked.length / window.length) * 100).toFixed(1)}%)`);

// 4. Validator-flagged issues per row
const withFlaggedIssues = window.filter(
  (r) => Array.isArray(r.validatorFlaggedIssues) && r.validatorFlaggedIssues.length > 0
);
console.log(`\nRows with validatorFlaggedIssues populated: ${withFlaggedIssues.length} / ${window.length}`);

// 5. Arbiter invocation
const arbiterFired = window.filter((r) => r.arbiterVote != null);
console.log(`Arbiter vote present: ${arbiterFired.length} / ${window.length}`);

// 6. Net assessment
console.log(`\n--- Net assessment ---`);
const blockedTiers = ["BLOCKED_BY_VALIDATOR", "BLOCKED_BY_LOW_CONFIDENCE", "BLOCKED_BY_REGIME", "INTENT_SWAP_NO_EXEC"];
const blocks = window.filter((r) => blockedTiers.includes(effectiveTier(r)));
console.log(`Total blocking outcomes: ${blocks.length} / ${window.length} (${((blocks.length / window.length) * 100).toFixed(1)}%)`);

if (disagreements.length === 0 && blocks.length === 0) {
  console.log(`\n[VERDICT] Validator structurally approves AND no other gate blocks — pipe-1 confirmed.`);
} else if (disagreements.length === 0 && blocks.length > 0) {
  console.log(`\n[VERDICT] Validator never explicitly disagrees BUT other gates (regime, low-confidence) actively block. The narrative needs a nuanced framing: "adversarial scrutiny via flagged issues, structural blocking via confidence + regime gates".`);
} else {
  console.log(`\n[VERDICT] Validator actively disagrees in some cycles — pipe-1 is no longer accurate on current data.`);
}
