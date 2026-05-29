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
const {
  BedrockRuntimeClient,
  ConverseCommand,
} = require("@aws-sdk/client-bedrock-runtime");
const { validateDecision } = require("./validator");
const { z } = require("zod");
const { sanitizeExternalText, sanitizeForPrompt } = require("../utils/sanitize");
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
// Reads outcome history and raises threshold after consecutive losses.
// State is persisted to src/data/threshold_state.json so /api/health
// can surface thresholdMode = 'base' | 'elevated' (T8).
const OUTCOME_HISTORY_PATH = path.resolve(
  __dirname,
  "../../data/outcome_history.json"
);
const THRESHOLD_STATE_PATH = path.resolve(
  __dirname,
  "../../src/data/threshold_state.json"
);
const CONSECUTIVE_LOSS_TRIGGER = 3;

function persistThresholdState(consecutiveLosses, activeThreshold) {
  try {
    const elevated = activeThreshold === ELEVATED_CONFIDENCE_THRESHOLD;
    const state = {
      consecutiveLosses,
      activeThreshold,
      mode: elevated ? "elevated" : "base",
      triggeredAt: elevated ? new Date().toISOString() : null,
      recoveryRule: "1 GOOD_CALL or CORRECT_BLOCK resets to base",
      updatedAt: new Date().toISOString(),
    };
    fs.mkdirSync(path.dirname(THRESHOLD_STATE_PATH), { recursive: true });
    const tmp = THRESHOLD_STATE_PATH + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, THRESHOLD_STATE_PATH);
  } catch {
    // Best-effort — don't break a cycle on threshold-state write.
  }
}

function getDynamicConfidenceThreshold() {
  try {
    if (!fs.existsSync(OUTCOME_HISTORY_PATH)) {
      persistThresholdState(0, BASE_CONFIDENCE_THRESHOLD);
      return BASE_CONFIDENCE_THRESHOLD;
    }
    const raw = fs.readFileSync(OUTCOME_HISTORY_PATH, "utf8");
    const history = JSON.parse(raw);
    const outcomes = Array.isArray(history)
      ? history
      : history.outcomes || history.decisions || [];

    if (outcomes.length === 0) {
      persistThresholdState(0, BASE_CONFIDENCE_THRESHOLD);
      return BASE_CONFIDENCE_THRESHOLD;
    }

    // Count consecutive losses from most recent
    let consecutiveLosses = 0;
    for (let i = outcomes.length - 1; i >= 0; i--) {
      const pnl =
        outcomes[i].pnl ?? outcomes[i].profit ?? outcomes[i].realizedPnl ?? 0;
      if (pnl < 0) {
        consecutiveLosses++;
      } else {
        break; // stop at first non-loss
      }
    }

    if (consecutiveLosses >= CONSECUTIVE_LOSS_TRIGGER) {
      console.log(
        `  [RISK] ⚠️ ${consecutiveLosses} consecutive losses detected — raising confidence threshold to ${ELEVATED_CONFIDENCE_THRESHOLD} (from ${BASE_CONFIDENCE_THRESHOLD})`
      );
      persistThresholdState(consecutiveLosses, ELEVATED_CONFIDENCE_THRESHOLD);
      return ELEVATED_CONFIDENCE_THRESHOLD;
    }

    persistThresholdState(consecutiveLosses, BASE_CONFIDENCE_THRESHOLD);
    return BASE_CONFIDENCE_THRESHOLD;
  } catch (err) {
    console.log(
      `  [RISK] Could not read outcome history: ${err.message} — using base threshold`
    );
    persistThresholdState(0, BASE_CONFIDENCE_THRESHOLD);
    return BASE_CONFIDENCE_THRESHOLD;
  }
}

