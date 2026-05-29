#!/usr/bin/env node
/**
 * Probe regime detector with edge cases that previously fell into HOLD.
 */
const { detectRegime } = require("../src/orchestrator/signalEngine");

const cases = [
  // Real overnight conditions
  ["overnight low-vol fear", { ethChange24h: 0.15, fearGreed: 23 }, "RANGING"],
  ["cycle 137 candidate (mild up)", { ethChange24h: 1.7, fearGreed: 23 }, "RANGING"],
  ["cycle 137 candidate (mild up extreme)", { ethChange24h: 2.5, fearGreed: 23 }, "RANGING"],
  // Confirmed trends still fire
  ["clear bear", { ethChange24h: -2.5, fearGreed: 28, fundingSignal: { value: 6 }, flowSignal: { signal: "BEARISH" } }, "TREND_DOWN"],
  ["clear bull", { ethChange24h: 2.5, fearGreed: 70, fundingSignal: { value: 8 }, flowSignal: { signal: "BULLISH" } }, "TREND_UP"],
  ["crisis", { ethChange24h: -7, fearGreed: 15 }, "CRISIS"],
  ["soft bear", { ethChange24h: -1.5, fearGreed: 35 }, "TREND_DOWN"],
  // Boundaries
  ["RANGING upper edge", { ethChange24h: 2.99, fearGreed: 50 }, "RANGING"],
  ["above RANGING -> HOLD", { ethChange24h: 3.5, fearGreed: 50 }, "HOLD"],
  ["above RANGING bull side -> HOLD", { ethChange24h: 4, fearGreed: 50 }, "HOLD"],
  // Aligned sentiment
  ["normal ranging aligned", { ethChange24h: 0.5, fearGreed: 50 }, "RANGING"],
];

let passed = 0;
let failed = 0;
for (const [name, input, expected] of cases) {
  const r = detectRegime(input);
  const ok = r.regime === expected;
  if (ok) passed++;
  else failed++;
  console.log(
    `${ok ? "✅" : "❌"} ${name.padEnd(35)} → ${r.regime.padEnd(16)} conf=${r.confidence}${
      ok ? "" : ` (expected ${expected})`
    }`
  );
}
console.log(`\n${passed}/${cases.length} passed`);
process.exit(failed > 0 ? 1 : 0);
