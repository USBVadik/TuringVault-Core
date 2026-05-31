# State files audit probe

timestamp: 2026-05-31T20:58:04.437Z

| File | Modified UTC | Bytes | Shape | Row count | Parse |
| --- | --- | ---: | --- | ---: | --- |
| `data/challenge-budget.json` | 2026-05-31T20:14:26.418Z | 57 | date,used,history | history:0 | ok |
| `data/cycle-failures.json` | 2026-05-29T17:52:57.442Z | 267 | array | 1 | ok |
| `data/cycle-history.json` | 2026-05-31T20:13:48.580Z | 22288 | array | 100 | ok |
| `data/discipline-history.json` | 2026-05-31T20:13:48.580Z | 63279 | array | 96 | ok |
| `data/intent_queue.json` | 2026-05-27T14:51:24.533Z | 3 | array | 0 | ok |
| `data/last-cycle-summary.json` | 2026-05-31T20:13:48.580Z | 614 | cycleStartedAt,cycleEndedAt,durationSeconds,stageTiming,decisionId,decisionTier,consensus,txHashes | txHashes:0 errors:0 | ok |
| `src/data/grid_bot_state.json` | 2026-05-27T14:51:24.545Z | 273 | initialFunding,position,cycleCount,totalSwaps,totalGasSpent |  | ok |
| `src/data/grid_config.json` | 2026-05-27T14:51:24.545Z | 298 | upperBound,lowerBound,gridSteps,maxPositionPct,minReservePct,minTradeUsd,slippagePct,hardStopLossPct |  | ok |
| `src/data/grid_param_history.json` | 2026-05-27T14:51:24.545Z | 1095 | array | 1 | ok |
| `src/data/grid_trades.json` | 2026-05-27T14:51:24.545Z | 1334 | array | 4 | ok |
| `src/data/meth_rate_history.json` | 2026-05-30T09:19:03.768Z | 578 | captures,referenceRateAtomic,referenceTs,referenceCapturedFromSource | captures:2 | ok |
| `src/data/outcomes.json` | 2026-05-31T20:14:00.286Z | 332755 | pending,settled,schemaVersion | pending:63 settled:67 | ok |
| `src/data/parse_metrics.json` | 2026-05-31T20:13:48.582Z | 1303 | byDay |  | ok |
| `src/data/position_state.json` | 2026-05-31T08:32:25.331Z | 394 | status,entryPrice,entryTime,targetExit,stopLoss,highWaterMark,allocationPct,cycleCount |  | ok |
| `src/data/threshold_state.json` | 2026-05-31T20:14:29.636Z | 204 | consecutiveLosses,activeThreshold,mode,triggeredAt,recoveryRule,updatedAt |  | ok |
| `src/data/trajectories.json` | 2026-05-27T14:51:24.546Z | 124031 | array | 25 | ok |

## Deterministic sample: first 3 + last 2 outcome rows

| idx | decisionId | status/tier | timestamp | executedOnChain | displayTier | obvious issue |
| ---: | ---: | --- | --- | --- | --- | --- |
| 0 | 137 | BLOCKED_BY_REGIME |  |  | BLOCKED_BY_REGIME | none |
| 1 | 138 | BLOCKED_BY_REGIME |  |  | BLOCKED_BY_REGIME | none |
| 2 | 139 | BLOCKED_BY_REGIME |  |  | BLOCKED_BY_REGIME | none |
| 3 | 135 | BLOCKED_BY_REGIME |  |  | BLOCKED_BY_REGIME | none |
| 4 | 136 | BLOCKED_BY_REGIME |  |  | BLOCKED_BY_REGIME | none |
