/**
 * TuringVault — Multi-Source Candle Fetcher
 *
 * Why this module exists:
 *
 * Production cron (GitHub Actions) shares public IPs with the entire
 * `ubuntu-latest` runner pool. CoinGecko's free tier rate-limits per
 * IP, so our cron periodically gets HTTP 429 — even on a single
 * request, because somebody else on the same IP just burned the
 * minute's quota.
 *
 * Production cycles 144-147 (and many before) all carried
 * "ETH/MNT GRID: Channel not established (Insufficient price history)"
 * in the analyst prompt. Root cause was the single-source CoinGecko
 * fetch returning either 429 or a partial response, falling through
 * to <10 candles, and `detectChannel` rejecting the channel.
 *
 * Fix: try a chain of independent free public sources until one
 * yields enough candles. Fall back to a persistent on-disk snapshot
 * if every source fails. Tag the candle set with `_source` so
 * outcomes.json can record which source the cycle saw — making the
 * pattern visible for future audit.
 *
 * Sources used (in order):
 *
 *   ETH:  CoinGecko → Binance Spot → Hyperliquid → disk snapshot
 *   MNT:  CoinGecko → Bybit Spot   → Hyperliquid → disk snapshot
 *
 * Each source is wrapped in a 5s timeout. Total budget per call is
 * therefore ≤15s end-to-end (3 sources × 5s) — well under cycle
 * timeout.
 *
 * The on-disk snapshot lives at src/data/candle_cache.json and is
 * updated only on successful upstream fetch (never on cache reuse,
 * to avoid stamping stale-on-stale).
 *
 * Honesty contract: every returned candle set carries:
 *   { candles: Candle[], source: string, fetchedAt: number,
 *     fromDiskSnapshot: boolean, snapshotAgeSec?: number }
 * Callers MUST surface `source` + `fromDiskSnapshot` in the
 * downstream context (analyst prompt + outcomes ledger) so a judge
 * can see the data path. Audit ref: discovered during debugging the
 * 16-cycle BLOCKED_BY_REGIME run on 2026-05-29.
 */

const fs = require("fs");
const path = require("path");

const SNAPSHOT_PATH = path.resolve(
  __dirname,
  "../../src/data/candle_cache.json"
);
const SNAPSHOT_MAX_AGE_SEC = 6 * 3600; // 6 hours; older than that, refuse

const FETCH_TIMEOUT_MS = 5000;

/**
 * Internal: timed fetch helper. Returns parsed JSON or throws.
 * The native fetch in Node 22 honours AbortSignal.timeout cleanly.
 */
async function fetchJson(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeout || FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      method: opts.method || "GET",
      headers: opts.headers,
      body: opts.body,
      signal: ctrl.signal,
    });
    if (!r.ok) {
      throw new Error(`HTTP ${r.status}`);
    }
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

/**
 * Normalise candles into the shape the rest of the code expects:
 *   { timestamp: ms, price: close, time: iso }
 * Sorted ascending by timestamp.
 */
