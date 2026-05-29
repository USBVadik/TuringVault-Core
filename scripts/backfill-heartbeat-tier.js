#!/usr/bin/env node
/**
 * One-shot backfill: outcomes.json rows where directionalSwap.tier
 * === 'HEARTBEAT_SWAP' but decisionTier / _displayTier didn't get
 * re-classified (legacy pre bc3659a).
 *
 * Idempotent — re-running on already-correct rows is a no-op.
 */
const fs = require("fs");
const path = require("path");

const OUTCOMES_PATH = path.resolve(__dirname, "../src/data/outcomes.json");

const db = JSON.parse(fs.readFileSync(OUTCOMES_PATH, "utf8"));
const all = [...(db.pending || []), ...(db.settled || [])];
let changed = 0;

for (const r of all) {
  const ds = r?.directionalSwap;
  if (!ds || ds.tier !== "HEARTBEAT_SWAP" || !ds.executed) continue;
  if (r.decisionTier !== "HEARTBEAT_SWAP") {
    r.decisionTier = "HEARTBEAT_SWAP";
    r._displayTier = "HEARTBEAT_SWAP";
    changed++;
    console.log(`  cycle ${r.decisionId}: tier → HEARTBEAT_SWAP`);
  }
}

if (process.argv.includes("--apply")) {
  if (changed > 0) {
    const tmp = OUTCOMES_PATH + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, OUTCOMES_PATH);
    console.log(`✅ wrote ${changed} updates to outcomes.json`);
  } else {
    console.log("✅ no changes needed");
  }
} else {
  console.log(`(dry-run) ${changed} rows would change. Pass --apply to write.`);
}
