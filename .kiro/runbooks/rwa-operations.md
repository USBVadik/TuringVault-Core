# RWA Operations Runbook

**Spec:** `.kiro/specs/rwa-allocation-active`
**Code:** `src/orchestrator/rwaAllocator.js`, `src/dex/merchantMoe.js`,
`src/rwa/usdt0Module.js`, `src/config/rwaLimits.js`

The RWA allocator runs once per multi-agent cycle (Step 4.5). It
emits at most one swap per cycle through one of two paths:

- **Path A** — LLM-driven. Analyst returns `action: 'rwa_allocate'`
  or `'rwa_exit'`, validator approves.
- **Path B** — deterministic idle-parking. Wallet has been FLAT for
  ≥ 24 h, regime ≠ TREND_UP, cooldown elapsed.

Active RWA target: **USDT0** (LayerZero-bridged Tether,
Treasury-collateralised). Pool: USDT/USDT0 binStep=1 on Merchant Moe.
USDY remains paper-ready but its Mantle pool is dry — calls to
`executeSwap('USDY', ...)` throw `RWA_POOL_INACTIVE`.

---

## 1. First-time setup

In **Settings → Secrets and variables → Actions** add one new repo
secret:

| Name                  | Value  | Notes                                                                                                           |
| --------------------- | ------ | --------------------------------------------------------------------------------------------------------------- |
| `RWA_EXECUTE_ENABLED` | `true` | Master kill-switch. When unset or anything other than `"true"`, the allocator runs but no swap TX is broadcast. |

The other limits below have safe defaults; only set them as secrets
if you want to override. All values must be valid numbers.

| Optional override              | Default          | Effect                                               |
| ------------------------------ | ---------------- | ---------------------------------------------------- |
| `RWA_MAX_PER_CYCLE_USD`        | `5`              | Cap on a single swap's USD value                     |
| `RWA_MAX_PER_DAY_USD`          | `25`             | Rolling-24h cap on cumulative RWA swap USD           |
| `RWA_MIN_BALANCE_USD`          | `2`              | Wallet stable-USD floor; below this, allocator skips |
| `RWA_MAX_PRICE_IMPACT_BPS`     | `100`            | 1% — refuse swap if quote impact above this          |
| `RWA_DEFAULT_SLIPPAGE_BPS`     | `50`             | 0.5% slippage on `minAmountOut`                      |
| `RWA_IDLE_PARKING_COOLDOWN_MS` | `21600000` (6h)  | Min gap between Path B swaps                         |
| `RWA_IDLE_PARKING_MIN_FLAT_MS` | `86400000` (24h) | Min FLAT duration before Path B fires                |
| `RWA_IDLE_PARKING_FRACTION`    | `0.20`           | Share of idle stables to park each Path B swap       |

After adding `RWA_EXECUTE_ENABLED=true`, the **next** scheduled cron
or manual `workflow_dispatch` of `Agent Cycle` will execute swaps.

## 2. Pause RWA execution

Two ways:

1. **Soft pause** (preserves cycle attestations, just stops swaps):
   set `RWA_EXECUTE_ENABLED=false` (or delete the secret). Allocator
   still evaluates; intents are logged with `executed:false,
blockedReason:"execute-gate-off"`. Multi-agent reasoning chain
   keeps running.
2. **Hard pause** (full agent stop): use `Agent Cycle` workflow ⋯ →
   **Disable workflow**. See `cron-operations.md` section 2.

Soft pause is the default lever for "I want the agent thinking about
RWA but not actually trading right now".

## 3. Tune limits

Edit the GitHub secret value (no redeploy needed). The next cron run
picks it up. Quick recipes:

- **Increase per-swap size after capital top-up:**
  `RWA_MAX_PER_CYCLE_USD=20`, `RWA_MAX_PER_DAY_USD=100`.
- **Test Path B without waiting 24 h:**
  `RWA_IDLE_PARKING_MIN_FLAT_MS=60000` (1 min). Revert after the
  test cycle so production cadence holds.
- **Reduce price-impact tolerance:**
  `RWA_MAX_PRICE_IMPACT_BPS=50` for 0.5% cap.

