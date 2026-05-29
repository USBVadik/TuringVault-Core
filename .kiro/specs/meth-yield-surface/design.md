# mETH Native Yield Surface — Design

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ DATA SOURCES                                                    │
│   1. DefiLlama yields API   (primary, no key, public)           │
│   2. meth.mantle.xyz stats   (secondary, official Mantle)       │
│   3. L1 Ethereum public RPC  (tertiary, cold fallback only)     │
│   4. src/data/meth_rate_history.json  (persistent disk snapshot)│
└────────────────────────┬────────────────────────────────────────┘
                         │ fetchMethRate({timeoutMs})
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ src/onchain/methRate.js                                         │
│   - fetchMethRate()  — chain of sources with provenance         │
│   - readSnapshot()   / writeSnapshot()                          │
│   - referenceRate()  — pinned at surface-launch moment          │
│   - calcPassiveYield({balance, rateNow, rateRef, ethPriceUsd})  │
└──────┬─────────────────────┬────────────────────────────────────┘
       │                     │
       │ called by cron      │ called by API route
       ▼                     ▼
┌──────────────────┐   ┌──────────────────────────────────────────┐
│ multiAgentLoop   │   │ frontend/app/api/yield-meth/route.ts     │
│   step 6.5:      │   │   GET → JSON {currentRate, ref, balance, │
│   capture rate,  │   │              passiveYieldEthAtomic, USD, │
│   append to      │   │              apy, source, degraded, ts}  │
│   meth_rate_     │   │                                          │
│   history.json   │   └──────────┬───────────────────────────────┘
└──────────────────┘              │
                                   ▼
                          ┌────────────────────────────┐
                          │ frontend/app/page.tsx      │
                          │   Performance card +       │
                          │   "Passive Protocol Yield" │
                          │   row, source pill, tip    │
                          └────────────────────────────┘
```

## Module: `src/onchain/methRate.js`

Pure JS, follows pattern of `src/strategies/priceSources.js` /
`candleSources.js` (same multi-source + disk snapshot pattern).

### Source 1 — DefiLlama yield pools

Endpoint: `https://yields.llama.fi/pools`  
Filter (post-fetch): item where `project === "mantle-staked-ether"`
or `symbol === "METH"` and `chain === "Ethereum"`. The JSON
response carries:
  - `apy` (% annualised)
  - `apyBase` (excluding token-incentives)
  - `tvlUsd`

DefiLlama does not directly return the redemption rate. We get APY
from this source, and the rate from source 2 or 3.

### Source 2 — meth.mantle.xyz stats

Probe: `https://meth.mantle.xyz/api/stats` (or whatever the public
stats route resolves to — to be discovered at first run; if it is
HTML-only and not JSON, treat as unavailable).

If JSON exists: parse `currentRedemptionRate` or
`exchangeRate` field, both APY and rate from one call.

### Source 3 — L1 Ethereum public RPC (cold)

Reach the canonical mETH Staking contract on Ethereum L1 via
`https://cloudflare-eth.com` or `https://eth.llamarpc.com`. ABI
fragment:

```js
[
  "function mETHToETH(uint256 mETHAmount) view returns (uint256)"
]
```

Address: discovered from
https://docs.mantle.xyz/meth/components/smart-contracts/staking-meth
(Staking proxy on L1; discovered at module init).

5-second timeout. This is bottom-tier; only reached if 1 + 2 both
failed in this request lifecycle.

### Source 4 — Disk snapshot

`src/data/meth_rate_history.json`:

```json
{
  "captures": [
    {
      "ts": "2026-05-29T20:15:00Z",
      "currentRateAtomic": "1058200000000000000",
      "apyPct": 3.41,
      "source": "defillama",
      "ethPriceUsd": 2198.64
    }
  ],
  "referenceRateAtomic": "1058200000000000000",
  "referenceTs": "2026-05-29T20:15:00Z",
  "referenceCapturedFromSource": "defillama"
}
```

Capacity-bound: keep last 720 entries (≈30 days at one cycle/h).
Atomic write via tmpfile + rename, same pattern as
`outcomeTracker.js`.

### `referenceRate()` semantics

The reference rate is **the first successful capture** stored in
`meth_rate_history.json` under `referenceRateAtomic`. It is set
exactly once on module first-run and never overwritten. The
homepage card surfaces `referenceTs` literally so a viewer sees
"Yield since 2026-05-29 20:15 UTC".

If a manual re-base is ever required (e.g., we redeposit a much
larger mETH balance and want a fresh anchor), the file is rewritten
operator-side and the audit trail recorded in the SUBMISSION-CHANGELOG.

