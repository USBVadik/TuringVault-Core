/**
 * Probe: are recent EXECUTED_SWAP cycles all risk-off?
 *
 * Operator question: "почему агент меняет всё в стейбл последние сутки?"
 * Hypothesis: a confluence of (a) the EXIT_RANGING grid signal firing
 * over and over and (b) walletRouter draining native MNT into WMNT
 * each time it can no longer source from WMNT directly.
 *
 * Output: a 1-page diagnosis from the disk source-of-truth
 * (src/data/outcomes.json + replay manifests for the last N cycles).
 */
const fs = require("fs");
const path = require("path");

const N = Number(process.argv[2]) || 20;

const outcomesPath = path.resolve(__dirname, "../../src/data/outcomes.json");
const outcomes = JSON.parse(fs.readFileSync(outcomesPath, "utf-8"));
const settled = outcomes.settled || [];
const window = settled.slice(-N);

console.log(`\n=== Direction bias probe ===`);
console.log(`Window: last ${window.length} settled cycles (of ${settled.length})\n`);

const tally = { "risk-off": 0, "risk-on": 0, "no-swap": 0, "wrap-only": 0 };
const wrapEvents = [];

console.log(
  `${"id".padStart(4)} | ${"tier".padEnd(20)} | ${"dir".padEnd(9)} | ${"from".padEnd(6)}→${"to".padEnd(6)} | wrap | usd`
);
console.log("-".repeat(95));

for (const r of window) {
  const tier = r._displayTier || r.decisionTier || "-";
  const ds = r.directionalSwap;
  if (!ds || !ds.executed) {
    tally["no-swap"] += 1;
    console.log(
      `${String(r.decisionId).padStart(4)} | ${tier.padEnd(20)} | ${"-".padEnd(9)} | ${"-".padEnd(6)}→${"-".padEnd(6)} | -    | -`
    );
    continue;
  }
  const dir = ds.direction || "?";
  tally[dir] = (tally[dir] || 0) + 1;
  const from = ds.from || "?";
  const to = ds.to || "?";
  const usd = ds.amountIn ? Number(ds.amountIn).toFixed(4) : "?";
  // Wrap leg detection: leg 0 with from=MNT,to=WMNT
  const wrap =
    ds.legs && ds.legs.find((l) => l.from === "MNT" && l.to === "WMNT");
  if (wrap) {
    wrapEvents.push({
      cycle: r.decisionId,
      amount: wrap.amountIn,
      tx: wrap.txHash,
    });
  }
  console.log(
    `${String(r.decisionId).padStart(4)} | ${tier.padEnd(20)} | ${dir.padEnd(9)} | ${from.padEnd(6)}→${to.padEnd(6)} | ${
      wrap ? `Y${wrap.amountIn ? Number(wrap.amountIn).toFixed(2) : ""}` : "-"
    }    | ${usd}`
  );
}

console.log(`\n--- Tally ---`);
Object.entries(tally).forEach(([k, v]) => {
  if (v > 0) console.log(`${k.padEnd(10)} ${v}`);
});

console.log(`\n--- MNT wrap events in window ---`);
if (wrapEvents.length === 0) {
  console.log("none");
} else {
  let sum = 0;
  wrapEvents.forEach((w) => {
    const a = Number(w.amount) || 0;
    sum += a;
    console.log(`  cycle ${w.cycle}: wrapped ${a.toFixed(4)} MNT (${w.tx?.slice(0, 12)}…)`);
  });
  console.log(`  TOTAL native MNT consumed: ${sum.toFixed(4)} MNT`);
}

// Check the analyst rationale for direction skew
console.log(`\n--- Analyst rationale fragments ---`);
const reasons = {};
for (const r of window) {
  const reason = r.reasoning || r.validatorReasoning || "";
  const fragMatch =
    reason.match(/EXIT_RANGING|SELL_mETH|risk-?off|risk-?on/gi) || [];
  fragMatch.forEach((frag) => {
    const k = frag.toUpperCase().replace(/-/g, "");
    reasons[k] = (reasons[k] || 0) + 1;
  });
}
Object.entries(reasons)
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(`  ${k.padEnd(15)} ${v}`));
