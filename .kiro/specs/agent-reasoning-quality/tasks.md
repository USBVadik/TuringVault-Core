# Agent Reasoning Quality — Tasks

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

- [ ] T4.1 — Modify `normalizeAnalystResponse()` in `multiAgent.js`: track `path` ('native_unit' | 'percent_scaled' | 'fallback_default'); attach as `r._confidencePath`.
- [ ] T4.2 — Same for `normalizeValidatorResponse()`.
- [ ] T4.3 — Verify `getMultiAgentDecision()` propagates `_confidencePath` upward via `decision.analyst._confidencePath` and `decision.validator._confidencePath`.
- [ ] T4.4 — Quick standalone test: feed normalizer a mock `{ confidence: 25 }` → expect `_confidencePath === 'percent_scaled'`. Feed `{ confidence: NaN }` → `'fallback_default'`. Feed `{ confidence: 0.7 }` → `'native_unit'`.
- [ ] T4.5 — Commit: `feat(reasoning): track confidencePath through normalizers (R4)`.

**Acceptance**: 3/3 path branches verified.

---

## T5 — Wire raw output logging + parse metrics into `callAgent()` (R2, R3)

- [ ] T5.1 — Modify `callAgent()` in `multiAgent.js` to accept new optional `agentRole` parameter ('analyst' | 'validator' | 'arbiter').
- [ ] T5.2 — On entry: try/catch `persistRawOutput(text, modelId, agentRole)` — non-fatal.
- [ ] T5.3 — On JSON parse success: `recordParseMetric(agentRole, 'json_ok')`.
- [ ] T5.4 — On YAML fallback success: `recordParseMetric(agentRole, 'yaml_ok')`.
- [ ] T5.5 — On total failure: `recordParseMetric(agentRole, 'failed')` then re-throw.
- [ ] T5.6 — Update all `callAgent()` invocations to pass appropriate `agentRole`.
- [ ] T5.7 — Local sanity: run a single live cycle (or dry-run smoke) and verify `src/data/raw_model_outputs/` contains 2-3 files and `parse_metrics.json` has counters.
- [ ] T5.8 — Commit: `feat(reasoning): persist raw outputs + parse metrics in callAgent (R2,R3)`.

**Acceptance**: after one cycle, both files exist; counts match number of model calls.

---

## T6 — Validator system prompt + temperature + retry (R5)

