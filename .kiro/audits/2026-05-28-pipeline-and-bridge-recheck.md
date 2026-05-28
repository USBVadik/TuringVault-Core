# 2026-05-28 — Pipeline + Bridge Re-check

| Meta | Value |
|------|-------|
| Auditor | Kiro (operator-supervised) |
| Date | 2026-05-28 |
| Scope | R7 (pipeline data-flow) and R10 (cron→Vercel bridge) re-evaluated against post-fix reality |
| Method | GH Actions API + Vercel API + Mantle RPC + git log on `data/last-cycle-summary.json` and `src/data/outcomes.json`. No source-code reading until evidence diverged from claim. |
| Companion report | `2026-05-28-trading-unblock.md` (root cause + fix). This file is the deferred re-check pass on the surfaces those fixes interact with. |

---

## Pipeline Re-check (replaces R7 / 06-pipeline-data-flow.md spot-checks)

The original `06-pipeline-data-flow.md` data cards were captured at decisions #107 and #110 — both pre-fix, both `consensus + swap` cycles where execution was theoretically possible but blocked by Bug 1/2/3 in MerchantMoeDEX. We re-pick a post-fix data card.

### Data Card C — cycle 123 (2026-05-28T15:35Z, post-fix)

| Layer | Source | Key data |
|-------|--------|----------|
| Analyst | `last-cycle-summary` (mode=cron-github-actions) | action=`swap`, target=`mUSD`, confidence=0.68 |
| Validator | `last-cycle-summary` (validatorReasoning) | "TREND_DOWN regime (60% confidence) … defensive rotation to mUSD … 35% allocation within safe bounds … RSI 33 bounce risk and i…" — flaggedIssues 4 |
| Arbiter | summary | not fired (consensus already true between analyst + validator) |
| Discipline | summary `executionStatus` field | **EXECUTED** — first time this label is true on a swap-tier cycle |
| RWA | summary `rwa` | source=`llm-implicit`, executed=**true**, $3.0003 USDT → USDT0 |
| Directional | summary `directionalSwap` | executed=**true**, WMNT → USDT0, amountIn=4.169 WMNT, amountOut=2.579 USDT0 |
| On-chain | Routescan | 3 swap TXs in same minute (`0x313c0fc…`, `0x4e2…`, third leg between them), all to MoeLBRouter, all status=success |
| Outcomes ledger | **MISSING** | row for decisionId=123 not in `src/data/outcomes.json` — see O-1 in trading-unblock report |

#### Quality checks against pipeline R7

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | Market data fresh at decision time? | PASS | discipline gate price_freshness=PASS ("Price data was 5s old"). |
| 2 | Analyst reasoning unique vs last 5 cycles? | PASS | Cycles 119-122 all said `swap → mUSD` but cycle 123 includes specific RSI 33 + MACD wording absent earlier. |
| 3 | Validator disagreed at least once in 20-cycle window? | **FAIL** | Same as original audit: validator `approved:true` on every recent decision. Adversarial-validation narrative remains weak. (Carryover from `pipe-1` in consolidated.) |
| 4 | Arbiter fired when expected? | N/A | Consensus reached without it. Correct. |
| 5 | Claimed signals in prompt context? | PARTIAL | Same Elfa / Hyperliquid carry-overs. Not re-verified deeply in this pass. |

The single **new** quality concern unique to cycle 123:

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 6 | Cycle that broadcast 3 DEX TXs persisted matching outcome row? | **FAIL** | `outcomeTracker.record()` did not land. See O-1; detector now in place. |

### Pipeline-level conclusions

- The **execution-side** (rwa allocator + directional swap) is now actually doing what the dashboards say. That was the steering-rule violation we were carrying.
- The **bookkeeping side** (outcomeTracker.record persistence) has a new silent-failure mode that did not exist in the original audit window because the original pipe never broadcast a swap and so never stressed the post-swap write path.
- The **adversarial-validation** weakness flagged in `pipe-1` is unchanged and remains a doc/framing question, not a code bug.

---

## Bridge Re-check (replaces R10 / 09-cron-vercel-bridge.md spot-checks)

### Cron→Vercel mapping (last 3 cron-author commits)

| Cron commit | Vercel deployment | State | Build duration | Time-to-ready |
|-------------|-------------------|-------|---------------:|--------------:|
| `f2cc66c` (cycle 123) | `dpl_EDT2hsjSrXT7jeyYDzXvDQaQYmQj` | READY | 55.2 s | matches push |
| `726c7b7` (cycle 122) | `dpl_wiP4uKF4SV833bM1sNRCWTXiRnut` | READY | 50.8 s | matches push |
| `e75ec2e` (cycle 121) | `dpl_GGHeMbDYZXQXmFP9Bd5J1KTu2Egz` | READY | 54.0 s | matches push |

