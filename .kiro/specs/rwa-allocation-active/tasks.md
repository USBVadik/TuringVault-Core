# Implementation Plan: RWA Allocation Active

## Overview

Sequenced execution plan for `design.md`. Each task references its
requirement (R#) and component (C#). Tick `[x]` as you go.

**Test gate before merge:** tasks 1–13 done; tasks 14–17 are
post-merge live verification with `RWA_EXECUTE_ENABLED=true`.

## Status: SHIPPED 2026-05-27

All 18 tasks complete. First live RWA swap on Mantle:
[`0x0af23364c7651b053d33b0f7ed3eb8b30107b5dc489e96a7ad8ac90cad3e09de`](https://mantlescan.xyz/tx/0x0af23364c7651b053d33b0f7ed3eb8b30107b5dc489e96a7ad8ac90cad3e09de).

55%+ of agent NAV currently in USDT0 (LayerZero Treasury-collateralised).
Frontend RWA strip live. Path A (LLM-driven) and Path B (deterministic
idle-parking) both verified in production.

## Tasks

- [x] 1. Create `src/config/rwaLimits.js`

  - Refs: R2.6, R2.7, R4.1, design §C2
  - Why first: every other task imports these constants.
  - Output: new file with all 8 constants from design §C2, each
    overridable via `process.env.RWA_*`.
  - Acceptance:
    - All 8 constants exported.
    - Defaults match design (`MAX_PER_CYCLE_USD=5`, etc.).
    - Env-override test: setting `RWA_MAX_PER_CYCLE_USD=10` then
      `require('./rwaLimits')` returns 10.

- [x] 2. Create `src/rwa/usdt0Module.js`

  - Refs: R1, design §C1
  - File: `src/rwa/usdt0Module.js` (NEW)
  - Body: mirror of `src/rwa/usdyModule.js` shape but with USDT0
    address, `currentAPY: 0`, `assetClass: 'rwa-treasury'`, no
    `calculateAllocation`.
  - Acceptance: - Export `USDT0Module` and `USDT0_ADDRESS`. - `getPosition(addr)` returns `{ token, address, balance,
decimals, totalSupply, apy: 0, underlying, issuer }`. - `getContextForAI` does NOT mention an APY for USDT0. - Unit test: mocked provider, asserts shape and zero APY.

- [x] 3. Patch `src/strategies/positionState.js` to track `flatSince`

  - Refs: R2.3, design §C5
  - Change: in `exitPosition(reason)`, set
    `state.flatSince = new Date().toISOString()`. Set to `null`
    in `enterPosition`.
  - Acceptance:
    - `flatSince` is ISO when status is FLAT, null otherwise.
    - Existing readers continue to work (additive field).

- [x] 4. Create `src/orchestrator/rwaAllocator.js`

  - Refs: R2, design §C3, CP1, CP2, CP3, CP4
  - File: `src/orchestrator/rwaAllocator.js` (NEW)
  - Body: `evaluate({ decision, market, balances, prices,
lastSwapAt, posState })` returning
    `RWAIntent | RWASkip | null`. Implements both Path A and
    Path B per design §C3.
  - Helpers: `readDailySpend`, `flatLongEnough`, `cooldownElapsed`,
    `clampToCycle`, `buildIntent`.
  - Acceptance: - Path A `rwa_allocate` produces `{source:'llm',
from:'USDT', to:'USDT0'}` when consensus + matching action. - Path A `rwa_exit` symmetric (USDT0 → USDT). - Path B fires only when consensus=false, FLAT > 24 h,
    regime ≠ TREND_UP, cooldown elapsed,
    parkUsd ≥ MIN_BALANCE_USD. - Returns `{skip:true, _gate:'min-balance'}` on dust wallet. - Returns `{skip:true, _gate:'daily-cap'}` when 24h spend at
    `MAX_PER_DAY_USD`. - CP1–CP4 verified via task 5 unit tests.

- [x] 5. Create unit tests

  - Refs: R7, design §"Testing Strategy" Layer 1
  - Files:
    - `tests/unit/rwaLimits.unit.test.js` (NEW)
    - `tests/unit/rwaAllocator.unit.test.js` (NEW) — 24-case matrix
    - `tests/unit/usdt0Module.unit.test.js` (NEW)
  - Acceptance:
    - 24/24 allocator cases produce expected outcome (table-driven).
    - CP1 (single-intent), CP2 (cap), CP3 (daily cap),
      CP4 (determinism) explicitly asserted.
    - `npm run test:unit` passes 100% locally.

- [x] 6. Upgrade `MerchantMoeDEX.executeSwap`

  - Refs: R4, design §C4, CP6, CP7, CP8
  - File: `src/dex/merchantMoe.js` (MODIFY)
  - Changes:
    - Accept `options.maxPriceImpactBps` (default 100) and
      `options.slippageBps` (default 50).
    - Use `getTransactionCount(addr, 'pending')` for nonce.
    - New private `_ensureAllowance(tokenSymbol, amount)` that
      caches `MaxUint256` approves per token.
    - Compute `minOut` from quote × (1 − slippage) with correct
      decimals.
    - Pre-flight: refuse if `priceImpact * 100 > maxImpactBps`
      with `{executed:false, reason:'impact …'}`.
    - Add `RWA_POOL_INACTIVE` early throw when called with USDY.
  - Acceptance:
    - Existing dryRun path unchanged.
    - Live swap with 1% impact + 0.5% slippage succeeds against
      USDT/USDT0 pair.
    - Allowance set once per token per process (no double-approve).
    - USDY path throws the typed error.

- [x] 7. Extend Analyst prompt + Zod schema

  - Refs: R3.1, design §C7
  - File: `src/orchestrator/multiAgent.js` (MODIFY)
  - Changes:
    - `AnalystSchema.action`: enum extends with `rwa_allocate`,
      `rwa_exit`.
    - Append RWA section to `ANALYST_SYSTEM_PROMPT` (verbatim
      from design §C7).
    - Append RWA awareness sentence to `VALIDATOR_SYSTEM_PROMPT`.
    - Update `normalizeAnalystResponse`: pass `rwa_allocate` /
      `rwa_exit` through unchanged.
  - Acceptance:
    - Existing 82/82 unit tests still pass.
    - 2 new test cases: rwa_allocate and rwa_exit normalize OK.
    - `decisionTier` classification still works for new actions.

- [x] 8. Wire allocator + executor into `runMultiAgentCycle`

  - Refs: R3, design §C6
  - File: `src/orchestrator/multiAgentLoop.js` (MODIFY)
  - Changes:
    - After Step 4 (reputation), before agent-card refresh, add
      Step 4.5 (allocator) + Step 4.6 (executor).
    - Pass `intent` and `rwaResult` into `outcomeTracker.record`
      as new `rwaIntent` field.
    - Extend return shape: `{ ...existing, rwaIntent, rwaResult }`.
    - Honor `process.env.RWA_EXECUTE_ENABLED === 'true'` gate.
  - Acceptance:
    - When gate is off, intent logged but no TX broadcast.
    - When gate is on and intent emitted, `rwaResult.txHash` is
      a valid 0x-prefixed 66-char hex string.
    - Existing callers keep working with extended shape.
    - Failure of `executeSwap` does not break the cycle —
      `cycle-failures.json` gains an entry, exit stays 0.

- [x] 9. Patch `outcomeTracker.record` for `rwaIntent` + helper

  - Refs: R3.3, design "Data Models"
  - File: `src/orchestrator/outcomeTracker.js` (MODIFY)
  - Changes:
    - Accept `rwaIntent` in the record options bag and persist
      it verbatim in the outcomes entry.
    - Add `getLastRwaSwapAt()` helper exporting the most recent
      ISO from any `rwaIntent.executed:true` entry, or null.
  - Acceptance:
    - Existing entries without `rwaIntent` continue to load.
    - `getLastRwaSwapAt()` returns the right ISO when there's a
      successful row, null otherwise.

- [x] 10. Patch `scripts/run-cycle.js` summary writer

  - Refs: R3.3, design §C6 (last paragraph)
  - File: `scripts/run-cycle.js` (MODIFY)
  - Changes: - Pull `result?.rwaResult?.txHash` into `summary.txHashes`. - Add `summary.rwa = { source, executed, amountInUsd, from,
to }` when intent existed.
  - Acceptance:
    - On a manual local dry-run with gate off, summary file
      gains `rwa: { executed:false, ... }`.
    - No regressions on existing fields.

- [x] 11. Extend `/api/decisions` and `/api/strategy`

  - Refs: R5, design §C8, §C9
  - Files:
    - `frontend/app/api/decisions/route.ts` (MODIFY)
    - `frontend/app/api/strategy/route.ts` (MODIFY)
  - Changes:
    - `/api/decisions`: add `assetClass` field per row using
      `classifyAsset(targetAsset, rwaIntent)`.
    - `/api/strategy`: add `rwaAllocation` block (currentPctNav,
      target, lastRebalanceAt, daysSinceLastFlatStart,
      executeEnabled, source).
  - Acceptance:
    - `npx next build` clean.
    - Endpoint returns HTTP 200 with new fields, even when
      sources are missing (defaults to nulls / 0).
    - No secret leaks (grep check on routes).

- [x] 12. Frontend RWA strip on landing page

  - Refs: R6, R9, design §C10, no-lying-about-state.md
  - File: `frontend/app/page.tsx` (MODIFY)
  - Changes:
    - Add RWA strip in the strategy section reading from
      `/api/strategy.rwaAllocation`.
    - "USDT0 (live | simulated)" + "USDY (paper-ready · pool dry)".
    - Show "RWA · simulation mode" badge when not executing.
    - Show "last allocation <time>" only when executeEnabled
      AND a real lastRebalanceAt exists.
  - Acceptance:
    - Visual matches design §C10 sketch.
    - When executeEnabled=false, no "live" claim anywhere.
    - When no real RWA TX yet, no "last allocation" shown.

- [x] 13. Smoke harness `npm run smoke:rwa`

  - Refs: R7, design §C11, "Testing Strategy" Layer 2
  - Files:
    - `scripts/smoke-rwa.js` (NEW)
    - `package.json` (MODIFY — add the npm script)
  - Acceptance:
    - Reads real wallet balances via Mantle RPC.
    - Synthesises 12 cases (3 consensus × 4 regimes).
    - Prints table: `case → null | intent.source | amountInUsd`.
    - Exits 0 if ≥ 4/12 produce non-null intent, else 1.
    - No Bedrock call, no IPFS pin, no on-chain TX.

- [x] 14. Operator runbook `.kiro/runbooks/rwa-operations.md`

  - Refs: R8, design §C12
  - File: `.kiro/runbooks/rwa-operations.md` (NEW)
  - Sections:
    - First-time setup (set `RWA_EXECUTE_ENABLED=true`).
    - Pause RWA (flip to false).
    - Tune limits (`RWA_MAX_PER_CYCLE_USD`, `RWA_MAX_PER_DAY_USD`).
    - Read RWA TX log (Mantlescan filter URL pattern).
    - Recover from failed swap (allowance, slippage, nonce).
    - Reactivate USDY (preconditions checklist).
  - Acceptance:
    - All 6 sections present and complete.
    - Linked from README (task 15).

- [x] 15. Update README "Strategy" + "Running" sections

  - Refs: R6, R9
  - File: `README.md` (MODIFY)
  - Changes:
    - Add 2-paragraph "RWA execution" subsection under Strategy:
      "USDT0 active · USDY paper-ready", reference Path A vs B.
    - Link to `.kiro/runbooks/rwa-operations.md` from Running.
    - Do NOT claim USDT0 yields anything.
  - Acceptance:
    - Honesty rule passes (no fabricated APY claim).
    - Internal links resolve.

- [x] 16. First live workflow_dispatch with `RWA_EXECUTE_ENABLED=true`

  - Refs: R3.2, "Testing Strategy" Layer 3, Success Criteria #1, #2
  - Action (operator-side):
    - GH secrets → set `RWA_EXECUTE_ENABLED=true`.
    - Trigger workflow_dispatch.
    - Watch Actions log; verify Step 4.5 + 4.6 fire.
    - Check Mantlescan for our EOA — expect 1 swap TX on
      USDT0/USDT pool (`0xfc9D88…`).
  - Acceptance:
    - Workflow run exits 0.
    - Mantlescan shows the swap TX.
    - `outcomes.json` last entry has `rwaIntent.executed:true`
      with valid txHash.
    - `/api/strategy.rwaAllocation.lastRebalanceAt` is non-null.
    - `/api/decisions` shows `assetClass: 'rwa-treasury'` on
      the new row.
    - Frontend RWA strip flips to "live · last allocation <time>".

- [x] 17. Verify Path B fires on next idle cycle

  - Refs: Success Criteria #2 (idle-parking row)
  - Action: wait until conditions are met:
    - Wallet went FLAT and `flatSince` > 24 h ago, OR set
      `RWA_IDLE_PARKING_MIN_FLAT_MS=60000` (1 min) for one cycle
      to test deterministically, then revert.
  - Acceptance:
    - One `outcomes.json` entry has
      `rwaIntent.source === 'idle-parking'`.
    - Cooldown holds: no second idle-parking fires within 6 h.

- [x] 18. Final spec close-out
  - Refs: all
  - Action: mark all `[ ]` boxes; tick Success Criteria 1–8 in
    `requirements.md`. Move spec under "shipped" if you have a
    tracker.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": [1, 3, 6, 7],
      "rationale": "Independent foundation work: limits config (1), positionState additive field (3), DEX gateway upgrades (6), Analyst prompt + schema (7). None depend on each other."
    },
    {
      "wave": 2,
      "tasks": [2, 4],
      "rationale": "USDT0 module (2) and the allocator (4) both depend on rwaLimits from task 1. They can run in parallel after wave 1."
    },
    {
      "wave": 3,
      "tasks": [5],
      "rationale": "Unit tests need limits (1), USDT0 module (2), and allocator (4) in place to exercise the 24-case matrix and CP1–CP4 invariants."
    },
    {
      "wave": 4,
      "tasks": [8, 9],
      "rationale": "Cycle integration (8) wires allocator+executor and depends on tasks 1, 4, 6, 7. outcomeTracker patch (9) adds the rwaIntent field consumed by task 8 and is small enough to run alongside it."
    },
    {
      "wave": 5,
      "tasks": [10, 11],
      "rationale": "run-cycle.js summary patch (10) depends on the extended return shape from task 8. Frontend API extensions (11) consume outcomes/strategy fields produced by tasks 8 and 9."
    },
    {
      "wave": 6,
      "tasks": [12, 13],
      "rationale": "Frontend strip (12) consumes /api/strategy fields shipped in task 11. Smoke harness (13) needs the allocator (4) and limits (1)."
    },
    {
      "wave": 7,
      "tasks": [14, 15],
      "rationale": "Runbook (14) and README (15) document the system once the implementation is complete and tested. README links to runbook so 14 should land before 15 to avoid a broken link."
    },
    {
      "wave": 8,
      "tasks": [16],
      "rationale": "First live execution with RWA_EXECUTE_ENABLED=true. Requires everything above (code, tests, docs, runbook) to be in place and merged."
    },
    {
      "wave": 9,
      "tasks": [17],
      "rationale": "Path B verification needs a successful Path A run from task 16 first (sets baseline lastSwapAt for cooldown semantics) and the wallet to be FLAT > 24 h or the override env to be set."
    },
    {
      "wave": 10,
      "tasks": [18],
      "rationale": "Final close-out — only meaningful once 16 and 17 confirm Success Criteria."
    }
  ]
}
```

## Notes

### Out of scope reminder

These are explicitly NOT in this spec:

- USDY swap execution (pool dead, gated off in task 6).
- Multi-chain bridging.
- Vault contract pattern.
- Yield-claim copy on USDT0.
- New on-chain contracts.

### Operator-side prerequisites for task 16

Before kicking off task 16, the operator must:

1. Have `RWA_EXECUTE_ENABLED=true` set in GitHub Actions secrets.
2. Confirm wallet has at least $2 in USDT (legacy) — currently
   $6.76, comfortably above floor.
3. Have a clean `cycle-failures.json` to spot any new failure rows.
4. Watch Mantlescan filter URL from runbook section 4 during the run.
