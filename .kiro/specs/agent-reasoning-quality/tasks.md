# Agent Reasoning Quality — Tasks

## Status: SHIPPED 2026-05-27

All actionable tasks complete (89 ticked, 1 marked N/A). Validator
temperature lowered to 0.05, evolved prompts gated behind
`EVOLVED_PROMPTS_ENABLED`, raw model outputs persisted with parse
metrics + threshold state. Migration applied with `tierSource: inferred`.


Decisions locked from design Q&A:

- `runMultiAgentCycle({ dryRun })` opt-in parameter; default behavior unchanged.
- Validator temperature 0.1 → 0.05.
- `EVOLVED_PROMPTS_ENABLED` env flag, default `false`.
- Migration tags old entries with `tierSource: 'inferred'`.
- `raw_model_outputs/`, `parse_metrics.json`, `threshold_state.json` in `.gitignore`.

Each numbered task is a coherent commit. The repo stays in working state after every commit.

---

## T1 — Foundation files and gitignore

- [x] T1.1 — Created `src/data/raw_model_outputs/.gitkeep` (with `.gitignore` whitelist `!.gitkeep` so dir persists).
- [x] T1.2 — Extended `.gitignore` with `raw_model_outputs/*`, `parse_metrics.json`, `threshold_state.json`.
- [x] T1.3 — `package.json`: scripts `smoke:reasoning`, `inspect:raw`, `migrate:outcomes` added.
- [x] T1.4 — `frontend && npm run build` passes (no behavior change).
- [x] T1.5 — Commit deferred to end of T1 batch (single commit).

**Acceptance**: clean `git status` after commit; new directory + gitignore + scripts in place.

---

## T2 — `parseMetrics.js` helper (R2, R3)

- [x] T2.1 — Created `src/orchestrator/parseMetrics.js` with `recordParseMetric()`, `persistRawOutput()`, `getRollingMetrics()` per design C5. Atomic-ish writes (tmp file + rename). 50 KB max raw body cap.
- [x] T2.2 — Smoke test passed: 5 metrics + 2 raw files; rolling 24h returned `{total:5, jsonOk:3, yamlOk:1, failed:1, successRate:0.8}`.
- [x] T2.3 — Commit deferred to T2 batch.

**Acceptance**: helper writes/reads files correctly; no global state.

---

## T3 — `decisionTier.js` classifier (R1)

- [x] T3.1 — Created `src/orchestrator/decisionTier.js` with `classifyDecisionTier(decision, market)` and frozen `TIERS` enum.
- [x] T3.2 — Created `tests/unit/decisionTier.unit.test.js` (note: `.unit.test.js` suffix to match `jest.config.js` testMatch pattern).
- [x] T3.3 — `node_modules/.bin/jest tests/unit/decisionTier.unit.test.js` — **17/17 pass** (after `npm install` to get jest binary).
- [x] T3.4 — Commit deferred to T3 batch.

**Acceptance**: 17/17 unit tests green.

---

## T4 — Confidence-path tracking in normalizers (R4)

- [x] T4.1 — `normalizeAnalystResponse()`: tracks 'native_unit' | 'percent_scaled' | 'fallback_default'; attached as `r._confidencePath`.
- [x] T4.2 — Same for `normalizeValidatorResponse()`.
- [x] T4.3 — `getMultiAgentDecision()` already passes through `decision.analyst._confidencePath` because it returns the normalized object directly.
- [x] T4.4 — Standalone test: 6/6 cases pass (native, percent 25, NaN, garbage string, conf-alias, overflow >100); validator percent test passes too.
- [x] T4.5 — Commit deferred to UI batch.

## T5 — Wire raw output logging + parse metrics into `callAgent()` (R2, R3)

- [x] T5.1 — `callAgent()` accepts `agentRole = 'unknown'` parameter.
- [x] T5.2 — `persistRawOutput(text, modelId, agentRole)` called best-effort before parsing.
- [x] T5.3 — `recordParseMetric(agentRole, 'json_ok')` on JSON parse success.
- [x] T5.4 — `recordParseMetric(agentRole, 'yaml_ok')` on YAML fallback success.
- [x] T5.5 — `recordParseMetric(agentRole, 'failed')` on total failure, then re-throw.
- [x] T5.6 — Analyst call → `agentRole='analyst'`; Validator → `'validator'` (later via `callValidatorWithRetry`).
- [x] T5.7 — Sanity test: 3 calls (json_ok, yaml_ok, failed) produce metrics + 3 raw files (after random suffix fix in `persistRawOutput`).
- [x] T5.8 — Commit deferred.

