# RWA Allocation Active — Requirements

## Background

After `continuous-cron-and-health` shipped, the agent runs hourly and
records full multi-agent reasoning on chain — but **it does not execute
swaps**. Live cycles only write 4 attestation TXs (proposal, validation,
decision-log, reputation) and stop. The 15 EXECUTED_SWAP entries in
`outcomes.json` are from the legacy grid bot (`runGridCycle.sh`) that
last ran 2026-05-23 and is no longer wired into production.

For an AI x RWA Track judge this is the gap that matters most:

- The dashboard says **"AI RWA Portfolio Manager"**, but
  `/api/decisions` shows zero allocation moves to any RWA asset.
- `+1216 bps cumulative PnL` is from mETH/mUSD trades, not from RWA
  exposure.
- `getIdleParkingSignal()` exists but only `console.log`s. No swap
  has ever touched USDY or USDT0.
- `RWAModule.calculateAllocation()` is dead code — never called by
  any production path.

A liquidity probe on Mantle Mainnet (2026-05-26) confirmed:

| Pool                     | Active-bin reserves              | Notes                       |
| ------------------------ | -------------------------------- | --------------------------- |
| USDY/USDT                | 0 / 0                            | **Dead pool** — cannot swap |
| USDY/mUSD, USDY/WMNT     | no pair                          | —                           |
| **USDT0/USDT**           | **641 218 USDT + 502 822 USDT0** | **~$1.1M, deep**            |
| USDT0/WMNT (binStep 100) | 580 WMNT + 25.72 USDT0           | thin (LP-thin)              |
| mUSD/USDT                | no pair                          | —                           |