// Extended schema for Analyst (has extra fields vs base schema)
const AnalystSchema = z.object({
  // RWA-aware action vocabulary (rwa-allocation-active spec, T7).
  // - swap          : mETH ↔ mUSD trade (existing)
  // - hold          : no action this cycle
  // - rwa_allocate  : enter Treasury-backed allocation (USDT → USDT0)
  // - rwa_exit      : exit Treasury-backed allocation (USDT0 → USDT)
  action: z.enum(["swap", "hold", "rwa_allocate", "rwa_exit"]),
  direction: z.enum(["risk_on", "risk_off", "neutral"]),
  targetAsset: z.enum(["mUSD", "mETH", "USDT", "USDT0", "MNT", "WMNT"]),
  allocationPct: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(1000),
  riskFactors: z.array(z.string()).optional(),
  expectedYield: z.string().optional(),
});

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// === ANALYST AGENT ===
// Dynamic prompt loading from IPFS (On-Chain Prompt Evolution)
let _evolvedPrompts = null;
async function getEvolvedPrompts() {
  if (_evolvedPrompts !== undefined && _evolvedPrompts !== null)
    return _evolvedPrompts;
  try {
    const { loadPromptFromIPFS } = require("../evolution/promptEvolution");
    _evolvedPrompts = await loadPromptFromIPFS();
    if (_evolvedPrompts) {
      console.log(
        `  [EVOLUTION] Loaded evolved prompt v${_evolvedPrompts.version} from IPFS`
      );
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
- RANGING: Use RANGING GRID STRATEGY data from signals. Two grids run
  in parallel — one over ETH (target=mETH), one over MNT (target=MNT/WMNT).
  The signals block names them 'ETH GRID:' and 'MNT GRID:' with a
  PRIMARY EDGE marker on whichever has the strongest setup.
  Act on whichever signal is actionable:
    * If ETH grid signal = BUY_mETH → propose swap to mETH (3-leg path)
    * If MNT grid signal = BUY_mETH → propose swap to MNT (target=MNT)
    * If ETH grid signal = SELL_mETH → propose swap to mUSD (take profit)
    * If MNT grid signal = SELL_mETH → propose swap to mUSD (take profit)
    * If grid signal = EXIT_RANGING → do NOT use grid logic, switch to trend regime
    * If both grids = HOLD → wait, neither price near edge
    * RANGING is NOT a reason to do nothing — pick the asset with the edge
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
- Minimum confidence to act: 0.55
- Include slippage tolerance in reasoning

CAPITAL READINESS:
The wallet typically holds USDT0 as the idle reserve. When you propose
risk_on (target=mETH or target=MNT/WMNT), the orchestrator will
automatically route USDT0 → USDT → WMNT → mETH (3 legs on MerchantMoe).
Do NOT skip risk_on opportunities because the wallet "isn't holding ETH" —
USDT0 is the source-of-funds for any mETH purchase. Equally, when
proposing risk_off, the orchestrator routes WMNT → USDT → USDT0.

CRITICAL CONSISTENCY RULE:
Your "action" and "targetAsset" MUST be logically consistent with your "reasoning" and "direction".
- If reasoning is BULLISH (buy the dip, breakout, accumulate) → action MUST be "swap", targetAsset MUST be "mETH", direction MUST be "risk_on"
- If reasoning is BEARISH (de-risk, correction, overextension) → action MUST be "swap", targetAsset MUST be "mUSD", direction MUST be "risk_off"  
- If reasoning says "wait" or "conflicting signals" → action MUST be "hold", direction MUST be "neutral"
VIOLATION OF THIS RULE = AUTOMATIC REJECTION BY VALIDATOR. Think step-by-step: first decide your thesis (bullish/bearish/neutral), then set action+target to match.

RWA ALLOCATION (Path A — Treasury-backed allocation):
You also have access to USDT0, a LayerZero-bridged Tether stablecoin
backed by US Treasury Bills + cash equivalents. USDT0 is NOT yield-bearing
on its own (no APY on the token). Use it for:

- action="rwa_allocate" — when:
  * regime is HOLD / CRISIS / TREND_DOWN, AND
  * wallet has idle stablecoin (USDT or mUSD), AND
  * you want explicit Treasury-backed exposure as a transparent
    risk-off allocation. Set targetAsset="USDT0", direction="risk_off".

- action="rwa_exit" — when:
  * regime flips to TREND_UP, AND
  * wallet holds USDT0 > 30% of NAV (we want to redeploy to mETH).
  * Set targetAsset="USDT" (return to spendable stable),
    direction="risk_on".

DO NOT claim USDT0 yields anything. Frame it as "transparent
Treasury-collateralised exposure", not "yield-chasing".

Output STRICT JSON:
{
  "action": "swap" | "hold",
  "direction": "risk_on" | "risk_off" | "neutral",
  "targetAsset": "mETH" | "mUSD" | "MNT" | "WMNT",
  "allocationPct": 0-100,
  "confidence": 0.0-1.0,
  "reasoning": "2-3 sentence explanation referencing specific signals (regime, funding, flows)",
  "riskFactors": ["factor1", "factor2"],
  "expectedYield": "annualized % if applicable"
}`;

// === VALIDATOR AGENT ===
const VALIDATOR_SYSTEM_PROMPT = `OUTPUT CONTRACT (strict, immutable):
You MUST respond with EXACTLY one JSON object. No markdown fences. No prose
before or after. No explanations outside JSON. If you violate this contract,
the parser discards your response and the agent loses an audit entry.

Required keys (all present, no extras):
  approved (bool),
  validatorConfidence (number 0..1),
  riskScore (number 0..100),
  reasoning (string ≤ 400 chars),
  flaggedIssues (string[] ≤ 5),
  recommendation (string ≤ 80 chars).

Reference shape (values illustrative only):
{"approved": false, "validatorConfidence": 0.45, "riskScore": 65, "reasoning": "...", "flaggedIssues": ["insufficient R:R", "regime mismatch"], "recommendation": "reject"}

YOUR DEFAULT STATE IS REJECT. You must find explicit evidence to APPROVE. Calculate Risk/Reward ratio — if R:R < 1.5:1, reject. If the Analyst proposes directional SWAP in RANGING regime with no grid signal confirmation, reject.

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

RWA ACTIONS:
- "rwa_allocate" / "rwa_exit" follow the same gates: R:R clear AND
  regime supports the action. If R:R unclear or regime mismatch → REJECT.
  Note: USDT0 is NOT yield-bearing — reject any reasoning that claims
  an APY on USDT0 itself.

APPROVAL CONDITIONS (ALL required):
- Clear directional edge supported by multiple confirming signals
- R:R >= 1.5:1 with defined stop-loss logic
- Regime supports the proposed action type
- If HOLD with reasonable reasoning → APPROVE (low risk). Vary your
  reasoning each cycle by referencing the specific signals and numeric
  values present in THIS market context rather than generic statements.
- If swap to mUSD (risk-off/defensive) → APPROVE only if signals justify de-risking

RISK SCORING (0-100):
- 0-30: Low risk (routine rebalance, strong multi-signal confirmation)
- 31-60: Medium risk (mixed signals — default REJECT unless R:R > 2:1)
- 61-80: High risk (REJECT — contradictory signals, unclear edge)
- 81-100: Extreme risk (REJECT — likely hallucination or panic)

REMINDER: Respond with ONLY the JSON object. No code fences, no commentary.`;

// Validation schema for Validator output
const ValidatorSchema = z.object({
  approved: z.boolean(),
  validatorConfidence: z.number().min(0).max(1),
  riskScore: z.number().min(0).max(100),
  reasoning: z.string(),
  flaggedIssues: z.array(z.string()),
  recommendation: z.string(), // flexible — validator can be verbose
});

// === FIELD NORMALIZERS ===
// GLM-5 returns inconsistent field names. Map common variants to expected schema.
function normalizeAnalystResponse(raw) {
  if (!raw || typeof raw !== "object") return raw;
  const r = { ...raw };

  // action — already consistent usually
  if (!r.action && r.decision) r.action = r.decision;
  if (r.action) r.action = r.action.toLowerCase().replace(/[^a-z_]/g, "");
  // RWA-aware action vocabulary (rwa-allocation-active T7).
  if (!["swap", "hold", "rwa_allocate", "rwa_exit"].includes(r.action))
    r.action = "hold";

  // direction
  if (!r.direction && r.market_direction) r.direction = r.market_direction;
  if (!r.direction && r.sentiment) r.direction = r.sentiment;
  if (!r.direction) r.direction = "neutral";
  r.direction = r.direction.toLowerCase().replace(/ /g, "_");
  if (!["risk_on", "risk_off", "neutral"].includes(r.direction)) {
    if (r.direction.includes("bull") || r.direction.includes("risk_on"))
      r.direction = "risk_on";
    else if (r.direction.includes("bear") || r.direction.includes("risk_off"))
      r.direction = "risk_off";
    else r.direction = "neutral";
  }

  // targetAsset (RWA-aware: mETH, mUSD, USDT, USDT0)
  if (!r.targetAsset && r.target_asset) r.targetAsset = r.target_asset;
  if (!r.targetAsset && r.target) r.targetAsset = r.target;
  if (!r.targetAsset && r.asset) r.targetAsset = r.asset;
  if (r.targetAsset) {
    const t = String(r.targetAsset)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    if (t.includes("meth")) r.targetAsset = "mETH";
    else if (t === "eth") r.targetAsset = "mETH";
    else if (t === "wmnt") r.targetAsset = "WMNT";
    else if (t === "mnt") r.targetAsset = "MNT";
    else if (t === "usdt0" || t.includes("usdt0")) r.targetAsset = "USDT0";
    else if (t === "usdt") r.targetAsset = "USDT";
    else if (t.includes("musd")) r.targetAsset = "mUSD";
    else r.targetAsset = "mUSD";
  } else {
    // Default depends on action: rwa_allocate → USDT0, rwa_exit → USDT,
    // anything else → mUSD (legacy default).
    if (r.action === "rwa_allocate") r.targetAsset = "USDT0";
    else if (r.action === "rwa_exit") r.targetAsset = "USDT";
    else r.targetAsset = "mUSD";
  }

  // allocationPct
  if (r.allocationPct === undefined && r.allocation_pct !== undefined)
    r.allocationPct = r.allocation_pct;
  if (r.allocationPct === undefined && r.allocation !== undefined)
    r.allocationPct = r.allocation;
  if (r.allocationPct === undefined) r.allocationPct = 20;
  r.allocationPct = Number(r.allocationPct);
  if (r.allocationPct > 100) r.allocationPct = 100;
  if (r.allocationPct < 0) r.allocationPct = 0;

  // confidence (R4: track which path produced the final value)
  if (r.confidence === undefined && r.conf !== undefined) r.confidence = r.conf;
  let _confidencePath = "native_unit";
  r.confidence = Number(r.confidence);
  if (isNaN(r.confidence)) {
    r.confidence = DEFAULT_CONFIDENCE_FALLBACK;
    _confidencePath = "fallback_default";
  }
  // If given as percentage (>1), convert to 0-1
  if (r.confidence > 1 && r.confidence <= 100) {
    r.confidence = r.confidence / 100;
    _confidencePath = "percent_scaled";
  }
  if (r.confidence > 1) r.confidence = 1;
  if (r.confidence < 0) r.confidence = 0;
  r._confidencePath = _confidencePath;

  // reasoning
  if (!r.reasoning && r.reason) r.reasoning = r.reason;
  if (!r.reasoning && r.explanation) r.reasoning = r.explanation;
  if (!r.reasoning) r.reasoning = "Market analysis based on current conditions";
  r.reasoning = String(r.reasoning).substring(0, 1000);

  // riskFactors
  if (!r.riskFactors && r.risk_factors) r.riskFactors = r.risk_factors;
  if (!r.riskFactors && r.risks) r.riskFactors = r.risks;
  if (typeof r.riskFactors === "string") r.riskFactors = [r.riskFactors];
  if (!Array.isArray(r.riskFactors)) r.riskFactors = [];

  return r;
}

function normalizeValidatorResponse(raw) {
  if (!raw || typeof raw !== "object") return raw;
  const r = { ...raw };

  // approved
  if (r.approved === undefined && r.approve !== undefined)
    r.approved = r.approve;
  if (typeof r.approved === "string")
    r.approved =
      r.approved.toLowerCase() === "true" || r.approved.toLowerCase() === "yes";
  if (r.approved === undefined) r.approved = false;

  // validatorConfidence (R4: track path)
  if (
    r.validatorConfidence === undefined &&
    r.validator_confidence !== undefined
  )
    r.validatorConfidence = r.validator_confidence;
  if (r.validatorConfidence === undefined && r.confidence !== undefined)
    r.validatorConfidence = r.confidence;
  let _confidencePath = "native_unit";
  r.validatorConfidence = Number(r.validatorConfidence);
  if (isNaN(r.validatorConfidence)) {
    r.validatorConfidence = DEFAULT_CONFIDENCE_FALLBACK;
    _confidencePath = "fallback_default";
  }
  if (r.validatorConfidence > 1 && r.validatorConfidence <= 100) {
    r.validatorConfidence = r.validatorConfidence / 100;
    _confidencePath = "percent_scaled";
  }
  if (r.validatorConfidence > 1) r.validatorConfidence = 1;
  r._confidencePath = _confidencePath;

  // riskScore
  if (r.riskScore === undefined && r.risk_score !== undefined)
    r.riskScore = r.risk_score;
  if (r.riskScore === undefined && r.risk !== undefined) r.riskScore = r.risk;
  r.riskScore = Number(r.riskScore);
  if (isNaN(r.riskScore)) r.riskScore = 50;

  // reasoning
  if (!r.reasoning && r.reason) r.reasoning = r.reason;
  if (!r.reasoning && r.explanation) r.reasoning = r.explanation;
  if (!r.reasoning) r.reasoning = "Validation assessment";

  // flaggedIssues
  if (!r.flaggedIssues && r.flagged_issues) r.flaggedIssues = r.flagged_issues;
  if (!r.flaggedIssues && r.issues) r.flaggedIssues = r.issues;
  if (!r.flaggedIssues && r.flags) r.flaggedIssues = r.flags;
  if (typeof r.flaggedIssues === "string") r.flaggedIssues = [r.flaggedIssues];
  if (!Array.isArray(r.flaggedIssues)) r.flaggedIssues = [];

  // recommendation
  if (!r.recommendation && r.rec) r.recommendation = r.rec;
  if (!r.recommendation)
    r.recommendation = r.approved ? "Proceed with caution" : "Hold position";

  return r;
}

// Model configuration — multi-model for diverse perspectives
const MODELS = {
  analyst: process.env.ANALYST_MODEL || "zai.glm-5", // Z.ai GLM-5 (latest, hackathon partner)
  validator: process.env.VALIDATOR_MODEL || "us.anthropic.claude-sonnet-4-6", // Claude as independent validator
  arbiter: "gemini-3.5-flash", // Google Gemini 3.5 Flash via Vertex AI (tiebreaker)
};

const { callGeminiArbiter } = require("./geminiArbiter");
const { recordParseMetric, persistRawOutput } = require("./parseMetrics");
const { captureCall, resetCapture, drainCapture } = require("../replay/captureManifest");

async function callAgent(
  systemPrompt,
  userMessage,
  modelId,
  agentRole = "unknown"
) {
  const resolvedModelId = modelId || MODELS.analyst;
  const command = new ConverseCommand({
    modelId: resolvedModelId,
    system: [{ text: systemPrompt }],
    messages: [{ role: "user", content: [{ text: userMessage }] }],
    inferenceConfig: {
      maxTokens: MAX_TOKENS_VALIDATOR,
      temperature: VALIDATOR_TEMPERATURE,
    },
  });

  const _captureStart = Date.now();
  const response = await client.send(command);
  const _captureEnd = Date.now();
  const text = response.output.message.content[0].text;

  // R2: persist raw output for diagnostics (best-effort).
  try {
    persistRawOutput(text, resolvedModelId, agentRole);
  } catch {}

  // Reproducible AI: capture exact prompt + raw response for replay.
  // Best-effort and non-blocking; failure here must never affect the
  // existing parse/return path.
  try {
    captureCall({
      role: agentRole,
      provider: "aws-bedrock",
      modelId: resolvedModelId,
      temperature: VALIDATOR_TEMPERATURE,
      maxTokens: MAX_TOKENS_VALIDATOR,
      systemPrompt,
      userPrompt: userMessage,
      rawText: text,
      timing: { startMs: _captureStart, endMs: _captureEnd },
    });
  } catch {}

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
    const parsed = JSON.parse(jsonStr);
    recordParseMetric(agentRole, "json_ok");
    return parsed;
  } catch (e) {
    // GLM-5 sometimes returns YAML-like format: "action: swap\nconfidence: 0.85"
    // Try to convert YAML-like key: value pairs to JSON
    const lines = text.split("\n").filter((l) => l.trim());
    const obj = {};
    for (const line of lines) {
      const match = line.match(/^\s*"?(\w+)"?\s*:\s*(.+)$/);
      if (match) {
        let [, key, val] = match;
        val = val.trim().replace(/,\s*$/, "");
        // Parse value type
        if (val === "true") obj[key] = true;
        else if (val === "false") obj[key] = false;
        else if (!isNaN(Number(val)) && val !== "") obj[key] = Number(val);
        else if (val.startsWith('"') && val.endsWith('"'))
          obj[key] = val.slice(1, -1);
        else if (val.startsWith("[")) {
          try {
            obj[key] = JSON.parse(val);
          } catch {
            obj[key] = val;
          }
        } else obj[key] = val.replace(/^["']|["']$/g, "");
      }
    }
    if (Object.keys(obj).length >= 2) {
      recordParseMetric(agentRole, "yaml_ok");
      console.log(
        `  [PARSE] Recovered YAML-like response from model (role=${agentRole}, ${
          Object.keys(obj).length
        } fields)`
      );
      return obj;
    }
    recordParseMetric(agentRole, "failed");
    throw new Error(`Cannot parse model response: ${text.substring(0, 100)}`);
  }
}

/**
 * Call the validator with one retry on parse failure.
 * The retry uses a stricter system-prompt addendum and tags its
 * parse metric under role='validator-retry' so first-attempt rates
 * stay clean (R5).
 */
async function callValidatorWithRetry(systemPrompt, userMessage, modelId) {
  try {
    return await callAgent(systemPrompt, userMessage, modelId, "validator");
  } catch (e) {
    console.log(
      `  [VALIDATOR-RETRY] First attempt failed: ${e.message?.slice(0, 60)}`
    );
    const stricter =
      systemPrompt +
      "\n\n" +
      "Your previous response was not valid JSON. Reply with ONLY a single " +
      "minified JSON object now. No markdown. No prose.";
    return callAgent(stricter, userMessage, modelId, "validator-retry");
  }
}

// === Evolved-prompts gate (T7) ===
//
// Operator opts in by setting EVOLVED_PROMPTS_ENABLED=true. When opted in,
// the analyst prompt loaded from IPFS is appended with FORMAT_GUARD_SUFFIX,
// which is NOT subject to evolution — it re-asserts the JSON output contract
// every cycle so model drift can't change the output shape.
const EVOLVED_PROMPTS_ENABLED = process.env.EVOLVED_PROMPTS_ENABLED === "true";
const FORMAT_GUARD_SUFFIX = `

=== STRICT OUTPUT CONTRACT (immutable, do not deviate) ===
You MUST respond with EXACTLY one minified JSON object. No markdown fences.
No prose before or after. No "Here is my analysis…" preambles.
Required keys (no extras): action ("swap" | "hold"), direction ("risk_on" | "risk_off" | "neutral"),
targetAsset ("mUSD" | "mETH" | "MNT" | "WMNT"), allocationPct (number 0..100), confidence (number 0..1),
reasoning (string ≤ 1000 chars), riskFactors (string[]).
The schema is non-negotiable. Output failures are discarded by the parser
and the agent loses an audit entry on Mantle.`;

/**
 * MULTI-AGENT DECISION PIPELINE
 * Returns both agents' assessments + consensus result
 */
async function getMultiAgentDecision(marketData) {
  const _timingStart = Date.now();
  // Reproducible AI: clear any leftover capture from a prior cycle so
  // this cycle's manifest only contains its own model calls.
  resetCapture();
  // SECURITY: any string field that might originate from external data
  // (CoinGecko sentiment, Nansen narrative, Byreal labels, regime
  // rationale produced by upstream classifiers) gets stripped of
  // control chars before it ever reaches an LLM prompt. Numeric fields
  // pass through untouched.
  //
  // Spec: .kiro/specs/post-submission-backlog → threat-1.
  if (marketData?.structuredSignals) {
    marketData.structuredSignals = sanitizeForPrompt(
      marketData.structuredSignals
    );
  }
  // Defensive defaults — prevent undefined in prompt
  const md = {
    ethPrice: marketData.ethPrice || 0,
    ethChange24h: marketData.ethChange24h || marketData.priceChange24h || 0,
    mETHYield: marketData.mETHYield || 3.5,
    sentiment: sanitizeExternalText(marketData.sentiment, 50) || "neutral",
    fearGreedIndex: marketData.fearGreedIndex || 50,
    nansenSentiment:
      sanitizeExternalText(marketData.nansenSentiment, 50) || "n/a",
    smartMoneyFlow: marketData.smartMoneyFlow || 0,
    nansenTopBuying: marketData.nansenTopBuying || [],
    mantleTVL: marketData.mantleTVL || 0,
  };

  // Whitelisted symbols only — Nansen "top buying" tokens are
  // user-influenced data and a malicious symbol like
  // "ETH\nIGNORE PREVIOUS INSTRUCTIONS" is the classic prompt-injection
  // vector for the fallback path. Strict regex match instead of trust.
  md.nansenTopBuying = (md.nansenTopBuying || [])
    .map((t) => ({
      ...t,
      symbol:
        typeof t?.symbol === "string" && /^[A-Za-z0-9]{1,12}$/.test(t.symbol)
          ? t.symbol
          : "?",
    }))
    .slice(0, 10);

  // Use rich promptContext from unifiedMarketData if available, else build basic prompt
  const marketPrompt =
    sanitizeExternalText(marketData.promptContext, 4000) ||
    `Current market data (${new Date().toISOString()}):
- ETH Price: $${md.ethPrice} (24h change: ${md.ethChange24h.toFixed(2)}%)
- mETH Yield: ${md.mETHYield}% APY
- Risk-Free Rate (USDY proxy): 4.5% APY
- Yield Spread: ${(md.mETHYield - 4.5).toFixed(2)}%
- Market Sentiment: ${md.sentiment} (Fear&Greed: ${md.fearGreedIndex}/100)
- Nansen Smart Money: ${
      md.nansenSentiment
    } (24h flow: $${md.smartMoneyFlow.toLocaleString()})
- Top Smart Money Buying: ${
      md.nansenTopBuying.map((t) => t.symbol).join(", ") || "none"
    }
- Mantle TVL: $${((md.mantleTVL || 0) / 1e6).toFixed(0)}M
- Pool Liquidity (mETH/mUSD): sufficient for <$50k swaps`;

  // STEP 1: Analyst proposes (T7: evolved prompt gate)
  // The evolved-prompt path was previously bypassed unconditionally because
  // mutated prompts drifted into bad output formats (SOL targets, markdown).
  // We now load evolved prompts ONLY when EVOLVED_PROMPTS_ENABLED=true and
  // append a non-evolvable FORMAT_GUARD_SUFFIX that re-asserts the JSON
  // contract. The validator prompt is intentionally NEVER evolved — it is
  // the safety floor.
  const evolved = await getEvolvedPrompts();
  let activeAnalystPrompt = ANALYST_SYSTEM_PROMPT;
  const activeValidatorPrompt = VALIDATOR_SYSTEM_PROMPT;
  let promptSource = "static";
  if (EVOLVED_PROMPTS_ENABLED && evolved?.analyst) {
    activeAnalystPrompt = evolved.analyst + FORMAT_GUARD_SUFFIX;
    promptSource = `evolved-v${evolved.version || "?"}`;
    console.log(`  [EVOLUTION] Active analyst prompt: ${promptSource}`);
  } else if (evolved?.analyst) {
    console.log(
      `  [EVOLUTION] Evolved v${
        evolved.version || "?"
      } available but disabled (EVOLVED_PROMPTS_ENABLED=false)`
    );
  }

  console.log(
    `  [ANALYST] Analyzing market data... (model: ${MODELS.analyst})`
  );
  const _analystStart = Date.now();
  const analystRaw = await callAgent(
    activeAnalystPrompt,
    marketPrompt,
    MODELS.analyst,
    "analyst"
  );
  const _analystMs = Date.now() - _analystStart;

  // Normalize GLM-5 field names to match AnalystSchema
  const analystDecision = normalizeAnalystResponse(analystRaw);
  const analystValidated = AnalystSchema.safeParse(analystDecision);

  if (!analystValidated.success) {
    return {
      consensus: false,
      reason:
        "Analyst produced invalid output: " + analystValidated.error.message,
      analyst: null,
      validator: null,
      action: "hold",
    };
  }

  // STEP 2: Validator independently assesses
  // Give Validator the RAW structured signals separately — so it can cross-check GLM-5's reasoning
  const rawSignalsSummary = marketData.structuredSignals
    ? `\nRAW STRUCTURED SIGNALS (verify Analyst's reasoning against these):
- Regime: ${marketData.structuredSignals.regime?.regime} (${
        marketData.structuredSignals.regime?.confidence
      }% confidence) — ${marketData.structuredSignals.regime?.rationale}
- Signal consensus: ${marketData.structuredSignals.consensus}
- Funding rate: ${
        marketData.structuredSignals.signals?.funding?.value?.toFixed(2) ||
        "n/a"
      }% annualised → ${
        marketData.structuredSignals.signals?.funding?.label
      } (strength ${
        marketData.structuredSignals.signals?.funding?.strength || "n/a"
      })
- Smart money flow: ${
        marketData.structuredSignals.signals?.onchainFlow?.direction || "n/a"
      } $${(
        (marketData.structuredSignals.signals?.onchainFlow?.netUsd || 0) / 1e6
      ).toFixed(1)}M → ${
        marketData.structuredSignals.signals?.onchainFlow?.label
      }
- Yield spread: ${
        marketData.structuredSignals.signals?.yieldSpread?.spread?.toFixed(2) ||
        "n/a"
      }% → ${marketData.structuredSignals.signals?.yieldSpread?.label}
- Liq risk: ${
        marketData.structuredSignals.signals?.liquidation?.riskType || "n/a"
      }
${
  marketData.structuredSignals.signals?.ranging
    ? `- RANGING GRID: action=${
        marketData.structuredSignals.signals.ranging.action
      } | channel=$${
        marketData.structuredSignals.signals.ranging.channel?.support
      }-$${
        marketData.structuredSignals.signals.ranging.channel?.resistance
      } | position=${(
        marketData.structuredSignals.signals.ranging.channel?.channelPosition *
        100
      ).toFixed(0)}% | confidence=${(
        marketData.structuredSignals.signals.ranging.confidence * 100
      ).toFixed(0)}%`
    : ""
}`
    : "";

  const validatorPrompt = `${marketPrompt}${rawSignalsSummary}

ANALYST'S PROPOSAL TO VERIFY:
- Action: ${analystDecision.action}
- Target: ${analystDecision.targetAsset}
- Allocation: ${analystDecision.allocationPct}%
- Confidence: ${(analystDecision.confidence * 100).toFixed(0)}%
- Reasoning: "${analystDecision.reasoning}"
- Risk Factors: ${JSON.stringify(analystDecision.riskFactors || [])}

Cross-check: does the Analyst's reasoning actually match the raw signals above? Is there a signal they ignored or misread?`;

  console.log(
    `  [VALIDATOR] Verifying proposal... (model: ${MODELS.validator})`
  );
  const _validatorStart = Date.now();
  const validatorRaw = await callValidatorWithRetry(
    activeValidatorPrompt,
    validatorPrompt,
    MODELS.validator
  );
  const _validatorMs = Date.now() - _validatorStart;
  const validatorNorm = normalizeValidatorResponse(validatorRaw);
  const validatorResult = ValidatorSchema.safeParse(validatorNorm);

  if (!validatorResult.success) {
    return {
      consensus: false,
      reason: "Validator produced invalid output",
      analyst: analystDecision,
      validator: null,
      action: "hold",
    };
  }

  const validator = validatorResult.data;

  // STEP 3: Determine consensus (with dynamic confidence threshold)
  const confidenceThreshold = getDynamicConfidenceThreshold();
  console.log(
    `  [THRESHOLD] Active confidence threshold: ${confidenceThreshold}`
  );

  const analystWantsAction =
    analystDecision.confidence >= confidenceThreshold &&
    analystDecision.action !== "hold";
  const validatorApproves =
    validator.approved &&
    validator.validatorConfidence >=
      confidenceThreshold - VALIDATOR_TOLERANCE &&
    validator.riskScore <= MAX_RISK_SCORE;

  let consensus = analystWantsAction && validatorApproves;
  let arbiterVote = null;

  // STEP 3b: ARBITER (3rd agent) — called when analyst and validator DISAGREE
  if (analystWantsAction !== validatorApproves) {
    console.log(
      `  [ARBITER] Disagreement detected — calling arbiter (model: ${MODELS.arbiter})...`
    );
    const _arbiterStart = Date.now();
    const arbiterPrompt = `You are the ARBITER AGENT — a neutral tiebreaker in a multi-agent trading system.

The ANALYST proposed: ${analystDecision.action} ${
      analystDecision.targetAsset
    } with ${(analystDecision.confidence * 100).toFixed(0)}% confidence.
Analyst reasoning: "${analystDecision.reasoning}"

The VALIDATOR ${validator.approved ? "APPROVED" : "REJECTED"} with ${(
      validator.validatorConfidence * 100
    ).toFixed(0)}% confidence, risk=${validator.riskScore}.
Validator reasoning: "${validator.reasoning}"

Market context: ETH $${md.ethPrice}, 24h change ${md.ethChange24h.toFixed(
      2
    )}%, sentiment: ${md.sentiment}, Fear&Greed: ${md.fearGreedIndex}/100

YOUR TASK: Break the tie. Should this trade execute?
Reply with ONLY valid JSON: {"vote": "approve" or "reject", "reasoning": "your 1-sentence reasoning", "confidence": 0.0-1.0}`;

    try {
      const arbiterRaw = await callGeminiArbiter(
        "You are a neutral arbiter in a multi-agent trading system. You ONLY output valid JSON. No markdown, no explanation outside JSON.",
        arbiterPrompt
      );
      const _arbiterMs = Date.now() - _arbiterStart;
      arbiterVote = arbiterRaw;
      arbiterVote._ms = _arbiterMs;
      console.log(
        `  [ARBITER] Vote: ${arbiterRaw.vote} (${(
          arbiterRaw.confidence * 100
        ).toFixed(0)}% conf)`
      );

      // 2/3 voting: analyst + arbiter approve = execute, or validator + arbiter reject = block
      if (arbiterRaw.vote === "approve" && analystWantsAction) {
        consensus = true; // analyst + arbiter = 2/3
      } else {
        consensus = false; // validator + arbiter = 2/3 reject
      }
    } catch (e) {
      console.log(
        `  [ARBITER] Error: ${e.message} — defaulting to conservative (block)`
      );
      consensus = false;
    }
  }

  return {
    consensus,
    reason: consensus
      ? "Multi-agent consensus (2/3 or 3/3) — executing"
      : `Blocked: ${
          !validatorApproves
            ? "Validator rejected"
            : validator.riskScore > 60
            ? "Risk too high"
            : "Confidence threshold not met"
        }${arbiterVote ? ` | Arbiter: ${arbiterVote.vote}` : ""}`,
    analyst: analystDecision,
    validator: validator,
    arbiter: arbiterVote,
    action: consensus ? analystDecision.action : "hold",
    targetAsset: analystDecision.targetAsset,
    finalConfidence: Math.min(
      analystDecision.confidence,
      validator.validatorConfidence
    ),
    _promptSource: promptSource,
    _activeThreshold: confidenceThreshold,
    _timing: {
      start: _timingStart,
      analyst: _analystMs,
      validator: _validatorMs,
      arbiter: arbiterVote?._ms ?? null,
      totalMs: Date.now() - _timingStart,
    },
  };
}

module.exports = {
  getMultiAgentDecision,
  callAgent,
  normalizeAnalystResponse,
  normalizeValidatorResponse,
  getDynamicConfidenceThreshold,
  // Reproducible AI capture surface — drain after a cycle to retrieve
  // the per-call replay set. multiAgentLoop wires this into manifest
  // writes and on-chain anchoring.
  drainCapture,
};