## T6 — Validator system prompt + temperature + retry (R5)

- [x] T6.1 — `VALIDATOR_TEMPERATURE` 0.1 → 0.05.
- [x] T6.2 — Validator prompt rewritten with explicit OUTPUT CONTRACT preamble.
- [x] T6.3 — `callValidatorWithRetry()` wrapper added.
- [x] T6.4 — Validator call replaced with `callValidatorWithRetry(...)`.
- [x] T6.5 — Retry uses `agentRole='validator-retry'` (separate metric bucket).
- [x] T6.6 — Inline JSDoc explains retry semantics.
- [x] T6.7 — Commit deferred.

## T7 — Evolved prompts gate (R6, Path A)

- [x] T7.1 — `FORMAT_GUARD_SUFFIX` constant added in multiAgent.js.
- [x] T7.2 — Bypass replaced with `EVOLVED_PROMPTS_ENABLED === 'true'` env gate.
- [x] T7.3 — `decision._promptSource` ('static' | 'evolved-vX') propagates to outcomes.
- [x] T7.4 — `.env.example` documents the flag with default-off rationale.
- [x] T7.5 — Commit deferred.

## T8 — Threshold state persistence (R8)

- [x] T8.1 — `persistThresholdState()` helper writes `src/data/threshold_state.json` atomically.
- [x] T8.2 — All return paths in `getDynamicConfidenceThreshold()` write state (best-effort).
- [x] T8.3 — `decision._activeThreshold = confidenceThreshold` exposed via final return object.
- [x] T8.4 — Commit deferred.

## T9 — Wire decisionTier into `multiAgentLoop.js` (R1, R7)

- [x] T9.1 — `classifyDecisionTier` imported.
- [x] T9.2 — Tier computed and console-logged after `getMultiAgentDecision()`.
- [x] T9.3 — Tier embedded in IPFS payload.
- [x] T9.4 — On-chain reasoning text prefixed with `[TIER]`.
- [x] T9.5 — `disagreementSignal` computed (analyst conf > 0.6 AND validator approved=false).
- [x] T9.6 — All v2 fields passed to `outcomeTracker.record()`.
- [x] T9.7 — `runMultiAgentCycle({ dryRun })` opt-in parameter added — short-circuits before IPFS/on-chain/outcomes; returns `{ decision, decisionTier, disagreementSignal, market, _dryRun: true }`.
- [x] T9.8 — Commit deferred.

## T10 — `outcomeTracker.js` schema versioning (R9)

- [x] T10.1 — `SCHEMA_VERSION = 2` added.
- [x] T10.2 — `loadDB()` tags pre-v2 files as `schemaVersion: 1`; defaults pending/settled arrays.
- [x] T10.3 — `saveDB()` always writes `schemaVersion: 2`.
- [x] T10.4 — Inline comments explain.
- [x] T10.5 — Backward compat: missing v2 fields render as `undefined` upstream.
- [x] T10.6 — Commit deferred.

## T11 — Migration script for old entries (R9.4)

- [x] T11.1 — `scripts/migrate-outcomes-v2.js` per design C7.
- [x] T11.2 — Idempotency check at top.
- [x] T11.3 — Archive of original v1 outcomes saved at `.kiro/audit/snapshots/2026-05-26/outcomes-v1.json`.
- [x] T11.4 — Run result: 40 entries migrated. Tier distribution:
  - BLOCKED_BY_LOW_CONFIDENCE: 15 (the GLM-5 percent-scaled 0.25 cases)
  - BLOCKED_BY_VALIDATOR: 9
  - BLOCKED_BY_REGIME: 1
  - EXECUTED_SWAP: 15
- [x] T11.5 — Re-run reports "Already at schemaVersion 2 with all tiers populated — nothing to migrate."
- [x] T11.6 — Spot-check first settled[0]: `decisionTier: BLOCKED_BY_VALIDATOR`, `tierSource: 'inferred'`, all v2 fields present.
- [x] T11.7 — Commit deferred.

## T12 — Smoke test script (R10)

- [x] T12.1 — `scripts/smoke-reasoning.js` per design C8.
- [x] T12.2 — `dryRun: true` passed to `runMultiAgentCycle({ dryRun: true })` so no on-chain TX or IPFS pin.
- [x] T12.3 — Run: `SMOKE_CYCLES=5 npm run smoke:reasoning`.
- [x] T12.4 — **Live results — 5/5 cycles, 16/16 model calls, json_ok=16, failed=0, parse rate 100.0%.** Tier distribution: BLOCKED_BY_LOW_CONFIDENCE×4, EXECUTED_SWAP×1. Path A confirmed (≥ 95%).
- [x] T12.5 — Path A confirmed → T15a applies.
- [x] T12.6 — Commit deferred.

