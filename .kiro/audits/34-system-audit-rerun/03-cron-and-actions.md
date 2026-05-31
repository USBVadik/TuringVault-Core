# Audit 34 - Cron and GitHub Actions

Generated: 2026-05-31
Primary evidence: `raw/cron/agent-cycle-runs.md`, `raw/cron/agent-cycle-slot-analysis.md`, `raw/cron/ci-runs.md`

## Agent Cycle

The latest 20 scheduled `agent-cycle.yml` runs all completed successfully.

Slot coverage is the problem: those 20 runs span 2026-05-30T23:14:33Z through 2026-05-31T20:43:02Z, a window with 43 expected half-hour slots. Actual coverage is 20/43 = 46.5%.

| Metric | Value |
| --- | ---: |
| Scheduled runs inspected | 20 |
| Successful inspected runs | 20 |
| Failed inspected runs | 0 |
| Expected half-hour slots in inspected window | 43 |
| Slot coverage | 46.5% |

## CI

The latest 5 `ci.yml` push runs completed successfully. Durations were around 49-55 seconds in the captured artifact.

## Findings

| ID | Severity | Surface | Finding | Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| A34-CRON-01 | P1 | `agent-cycle.yml` | GitHub schedule is not delivering every half-hour slot; observed slot coverage was 46.5%. This explains "hourly-ish" behavior even when all visible runs are green. | `raw/cron/agent-cycle-slot-analysis.md` | open |
| A34-CRON-02 | P2 | `scripts/audit/gh-actions-runs.sh` | Existing lag helper is stale: it assumes only the `:17` schedule slot and misreports lag for the `:47` slot. Audit 34 used a corrected slot analysis artifact. | `raw/cron/agent-cycle-slot-analysis.md` | open |
| A34-CRON-03 | P2 | `replay-validator.yml` | Workflow was inventoried but not deeply audited in this rerun. | `00-inventory.md` | open |

## Root-cause Hypothesis

GitHub scheduled workflows are best-effort and can be delayed or dropped. The latest evidence does not show failed jobs; it shows missing schedule invocations. An external scheduler or Vercel/Cloudflare cron bridge is still needed if near-exact cadence is part of the product promise.

## Not Checked

- GitHub Actions secret names were not listed in this run because the env drift check requires operator-generated secret-name files.
- Per-step timing inside the trading cycle was not decoded from each run log.
