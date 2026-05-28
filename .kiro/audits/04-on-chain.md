# 04 — On-Chain Audit

| Meta | Value |
|------|-------|
| Auditor | Kiro (operator-supervised) |
| Date | 2026-05-28 |
| Scope | All 6 contracts in `deployments.json`; agent EOA `0xDC78…fb5a`; on-chain TX history (last 200) |
| Method | Mantle RPC `eth_getCode`, Routescan API for TX history, Sourcify HTTP API for verification status, classification by destination contract |
| Re-audit context | This file regenerates T6 in `.kiro/specs/system-audit-pre-submission/tasks.md`. Original report `04-on-chain.md` was promised at SHIPPED but absent from disk — see meta-finding M-1. |

---

## Contract Bytecode Sanity

Captured via `node scripts/audit/chain-probe.js` at block height 95927474 (2026-05-28T16:20:59Z).

| Contract | Address | Bytecode bytes | Deployed |
|----------|---------|---------------:|----------|
| TuringVaultIdentity | `0x6f862802e0d5463DF18d267e422347BeCacc28bD` | 10417 | 2026-05-20 |
| TuringVaultDecisionLog | `0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5` | 4605 | 2026-05-18 |
| TuringVaultValidationRegistry | `0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6` | 6132 | 2026-05-18 |
| TuringVaultRouter | `0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001` | 4048 | 2026-05-18 |
| ReputationRegistry | `0xC78119F3274B05046Ac7c38a14298a6cbD946e1a` | 5680 | 2026-05-18 |
| TuringVaultValidation | `0x0aeEd88959fCFC665284225dB93DED3e8A3Ff705` | 6175 | 2026-05-20 |

All 6 addresses return non-empty bytecode → contracts are live.

## Sourcify Status

I did not re-run Sourcify lookups in this pass; the earlier P0-4 finding in `99-consolidated.md` already states **4/5 Sourcify-verified, Router pending**. The pitch deck has been corrected (commit logged in consolidated). I record this as **trusted-from-prior-audit**, not re-verified today. A reader who wants a fresh check can do `curl -s https://sourcify.dev/server/check-by-addresses?addresses=<addr>&chainIds=5000` per address.

---

## Agent EOA Activity (last 200 TX, 2026-05-27 09:44 → 2026-05-28 15:40 UTC)

EOA: `0xDC783CDBfA993f3FC299460627b204E83bf4fb5a`
Native MNT balance: 31.302 MNT
Total TX count (nonce): 662

### Destination breakdown (200 TX)

| Count | Destination | Method | Class |
|------:|-------------|--------|-------|
| 17 | ValidationRegistry | `validateProposal` | attestation |
| 16 | ValidationRegistry | `submitProposal` | attestation |
| 16 | TuringVaultIdentity | `setAgentURI` | attestation |
| 16 | ReputationRegistry | `submitFeedback` | attestation |
| 16 | TuringVaultDecisionLog | `logDecision` | attestation |
| **11** | **MoeLBRouter** (`0x013e…1E3a`) | **`swapExactTokensForTokens`** | **DEX swap** |
| 3 | OdosRouter (`0xD9F4…6745`) | `swapCompact` | DEX swap |
| 2 | ReputationRegistry | `recordPnL` | settlement |
| 1 | MoeSmartRouter (`0x45A6…2c86b`) | `swapExactIn` | DEX swap (manual) |
| 1 | USDT0 ERC20 | `approve` | allowance |
| 1 | USDT ERC20 | `approve` | allowance |

Total real DEX swaps in window: **15** (11 Moe-LB + 3 Odos + 1 Moe-Smart).

### Most recent 8 DEX swaps

| Timestamp (UTC) | Block | Router | Source |
|---|---:|---|---|
| 2026-05-28T15:36:48 | 95926148 | Moe-LB | cron cycle 123 — directional leg 2 (USDT→USDT0) |
| 2026-05-28T15:36:36 | 95926142 | Moe-LB | cron cycle 123 — directional leg 1 (WMNT→USDT) |
| 2026-05-28T15:36:22 | 95926135 | Moe-LB | cron cycle 123 — RWA allocate (USDT→USDT0) |
| 2026-05-28T14:53:14 | 95924841 | Moe-LB | manual probe `scripts/probe-execute-live.js` (5 USDT0 → USDT) |
| 2026-05-28T14:18:24 | 95923796 | Moe-Smart | operator manual swap from merchant-moe.com (USDT0 → mETH) |
| 2026-05-28T05:02:30 | 95907119 | Moe-LB | pre-fix manual / legacy strategy |
| 2026-05-28T04:39:44 | 95906436 | Moe-LB | pre-fix manual / legacy strategy |
| 2026-05-27T23:51:08 | 95897778 | Moe-LB | pre-fix manual / legacy strategy |

### Truth check: did cron cycles before the fix actually swap?

**No.** Cron cycles 113 through 122 each emitted `decisionTier=EXECUTED_SWAP` and `consensus=true` in `data/last-cycle-summary.json` and the corresponding cron commit message, but the on-chain footprint shows zero TXs to `MoeLBRouter`, `OdosRouter`, or `MoeSmartRouter` from the agent EOA between 2026-05-27T17:18 (last pre-cron-loop manual swap) and 2026-05-28T14:53 (operator-initiated probe). The 5 attestation TXs per cycle (proposal/validate/log/feedback/setAgentURI) all landed; only the swap step was missing.

