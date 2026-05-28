# 2026-05-28 — Trading Unblock Audit

| Meta | Value |
|------|-------|
| Auditor | Kiro (operator-supervised, USBVadik) |
| Day-of-investigation | 2026-05-28 |
| Trigger | Operator: "ни одна сделка не происходит, я неделю с этим бьюсь" |
| Outcome | First autonomous on-chain trade from this codebase landed at 2026-05-28T15:36:22Z (cron cycle 123). Proof: Mantlescan TX hashes below. |
| This report | Captures cause, fix sequence, evidence; survives in `.kiro/audits/` so a judge can replay the diagnosis. |

---

## TL;DR

For the prior week, every cron commit message read `cycle N EXECUTED_SWAP` and every `data/last-cycle-summary.json` advertised `decisionTier=EXECUTED_SWAP, consensus=true`. **No corresponding DEX TX existed on-chain.** The agent attested — via `submitProposal`, `validateProposal`, `logDecision`, `submitFeedback`, `setAgentURI` — but never broadcast a swap.

Three independent bugs in `src/dex/merchantMoe.js` plus one design flaw in Step 4.7 of `src/orchestrator/multiAgentLoop.js` compounded to silently block every trade. The classifier in `src/orchestrator/decisionTier.js` mapped intent→`EXECUTED_SWAP` regardless of execution, so the false claim flowed through to commit messages, dashboards, and outcomes. Workspace steering rule `.kiro/steering/no-lying-about-state.md` §4 (no fake liveness) was being violated on every cycle.

Evidence: `0x313c0fc20541a7662ecfe2f9f5966c7f5e57a06495b6aae9ee30ade140b57c96` (cron cycle 123, RWA allocate, USDT→USDT0), `0x4e2107826167d16ae59512ebb401ff965105bfd8102e8ebb6001f26ffea752f2` (cron cycle 123, directional leg 2), `0xca4d080429637e6aaf6042ae82cd2e3adfc7eb1287efa266f9ef876f010c40c9` (operator manual probe via patched `MerchantMoeDEX.executeSwap`).

---

## Method

Followed `.kiro/steering/audit-style.md`:

1. Did **not** start by reading source. Started by inventorying observable surfaces:
   - Wallet on-chain TX history via Routescan API (last 200 TXs from agent EOA `0xDC78…fb5a`).
   - `data/last-cycle-summary.json` — what cron claims.
   - GitHub Actions run history via API.
   - Vercel deployment status via API.

2. Cross-checked cron's claims against the chain. Found that for cycles 113-122, every commit said `EXECUTED_SWAP` but the agent EOA never called any DEX router (`MoeLBRouter`, `OdosRouter`, `MoeSmartRouter`).

3. Only **then** read source — pulled the Step 4.7 directional swap code in `multiAgentLoop.js`, the allocator gate in `rwaAllocator.js`, and the quote/execute path in `merchantMoe.js`.

4. Prober scripts written (`scripts/probe-lb-pairs.js`, `scripts/probe-execute-dry.js`, `scripts/probe-execute-live.js`, `scripts/probe-directional-2hop.js`) so each diagnosis step left a re-runnable artifact.

5. Made one real swap from the codebase (probe-execute-live, 5 USDT0 → USDT) before merging anything to `main`.

---

## Findings (in order of compounding effect)

### Bug 1: `MerchantMoeDEX.findPair()` picked the shallowest pool

