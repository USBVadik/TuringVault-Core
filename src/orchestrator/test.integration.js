/**
 * Task 1.7 — Integration Test: Mock Data → AI Engine → Zod Validator → Decision
 * Tests that the full orchestrator pipeline produces valid, schema-compliant output
 */
const { getAIDecision } = require("./aiEngine.mock");

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
    expectedAction: "swap",
    expectedDirection: "risk_on",
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
    expectedAction: "swap",
    expectedDirection: "risk_off",
  },
  {
    name: "NEUTRAL — No clear signal",
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
    expectedAction: "hold",
    expectedDirection: "neutral",
  },
];

async function runTests() {
  console.log("═══════════════════════════════════════════");
  console.log(" TuringVault Orchestrator — Integration Test");
  console.log("═══════════════════════════════════════════\n");

  let passed = 0;
  let failed = 0;

  for (const scenario of SCENARIOS) {
    console.log(`▶ Scenario: ${scenario.name}`);

    const decision = await getAIDecision(
      scenario.marketData,
      scenario.portfolioState
    );

    const actionOk = decision.action === scenario.expectedAction;
    const directionOk = decision.direction === scenario.expectedDirection;
    const confidenceOk = decision.confidence >= 0 && decision.confidence <= 1;
    const pathOk = decision.path && decision.path.tokenPath.length >= 2;

    const allOk = actionOk && directionOk && confidenceOk && pathOk;

    if (allOk) {
      console.log(
        `  ✅ PASS — action: ${decision.action}, direction: ${decision.direction}, confidence: ${decision.confidence}`
      );
      console.log(`     reasoning: "${decision.reasoning}"`);
      passed++;
    } else {
      console.log(`  ❌ FAIL`);
      if (!actionOk)
        console.log(
          `     expected action: ${scenario.expectedAction}, got: ${decision.action}`
        );
      if (!directionOk)
        console.log(
          `     expected direction: ${scenario.expectedDirection}, got: ${decision.direction}`
        );
      if (!confidenceOk)
        console.log(`     confidence out of range: ${decision.confidence}`);
      if (!pathOk) console.log(`     invalid path`);
      failed++;
    }
    console.log();
  }

  console.log("═══════════════════════════════════════════");
  console.log(` Results: ${passed} passed, ${failed} failed`);
  console.log("═══════════════════════════════════════════");

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
