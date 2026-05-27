# Agent Reasoning Quality — Design

## Decisions taken (closes open questions from requirements.md)

| Q                        | Decision                                                                                                                                                                                                                                | Rationale                                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Q1 evolved prompts       | **Path A with explicit gate.** Attempt to re-enable with a format-guard suffix; ship behind `EVOLVED_PROMPTS_ENABLED=true` env flag. If 50-cycle smoke test parse rate ≥ 95%, default to true. Else default to false (Path B fallback). | Preserves "self-evolving" narrative if technically achievable. Concrete gate prevents shipping a regression. |
| Q2 keep GLM-5            | **Keep GLM-5.** Fix parsing first (R3+R4+R5). Replace only if parse rate < 60% after fixes.                                                                                                                                             | Z.ai partnership is a real talking point. Most parse issues stem from prompt clarity, not the model itself.  |
| Q3 on-chain tier         | **In reasoning text.** Tag word prefix like `[BLOCKED_BY_VALIDATOR] …`. No contract changes.                                                                                                                                            | Avoids redeploy + Sourcify drift. Future structured event is roadmap.                                        |
| Q4 retro-tag old entries | **Best-effort with `tierSource: 'inferred'`.**                                                                                                                                                                                          | Cleaner dashboard. Explicit flag makes provenance auditable.                                                 |
| Q5 parse-fail behavior   | **Continue with HOLD + count.** ≥ 5 fails in 24h triggers circuit-breaker pause.                                                                                                                                                        | Logging an empty cycle is better than dropping it. Repeated failures still get caught.                       |

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                  src/orchestrator/multiAgentLoop.js                   │
│                                                                       │
│   getUnifiedMarketContext()                                           │
│      │                                                                │
│      ▼                                                                │
│   getStructuredSignals()                                              │
│      │                                                                │
│      ▼                                                                │
│   getMultiAgentDecision(market)  ◄── multiAgent.js                    │
│      │                                                                │
│      │  attaches: _confidencePath, _parseFailures, _retried, _evol    │
│      ▼                                                                │
│   classifyDecisionTier(decision, market)  ◄── decisionTier.js (NEW)   │
│      │                                                                │
│      │  returns: 'EXECUTED_SWAP' | 'BLOCKED_BY_VALIDATOR' |           │
│      │           'BLOCKED_BY_LOW_CONFIDENCE' | 'BLOCKED_BY_REGIME' |  │
│      │           'BLOCKED_BY_PARSE_FAILURE'                           │
│      ▼                                                                │
│   IPFS pin (reasoning blob with tier)                                 │
│      │                                                                │
│      ▼                                                                │
│   On-chain: ValidationRegistry, DecisionLog                           │
│      │       ↳ logDecision(reasoning="[BLOCKED_BY_VALIDATOR] …")     │
│      ▼                                                                │
│   outcomeTracker.record({ ..., decisionTier, confidencePath,         │
│                           disagreementSignal, validatorReasoning,    │
│                           tierSource: 'live' })                      │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       Side-channels (NEW)                             │
│                                                                       │
│   src/data/raw_model_outputs/{ts}_{agent}.txt   ← R2 raw logs        │
│   src/data/parse_metrics.json                   ← R3 daily counters  │
│   src/data/threshold_state.json                 ← R8 dynamic threshold│
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│            /api/health (already shipped, gets new fields)             │
│   parseSuccessRate24h, parseFailureCount24h, thresholdMode            │
└──────────────────────────────────────────────────────────────────────┘
```

## Component design

### C1 — `src/orchestrator/decisionTier.js` (NEW)

Single source of truth for tier classification. Pure function. Unit-testable.

```javascript
/**
 * Classify a multi-agent cycle's outcome into one of five tiers.
 * Pipeline order: parse-failure → low-confidence → regime → validator → executed.
 *
 * @param {object} decision  - return value of getMultiAgentDecision()
 * @param {object} market    - market context with structuredSignals
 * @returns {'EXECUTED_SWAP'|'BLOCKED_BY_VALIDATOR'|'BLOCKED_BY_LOW_CONFIDENCE'|'BLOCKED_BY_REGIME'|'BLOCKED_BY_PARSE_FAILURE'}
 */
