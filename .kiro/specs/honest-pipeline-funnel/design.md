# Honest Pipeline Funnel — Design

## API (`/api/performance/route.ts`)

The route already loads `settled` rows (with `consensus`, `decisionTier`,
`executedOnChain`, `outcome`). Add, computed inline (no new dependency):

```
executedDirectional = settled.filter(s =>
  s.executedOnChain === true && (s.outcome === "GOOD_CALL" || s.outcome === "BAD_CALL"))
executedTradeWins   = count GOOD_CALL in executedDirectional        // 62
executedTradeLosses = count BAD_CALL  in executedDirectional        // 29
executedTradeTotal  = executedDirectional.length                    // 91
executedTradeWinRate = round1(wins / total * 100)                   // 68.1

pipelineFunnel = {
  totalDecisions,                       // 700
  consensusApproved,                    // consensus===true  -> 152
  executed: executedTradeTotal,         // 91
  executedWon: executedTradeWins,       // 62
  blockedTotal,                         // consensus===false -> 548
  blockedDeterministic,                 // tier in {REGIME,PORTFOLIO,LOW_CONFIDENCE,PARSE_FAILURE} -> 471
  blockedValidator,                     // tier BLOCKED_BY_VALIDATOR -> 41
  blockedOther,                         // remainder -> 36
}
```

All additive; existing fields (winRate, cumulativePnlBps, etc.) unchanged.
Update `winRateDenominator`/notes to clarify executed-trade vs decision-quality.

## Homepage (`page.tsx`)

Stat grid (6 cards) changes:
- **Card 1** `Reputation Score`(23) -> **`Trade win rate`** = `executedTradeWinRate`%,
  green, tooltip: "Executed directional swaps only (62/91). Excludes holds and
  non-executed intents. The agent is selective — it only commits capital on
  full consensus."
- **Card 2** `Win Rate`(49.5) -> relabel **`Decision quality`**, tooltip:
  "(GOOD_CALL + CORRECT_BLOCK)/realized — credits correct risk-off holds as wins."
- Cards 3-6 (Settled, Outcome Score, W/L, mETH yield) unchanged.

New **Pipeline funnel** strip under the grid (lightweight, no new dep):
a horizontal row of labeled chips with proportional bars:
`700 decisions -> 152 consensus (22%) -> 91 executed -> 62 won (68%)`
and a second line: `548 blocked: 471 deterministic risk gates · 41 adversarial
validator · 36 other`. Pure counts, neutral styling. A short caption:
"Selective by design: commits capital only on full 3-agent consensus; most
cycles are risk-gated holds (capital preservation)."

On-chain reconciliation line (keeps the ERC-8004 proof, honest):
"On-chain ERC-8004 reputation: {totalFeedback} feedback entries, cumulative
{cumulativeScore}. The registry's raw winRate field reads {onchain}% because
the current feedback rule records risk-off holds as score 0 (counted
non-positive); see Decision quality above." Rendered from `reputationData`
(still fetched) — only when present.

## Honesty checks

- 68% labeled "executed swaps only"; 49.5% labeled "incl. correct holds".
- On-chain 23.1% shown + explained, not hidden (R4).
- Funnel = counts only; no per-agent correctness %.
- No `$`; no realized-aggregate change.

## Testing

Add `tests/unit/pipelineFunnel.unit.test.js` exercising a small pure helper
`computePipelineFunnel(settled)` extracted into
`frontend/app/lib/pipelineFunnel.shared.js` (mirrors executionGuard.shared.js),
so the funnel + executed-win-rate math is unit-tested and reused by the route.
Then: full jest + frontend lint + build + live `/api/performance` field check.
