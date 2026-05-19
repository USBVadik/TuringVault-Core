require("dotenv").config();
const { OpenAI } = require("openai");
const { validateDecision } = require("./validator");
const config = require("./config");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are the quantitative routing engine for TuringVault on the Mantle network.
Your ONLY output must be a valid, minified JSON object. No markdown, no greetings, no explanations.

You will receive:
1. Market data (prices, smart money flows, sentiment)
2. Current portfolio state
3. Risk parameters

Rules:
1. If confidence < 0.85 OR sentiment == "extreme_fear" -> action: "swap", targetAsset: "mUSD" (risk-off)
2. If confidence >= 0.85 AND sentiment == "bullish" -> action: "swap", targetAsset: "mETH" (risk-on)
3. NEVER exceed maxSingleSwapPct of portfolio.
4. "confidence" must be a float between 0.0 and 1.0.

Output Schema exactly like this:
{
  "action": "swap" | "hold",
  "direction": "risk_on" | "risk_off" | "neutral",
  "targetAsset": "mUSD" | "mETH",
  "allocationPct": <number>,
  "confidence": <float>,
  "path": {
    "pairBinSteps": [15],
    "versions": [2],
    "tokenPath": ["<address>", "<address>"]
  },
  "slippageTolerance": <number>,
  "reasoning": "<short string>"
}`;

async function getAIDecision(marketData, portfolioState) {
  const userPrompt = JSON.stringify({
    marketData,
    portfolioState,
    riskParams: config.RISK_PARAMS
  });

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 500
    });

    const rawResponse = response.choices[0].message.content;
    const validation = validateDecision(rawResponse);

    if (!validation.success) {
      console.error("AI Validation Failed:", validation.error);
      return { action: "hold", direction: "neutral", targetAsset: "mUSD", confidence: 0, reasoning: "validation_failed" };
    }

    return validation.data;
  } catch (error) {
    console.error("OpenAI API Error:", error.message);
    return { action: "hold", direction: "neutral", targetAsset: "mUSD", confidence: 0, reasoning: "api_error" };
  }
}

module.exports = { getAIDecision };