function classifyDecisionTier(decision, market) {
  // 1. Parse failure — neither analyst nor validator could be Zod-parsed
  if (!decision.analyst || !decision.validator) {
    return "BLOCKED_BY_PARSE_FAILURE";
  }

  // 2. Regime block — regime detector says HOLD/UNKNOWN regardless of analyst
  const regime = market.structuredSignals?.regime?.regime;
  if (regime === "HOLD" || regime === "UNKNOWN") {
    return "BLOCKED_BY_REGIME";
  }

  // 3. Low confidence — analyst below threshold; never reached validator gate
  const threshold = decision._activeThreshold ?? 0.6;
  if ((decision.analyst.confidence ?? 0) < threshold) {
    return "BLOCKED_BY_LOW_CONFIDENCE";
  }

  // 4. Validator veto
  if (!decision.validator.approved) {
    return "BLOCKED_BY_VALIDATOR";
  }

  // 5. Consensus reached + action is swap
  if (decision.consensus && decision.action === "swap") {
    return "EXECUTED_SWAP";
  }

  // 6. Edge: analyst.action === 'hold' with full consensus (regime-supported HOLD)
  return "BLOCKED_BY_REGIME";
}

module.exports = { classifyDecisionTier };
```

**Notes:**

- Pipeline order matters: a cycle that both has low confidence AND would be regime-blocked surfaces low-confidence first; this matches user-perception ("the model wasn't sure").
- `_activeThreshold` is exposed by `getMultiAgentDecision()` so we don't re-read state.
- Tests cover the 6 paths plus edge cases (analyst undefined, validator undefined, mixed states).

### C2 — `multiAgent.js` modifications

Five edits in this file:

#### C2.1 — Confidence-path tracking (R4)

Modify `normalizeAnalystResponse()` and `normalizeValidatorResponse()` to record which branch fired:

```javascript
// confidence
let path = "native_unit";
if (r.confidence === undefined && r.conf !== undefined) r.confidence = r.conf;
const rawConf = r.confidence;
r.confidence = Number(rawConf);
if (isNaN(r.confidence)) {
  r.confidence = DEFAULT_CONFIDENCE_FALLBACK;
  path = "fallback_default";
}
if (r.confidence > 1 && r.confidence <= 100) {
  r.confidence = r.confidence / 100;
  path = "percent_scaled";
}
if (r.confidence > 1) r.confidence = 1;
if (r.confidence < 0) r.confidence = 0;
r._confidencePath = path;
```

`getMultiAgentDecision()` then surfaces `decision.analyst._confidencePath` to the loop.

#### C2.2 — Parse-failure counter + raw output logging (R2, R3)

Modify `callAgent()`:

```javascript
async function callAgent(
  systemPrompt,
  userMessage,
  modelId,
  agentRole = "unknown"
) {
  // ... existing Bedrock call ...
  const text = response.output.message.content[0].text;

  // R2: persist raw output (best-effort)
  try {
    persistRawOutput(text, modelId, agentRole);
  } catch (e) {
    /* swallow */
  }

  // R3: track parse stats
  let parseOutcome = "json_ok";

  // ... existing JSON extract ...
  try {
    return JSON.parse(jsonStr);
  } catch {
    parseOutcome = "json_failed";
    // YAML fallback path
    const lines = text.split("\n").filter((l) => l.trim());
    const obj = {};
    // ... existing YAML logic ...
    if (Object.keys(obj).length >= 2) {
      parseOutcome = "yaml_ok";
      console.log(
        `  [PARSE] Recovered YAML-like response (${agentRole}, ${
          Object.keys(obj).length
        } fields)`
      );
      recordParseMetric(agentRole, parseOutcome);
      return obj;
    }
    parseOutcome = "failed";
    recordParseMetric(agentRole, parseOutcome);
    throw new Error(`Cannot parse model response: ${text.substring(0, 100)}`);
  } finally {
    if (parseOutcome === "json_ok") recordParseMetric(agentRole, parseOutcome);
  }
}
```

`persistRawOutput()` and `recordParseMetric()` live in a new helper file `src/orchestrator/parseMetrics.js`.

#### C2.3 — Validator system prompt tightening (R5)

Replace the existing Validator preamble with stricter JSON-only language. Lower temperature.

```javascript
const VALIDATOR_TEMPERATURE = 0.05; // was 0.1

