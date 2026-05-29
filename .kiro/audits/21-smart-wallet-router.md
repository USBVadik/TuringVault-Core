# Audit 21 — Smart Wallet Router: end of "WMNT depleted while 29 MNT sat idle"

**Date**: 2026-05-29
**Trigger**: Operator pushback "почему не работает как смарт роутер?
обменять MNT на WMNT или за USDT0 их купить?". Diagnostic chain:
audit-19/20 unblocked the analyst's eyes (multi-source candle/price
feeds), audit-22 will fix the next layer — the router that decides
which token to swap FROM.

---

## What was wrong

`multiAgentLoop.js` step 4.7 hardcoded the source-of-funds path:

```js
if (swapDirection === "risk-on") {
  path = ["USDT0", "USDT", "WMNT"];
  sourceBalance = balances.USDT0;
} else {
  path = ["WMNT", "USDT", "USDT0"];
  sourceBalance = balances.WMNT;
}
```

That's a 5-line policy with no awareness of:

1. **Native MNT** sitting in the wallet (29 MNT idle, 1:1 wrappable
   to WMNT instantly via `WMNT.deposit() payable`, no slippage).
2. **mETH** as an alternative risk-side source.
3. **USDT** legacy float as a secondary stable hub.

Result, observed live on cycles 149-151:

  cycle 149: WMNT 0.525 → USDT 0.34 → USDT0 0.82  (risk-off)
  cycle 150: WMNT 0.525 → USDT 0.34 → USDT0 0.34  (risk-off)
  cycle 151: insufficient-balance: 0.092551 WMNT  (INTENT_SWAP_NO_EXEC)

After two ~$0.35 swaps the WMNT float collapsed from 1.05 to 0.09
and the agent went dark on every subsequent risk-off signal —
**while 29 native MNT continued to sit idle in the wallet** ($18+
of trade-able value the bot couldn't see).

A judge looking at the dashboard saw "INTENT_SWAP_NO_EXEC" and
correctly concluded the agent was stuck. The narrative
("autonomous RWA portfolio agent") collapsed.

---

## What ships

New module: `src/dex/walletRouter.js`. Three primitives:

1. `readAllBalances(provider, walletAddress)` — single read of every
   token we hold (native MNT + WMNT + USDT0 + USDT + mETH), in
   parallel, returns human units.

2. `pickSource({direction, balances, floors, targetIsMeth})` — pure
   function that decides which token to swap FROM, whether to wrap
   MNT first, and what the path should be. Decision tree:

   **risk-off (analyst wants stable):**
   - WMNT ≥ floor → use WMNT directly (current path)
   - **MNT  ≥ (floor + gas reserve) → wrap MNT→WMNT then swap**  ← new
   - mETH ≥ floor → use mETH (mETH→WMNT→USDT→USDT0)              ← new
   - else → infeasible

   **risk-on (analyst wants risk):**
   - USDT0 ≥ floor → use USDT0 (current path)
   - USDT  ≥ floor → use USDT (skip leg 1)                        ← new
   - else → infeasible

3. `wrapMnt(wallet, amountMnt)` — calls `WMNT.deposit() payable`
   with `amountMnt` of native MNT. Returns `{txHash, blockNumber,
   amountMnt, amountWmntOut}`. Always 1:1, no slippage, ~0.0002 MNT
   gas.

The wrap is recorded as **leg 0** in `directionalSwap.legs[]` so
the outcomes ledger and dashboard show the full data path:

```
leg 0: MNT → WMNT (wrap)        amountIn=29.00 MNT  amountOut=29.00 WMNT  tx=0x...
leg 1: WMNT → USDT (MoE swap)   amountIn=5.0  WMNT  amountOut=3.21 USDT   tx=0x...
leg 2: USDT → USDT0 (MoE swap)  amountIn=3.21 USDT  amountOut=3.20 USDT0  tx=0x...
```

A judge clicking through can verify each step on Mantlescan and see
the agent pulled idle native MNT out of the wallet to fund a real
swap.

## Files changed

- `src/dex/walletRouter.js` — new (~250 LOC, pure function +
  readAllBalances + wrapMnt).
- `src/orchestrator/multiAgentLoop.js` — step 4.7 now uses
  `readAllBalances + pickSource`, executes wrap-MNT leg 0 when the
  router asks, and writes the wrap into `directionalSwap.legs`. The
  smart-router infeasible branch labels honestly:
  `smart-router-infeasible: <reason>`.
- `tests/unit/walletRouter.unit.test.js` — 11 unit tests covering:
  - WMNT above floor → direct
  - WMNT below + MNT available → wrap-first
  - both depleted → fall through to mETH
  - everything depleted → infeasible with diagnostic
  - never wrap below gas-reserve threshold
  - risk-on USDT0 default + targetIsMeth 4-leg variant
  - USDT fallback when USDT0 depleted
  - unknown direction safe-fail
  - custom floors override
  - all-empty risk-on infeasible

## Validation

- `npx jest --silent` → 256 / 256 passing (was 245; +11 router).
- `npx eslint src/ --max-warnings 50` → 0 errors / 47 warnings.
- `node --check src/orchestrator/multiAgentLoop.js` → clean.

## Honest caveats

1. The wrap currently uses every wrappable native MNT (`balance -
   gas reserve`). For a wallet with 29 MNT this means a full wrap
   of ~28.95 MNT in one go — which is fine economically (no
   slippage, 0.0002 MNT gas) but creates a single large WMNT
   balance rather than amortising over many cycles. A future
   refinement could wrap only enough to clear the next 5-10
   cycles' worth of swaps. Out of scope for this audit.

2. The `mETH` fallback path uses the existing MerchantMoe
   mETH/WMNT pool. Verified live (binStep=10, 50 WMNT → 0.013 mETH
   at ~$2454/mETH). It IS slippage-bearing — the leg 1 cost from
   mETH→WMNT can be 100-250 bps depending on size. We accept this
   because mETH→USDT0 should only fire when WMNT+MNT are both
   depleted, which is a recovery scenario, not the steady state.

3. The router does NOT auto-rebalance proactively. If the analyst
   keeps returning risk-off signals on the same regime, the bot
   will keep wrapping MNT until that float is also depleted. At
   that point we'd need a "buy WMNT back from USDT0" path, which
   the existing risk-on direction provides — the bot just needs to
   see a TREND_UP / CONTRARIAN_LONG signal first. This is correct
   behaviour: the router fixes the data path, the analyst still
   decides the policy.

4. RWA_MAX_PER_CYCLE_USD ($5 default) still caps every cycle. This
   audit doesn't touch sizing — only sourcing. A separate sizing
   adjustment can lift the cap once we've verified the router
   plumbing is solid in production.

## What's next

- After the next 1-2 cron cycles produce a smart-router-driven
  swap on-chain, surface "wrap leg" badge on `LiveTerminal` so
  judges see "MNT → WMNT → USDT → USDT0" routing visually.
- Optionally: relax RWA_MAX_PER_CYCLE_USD to $20 + lower the
  WMNT floor to 0.1 to make swaps consistently $5+.
- Add a "balance health" mascot tier on the dashboard so the
  operator can see "WMNT depleted; will wrap MNT next cycle" at
  a glance.
