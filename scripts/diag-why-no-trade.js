#!/usr/bin/env node
/**
 * Diagnostic: stop guessing — show every recent cycle and the EXACT
 * gate that prevented an on-chain swap. Read-only.
 */
const fs = require("fs");
const path = require("path");

const outcomesPath = path.resolve(__dirname, "../src/data/outcomes.json");
const raw = JSON.parse(fs.readFileSync(outcomesPath, "utf8"));
// outcomes.json may be {records:[...]} or [...] depending on writer
// outcomes.json schema: { pending: [...], settled: [...] }
const records = Array.isArray(raw)
  ? raw
  : [...(raw.pending || []), ...(raw.settled || [])];
records.sort(
  (a, b) => (a.decisionId || a.timestamp || 0) - (b.decisionId || b.timestamp || 0)
);
console.log(
  `Loaded ${records.length} (pending=${(raw.pending || []).length}, settled=${
    (raw.settled || []).length
  })`
);

const recent = records.slice(-30);

const tiers = {};
recent.forEach((r) => {
  const t = r._displayTier || r.decisionTier || "UNKNOWN";
  tiers[t] = (tiers[t] || 0) + 1;
});

console.log("\n=== Last 30 cycles by tier ===");
Object.entries(tiers)
  .sort((a, b) => b[1] - a[1])
  .forEach(([t, n]) => console.log(`  ${t.padEnd(30)} ${n}`));

console.log("\n=== Last 20 cycles detail ===");
recent.slice(-20).forEach((r) => {
  const tier = r._displayTier || r.decisionTier || "?";
  const txCount = (r.txHashes || []).length;
  const ds = r.directionalSwap || {};
  const blockReason =
    ds.reason ||
    r.blockReason ||
    r.disciplineLayer?.reason ||
    "-";
  const exec = r.executedOnChain === true ? "YES" : "no";
  const id = String(r.decisionId || "?").padEnd(4);
  const ts = r.timestamp
    ? new Date(r.timestamp * 1000).toISOString().slice(0, 19)
    : (r.cycleStartedAt || "").slice(0, 19);
  console.log(
    `  #${id} ${ts} | ${tier.padEnd(28)} | exec=${exec} | tx=${txCount} | ${blockReason}`
  );
});

// Specifically: how many of last 20 actually broadcast a DEX swap?
const lastN = 20;
const last = records.slice(-lastN);
const realSwaps = last.filter(
  (r) => r.executedOnChain === true && (r.txHashes || []).length > 0
);
console.log(
  `\n=== Bottom line: ${realSwaps.length}/${lastN} last cycles had a real DEX TX ===`
);
realSwaps.forEach((r) =>
  console.log(`  ✅ #${r.decisionId} txHashes=${JSON.stringify(r.txHashes)}`)
);
