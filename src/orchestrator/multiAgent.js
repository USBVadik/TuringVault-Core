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
// Dynamic prompt loading from IPFS (On-Chain Prompt Evolution)
let _evolvedPrompts = null;
async function getEvolvedPrompts() {
  if (_evolvedPrompts !== undefined && _evolvedPrompts !== null) return _evolvedPrompts;
  try {
    const { loadPromptFromIPFS } = require("../evolution/promptEvolution");
    _evolvedPrompts = await loadPromptFromIPFS();
    if (_evolvedPrompts) {
      console.log(`  [EVOLUTION] Loaded evolved prompt v${_evolvedPrompts.version} from IPFS`);
    }
  } catch (e) {
    _evolvedPrompts = null;
  }
  return _evolvedPrompts;
}

const ANALYST_SYSTEM_PROMPT = `You are the ANALYST AGENT of TuringVault — an AI-powered RWA portfolio manager on Mantle Network.

Your role: Analyze market data and propose optimal asset allocation between mETH (risk-on, yield-bearing) and mUSD (risk-off, capital preservation).

DECISION FRAMEWORK:
- Compare mETH yield vs risk-free rate (treasury proxy via USDY ~4.5%)
- When mETH yield > risk-free + 1% AND sentiment is bullish → propose swap to mETH
- When Fear&Greed < 25 (extreme fear) → propose swap to mUSD (defensive)
- When Fear&Greed between 25-40 OR signals conflict → propose HOLD with reasoning
- When sentiment is neutral → propose HOLD (capital preservation in uncertain market)
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

Your role: Evaluate the Analyst's proposed trade fairly. You should APPROVE proposals that have sound reasoning and manageable risk, even in uncertain markets. Conservative ≠ always blocking — blocking everything is a failure mode too.

VALIDATION CHECKLIST:
1. Does the reasoning match the market data? (No hallucinated numbers)
2. Is the confidence justified by signal strength?
3. Are risk factors properly accounted for?
4. Is slippage realistic for current pool liquidity?

APPROVAL GUIDELINES:
- If the analyst proposes HOLD with reasonable reasoning → APPROVE
- If the analyst proposes swap to mUSD (risk-off/defensive) → almost always APPROVE, this is capital preservation
- If the analyst proposes a small swap (<=30% allocation) with clear rationale → APPROVE if risk is manageable
- Only REJECT if there are clear logical errors, hallucinated data, or extreme risk

RISK SCORING (0-100):
- 0-30: Low risk (routine rebalance, strong signals)
- 31-60: Medium risk (mixed signals, moderate position)
- 61-80: High risk (contradictory signals, large position)
- 81-100: Extreme risk (REJECT — likely hallucination or panic)

CRITICAL: You MUST respond with ONLY a JSON object. No markdown, no explanation outside JSON, no headers.
Output this exact structure:
{"approved": true, "validatorConfidence": 0.75, "riskScore": 40, "reasoning": "...", "flaggedIssues": [], "recommendation": "execute"}`;

// Validation schema for Validator output
const ValidatorSchema = z.object({
  approved: z.boolean(),
  validatorConfidence: z.number().min(0).max(1),
  riskScore: z.number().min(0).max(100),
  reasoning: z.string(),
  flaggedIssues: z.array(z.string()),
  recommendation: z.string()  // flexible — validator can be verbose
});

