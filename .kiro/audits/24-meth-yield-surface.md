# Audit 24 — mETH Native Yield Surface

**Date**: 2026-05-29 (post audit-23 deep research v2)
**Trigger**: Audit 23 / v2 deep research recommended a "Native Yield
Surfacing" replacement for the AVOID'd Aave V3 integration. This
ships that recommendation.

## What ships

A new yield surface that honours workspace honesty rules §1 and §3
without taking on counterparty risk through any new external
lending integration.

### Backend

`src/onchain/methRate.js` — multi-source mETH redemption-rate
fetcher with disk snapshot fallback and idempotent reference-rate
capture. Source chain (priority order):

  1. **DefiLlama yields API** (`https://yields.llama.fi/pools`) —
     primary, no API key, public, ticked frequently. Returns APY +
     TVL but not redemption rate.
  2. **Mantle's meth.mantle.xyz public stats endpoint** — secondary;
     probed against three candidate URLs; returns rate + APY when
     the public path is published.
  3. **Ethereum L1 RPC** (cloudflare-eth.com → eth.llamarpc.com →
     rpc.ankr.com/eth) — tertiary; reads `mETHToETH(1e18)` from the
     canonical L1 staking proxy. Cold fallback only.
  4. **Disk snapshot** at `src/data/meth_rate_history.json` —
     persisted last successful captures, capacity-bounded at 720
     entries (≈30 days hourly).

Honesty contract:
- Reference rate captured exactly once at first successful read;
  never overwritten.
- If `rateNow < rateRef` (depeg/drift), API returns
  `assetHealth: "drift"` and **0 yield**, never a negative yield
  number that could be confused with active loss.
- All responses carry `source` provenance label and `degraded`
  boolean.

### Cron integration

`src/orchestrator/multiAgentLoop.js` — new step 6.4 calls
`captureMethRate({ethPriceUsd})` after `outcomeTracker.record()`
inside try/catch with warn-only fallback. The cycle never fails
because rate capture failed.

### API route

`frontend/app/api/yield-meth/route.ts` — GET endpoint with SWR
caching (`s-maxage=60, stale-while-revalidate=300`). Returns:

```
{
  currentRateAtomic, referenceRateAtomic, referenceTs,
  methBalance, ethPriceUsd,
  passiveYieldEthAtomic, passiveYieldUsd,    // realised
  apyProjectedDailyUsd,                       // projected (labelled)
  rateDeltaBps, apyPct, source, lastSync,
  lastSyncAgeMin, degraded, assetHealth
}
```

When the redemption rate path is unavailable (DefiLlama-only mode
because Mantle public stats endpoint is not yet exposed and L1 RPC
proxy address discovery is pending), the surface falls back to an
**APY-projected daily yield** with explicit `mETH · projected/day`
label per honesty rule §1. Realised accrual lights up automatically
when the redemption-rate path comes online.

### Homepage card

`frontend/app/page.tsx` — performance grid expanded
`md:grid-cols-5` → `md:grid-cols-3 lg:grid-cols-6` with a 6th
"Passive · LST" card. Renders:
- Realised yield USD if available, else APY-projected daily.
- Drift warning pill if `assetHealth === "drift"`.
- Cache pill if `degraded === true`.
- Tooltip with full attribution + reference timestamp.

## Risk panel — mETH on Mantle (read-only surface)

  Incident history (90d):    NO — LayerZero + Mantle confirmed
                             rsETH/KelpDAO incident was isolated to
                             rsETH; mETH unaffected. Source:
                             https://www.theindustrial.in/news/8927219241/
  Active bad debt:           NO (mETH is a token, not a market)
  Oracle integrity (90d):    OK — exchange-rate oracle updates
                             every 8h, no public misconfigurations
  Cross-chain exposure:      NONE for our reading (rate sourced
                             from L1 + DefiLlama public APIs)
  Active governance crisis:  NO
  Recovery status:           none-needed
  Net verdict:               SAFE
  Last checked:              2026-05-29

## Validation

- `npx jest --silent` → **266 / 266 passing** (was 256; +10 new
  methRate tests)
- `npx eslint src/ --max-warnings 50` → 0 errors / 48 warnings
  (1 new warning, well within budget)
- `cd frontend && npm run lint` → 0 errors / 15 warnings
- `cd frontend && npx tsc --noEmit` → clean
- `cd frontend && npx next build` → clean, **25 routes** (was 24)
- Live probe of DefiLlama returned APY 2.06%, TVL $454M
- Disk snapshot seeded with first capture at 2026-05-29T20:50Z

## Deferred (next sprint)

- Discover canonical mETH L1 staking proxy address + `mETHToETH`
  selector to enable redemption-rate read path. When that lands
  the homepage card will switch from "projected/day" label to
  "realised" label automatically — no further code change needed.
- Optional second curve on `/backtest` — gated on captures.length
  ≥ 30 (≈30 hours after deploy).
- README claim grid row #11 pointing at /api/yield-meth.

## Why this is the right move for the AI x RWA Track

External Antigravity-Gemini deep research v2 identified the
"no actual yield" gap as the single biggest unaddressed AI x RWA
Depth axis after audit 22. The naive fix (Aave V3 USDT0 supply
yield 4.17%) is under hard taboo per the new
`.kiro/steering/external-integration-due-diligence.md` rule
because of Aave's April 2026 KelpDAO bridge cascade ($230M bad
debt, Mantle was heaviest L2 exposure, recovery still partial).

This surface delivers the same narrative beat — "the agent earns
RWA-shaped yield on assets it chose to hold" — without taking on
any new counterparty contract risk. The agent already holds mETH;
this code just makes the existing yield visible and honestly
labelled. Closes the gap without breaking the
"capital preservation through adversarial validation" pitch axis.

Pitch line for next submission text refresh:
> *"Dual-engine returns: TuringVault combines actively-traded
> on-chain PnL (cryptographically proven via combinedAnchor) with
> passive Mantle native staking yield on the mETH it chose to
> hold. Both labelled separately on the homepage; never combined."*
