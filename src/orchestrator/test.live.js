/**
 * Live test — Real Claude via AWS Bedrock → Zod Validator
 * Proves 100% JSON stability with real LLM
 */
const { getAIDecision } = require("./aiEngine");

const SCENARIOS = [
  {
    name: "BULLISH — Smart money inflow",
    marketData: {
      ethPrice: 3800,
      mETHYield: 4.2,
      sentiment: "bullish",
      smartMoneyFlow: 2300000,
      volatility: 0.3,
      timestamp: Date.now(),
    },
    portfolioState: {
      totalValueUSD: 10000,
      mUSD: 7000,
      mETH: 3000,
      currentAllocation: { mUSD: 70, mETH: 30 },
    },
  },
  {
    name: "FEAR — Market panic",
    marketData: {
      ethPrice: 2900,
      mETHYield: 3.1,
      sentiment: "extreme_fear",
      smartMoneyFlow: -5000000,
      volatility: 0.9,
      timestamp: Date.now(),
    },
    portfolioState: {
      totalValueUSD: 10000,
      mUSD: 3000,
      mETH: 7000,
      currentAllocation: { mUSD: 30, mETH: 70 },
    },
  },
  {
    name: "NEUTRAL — Sideways market",
    marketData: {
      ethPrice: 3400,
      mETHYield: 3.8,
      sentiment: "neutral",
      smartMoneyFlow: -100000,
      volatility: 0.4,
      timestamp: Date.now(),
    },
    portfolioState: {
      totalValueUSD: 10000,
      mUSD: 5000,
      mETH: 5000,
      currentAllocation: { mUSD: 50, mETH: 50 },
    },
  },
];

async function runLiveTest() {
  console.log("═══════════════════════════════════════════");
  console.log(" TuringVault — LIVE AI Test (Claude Bedrock)");
  console.log("═══════════════════════════════════════════\n");

  let passed = 0;

  for (const scenario of SCENARIOS) {
    console.log(`\n▶ ${scenario.name}`);
    console.log("─────────────────────────────────────────");

    const decision = await getAIDecision(
      scenario.marketData,
      scenario.portfolioState
    );

    const isValid =
      decision.action && decision.direction && decision.confidence >= 0;

    if (
      isValid &&
      decision.reasoning !== "api_error" &&
      !decision.reasoning.startsWith("api_error")
    ) {
      console.log(`  ✅ VALID DECISION`);
      console.log(`     action:     ${decision.action}`);
      console.log(`     direction:  ${decision.direction}`);
      console.log(`     target:     ${decision.targetAsset}`);
      console.log(`     confidence: ${decision.confidence}`);
      console.log(`     allocation: ${decision.allocationPct}%`);
      console.log(`     slippage:   ${decision.slippageTolerance} bps`);
      console.log(`     reasoning:  "${decision.reasoning}"`);
      passed++;
    } else {
      console.log(`  ❌ FAILED — ${decision.reasoning}`);
    }
  }

  console.log("\n═══════════════════════════════════════════");
  console.log(
    ` Results: ${passed}/${SCENARIOS.length} valid decisions from Claude`
  );
  console.log("═══════════════════════════════════════════");

  process.exit(passed === SCENARIOS.length ? 0 : 1);
}

runLiveTest();
