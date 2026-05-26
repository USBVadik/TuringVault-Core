# Agent Reasoning Quality — Requirements

## Background

The agent's decision quality, as visible in `src/data/outcomes.json` and on the future Proof Explorer page, materially shapes how an AI x RWA judge evaluates the project. Three concrete problems show in the data and code today:

### Finding 1 — Confidence collapse to 0.25

Across the 37 settled outcomes:

```
conf=0.25  outcome=CORRECT_BLOCK   n=5
conf=0.25  outcome=MISSED_ALPHA    n=8
conf=0.25  outcome=NEUTRAL         n=1     →  14/37 = 38% of all settled
conf=0.70  outcome=CORRECT_BLOCK   n=1
conf=0.72  outcome=BAD_CALL        n=2
conf=0.72  outcome=GOOD_CALL       n=2
conf=0.72  outcome=NEUTRAL         n=3
conf=0.75  outcome=BAD_CALL        n=1
conf=0.75  outcome=CORRECT_BLOCK   n=2
conf=0.75  outcome=GOOD_CALL       n=2
conf=0.75  outcome=MISSED_ALPHA    n=1
conf=0.75  outcome=NEUTRAL         n=5
conf=0.78  outcome=MISSED_ALPHA    n=1
conf=0.82  outcome=BAD_CALL        n=2
conf=0.82  outcome=NEUTRAL         n=1
```

