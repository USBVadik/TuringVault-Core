# Execution Guard Metric — Design

## Data source

`src/data/outcomes.json` → `settled[]`. Each row carries `outcome`,
`pnlBps` (outcome-score bps, confidence-weighted price move), and
`executedOnChain`. The phantom predicate is identical to the one already
used by `/api/backtest` and `/api/performance`:

```
isNonExecutedIntent(row) =
  row.executedOnChain !== true &&
  row.outcome in { "GOOD_CALL", "BAD_CALL", "INTENT_NOT_EXECUTED" }
```

## Shared helper

`frontend/app/lib/executionGuard.shared.js` (CommonJS, mirrors
`discipline-summary.shared.js`). Pure function, no IO:

```
computeExecutionGuard(settledRows) -> {
  intentNotExecuted,                       // total non-executed consensus swaps
  wouldBeLossAvoided: { count, scoreBps }, // BAD_CALL not executed; scoreBps = +|Σpnl|
  wouldBeGainMissed:  { count, scoreBps }, // GOOD_CALL not executed; scoreBps = +Σpnl
  netScoreBpsAvoided,                      // wouldBeLossAvoided.scoreBps - wouldBeGainMissed.scoreBps
  basis: "would-be outcome-score bps (counterfactual; not realized PnL)"
}
```

Sign convention: a `BAD_CALL` row has negative `pnlBps`; avoiding it is a
positive (`scoreBps = -Σpnl`). A `GOOD_CALL` row has positive `pnlBps`;
missing it is a positive missed-gain (`scoreBps = Σpnl`). `netScoreBpsAvoided`
is positive when avoided losses outweigh missed gains.

Expected from the current 700-row ledger: `intentNotExecuted = 52`,
`wouldBeLossAvoided = { count: 28, scoreBps: 13622 }`,
`wouldBeGainMissed = { count: 24, scoreBps: 1457 }`,
`netScoreBpsAvoided = 12165`.

## API

`/api/discipline` already loads `outcomeRows = [...pending, ...settled]`.
Filter to settled-equivalent rows and pass to `computeExecutionGuard`. Add
the result to the JSON response as `executionGuard`. Extend the `OutcomeRow`
type with `outcome?` and `pnlBps?`. SWR cache unchanged.

## UI

`/discipline` `SummaryCard`: one new `Tile`:

- label: `Would-be losses avoided`
- value: `${wouldBeLossAvoided.count}` (e.g. `28`)
- tone: `emerald` when count > 0, else `muted`
- tooltip: explicit counterfactual statement, e.g.
  "Counterfactual · execution-layer. N consensus-approved swaps failed the
  route preflight and never took a position; M of them would have moved
  against us (net +X would-be score-bps avoided, Y would-be-gain bps missed).
  Would-be outcome-score bps, not realized PnL."

Render the tile only when `executionGuard.intentNotExecuted > 0`, so an empty
ledger shows nothing (no fabricated state).

## Honesty checks (no-lying-about-state)

- Tile label + tooltip both say `counterfactual` / `would-be`.
- No `$` sign anywhere on this metric.
- Does not touch realized aggregates (win rate, Outcome Score).
- Data source documented in code comment + this spec.

## Testing

`tests/unit/executionGuard.unit.test.js`:
- empty input → all zeros.
- mixed rows: executed GOOD/BAD ignored; non-executed BAD counts as avoided
  loss; non-executed GOOD counts as missed gain; INTENT_NOT_EXECUTED counts in
  total only.
- net = avoided − missed, sign correct.
