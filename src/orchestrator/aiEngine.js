require("dotenv").config();
const { BedrockRuntimeClient, ConverseCommand } = require("@aws-sdk/client-bedrock-runtime");
const { validateDecision } = require("./validator");
const config = require("./config");

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const MODEL_ID = "us.anthropic.claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are the quantitative routing engine for TuringVault on the Mantle network.
Your ONLY output must be a valid, minified JSON object. No markdown, no greetings, no explanations outside of JSON.

You will receive:
1. Market data (prices, smart money flows, sentiment)
2. Current portfolio state
3. Risk parameters

Rules:
1. If confidence < 0.85 OR sentiment == "extreme_fear" -> action: "swap", targetAsset: "mUSD" (risk-off)
2. If confidence >= 0.85 AND sentiment == "bullish" -> action: "swap", targetAsset: "mETH" (risk-on)
3. NEVER exceed maxSingleSwapPct of portfolio.
4. "confidence" must be a float between 0.0 and 1.0.

Output ONLY this JSON schema:
{"action":"swap"|"hold","direction":"risk_on"|"risk_off"|"neutral","targetAsset":"mUSD"|"mETH","allocationPct":<number 0-100>,"confidence":<float 0-1>,"path":{"pairBinSteps":[15],"versions":[2],"tokenPath":["0xab575258d37EaA5C8956EfABe71F4eE8F6397cF3","0xcDA86A272531e8640cD7F1a92c01839911B90bb0"]},"slippageTolerance":<number 10-500>,"reasoning":"<max 200 chars>"}`;

async function getAIDecision(marketData, portfolioState) {
  const userPrompt = JSON.stringify({
    marketData,
    portfolioState,
    riskParams: config.RISK_PARAMS
  });

  try {
    const command = new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: SYSTEM_PROMPT }],
      messages: [
        { role: "user", content: [{ text: userPrompt }] }
      ],
      inferenceConfig: {
        maxTokens: 500,
        temperature: 0.1
      }
    });

    const response = await client.send(command);
    const rawResponse = response.output.message.content[0].text;

    console.log("[AI RAW]:", rawResponse.substring(0, 200));

    const validation = validateDecision(rawResponse);

    if (!validation.success) {
      console.error("AI Validation Failed:", validation.error);
      return { action: "hold", direction: "neutral", targetAsset: "mUSD", confidence: 0, reasoning: "validation_failed" };
    }

    return validation.data;
  } catch (error) {
    console.error("Bedrock API Error:", error.message);
    return { action: "hold", direction: "neutral", targetAsset: "mUSD", confidence: 0, reasoning: "api_error: " + error.message.substring(0, 100) };
  }
}

module.exports = { getAIDecision };