The factory returns multiple LB pairs for `(USDT, WMNT)`: binSteps 15 / 25 / 50 / 100 / 20. The canonical deep pool ($1.18M TVL on Merchant Moe's UI) sits on binStep=25. The code sorted ascending by binStep and returned the binStep=15 pool, which had only $1.3K reserves — a stale pair that had drained months ago.

```js
// before
valid.sort((a, b) => Number(a.binStep) - Number(b.binStep));
return valid[0];
```

Effect: every USDT/WMNT or USDT0/WMNT quote was routed through a near-empty pool.

Fix: rank candidates by the on-chain `getReserves()` sum, not by binStep.

### Bug 2: `MerchantMoeDEX.getQuote()` derived priceImpact from the active bin only

```js
// before
const reserveFloat = swapForY ? formatUnits(reserveX, decX) : ...;
const priceImpact = reserveFloat > 0 ? (amountInFloat / reserveFloat) * 100 : 100;
return { ..., viable: priceImpact < 10 };
```

LB v2.2 active bins are intentionally narrow ($30-$50 typical). Any swap larger than the active bin returned ~100% priceImpact, even when the surrounding bins held millions in TVL — and `viable=false` blocked the swap.

Fix: call the LB Pair's own `getSwapOut(amountIn, swapForY)` (already in `LB_PAIR_ABI` but unused) — it walks bins and returns the real `amountOut` and `fee`. priceImpact is then computed as the relative shortfall from midprice in **fractional** units. `executeSwap` was also adjusted to compare in bps (×10000) to `maxImpactBps`.

### Bug 3: Step 4.7 directional swap hardcoded mUSD ↔ mETH

```js
// before
if (decision.consensus && analystAction === "swap" &&
    (targetAsset === "mETH" || targetAsset === "mUSD")) {
  const fromToken = targetAsset === "mETH" ? "mUSD" : "mETH";
  ...
}
```

The demo wallet has held essentially zero mUSD and zero mETH for weeks (current balances: 0 / 0.0014). The code thus always landed in `insufficient-balance` and never broadcast. The agent was unable to express its `targetAsset='mUSD'` decisions in any executable path.

Fix: rewrite Step 4.7 to translate the analyst's `targetAsset` into an executable 2-leg path on the wallet's actual liquid universe:

```
risk-on   (target ∈ {mETH, MNT, WMNT, WETH}): USDT0 → USDT → WMNT
risk-off  (target ∈ {mUSD, USDT, USDT0}):     WMNT  → USDT → USDT0
```

Both legs use `MerchantMoeDEX.executeSwap` (now patched). Per-leg results bubble up as `directionalSwap.legs[]` so the operator and dashboard see the full trail.

### Design flaw: decisionTier semantics conflated intent with execution

`src/orchestrator/decisionTier.js` maps `consensus=true && action='swap'` → `EXECUTED_SWAP`. That's a fine name for a **classifier of intent**, but the same string then propagates into:
- The cron commit message (`chore(cron): cycle N EXECUTED_SWAP`).
- `data/last-cycle-summary.json:decisionTier`.
- The dashboard's "Last cycle" badge.

When the swap doesn't actually execute, those three surfaces lie in unison. Workspace steering rule `no-lying-about-state.md` §4 is exactly about this case.

Fix: keep `decisionTier` as-is (it's used by tests and is a coherent intent label), but introduce `executionStatus` in `run-cycle.js`. Post-Step 6, if `decisionTier===EXECUTED_SWAP` and no DEX TX hash exists, rewrite `decisionTier='INTENT_SWAP_NO_EXEC'` and set `executionStatus='INTENT_ONLY'`. Otherwise mirror tier into status. The cron commit then carries the truthful tier.

### Backfill: 24 historical rows in `outcomes.json` carried the lie

A one-shot script `scripts/backfill-outcomes-honesty.js` walked `src/data/outcomes.json` and added two computed fields per row:

- `executedOnChain: bool` — true iff the row carries proof of a swap (`txHash`, `rwaIntent.executed`, or `directionalSwap.legs[*].txHash`).
- `_displayTier: string` — same as `decisionTier`, but rewritten to `INTENT_SWAP_NO_EXEC` when the row claimed `EXECUTED_SWAP` without a TX.

The original `decisionTier` is preserved verbatim — that's an auditable record of what the classifier believed on the day.

24 of 56 rows (decisionIds 47, 48, …, 122) were relabelled. Frontend `LiveTerminal.tsx` and `/api/decisions` now read `_displayTier` and render `INTENT_SWAP_NO_EXEC` in orange (warning) instead of green (success).

---

## Evidence

### Cycle 123 (cron, post-fix)

| Block | TX hash | Method | Cycle role |
|------:|---------|--------|------------|
| 95926118 | (`submitProposal` to ValidationRegistry) | attestation | step 4 |
| 95926122 | (`validateProposal`) | attestation | step 4 |
| 95926125 | (`logDecision` to DecisionLog) | attestation | step 4 |
| 95926128 | (`submitFeedback`) | attestation | step 5 |
| **95926135** | **`0x313c0fc2…` `swapExactTokensForTokens` to MoeLBRouter** | **DEX swap** | **rwaAllocator implicit (USDT → USDT0, $3)** |
| **95926142** | **`swapExactTokensForTokens`** | **DEX swap** | **directional leg 1 (WMNT → USDT)** |
| **95926148** | **`0x4e210782…` `swapExactTokensForTokens`** | **DEX swap** | **directional leg 2 (USDT → USDT0)** |
| 95926153 | `setAgentURI` to Identity | attestation | finalize |

Wallet delta from cycle 123:
- USDT0 95.797 → 101.376 (+5.58)
- WMNT 8.689 → 7.743 (−0.95)
- USDT 5.000 → 0.002 (consumed)

Total economic value moved through the agent in this single cycle: ≈ $5.7.

### Operator probe (manual, before cron-merge)

`scripts/probe-execute-live.js` driven by hand:
- TX `0xca4d0804…`, block 95924841.
- 5 USDT0 → 5.000499 USDT (impact 1.9 × 10⁻⁷).
- Same code path that cron uses, just run from the operator terminal.

---

## Commits in chronological order

| Commit | Author | What |
|--------|--------|------|
| `0b710de` | operator | `fix(dex): deep-pool selection + on-chain getSwapOut quote` (Bug 1 + Bug 2) |
| `8e4a335` | operator | `fix(allocator): honest gate label + persist directionalSwap` (allocator gate, outcomeTracker whitelist) |
| `aa0ebce` | operator | `fix(cron): truthful decisionTier when no DEX TX broadcast` (`executionStatus`, tier rewrite) |
| `0f4c4e0` | operator | `feat(swap): 2-hop directional path (USDT0 ↔ USDT ↔ WMNT)` (Bug 3) |
| `fefb7ce` | merge | branch → main |
| `f2cc66c` | cron | first post-fix cron cycle (cycle 123) — committed the proof |
| `5501124`/`edd547f` | operator | persist all directional swap leg hashes in summary |
| `145388a` | operator | `fix(honesty): backfill + render INTENT_SWAP_NO_EXEC for tx-less cycles` |
| `351ef22` | operator | lint fix |
| `74de441` | operator | `feat(cron): outcome-persistence detector` (see open issue below) |

---

## Open issues

### O-1: cycle 123 `outcomes.json` row missing
- Cycle 123 wrote `last-cycle-summary.json` but did NOT write `src/data/outcomes.json`.
- `outcomeTracker.record()` is called inside try/catch in `multiAgentLoop.js:838`; any throw is swallowed with a `console.log`.
- Trading is not affected — the ledger writeback is. settle loop won't grade cycle 123, dashboard's decision feed skips it.
- Detector added (`74de441`): subsequent cycles will surface `outcome-not-persisted: cycle N` in `summary.errors`. Will diagnose properly once it reproduces under observation.

### O-2: `/api/strategy` 30s in-memory cache
- `executeEnabled: false` and `source: "none"` continued to be served for several minutes after cycle 123 because the lambda's in-memory cache hadn't refreshed.
- Not a correctness bug; UX nuisance. Low priority.

### O-3: legs[]-aware `txHashes` was added in `edd547f` but cycle 123 ran before that commit
- Effect: `last-cycle-summary.json` for cycle 123 has 2 hashes instead of 3 (leg 1 of directional was the missing one).
- Naturally fixes itself on the next cron after `edd547f` was on main.

---

## Steering compliance

- `.kiro/steering/no-lying-about-state.md`: §3 (no phantom PnL), §4 (no fake liveness). Both were being violated by the `EXECUTED_SWAP` label without TX. Both are now honored: the label rewrites itself when no TX is broadcast, and the historical 24 rows have been honestly relabelled.
- `.kiro/steering/audit-style.md`: this audit started from the on-chain reality (Mantlescan API), not from the code. Code only got read after the gap between cron's claim and on-chain truth was established. Each diagnosis step has a reproducible script artifact.
- `.kiro/steering/hackathon-context.md`: AI x RWA Track wedge holds — the agent now actually does what the rubric asks ("on-chain proof of every allocation"), no longer just *claims* to.