// === FIELD NORMALIZERS ===
// GLM-5 returns inconsistent field names. Map common variants to expected schema.
function normalizeAnalystResponse(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const r = { ...raw };
  
  // action — already consistent usually
  if (!r.action && r.decision) r.action = r.decision;
  if (r.action) r.action = r.action.toLowerCase().replace(/[^a-z]/g, '');
  if (r.action !== 'swap' && r.action !== 'hold') r.action = 'hold';
  
  // direction
  if (!r.direction && r.market_direction) r.direction = r.market_direction;
  if (!r.direction && r.sentiment) r.direction = r.sentiment;
  if (!r.direction) r.direction = 'neutral';
  r.direction = r.direction.toLowerCase().replace(/ /g, '_');
  if (!['risk_on', 'risk_off', 'neutral'].includes(r.direction)) {
    if (r.direction.includes('bull') || r.direction.includes('risk_on')) r.direction = 'risk_on';
    else if (r.direction.includes('bear') || r.direction.includes('risk_off')) r.direction = 'risk_off';
    else r.direction = 'neutral';
  }
  
  // targetAsset
  if (!r.targetAsset && r.target_asset) r.targetAsset = r.target_asset;
  if (!r.targetAsset && r.target) r.targetAsset = r.target;
  if (!r.targetAsset && r.asset) r.targetAsset = r.asset;
  if (r.targetAsset) {
    const t = r.targetAsset.toLowerCase();
    if (t.includes('eth') || t.includes('meth')) r.targetAsset = 'mETH';
    else r.targetAsset = 'mUSD';
  } else {
    r.targetAsset = 'mUSD';
  }
  
  // allocationPct
  if (r.allocationPct === undefined && r.allocation_pct !== undefined) r.allocationPct = r.allocation_pct;
  if (r.allocationPct === undefined && r.allocation !== undefined) r.allocationPct = r.allocation;
  if (r.allocationPct === undefined) r.allocationPct = 20;
  r.allocationPct = Number(r.allocationPct);
  if (r.allocationPct > 100) r.allocationPct = 100;
  if (r.allocationPct < 0) r.allocationPct = 0;
  
  // confidence
  if (r.confidence === undefined && r.conf !== undefined) r.confidence = r.conf;
  r.confidence = Number(r.confidence);
  if (isNaN(r.confidence)) r.confidence = 0.5;
  // If given as percentage (>1), convert to 0-1
  if (r.confidence > 1 && r.confidence <= 100) r.confidence = r.confidence / 100;
  if (r.confidence > 1) r.confidence = 1;
  if (r.confidence < 0) r.confidence = 0;
  
  // reasoning
  if (!r.reasoning && r.reason) r.reasoning = r.reason;
  if (!r.reasoning && r.explanation) r.reasoning = r.explanation;
  if (!r.reasoning) r.reasoning = 'Market analysis based on current conditions';
  r.reasoning = String(r.reasoning).substring(0, 1000);
  
  // riskFactors
  if (!r.riskFactors && r.risk_factors) r.riskFactors = r.risk_factors;
  if (!r.riskFactors && r.risks) r.riskFactors = r.risks;
  if (typeof r.riskFactors === 'string') r.riskFactors = [r.riskFactors];
  if (!Array.isArray(r.riskFactors)) r.riskFactors = [];
  
  return r;
}

