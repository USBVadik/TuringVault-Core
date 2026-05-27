# Audit: Cron + GitHub Actions

**Run at:** 2026-05-27 22:05 UTC
**Auditor:** Kiro
**Method environment:** local shell against
`https://api.github.com/repos/USBVadik/TuringVault-Core/actions/...`
**Raw artefacts:** scripts/audit/gh-actions-runs.sh output captured in
this report.

## Scope

- `agent-cycle.yml` (last 20 runs)
- `ci.yml` (latest 5)

## Method per surface

GitHub public REST API: `GET /repos/.../actions/workflows/<file>/runs`.
Lag computed against the cron schedule's target minute (currently `:17`,
moved from `:00` earlier today in commit `bc21219`).

## agent-cycle.yml — last 20 runs

| Run | Started (UTC) | Lag (min) | Trigger | Conclusion | Duration (s) |
|----:|---------------|----------:|---------|------------|-------------:|
| 20 | 2026-05-27T20:13:59Z | n/a | manual | success | 101 |
| 19 | 2026-05-27T19:23:48Z | 7 | schedule | success | 109 |
| 18 | 2026-05-27T17:17:11Z | n/a | manual | success | 114 |
| 17 | 2026-05-27T16:36:07Z | 19 | schedule | success | 97 |
| 16 | 2026-05-27T16:04:21Z | n/a | manual | success | 99 |
| 15 | 2026-05-27T12:49:31Z | **33** | schedule | success | 340 |
| 14 | 2026-05-27T09:42:51Z | **26** | schedule | success | 105 |
| 13 | 2026-05-27T05:13:43Z | **57** | schedule | success | 77 |
| 12 | 2026-05-27T00:02:38Z | 46 | schedule | success | 89 |
| 11 | 2026-05-26T22:18:23Z | 1 | schedule | success | 91 |
| 10 | 2026-05-26T20:07:13Z | **50** | schedule | success | 86 |
| 9  | 2026-05-26T17:25:44Z | 9 | schedule | success | 77 |
| 8–1 | various | n/a | manual | success | 25–96 |

Schedule was `'0 * * * *'` until 2026-05-27 ~21:00 UTC (commit
`bc21219` moved it to `'17 * * * *'`).

## Skipped slots in last 24h

Working from current time **2026-05-27 22:05 UTC**, expected slots and
what we got:

| Expected slot | Got | Status |
|---------------|-----|--------|
| 2026-05-26T22:00 | 22:18 (run 11, lag 18 min) | late |
| 2026-05-26T23:00 | — | **MISSED** |
| 2026-05-27T00:00 | 00:02 (run 12) | OK |
| 2026-05-27T01:00 | — | **MISSED** |
| 2026-05-27T02:00 | — | **MISSED** |
| 2026-05-27T03:00 | — | **MISSED** |
| 2026-05-27T04:00 | — | **MISSED** |
| 2026-05-27T05:00 | 05:13 (run 13, lag 13 min) | late |
| 2026-05-27T06:00 | — | **MISSED** |
| 2026-05-27T07:00 | — | **MISSED** |
| 2026-05-27T08:00 | — | **MISSED** |
| 2026-05-27T09:00 | 09:42 (run 14, lag 42 min) | late |
| 2026-05-27T10:00 | — | **MISSED** |
| 2026-05-27T11:00 | — | **MISSED** |
| 2026-05-27T12:00 | 12:49 (run 15, lag 49 min) | late |
| 2026-05-27T13:00 | — | **MISSED** |
| 2026-05-27T14:00 | — | **MISSED** |
| 2026-05-27T15:00 | — | **MISSED** |
| 2026-05-27T16:00 | 16:36 (run 17, lag 36 min) | late |
| 2026-05-27T17:00 | manual at 17:17 | covered |
| 2026-05-27T18:00 | — | **MISSED** |
| 2026-05-27T19:00 | 19:23 (lag 23 min) | late |
| 2026-05-27T20:00 | manual at 20:13 | covered |
| 2026-05-27T21:17 (new schedule) | — | **MISSED** |

**24h success rate: 9/24 slots fired (37%).** With the schedule moved to
`:17`, the very first scheduled slot (21:17 UTC) was already missed.

## Findings

| ID | Sev | Surface | Expected | Actual | Root cause | Suggested fix |
|----|-----|---------|----------|--------|------------|---------------|
| cron-1 | **P0** | agent-cycle.yml | hourly fire reliable | 37% slot success rate; `:17` change didn't help its first slot | GH Actions delays/skips schedules under platform load. Even off-peak minutes are not guaranteed. Hackathon README claims "hourly cycle". | (a) accept and reword README to "best-effort hourly", **AND/OR** (b) add a parallel external trigger: a tiny Vercel cron (built-in for Pro plans), Cloudflare Worker cron, or external uptime-pinger that calls a `workflow_dispatch` via GH API when it sees the cycle is stale. |
| cron-2 | P1 | concurrency group | should not stack | not yet observed; existing `concurrency: group: agent-cycle` looks correct | — | none |
| cron-3 | P1 | run 15 duration | typical 60-100s | 340s on one run | Possibly Bedrock latency spike or RPC retry. | Add per-stage timing to last-cycle-summary so we can see WHICH step is slow. |
| cron-4 | P1 | health.lastCycleAge | < 65 min | 6406 sec = 106 min when probed | direct consequence of cron-1 | Resolve cron-1. |
| cron-5 | P2 | mode label | matches reality | Top-level `mode: cron-github-actions` after morning fix — works | already fixed (commit `01a92d0`) | none |

## ci.yml — latest 5

Not pulled in this run; CI file last touched not by audit. Skipped here
because the operator already inspects CI output via PR/push UI. To add
in re-audit: another `gh-actions-runs.sh ci.yml 5` invocation.

## Not checked

| Surface | Reason |
|---------|--------|
| ci.yml run history | deferred — operator-visible already |
| Per-step timing breakdown | requires modifying `run-cycle.js` — out of scope for read-only audit |
| Secret list | requires `gh` CLI not installed in this environment |
