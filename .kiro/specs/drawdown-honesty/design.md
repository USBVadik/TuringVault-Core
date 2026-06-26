# Drawdown Honesty — Design

## Computation (`/api/backtest/route.ts`)

The existing `maxDrawdownBps` (5341) is the peak-to-trough of the cumulative
`effectiveBps` curve over ALL settled rows (executed swaps + holds). Keep it;
it backs the relabeled "Max score drawdown" stat.

Add a realized-swap drawdown computed from executed swaps only:

```
realizedSwapRows = settled.filter(
  s => s.executedOnChain === true &&
       (s.outcome === "GOOD_CALL" || s.outcome === "BAD_CALL")
)
// peak-to-trough of cumulative pnlBps over realizedSwapRows (chronological)
realizedSwapDrawdownBps = maxDrawdown(realizedSwapRows, s => s.pnlBps)
realizedSwapCount = realizedSwapRows.length
worstExecutedSwapBps = min(0, ...realizedSwapRows.map(s => s.pnlBps))  // most-negative; 0 if none
```

Add to the `summary` object: `realizedSwapDrawdownBps`,
`realizedSwapDrawdownPct` (bps/100), `realizedSwapCount`, `worstExecutedSwapBps`.
Update `scoreMethodology` to explain the two drawdowns. The shared
max-drawdown loop is unchanged in shape (peak starts at 0, dd = peak − cum).

Expected: realizedSwapDrawdownBps = 1203, realizedSwapCount = 91,
worstExecutedSwapBps = −271.

## UI (`/backtest/page.tsx`)

1. `StatCard` gains an optional `hint?: string` prop, rendered as the `title`
   (native hover tooltip) on the card. No visual change when absent.
2. Relabel the existing Max Drawdown card:
   - label: `Max score drawdown`
   - value: `-${summary.maxDrawdownBps} bps` (unchanged value)
   - hint: "Worst peak-to-trough of the decision-score curve (528 decisions),
     dominated by MISSED_ALPHA (held while price rose = opportunity cost), NOT
     realized capital. Biggest single executed swap loss: -271 bps. Score bps,
     not $."
3. Add a new card after it:
   - label: `Realized swap drawdown`
   - value: `-${summary.realizedSwapDrawdownBps} bps`
   - color: `red`
   - hint: "Executed swaps only (N took a position): worst peak-to-trough of
     their outcome scores. Closest honest proxy to capital drawdown. Outcome-
     score bps, not literal $ NAV. Worst single executed swap: -271 bps."

## Honesty checks

- Neither stat shows `$`.
- Tooltips state "score bps, not realized $" and the realized-swap caveat.
- Realized-swap excludes holds + phantom (R4).
- No change to Outcome Score / win rate / equity curve.

## Testing

The max-drawdown math is small and already exercised via the live recompute
(score DD 5341, realized DD 1203, worst −271 confirmed against the real
ledger). No new backend unit module is introduced (the logic lives inline in
the route, consistent with the existing maxDrawdownBps loop). Verification is
via the frontend build + a live `/api/backtest` field check after deploy.