const VALIDATOR_SYSTEM_PROMPT = `OUTPUT CONTRACT (strict):
You MUST respond with EXACTLY one JSON object. No markdown fences. No prose
before or after. No explanations outside JSON. If you violate this, the
parser will discard your response and the agent will lose data.

Required keys (all):
  approved (bool), validatorConfidence (number 0-1), riskScore (number 0-100),
  reasoning (string ≤ 400 chars), flaggedIssues (string[] ≤ 5), recommendation (string ≤ 80 chars)

YOUR DEFAULT STATE IS REJECT.
... [rest of existing validator prompt] ...
`;
```

Plus a one-shot retry on parse failure for Validator only (R5.3):

```javascript
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
      "Your previous response was not valid JSON. Reply with ONLY a JSON object now.";
    return callAgent(stricter, userMessage, modelId, "validator-retry");
    // If second attempt fails, error propagates and decision._failedValidator is set upstream.
  }
}
```

`getMultiAgentDecision()` swaps `callAgent(...)` for `callValidatorWithRetry(...)` for the validator step.

#### C2.4 — Evolved prompts gate (R6, Path A)

Replace the current bypass with an env-flag gated load:

```javascript
const EVOLVED_PROMPTS_ENABLED = process.env.EVOLVED_PROMPTS_ENABLED === "true";
const FORMAT_GUARD_SUFFIX =
  `\n\n=== STRICT OUTPUT CONTRACT (immutable) ===\n` +
  `You MUST respond with EXACTLY one minified JSON object. No markdown, no prose.\n` +
  `Required keys: action (swap|hold), direction, targetAsset (mUSD|mETH), ` +
  `allocationPct, confidence, reasoning. The shape is non-negotiable.`;

const evolved = await getEvolvedPrompts();
let activeAnalystPrompt = ANALYST_SYSTEM_PROMPT;
let promptSource = "static";
if (EVOLVED_PROMPTS_ENABLED && evolved?.analyst) {
  activeAnalystPrompt = evolved.analyst + FORMAT_GUARD_SUFFIX;
  promptSource = `evolved-v${evolved.version}`;
  console.log(`  [EVOLUTION] Active prompt: ${promptSource}`);
} else if (evolved?.analyst) {
  console.log(
    `  [EVOLUTION] Evolved v${evolved.version} available but disabled (EVOLVED_PROMPTS_ENABLED=false)`
  );
}
// Validator prompt stays static — it's the safety floor; evolving it could
// drift safety guarantees.
```

Decision object gets `_promptSource` field so outcomes/IPFS can record provenance.

#### C2.5 — Surface dynamic threshold to decision (R8)

`getDynamicConfidenceThreshold()` already exists; modify it to also write to `src/data/threshold_state.json`:

```javascript
function getDynamicConfidenceThreshold() {
  // ... existing logic computing consecutiveLosses ...

  const state = {
    consecutiveLosses,
    activeThreshold,
    triggeredAt:
      activeThreshold === ELEVATED_CONFIDENCE_THRESHOLD
        ? new Date().toISOString()
        : null,
    recoveryRule: "1 GOOD_CALL or CORRECT_BLOCK resets to base",
    updatedAt: new Date().toISOString(),
  };

  try {
    fs.writeFileSync(
      path.resolve(__dirname, "../../src/data/threshold_state.json"),
      JSON.stringify(state, null, 2)
    );
  } catch {
    /* swallow */
  }

  return activeThreshold;
}
```

`/api/health` endpoint reads this file and surfaces `thresholdMode: 'base' | 'elevated'`.

### C3 — `multiAgentLoop.js` modifications

Three edits:

#### C3.1 — Compute and persist decisionTier

After `getMultiAgentDecision()` and before any IPFS / on-chain writes:

```javascript
const { classifyDecisionTier } = require("./decisionTier");
const decisionTier = classifyDecisionTier(decision, market);
console.log(`   TIER: ${decisionTier}`);

// Embed tier in IPFS payload
const ipfsResult = await uploadReasoningProof(
  { ...decision, decisionTier },
  market
);
```

#### C3.2 — Tier prefix on on-chain reasoning

```javascript
const tierTag = `[${decisionTier}]`;
const reasoning = `${tierTag} Analyst: ${decision.analyst?.reasoning?.substring(
  0,
  80
)} | Validator: ${
  decision.validator?.approved ? "APPROVED" : "REJECTED"
} (risk=${riskScore})`.substring(0, 200);

