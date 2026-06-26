# Execution Guard Metric — Tasks

- [ ] T1. Add `frontend/app/lib/executionGuard.shared.js` with
  `computeExecutionGuard(settledRows)` (R1, R2; design "Shared helper").
- [ ] T2. Add `tests/unit/executionGuard.unit.test.js` (design "Testing").
- [ ] T3. Wire into `frontend/app/api/discipline/route.ts`: extend `OutcomeRow`
  with `outcome?`/`pnlBps?`, compute `executionGuard` from `outcomeRows`, add to
  response (R1, R5, R6).
- [ ] T4. Add the honestly-labeled `Tile` to `/discipline` `SummaryCard`
  (R3, R4); render only when `intentNotExecuted > 0`.
- [ ] T5. Verify: jest (targeted + full) + backend/frontend lint + frontend
  build; PR; CI green; merge; confirm `/api/discipline` returns `executionGuard`
  on live prod.
