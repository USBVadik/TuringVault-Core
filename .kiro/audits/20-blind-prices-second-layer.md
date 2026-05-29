# Audit 20 — Blind Prices: extending audit-19 multi-source pattern to simple/price

**Date**: 2026-05-29
**Trigger**: Audit 19 fixed the candle (`market_chart`) starvation
that drove 16 consecutive `BLOCKED_BY_REGIME` cycles. While
investigating I noticed `unifiedMarketData.js → getEthPrice`
hits the *same* CoinGecko host on a *different* endpoint
(`simple/price`) with the same shared-IP rate limit problem. A
6-iteration probe confirmed 1-of-6 returns HTTP 429 on a personal
IP — worse on GH Actions runner-pool IPs. This audit closes that
second layer.

---

## What's blocked when prices are zero

`unifiedMarketData.js` builds the `[PRICE DATA]` section of the
analyst's prompt. With `getEthPrice()` failing silently to the
in-memory `cached(...).catch(() => entry?.data || null)` fallback
on a fresh runner, the prompt would carry:

```
ETH: $N/A (24h: 0%)
MNT: $N/A (24h: 0%)
```

The analyst still has the structured signals + grid context — so
this never blocked trading by itself. But it does erode the
narrative: a judge replaying a manifest with `$N/A` quotes correctly
concludes the bot didn't really see the market that cycle. Even on
healthy cycles where the grid signal was strong.

This is also a steering-rule §1 problem: surfacing `0` as a price
is a lie about state. Moving to multi-source + honest provenance
labelling fixes both.

---

## What ships

New module: `src/strategies/priceSources.js`. Same shape as
`candleSources.js` (audit 19) — fallback chain + persistent disk
snapshot + provenance tagging.

Source chain:

```
1. CoinGecko simple/price        — primary (returns prices + 24h Δ)
2. Binance ETHUSDT + Bybit MNTUSDT (parallel) — independent rate
                                                limits, both have
                                                24h Δ fields
3. Hyperliquid allMids           — last resort, ETH + MNT mids,
                                    no 24h Δ (honest null)
4. src/data/price_cache.json     — disk snapshot, 1h max age
```

Each source 5s timeout. Total budget ≤15s.

`unifiedMarketData.getEthPrice()` now delegates to
`fetchPricesMultiSource()`. The result carries `_source`,
`_fromDiskSnapshot`, `_snapshotAgeSec` which propagate into the
prompt context block:

- When CoinGecko works: no extra line (silent primary).
- When fallback fired: `Price source: binance+bybit (CoinGecko
  fallback — primary feed unavailable)`.
- When snapshot served: `Price source: coingecko-snapshot
  (cached 240s ago — upstream feeds unreachable; cycle reasoning
  should treat prices as stale)`.

Top-level `getUnifiedMarketContext` return now includes:

```js
{
  _priceSource: "coingecko" | "binance+bybit" | "hyperliquid"
                | "<x>-snapshot" | null,
  _priceFromSnapshot: boolean,
  _priceSnapshotAgeSec: number | null,
}
```

Outcome ledger and dashboard can record this so a future audit
can spot a source-flap pattern in <10 grep lines.

## Files changed

- `src/strategies/priceSources.js` — new (~210 LOC).
- `src/orchestrator/unifiedMarketData.js`
  - `getEthPrice` delegates to `fetchPricesMultiSource`.
  - Prompt context block labels fallback / snapshot when applicable.
  - Return shape adds `_priceSource` + `_priceFromSnapshot` +
    `_priceSnapshotAgeSec`.
- `tests/unit/priceSources.unit.test.js` — 7 unit tests covering:
  CoinGecko primary, CoinGecko 429 → Binance+Bybit, both
  intermediate down → Hyperliquid (honest null change), all
  upstream down + valid snapshot → snapshot served, full failure
  → zeros + provenance, invalid CoinGecko price (0) → fallback,
  partial failure in Binance+Bybit step → falls through.

## Validation

- `npx jest --silent` → 245 / 245 passing (was 238; +7).
- `npx eslint src/` → 0 errors / 47 warnings.
- Live verification: `getUnifiedMarketContext()` run from operator
  machine right now returns `_priceSource: "binance+bybit"` —
  CoinGecko 429'd at the moment of the test, fallback picked up
  cleanly with valid prices ($2032 ETH, $0.6442 MNT) matching
  CoinGecko within 0.1%.

## Honest caveats

1. The Hyperliquid `allMids` endpoint doesn't carry 24h Δ — when
   that source serves, `ethChange24h` and `mntChange24h` come back
   as `null`. Downstream `unifiedMarketData` casts to 0 for prompt
   formatting; the analyst sees `(24h: 0%)` instead of the real
   value. This is a small narrative loss — accept it because (a)
   it only triggers when both CG AND Binance/Bybit are down, (b)
   the analyst still has the prices, (c) `_priceSource` is
   labelled honestly so a judge knows.

2. `src/data/price_cache.json` is NOT in cron's git-add whitelist,
   so it never gets committed back. Same caveat as `candle_cache.json`
   — the disk snapshot only helps long-lived runners. Vercel's
   serverless is stateless; the file won't persist between cold
   starts. The chain still covers cold-start cases via Binance/Bybit/
   Hyperliquid before falling to disk.

3. `technicalAnalysis.js` still calls CoinGecko `market_chart?days=30`
   directly. That call is on a separate critical path (TA indicators,
   not grid signal). It's not in scope for this audit because the
   30-day window is much more tolerant of partial responses, but a
   follow-up could route it through `candleSources` too.

## What's next

- Surface `_priceSource` + `dataSource` (from candleSources) in the
  `outcomes.json` row + `/api/decisions` JSON so the dashboard can
  honestly show "this cycle saw prices via Binance fallback" when
  relevant.
- Optional: extend `technicalAnalysis.js` to use `candleSources`.