## 4. Read RWA TX log

Mantlescan filter:

```
https://mantlescan.xyz/address/0xDC783CDBfA993f3FC299460627b204E83bf4fb5a#tokentxns
```

Filter token to USDT0 (`0x779Ded0c9e1022225f8E0630b35a9b54bE713736`)
or USDT (`0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE`). Each RWA swap
shows up as one transfer in + one transfer out within the same TX.

Inside the repo:

```bash
# All executed RWA swaps from outcomes.json:
jq -r '(.pending + .settled)[] | select(.rwaIntent.executed==true) |
       "\(.recordedAt)  \(.rwaIntent.source)  \(.rwaIntent.from)→\(.rwaIntent.to)  $\(.rwaIntent.amountInUsd)  \(.rwaIntent.txHash // "?")"' \
   src/data/outcomes.json
```

API surface for dashboards:

- `/api/decisions` — each row gains `assetClass: 'rwa-treasury'` for
  RWA swaps and `rwaIntent: { source, executed }` when applicable.
- `/api/strategy.rwaAllocation` — `{lastRebalanceAt, source,
executeEnabled, target}`.

## 5. Recover from a failed swap

The cycle treats execution failures as **soft** — they're logged to
`data/cycle-failures.json` with the error string, and the cycle
exits 0. The next hour's cron retries from a fresh evaluation. Do
not retry the same intent manually; let the allocator re-decide.

Common revert reasons and fixes:

| Reason                   | Cause                                              | Fix                                                                                   |
| ------------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `impact X% > 1%`         | Pool price impact above gate                       | Wait for pool depth to recover, or raise `RWA_MAX_PRICE_IMPACT_BPS` cautiously.       |
| `not-viable`             | Pool returned no quote                             | Pool may have rebalanced bins or temporarily empty. Next cycle retries automatically. |
| `nonce too low`          | Nonce collision with a pending TX                  | Resolve the stuck nonce per `cron-operations.md` section 6.                           |
| `RWA_POOL_INACTIVE`      | Code accidentally tried USDY                       | This shouldn't happen — open issue and inspect call stack.                            |
| `insufficient allowance` | First swap of token; approval TX not yet confirmed | Re-run the cycle; `_ensureAllowance` only sets MaxUint256 once.                       |

## 6. Reactivate USDY

USDY swap path is gated off because the USDT/USDY pool on Mantle has
no active liquidity (probed 2026-05-26, active-bin reserves 0/0).

Preconditions before re-enabling:

1. Active-bin reserves ≥ $5 000 in the USDY/USDT (binStep=25) pool.
   Verify with the same probe approach used in the spec.
2. Update `MerchantMoeDEX.executeSwap` to remove the
   `RWA_POOL_INACTIVE` guard for USDY (currently throws
   unconditionally).
3. Update `rwaAllocator.evaluate` to optionally route to USDY (a
   second `to` target) — this is a code change, not just a config flip.
4. Re-run smoke: `npm run smoke:rwa` should still emit ≥ 4 intents.
5. First live run via `workflow_dispatch` with $5 cap; verify the TX.
6. Update `/api/strategy.rwaAllocation.activeAssets` and
   `paperReadyAssets`.
7. Update README / dashboard copy from "USDY paper-ready" to
   "USDY active".

This is at least one half-day of work; do not flip in a hurry.

---

## Quick reference

```
RWA_EXECUTE_ENABLED=true    → swaps will fire (live)
RWA_EXECUTE_ENABLED=false   → allocator runs, no TX
RWA_EXECUTE_ENABLED unset   → allocator runs, no TX (same as false)

Per-cycle cap        : RWA_MAX_PER_CYCLE_USD       (default $5)
Daily cap            : RWA_MAX_PER_DAY_USD         (default $25)
Wallet floor         : RWA_MIN_BALANCE_USD         (default $2)
Path B FLAT trigger  : RWA_IDLE_PARKING_MIN_FLAT_MS (default 24h)
Path B cooldown      : RWA_IDLE_PARKING_COOLDOWN_MS (default 6h)
Park fraction        : RWA_IDLE_PARKING_FRACTION    (default 20%)
```
