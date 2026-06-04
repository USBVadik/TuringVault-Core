# Audit 33 — Live System Health Audit

**Date**: 2026-06-04
**Trigger**: Operator — "давай проверим как работает наш проект,
пройдемся по всем важным пунктам... возможно что-то требуется
поправить?"
**Method**: Audited the LIVE system, not the code (per
`.kiro/steering/audit-style.md`). Hit production APIs, on-chain
state, cron history, and state files directly from this environment.
~11 days to deadline (2026-06-15).

---

## Scope + method per surface

| Surface | How verified | When (UTC) |
|---|---|---|
| Cron history | `git log origin/main` cycles 258-277 | 2026-06-04 ~09:00 |
| `/api/health` | curl from this env, parsed JSON | 09:00 |
| `/api/performance` | curl, parsed | 09:01 |
| `/api/yield-meth` | curl, parsed | 09:01 |
| On-chain wallet | ethers read vs Mantle RPC | 09:02 |
| Sourcify (6 contracts) | check-by-addresses API | 09:05 |
| Test suite | `npx jest` | 09:00 |
| src lint | `npx eslint src/` | 09:00 |
| mETH rate fetch | ran `fetchMethRate()` live | 09:02 |

---

## Findings (ordered by severity)

### F1 — [FIXED THIS AUDIT] `/api/yield-meth` served 5-day-stale rate

**Surface**: `/api/yield-meth` reported `degraded: true`,
`lastSyncAgeMin: 7175` (~5 days), `rateDeltaBps: 0`, passive yield
frozen at `$0`.

**Expected**: rate refreshes every cron cycle; realised yield
accrues as the mETH redemption rate climbs.

**Actual**: `src/data/meth_rate_history.json` last captured
2026-05-30T09:19Z and never moved.

**Root cause**: the cron's commit-staging loop in
`.github/workflows/agent-cycle.yml` (the `for f in … git add`
block) did **not** include `src/data/meth_rate_history.json`. So
every cycle `captureMethRate()` ran on the GH runner, wrote a fresh
rate to disk, but the file was never `git add`ed → never committed →
`origin/main` froze at May 30 → the Vercel API read the stale repo
file. Honest self-flagging (`degraded: true`) meant it never lied,
but the data was dead.

Verified NOT a source outage: ran `fetchMethRate()` live from this
env → returned fresh rate `degraded: false` in <1s. Sources fine;
the persistence path was the gap.

**Fix shipped**:
1. Added `src/data/meth_rate_history.json` to the cron staging loop.
2. Captured a fresh rate now so the committed snapshot is current
   (reference rate stayed pinned at May 30 per the honesty rule —
   `referenceSet: false`). Realised yield now computes:
   `rateDeltaBps: 2`, `passiveYieldUsd: $0.0087`, `assetHealth: ok`
   — real on-chain accrual, tiny because balance is 0.014 mETH.

`methRate.unit.test.js` 10/10 still green after the capture.

### F2 — [WATCH] Gas runway LOW: 1.73 days

**Surface**: agent EOA `0xDC78…fb5a` native MNT = **11.43**.
Runway = (11.43 − 5.0 reserve) / 0.077 per cycle ≈ 83 cycles ≈
**1.73 days**. Status LOW (OK threshold is >14d, the cron's own
pre-flight calls <7d LOW, <3.5d… this is well into LOW).

`/api/health` `lastCycleAge` was 5301s (~88 min) at audit time —
~2-3 missed slots, right at the STALE→OFFLINE boundary (90 min).
The agent recovered (cycle 277 committed), but the runway means it
will brick within ~2 days without a top-up. This is the recurring
single-EOA funding fragility flagged in earlier audits. **Operator
action: top up MNT before ~2026-06-06**, ideally to ≥30 MNT to
clear the deadline with margin.

Not a code bug — an operational one. No fix shipped; needs the
operator's wallet.

### F3 — [WATCH] BLOCKED_BY_REGIME dominates; MISSED_ALPHA high

**Surface**: last 40 settled outcomes:
```
tiers:    BLOCKED_BY_REGIME 26, EXECUTED_SWAP 10,
          BLOCKED_BY_VALIDATOR 2, BLOCKED_BY_LOW_CONFIDENCE 1,
          HEARTBEAT_SWAP 1
outcomes: MISSED_ALPHA 17, CORRECT_BLOCK 11, BAD_CALL 8,
          GOOD_CALL 2, NEUTRAL 2
```

**Good news (audit 31 fix holding)**: the risk_on asymmetry is
GONE. Last-40 swaps now spread across WMNT(3), MNT(5), mETH(1),
mUSD(3) — the agent buys risk now, not just sells to stable. The
counter-bias prompt works.

