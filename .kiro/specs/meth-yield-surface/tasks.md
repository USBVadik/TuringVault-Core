# mETH Native Yield Surface — Tasks

> Estimated total: 2–2.5h. Specs-first complete; ship in order.

## T1 — Source module: `src/onchain/methRate.js`  [45m]

- [ ] Implement `fetchMethRate({timeoutMs})` with the 3-source
      chain (DefiLlama → meth.mantle.xyz stats → L1 RPC).
- [ ] Implement `readSnapshot()` / `writeSnapshot()` against
      `src/data/meth_rate_history.json`. Atomic writes (tmpfile +
      rename, mirror outcomeTracker pattern).
- [ ] Implement `referenceRate()` — read-or-set-once semantic.
- [ ] Implement `calcPassiveYield({balance, rateNowAtomic,
      rateRefAtomic, ethPriceUsd})`. Handles drift case
      (returns 0 + assetHealth: "drift").
- [ ] Capacity-bound the captures array at 720 entries.

## T2 — Cron integration: `src/orchestrator/multiAgentLoop.js`  [10m]

- [ ] After outcome.record() returns, call
      `await captureMethRate(...)` inside try/catch with warn-only
      fallback. Cycle MUST NOT fail if capture fails.

## T3 — API route: `frontend/app/api/yield-meth/route.ts`  [25m]

- [ ] GET handler returning the schema in the design doc.
- [ ] Wallet balance read: re-uses
      `frontend/app/lib/`-side helper or fetches `/api/performance`
      internally to avoid duplicate RPC.
- [ ] SWR headers `s-maxage=60, stale-while-revalidate=300`.
- [ ] Server-side honesty check: if `degraded === true`, set a
      response header `X-Cache-Mode: swr-stale-snapshot`.

## T4 — Homepage card row: `frontend/app/page.tsx`  [25m]

- [ ] Fetch `/api/yield-meth` in the existing performance useEffect
      block.
- [ ] Add a 6th stat card titled "Passive Yield · mETH LST".
- [ ] Provenance pill: `via:defillama` | `via:meth.mantle.xyz`
      | `via:l1-rpc` | `cached:<src> · <ageMin>m`.
- [ ] Asset-health pill: `pegged` (green) | `drift` (red).
- [ ] Tooltip with full attribution copy from design doc.
- [ ] No regression in existing 5 cards.

## T5 — Tests: `tests/unit/methRate.unit.test.js`  [25m]

- [ ] All cases enumerated in the design doc (8 unit tests
      minimum).
- [ ] All happy + degraded + drift paths covered.
- [ ] Reference-rate persistence test (first-set, no-overwrite).

## T6 — Validation  [15m]

- [ ] `npx jest --silent` — must remain ≥256/256 passing AND add
      the new methRate tests on top.
- [ ] `npx eslint src/ --max-warnings 50` — 0 errors.
- [ ] `cd frontend && npm run lint` — 0 errors, no new warnings.
- [ ] `cd frontend && npx tsc --noEmit` — clean.
- [ ] `cd frontend && npx next build` — clean, route count
      increments by 1 (24 → 25).

## T7 — Documentation  [15m]

- [ ] README claim grid: add row #11 "Native staking yield
      surfaced honestly · mETH LST" pointing at /api/yield-meth.
- [ ] README "Stats" block: mention dual-engine returns.
- [ ] `.kiro/SUBMISSION-CHANGELOG.md` FOR PITCH entry with
      pitch line.
- [ ] `.kiro/audits/24-meth-yield-surface.md` recap.

## T8 — Deferred (track but do not ship in this round)

- [ ] Passive yield series on `/backtest` (gated on ≥30 captures).
- [ ] Backfill historical mETH yield to settled outcomes.
- [ ] cmETH support if agent ever holds it.
