/**
 * TuringVault Multi-Agent AI Engine
 * 
 * TWO independent AI agents with different roles:
 * 
 * 1. ANALYST AGENT (Claude Sonnet 4.6)
 *    - Analyzes market data
 *    - Proposes trading decisions
 *    - Optimistic by nature (seeks alpha)
 * 
 * 2. VALIDATOR AGENT (Claude Sonnet 4.6, different system prompt)
 *    - Receives the Analyst's proposal + same market data
 *    - Independently verifies reasoning
 *    - Checks for hallucinations, flawed logic, excessive risk
 *    - Conservative by nature (protects capital)
 * 
 * CONSENSUS: Both must agree before execution.
 * This solves the "single LLM hallucination" problem.
 */
require("dotenv").config();
const { BedrockRuntimeClient, ConverseCommand } = require("@aws-sdk/client-bedrock-runtime");
const { validateDecision } = require("./validator");
const { z } = require("zod");

// Extended schema for Analyst (has extra fields vs base schema)
const AnalystSchema = z.object({
  action: z.enum(["swap", "hold"]),
  direction: z.enum(["risk_on", "risk_off", "neutral"]),
  targetAsset: z.enum(["mUSD", "mETH"]),
  allocationPct: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(1000),
  riskFactors: z.array(z.string()).optional(),
  expectedYield: z.string().optional()
});

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// === ANALYST AGENT ===
const ANALYST_SYSTEM_PROMPT = `You are the ANALYST AGENT of TuringVault — an AI-powered RWA portfolio manager on Mantle Network.

Your role: Analyze market data and propose optimal asset allocation between mETH (risk-on, yield-bearing) and mUSD (risk-off, capital preservation).

DECISION FRAMEWORK:
- Compare mETH yield vs risk-free rate (treasury proxy via USDY ~4.5%)
- When mETH yield > risk-free + 1% AND sentiment is bullish → propose swap to mETH
- When sentiment is bearish OR Fear&Greed < 30 → propose swap to mUSD  
- When signals conflict → propose hold
- Factor in smart money flows and TVL changes

RISK RULES:
- Never propose swapping more than 50% of portfolio in one move
- If volatility > 0.7 → reduce position size by 50%
- Always include slippage tolerance (default 50 bps, max 100 in high vol)

Output STRICT JSON:
{
  "action": "swap" | "hold",
  "direction": "risk_on" | "risk_off" | "neutral",
  "targetAsset": "mETH" | "mUSD",
  "allocationPct": 0-100,
  "confidence": 0.0-1.0,
  "reasoning": "2-3 sentence explanation of your logic",
  "riskFactors": ["factor1", "factor2"],
  "expectedYield": "annualized % if applicable"
}`;

// === VALIDATOR AGENT ===
const VALIDATOR_SYSTEM_PROMPT = `You are the VALIDATOR AGENT of TuringVault — an independent risk assessor that verifies proposals from the Analyst Agent.

Your role: Critically evaluate the Analyst's proposed trade. You are CONSERVATIVE and SKEPTICAL.

VALIDATION CHECKLIST:
1. Does the reasoning match the market data? (No hallucinated numbers)
2. Is the confidence justified by signal strength?
3. Are risk factors properly accounted for?
4. Is slippage realistic for current pool liquidity?
5. Does the proposal violate any risk rules?
6. Is this a genuine alpha opportunity or just noise?

RISK SCORING (0-100):
- 0-30: Low risk (routine rebalance, strong signals)
- 31-60: Medium risk (mixed signals, moderate position)
- 61-80: High risk (contradictory signals, large position)
- 81-100: Extreme risk (REJECT — likely hallucination or panic)

Output STRICT JSON:
{
  "approved": true | false,
  "validatorConfidence": 0.0-1.0,
  "riskScore": 0-100,
  "reasoning": "2-3 sentence independent analysis",
  "flaggedIssues": ["issue1", "issue2"] | [],
  "recommendation": "execute" | "reduce_size" | "reject" | "wait"
}`;

// Validation schema for Validator output
const ValidatorSchema = z.object({
  approved: z.boolean(),
  validatorConfidence: z.number().min(0).max(1),
  riskScore: z.number().min(0).max(100),
  reasoning: z.string(),
  flaggedIssues: z.array(z.string()),
  recommendation: z.string()  // flexible — validator can be verbose
});

// Model configuration — multi-model for diverse perspectives
const MODELS = {
  analyst: process.env.ANALYST_MODEL || "zai.glm-5",          // Z.ai GLM-5 (latest, hackathon partner)
  validator: process.env.VALIDATOR_MODEL || "us.anthropic.claude-sonnet-4-6" // Claude as independent validator
};