**Concern**: 65% of recent cycles are BLOCKED_BY_REGIME and 17/40
outcomes graded MISSED_ALPHA (price ran while the regime gate held
the agent flat). This is the regime gate being conservative. It is
NOT dishonest (the blocks are real and recorded), and CORRECT_BLOCK
(11) shows the gate also saves us from bad entries. But the
MISSED_ALPHA rate suggests the regime detector may be too eager to
return HOLD/UNKNOWN. **Not a pre-deadline fix** — touching the
regime gate risks destabilising the trading loop 11 days out. Log
it; revisit post-freeze. (Cross-ref audit 31 §"what to watch".)

---

## What's healthy (verified, not assumed)

- **Performance up sharply**: 196 settled (was 67), winRate 58.2%
  (was 46.3%), outcome score +4342 bps (was +1757). The grid-exit
  sizing fix + risk_on fix compounded into real improvement.
- **Cron alive**: 30 cycles succeeded / 0 failed in 24h, parse
  success 100%, 0 consecutive losses. The `cycle ? UNKNOWN` commits
  were pre-`fix(agent): tolerate missing ranging signal`; post-fix
  cycles (258-277) all carry proper IDs + tiers.
- **Sourcify**: independently re-verified all 6. Five `perfect`,
  Router `0x8187…7001` = `false`. The site's "5 verified + 1 not
  verified" copy is honest.
- **Tests**: 394/394 across 37 suites. `src/` lint 0 errors / 48
  warnings.
- **Wallet matches API**: on-chain (MNT 11.43, WMNT 33.8, USDT0
  70.17, mETH 0.014) reconciles with `/api/performance` holdings.
- **Honesty surfaces intact**: `/api/yield-meth` correctly
  self-flagged `degraded` rather than faking liveness — the bug was
  staleness, not a lie.

---

## Not checked / deferred

- Did not load every sub-page render (challenge/discipline/replay)
  this pass — focused on data-truth surfaces. They were
  design-audited recently (audits 30/32 + operator-agent polish).
- Did not re-run the adversarial challenge live (consumes budget +
  API credits); the on-chain anchor path was verified previously.
- Three untracked files in the working tree
  (`.kiro/audits/26-frameproof-*`, `27-frameproof-*`,
  `28-dealpartstore-seo-*`) appear to belong to OTHER projects, not
  TuringVault. Left untouched and NOT committed. Operator should
  confirm + remove if cross-contaminated.

---

## F4 — [FIXED THIS AUDIT] GitHub schedule dropping cron slots

**Surface**: `/api/health` `lastCycleAge` = 6344s (~106 min) at
re-check, vs a 30-min cron cadence (`:17` / `:47`). GitHub Actions
had dropped ~3 consecutive `schedule` slots — a known GH behaviour
under runner-pool load. This pushes the dashboard feed past STALE
(35 min badge) toward OFFLINE (90 min), which a judge could catch
as a dead agent.

**Fix shipped**: new `.github/workflows/agent-watchdog.yml`.
- Independent `*/25` schedule (offset from the cycle slots).
- Each run hits live `/api/health`, reads `lastCycleAge`, and ONLY
  `gh workflow run agent-cycle.yml` when age > 3000s (50 min).
- Condition-based by design so it does NOT add baseline cycle
  frequency (would accelerate gas burn under F2). It only fills a
  gap a missed scheduled slot would have left — gas-neutral in the
  steady state.
- Two independent schedules being dropped simultaneously is far
  less likely than one, so feed uptime rises without extra cost.
- Safe: dispatches a different workflow (separate concurrency
  group); agent-cycle's own `concurrency: agent-cycle` queues a
  dispatch if a real cycle is mid-flight → no double gas spend.
  No recursion (watchdog never dispatches itself).

NOTE: the watchdog rescues SCHEDULE gaps, not GAS exhaustion. If
native MNT hits the reserve floor the dispatched cycle still can't
trade. F2 top-up remains mandatory.

**Validation note (2026-06-04, operator-corrected)**: an earlier
draft claimed `GITHUB_TOKEN` cannot trigger `workflow_dispatch`
(recursion block). That is FALSE — confirmed against GitHub Docs
and the 2022-09-08 GitHub changelog: `workflow_dispatch` and
`repository_dispatch` are explicit EXCEPTIONS to the
GITHUB_TOKEN-no-recursion rule and always create runs. So the
watchdog's `gh workflow run` under the default token is sound; no
PAT or self-contained rewrite needed. `gh` CLI is preinstalled on
`ubuntu-latest`. Remaining minor cosmetic: `*/25` yields 25/25/10
intervals, not even thirds — acceptable. Open item: confirm the
first real watchdog run via the Actions UI (operator-side; this
environment has no gh CLI or GitHub token to query run history or
dispatch).

---

## Action summary

| # | Finding | Severity | Status |
|---|---|---|---|
| F1 | yield-meth 5-day stale (cron didn't commit rate file) | prod-path | FIXED |
| F2 | gas runway 1.73d | operational | OPERATOR: top up MNT to 30+ TODAY |
| F3 | regime gate over-blocking, MISSED_ALPHA 42% | tuning | DEFER post-freeze |
| F4 | GitHub schedule dropping ~3 slots → feed near OFFLINE | reliability | FIXED (watchdog) |
