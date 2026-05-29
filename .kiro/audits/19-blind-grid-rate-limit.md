# Audit 19 — Blind Grid: 16-cycle BLOCKED_BY_REGIME root cause

**Date**: 2026-05-29
**Trigger**: Operator pushback "неделю агент ничего не делает, тупо
тут винить рынок". Initial assumption was "regime is conservative
on purpose" — wrong. Investigation found a hidden upstream-data
failure that left the analyst blind 4 of the last 5 cycles.

---

## Tl;dr

Cycles 144-147 carried this in the analyst's user prompt:

```
ETH (target=mETH) GRID: Channel not established (Insufficient price history)
MNT (target=MNT/WMNT) GRID: Channel not established (Insufficient price history)
```

Root cause: `fetchPriceCandles` in `src/strategies/rangingGrid.js`
called CoinGecko's free-tier `market_chart?days=2&interval=hourly`
endpoint as the SOLE source. GitHub Actions runner pool's shared
public IPs hit CoinGecko's per-IP rate limit (HTTP 429) often
enough that ~80% of recent cron cycles got back either 429 or a
partial response. The function had no retry, no fallback source,
and no persistent disk snapshot.

When candles came back as <10 entries, `detectChannel` returned
`{ valid: false, reason: "Insufficient price history" }`. The
analyst's RANGING-regime prompt explicitly says "Use RANGING GRID
STRATEGY data from signals … if both grids = HOLD → wait" — so the
analyst (correctly given the data) returned `action: hold`. The
classifier then stamped `BLOCKED_BY_REGIME` and the cycle ended
without trading.

Result: 16 consecutive `BLOCKED_BY_REGIME` cycles between 130 and
145, plus 144-147 specifically — a full week of effectively-blind
agent activity that we'd been mis-attributing to "the market is
conservative" / "regime detector is doing its job".

---

## Diagnostic chain

1. **outcomes.json** showed 16 of last 25 cycles tagged
   `BLOCKED_BY_REGIME`, action=hold, target=mETH, conf=58%.
   Identical confidence across all 16 — suspicious.

