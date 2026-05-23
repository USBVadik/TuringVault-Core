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
const fs = require("fs");
const path = require("path");
const { BedrockRuntimeClient, ConverseCommand } = require("@aws-sdk/client-bedrock-runtime");
const { validateDecision } = require("./validator");
const { z } = require("zod");
const {
  BASE_CONFIDENCE_THRESHOLD,
  ELEVATED_CONFIDENCE_THRESHOLD,
  VALIDATOR_TOLERANCE,
  DEFAULT_CONFIDENCE_FALLBACK,
  MAX_RISK_SCORE,
  MAX_TOKENS_VALIDATOR,
  VALIDATOR_TEMPERATURE,
} = require("../config/constants");

// === DYNAMIC CONFIDENCE THRESHOLD ===
// Reads outcome history and raises threshold after consecutive losses
const OUTCOME_HISTORY_PATH = path.resolve(__dirname, "../../data/outcome_history.json");
const CONSECUTIVE_LOSS_TRIGGER = 3;

function getDynamicConfidenceThreshold() {
  try {
    if (!fs.existsSync(OUTCOME_HISTORY_PATH)) {
      return BASE_CONFIDENCE_THRESHOLD;
    }
    const raw = fs.readFileSync(OUTCOME_HISTORY_PATH, "utf8");
    const history = JSON.parse(raw);
    const outcomes = Array.isArray(history) ? history : (history.outcomes || history.decisions || []);
    
    if (outcomes.length === 0) return BASE_CONFIDENCE_THRESHOLD;
    
    // Count consecutive losses from most recent
    let consecutiveLosses = 0;
    for (let i = outcomes.length - 1; i >= 0; i--) {
      const pnl = outcomes[i].pnl ?? outcomes[i].profit ?? outcomes[i].realizedPnl ?? 0;
      if (pnl < 0) {
        consecutiveLosses++;
      } else {
        break; // stop at first non-loss
      }
    }
    
    if (consecutiveLosses >= CONSECUTIVE_LOSS_TRIGGER) {
      console.log(`  [RISK] ⚠️ ${consecutiveLosses} consecutive losses detected — raising confidence threshold to ${ELEVATED_CONFIDENCE_THRESHOLD} (from ${BASE_CONFIDENCE_THRESHOLD})`);
      return ELEVATED_CONFIDENCE_THRESHOLD;
    }
    
    return BASE_CONFIDENCE_THRESHOLD;
  } catch (err) {
    console.log(`  [RISK] Could not read outcome history: ${err.message} — using base threshold`);
    return BASE_CONFIDENCE_THRESHOLD;
  }
}

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

Your role: Find and execute profitable opportunities between mETH (risk-on, yield-bearing ETH) and mUSD (risk-off, stablecoin).

DECISION FRAMEWORK (use structured signals, not just sentiment text):

REGIME-BASED LOGIC:
- TREND_UP: Aggressive risk-on → swap to mETH (30-50% allocation)
- CONTRARIAN_LONG: Crowded shorts + negative funding → contrarian long mETH (20-40%)
- TREND_DOWN: Risk-off → swap to mUSD (20-40%)
- RANGING: Use RANGING GRID STRATEGY data from signals. Act on grid signal:
    * If grid signal = BUY_mETH → propose swap to mETH (confidence from grid)
    * If grid signal = SELL_mETH → propose swap to mUSD (take profit / pre-sell at resistance)
    * If grid signal = EXIT_RANGING → do NOT use grid logic, switch to trend regime
    * If grid signal = HOLD → wait, price in middle of channel
    * RANGING is NOT a reason to do nothing — it is the highest-frequency strategy
- CRISIS: Defensive → mUSD unless funding is extreme negative (short squeeze setup)

FUNDING RATE LOGIC (most reliable signal):
- Funding annualized < -10%: Shorts are paying longs → BULLISH, propose mETH
- Funding annualized > +20%: Longs are paying shorts → BEARISH, propose mUSD
- Funding between -10% and +20%: Neutral on funding, weight other signals