Pre-fix root cause (now patched in commits 0b710de + 0f4c4e0):
1. `MerchantMoeDEX.findPair()` sorted by binStep, picked the shallow `$1.3K` USDT/WMNT pool over the canonical `$1.18M` pool.
2. `MerchantMoeDEX.getQuote()` computed `priceImpact` from the active-bin reserve only, returning ~100% impact for any non-trivial swap and so flipping `viable=false`.
3. Step 4.7 directional swap was hard-coded to `mUSD ↔ mETH`, neither of which the demo wallet held in non-dust amounts since the codebase migrated to USDT0 + WMNT.

Post-fix evidence (cycle 123, this audit's reference cycle):
- Cron commit `f2cc66c` advertises `EXECUTED_SWAP`.
- On-chain confirms 3 swap TXs in the same minute (`95926135`, `95926142`, `95926148`), all `swapExactTokensForTokens` against `MoeLBRouter`, all status=success.
- Wallet delta: USDT0 95.797 → 101.376 (+5.58), WMNT 8.689 → 7.743 (−0.95), USDT 5.000 → 0.002 (consumed).

---

## ValidationRegistry vs outcomes.json drift

Not re-measured in this pass. Prior `06-pipeline-data-flow.md` reported `totalProposals=119` vs outcomes.json IDs ≤ 111, delta +8 attributable to in-flight cycles. Current state:
- Latest cron decisionId in summary: **123**.
- Latest decisionId in `src/data/outcomes.json` on main: **122**.
- Drift: **+1**, and that's cycle 123 specifically — see meta-finding M-2.

---

## Findings

### P0 — `outcomes.json` missing cycle 123 entry despite successful on-chain trade

- **Surface:** `src/data/outcomes.json`
- **Expected:** Every committed cycle that wrote `data/last-cycle-summary.json` also writes a matching row to `src/data/outcomes.json`.
- **Actual:** Cycle 123 (commit `f2cc66c`) wrote summary, position_state, threshold_state, and history. It did NOT modify `src/data/outcomes.json`. The `outcomes.json` diff in that commit is empty.
- **Root cause:** Unknown. `outcomeTracker.record()` is called inside try/catch in `multiAgentLoop.js:838`; any throw is swallowed with a `console.log` and no propagation to `summary.errors`. Candidates: write race with the `git add` step, partial write recovery, or a saveDB exception that the catch swallows.
- **Mitigation in place:** Commit `74de441` adds an outcome-persistence detector that runs after Step 6 in `run-cycle.js` and pushes `outcome-not-persisted` into `summary.errors[]` when a row is missing. We will see it in subsequent cycles if it reproduces.
- **Status:** open, monitor.

### P1 — Three different routers used historically (Moe-LB, Moe-Smart, Odos)

- **Surface:** `swapper` choice across history.
- **Observed:** Operator manual swaps used Moe-Smart (`0x45A6…2c86b`); old grid-bot used Odos directly; current cron now uses Moe-LB (legacy router via our `MerchantMoeDEX` wrapper).
- **Impact:** No bug per se — multiple routers can co-exist. But the dashboard / pitch text should not say "we use Merchant Moe" without qualifying which router. Moe-Smart aggregates across LB and Agni V3 pools; the legacy LB Router does single-LB-pair only.
- **Suggested:** add a sentence in the README / agent-card clarifying that the autonomous cron uses Merchant Moe LB v2.2 directly (single-pair, depth-ranked), and that the operator may also execute manually via Moe Smart Router or Odos. Don't claim the agent uses an aggregator.
- **Status:** open, doc fix.

### Meta-finding M-1 — Audit report file was missing despite tasks.md SHIPPED

- **Surface:** `.kiro/specs/system-audit-pre-submission/tasks.md` task T6.
- **Expected:** `.kiro/audits/04-on-chain.md` exists.
- **Actual:** File absent. Same applies to `01-ui-pages.md`, `07-external-apis.md`, `11-secrets-and-supply.md` (T3, T9, T13). All four tasks marked `[x]`.
- **Root cause:** Prior agent(s) flipped the checkbox without producing the artifact. The consolidated report briefly mentions "reports not on disk" but the audit was still flagged Status: SHIPPED.
- **Severity rationale:** Meta — not a code bug, an audit-trust violation. Direct nudge against `.kiro/steering/no-lying-about-state.md`.
- **Status:** this file (today) closes M-1 for T6. T13 follow-up will close it for that task. T3 and T9 to be punted to backlog with explicit acknowledgement.

### Meta-finding M-2 — Outcomes drift not surfaced in any UI

- **Surface:** `/api/decisions`, `/api/health`, `/api/strategy`.
- **Expected:** Some UI somewhere should show "on-chain has N proposals, outcomes.json has M, drift=K".
- **Actual:** No surface exposes this drift. Cycle 123 is on-chain but not in outcomes.json; the dashboard's decision feed simply skips it.
- **Status:** open, P2 (post-submission backlog candidate).

---

## Not Checked

| Item | Reason |
|------|--------|
| Sourcify status per contract (4/5 verified) | Trusted from prior `99-consolidated.md` P0-4 fix; not re-probed today. |
| ABI completeness for each contract | Out of scope for this re-audit pass; previous report (if it existed) would have covered this. |
| Operator EOA private-key custody | T13 (secrets) audit territory; covered in `11-secrets-and-supply.md` regen. |
| Recent recordPnL settlements | Out of scope; `outcomeTracker.settle()` runs separately and is not part of the trading-unblock. |
| Whether `RWA_EXECUTE_ENABLED` was true on every cron run | The workflow `agent-cycle.yml` hardcodes `"true"`. Any future override would require workflow edit visible in PR; trusted not re-verified. |