## Module: `frontend/app/api/yield-meth/route.ts`

```ts
GET /api/yield-meth
  → 200 OK
    {
      currentRateAtomic: "1058200000000000000",
      referenceRateAtomic: "1058200000000000000",
      methBalance: "0.005983",
      passiveYieldEthAtomic: "0",   // 0 if rate has not advanced
      passiveYieldUsd: 0,
      apyPct: 3.41,
      source: "defillama" | "meth.mantle.xyz" | "l1-rpc"
            | "cached:defillama" | "cached:l1-rpc",
      lastSync: "2026-05-29T20:15:00Z",
      degraded: false,                // true if served from snapshot
      assetHealth: "ok" | "drift",     // peg-drift indicator
      assetHealthReason?: string
    }
```

API route reads:
  1. Live agent wallet balance via `/api/performance` (already
     surfaces `holdings.mETH`). Avoid duplicating on-chain RPC.
  2. Live rate via `methRate.js`. SWR-cached 60s.
  3. ETH price from existing unifiedMarketData feed for USD value.

SWR headers: `s-maxage=60, stale-while-revalidate=300`. Match
the pattern of `/api/decisions` (SWR caching from audit "post
Mantlescan 502").

## Frontend changes

### `frontend/app/page.tsx`

Within the Performance card (existing `<section>` with grid of
5 stat boxes), add a 6th box:

```
┌────────────────────────────────────┐
│ PASSIVE YIELD · mETH LST           │
│   $0.00                            │
│   APY 3.41% · via:defillama        │
│   Since 2026-05-29 20:15 UTC       │
└────────────────────────────────────┘
```

Tooltip: "Mantle's mETH is a value-accumulating LST. The agent
holds 0.0060 mETH; this row shows the passive ETH-staking yield
accrued since the dashboard started tracking. This is NOT
agent-generated alpha — it is the protocol-native return on the
asset the agent chose to hold."

The grid expands `md:grid-cols-5` → `md:grid-cols-6` (or wraps).

### `frontend/app/backtest/page.tsx` (deferred to A4)

Adds an optional toggle "Show passive yield curve" which overlays
a second series. **Not enabled by default** until we have ≥30
captures. Stub the toggle in code, gate it on `captures.length >= 30`.

## Cron integration: `src/orchestrator/multiAgentLoop.js`

Insert a step right after outcome record write (~line where
`outcomeTracker.record()` returns):

```js
try {
  const rate = await fetchMethRate({timeoutMs: 5000});
  await appendMethRateSnapshot(rate);
} catch (err) {
  // Steering rule §1: never block cycle on auxiliary capture.
  console.warn("[meth-rate] capture skipped:", err.message);
}
```

This adds <5s wall time worst-case (timeout). The cron path NEVER
fails because rate capture failed.

## Tests

### `tests/unit/methRate.unit.test.js`

- `fetchMethRate()` happy path with mocked DefiLlama → returns
  rate + apy + provenance.
- DefiLlama 502 → meth.mantle.xyz fallback.
- Both upstream fail → L1 RPC fallback.
- All 3 fail + disk snapshot present → snapshot served, `degraded: true`.
- All 3 fail + no snapshot → throws (caller decides; cron catches).
- `calcPassiveYield()` with rate advanced 1% → returns expected
  yield in atomic + USD.
- `calcPassiveYield()` with rate going backwards → returns 0
  passive yield + assetHealth: "drift".
- Reference-rate persistence: first call sets reference, second
  call does not overwrite.
- `appendMethRateSnapshot()` capacity-bounded: insert 800
  captures → file holds the most recent 720.

### `tests/unit/yieldMeth.api.unit.test.js` (frontend)

If we have a test runner for frontend routes (Vitest or jest),
add: GET returns the schema, fields populated, SWR header set.
If no runner, document the sample response in
`.kiro/audits/raw/23-deep-research-v2/yield-meth-sample.json`
and run a manual `curl` smoke test post-deploy.

## Honesty checklist (per workspace steering)

- [x] Rate provenance label rendered every time the row appears.
- [x] Reference timestamp rendered ("Yield since …").
- [x] No combination of active + passive yield without visual split.
- [x] `degraded: true` flag honoured in UI (yellow pill if cached).
- [x] mETH peg drift surfaces as red pill, not silently zero'd.
- [x] No claim that we generate the staking yield — only that
      the agent chose to hold the LST.

## Out of scope for this design

- Backfilling historical mETH yield to settled outcomes.
- USDY / cmETH / external lending — hard taboo per steering rule.
- Surfacing same data on `/replay/<id>` per-cycle — possible later
  but adds page weight.