SMART MONEY FLOW (Nansen):
- INFLOW > $1M: Institutions buying → confirms risk-on
- OUTFLOW > $1M: Institutions selling → confirms risk-off

HOLD only when: 2+ major signals conflict with no clear edge, OR regime is RANGING AND grid signal = HOLD (price in middle of channel). Do NOT default to HOLD because sentiment is "neutral" — in RANGING regime, follow the grid signal.

RISK RULES:
- Never propose swapping more than 50% of portfolio in one move
- Minimum confidence to act: 0.62
- Include slippage tolerance in reasoning

CRITICAL CONSISTENCY RULE:
Your "action" and "targetAsset" MUST be logically consistent with your "reasoning" and "direction".
- If reasoning is BULLISH (buy the dip, breakout, accumulate) → action MUST be "swap", targetAsset MUST be "mETH", direction MUST be "risk_on"
- If reasoning is BEARISH (de-risk, correction, overextension) → action MUST be "swap", targetAsset MUST be "mUSD", direction MUST be "risk_off"  
- If reasoning says "wait" or "conflicting signals" → action MUST be "hold", direction MUST be "neutral"
VIOLATION OF THIS RULE = AUTOMATIC REJECTION BY VALIDATOR. Think step-by-step: first decide your thesis (bullish/bearish/neutral), then set action+target to match.

Output STRICT JSON:
{
  "action": "swap" | "hold",
  "direction": "risk_on" | "risk_off" | "neutral",
  "targetAsset": "mETH" | "mUSD",
  "allocationPct": 0-100,
  "confidence": 0.0-1.0,
  "reasoning": "2-3 sentence explanation referencing specific signals (regime, funding, flows)",
  "riskFactors": ["factor1", "factor2"],
  "expectedYield": "annualized % if applicable"
}`;

// === VALIDATOR AGENT ===
const VALIDATOR_SYSTEM_PROMPT = `YOUR DEFAULT STATE IS REJECT. You must find explicit evidence to APPROVE. Calculate Risk/Reward ratio — if R:R < 1.5:1, reject. If the Analyst proposes directional SWAP in RANGING regime with no grid signal confirmation, reject.

You are the VALIDATOR AGENT of TuringVault — an independent risk assessor that verifies proposals from the Analyst Agent.

Your role: You are a SKEPTICAL gatekeeper. Your job is to PROTECT CAPITAL first. The burden of proof is on the proposal — it must demonstrate clear edge with favorable risk/reward. Absence of evidence is NOT evidence of safety.

VALIDATION CHECKLIST (ALL must pass for APPROVE):
1. Does the reasoning match the market data? (No hallucinated numbers)
2. Is the confidence justified by signal strength?
3. Are risk factors properly accounted for?
4. Is slippage realistic for current pool liquidity?
5. Is the Risk:Reward ratio >= 1.5:1? (MANDATORY — reject if not met)
6. Does the regime support directional trades? (RANGING = no directional swaps without grid confirmation)

REJECTION TRIGGERS (any ONE of these = automatic REJECT):
- R:R ratio below 1.5:1
- Directional SWAP proposed in RANGING regime without grid signal confirmation
- Analyst confidence not backed by at least 2 confirming signals
- Position size > 40% in unclear regime
- Contradictory signals without explicit acknowledgment
- Any hallucinated or unverifiable data points

APPROVAL CONDITIONS (ALL required):
- Clear directional edge supported by multiple confirming signals
- R:R >= 1.5:1 with defined stop-loss logic
- Regime supports the proposed action type
- If HOLD with reasonable reasoning → APPROVE (low risk)
- If swap to mUSD (risk-off/defensive) → APPROVE only if signals justify de-risking

RISK SCORING (0-100):
- 0-30: Low risk (routine rebalance, strong multi-signal confirmation)
- 31-60: Medium risk (mixed signals — default REJECT unless R:R > 2:1)
- 61-80: High risk (REJECT — contradictory signals, unclear edge)
- 81-100: Extreme risk (REJECT — likely hallucination or panic)

