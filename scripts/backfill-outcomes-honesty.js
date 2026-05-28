#!/usr/bin/env node
/**
 * Backfill src/data/outcomes.json so every row carries an honest
 * display tier. Does NOT rewrite the original `decisionTier` field —
 * that captures what the classifier believed on the day, which is
 * itself an auditable signal. Adds two NEW fields per row:
 *
 *   executedOnChain : boolean
 *     true iff the row carries proof of an on-chain swap. Proof
 *     sources, in priority order:
 *       1. row.txHash present and non-null
 *       2. row.rwaIntent && row.rwaIntent.executed === true
 *       3. row.directionalSwap && row.directionalSwap.executed === true
 *     We do NOT do RPC lookups — the goal is to honor what the cron
 *     itself recorded (which is auditable on-chain anyway via the
 *     decision ID -> ValidationRegistry trail).
 *
 *   _displayTier : string
 *     The tier UI components should render. Same as decisionTier
 *     except: if decisionTier === 'EXECUTED_SWAP' and
 *     executedOnChain === false, _displayTier becomes
 *     'INTENT_SWAP_NO_EXEC'. Everything else passes through.
 *
 * The script is idempotent: re-running it leaves a fully-backfilled
 * file unchanged. Safe to run from CI or as a one-off.
 *
 * Spec: workspace rule .kiro/steering/no-lying-about-state.md (4)
 *       — animation is fine, fake liveness is not.
 *
 * Usage:
 *   node scripts/backfill-outcomes-honesty.js          # dry-run, prints diff
 *   node scripts/backfill-outcomes-honesty.js --apply   # writes the file
 */
const fs = require("fs");
const path = require("path");

const OUTCOMES_PATH = path.resolve(
  __dirname,
  "..",
  "src",
  "data",
  "outcomes.json"
);

function executedOnChain(row) {
  if (row?.txHash && typeof row.txHash === "string") return true;
  if (row?.rwaIntent && row.rwaIntent.executed === true) return true;
  if (row?.directionalSwap && row.directionalSwap.executed === true) return true;
  // legs[] from the new 2-leg directionalSwap
  if (Array.isArray(row?.directionalSwap?.legs)) {
    return row.directionalSwap.legs.some((l) => l && l.txHash);
  }
  return false;
}

function displayTier(row) {
  const tier = row?.decisionTier;
  if (typeof tier !== "string") return tier ?? null;
  if (tier === "EXECUTED_SWAP" && !executedOnChain(row)) {
    return "INTENT_SWAP_NO_EXEC";
  }
  return tier;
}

function processList(list, stats, label) {
  if (!Array.isArray(list)) return list;
  return list.map((row) => {
    const out = { ...row };
    const exec = executedOnChain(row);
    const disp = displayTier(row);

    const beforeExec = out.executedOnChain;
    const beforeDisp = out._displayTier;
    out.executedOnChain = exec;
    out._displayTier = disp;

    if (beforeExec !== exec || beforeDisp !== disp) {
      stats.changed++;
      if (out.decisionTier === "EXECUTED_SWAP" && !exec) {
        stats.relabeled++;
      }
      if (stats.relabeled <= 5 && out.decisionTier === "EXECUTED_SWAP" && !exec) {
        stats.samples.push(
          `  [${label}] decisionId=${row.decisionId ?? "?"} recordedAt=${row.recordedAt ?? "?"}: EXECUTED_SWAP -> ${disp}`
        );
      }
    } else {
      stats.unchanged++;
    }
    return out;
  });
}

function main() {
  const apply = process.argv.includes("--apply");
  const raw = fs.readFileSync(OUTCOMES_PATH, "utf8");
  const db = JSON.parse(raw);

  const stats = {
    pending: db.pending?.length || 0,
    settled: db.settled?.length || 0,
    changed: 0,
    unchanged: 0,
    relabeled: 0,
    samples: [],
  };

  const newDb = {
    ...db,
    pending: processList(db.pending, stats, "pending"),
    settled: processList(db.settled, stats, "settled"),
  };

  console.log("=== outcomes.json backfill ===");
  console.log(`pending: ${stats.pending}, settled: ${stats.settled}`);
  console.log(`rows changed: ${stats.changed} / unchanged: ${stats.unchanged}`);
  console.log(`rows where EXECUTED_SWAP -> INTENT_SWAP_NO_EXEC: ${stats.relabeled}`);
  if (stats.samples.length) {
    console.log("\nSample of relabels:");
    for (const s of stats.samples) console.log(s);
  }

  if (!apply) {
    console.log("\n(dry-run) — pass --apply to write the changes back.");
    return;
  }

  fs.writeFileSync(OUTCOMES_PATH, JSON.stringify(newDb, null, 2) + "\n");
  console.log(`\n✅ Wrote ${OUTCOMES_PATH}`);
}

main();
