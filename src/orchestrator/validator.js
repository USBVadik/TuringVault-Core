const { z } = require("zod");

const DecisionSchema = z.object({
  action: z.enum(["swap", "hold"]),
  direction: z.enum(["risk_on", "risk_off", "neutral"]),
  targetAsset: z.enum(["mUSD", "mETH"]),
  allocationPct: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  path: z.object({
    pairBinSteps: z.array(z.number()),
    versions: z.array(z.number()),
    tokenPath: z.array(z.string()),
  }),
  slippageTolerance: z.number().min(10).max(500),
  reasoning: z.string().max(200),
});

function validateDecision(rawJsonString) {
  try {
    const cleanJsonString = rawJsonString
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const parsed = JSON.parse(cleanJsonString);
    const validatedData = DecisionSchema.parse(parsed);
    return { success: true, data: validatedData };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = { validateDecision, DecisionSchema };
