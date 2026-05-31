# Audit 34 - State Files

Generated: 2026-05-31
Primary evidence: `raw/state/state-files.md`

## Fresh State

| File | Modified UTC | Shape | Notes |
| --- | --- | --- | --- |
| `data/cycle-history.json` | 2026-05-31T20:13:48Z | array, 100 rows | fresh |
| `data/discipline-history.json` | 2026-05-31T20:13:48Z | array, 96 rows | fresh |
| `data/last-cycle-summary.json` | 2026-05-31T20:13:48Z | cycle summary | fresh, no tx hashes/errors |
| `src/data/outcomes.json` | 2026-05-31T20:14:00Z | pending/settled | fresh |
| `src/data/parse_metrics.json` | 2026-05-31T20:13:48Z | byDay | fresh |
| `src/data/threshold_state.json` | 2026-05-31T20:14:29Z | threshold state | fresh |

## Stale or Inactive State

| File | Modified UTC | Finding |
| --- | --- | --- |
| `data/intent_queue.json` | 2026-05-27T14:51:24Z | empty and stale; likely inactive queue |
| `src/data/grid_bot_state.json` | 2026-05-27T14:51:24Z | stale grid bot state |
| `src/data/grid_config.json` | 2026-05-27T14:51:24Z | stale grid config |
| `src/data/grid_param_history.json` | 2026-05-27T14:51:24Z | stale history |
| `src/data/grid_trades.json` | 2026-05-27T14:51:24Z | stale trade ledger |
| `src/data/trajectories.json` | 2026-05-27T14:51:24Z | stale trajectory data |
| `src/data/meth_rate_history.json` | 2026-05-30T09:19:03Z | only two captures |
| `src/data/position_state.json` | 2026-05-31T08:32:25Z | older than latest cycle |

## Findings

| ID | Severity | Surface | Finding | Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| A34-STATE-01 | P1 | Grid subsystem files | Grid state/trades/config have not moved since 2026-05-27. If the product promise is active grid trading, these files look inactive. | `raw/state/state-files.md` | open |
| A34-STATE-02 | P1 | `position_state.json` | Position state was not updated by the latest 2026-05-31 evening cycle. This should be confirmed against the portfolio guard semantics. | `raw/state/state-files.md` | open |
| A34-STATE-03 | P2 | outcome sample probe | Deterministic sample did not print timestamps because the probe looked for a field that rows do not use. The data appears parseable, but the audit helper should use `recordedAt`. | `raw/state/state-files.md` | open |

## Not Checked

- Full schema validation against writer code was not rerun for every state file.
- State-file updates were not traced back to individual cron commits in this run.
