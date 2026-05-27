/**
 * Test: Multi-Agent Consensus Pipeline
 * Analyst → Validator → Consensus → On-Chain
 */
require("dotenv").config({
  path: require("path").resolve(__dirname, "../../.env"),
});
const { getMultiAgentDecision } = require("./multiAgent");

async function testMultiAgent() {
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  MULTI-AGENT CONSENSUS TEST");
  console.log("═══════════════════════════════════════════════════\n");

  // Scenario 1: Clear bullish (should reach consensus)
  console.log("📊 SCENARIO 1: Strong Bullish Signal\n");
  const bullish = await getMultiAgentDecision({
    ethPrice: 2500,
    priceChange24h: 4.2,
    methYield: 7.8,
    sentiment: "bullish",
    fearGreedIndex: 72,
    smartMoneyFlow: "2.1M",
    tvl: "280M",
    volatility: 0.3,
  });

  console.log(
    `\n  ANALYST says: ${bullish.analyst?.action} ${
      bullish.analyst?.targetAsset
    } (${(bullish.analyst?.confidence * 100).toFixed(0)}%)`
  );
  console.log(`  ANALYST reasoning: "${bullish.analyst?.reasoning}"`);
  console.log(
    `\n  VALIDATOR says: ${
      bullish.validator?.approved ? "✅ APPROVED" : "❌ REJECTED"
    } (${(bullish.validator?.validatorConfidence * 100).toFixed(
      0
    )}% confidence)`
  );
  console.log(`  VALIDATOR risk: ${bullish.validator?.riskScore}/100`);
  console.log(`  VALIDATOR reasoning: "${bullish.validator?.reasoning}"`);
  console.log(
    `  VALIDATOR issues: ${JSON.stringify(bullish.validator?.flaggedIssues)}`
  );
  console.log(
    `\n  🤝 CONSENSUS: ${bullish.consensus ? "✅ REACHED" : "❌ BLOCKED"} — ${
      bullish.reason
    }`
  );

  // Scenario 2: Fearful market (validator should be cautious)
  console.log("\n\n📊 SCENARIO 2: Fear Market + Contradictory Signals\n");
  const fear = await getMultiAgentDecision({
    ethPrice: 1800,
    priceChange24h: -8.5,
    methYield: 3.2,
    sentiment: "extreme_fear",
    fearGreedIndex: 12,
    smartMoneyFlow: "-500K",
    tvl: "180M",
    volatility: 0.85,
  });

  console.log(
    `\n  ANALYST says: ${fear.analyst?.action} ${fear.analyst?.targetAsset} (${(
      fear.analyst?.confidence * 100
    ).toFixed(0)}%)`
  );
  console.log(`  ANALYST reasoning: "${fear.analyst?.reasoning}"`);
  console.log(
    `\n  VALIDATOR says: ${
      fear.validator?.approved ? "✅ APPROVED" : "❌ REJECTED"
    } (${(fear.validator?.validatorConfidence * 100).toFixed(0)}% confidence)`
  );
  console.log(`  VALIDATOR risk: ${fear.validator?.riskScore}/100`);
  console.log(`  VALIDATOR reasoning: "${fear.validator?.reasoning}"`);
  console.log(
    `  VALIDATOR issues: ${JSON.stringify(fear.validator?.flaggedIssues)}`
  );
  console.log(
    `\n  🤝 CONSENSUS: ${fear.consensus ? "✅ REACHED" : "❌ BLOCKED"} — ${
      fear.reason
    }`
  );

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  TEST COMPLETE");
  console.log("═══════════════════════════════════════════════════\n");
}

testMultiAgent().catch(console.error);
