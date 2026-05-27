# Continuous Cron + Health — Requirements

## Background

After `ui-honesty-pass` and `agent-reasoning-quality` shipped, the
infrastructure is in place but the agent is still dead. Confirmed by
production:

- `/api/health` returns `lastCycleAge: 240472` (~67 hours since the last
  decision) → the front-end mascot is 🔴 OFFLINE.
- `parseSuccessRate24h: null`, `thresholdMode: null`, `consecutiveLosses: null`
  — the agent-reasoning-quality side-channels exist but stay empty
  because no cycle has run since they were added.
- `data/loop_progress.json` mtime is from 2026-05-20.
- The local `src/cron/agentCron.js` only runs while a terminal is open
  on someone's machine; nobody is keeping it open.

For an AI x RWA Track judge opening the dashboard right now, the system
looks built but inactive. Activating a continuous cycle is the single
biggest credibility move available before the hackathon deadline.

This spec sets up a publicly-observable, free-tier-friendly continuous
loop that:

1. Runs every 60 minutes on a hosted runner.
2. Records each cycle's results back to the repo so the front-end picks
   them up automatically.
3. Surfaces `parseSuccessRate24h`, `thresholdMode`, `consecutiveLosses`
   from real data in `/api/health`.
4. Stays under GitHub Actions free-tier limits and AWS Bedrock cost.
5. Doesn't introduce new live-state lying (steering rule
   `no-lying-about-state.md`).

## Scope

### In scope

- New GitHub Actions workflow `.github/workflows/agent-cycle.yml`.
- A cycle-runner script `scripts/run-cycle.js` that wraps
  `runMultiAgentCycle()` for CI use.
- A commit-back step that pushes updated state files to a long-lived
  branch (decision below).
- A summary writer that creates `data/last-cycle-summary.json` for
  fast `/api/health` reads.
- `/api/health` extension: surface `cyclesFailed24h` (currently `null`)
  and a `runHistory` field listing the last 5 GitHub Action runs.
- Operator runbook `.kiro/runbooks/cron-operations.md` covering: how
  to pause, how to debug a failed run, where to find logs.

### Out of scope

- VPS deployment.
- Vercel Cron (no clean way to trigger on free Vercel tier; also no
  AWS Bedrock access from Vercel functions without exposing creds).
- `rwa-allocation-active` (separate spec).
- Discipline Layer UI (separate spec).
- Vault contract pattern (separate spec).
- Cycle interval below 60 minutes (free-tier sustainability).
- Backfilling missed cycles.

## Stakeholders

- **Hackathon judge** — wants to see a 🟢 LIVE mascot and a fresh
  decision feed without us claiming continuous operation we don't have.
- **Operator (USBVadik)** — needs to be able to pause the agent
  quickly (e.g., before a major market event) and debug failed runs.
- **Sponsor partner reviewers** — Z.ai, Nansen, Tencent — looking at
  the public GitHub Action history as an additional verification surface.

## Glossary

- **Cycle** — one invocation of `runMultiAgentCycle()` against live
  market data, producing one or more decisions and on-chain TXs.
- **State files** — the JSON files written by a cycle that the
  front-end consumes:
  - `src/data/outcomes.json`
  - `src/data/parse_metrics.json`
  - `src/data/threshold_state.json`
  - `src/data/position_state.json`
  - `src/data/grid_bot_state.json`
  - `src/data/grid_param_history.json`
  - `data/loop_progress.json`
  - `data/last-cycle-summary.json` (NEW; small public summary)
- **Run mode** — value of `process.env.AGENT_RUN_MODE` declared by
  the runner; surfaced via `/api/health.mode`. Will be
  `cron-github-actions` after this spec.

## Functional Requirements

### R1 — GitHub Actions cron workflow

**As a** judge,
**I want** to see a public artifact proving the agent runs continuously,
**so that** "running 24/7" is verifiable, not claimed.

**Acceptance**

1. THE workflow `.github/workflows/agent-cycle.yml` SHALL trigger on:
   - `schedule: cron: '0 * * * *'` (every hour, UTC).
   - `workflow_dispatch` (manual trigger for debugging).
2. THE workflow SHALL set `AGENT_RUN_MODE=cron-github-actions`.
3. THE workflow SHALL run on `ubuntu-latest`, Node 22, with `npm ci --legacy-peer-deps`.
4. THE workflow SHALL invoke `node scripts/run-cycle.js` with a 5-minute
   timeout. If the script doesn't return in 5 minutes, the workflow
   fails and the next hour's cron picks up clean.
