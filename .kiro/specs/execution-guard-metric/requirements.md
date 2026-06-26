# Execution Guard Metric — Requirements

## Context

The phantom-PnL fix (`fix(outcomes)` PR #4) excluded 52 consensus-approved
swaps that never executed on-chain (`INTENT_SWAP_NO_EXEC` route-preflight
failures) from the Outcome Score. The operator asked: since not executing
those trades was net-beneficial (the wallet stayed intact), surface that
capital-preservation effect as its own honest metric — without folding
counterfactuals back into the realized win rate.

## Goal

Add an **Execution Guard** metric that shows how many consensus-approved
swaps the execution layer prevented from landing, split into:

- **would-be losses avoided** (price moved against the intended direction), and
- **would-be gains missed** (price moved in favour),

plus the **net would-be outcome-score bps** avoided.

## Requirements

R1. The metric MUST be computed only from settled rows in
`src/data/outcomes.json` where `executedOnChain !== true` and the recorded
`outcome` is `GOOD_CALL`, `BAD_CALL`, or `INTENT_NOT_EXECUTED`. No other
source. No on-chain or live read (it is a historical-ledger derivation).

R2. The would-be direction split (loss vs gain) is computable only for legacy
rows that still carry a directional `outcome` (`BAD_CALL` / `GOOD_CALL`) with a
non-zero `pnlBps`. Rows tagged `INTENT_NOT_EXECUTED` (post-fix, `pnlBps = 0`)
count toward the total `intentNotExecuted` but contribute 0 to the bps split.

R3. Units MUST be presented as **would-be outcome-score bps**, explicitly
**counterfactual** and **not realized wallet PnL / not dollars**. This is a
no-lying-about-state §3 hard requirement: the number describes trades that
NEVER took a position.

R4. The UI surface MUST carry an explicit `counterfactual · execution-layer`
label and a tooltip that states: what the number means, the avoided-loss vs
missed-gain breakdown, and that it is not realized PnL.

R5. The metric MUST NOT change the realized win rate, Outcome Score, or any
realized aggregate. It is additive and display-only.

R6. No backend/cron change. No contract change. No protected state file
touched (CI state-file guard must stay green).

## Out of scope

- Converting would-be score-bps into dollar estimates.
- Putting the counterfactual metric on the homepage hero (kept on the
  discipline deep-dive page where caveated metrics belong).
