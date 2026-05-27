#!/usr/bin/env node
/**
 * Migrate src/data/outcomes.json from schemaVersion 1 → 2.
 *
 * v2 adds these fields per outcome entry:
 *   decisionTier             EXECUTED_SWAP | BLOCKED_BY_*
 *   tierSource               'live' | 'inferred'
 *   confidencePath           native_unit | percent_scaled | fallback_default | unknown
 *   promptSource             'static' | 'evolved-vX.Y.Z' | 'unknown'
 *   disagreementSignal       bool | null
 *   validatorReasoning       string | null
 *   validatorFlaggedIssues   string[]
 *   arbiterVote              'approve' | 'reject' | null
 *   arbiterReasoning         string | null
 *
 * For pre-v2 entries that lack source data, this script writes
 * `tierSource: 'inferred'` and assigns a best-effort `decisionTier`
 * using a small heuristic on existing fields.
 *
 * Idempotent: re-running is a no-op if every entry already has a tier.
 *
 * Spec: .kiro/specs/agent-reasoning-quality/{requirements,design,tasks}.md (T11)
 */

const fs = require("fs");
const path = require("path");

const DB_PATH = path.resolve(__dirname, "../src/data/outcomes.json");
const ARCHIVE_DIR = path.resolve(
  __dirname,
  "../.kiro/audit/snapshots/2026-05-26"
);
const ARCHIVE_PATH = path.join(ARCHIVE_DIR, "outcomes-v1.json");

function inferTier(entry) {
  // Heuristic for entries pre-dating decisionTier.
  // Pipeline-equivalent ordering: parse_failure not knowable post-hoc, so
  // skip; treat low_confidence as the most informative explanation.
  const conf = entry.confidence ?? 1;
  const consensus = entry.consensus === true;
  const action = entry.action;

  if (consensus && action === "swap") return "EXECUTED_SWAP";
  if (!consensus && conf < 0.6) return "BLOCKED_BY_LOW_CONFIDENCE";
  if (!consensus) return "BLOCKED_BY_VALIDATOR";
  if (consensus && action === "hold") return "BLOCKED_BY_REGIME";
  return "UNKNOWN";
}

function fillV2Fields(entry) {
  if (!entry.decisionTier) {
    entry.decisionTier = inferTier(entry);
    entry.tierSource = "inferred";
  } else {
    entry.tierSource = entry.tierSource ?? "live";
  }
  entry.confidencePath = entry.confidencePath ?? "unknown";
  entry.promptSource = entry.promptSource ?? "unknown";
  entry.disagreementSignal = entry.disagreementSignal ?? null;
  entry.validatorReasoning = entry.validatorReasoning ?? null;
  entry.validatorFlaggedIssues = entry.validatorFlaggedIssues ?? [];
  entry.arbiterVote = entry.arbiterVote ?? null;
  entry.arbiterReasoning = entry.arbiterReasoning ?? null;
}

function archiveOnce() {
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  if (fs.existsSync(ARCHIVE_PATH)) {
    console.log(`Archive already exists at ${ARCHIVE_PATH} — leaving as-is.`);
    return;
  }
  fs.copyFileSync(DB_PATH, ARCHIVE_PATH);
  console.log(`Archived original v1 outcomes to ${ARCHIVE_PATH}`);
}

function migrate() {
  if (!fs.existsSync(DB_PATH)) {
    console.log(`No outcomes.json at ${DB_PATH} — nothing to migrate.`);
    return;
  }

  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  const allEntries = [...(db.pending ?? []), ...(db.settled ?? [])];
  const alreadyV2 =
    db.schemaVersion === 2 && allEntries.every((e) => Boolean(e.decisionTier));
  if (alreadyV2) {
    console.log(
      "Already at schemaVersion 2 with all tiers populated — nothing to migrate."
    );
    return;
  }

  archiveOnce();

  let touched = 0;
  for (const entry of allEntries) {
    if (entry.decisionTier && entry.tierSource) continue;
    fillV2Fields(entry);
    touched++;
  }

  db.schemaVersion = 2;
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  console.log(`Migrated ${touched} entries to schemaVersion 2.`);

  // Per-tier breakdown for human verification.
  const tierBreakdown = {};
  for (const e of allEntries) {
    tierBreakdown[e.decisionTier] = (tierBreakdown[e.decisionTier] || 0) + 1;
  }
  console.log("\nTier distribution after migration:");
  for (const [tier, count] of Object.entries(tierBreakdown).sort()) {
    console.log(`  ${tier.padEnd(28)} ${count}`);
  }
}

migrate();