5. THE workflow SHALL pass these secrets via env from GitHub repo
   secrets (operator configures once):
   - `PRIVATE_KEY`
   - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
   - `NANSEN_API_KEY`
   - `PINATA_JWT`, `PINATA_API_KEY`, `PINATA_SECRET`
   - `MANTLE_RPC_URL`
   - `GEMINI_PROJECT_ID` and `GOOGLE_APPLICATION_CREDENTIALS_JSON` (multi-line key file inline)
6. NO secret SHALL be echoed in workflow logs. The `run-cycle.js`
   script SHALL not print env values.
7. THE workflow SHALL succeed (exit 0) when `runMultiAgentCycle()`
   returns normally OR when it throws a "soft" error (e.g., Bedrock
   rate-limit, RPC blip) — these are tracked but don't fail the run.
   Hard errors (uncaught exception in our code) DO fail the run.
8. THE workflow SHALL commit and push state-file changes back to a
   chosen branch (see R2).

### R2 — Commit-back of state files

**As a** front-end,
**I want** to read fresh state from the repo,
**so that** the dashboard updates automatically without redeploys.

**Acceptance**

1. AFTER a successful cycle, the workflow SHALL `git add` the state
   file list (Glossary), then commit if there are changes.
2. THE commit message SHALL be `chore(cron): cycle <decisionId>
<timestamp> <tier>` so the GitHub history is grep-friendly.
3. THE commit author SHALL be `TuringVault Cron <cron@turingvault.ai>`
   (using a deterministic identity, not the operator's).
4. THE commit SHALL NOT include `src/data/raw_model_outputs/` (those
   are gitignored anyway and would balloon the repo).
5. THE push SHALL go to `main` directly. (We considered a separate
   `data` branch; design picks the simpler path. See decision log.)
6. IF the push fails (rebase needed because main moved during the
   cycle), THE workflow SHALL retry with `git pull --rebase` once,
   then fail cleanly if still conflicting.
7. THE push SHALL not trigger another cron run (we don't want a loop;
   `schedule:` only triggers on cron, not push, so this is automatic
   — but document it).

### R3 — Per-cycle summary file

**As an** `/api/health` endpoint,
**I want** a single small file with the latest cycle's summary,
**so that** I can answer "is the agent alive" without reading every
state file.

**Acceptance**

1. AFTER each cycle, the cycle-runner SHALL write
   `data/last-cycle-summary.json` with:
   ```json
   {
     "cycleStartedAt": "<ISO>",
     "cycleEndedAt": "<ISO>",
     "durationSeconds": <number>,
     "decisionId": <number | null>,
     "decisionTier": "<TIER>",
     "consensus": <bool>,
     "txHashes": ["0x..."],
     "ipfsCid": "<string | null>",
     "mode": "cron-github-actions",
     "githubRunUrl": "<string | null>",
     "errors": ["<short message>"]
   }
   ```
2. THE file SHALL be ≤ 2 KB. No reasoning text, no IPFS payloads.
3. THE file SHALL be human-readable JSON with 2-space indent (helps
   git diff readability).
4. WHEN a cycle errors before completing, the file SHALL still be
   written with `errors[]` populated and `decisionId: null`.

### R4 — `/api/health` extensions

**As a** dashboard,
**I want** richer liveness signals,
**so that** the mascot and live banner can be more informative.

**Acceptance**

1. `/api/health` SHALL include:
   - `cyclesSucceeded24h` (already exists — verify accuracy after
     `data/last-cycle-summary.json` becomes the source of truth)
   - `cyclesFailed24h` (NEW; sourced from a small additive log,
     `data/cycle-failures.json`, written only when a cycle errors)
   - `lastCycleSummary` (NEW; the JSON object from R3, embedded)
   - `runHistory` (NEW; array of last 5 entries from a rolling
     `data/cycle-history.json` log; each entry: `{cycleStartedAt,
decisionTier, durationSeconds}`)
2. WHEN any source file is missing, the corresponding field SHALL
   default to `null` or `[]`. Endpoint returns HTTP 200 still.
3. NO secret-bearing fields (env values, IPFS JWTs, AWS creds) leak
   into the response. Cross-checked via grep before commit.
4. THE existing `mode` field SHALL now reflect `cron-github-actions`
   when the cycle was triggered by the workflow.

### R5 — Frontend mascot + idle banner respond to fresh data

**As a** judge,
**I want** the mascot to turn 🟢 within minutes of the cron firing,
**so that** I can see liveness without refreshing the page repeatedly.

**Acceptance**

1. NO frontend code changes are required for the basic case — the
   existing `RiskMascot` polls `/api/health` every 60 s and derives
   state from `lastCycleAge`. After a successful cron run, Vercel will
   redeploy on push and the next mascot poll picks up the fresh data.
2. **Vercel auto-redeploy on push:** verify in Vercel UI that the
   `main` branch is the production source AND auto-deploy is enabled.
   If currently disabled, enable it.
3. WHEN cron pushes to `main`, Vercel SHALL rebuild within ≤ 90 s and
   the mascot SHALL show 🟢 LIVE within 2 polls (≤ 2 minutes).
4. THE `LiveTerminal` block SHALL automatically pick up new decisions
   from `/api/decisions` on its next 30 s poll.

### R6 — Cost guardrails

**As an** operator,
**I want** the workflow to be observable and bounded in cost,
**so that** I don't drain AWS Bedrock credits or hit GH Actions limits.

**Acceptance**

1. AT 60-min cron interval, expected GH Actions usage:
   - 24 cycles/day × 30 days × ~70 s/cycle = ~840 minutes/month.
   - Free tier: 2000 minutes/month. **Comfortable margin.**
2. AT 60-min cron interval, expected Bedrock usage:
   - 24 cycles/day × 30 days × 2-3 model calls × ~$0.05 ≈ $108-162/month.
   - AWS Activate $10k credits. **Comfortable margin.**
3. THE workflow SHALL include a `concurrency:` group so two scheduled
   runs cannot stack if one is slow.
4. THE workflow SHALL include a hard `MAX_DAILY_CYCLES` check at
   start of each run (already in `agentCron.js` baseline as a
   constant; reuse the value).
5. Operator SHALL be able to disable the workflow via the GitHub UI
   (`.github/workflows/agent-cycle.yml` → Actions tab → Disable
   workflow). Document in runbook.

### R7 — Operator runbook

**As an** operator,
**I want** a one-page reference for cron operations,
**so that** when something fails I know where to look without reading
all the spec markdown.

**Acceptance**

1. `.kiro/runbooks/cron-operations.md` SHALL exist.
2. THE runbook SHALL cover:
   - **How to set GitHub Actions secrets** (one-time setup).
   - **How to pause the agent** (workflow disable; under 30 seconds).
   - **How to manually trigger a cycle** (`workflow_dispatch`).
   - **Where to find logs** (Actions tab; specific URL pattern).
   - **What "soft" vs "hard" failure means**.
   - **How to debug a parse rate drop** (use `npm run inspect:raw`
     locally after pulling — though raw outputs from CI are not
     committed).
   - **How to recover from a stuck nonce** (manual TX with same
     nonce, or wait for it to drop from mempool).
   - **Cost monitoring** (link to AWS Bedrock dashboard, GH Actions
     usage page).

### R8 — Honesty rule compliance

**As a** judge,
**I want** the dashboard to claim only what's true,
**so that** the project doesn't violate `no-lying-about-state.md`.

**Acceptance**

1. WHEN cron is paused (workflow disabled or last run failed), the
   `/api/health.mode` field SHALL still report `cron-github-actions`
   but `lastCycleAge` will reflect reality and the mascot will turn
   🟡 IDLE → 🔴 OFFLINE accordingly. No "we're 24/7" claim shall be
   added to copy.
2. The Demo Mode banner under the header is unchanged ("Demo Mode ·
   No public deposits · Stats below are agent-lifetime aggregate").
3. Submission text on DoraHacks (separate spec) MAY reference
   "continuous operation via GitHub Actions, public log at <URL>" —
   that URL points to the Actions history, which is verifiable.

### R9 — Smoke / dry-run path preserved

**As a** developer,
**I want** the existing dry-run smoke (`npm run smoke:reasoning`) to
keep working,
**so that** I can iterate on agent logic without spending Bedrock.

**Acceptance**

1. The cron-runner SHALL NOT change `runMultiAgentCycle({ dryRun })`
   semantics. It always passes `dryRun: false`.
2. `npm run smoke:reasoning` continues to work unchanged.

## Non-Functional Requirements

### NFR1 — No new on-chain TX patterns

This spec doesn't change which TXs are written, only when. The agent
still writes 4 TXs per cycle (proposal, validation, decision log,
reputation feedback). No contract changes.

### NFR2 — Fail-safe defaults

If any GitHub Actions secret is missing, the cycle MUST fail with a
clear "missing $SECRET_NAME" error rather than running with degraded
state.

### NFR3 — Repo size discipline

Every cycle commits ~3-10 KB of state-file changes. Over 30 days at
1/hour: ≤ 7.2 MB added to git history. Acceptable. After hackathon
ends we may rewrite history if needed; in scope here is just to not
make it worse.

### NFR4 — No Vercel rebuild storm

Vercel rebuilds on every push to `main`. 24 pushes/day × 30 days =
720 builds/month. Vercel free tier allows 100 builds/day → over.
**Mitigation:** in design, decide whether to push to `main` or to a
separate branch that Vercel doesn't auto-build from.

### NFR5 — Run-history file size cap

`data/cycle-history.json` SHALL keep last 100 entries (rolling) so
the file doesn't grow unbounded.

## Success Criteria

This spec is done WHEN:

1. The `.github/workflows/agent-cycle.yml` workflow has run at least
   3 times successfully on schedule.
2. `/api/health.lastCycleAge` shows < 3700 seconds within 2 hours of
   merge to main.
3. `/api/health.parseSuccessRate24h` is a real number > 0.9 (matches
   smoke results).
4. `data/last-cycle-summary.json` exists with a recent timestamp and
   `mode: "cron-github-actions"`.
5. Mascot on the live dashboard shows 🟢 ACTIVE.
6. No-lying-about-state checklist still passes.
7. AWS Bedrock spend rate ≤ $5/day.
8. Runbook is comprehensible to someone who hasn't read this spec.

## Open Questions

1. **Push to `main` or separate `data` branch?**

   - `main`: front-end auto-picks up via Vercel rebuild, simple.
     Concern: Vercel free-tier rebuild quota (NFR4).
   - separate branch + Vercel webhook ignores it + backend reads via
     GitHub raw URL: complex but no rebuild storm.
   - Recommendation: **`main` for now** (60-min cron = 24 builds/day =
     under free 100/day). Switch to data-branch only if we hit the cap.

2. **Should we commit `parse_metrics.json` to the repo?**

   - Pro: `/api/health.parseSuccessRate24h` becomes real on Vercel.
   - Con: Any sensitive raw output? **No** — we already gitignored
     `raw_model_outputs/`; `parse_metrics.json` only has numeric counts.
   - Recommendation: **yes, commit it.**

3. **Should we commit `threshold_state.json`?**

   - Pro: `thresholdMode` on `/api/health` becomes real.
   - Con: None.
   - Recommendation: **yes, commit it.**

4. **What about per-cycle GitHub Action artifact (logs, raw outputs)?**

   - GH Actions allows uploading run artifacts. We could attach raw
     model outputs as artifacts and link them from
     `data/last-cycle-summary.json`.
   - Pro: judges can download proof per-cycle.
   - Con: adds complexity, raw outputs are gitignored for a reason
     (potential model-side prompt content, though our prompts are
     declared in agent-card so it's mostly just response text).
   - Recommendation: **not in this spec.** Add later if requested.

5. **Cron interval: 60 min or 30 min?**
   - 30 min: 1680 GH min/month — close to 2000 free tier ceiling.
     If a cycle ever takes 2 min, headroom shrinks.
   - 60 min: 840 GH min/month. Half the AWS cost.
   - Trade-off: 30-min gives 🟢 LIVE more reliably (mascot threshold
     is `< 600s`); at 60 min, a single missed cycle puts mascot into
     🟡 IDLE.
   - Recommendation: **60 min.** Mascot is 🟢 because last cycle
     was minutes ago, not seconds. We document this honestly.

## Dependencies

- None on contracts.
- Soft dependency: `agent-reasoning-quality` already shipped; the
  state files this spec commits already exist in their target
  shapes (schemaVersion 2, parse_metrics, threshold_state).

## Risks

- **R-A**: GitHub Actions cron is best-effort, not exact (can be
  delayed by 15+ min during high-load times on the free tier).
  Mitigation: 60-min interval makes a 15-min delay invisible to
  the mascot threshold (still < 1 hour → still 🟢).
- **R-B**: Bedrock rate-limit during a peak hour fails a cycle.
  Mitigation: count it as soft failure, log to `cycle-failures.json`,
  next hour's cron carries on.
- **R-C**: A bad commit pushes corrupt state file and breaks the
  dashboard. Mitigation: `run-cycle.js` validates state files
  pass `JSON.parse` before commit; if validation fails, skip the
  commit and exit non-zero (workflow marked failed; investigators
  can read logs).
- **R-D**: Identity drift — cron commits as `TuringVault Cron <cron@…>`
  but operator's manual commits use `USBVadik <vadik@…>`. Not
  actually a risk; just clear in git log.
- **R-E**: Vercel build limit. 24 builds/day at start; if we move to
  30-min cron later, 48/day still under 100/day. Tracked in NFR4.