function normaliseCandles(rows) {
  return rows
    .map((r) => ({
      timestamp: r.timestamp,
      price: r.price,
      time: new Date(r.timestamp).toISOString(),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

// ── source: CoinGecko ─────────────────────────────────────────────
async function fromCoinGecko(asset, hours) {
  const days = Math.max(1, Math.ceil(hours / 24));
  // CoinGecko hourly is automatic on days <= 90.
  const url = `https://api.coingecko.com/api/v3/coins/${asset}/market_chart?vs_currency=usd&days=${days}`;
  const data = await fetchJson(url);
  if (!Array.isArray(data?.prices)) {
    throw new Error("no prices");
  }
  const rows = data.prices.map(([ts, price]) => ({ timestamp: ts, price }));
  return normaliseCandles(rows).slice(-hours);
}

// ── source: Binance Spot (ETH only) ───────────────────────────────
async function fromBinance(symbol, hours) {
  // Binance limit max 1000, 1h interval, sorted ascending by openTime.
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=${Math.min(
    hours,
    1000
  )}`;
  const data = await fetchJson(url);
  if (!Array.isArray(data)) throw new Error("not array");
  // [openTime, open, high, low, close, volume, ...]
  const rows = data.map((k) => ({
    timestamp: Number(k[0]),
    price: parseFloat(k[4]),
  }));
  return normaliseCandles(rows).slice(-hours);
}

// ── source: Bybit Spot (MNT) ──────────────────────────────────────
async function fromBybit(symbol, hours) {
  // Bybit returns newest first; we'll sort ascending in normaliseCandles.
  const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=60&limit=${Math.min(
    hours,
    1000
  )}`;
  const data = await fetchJson(url);
  const list = data?.result?.list;
  if (!Array.isArray(list)) throw new Error("no list");
  // [startTime (str ms), open, high, low, close, volume, turnover]
  const rows = list.map((k) => ({
    timestamp: Number(k[0]),
    price: parseFloat(k[4]),
  }));
  return normaliseCandles(rows).slice(-hours);
}

// ── source: Hyperliquid ───────────────────────────────────────────
async function fromHyperliquid(coin, hours) {
  const startTime = Date.now() - hours * 3600 * 1000;
  const body = {
    type: "candleSnapshot",
    req: {
      coin,
      interval: "1h",
      startTime,
      endTime: Date.now(),
    },
  };
  const data = await fetchJson("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!Array.isArray(data)) throw new Error("not array");
  // [{ t: openTime, c: close, ... }]
  const rows = data.map((c) => ({
    timestamp: Number(c.t),
    price: parseFloat(c.c),
  }));
  return normaliseCandles(rows).slice(-hours);
}

// ── disk snapshot ──────────────────────────────────────────────────

function readSnapshot() {
  try {
    if (!fs.existsSync(SNAPSHOT_PATH)) return null;
    return JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8"));
  } catch {
    return null;
  }
}

function writeSnapshot(asset, candles, source) {
  try {
    const cache = readSnapshot() || {};
    cache[asset] = {
      candles,
      source,
      savedAt: Date.now(),
    };
    // Best-effort write; don't crash the cycle on disk full / permissions.
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(cache, null, 2));
  } catch {
    /* ignored */
  }
}

// ── public surface ─────────────────────────────────────────────────

/**
 * Source order per asset. CoinGecko stays first because when it works
 * its data is often most accurate to the broader market. The other
 * sources are progressively more specialised but very reliable.
 *
 * `id` for CoinGecko (coin slug); `symbol` for centralised exchanges.
 */
const ASSET_CONFIG = {
  ethereum: {
    coingeckoId: "ethereum",
    binanceSymbol: "ETHUSDT",
    hyperliquidCoin: "ETH",
    sources: ["coingecko", "binance", "hyperliquid"],
  },
  mantle: {
    coingeckoId: "mantle",
    bybitSymbol: "MNTUSDT",
    hyperliquidCoin: "MNT",
    sources: ["coingecko", "bybit", "hyperliquid"],
  },
};

/**
 * Fetch candles for `asset` ('ethereum' or 'mantle'), trying each
 * configured source until one yields ≥minRequired candles. Returns
 * a tagged result so the caller can surface provenance honestly.
 *
 * @param {string} asset
 * @param {number} hours
 * @param {number} minRequired — minimum candles considered valid.
 *                               Default 8: balances "enough to compute
 *                               support/resistance" vs "tolerant of
 *                               brief upstream gaps".
 * @returns {Promise<{candles, source, fetchedAt, fromDiskSnapshot,
 *                    snapshotAgeSec?, errors: string[]}>}
 */
async function fetchCandlesMultiSource(asset, hours = 48, minRequired = 8) {
  const cfg = ASSET_CONFIG[asset];
  if (!cfg) {
    throw new Error(`unknown asset: ${asset}`);
  }

  const errors = [];
  for (const sourceName of cfg.sources) {
    try {
      let candles;
      switch (sourceName) {
        case "coingecko":
          candles = await fromCoinGecko(cfg.coingeckoId, hours);
          break;
        case "binance":
          candles = await fromBinance(cfg.binanceSymbol, hours);
          break;
        case "bybit":
          candles = await fromBybit(cfg.bybitSymbol, hours);
          break;
        case "hyperliquid":
          candles = await fromHyperliquid(cfg.hyperliquidCoin, hours);
          break;
        default:
          continue;
      }
      if (candles && candles.length >= minRequired) {
        writeSnapshot(asset, candles, sourceName);
        return {
          candles,
          source: sourceName,
          fetchedAt: Date.now(),
          fromDiskSnapshot: false,
          errors,
        };
      }
      errors.push(
        `${sourceName}: only ${candles ? candles.length : 0} candles`
      );
    } catch (e) {
      errors.push(`${sourceName}: ${(e.message || "unknown").slice(0, 80)}`);
    }
  }

  // All upstream sources failed — try disk snapshot.
  const snap = readSnapshot();
  const cached = snap?.[asset];
  if (cached?.candles && cached.candles.length >= minRequired) {
    const ageSec = Math.floor((Date.now() - (cached.savedAt || 0)) / 1000);
    if (ageSec <= SNAPSHOT_MAX_AGE_SEC) {
      return {
        candles: cached.candles,
        source: `${cached.source || "unknown"}-snapshot`,
        fetchedAt: cached.savedAt,
        fromDiskSnapshot: true,
        snapshotAgeSec: ageSec,
        errors,
      };
    }
    errors.push(`disk-snapshot: too old (${ageSec}s)`);
  }

  // Total failure — caller decides what to do.
  return {
    candles: [],
    source: "none",
    fetchedAt: Date.now(),
    fromDiskSnapshot: false,
    errors,
  };
}

module.exports = {
  fetchCandlesMultiSource,
  // Exposed for unit tests only.
  _readSnapshot: readSnapshot,
  _writeSnapshot: writeSnapshot,
  _SNAPSHOT_PATH: SNAPSHOT_PATH,
  _SNAPSHOT_MAX_AGE_SEC: SNAPSHOT_MAX_AGE_SEC,
  _ASSET_CONFIG: ASSET_CONFIG,
};