- [ ] T6.1 — Update `VALIDATOR_TEMPERATURE` constant in `src/config/constants.js`: `0.1` → `0.05`.
- [ ] T6.2 — Replace VALIDATOR_SYSTEM_PROMPT preamble in `multiAgent.js` with the strict OUTPUT CONTRACT block per design C2.3.
- [ ] T6.3 — Implement `callValidatorWithRetry()` wrapper in `multiAgent.js`.
- [ ] T6.4 — Replace the validator `callAgent()` invocation with `callValidatorWithRetry()`.
- [ ] T6.5 — Make sure the retry uses `agentRole='validator-retry'` so its parse stats are tracked separately (and don't pollute first-attempt parse rate).
- [ ] T6.6 — Document the retry behavior in code comments.
- [ ] T6.7 — Commit: `feat(reasoning): tighter validator prompt + temperature + 1-retry on parse fail (R5)`.

**Acceptance**: validator JSON parse rate target ≥ 95% on 5-cycle smoke (verify in T11).

---

## T7 — Evolved prompts gate (R6, Path A)

- [ ] T7.1 — Add `FORMAT_GUARD_SUFFIX` constant in `multiAgent.js` per design C2.4.
- [ ] T7.2 — Replace the bypass code with env-flag gated load: `EVOLVED_PROMPTS_ENABLED === 'true'`.
- [ ] T7.3 — Set `decision._promptSource` ('static' | 'evolved-vX.Y.Z') so it propagates to outcomes.
- [ ] T7.4 — Add `EVOLVED_PROMPTS_ENABLED` to `.env.example` with comment explaining default `false` and how to opt in.
- [ ] T7.5 — Commit: `feat(reasoning): evolved prompts gate behind EVOLVED_PROMPTS_ENABLED env flag (R6 Path A)`.

**Acceptance**: with flag unset → static prompt as today; with flag `true` and IPFS reachable → evolved prompt + format guard suffix.

---

## T8 — Threshold state persistence (R8)

- [ ] T8.1 — Modify `getDynamicConfidenceThreshold()` in `multiAgent.js` to write `src/data/threshold_state.json` per design C2.5.
- [ ] T8.2 — Wrap write in try/catch — non-fatal.
- [ ] T8.3 — Inject `decision._activeThreshold` into the decision object so `decisionTier.js` can read it.
- [ ] T8.4 — Commit: `feat(reasoning): persist dynamic threshold state for /api/health (R8)`.

**Acceptance**: file appears after first cycle with `consecutiveLosses`, `activeThreshold`, `triggeredAt`, `recoveryRule`.

---

## T9 — Wire decisionTier into `multiAgentLoop.js` (R1, R7)

- [ ] T9.1 — Import `classifyDecisionTier` from `decisionTier.js`.
- [ ] T9.2 — After `getMultiAgentDecision()`, compute `const decisionTier = classifyDecisionTier(decision, market);`. Console log it.
- [ ] T9.3 — Pass `decisionTier` into IPFS payload as `decision.decisionTier`.
- [ ] T9.4 — Prefix on-chain `reasoning` text with `[${decisionTier}]`.
- [ ] T9.5 — Compute `disagreementSignal` per design C3.3.
- [ ] T9.6 — Pass new v2 fields to `outcomeTracker.record()`: `decisionTier`, `tierSource: 'live'`, `confidencePath`, `promptSource`, `disagreementSignal`, `validatorReasoning`, `validatorFlaggedIssues`, `arbiterVote`, `arbiterReasoning`.
- [ ] T9.7 — Optional: add `dryRun` parameter to `runMultiAgentCycle()` to skip on-chain TX + IPFS pin when set. Default `false`. (Used by smoke test in T12.)
- [ ] T9.8 — Commit: `feat(reasoning): tier classification, disagreement signal, dryRun param in main loop (R1,R7)`.

**Acceptance**: a single live cycle produces an outcomes.json entry with all new v2 fields populated.

---

## T10 — `outcomeTracker.js` schema versioning (R9)

- [ ] T10.1 — Add `SCHEMA_VERSION = 2` constant.
- [ ] T10.2 — `loadDB()` tags pre-v2 files as `schemaVersion: 1`.
- [ ] T10.3 — `saveDB()` always writes `schemaVersion: 2`.
- [ ] T10.4 — `record()` JSDoc updated to document new fields.
- [ ] T10.5 — Verify backward-compat: a v1 entry read via `loadDB` is still valid; new v2 fields default to undefined which the frontend handles.
- [ ] T10.6 — Commit: `feat(reasoning): outcomeTracker schemaVersion 2 + new field passthrough (R9)`.

**Acceptance**: outcomes.json after one cycle is `schemaVersion: 2` with at least one v2 entry alongside legacy entries.

---

## T11 — Migration script for old entries (R9.4)

- [ ] T11.1 — Create `scripts/migrate-outcomes-v2.js` per design C7.
- [ ] T11.2 — Idempotency check: returns early if `schemaVersion === 2` AND all entries have `decisionTier`.
- [ ] T11.3 — Snapshot `src/data/outcomes.json` to `.kiro/audit/snapshots/2026-05-26/outcomes-v1.json` before migration runs (preserve forensic copy).
- [ ] T11.4 — Run migration: `node scripts/migrate-outcomes-v2.js`. Verify all 37 settled + 3 pending entries gain `decisionTier` and `tierSource: 'inferred'`.
- [ ] T11.5 — Re-run script — must report "Already at schemaVersion 2" and not re-migrate.
- [ ] T11.6 — Manual sanity check: spot-check 3 random entries to confirm tier inference is reasonable per the heuristic in C7.
- [ ] T11.7 — Commit: `feat(reasoning): migrate outcomes.json to v2 schema with inferred tiers (R9.4)`.

**Acceptance**: outcomes.json has every entry tagged; idempotency confirmed; archive copy preserved.

---

## T12 — Smoke test script (R10)

- [ ] T12.1 — Create `scripts/smoke-reasoning.js` per design C8.
- [ ] T12.2 — Make sure it sets `DRY_RUN=true` in the env BEFORE requiring the orchestrator.
- [ ] T12.3 — Run `npm run smoke:reasoning SMOKE_CYCLES=5`.
- [ ] T12.4 — Capture output. Expected: 5 cycles, ≥ 95% parse rate, tier distribution non-trivial.
- [ ] T12.5 — If parse rate < 95%, document the failure mode and decide: keep `EVOLVED_PROMPTS_ENABLED=false` OR fall back to Path B (drop "self-evolving" claim from agent-card and README — separate task `T15`).
- [ ] T12.6 — Commit: `feat(reasoning): 5-cycle smoke test for parse rate + tier distribution (R10)`.

**Acceptance**: smoke runs end-to-end without crashing; produces a useful summary.

---

## T13 — Inspect-raw bash helper (R2.6)

- [ ] T13.1 — Create `scripts/inspect-raw.sh` per design C9. Make executable.
- [ ] T13.2 — Spot test: `npm run inspect:raw -- "confidence"` → returns matched lines (or "no raw outputs yet" if none).
- [ ] T13.3 — Commit: `chore(reasoning): inspect-raw helper for grep across raw outputs (R2.6)`.

**Acceptance**: script runs both empty-state and populated-state cleanly.

---

## T14 — `/api/health` extension (C6)

- [ ] T14.1 — Modify `frontend/app/api/health/route.ts` per design C6.
- [ ] T14.2 — Read `src/data/parse_metrics.json` (best-effort) → compute `parseSuccessRate24h` + `parseFailureCount24h`.
- [ ] T14.3 — Read `src/data/threshold_state.json` (best-effort) → compute `thresholdMode` + `consecutiveLosses`.
- [ ] T14.4 — Add fields to response (always present, default `null`).
- [ ] T14.5 — Verify build still passes; verify endpoint returns expected shape via dev server.
- [ ] T14.6 — Commit: `feat(api): /api/health surfaces parseSuccessRate24h and thresholdMode (C6)`.

**Acceptance**: `curl localhost:3000/api/health` returns the new fields with correct types.

---

## T15 — Path A/B decision based on smoke results

This task is conditional on T12's outcome. Two branches; pick exactly one.

### T15a — Path A confirmed (smoke ≥ 95%)

- [ ] T15a.1 — Update `assets/agent-card.json`: `systemPrompt.version` follows IPFS-pinned evolution version (it already does).
- [ ] T15a.2 — README: keep "self-evolving prompts" claim; add note "gated by EVOLVED_PROMPTS_ENABLED for stability".
- [ ] T15a.3 — `.env.example` clearly suggests `EVOLVED_PROMPTS_ENABLED=true` for evolved-prompt mode.
- [ ] T15a.4 — Commit: `docs(reasoning): confirm Path A — evolved prompts re-enabled with gate`.

### T15b — Path B fallback (smoke < 95%)

- [ ] T15b.1 — Remove "self-evolving prompts" claim from README. Replace with "version-pinned prompts with auditable upgrades".
- [ ] T15b.2 — Update `assets/agent-card.json`: `systemPrompt.version` becomes a static release tag (`pinned-3.0.0`); document in card description that evolution is NOT live.
- [ ] T15b.3 — Update homepage Evolution Timeline panel copy already added in `ui-honesty-pass` to match new framing.
- [ ] T15b.4 — Commit: `docs(reasoning): adopt Path B — formal removal of self-evolving claim`.

**Acceptance**: exactly one of T15a/T15b ships, justified by T12 smoke results documented in commit body.

---

## T16 — Final verification

- [ ] T16.1 — `cd frontend && npm run build` — green.
- [ ] T16.2 — `npx eslint src/` — no new warnings beyond baseline.
- [ ] T16.3 — `npx jest tests/unit/decisionTier.test.js` — green.
- [ ] T16.4 — `npm run check:sourcify` — still 7/7 match.
- [ ] T16.5 — Run `npm run smoke:reasoning SMOKE_CYCLES=5` once more in clean state. Record results in commit body.
- [ ] T16.6 — Spot-check `outcomes.json`: every entry has `decisionTier`; `schemaVersion` is 2; new entries have `tierSource: 'live'`, old `inferred`.
- [ ] T16.7 — Spot-check on-chain reasoning text on Mantle Explorer for the latest decision: includes `[TIER]` prefix.
- [ ] T16.8 — Commit: `chore(reasoning): verification pass complete; spec done`.

**Acceptance**: build green, lint green, jest green, smoke passes, no regressions in `ui-honesty-pass` features.

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