Bridge itself is healthy. Every cron commit triggers a successful Vercel build in ~52s.

### Production alias trace

The previous concern (logged separately) was that production alias was on `7a882d3` ("trigger vercel") instead of the design-fixes commit `2cb635d`. As of this re-check, production alias is on `af47099` (today's audit commit) — Vercel is **promoting every successful build to production** without manual intervention. The earlier "stuck on cron commit 726c7b7" episode was an artefact of a single failed deploy on `962c2f0` (TS build error), not a bridge bug. The retry through `b1cde7e` worked normally.

### Cron schedule reliability

Pulling last 30 GH Actions runs of `agent-cycle.yml`:

- 17 of 30 runs were `event: schedule`. The other 13 were `workflow_dispatch` (manual operator triggers, including today's cycle 123).
- Last successful **scheduled** run before this audit: `2026-05-28T12:55:59Z`.
- Audit time: `2026-05-28T16:35Z`.
- Slots that should have fired in between (every 30 min): 13:17, 13:47, 14:17, 14:47, 15:17, 15:47, 16:17. **Seven scheduled slots, zero fired.**
- The successful runs in the same window (cycle 123) all came from manual `workflow_dispatch`.

This confirms `cron-1` from the consolidated report (37% slot success rate) is still very much real and arguably worse during peak load. The current `wont-fix-pre-submission` status remains appropriate; we have a known gap and a working manual-dispatch backup.

#### Workflow internals not in scope today

`gh-actions-runs.sh` was supposed to be runnable to produce a Markdown lag table; we ran a quick equivalent via the API. No need to expand here; this is a known issue.

### Filesystem-fallback table

The original R10 added GitHub raw fallbacks to `/api/decisions`, `/api/discipline`, `/api/performance`. We additionally extended `/api/decisions` today (commit `145388a`) to read backfilled `executedOnChain` + `_displayTier` fields with inline derivation as fallback. No new gaps.

`/api/strategy` (R10 P1 #25) still relies on local fs first → GH raw fallback for `outcomes.json` only. `position_state.json` still has no fallback. That carries over from `bridge-4` and remains open.

### Env drift table

Vercel project envs (probed at audit time): only 2 sensitive entries (`NEXT_PUBLIC_BASE_URL` placeholder, `ELFA_API_KEY`). GH Actions secrets list (probed via API): 13 names. Frontend reads state files, not most secrets. This carries over from `bridge-7` and remains acceptable.

---

## Re-check verdict per original audit task

| Task | Original output | This re-check verdict |
|------|-----------------|-----------------------|
| T8 (R7 pipeline) | `06-pipeline-data-flow.md` | **partially superseded** by post-fix data card C above. Old findings about validator non-disagreement still hold. New finding O-1 (outcomes-not-persisted) is a regression that did not exist when original was written. |
| T11 (R10 cron→Vercel bridge) | `09-cron-vercel-bridge.md` | **confirmed**. Bridge is healthy on the deploy axis. Cron schedule reliability is unchanged (still flaky). New observation: every-half-hour slots have been silently skipped for ~3.5 hours today and operator did not notice; supports the case for documenting cron as "best-effort, manually triggered for demo windows" rather than "every 30 min". |

---

## Steering compliance

- `audit-style.md`: re-check started by hitting GH Actions API and Vercel API for live state, not by re-reading reports. Found that 3.5h of cron skips were not surfaced anywhere — consistent with the rule "don't trust each subsystem looking fine in isolation; they drift after refactors".
- `no-lying-about-state.md` §1, §2: today's UI does not currently claim "Autonomous · Running 24/7" anywhere prominent (the home page reads "Mantle Mainnet · last cycle Xm ago"). The wording is honest enough today. If a future copy change reintroduces "Autonomous", the cron-skip observation here is the on-the-record reason to push back.

---

## Not Checked

| Item | Reason |
|------|--------|
| Each /api/* route's freshness, latency, 5xx | Done sufficiently in original 02-api-endpoints; today's only added route-level changes are `/api/decisions` (covered) and `run-cycle.js` (cron-side, not a route). |
| All 14 API endpoints in R3 | Out of scope today. Existing report covers them. |
| Lighthouse re-run | Out of scope today (design fixes already in production from 14-visual-polish-fixes.md). |
| Outcome-tracker silent failure root cause | Detector deployed (`74de441`); will surface on next reproduction. Diagnosis deferred. |
