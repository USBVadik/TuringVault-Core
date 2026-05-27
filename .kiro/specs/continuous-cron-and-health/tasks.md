# Continuous Cron + Health — Tasks

## Status: SHIPPED 2026-05-27

All 13 top-level tasks (T1–T13) complete. Cron has run 114+ cycles
hourly via GitHub Actions. `/api/health` live, runbook published,
mascot turns green/red honestly based on freshness. Acceptance
sub-checkboxes inside each T# block are checklists, not separate tasks.


Sequenced execution plan for the design in `design.md`. Each task lists
its requirement reference (R# from `requirements.md`) and component
reference (C# from `design.md`). Tick `[x]` as you go.

**Test gate before merge:** All tasks T1–T9 must be done; T10 is the
commit/push step. T11–T13 are post-merge live verification on Vercel.

---

## T1 — Document the GitHub Actions secrets list (operator runbook stub)

- **Refs:** R1.5, R7
- **Why first:** the operator must know exactly which secrets to paste
  into GH before any workflow run can succeed; no point in building the
  workflow if the secrets dance is unclear.
- **Output:** `.kiro/runbooks/cron-operations.md` initial draft with
  section 1 ("First-time setup — GitHub Actions secrets") complete.
  Other sections can be stubs for now; T6 fills them in.
- **Acceptance:**
  - [ ] Lists every secret name from R1.5 (PRIVATE*KEY, AWS*_, NANSEN*API_KEY,
        PINATA*_, MANTLE_RPC_URL, GEMINI_PROJECT_ID,
        GOOGLE_APPLICATION_CREDENTIALS_JSON).
  - [ ] For each: where to get its value, how to paste it, what format.
  - [ ] Special note for `GOOGLE_APPLICATION_CREDENTIALS_JSON` (paste
        whole JSON file content as the secret value, including
        `private_key` newline characters).

## T2 — Create the workflow YAML

- **Refs:** R1, R6, NFR1
- **File:** `.github/workflows/agent-cycle.yml` (NEW)
- **Body:** Use C1 verbatim. Verify `permissions.contents: write` is
  present, `concurrency` group is named `agent-cycle`, schedule is
  `'0 * * * *'`, and `workflow_dispatch:` is enabled.
- **Acceptance:**
  - [ ] File exists and parses (YAML lint clean).
  - [ ] All env mappings reference `${{ secrets.* }}`, not hardcoded
        values. No echo of secrets in any step.
  - [ ] `timeout-minutes: 8` on job + `timeout 300` on the node call.
  - [ ] Final commit step uses author `TuringVault Cron <cron@turingvault.ai>`.
  - [ ] Push retry uses `git pull --rebase --autostash` once.

## T3 — Create the cycle runner script

- **Refs:** R3, R6, R9, NFR2, R-C
- **File:** `scripts/run-cycle.js` (NEW)
- **Body:** Use C2 verbatim, with one correction: capture
  `decisionId` from `result.proposalId` (number) once T4 lands. The
  function will already return that field after T4.
- **Acceptance:**
  - [ ] `node scripts/run-cycle.js` works when run locally with `.env`
        loaded (will hit Bedrock — only run once for verification, not
        in CI).
  - [ ] Writes `data/last-cycle-summary.json` with the schema from C5.
  - [ ] Writes `data/cycle-history.json` with last-N-rolling shape.
  - [ ] Writes `data/cycle-failures.json` only on error path.
  - [ ] Validates state files; exits `2` on JSON corruption, `0`
        otherwise.
  - [ ] No `console.log` of env values, no print of `process.env`.

## T4 — Patch `runMultiAgentCycle` return shape

- **Refs:** C3
- **File:** `src/orchestrator/multiAgentLoop.js` (MODIFY)
- **Change:** at end of function, replace `return decision;` with the
  unified shape:

  ```javascript
  return {
    decision,
    decisionTier,
    disagreementSignal,
    consensus: decision.consensus,
    proposalId:
      typeof proposalId === "bigint" ? Number(proposalId) : proposalId,
  };
  ```

  The dryRun branch already returns a similar shape (lines 95-103);
  align field names so callers can use the same accessors regardless
  of dryRun. `decision.consensus` is preserved at the top level so
  `mainMultiAgent.js` and `runBatch.js` (which read `result.consensus`)
  keep working.

- **Acceptance:**
  - [ ] Return shape unified between dryRun and live paths.
  - [ ] `mainMultiAgent.js` continues to work (`result.consensus`).
  - [ ] `runBatch.js` continues to work (`result.consensus`).
  - [ ] `scripts/smoke-reasoning.js` continues to work (`out.decisionTier`,
        `out.decision?.analyst`, `out.disagreementSignal`).
  - [ ] No new fields leak environment variables or secret-bearing data.

## T5 — Extend `/api/health` route

- **Refs:** R4, R8
- **File:** `frontend/app/api/health/route.ts` (MODIFY)
- **Changes:**
  1. Read `data/last-cycle-summary.json` → `lastCycleSummary` field.
  2. Read `data/cycle-history.json` → take last 5 → `runHistory` field.
  3. Read `data/cycle-failures.json` → count entries within 24 h →
     `cyclesFailed24h` field (was `null`).
  4. Update `HealthResponse` type with the three new optional fields.
- **Acceptance:**
  - [ ] Three new fields appear in JSON output.
  - [ ] Endpoint still HTTP 200 when source files are missing.
  - [ ] No secret leaks (verify via `grep -i 'AWS\|PINATA\|PRIVATE\|JWT\|secret' route.ts`).
  - [ ] Existing fields (`lastCycleAge`, `parseSuccessRate24h`, etc.)
        remain intact.
  - [ ] `npm run build` in `frontend/` passes type-check.

## T6 — Complete the operator runbook

- **Refs:** R7
- **File:** `.kiro/runbooks/cron-operations.md` (FILL OUT)
- **Sections to add to the T1 stub:**
  1. Pause the agent (Actions tab → Workflow → ⋯ → Disable).
  2. Manual trigger (`workflow_dispatch` flow).
  3. Reading logs (URL pattern, common failure signatures).
  4. Soft vs hard failure (definitions; what each looks like in logs).
  5. Recover from stuck nonce (manual TX with same nonce or wait).
  6. Cost monitoring (link to AWS Bedrock dashboard, GH Actions usage
     `https://github.com/USBVadik/TuringVault-Core/actions/usage`).
  7. Disabling Gemini arbiter temporarily (set
     `GOOGLE_APPLICATION_CREDENTIALS_JSON` secret to empty; arbiter
     falls back to conservative-block).
- **Acceptance:**
  - [ ] All 8 sections (1 from T1 + 7 here) present and complete.
  - [ ] Anyone unfamiliar with the spec can read it and pause/resume
        the agent in < 30 s.
  - [ ] Linked from README "Running" section (T7).

## T7 — Update README "Running" section

- **Refs:** R7
- **File:** `README.md` (MODIFY)
- **Change:** add to the existing "Running" section a paragraph
  explaining that production is a GitHub Actions cron firing every
  hour, with link to the workflow file and the runbook. Keep honest:
  "Hourly cycles, public log at <URL>" — not "running 24/7".
- **Acceptance:**
  - [ ] No copy claims sub-hour cadence or "always-on".
  - [ ] Links to `.github/workflows/agent-cycle.yml` and
        `.kiro/runbooks/cron-operations.md`.
  - [ ] Honesty rule (`no-lying-about-state.md`) compliance preserved.

## T8 — First manual workflow_dispatch test

- **Refs:** R1, R2, R3, R5
- **Action (operator-side, not code):**
  1. Push branch with T1–T7 to `main`.
  2. Operator creates the GitHub Actions secrets per T1 runbook.
  3. Operator triggers the workflow manually from the Actions tab.
  4. Watch logs.
- **Acceptance:**
  - [ ] Workflow exits 0.
  - [ ] `data/last-cycle-summary.json` is committed back to `main`
        within ~5 min.
  - [ ] `data/cycle-history.json` exists with 1 entry.
  - [ ] No secret values in workflow logs (manual scan + test for
        `[ -z "${{ secrets.X }}" ]` patterns left intact).

## T9 — Verify mascot turns 🟢 within 2 minutes

- **Refs:** R5, Success Criteria #1, #2, #5
- **Action:**
  1. Wait for Vercel auto-deploy (~60–90 s).
  2. Open `https://frontend-seven-beta-46.vercel.app`.
  3. Check `/api/health` shows `lastCycleAge < 600` and
     `mode: "cron-github-actions"`.
  4. Verify mascot displays 🟢 and "LIVE" status.
- **Acceptance:**
  - [ ] `/api/health.lastCycleAge` < 3700 (well under the 1-hour
        mascot threshold).
  - [ ] `/api/health.mode` = `cron-github-actions`.
  - [ ] `/api/health.parseSuccessRate24h` is a real number (≥ 0.9
        based on smoke results).
  - [ ] Mascot renders 🟢 ACTIVE in production.

## T10 — Wait for first scheduled run (cron path)

- **Refs:** R1.1, Success Criteria #1
- **Action:** wait until the top of the next hour after T8 lands.
  Watch the Actions tab for an automatic run trigger.
- **Acceptance:**
  - [ ] Scheduled run fires within 15 min of `:00` past the hour
        (free-tier drift acceptable).
  - [ ] Run exits 0.
  - [ ] State files committed back as in T8.
  - [ ] `cycle-history.json` now has at least 2 entries.

## T11 — Disable + re-enable test (mascot honesty round-trip)

- **Refs:** R5, R8, Test plan §4–5
- **Action:**
  1. Disable workflow via GitHub UI.
  2. Wait > 60 min.
  3. Verify mascot turns 🟡 IDLE (not still 🟢).
  4. Re-enable + manual trigger; verify mascot returns to 🟢.
- **Acceptance:**
  - [ ] Mascot reflects reality both ways without UI edits.
  - [ ] No copy on the dashboard says "running 24/7" while paused.

## T12 — Document cost burn after 24 h of live operation

- **Refs:** R6, NFR1, Success Criteria #7
- **Action:** after first 24 h on schedule, record:
  - GH Actions minutes consumed (Settings → Billing).
  - AWS Bedrock spend (CloudWatch console → InvokeModel).
  - Cycle count (Actions tab).
  - Any soft/hard failures.
    Add a small line to the runbook: "Observed burn rate <date>: X GH
    min/day, $Y Bedrock/day, Z cycles."
- **Acceptance:**
  - [ ] Runbook has a "Observed costs" subsection with one data point.
  - [ ] AWS Bedrock spend rate ≤ $5/day per Success Criteria #7.

## T13 — Final spec close-out

- **Refs:** all
- **Action:** mark all `[ ]` boxes in this file. Tick the success
  criteria in `requirements.md` "Success Criteria" by adding a checked
  list at bottom. Move the spec under a "shipped" header in any
  tracker if applicable.
- **Acceptance:**
  - [ ] Every task checkbox in this file is `[x]`.
  - [ ] Success Criteria 1–8 in `requirements.md` all met.

---

## Out of scope reminder

These are explicitly NOT in this spec (have their own future specs):

- `rwa-allocation-active` — get the agent to actually swap RWA assets.
- `discipline-layer-ui` — surface Discipline Layer status on the UI.
- `human-vs-ai-challenge-v2` — populate the `/challenge` page.
- Vercel Cron path / VPS deployment.
- Backfilling missed cycles between 23 May and the first scheduled
  run.