async function callAgent(systemPrompt, userMessage, modelId) {
  const command = new ConverseCommand({
    modelId: modelId || MODELS.analyst,
    system: [{ text: systemPrompt }],
    messages: [{ role: "user", content: [{ text: userMessage }] }],
    inferenceConfig: { maxTokens: 1024, temperature: 0.1 }
  });

  const response = await client.send(command);
  const text = response.output.message.content[0].text;
  
  // Extract JSON — handle markdown code blocks and raw JSON
  let jsonStr = text;
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  } else {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];
  }
  return JSON.parse(jsonStr);
}

/**
 * MULTI-AGENT DECISION PIPELINE
 * Returns both agents' assessments + consensus result
 */
async function getMultiAgentDecision(marketData) {
  // Defensive defaults — prevent undefined in prompt
  const md = {
    ethPrice: marketData.ethPrice || 0,
    ethChange24h: marketData.ethChange24h || marketData.priceChange24h || 0,
    mETHYield: marketData.mETHYield || 3.5,
    sentiment: marketData.sentiment || "neutral",
    fearGreedIndex: marketData.fearGreedIndex || 50,
    nansenSentiment: marketData.nansenSentiment || "n/a",
    smartMoneyFlow: marketData.smartMoneyFlow || 0,
    nansenTopBuying: marketData.nansenTopBuying || [],
    mantleTVL: marketData.mantleTVL || 0,
  };

  // Use rich promptContext from unifiedMarketData if available, else build basic prompt
  const marketPrompt = marketData.promptContext || `Current market data (${new Date().toISOString()}):
- ETH Price: $${md.ethPrice} (24h change: ${md.ethChange24h.toFixed(2)}%)
- mETH Yield: ${md.mETHYield}% APY
- Risk-Free Rate (USDY proxy): 4.5% APY
- Yield Spread: ${(md.mETHYield - 4.5).toFixed(2)}%
- Market Sentiment: ${md.sentiment} (Fear&Greed: ${md.fearGreedIndex}/100)
- Nansen Smart Money: ${md.nansenSentiment} (24h flow: $${md.smartMoneyFlow.toLocaleString()})
- Top Smart Money Buying: ${md.nansenTopBuying.map(t => t.symbol).join(", ") || "none"}
- Mantle TVL: $${((md.mantleTVL || 0) / 1e6).toFixed(0)}M
- Pool Liquidity (mETH/mUSD): sufficient for <$50k swaps`;

  // STEP 1: Analyst proposes
  console.log(`  [ANALYST] Analyzing market data... (model: ${MODELS.analyst})`);
  const analystDecision = await callAgent(ANALYST_SYSTEM_PROMPT, marketPrompt, MODELS.analyst);
  const analystValidated = AnalystSchema.safeParse(analystDecision);
  
  if (!analystValidated.success) {
    return {
      consensus: false,
      reason: "Analyst produced invalid output: " + analystValidated.error.message,
      analyst: null,
      validator: null,
      action: "hold"
    };
  }

  // STEP 2: Validator independently assesses
  const validatorPrompt = `${marketPrompt}

ANALYST'S PROPOSAL TO VERIFY:
- Action: ${analystDecision.action}
- Target: ${analystDecision.targetAsset}
- Allocation: ${analystDecision.allocationPct}%
- Confidence: ${(analystDecision.confidence * 100).toFixed(0)}%
- Reasoning: "${analystDecision.reasoning}"
- Risk Factors: ${JSON.stringify(analystDecision.riskFactors || [])}

Independently verify this proposal against the market data. Is the reasoning sound? Are there risks the Analyst missed?`;

  console.log(`  [VALIDATOR] Verifying proposal... (model: ${MODELS.validator})`);
  const validatorRaw = await callAgent(VALIDATOR_SYSTEM_PROMPT, validatorPrompt, MODELS.validator);
  const validatorResult = ValidatorSchema.safeParse(validatorRaw);
  
  if (!validatorResult.success) {
    return {
      consensus: false,
      reason: "Validator produced invalid output",
      analyst: analystDecision,
      validator: null,
      action: "hold"
    };
  }

  const validator = validatorResult.data;

  // STEP 3: Determine consensus
  const consensus = validator.approved
    && analystDecision.confidence >= 0.75   // lowered from 0.85 — real markets rarely hit 85%+
    && validator.validatorConfidence >= 0.70
    && validator.riskScore <= 65;

  return {
    consensus,
    reason: consensus 
      ? "Both agents agree — executing" 
      : `Blocked: ${!validator.approved ? "Validator rejected" : validator.riskScore > 60 ? "Risk too high" : "Confidence threshold not met"}`,
    analyst: analystDecision,
    validator: validator,
    action: consensus ? analystDecision.action : "hold",
    targetAsset: analystDecision.targetAsset,
    finalConfidence: Math.min(analystDecision.confidence, validator.validatorConfidence)
  };
}

module.exports = { getMultiAgentDecision, callAgent };