`0.25` is not a magic number — it is GLM-5 returning `confidence: 25` (interpreted as a percent) which the normalizer in `multiAgent.js` divides by 100. With 14 entries collapsing to 0.25, this is not a parser glitch — it is the model producing low-confidence outputs at scale. Below the 0.60 threshold these become forced HOLDs, so they always settle as `CORRECT_BLOCK` (price moved with the agent's caution) or `MISSED_ALPHA` (price moved against the caution), never as a directional GOOD or BAD call.

### Finding 2 — Outcomes.json conflates three different "HOLD" kinds

Every `consensus=false` cycle is recorded with the same shape regardless of why consensus failed. The three real reasons are:

1. **Analyst low confidence** (`confidence < 0.60` or `< 0.85` after losses).
2. **Validator veto** (Validator returned `approved=false`, often citing R:R or regime mismatch).
3. **Regime says HOLD** (`signalEngine.detectRegime` returned `HOLD` because signals are mixed).

The dashboard and Proof Explorer cannot distinguish them. A judge clicking through 30 consecutive `MISSED_ALPHA` entries sees "the agent missed N upmoves" and concludes the agent is broken, when in fact some of those blocks were the safety system working as intended (Validator veto with sound reasoning) and others were noise.

### Finding 3 — Evolved prompts are bypassed in production

In `src/orchestrator/multiAgent.js`:

```js
const activeAnalystPrompt = ANALYST_SYSTEM_PROMPT;
const activeValidatorPrompt = VALIDATOR_SYSTEM_PROMPT;
if (evolved?.analyst) {
  console.log(`  [EVOLUTION] Evolved prompt v${evolved.version} available but BYPASSED (format stability)`);
}
```

Meanwhile `assets/agent-card.json` declares `systemPrompt.version = "3.0.0"`, README claims "self-evolving prompts (v2.1.1)", and the homepage previously showed an evolution timeline with fabricated tx hashes (already removed in `ui-honesty-pass`). The narrative is "self-evolving AI" but the runtime is not evolving. Either evolution is re-enabled (with the JSON output stabilized first) or the project's narrative drops the claim.

### Finding 4 — Validator's REJECT bias is correct but invisible

Validator's system prompt starts with "YOUR DEFAULT STATE IS REJECT" — this is good engineering: in adversarial validation, the burden of proof is on the proposal. But neither the `outcomes.json` schema nor the dashboard surfaces this. From a judge's perspective, the high rejection rate (64–66%) reads as "agent can't decide" rather than "Trust Firewall blocked unsafe proposals before execution".

### Finding 5 — Validator and Analyst routinely disagree on the same data

Reading the code's prompt for the Validator carefully: it receives the Analyst's proposal AND the same structured signals, then independently re-derives a position. Many recorded cycles have `analyst.action=swap, analyst.confidence=0.75, validator.approved=false` — meaning two agents looking at the same data reach opposite conclusions. This is what a Turing Test hackathon judge cares about: are the two models actually disagreeing on substance, or is one just misinterpreting? Currently the disagreement reasoning is captured but not made visible.

---

## Scope

### In scope

- `src/orchestrator/multiAgent.js` — model-call loop, normalizers, parsing, prompt selection.
- `src/orchestrator/multiAgentLoop.js` — payload sent to `outcomeTracker.record()`.
- `src/orchestrator/outcomeTracker.js` — schema and classification of outcomes.
- `src/orchestrator/validator.js` — Zod schema for decisions.
- `src/evolution/promptEvolution.js` — re-enablement gating only (no rewrite of the evolution algorithm).
- `assets/agent-card.json` — declared models and prompt version, must align with runtime reality.
- New observability: GLM-5 raw output logging, parse-failure counter, decision tier metadata on chain-recorded reasoning.

### Out of scope

- Smart contracts (no redeploy; outcome metadata is added off-chain only and via reasoning-text payload).
- Frontend changes beyond what naturally follows from new outcome fields. UI follow-up is part of this spec only insofar as Proof Explorer needs new fields. Major UI redesign deferred to its own pass.
- Vault contract pattern (`shares-vault-contract` spec).
- Continuous cron / health monitoring (`continuous-cron-and-health` spec).
- Discipline Layer UI (`discipline-layer-ui` spec).
- Adversarial Challenge v2 (`human-vs-ai-challenge-v2` spec).
- Z.ai partnership negotiation. Choice of Analyst model is technical, not commercial.

## Stakeholders

- **Hackathon judge (AI x RWA track)** — wants to see two distinct models disagreeing on substance, with visible reasoning, and a robust pipeline that doesn't collapse under a stream of low-confidence outputs.
- **Operator (USBVadik)** — needs the agent to take real positions occasionally so the live dashboard isn't dominated by HOLDs, while preserving the safety story.
- **Future depositor** — wants to know what fraction of HOLDs are "Trust Firewall doing its job" vs "agent confused".

## Glossary

- **Decision tier** — categorical reason a cycle ended as HOLD vs SWAP. Five tiers proposed:
  - `EXECUTED_SWAP` — consensus reached, swap path triggered.
  - `BLOCKED_BY_VALIDATOR` — Analyst proposed action; Validator returned `approved=false`. Includes Validator's flagged issues.
  - `BLOCKED_BY_LOW_CONFIDENCE` — Analyst's confidence below threshold; never reached Validator gate.
  - `BLOCKED_BY_REGIME` — Regime detector returned `HOLD` or `UNKNOWN`; pipeline short-circuited to HOLD.
  - `BLOCKED_BY_PARSE_FAILURE` — Analyst output couldn't be parsed; fell back to HOLD via Zod schema rejection.
- **Raw model output** — the Bedrock response text **before** JSON extraction and field normalization.
- **Parse failure** — when neither the JSON regex nor the YAML fallback in `callAgent()` produces a valid object.
- **Disagreement signal** — when `analyst.confidence > 0.6` AND `validator.approved=false`. Captures cases where two models read the same data and conclude differently.

## Functional Requirements

### R1 — Tier-classify every decision

**As a** judge,
**I want** to see, for every decision, why it ended in HOLD or SWAP,
**so that** I can distinguish working safety from broken pipeline.

**Acceptance**

1. WHEN a multi-agent cycle completes, THE orchestrator SHALL compute a `decisionTier` value from the set:
   - `EXECUTED_SWAP`
   - `BLOCKED_BY_VALIDATOR`
   - `BLOCKED_BY_LOW_CONFIDENCE`
   - `BLOCKED_BY_REGIME`
   - `BLOCKED_BY_PARSE_FAILURE`
2. THE `decisionTier` SHALL be:
   - Stored in `outcomes.json` `pending[]` and `settled[]` entries (new field).
   - Included in the `reasoning` string written to `DecisionLog.logDecision()` on-chain (prefix or suffix; one tag word, e.g. `[BLOCKED_BY_VALIDATOR]`).
   - Included in the IPFS reasoning blob.
3. THE classification SHALL be deterministic given the multi-agent decision object. No randomness.
4. WHEN multiple block reasons apply (e.g., regime is HOLD AND analyst confidence is low), THE orchestrator SHALL pick the **first** reason that fired in pipeline order: parse-failure → low-confidence → regime → validator.
5. Classification logic SHALL live in a single helper, e.g. `classifyDecisionTier(decision, market)` in `src/orchestrator/decisionTier.js`, with unit tests.

### R2 — Log raw GLM-5 output to disk per cycle

**As an** operator,
**I want** to see what GLM-5 actually returned each cycle,
**so that** when confidence drops to 0.25 we can tell whether the model said `25%` (legitimate low confidence) or returned malformed text that defaulted.

**Acceptance**

1. THE `callAgent()` function in `multiAgent.js` SHALL write the raw response text to `src/data/raw_model_outputs/{timestamp}_{agent}.txt` per call (analyst, validator, arbiter).
2. EACH file SHALL contain:
   - Header: `# model={modelId} cycle={cycle_id} timestamp={iso}`
   - Body: raw response text exactly as Bedrock returned it.
3. THE write SHALL NOT block cycle execution — wrap in try/catch, log a warning on failure, do not throw.
4. THE directory SHALL be added to `.gitignore` (no need to publish raw model output) but kept locally for diagnostics.
5. NO secrets, prompt content, or user data SHALL be written to these files. Only the model's response.
6. A small command `npm run inspect:raw -- <pattern>` SHALL exist to grep across these files for a substring (e.g., `npm run inspect:raw -- "confidence: 25"` to count percent-format responses).

### R3 — Parse-failure counter exposed via /api/health

**As a** dashboard,
**I want** to know how often the parser falls back to YAML / DEFAULT_CONFIDENCE_FALLBACK,
**so that** "model healthy" can be a real indicator.

**Acceptance**

1. THE `callAgent()` function SHALL increment a counter when:
   - JSON.parse fails AND
   - YAML fallback parser succeeds.
2. THE same function SHALL increment a separate counter when:
   - Both JSON and YAML fail (true parse failure).
3. Counters SHALL be persisted to `src/data/parse_metrics.json` with daily reset.
4. `/api/health` SHALL include in its response:
   - `parseSuccessRate24h: number 0-1` — `(jsonOk + yamlOk) / total` over rolling 24h.
   - `parseFailureCount24h: number` — count of complete failures.
5. THE existing `cyclesSucceeded24h` field stays separate — that is "cycles completed end-to-end", different from "model output parsed cleanly".

### R4 — Distinguish "low-confidence-25" from "fallback-50"

**As an** auditor,
**I want** to know whether a 0.25 confidence is the model's actual stated confidence or a percent-format normalization,
**so that** outcomes statistics aren't double-counted as broken.

**Acceptance**

1. THE `normalizeAnalystResponse()` function SHALL track which path produced the final `confidence`:
   - `path: 'native_unit'` — model returned 0.0–1.0 directly, no scaling.
   - `path: 'percent_scaled'` — model returned >1 and ≤100, divided by 100.
   - `path: 'fallback_default'` — model returned NaN or missing, used `DEFAULT_CONFIDENCE_FALLBACK`.
2. THE path label SHALL be attached to the analyst decision object (new field `_confidencePath`).
3. THE label SHALL be persisted into `outcomes.json` entries (new field `confidencePath`).
4. Backward-compat: existing entries without the field are treated as `unknown`.

### R5 — Validator response Zod schema and prompt enforcement

**As an** auditor,
**I want** validators to always return structured JSON with a clear `flaggedIssues` field,
**so that** "Trust Firewall" reasoning is actually inspectable.

**Acceptance**

1. THE Validator system prompt SHALL be tightened to demand strict JSON only:
   - Add explicit "If you write any markdown or prose around the JSON, the parser will reject your response and the project will lose data."
   - Lower validator `temperature` to `0.05` (currently 0.1).
2. THE Validator output SHALL pass `ValidatorSchema.safeParse` on first try in ≥ 95% of cycles in a 100-cycle test (not 100% — model variance is real).
3. WHEN parse fails for Validator, THE orchestrator SHALL retry **once** with a stricter system prompt addendum (`"Your previous response was not valid JSON. Reply with ONLY a JSON object."`) before falling back to HOLD.
4. Retry attempts SHALL be logged but SHALL NOT count toward `parseFailureCount`.

### R6 — Re-enable evolved prompts OR remove the claim

**As a** judge reading the agent-card,
**I want** "self-evolving" claims to match runtime,
**so that** ERC-8004 reputation feedback loop is credible.

**Acceptance** (one of two paths; pick during design):

**Path A — re-enable**:
1. Identify the specific format issue evolved prompts caused (probably output structure drift over generations).
2. Add a "format guard" — every evolved prompt is appended with a hard JSON-output suffix that cannot be evolved.
3. Re-enable in `multiAgent.js`: `activeAnalystPrompt = evolved?.analyst ?? ANALYST_SYSTEM_PROMPT`.
4. Run 50-cycle smoke test with evolved prompt active. If parse rate stays above 95%, ship it. If below, revert and go to Path B.

**Path B — formal removal**:
1. Remove the bypass code path; do not load evolved prompts at all.
2. Update `agent-card.json` to reflect static prompt versioning (`systemPrompt.version` becomes a release identifier, not an evolution marker).
3. Remove "self-evolving" language from `README.md`. Replace with "version-pinned with auditable upgrades".
4. Remove "Self-Correcting Loop" claim from any narrative.

### R7 — Disagreement signal logged

**As a** judge,
**I want** to see clear examples of "Analyst said BUY at 80% confidence, Validator said NO with reason X",
**so that** the multi-agent narrative is concrete.

**Acceptance**

1. WHEN `analyst.confidence > 0.6 AND validator.approved === false`, THE orchestrator SHALL set `disagreementSignal: true` on the outcome record.
2. THE outcome record SHALL include `validatorReasoning` (already partly captured — verify it isn't truncated to <80 chars).
3. WHEN `disagreementSignal === true` AND `arbiter` was called, THE arbiter's vote and reasoning SHALL be recorded too.
4. THE Proof Explorer page SHALL display these as a discrete category (UI work — out of scope for this spec; flag the contract surface ready for follow-up).

### R8 — Dynamic threshold transparency

**As a** depositor,
**I want** to know whether the agent is currently in "elevated threshold" mode (after a loss streak),
**so that** I understand why nothing is trading.

**Acceptance**

1. THE `getDynamicConfidenceThreshold()` function SHALL log every invocation result with:
   - `consecutiveLosses: number`
   - `activeThreshold: 0.60 | 0.85`
   - `triggeredAt: ISO timestamp` (only if elevated)
   - `recoveryRule: "1 GOOD_CALL resets to base"` (or whatever the actual rule is)
2. THE current state SHALL be exposed via `/api/health` (`thresholdMode: 'base' | 'elevated'`).
3. WHEN elevated, THE dashboard SHALL show a small badge in the Agent Performance section: `Threshold: ELEVATED · X consecutive losses`.

### R9 — Outcomes.json schema migration

**As a** developer adding new fields,
**I want** outcomes.json to have a versioned schema,
**so that** I don't break the consumers when fields are added.

**Acceptance**

1. THE outcomes.json file SHALL gain a top-level field `schemaVersion: 2`.
2. THE migration SHALL be backward-compatible — entries without `decisionTier` etc. are still readable; new fields default to `null` or `'unknown'`.
3. `/api/performance` SHALL aggregate by `decisionTier` if available (count `EXECUTED_SWAP` separately from `BLOCKED_BY_*`); fall back to old logic if not.
4. Old entries (decisions 1-37 already in the file) SHALL be retro-tagged with best-effort `decisionTier` based on their existing fields:
   - If `consensus === true` AND `action === 'swap'` → `EXECUTED_SWAP` (note: with current code, swaps never actually execute — see Out-of-scope; treat as logical not literal)
   - If `consensus === false` AND `confidence < 0.60` → `BLOCKED_BY_LOW_CONFIDENCE`
   - If `consensus === false` AND `confidence >= 0.60` → `BLOCKED_BY_VALIDATOR` (best guess)
   - If `consensus === true` AND `action === 'hold'` → `BLOCKED_BY_REGIME`
5. Migration script SHALL be one-time, idempotent, and committed as `scripts/migrate-outcomes-v2.js` — runnable via `npm run migrate:outcomes`.

### R10 — Smoke test before shipping

**As a** developer,
**I want** to run a 5-cycle smoke test in dry-run mode before declaring the spec done,
**so that** changes don't regress on real model behavior.

**Acceptance**

1. THE smoke test SHALL:
   - Run 5 multiAgentLoop cycles in DRY_RUN mode (no on-chain TX, no IPFS pin, no real swaps).
   - Capture `decisionTier` distribution.
   - Verify all 5 outcomes have a non-null `decisionTier`.
   - Verify `_confidencePath` is captured for at least 3 cycles (some cycles may parse-fail; that's fine).
   - Verify parse_metrics.json gained 5 entries.
2. THE smoke test SHALL be runnable via `npm run smoke:reasoning`.
3. Documentation SHALL describe how to read the output.

## Non-Functional Requirements

### NFR1 — No on-chain schema changes

This spec adds metadata to `reasoning` text of `DecisionLog.logDecision()` calls but does NOT alter the contract function signatures or storage layout. Existing 97 on-chain decisions remain valid; new ones gain richer reasoning text.

### NFR2 — Backward compatibility

All API responses gain new fields rather than mutating existing ones. Frontend continues to work without immediate updates (it'll just ignore the new fields until separately wired up).

### NFR3 — No new model providers

This spec works strictly within GLM-5 / Claude / Gemini already configured. Adding a fourth model is a separate decision (and would change the partnership story). If GLM-5 stability is poor, the design will offer Path B (drop GLM-5, use Claude as analyst) as a discussed alternative — but only with explicit operator approval.

### NFR4 — Decisions remain auditable

Every classification decision (decisionTier, confidencePath) SHALL be reproducible from the inputs. No persistent random state. A reviewer running the same `multiAgent.js` against a saved market snapshot should get the same `decisionTier`.

### NFR5 — Performance budget

Adding raw-output logging adds a few KB per cycle; daily volume ≈ 288 cycles × 3 agents × ~5 KB = 4 MB/day. Acceptable. Logs auto-rotate after 7 days (cleanup script).

## Success Criteria

This spec is considered done when:

1. A judge clicking through the Proof Explorer can read, for any given decision, **why** consensus failed (specific tier).
2. Run a 50-cycle smoke test:
   - At least 5% `EXECUTED_SWAP` (real swaps, not dry-run — see scope on `continuous-cron-and-health` for cron).
   - Parse success rate ≥ 95%.
   - At least one `disagreementSignal: true` recorded with full validator reasoning.
3. `agent-card.json` matches runtime reality — either `version` says `static-pinned-3.0.0` (Path B) or evolved prompts are loaded from IPFS (Path A) verifiably.
4. `outcomes.json schemaVersion: 2` with all entries tier-classified.
5. Lint and tests pass; smoke test passes.

## Open Questions

1. **Path A vs Path B for evolved prompts** — needs a 30-min diagnostic on what the format issue actually was. Recommendation: try Path A for half a day; if parse rate stays poor, fall back to Path B and update narrative.
2. **Should we drop GLM-5 entirely if its parse rate is < 80%?** — high-stakes choice; affects Z.ai talking point. Recommendation: keep GLM-5 unless parse rate is < 60% (genuinely unusable). Below that, Claude as Analyst, GLM-5 as Arbiter or removed.
3. **Do we want decision tiers on-chain in a structured way (event arg, not embedded text)?** — would require new `DecisionLog.logDecisionV2()` function or contract upgrade. Recommendation: NO for hackathon. Keep as text suffix; richer schema is roadmap.
4. **Retroactive tier classification for old entries: best-effort or skip?** — recommendation: best-effort but mark `tierSource: 'inferred'` so future analysis can filter.
5. **Parse failures: hard pause vs continue with HOLD?** — currently the latter. Recommendation: keep — pausing the cycle on first parse fail loses an on-chain audit entry, which is worse than a forced HOLD.

## Dependencies

- None on contracts (no redeploy).
- None on `ui-honesty-pass` shipping (already shipped).
- Soft dependency: `continuous-cron-and-health` will benefit from `parseSuccessRate24h` field but doesn't gate on it.

## Risks

- **R-A**: Re-enabling evolved prompts (Path A) could break parse rate further. Mitigation: smoke test gates the PR.
- **R-B**: Renaming/restructuring `outcomes.json` could break `outcomeTracker.settle()` logic. Mitigation: schemaVersion field + migration script is idempotent and tested separately.
- **R-C**: Counter persistence (`parse_metrics.json`) introduces a new file write per cycle — possible race with concurrent runs. Mitigation: small file, atomic rename pattern, single instance assumption (cron runs sequentially).
- **R-D**: Retro-tagging old entries with inferred tiers could be misleading if my heuristics are off. Mitigation: `tierSource: 'inferred'` flag + explicit footnote on dashboard when displaying inferred tiers.
- **R-E**: Lower temperature on Validator could miss edge cases (less creative skepticism). Mitigation: 0.05 is still nonzero; if the model becomes too rigid, raise to 0.08 in a follow-up.
