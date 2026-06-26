# Drawdown Honesty — Tasks

- [ ] T1. `/api/backtest/route.ts`: compute `realizedSwapDrawdownBps`,
  `realizedSwapDrawdownPct`, `realizedSwapCount`, `worstExecutedSwapBps` from
  executed GOOD_CALL/BAD_CALL rows; add to `summary`; update `scoreMethodology`
  (R2, R4, R5).
- [ ] T2. `/backtest/page.tsx`: add `hint?` prop to `StatCard` (native title);
  relabel "Max Drawdown" -> "Max score drawdown" with tooltip (R1, R3);
  add "Realized swap drawdown" card with tooltip (R2, R3).
- [ ] T3. Verify: full jest + frontend lint (changed files) + frontend build.
- [ ] T4. Ship: commit, PR, CI green, merge, delete remote branch, confirm
  live `/api/backtest` returns `realizedSwapDrawdownBps`.