Conclusion: **USDT0 is the only on-chain swappable RWA target on
Mantle right now**. USDY is paper-ready but the pool is dry.
USDT0 is LayerZero's omnichain Treasury-collateralized USD — same
real-world backing as USDT, deployable across chains. The RWA
narrative ("AI agent allocating to a tokenized Treasury-backed
instrument") holds.

This spec activates RWA allocation per the user-approved hybrid model:

- **Path A (LLM-driven entry):** the multi-agent decision proposes
  an explicit `RWA_ALLOCATE` or `RWA_EXIT` action when there is a
  clear yield-edge or de-risking case. Validator gates as usual.
- **Path B (deterministic idle-parking floor):** if the agent has
  been FLAT for ≥ 24 h and regime is not `TREND_UP`, an automatic
  rebalance to USDT0 is executed without LLM gating, capped at a
  small fraction of NAV.

Both paths execute through `MerchantMoeDEX.executeSwap()` against
the USDT0/USDT (binStep 1) pair, write a real on-chain TX, and emit
the same proposal/validation/decision-log/reputation chain so the
audit narrative is preserved.

## Scope

### In scope

- `src/rwa/usdt0Module.js` — new module mirroring `RWAModule` API
  for USDT0 (`0x779D…3736`).
- `src/orchestrator/rwaAllocator.js` — single allocator that picks
  between Path A and Path B per-cycle, returns a `RWAIntent` object.
- Hook into `runMultiAgentCycle()` after the LLM consensus step:
  if no `EXECUTED_SWAP` will fire, evaluate the RWA allocator;
  if it returns a non-null intent, execute via Merchant Moe and
  log the swap on chain.
- `MerchantMoeDEX.executeSwap()` upgrades:
  - per-call max-impact gate (default 1%)
  - per-cycle max-allocation gate (default 25% NAV per cycle)
  - daily max-allocation gate (default 50% NAV per 24 h)
- `outcomes.json` schema additive: optional `rwaIntent` field with
  `{source: 'llm'|'idle-parking', from, to, amountIn, txHash}`.
- `/api/decisions` — surface RWA swaps with a clear
  `assetClass: 'rwa-treasury'` tag.
- `/api/strategy` — add `rwaAllocation` block:
  `{currentPctNav, target, source, lastRebalanceAt, daysSinceFlat}`.
- Frontend hero copy already says RWA portfolio manager — no rename
  needed; we just stop the dashboard from being a liar by giving it
  real RWA data to display.
- Honest labels for USDY: `Demo · simulated` (per
  `no-lying-about-state.md`) until pool reactivates.
- Smoke test `npm run smoke:rwa` — dry-run path that exercises the
  allocator without actually executing a swap.
- Operator runbook `.kiro/runbooks/rwa-operations.md`.

### Out of scope

- USDY swap path (pool dead). Module ships, but execute is gated
  off until pool depth > $5 000 active-bin.
- Hyperliquid perps (legacy `executionEngine.js` ignored).
- Multi-asset routing (USDT0 ↔ mETH cross-chain). Single asset
  pair `USDT/USDT0` only.
- Vault contract pattern; this still operates the EOA directly.
- Auto-redemption of USDT0 to bank wire. Hold-to-yield only.
- New on-chain contracts. We use existing `TuringVaultRouter`
  flow + Merchant Moe LB Router.

## Stakeholders

- **Hackathon judge** — wants to see at least one real RWA TX on
  Mantle attributed to the agent's reasoning.
- **Operator (USBVadik)** — needs to be able to pause RWA execution
  without disabling the whole cron.
- **Sponsor partner reviewers** — Ondo, Tether, LayerZero — looking
  at TX history and contract interactions on Mantlescan.

## Glossary

- **RWA target** — a tokenized real-world-asset instrument we
  allocate to. Currently USDT0 (LayerZero omnichain USDT, Treasury-
  collateralized).
- **Allocation NAV** — sum of all wallet holdings priced in USD,
  matching `/api/performance` definition.
- **Idle parking** — automatic move from `mUSD`/`USDT` (legacy) to
  USDT0 when the agent has been FLAT > 24 h and regime ≠ TREND_UP.
- **RWAIntent** — structured object emitted by the allocator
  describing the desired swap: `{source, from, to, amountIn,
amountOutMin, reason}`.

## Functional Requirements

### R1 — USDT0 module mirrors USDY API

**As a** developer,
**I want** a single module shape for any RWA asset,
**so that** adding a third (when USDY pool revives) is a copy-paste.

**Acceptance**

1. THE file `src/rwa/usdt0Module.js` SHALL export a `USDT0Module`
   class with at least: `getPosition(addr)`, `getContextForAI(addr)`.
2. THE module SHALL declare `assetClass: 'rwa-treasury'`,
   `issuer: 'Tether (via LayerZero)'`,
   `underlying: 'US Treasury Bills + cash equivalents'`,
   `currentAPY: 0` (USDT0 is not yield-bearing on its own; surfaced
   honestly), `liquidityRoute: 'USDT/USDT0 binStep=1'`.
3. THE module SHALL expose `address: '0x779Ded0c9e1022225f8E0630b35a9b54bE713736'`.
4. THE module SHALL throw a clear error if invoked with no provider
   or no wallet for `getPosition`.

### R2 — `rwaAllocator` produces a single intent per cycle

**As an** orchestrator,
**I want** one place to ask "should we touch RWA this cycle?",
**so that** Path A and Path B don't both fire at once.

**Acceptance**

1. THE file `src/orchestrator/rwaAllocator.js` SHALL export
   `evaluate({ decision, market, balances, lastSwapAt, posState })`
   returning `RWAIntent | null`.
2. WHEN the multi-agent `decision.consensus === true` and the
   analyst's reasoning explicitly references USDT0/USDY/Treasury/
   risk-off-park, THE allocator SHALL emit
   `{source: 'llm', ...}` (Path A).
3. WHEN `decision.consensus === false` (HOLD) AND
   `posState.status === 'FLAT'` AND
   `now - lastSwapAt > 24 h` AND
   `market.regime !== 'TREND_UP'`,
   THE allocator SHALL emit `{source: 'idle-parking', ...}`
   (Path B).
4. WHEN both conditions are false, THE allocator SHALL return `null`.
5. THE intent SHALL specify `from`, `to`, `amountIn` (BigNumber wei),
   `amountOutMin` (after slippage), `reason` (string ≤ 200 chars),
   `source`.
6. THE allocator SHALL refuse to emit an intent whose `amountIn`
   USD value exceeds `MAX_PER_CYCLE_USD` (default $5 for current
   small-NAV demo; readable from `src/config/rwaLimits.js`).
7. WHEN today's accumulated RWA swap volume already exceeds
   `MAX_PER_DAY_USD` (default $25 with $40 NAV), THE allocator SHALL
   return `null` and log the gate hit.

### R3 — Execution wired into `runMultiAgentCycle`

**As an** operator,
**I want** the cron cycle to actually swap when the allocator says
go, **so that** the dashboard shows real RWA TXs.

**Acceptance**

1. AFTER the existing on-chain attestation chain (proposal,
   validation, decision log, reputation) and BEFORE the agent-card
   refresh step, THE cycle SHALL invoke
   `rwaAllocator.evaluate(...)`.
2. WHEN allocator returns a non-null intent, THE cycle SHALL call
   `MerchantMoeDEX.executeSwap()` with `dryRun: false` using a
   freshly-derived nonce.
3. ON success, the resulting TX hash SHALL be:
   - written into `outcomes.json` for the same cycle's record under
     `rwaIntent.txHash`,
   - included in `last-cycle-summary.json.txHashes` array,
   - prefixed in the existing DecisionLog reasoning text:
     `[RWA-USDT0] Allocator …` (so on-chain proof is grep-friendly).
4. ON allocator returns null, the cycle SHALL log
   `[RWA] No allocation this cycle — gate=<reason>` and proceed.
5. ON Merchant Moe revert / RPC error, the cycle SHALL:
   - log the failure to `data/cycle-failures.json`
   - **not** retry within the same cycle
   - continue with agent-card refresh and final return
   - exit code from `run-cycle.js` remains 0 (soft failure).
6. WHEN `process.env.RWA_EXECUTE_ENABLED !== 'true'`, the cycle
   SHALL evaluate and **log** the intent but skip the actual
   `executeSwap` call (operator dry-run mode).

### R4 — Limits enforced per call

**As a** capital steward,
**I want** hard ceilings on what one cycle can move,
**so that** a runaway loop can't blow the wallet.

**Acceptance**

1. `MerchantMoeDEX.executeSwap(...)` SHALL accept a
   `maxPriceImpactBps` option (default `100` = 1%) and revert
   client-side if the quote's `priceImpact` > limit.
2. THE wrapper SHALL refuse to execute when the wallet's USDT0 +
   USDT (legacy) combined balance is < `$2` USD-equivalent (cannot
   meaningfully demo with dust).
3. THE wrapper SHALL log every accept/reject path including the
   numeric reason.
4. The execution path SHALL use `provider.getTransactionCount(addr,
'pending')` for nonce, not 'latest', to coexist with the 4
   attestation TXs the cycle already pushed.

### R5 — `/api/decisions` and `/api/strategy` reflect RWA

**As a** dashboard,
**I want** to differentiate RWA swaps from mETH/mUSD swaps,
**so that** judges see a populated RWA column.

**Acceptance**

1. `/api/decisions` SHALL include `assetClass` per row:
   `'rwa-treasury' | 'eth-staking' | 'stable' | 'native' | null`,
   inferred from `targetAsset` and `outcomes.json.rwaIntent`.
2. `/api/strategy` SHALL include `rwaAllocation` block:
   ```json
   {
     "currentPctNav": <number>,
     "target": { "min": 10, "max": 50 },
     "lastRebalanceAt": <ISO|null>,
     "daysSinceLastFlatStart": <number|null>,
     "executeEnabled": <bool>,
     "source": "llm" | "idle-parking" | "none"
   }
   ```
3. WHEN any required source file is missing, the response SHALL
   default the field to a safe empty value, not crash.
4. NO secret/credential fields shall leak.

### R6 — Honest labels for USDY (paper-ready, dry pool)

**As a** judge,
**I want** to know what's executable today vs. what's coded for
later, **so that** the project doesn't claim live USDY allocation
when the pool is dead.

**Acceptance**

1. THE landing page strategy section SHALL display, when relevant:
   `RWA targets: USDT0 (active) · USDY (paper-ready, awaiting
Mantle pool depth)`.
2. `RWAModule.executeSwap()` SHALL refuse with a typed error
   `RWA_POOL_INACTIVE` if it ever gets called from production, so
   nobody silently re-enables USDY swap when the pool is still dry.
3. The honest-state checklist (`no-lying-about-state.md`) SHALL pass
   after this spec ships.

### R7 — Smoke test `smoke:rwa`

**As a** developer,
**I want** to dry-run the full allocator pipeline without spending
gas, **so that** I can iterate on the prompt/threshold logic.

**Acceptance**

1. `package.json` SHALL gain script `smoke:rwa` running
   `node scripts/smoke-rwa.js`.
2. The script SHALL:
   - synthesize a fake `decision` for each combination of
     `(consensus, regime)` (12 cases),
   - call `rwaAllocator.evaluate(...)` against current real on-chain
     balances,
   - print `null | intent` per case,
   - exit 0 if at least 4/12 cases yield a non-null intent
     (idle-parking + 3 LLM regimes), else 1.
3. The script SHALL NOT submit any TX, regardless of
   `RWA_EXECUTE_ENABLED`.

### R8 — Operator runbook for RWA operations

**As an** operator,
**I want** a one-page reference for RWA-specific operations,
**so that** I can pause/resume and debug without re-reading the spec.

**Acceptance**

1. THE file `.kiro/runbooks/rwa-operations.md` SHALL exist with
   sections:
   - **Pause RWA execution** — set `RWA_EXECUTE_ENABLED=false`
     in GitHub Actions secrets; cycle continues with no TX.
   - **Tune limits** — where to find `MAX_PER_CYCLE_USD` and
     `MAX_PER_DAY_USD` constants.
   - **Read RWA TX log** — Mantlescan filter URL for the
     USDT0/USDT pool with our wallet as sender.
   - **Recover from failed swap** — common causes (insufficient
     allowance, slippage, nonce gap) and fix steps.
   - **Reactivate USDY** — preconditions for switching USDY
     `executeSwap` from gated-off to live.

### R9 — Honesty rule compliance

1. The dashboard SHALL NOT claim "AI is allocating to USDY" until a
   real USDY swap exists in `outcomes.json`.
2. When `RWA_EXECUTE_ENABLED=false`, `/api/strategy.rwaAllocation
.executeEnabled` SHALL report `false` AND the dashboard hero
   SHALL display `RWA · simulation mode` next to the badge.
3. After a single successful USDT0 swap, the dashboard MAY display
   `RWA · live · last allocation <timestamp>`. No earlier.

## Non-Functional Requirements

### NFR1 — Repo size discipline

The new modules add < 30 KB. No bundled large data files.

### NFR2 — Cost guardrails

Per-cycle RWA TX adds 1 swap = ~0.005 MNT gas + the swap fee
(~0.01% on binStep=1). At 24 cycles/day max in idle-parking mode,
worst-case daily cost ≤ 0.15 MNT (~$0.10). Acceptable.

### NFR3 — Determinism for Path B

Path B (idle-parking) MUST be deterministic: given the same wallet
state and `lastSwapAt`, two replays SHALL emit the same intent.

### NFR4 — Reverts don't corrupt state

If a swap reverts on chain, no state-file write that pretends it
succeeded. `outcomes.json.rwaIntent.txHash` is `null` in that case
and `errors[]` is populated in `last-cycle-summary.json`.

### NFR5 — No hidden retries

Each cycle gets exactly one swap attempt. Failed swaps wait for the
next hour's cron.

## Success Criteria

This spec is done WHEN:

1. At least **one real USDT0 swap TX** has been recorded by the cron
   path (TX hash visible on Mantlescan for our agent EOA).
2. `outcomes.json` has at least 1 entry with
   `rwaIntent.source === 'idle-parking'` AND 1 with `source === 'llm'`.
3. `/api/strategy.rwaAllocation` returns real numbers (not nulls).
4. `/api/decisions` includes the RWA TX with `assetClass:
'rwa-treasury'`.
5. Frontend dashboard shows RWA strip in honest mode (live or
   simulation, depending on flag).
6. `npm run smoke:rwa` exits 0.
7. `no-lying-about-state.md` checklist passes.
8. Runbook is comprehensible to someone who hasn't read this spec.

## Open Questions

1. **Where in the cycle do we run the allocator?** After all 4
   attestation TXs, or before reputation feedback?

   - **Recommendation:** after attestations, before agent-card
     refresh. The swap then earns its own attestation only on the
     next cycle's settlement, which mirrors how settled outcomes
     work today.

2. **Should the LLM Path A actually be a separate prompt, or can we
   reuse the existing Analyst by extending its action vocabulary?**

   - Option A1: extend `action ∈ {"swap", "hold", "rwa_allocate",
"rwa_exit"}` and update both prompt + Zod schema.
   - Option A2: add a third agent role "RWA Strategist" called only
     when consensus is HOLD.
   - **Recommendation:** A1 (cheaper, single-shot). The existing
     prompt already has regime-aware HOLD reasoning; we only need
     to teach it that "park to USDT0" is a valid form of HOLD.

3. **Cooldown after a Path B swap?** If we just parked, when can
   the next idle-parking fire?

   - **Recommendation:** `now - lastRwaSwapAt > 6 h` even within
     the FLAT-24h window, so we don't churn on hourly cron noise.

4. **Should we support reverse direction (USDT0 → USDT) on
   regime change?** If we go FLAT→TREND_UP after parking, do we
   exit USDT0?

   - **Recommendation:** yes. Path A `RWA_EXIT` triggers when
     analyst is bullish AND we hold > 30% NAV in USDT0. Path B
     never triggers exit (only parking).

5. **Do we touch USDT (legacy) at all, or should idle-parking
   only consume mUSD?**

   - Wallet currently holds 6.763 USDT legacy + 2.387 USDT0.
     Legacy USDT is a non-yield idle stablecoin — perfect input
     for idle-parking. mUSD balance is 0.
   - **Recommendation:** USDT (legacy) is the primary
     idle-parking source until mUSD position re-emerges.

6. **Does USDT0 yield, or is it just 1:1 USDT?**
   - USDT0 (LayerZero) is bridge-wrapped Tether. It does not
     accrue yield itself. The narrative we ship is "exposure to a
     transparent omnichain Treasury-backed instrument" — not "earn
     yield". **Frontend MUST not claim an APY on USDT0.**

## Dependencies

- `MerchantMoeDEX.executeSwap` (already exists, needs limits
  upgrade per R4).
- `outcomeTracker.record` accepts arbitrary metadata via `...rest`
  spread today.
- GitHub Actions secret `RWA_EXECUTE_ENABLED` (boolean string).
  Operator sets via runbook.

## Risks

- **R-A**: USDT0/USDT pool re-prices unexpectedly during a swap.
  Mitigation: 1% max impact gate, slippage 50 bps default.
- **R-B**: Allowance wasn't pre-set; `approve` adds an extra TX
  costing gas. Mitigation: pre-approve `MaxUint256` on first
  successful run (one-shot, persisted to memory of the cron).
- **R-C**: A cycle commits the swap but `data/last-cycle-summary
.json.txHashes` write fails after — we'd have an orphan TX.
  Mitigation: write summary first with `txHashes` placeholder
  containing the hash from the receipt, then attempt other state
  writes; the txHash is canonical on chain regardless.
- **R-D**: Idle-parking starts churning mid-day (e.g., wallet sits
  FLAT but volatile). Mitigation: 6-h cooldown between successful
  Path B swaps (Q3).
- **R-E**: USDY pool reactivates and we forget to flip the gate.
  Mitigation: README + runbook entry; `executeSwap` for USDY
  throws `RWA_POOL_INACTIVE` until manually toggled.
- **R-F**: Judges expect _yield_, but USDT0 doesn't yield. We must
  control the narrative ("transparent Treasury-backed allocation,
  not yield-chasing"). Documented in submission rewrite (separate
  spec).
