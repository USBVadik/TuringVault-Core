#!/usr/bin/env node
/**
 * Probe regime detector against last-24h-of-real conditions to verify
 * that "low volatility + extreme fear" no longer falls into HOLD.
 */
const { detectRegime } = require("../src/orchestrator/signalEngine");

const cases = [
  {
    name: "overnight (cycle 132+ actual)",
    ethChange24h: 0.15,
    fearGreed: 22,
    fundingSignal: { value: 0.7 },
    flowSignal: { signal: "NEUTRAL" },
  },
  {
    name: "extreme greed flat",
    ethChange24h: 0.3,
    fearGreed: 78,
    fundingSignal: { value: 4 },
    flowSignal: { signal: "NEUTRAL" },
  },
  {
    name: "TREND_DOWN trigger",
    ethChange24h: -2.5,
    fearGreed: 28,
    fundingSignal: { value: 5 },
    flowSignal: { signal: "BEARISH" },
  },
  {
    name: "TREND_UP trigger",
    ethChange24h: 2.5,
    fearGreed: 70,
    fundingSignal: { value: 8 },
    flowSignal: { signal: "BULLISH" },
  },
  {
    name: "normal ranging",
    ethChange24h: 0.5,
    fearGreed: 50,
    fundingSignal: { value: 2 },
    flowSignal: { signal: "NEUTRAL" },
  },
  {
    name: "CRISIS",
    ethChange24h: -7,
    fearGreed: 15,
    fundingSignal: { value: 3 },
    flowSignal: { signal: "BEARISH" },
  },
];

for (const c of cases) {
  const r = detectRegime(c);
  console.log(
    `${c.name.padEnd(35)} → ${r.regime.padEnd(16)} conf=${r.confidence}`
  );
}