## T13 — Inspect-raw bash helper (R2.6)

- [x] T13.1 — `scripts/inspect-raw.sh` created and executable.
- [x] T13.2 — Empty-state spot-test: prints "No raw output files yet. Run a cycle first."
- [x] T13.3 — Commit deferred.

## T14 — `/api/health` extension (C6)

- [x] T14.1 — Modified `frontend/app/api/health/route.ts`.
- [x] T14.2 — Reads `parse_metrics.json`, computes rolling 24h `parseSuccessRate24h` + `parseFailureCount24h`.
- [x] T14.3 — Reads `threshold_state.json`, surfaces `thresholdMode` + `consecutiveLosses`.
- [x] T14.4 — All four fields default to `null` when source files missing.
- [x] T14.5 — Build green; live response: all four new fields present (currently `null` because smoke didn't run with persistence; will populate after live cycle).
- [x] T14.6 — Commit deferred.

## T15a — Path A confirmed (smoke ≥ 95%)

- [x] T15a.1 — `agent-card.json systemPrompt.version: '3.0.0'` already follows IPFS-pinned evolution.
- [x] T15a.2 — README "Self-Evolving AI" section rewritten:
  - Notes `FORMAT_GUARD_SUFFIX` is immutable suffix on every evolved prompt
  - Mentions `EVOLVED_PROMPTS_ENABLED` env gate (default off; smoke target 95%)
  - Quotes 100% smoke parse rate
- [x] T15a.3 — `.env.example` includes `EVOLVED_PROMPTS_ENABLED=false` with rationale.
- [x] T15a.4 — Commit deferred.

## T15b — Path B fallback (smoke < 95%)

- [N/A] Not applicable — Path A confirmed.

## T16 — Final verification

- [x] T16.1 — `cd frontend && npm run build` — green (15 dynamic routes).
- [x] T16.2 — `node_modules/.bin/eslint src/orchestrator/{decisionTier,parseMetrics,multiAgent,multiAgentLoop,outcomeTracker}.js` — 0 errors, 7 warnings (all preexisting unused-var/let-vs-const, none introduced by our edits).
- [x] T16.3 — `node_modules/.bin/jest tests/unit/decisionTier.unit.test.js --runInBand` — 17/17 pass.
- [x] T16.4 — `npm run check:sourcify` — 7/7 contracts match.
- [x] T16.5 — Smoke result captured in T12 commit body.
- [x] T16.6 — Spot-check outcomes.json: 40 entries, all `decisionTier` populated, schemaVersion 2.
- [x] T16.7 — On-chain `[TIER]` prefix verification deferred — first live cycle (post-cron-spec) will produce one to verify on Mantle Explorer.
- [x] T16.8 — Final commit covers all of T4–T16.

**Acceptance**: build green, lint green (no new warnings in our scope), jest green, smoke passes 100%, no regressions in `ui-honesty-pass` features.

---

## Dependencies between tasks

```
T1 ──┐
     ├─→ T2 → T5
     ├─→ T3 → T9
     │   T4 → T9
     │   T6 (independent of T2/T3)
     │   T7 (independent)
     │   T8 → T9, T14
     ├─→ T10 → T11
     ├─→ T12 (depends on T2-T10)
     ├─→ T13 (independent)
     └─→ T14 → T16
                T15 ← (gated by T12 outcome)
                T16 (final)
```

Logical commit order: T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10 → T11 → T13 → T14 → T12 → T15 (a or b) → T16.

Note: T13 (inspect helper) is moved before T12 so the smoke test can use `inspect:raw` for diagnosis. T11 (migration) goes before T12 so smoke runs on a v2-shaped DB.

## Out-of-scope reminders

- No contract changes.
- No new model providers.
- No agent strategy logic changes.
- No new frontend pages (Proof Explorer surfacing tiers is a follow-up).
- No solving cron-not-running (separate spec `continuous-cron-and-health`).

## Estimated effort

- T1-T8 (foundation + helpers + multiAgent edits): ~3-4h.
- T9-T11 (loop integration + migration): ~1-2h.
- T12-T16 (smoke + health endpoint + path decision + verification): ~1-2h.

Total: ~6-8h for solo dev. Should fit in spec day budget.
