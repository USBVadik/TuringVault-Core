/**
 * Mock AI Engine — returns deterministic decisions based on market data
 * Use this for testing the full pipeline without spending API credits
 */
const { validateDecision } = require("./validator");
const config = require("./config");

function getMockDecision(marketData, portfolioState) {
  let decision;

  if (marketData.sentiment === "bullish" && marketData.smartMoneyFlow > 0) {
    decision = {
      action: "swap",
      direction: "risk_on",
      targetAsset: "mETH",
      allocationPct: 30,
      confidence: 0.92,
      path: {
        pairBinSteps: [15],
        versions: [2],
        tokenPath: [config.MANTLE_ASSETS.MUSD, config.MANTLE_ASSETS.METH]
      },
      slippageTolerance: 50,
      reasoning: "Smart money inflow +$2.3M, mETH yield spread widening, risk-on rotation"
    };
  } else if (marketData.sentiment === "extreme_fear" || marketData.volatility > 0.8) {
    decision = {
      action: "swap",
      direction: "risk_off",
      targetAsset: "mUSD",
      allocationPct: 80,
      confidence: 0.95,
      path: {
        pairBinSteps: [15],
        versions: [2],
        tokenPath: [config.MANTLE_ASSETS.METH, config.MANTLE_ASSETS.MUSD]
      },
      slippageTolerance: 100,
      reasoning: "Extreme fear detected, vol spike, rotating to stablecoin safety"
    };
  } else {
    decision = {
      action: "hold",
      direction: "neutral",
      targetAsset: "mUSD",
      allocationPct: 0,
      confidence: 0.72,
      path: {
        pairBinSteps: [15],
        versions: [2],
        tokenPath: [config.MANTLE_ASSETS.MUSD, config.MANTLE_ASSETS.METH]
      },
      slippageTolerance: 50,
      reasoning: "No strong signal, maintaining current allocation"
    };
  }

  // Validate through same Zod schema to guarantee consistency
  const validation = validateDecision(JSON.stringify(decision));
  if (!validation.success) {
    console.error("Mock validation failed:", validation.error);
    return { action: "hold", direction: "neutral", targetAsset: "mUSD", confidence: 0, reasoning: "mock_validation_failed" };
  }

  return validation.data;
}

module.exports = { getAIDecision: getMockDecision };