CRITICAL: You MUST respond with ONLY a JSON object. No markdown, no explanation outside JSON, no headers.
Output this exact structure:
{"approved": false, "validatorConfidence": 0.45, "riskScore": 65, "reasoning": "...", "flaggedIssues": ["insufficient R:R", "regime mismatch"], "recommendation": "reject"}`;

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
  if (isNaN(r.confidence)) r.confidence = DEFAULT_CONFIDENCE_FALLBACK;
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
  if (isNaN(r.validatorConfidence)) r.validatorConfidence = DEFAULT_CONFIDENCE_FALLBACK;
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
  validator: process.env.VALIDATOR_MODEL || "us.anthropic.claude-sonnet-4-6", // Claude as independent validator
  arbiter: "gemini-3.5-flash" // Google Gemini 3.5 Flash via Vertex AI (tiebreaker)
};

const { callGeminiArbiter } = require("./geminiArbiter");

async function callAgent(systemPrompt, userMessage, modelId) {
  const command = new ConverseCommand({
    modelId: modelId || MODELS.analyst,
    system: [{ text: systemPrompt }],
    messages: [{ role: "user", content: [{ text: userMessage }] }],
    inferenceConfig: { maxTokens: MAX_TOKENS_VALIDATOR, temperature: VALIDATOR_TEMPERATURE }
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
  // Use evolved prompt from IPFS if available AND it's not a fallback placeholder
  const activeAnalystPrompt = (evolved?.analyst && evolved.analyst.length > 100) 
    ? evolved.analyst 
    : ANALYST_SYSTEM_PROMPT;
  // Validator always uses local prompt — evolved versions may lack strict JSON enforcement
  const activeValidatorPrompt = VALIDATOR_SYSTEM_PROMPT;
  if (evolved?.analyst && evolved.analyst.length > 100) {
    console.log(`  [EVOLUTION] ✅ Using evolved analyst prompt v${evolved.version} from IPFS`);
  } else if (evolved) {
    console.log(`  [EVOLUTION] Evolved prompt v${evolved.version} too short, using local`);
  }
  
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
  // Give Validator the RAW structured signals separately — so it can cross-check GLM-5's reasoning
  const rawSignalsSummary = marketData.structuredSignals 
    ? `\nRAW STRUCTURED SIGNALS (verify Analyst's reasoning against these):
- Regime: ${marketData.structuredSignals.regime?.regime} (${marketData.structuredSignals.regime?.confidence}% confidence) — ${marketData.structuredSignals.regime?.rationale}
- Signal consensus: ${marketData.structuredSignals.consensus}
- Funding rate: ${marketData.structuredSignals.signals?.funding?.value?.toFixed(2) || 'n/a'}% annualised → ${marketData.structuredSignals.signals?.funding?.label} (strength ${marketData.structuredSignals.signals?.funding?.strength || 'n/a'})
- Smart money flow: ${marketData.structuredSignals.signals?.onchainFlow?.direction || 'n/a'} $${((marketData.structuredSignals.signals?.onchainFlow?.netUsd || 0)/1e6).toFixed(1)}M → ${marketData.structuredSignals.signals?.onchainFlow?.label}
- Yield spread: ${marketData.structuredSignals.signals?.yieldSpread?.spread?.toFixed(2) || 'n/a'}% → ${marketData.structuredSignals.signals?.yieldSpread?.label}
- Liq risk: ${marketData.structuredSignals.signals?.liquidation?.riskType || 'n/a'}
${marketData.structuredSignals.signals?.ranging ? `- RANGING GRID: action=${marketData.structuredSignals.signals.ranging.action} | channel=$${marketData.structuredSignals.signals.ranging.channel?.support}-$${marketData.structuredSignals.signals.ranging.channel?.resistance} | position=${(marketData.structuredSignals.signals.ranging.channel?.channelPosition * 100).toFixed(0)}% | confidence=${(marketData.structuredSignals.signals.ranging.confidence * 100).toFixed(0)}%` : ''}`
    : '';

  const validatorPrompt = `${marketPrompt}${rawSignalsSummary}

ANALYST'S PROPOSAL TO VERIFY:
- Action: ${analystDecision.action}
- Target: ${analystDecision.targetAsset}
- Allocation: ${analystDecision.allocationPct}%
- Confidence: ${(analystDecision.confidence * 100).toFixed(0)}%
- Reasoning: "${analystDecision.reasoning}"
- Risk Factors: ${JSON.stringify(analystDecision.riskFactors || [])}

Cross-check: does the Analyst's reasoning actually match the raw signals above? Is there a signal they ignored or misread?`;

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

  // STEP 3: Determine consensus (with dynamic confidence threshold)
  const confidenceThreshold = getDynamicConfidenceThreshold();
  console.log(`  [THRESHOLD] Active confidence threshold: ${confidenceThreshold}`);
  
  const analystWantsAction = analystDecision.confidence >= confidenceThreshold && analystDecision.action !== "hold";
  const validatorApproves = validator.approved
    && validator.validatorConfidence >= (confidenceThreshold - VALIDATOR_TOLERANCE)
    && validator.riskScore <= MAX_RISK_SCORE;

  let consensus = analystWantsAction && validatorApproves;
  let arbiterVote = null;

  // STEP 3b: ARBITER (3rd agent) — called when analyst and validator DISAGREE
  if (analystWantsAction !== validatorApproves) {
    console.log(`  [ARBITER] Disagreement detected — calling arbiter (model: ${MODELS.arbiter})...`);
    const arbiterPrompt = `You are the ARBITER AGENT — a neutral tiebreaker in a multi-agent trading system.

The ANALYST proposed: ${analystDecision.action} ${analystDecision.targetAsset} with ${(analystDecision.confidence * 100).toFixed(0)}% confidence.
Analyst reasoning: "${analystDecision.reasoning}"

The VALIDATOR ${validator.approved ? 'APPROVED' : 'REJECTED'} with ${(validator.validatorConfidence * 100).toFixed(0)}% confidence, risk=${validator.riskScore}.
Validator reasoning: "${validator.reasoning}"

Market context: ETH $${md.ethPrice}, 24h change ${md.ethChange24h.toFixed(2)}%, sentiment: ${md.sentiment}, Fear&Greed: ${md.fearGreedIndex}/100

YOUR TASK: Break the tie. Should this trade execute?
Reply with ONLY valid JSON: {"vote": "approve" or "reject", "reasoning": "your 1-sentence reasoning", "confidence": 0.0-1.0}`;

    try {
      const arbiterRaw = await callGeminiArbiter(
        "You are a neutral arbiter in a multi-agent trading system. You ONLY output valid JSON. No markdown, no explanation outside JSON.",
        arbiterPrompt
      );
      arbiterVote = arbiterRaw;
      console.log(`  [ARBITER] Vote: ${arbiterRaw.vote} (${(arbiterRaw.confidence * 100).toFixed(0)}% conf)`);
      
      // 2/3 voting: analyst + arbiter approve = execute, or validator + arbiter reject = block
      if (arbiterRaw.vote === "approve" && analystWantsAction) {
        consensus = true; // analyst + arbiter = 2/3
      } else {
        consensus = false; // validator + arbiter = 2/3 reject
      }
    } catch (e) {
      console.log(`  [ARBITER] Error: ${e.message} — defaulting to conservative (block)`);
      consensus = false;
    }
  }

  return {
    consensus,
    reason: consensus 
      ? "Multi-agent consensus (2/3 or 3/3) — executing" 
      : `Blocked: ${!validatorApproves ? "Validator rejected" : validator.riskScore > 60 ? "Risk too high" : "Confidence threshold not met"}${arbiterVote ? ` | Arbiter: ${arbiterVote.vote}` : ""}`,
    analyst: analystDecision,
    validator: validator,
    arbiter: arbiterVote,
    action: consensus ? analystDecision.action : "hold",
    targetAsset: analystDecision.targetAsset,
    finalConfidence: Math.min(analystDecision.confidence, validator.validatorConfidence)
  };
}

module.exports = { getMultiAgentDecision, callAgent, normalizeAnalystResponse, normalizeValidatorResponse, getDynamicConfidenceThreshold };
