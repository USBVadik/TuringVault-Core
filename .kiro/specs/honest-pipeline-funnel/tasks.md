# Honest Pipeline Funnel — Tasks

- [ ] T1. `frontend/app/lib/pipelineFunnel.shared.js`: pure
  `computePipelineFunnel(settled)` -> { executedTradeWinRate, executedTradeWins,
  executedTradeLosses, executedTradeTotal, pipelineFunnel:{...} } (R1, R2).
- [ ] T2. `tests/unit/pipelineFunnel.unit.test.js` (design "Testing").
- [ ] T3. `/api/performance/route.ts`: call the helper, spread results into the
  response; clarify notes (R1, R2, R6).
- [ ] T4. `page.tsx`: replace card 1 (Trade win rate), relabel card 2 (Decision
  quality), add funnel strip + on-chain reconciliation line (R3, R4, R5).
- [ ] T5. Verify: full jest + frontend lint (changed files) + frontend build.
- [ ] T6. Ship: commit, PR, CI green, merge, delete branch, confirm live
  `/api/performance` returns `executedTradeWinRate` + `pipelineFunnel`.