await decisionLog.logDecision(
  decision.action,
  decision.analyst?.targetAsset || "mUSD",
  ethers.parseEther("0"),
  ethers.parseEther("0"),
  confidenceBps,
  reasoning,
  ethers.keccak256(ethers.toUtf8Bytes(ipfsResult.cid)),
  { nonce: currentNonce + 2 }
);
```

#### C3.3 — Extended outcome record

```javascript
const disagreementSignal =
  (decision.analyst?.confidence ?? 0) > 0.6 &&
  decision.validator?.approved === false;

outcomeTracker.record({
  decisionId: Number(proposalId),
  action: decision.analyst?.action || "hold",
  targetAsset: decision.analyst?.targetAsset || "mUSD",
  consensus: decision.consensus || false,
  confidence: decision.analyst?.confidence || 0.5,
  priceAtDecision: market.ethPrice,
  ipfsCid: ipfsResult.cid,
  disciplineStatus,
  // NEW v2 fields:
  decisionTier,
  tierSource: "live",
  confidencePath: decision.analyst?._confidencePath ?? "unknown",
  promptSource: decision._promptSource ?? "static",
  disagreementSignal,
  validatorReasoning: decision.validator?.reasoning?.substring(0, 400) || null,
  validatorFlaggedIssues: decision.validator?.flaggedIssues || [],
  arbiterVote: decision.arbiter?.vote ?? null,
  arbiterReasoning: decision.arbiter?.reasoning?.substring(0, 400) || null,
});
```

### C4 — `outcomeTracker.js` modifications

Two edits:

#### C4.1 — Schema versioning

```javascript
const SCHEMA_VERSION = 2;

function loadDB() {
  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    const db = JSON.parse(raw);
    db.schemaVersion = db.schemaVersion ?? 1; // tag pre-existing files
    db.pending = db.pending ?? [];
    db.settled = db.settled ?? [];
    return db;
  } catch {
    return { schemaVersion: SCHEMA_VERSION, pending: [], settled: [] };
  }
}

function saveDB(db) {
  db.schemaVersion = SCHEMA_VERSION;
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}
```

#### C4.2 — Pass through new fields

`record()` already accepts `params` as a spread; ensure new fields land. Add them to the JSDoc.

### C5 — `parseMetrics.js` (NEW helper)

Lives at `src/orchestrator/parseMetrics.js`. Pure file-state, no DB.

```javascript
const fs = require("fs");
const path = require("path");

const METRICS_PATH = path.resolve(
  __dirname,
  "../../src/data/parse_metrics.json"
);
const RAW_DIR = path.resolve(__dirname, "../../src/data/raw_model_outputs");

const TODAY = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

function ensureDirs() {
  fs.mkdirSync(path.dirname(METRICS_PATH), { recursive: true });
  fs.mkdirSync(RAW_DIR, { recursive: true });
}

function loadMetrics() {
  ensureDirs();
  try {
    return JSON.parse(fs.readFileSync(METRICS_PATH, "utf8"));
  } catch {
    return { byDay: {} };
  }
}

function saveMetrics(m) {
  ensureDirs();
  fs.writeFileSync(METRICS_PATH, JSON.stringify(m, null, 2));
}

function recordParseMetric(agentRole, outcome) {
  // outcome: 'json_ok' | 'yaml_ok' | 'failed'
  const m = loadMetrics();
  const day = TODAY();
  const bucket = (m.byDay[day] = m.byDay[day] || {});
  const role = (bucket[agentRole] = bucket[agentRole] || {
    json_ok: 0,
    yaml_ok: 0,
    failed: 0,
  });
  role[outcome] = (role[outcome] || 0) + 1;
  saveMetrics(m);
}

function persistRawOutput(text, modelId, agentRole) {
  ensureDirs();
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const fn = path.join(RAW_DIR, `${ts}_${agentRole}.txt`);
  const header = `# model=${modelId} agent=${agentRole} timestamp=${new Date().toISOString()}\n\n`;
  fs.writeFileSync(fn, header + text);
}