function normalizeValidatorResponse(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const r = { ...raw };
  
  // approved
  if (r.approved === undefined && r.approve !== undefined) r.approved = r.approve;
  if (typeof r.approved === 'string') r.approved = r.approved.toLowerCase() === 'true' || r.approved.toLowerCase() === 'yes';
  if (r.approved === undefined) r.approved = false;
  
  // validatorConfidence
  if (r.validatorConfidence === undefined && r.validator_confidence !== undefined) r.validatorConfidence = r.validator_confidence;
  if (r.validatorConfidence === undefined && r.confidence !== undefined) r.validatorConfidence = r.confidence;
  r.validatorConfidence = Number(r.validatorConfidence);
  if (isNaN(r.validatorConfidence)) r.validatorConfidence = 0.5;
  if (r.validatorConfidence > 1 && r.validatorConfidence <= 100) r.validatorConfidence = r.validatorConfidence / 100;
  if (r.validatorConfidence > 1) r.validatorConfidence = 1;
  
  // riskScore
  if (r.riskScore === undefined && r.risk_score !== undefined) r.riskScore = r.risk_score;
  if (r.riskScore === undefined && r.risk !== undefined) r.riskScore = r.risk;
  r.riskScore = Number(r.riskScore);
  if (isNaN(r.riskScore)) r.riskScore = 50;
  
  // reasoning
  if (!r.reasoning && r.reason) r.reasoning = r.reason;
  if (!r.reasoning && r.explanation) r.reasoning = r.explanation;
  if (!r.reasoning) r.reasoning = 'Validation assessment';
  
  // flaggedIssues
  if (!r.flaggedIssues && r.flagged_issues) r.flaggedIssues = r.flagged_issues;
  if (!r.flaggedIssues && r.issues) r.flaggedIssues = r.issues;
  if (!r.flaggedIssues && r.flags) r.flaggedIssues = r.flags;
  if (typeof r.flaggedIssues === 'string') r.flaggedIssues = [r.flaggedIssues];
  if (!Array.isArray(r.flaggedIssues)) r.flaggedIssues = [];
  
  // recommendation
  if (!r.recommendation && r.rec) r.recommendation = r.rec;
  if (!r.recommendation) r.recommendation = r.approved ? 'Proceed with caution' : 'Hold position';
  
  return r;
}

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
  
  // Try JSON parse first
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // GLM-5 sometimes returns YAML-like format: "action: swap\nconfidence: 0.85"
    // Try to convert YAML-like key: value pairs to JSON
    const lines = text.split('\n').filter(l => l.trim());
    const obj = {};
    for (const line of lines) {
      const match = line.match(/^\s*"?(\w+)"?\s*:\s*(.+)$/);
      if (match) {
        let [, key, val] = match;
        val = val.trim().replace(/,\s*$/, '');
        // Parse value type
        if (val === 'true') obj[key] = true;
        else if (val === 'false') obj[key] = false;
        else if (!isNaN(Number(val)) && val !== '') obj[key] = Number(val);
        else if (val.startsWith('"') && val.endsWith('"')) obj[key] = val.slice(1, -1);
        else if (val.startsWith('[')) {
          try { obj[key] = JSON.parse(val); } catch { obj[key] = val; }
        }
        else obj[key] = val.replace(/^["']|["']$/g, '');
      }
    }
    if (Object.keys(obj).length >= 2) {
      console.log(`  [PARSE] Recovered YAML-like response from model (${Object.keys(obj).length} fields)`);
      return obj;
    }
    throw new Error(`Cannot parse model response: ${text.substring(0, 100)}`);
  }
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

  // STEP 1: Analyst proposes (try evolved prompt from IPFS first)
  const evolved = await getEvolvedPrompts();
  const activeAnalystPrompt = ANALYST_SYSTEM_PROMPT;  // Always use local — evolved IPFS prompts lag behind fixes
  // Always use local validator prompt — evolved versions from IPFS lack strict JSON enforcement
  const activeValidatorPrompt = VALIDATOR_SYSTEM_PROMPT;
  if (evolved) console.log(`  [EVOLUTION] Using evolved prompt v${evolved.version} (local overrides active)`);
  
  console.log(`  [ANALYST] Analyzing market data... (model: ${MODELS.analyst})`);
  const analystRaw = await callAgent(activeAnalystPrompt, marketPrompt, MODELS.analyst);
  
  // Normalize GLM-5 field names to match AnalystSchema
  const analystDecision = normalizeAnalystResponse(analystRaw);
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
  const validatorRaw = await callAgent(activeValidatorPrompt, validatorPrompt, MODELS.validator);
  const validatorNorm = normalizeValidatorResponse(validatorRaw);
  const validatorResult = ValidatorSchema.safeParse(validatorNorm);
  
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
    && analystDecision.confidence >= 0.60   // hackathon: allow moderate confidence
    && validator.validatorConfidence >= 0.55
    && validator.riskScore <= 75;

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
