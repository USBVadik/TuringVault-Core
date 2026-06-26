# Drawdown Honesty — Requirements

## Context

The Performance page (`/backtest`, `/api/backtest`) shows a stat **"Max
Drawdown −5341 bps"**. The label reads like a −53% capital drawdown. In
reality it is the worst peak-to-trough of the cumulative **decision-score**
curve over a 528-decision window, **dominated by `MISSED_ALPHA`** (holds where
price rose = opportunity cost, ~−17496 score-bps gross), not by swap losses
(executed `BAD_CALL` only ~−3114 bps). The biggest single **executed** swap
loss in all history is **−271 bps (~−2.7%)**. The wallet never had anything
close to a 53% drawdown.

A judge reading "Max Drawdown −5341 bps" would conclude the agent lost 53% of
capital at some point — false. This is a no-lying-about-state §3 risk: a
correctly-computed number under a label that implies a different scope.

## Requirements

R1. Relabel the existing stat from **"Max Drawdown"** to **"Max score
drawdown"** and attach a hover tooltip stating: it is the worst peak-to-trough
of the decision-score curve, dominated by `MISSED_ALPHA` opportunity-cost, NOT
realized capital, and that the biggest single executed swap loss was −271 bps.

R2. Add a new **"Realized swap drawdown"** stat computed ONLY from executed
swaps that took a position (`executedOnChain === true` and outcome is
`GOOD_CALL` or `BAD_CALL`). This is the closest honest proxy to a capital
drawdown. Tooltip must state it is the executed-swap-only peak-to-trough in
outcome-score bps (not literal $ NAV) and cite the worst single executed swap.

R3. Both numbers are **outcome-score bps** (confidence-weighted price move),
NOT realized dollar PnL. Tooltips MUST say so. No `$` sign on either stat.

R4. The realized-swap drawdown MUST NOT include holds (`CORRECT_BLOCK`,
`MISSED_ALPHA`) or non-executed intents (phantom). It is executed swaps only.

R5. Display-only. No backend/cron change, no contract change, no protected
state file touched. Realized aggregates (Outcome Score, win rate) unchanged.

## Expected values (current 700-row ledger)

- Max score drawdown: **5341 bps** (unchanged number, relabeled).
- Realized swap drawdown: **1203 bps** across **91** executed swaps.
- Worst single executed swap: **−271 bps**.