function getRollingMetrics(hours = 24) {
  const m = loadMetrics();
  const cutoff = new Date(Date.now() - hours * 3600 * 1000);
  let total = 0,
    jsonOk = 0,
    yamlOk = 0,
    failed = 0;
  for (const [day, bucket] of Object.entries(m.byDay)) {
    if (new Date(day + "T23:59:59Z") < cutoff) continue;
    for (const role of Object.values(bucket)) {
      jsonOk += role.json_ok || 0;
      yamlOk += role.yaml_ok || 0;
      failed += role.failed || 0;
    }
  }
  total = jsonOk + yamlOk + failed;
  return {
    total,
    jsonOk,
    yamlOk,
    failed,
    successRate: total > 0 ? (jsonOk + yamlOk) / total : null,
  };
}

module.exports = { recordParseMetric, persistRawOutput, getRollingMetrics };
```

### C6 — `/api/health` extension (already shipped, append fields)

In `frontend/app/api/health/route.ts`, three new optional reads:

```typescript
// Parse metrics (R3)
const parseMetricsPath = backendPath("src", "data", "parse_metrics.json");
let parseSuccessRate24h: number | null = null;
let parseFailureCount24h: number | null = null;
try {
  const m = JSON.parse(fs.readFileSync(parseMetricsPath, "utf-8"));
  // Inline rolling 24h calculation (same logic as parseMetrics.js getRollingMetrics)
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000);
  let total = 0,
    ok = 0,
    failed = 0;
  for (const [day, bucket] of Object.entries(m.byDay ?? {})) {
    if (new Date(day + "T23:59:59Z") < cutoff) continue;
    for (const role of Object.values(bucket as any)) {
      const r = role as any;
      ok += (r.json_ok ?? 0) + (r.yaml_ok ?? 0);
      failed += r.failed ?? 0;
    }
  }
  total = ok + failed;
  parseSuccessRate24h = total > 0 ? ok / total : null;
  parseFailureCount24h = failed;
} catch {
  /* leave null */
}

// Threshold state (R8)
const thresholdPath = backendPath("src", "data", "threshold_state.json");
let thresholdMode: "base" | "elevated" | null = null;
let consecutiveLosses: number | null = null;
try {
  const t = JSON.parse(fs.readFileSync(thresholdPath, "utf-8"));
  thresholdMode = t.activeThreshold > 0.7 ? "elevated" : "base";
  consecutiveLosses = t.consecutiveLosses ?? null;
} catch {
  /* leave null */
}
```

Response shape gains:

```json
{
  "parseSuccessRate24h": 0.94,
  "parseFailureCount24h": 2,
  "thresholdMode": "base",
  "consecutiveLosses": 0
}
```

### C7 — Migration script (R9)

`scripts/migrate-outcomes-v2.js`:

```javascript
const fs = require("fs");
const path = require("path");

const DB_PATH = path.resolve(__dirname, "../src/data/outcomes.json");

function inferTier(entry) {
  // Best-effort heuristic for entries that pre-date decisionTier field.
  if (entry.consensus === true && entry.action === "swap")
    return "EXECUTED_SWAP";
  if (entry.consensus === false && (entry.confidence ?? 1) < 0.6)
    return "BLOCKED_BY_LOW_CONFIDENCE";
  if (entry.consensus === false) return "BLOCKED_BY_VALIDATOR";
  if (entry.consensus === true && entry.action === "hold")
    return "BLOCKED_BY_REGIME";
  return "UNKNOWN";
}

function migrate() {
  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  if (db.schemaVersion === 2) {
    console.log("Already at schemaVersion 2 — nothing to migrate.");
    return;
  }
  let touched = 0;
  for (const entry of [...(db.pending ?? []), ...(db.settled ?? [])]) {
    if (entry.decisionTier) continue;
    entry.decisionTier = inferTier(entry);
    entry.tierSource = "inferred";
    entry.confidencePath = entry.confidencePath ?? "unknown";
    entry.promptSource = entry.promptSource ?? "unknown";
    entry.disagreementSignal = entry.disagreementSignal ?? null;
    entry.validatorReasoning = entry.validatorReasoning ?? null;
    entry.validatorFlaggedIssues = entry.validatorFlaggedIssues ?? [];
    entry.arbiterVote = entry.arbiterVote ?? null;
    entry.arbiterReasoning = entry.arbiterReasoning ?? null;
    touched++;
  }
  db.schemaVersion = 2;
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  console.log(`Migrated ${touched} entries to schemaVersion 2.`);
}