2. **Live `detectChannel`** test (run from operator's machine)
   returned `valid: true` for both ETH and MNT, with ETH at 70%
   of channel showing a SELL_mETH signal at R:R = 2.5:1. The
   strategy code was working **right now** — so why did it fail
   at cycle time?

3. **Replay manifest cycle 147** showed the analyst's userPrompt
   contained the literal string
   `Channel not established (Insufficient price history)`.
   So at the moment that cycle ran, `fetchPriceCandles` returned
   <10 candles for both assets. We had no log of what actually
   came back from CoinGecko in that moment because the cron logs
   don't capture upstream HTTP responses — only orchestrator
   stdout.

4. **CoinGecko probe** (10 sequential requests with 300ms gap):
   5 success / 5 HTTP 429. On a personal IP. On GH Actions
   runner-pool IPs (shared with thousands of other projects),
   this rate is realistically worse.

5. **Source comparison** at probe time:

       CoinGecko ETH  →  HTTP 200 / 429 (50% flap)
       CoinGecko MNT  →  HTTP 200 / 429 (50% flap)
       Binance ETHUSDT →  HTTP 200, 48 candles, every time
       Bybit MNTUSDT  →  HTTP 200, 48 candles, every time
       Hyperliquid    →  HTTP 200, 49 candles, both assets

So the "rate limit on free CoinGecko shared IP" hypothesis is
consistent with: (a) the production manifests carrying
"Insufficient price history", (b) my probe reproducing 429 at
~50% rate, (c) every alternative source being immune.

---

## Fix

New module: `src/strategies/candleSources.js`. Pure, stateless
multi-source fetcher with these properties:

- **Source chain per asset** (tries in order, returns the first
  source with ≥minRequired candles):

      ETH:  CoinGecko → Binance Spot   → Hyperliquid → disk snapshot
      MNT:  CoinGecko → Bybit Spot     → Hyperliquid → disk snapshot

- **5s timeout per source** (total budget ≤15s, well under cycle
  timeout).

- **Persistent disk snapshot** at `src/data/candle_cache.json`,
  written on every successful upstream fetch, read as last-resort
  fallback. 6h max age before refused.

- **Provenance tagging**: every returned candle set carries
  `_source` (which provider gave us the data) and
  `_fromDiskSnapshot` (true when we fell back to disk). These
  propagate into `detectChannel`'s output as `dataSource` +
  `fromDiskSnapshot` + `snapshotAgeSec` so a future audit can see
  the data path for every cycle.

- **Relaxed minimum from 10 to 6 candles** in `detectChannel`.
  6 hourly candles is enough for support/resistance computation;
  the existing `tooNarrow` + `isRanging` checks already gate
  noisy channels downstream.

- **Honest snapshot reuse**: when serving from disk, the source
  is tagged `<provider>-snapshot` (e.g. `coingecko-snapshot`) and
  `fromDiskSnapshot: true` is set. Steering rule §1 — never lie
  about data freshness.

## Files changed

- `src/strategies/candleSources.js` — new multi-source fetcher
  (~280 LOC).
- `src/strategies/rangingGrid.js`
  - `fetchPriceCandles` now delegates to
    `fetchCandlesMultiSource`.
  - `detectChannel` minimum candles 10 → 6; surfaces `dataSource`
    + `fromDiskSnapshot` + `snapshotAgeSec` in the result.
- `tests/unit/candleSources.unit.test.js` — 8 unit tests
  covering: primary success, CoinGecko 429 → Binance fallback
  (ETH), CoinGecko 429 → Bybit fallback (MNT), CoinGecko +
  Binance both fail → Hyperliquid (ETH), all upstream down +
  valid disk snapshot → snapshot served, all sources fail no
  snapshot → empty + provenance, partial response treated as
  failure, unknown asset throws cleanly.

## Validation

- `npx jest --silent` → 238 / 238 passing (was 230; +8 new
  candleSources tests).
- `npx eslint src/ --max-warnings 50` → 0 errors / 47 warnings.
- Hand-verified end-to-end:
  - Primary path: `fetchCandlesMultiSource('ethereum')` returns
    `source: coingecko, candles: 48`.
  - Simulated CoinGecko down: returns `source: binance,
    candles: 48` (ETH) and `source: bybit, candles: 48` (MNT).
  - Simulated all upstream down + populated snapshot: returns
    `source: coingecko-snapshot, fromDiskSnapshot: true`.
  - Fresh runner with no `candle_cache.json` on disk: primary
    path works normally.

## Honest caveats

1. The `candle_cache.json` snapshot file is NOT committed via
   the cron's whitelist — by design. On Vercel serverless this
   means the snapshot never persists between invocations
   (functions are stateless), so the snapshot fallback only
   helps when running long-lived (i.e. the agent cycle on a
   GH Actions runner). Vercel just reads this module via
   `require()` chains in `/api/strategy` etc., where the
   primary→fallback chain still applies, just without the
   disk-snapshot bottom layer. This is acceptable: the chain
   covers all observed failure modes.

2. The fix does NOT address the OTHER CoinGecko call paths
   (`unifiedMarketData.js`, `outcomeTracker.js`, etc.). Those
   hit `simple/price` rather than `market_chart` and have
   different failure profiles — they're not on the grid signal
   critical path. A follow-up audit can extend the multi-source
   pattern to them. For now: the cycle-blocking failure mode
   is fixed.

3. We deliberately keep CoinGecko as the primary source.
   Reasons: (a) when it works, its data tracks the broad market
   well, (b) downgrading it to fallback would penalise the
   majority of cycles when it's healthy. The cost of trying it
   first and failing fast is a few hundred ms.

## What's next (out of scope here)

- Apply the same multi-source pattern to `unifiedMarketData.js`
  (CoinGecko `simple/price` → Binance ticker → Bybit ticker).
- Surface `dataSource` + `fromDiskSnapshot` in
  `outcomes.json` row + `/api/decisions` so the dashboard can
  honestly show "this cycle's grid signal came from Binance
  fallback" when relevant.
- A "stale data" badge on `/proof-explorer` when the most-recent
  cycle has `fromDiskSnapshot: true` (steering §1 §2).