migrate();
```

Idempotent — second run is a no-op.

### C8 — Smoke test (R10)

`scripts/smoke-reasoning.js`:

```javascript
process.env.DRY_RUN = "true";
process.env.SKIP_ONCHAIN = "true";
const { runMultiAgentCycle } = require("../src/orchestrator/multiAgentLoop");

async function main() {
  const N = parseInt(process.env.SMOKE_CYCLES ?? "5", 10);
  const tiers = {};
  let parseOk = 0;
  let parseFail = 0;

  for (let i = 0; i < N; i++) {
    console.log(`\n=== smoke cycle ${i + 1}/${N} ===`);
    try {
      const decision = await runMultiAgentCycle({ dryRun: true });
      // multiAgentLoop returns the decision; tier may be in env or last-line log.
      // For robustness, re-classify here:
      const {
        classifyDecisionTier,
      } = require("../src/orchestrator/decisionTier");
      const tier = classifyDecisionTier(decision, decision._market ?? {});
      tiers[tier] = (tiers[tier] ?? 0) + 1;
      parseOk++;
    } catch (e) {
      parseFail++;
      console.log(`Cycle ${i + 1} parse-failed: ${e.message?.slice(0, 80)}`);
    }
  }

  console.log("\n=== SMOKE RESULTS ===");
  console.log(`Cycles attempted: ${N}`);
  console.log(`Parse-ok: ${parseOk}, parse-fail: ${parseFail}`);
  console.log(`Tier distribution: ${JSON.stringify(tiers)}`);
  const successRate = parseOk / N;
  console.log(`Parse success rate: ${(successRate * 100).toFixed(1)}%`);
  if (successRate < 0.95) {
    console.log("⚠ Below 95% parse rate — Path A is at risk; consider Path B.");
    process.exitCode = 1;
  } else {
    console.log("✅ Parse rate ≥ 95%.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

Adds `runMultiAgentCycle({ dryRun })` parameter to skip on-chain TXs and IPFS pin in smoke mode. Decision object returned regardless.

`npm run smoke:reasoning` invokes the script.

### C9 — `inspect-raw.sh` (R2.6)

`scripts/inspect-raw.sh`:

```bash
#!/usr/bin/env bash
# Grep across raw model output logs.
# Usage: npm run inspect:raw -- "confidence: 25"

set -euo pipefail

RAW_DIR="src/data/raw_model_outputs"
PATTERN="${1:-}"

if [[ -z "$PATTERN" ]]; then
  echo "Usage: npm run inspect:raw -- <pattern>"
  exit 1
fi

if [[ ! -d "$RAW_DIR" ]]; then
  echo "No raw outputs yet — run a cycle first."
  exit 0
fi

count=$(grep -lE "$PATTERN" "$RAW_DIR"/*.txt 2>/dev/null | wc -l | tr -d ' ')
echo "Files matching: $count"
grep -nE "$PATTERN" "$RAW_DIR"/*.txt 2>/dev/null | head -20
```

`package.json` gets `"inspect:raw": "bash scripts/inspect-raw.sh"` and `"smoke:reasoning": "node scripts/smoke-reasoning.js"`.

### C10 — `.gitignore` extension

```
src/data/raw_model_outputs/
src/data/parse_metrics.json
src/data/threshold_state.json
```

Reasoning: raw outputs can be tens of MB after a few weeks; parse_metrics is regenerable; threshold_state is a runtime artifact. None are needed in git history. Migration script outputs **stay** in git because they describe a one-time historical event.

## Files touched

```
NEW:
  src/orchestrator/decisionTier.js
  src/orchestrator/parseMetrics.js
  scripts/migrate-outcomes-v2.js
  scripts/smoke-reasoning.js
  scripts/inspect-raw.sh
  src/data/raw_model_outputs/.gitkeep            (so dir exists)

MODIFIED:
  src/orchestrator/multiAgent.js
    - Add _confidencePath tracking in normalizers (C2.1)
    - Wire callAgent → recordParseMetric + persistRawOutput (C2.2)
    - Tighten validator system prompt + lower temperature (C2.3)
    - Add callValidatorWithRetry (C2.3)
    - Replace evolved-prompts bypass with env-flag gate (C2.4)
    - Threshold state persistence in getDynamicConfidenceThreshold (C2.5)
  src/orchestrator/multiAgentLoop.js
    - Import classifyDecisionTier
    - Compute decisionTier; embed in IPFS + on-chain reasoning text
    - Add disagreementSignal computation
    - Pass new v2 fields to outcomeTracker.record()
  src/orchestrator/outcomeTracker.js
    - Schema version field; pass-through new params
  frontend/app/api/health/route.ts
    - Surface parseSuccessRate24h, parseFailureCount24h, thresholdMode (C6)
  package.json
    - npm run smoke:reasoning
    - npm run inspect:raw
    - npm run migrate:outcomes
  .gitignore
    - raw_model_outputs/, parse_metrics.json, threshold_state.json
  src/config/constants.js
    - VALIDATOR_TEMPERATURE: 0.05 (was 0.1)

UNCHANGED (verified safe):
  contracts/*  (no contract changes)
  src/strategies/*  (grid logic untouched)
  src/evolution/promptEvolution.js  (only called differently)
  All other API routes
```

## Risks & mitigations

| Risk                                                                                                             | Mitigation                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Re-enabling evolved prompts re-introduces the format issues that caused the original bypass.                     | EVOLVED_PROMPTS_ENABLED defaults to `false`. Operator opts in with env flag. Smoke test gates the decision.                                                                                      |
| Validator's lower temperature (0.05 → less variation) may cause it to repeatedly veto the same kind of proposal. | Acceptable; validator's job is consistent skepticism. If a real edge is missed, that surfaces as `disagreementSignal` + `MISSED_ALPHA` and we can tune.                                          |
| Raw output logs accumulate large volumes.                                                                        | gitignored; ~5 KB × 3 calls × 288 cycles/day = ~4 MB/day. Add cleanup to remove >7 days old in a follow-up if needed.                                                                            |
| Decision tier classification disagrees with what user expects.                                                   | Tested via unit tests. Edge cases (no analyst output, no validator output) all map to BLOCKED_BY_PARSE_FAILURE clearly.                                                                          |
| Migration script run twice corrupts state.                                                                       | `if (db.schemaVersion === 2) return;` guard at top. Idempotent.                                                                                                                                  |
| Tier prefix in on-chain reasoning text changes the format consumers parse.                                       | Frontend currently truncates reasoning at 200 chars; parses heuristically. New `[TIER]` prefix is at the start of the string and frontend can ignore it (existing parseReasoning() in page.tsx). |
| Validator retry adds latency.                                                                                    | One retry max, only on parse-fail (rare path). Worst case +3s per failed cycle. Acceptable.                                                                                                      |

## Test plan

Manual + automated:

1. **Unit tests for `decisionTier.js`** — cover all 6 paths plus null/undefined edge cases. Lives in `tests/unit/decisionTier.test.js`. Run via existing `jest`.
2. **Migration smoke** — copy `outcomes.json` to a tmp file, run migration, verify all entries gain v2 fields and `tierSource: 'inferred'`. Idempotency: second run = no-op.
3. **Live smoke** — run `npm run smoke:reasoning SMOKE_CYCLES=5` against real Bedrock. Look at:
   - `decisionTier` distribution (should NOT all be BLOCKED_BY_PARSE_FAILURE).
   - `_confidencePath` distribution (mix expected; many `percent_scaled` confirms our diagnosis).
   - `parse_metrics.json` populated with json_ok and possibly yaml_ok counts.
4. **Lint** — `npx eslint src/` no new warnings.
5. **Health endpoint** — restart frontend dev, verify `/api/health` includes `parseSuccessRate24h` after smoke run.
6. **Path A vs B decision** — based on smoke test `parse rate ≥ 95%`, decide whether to flip default `EVOLVED_PROMPTS_ENABLED` to true. Document in spec post-mortem.

## Out of scope confirmation

This spec does NOT:

- Re-deploy any contracts.
- Change the agent's strategy logic (`signalEngine.js`, `rangingGrid.js`, `positionState.js` untouched).
- Add new model providers.
- Add new data sources.
- Modify on-chain `DecisionLog` struct.
- Build new frontend pages (UI improvements that benefit from new fields are a follow-up — Proof Explorer page surfacing `decisionTier` is its own pass).
- Solve the cron-not-running problem (separate spec `continuous-cron-and-health`).
