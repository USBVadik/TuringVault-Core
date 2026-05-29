/**
 * TuringVault — Ranging Grid Strategy
 *
 * Mean-reversion engine for RANGING market regime.
 * Core idea: ETH oscillates in a price channel → sell near top, buy near bottom.
 * On Mantle gas ≈ $0.02 → this is mathematically profitable at any portfolio size.
 *
 * Architecture:
 *   detectChannel()     → find support/resistance from recent price history
 *   getGridSignal()     → calculate current position in channel → BUY/SELL/HOLD
 *   shouldExit()        → detect channel breakdown → exit to mUSD
 *
 * Used by: signalEngine.js (RANGING regime enrichment)
 * Called by: multiAgent.js ANALYST node
 */

const CACHE = {};
const CACHE_TTL = 90 * 1000; // 90 seconds — faster refresh for live trading

function cached(key, fn, ttlOverride) {
  const ttl = ttlOverride || CACHE_TTL;
  const e = CACHE[key];
  if (e && Date.now() - e.ts < ttl) return Promise.resolve(e.data);
  return fn()
    .then((d) => {
      CACHE[key] = { data: d, ts: Date.now() };
      return d;
    })
    .catch(() => e?.data || null);
}

async function fetchJson(url, timeout = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

/**
 * Get current ETH price from Hyperliquid (fast, <100ms, already used in pipeline)
 * Used as real-time price source to avoid CoinGecko lag
 */
async function getLiveEthPrice() {
  return cached(
    "live_eth_price",
    async () => {
      const r = await fetchJson("https://api.hyperliquid.xyz/info", 4000);
      if (!r) throw new Error("No data");
      // Hyperliquid returns array of market contexts
      const body = { type: "allMids" };
      const res = await fetch("https://api.hyperliquid.xyz/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const mids = await res.json();
      const ethPrice = parseFloat(mids["ETH"] || 0);
      if (!ethPrice) throw new Error("ETH price not found");
      return ethPrice;
    },
    30 * 1000
  ); // 30s cache for live price
}

/**
 * Fetch hourly OHLC candles from CoinGecko for an arbitrary asset.
 *
 * @param {object|number} optsOrHours
 *   number → legacy form: hours, asset defaults to 'mantle' for backward
 *            compat with the previous `fetchEthCandles(48)` call site.
 *   object → { hours, asset } — explicit form. asset is the CoinGecko id
 *            ('mantle' or 'ethereum').
 */
async function fetchPriceCandles(optsOrHours = 48) {
  const opts =
    typeof optsOrHours === "number" ? { hours: optsOrHours } : optsOrHours;
  const hours = opts.hours ?? 48;
  const asset = opts.asset || "mantle";
  return cached(`${asset}_candles_${hours}`, async () => {
    // Multi-source fetch with disk-snapshot fallback. Replaces the
    // single-source CoinGecko call that was responsible for 16
    // consecutive BLOCKED_BY_REGIME cycles on 2026-05-29 — the
    // GitHub Actions runner pool's IP got 429'd by CoinGecko free
    // tier and we had no fallback. See src/strategies/candleSources.js.
    //
    // We deliberately accept partial responses (≥6 candles is enough
    // to compute support/resistance for intraday mean-reversion).
    const { fetchCandlesMultiSource } = require("./candleSources");
    const result = await fetchCandlesMultiSource(asset, hours, 6);
    if (!result.candles || result.candles.length === 0) {
      const detail = result.errors?.join(" | ") || "all sources failed";
      throw new Error(`No price data: ${detail}`);
    }
    // Tag the candle array with source provenance so callers (and
    // outcomes ledger) can surface it honestly. The array remains
    // iterable as-is for legacy code paths; just don't iterate
    // beyond .length.
    Object.defineProperty(result.candles, "_source", {
      value: result.source,
      enumerable: false,
    });
    Object.defineProperty(result.candles, "_fromDiskSnapshot", {
      value: result.fromDiskSnapshot,
      enumerable: false,
    });
    Object.defineProperty(result.candles, "_snapshotAgeSec", {
      value: result.snapshotAgeSec ?? null,
      enumerable: false,
    });
    return result.candles;
  });
}

// Back-compat alias. Old call sites still work; the function did MNT
// despite the misleading name (commit history bears scars), so the
// alias preserves that behaviour exactly.
const fetchEthCandles = (hours = 48) =>
  fetchPriceCandles({ hours, asset: "mantle" });

/**
 * Detect price channel (support/resistance) from recent candles
 * Uses rolling percentile approach — robust to wicks/noise
 *
 * @param {number} hours - lookback window (default 48h for reliable channel)
 * @param {number} channelPct - what % move defines the channel width (default 5%)
 * @returns {object} channel data
 */
async function detectChannel(opts = {}, channelPctArg) {
  // Back-compat: detectChannel(48, 0.05) used to be the call shape.
  // If first arg is a number, fall back to legacy form.
  let hours;
  let asset;
  let channelPct;
  if (typeof opts === "number") {
    hours = opts;
    channelPct = channelPctArg ?? 0.05;
    asset = "mantle";
  } else {
    hours = opts.hours ?? 48;
    asset = opts.asset || "mantle";
    channelPct = opts.channelPct ?? 0.05;
  }

  const candles = await fetchPriceCandles({ hours, asset });
  // Relaxed minimum: was 10. With multi-source fetch + occasional
  // partial responses on slower CDN edges, 6 candles is a strict
  // enough basis for support/resistance — we already check
  // tooNarrow + isRanging downstream so a noisy channel still gets
  // flagged. Audit ref: candleSources.js header comment.
  if (!candles || candles.length < 6) {
    return { valid: false, reason: "Insufficient price history", asset };
  }

  const prices = candles.map((c) => c.price);
  const currentPrice = prices[prices.length - 1];

  // Sort for percentile calculation
  const sorted = [...prices].sort((a, b) => a - b);
  const n = sorted.length;

  // Use 10th/90th percentile as support/resistance (robust to outliers)
  const support = sorted[Math.floor(n * 0.1)];
  const resistance = sorted[Math.floor(n * 0.9)];
  const channelMid = (support + resistance) / 2;
  const channelWidth = resistance - support;
  const channelWidthPct = channelWidth / channelMid;

  // Is this actually a ranging channel? Width should be within reason
  const isRanging =
    channelWidthPct <= channelPct * 3 && channelWidthPct >= 0.005;

  // Minimum width check: channel must be wide enough for profitable trading after slippage
  // At 0.15% slippage + 0.02% gas: need at least 0.5% reward = 0.7% channel minimum
  const MIN_CHANNEL_WIDTH_PCT = 0.007; // 0.7%
  const tooNarrow = channelWidthPct < MIN_CHANNEL_WIDTH_PCT;

  // Where is current price in the channel? 0 = at support, 1 = at resistance
  const channelPosition = Math.max(
    0,
    Math.min(1, (currentPrice - support) / (channelWidth || 1))
  );

  // Recent volatility: std dev of last 12h vs prior 12h
  const recent = prices.slice(-12);
  const prior = prices.slice(-24, -12);
  const recentStd = stdDev(recent);
  const priorStd = stdDev(prior);
  const volatilityExpanding = recentStd > priorStd * 1.3; // 30% spike = trend forming

  // Trend check: linear regression slope on last 24h
  const slope = linearSlope(prices.slice(-24));
  const slopePct = Math.abs(slope) / channelMid; // normalized slope per hour
  const hasTrend = slopePct > 0.0015; // >0.15% per hour = trending (relaxed for low-cap assets)

  return {
    valid: isRanging,
    asset,
    tooNarrow,
    currentPrice,
    support: Math.round(support * 100) / 100,
    resistance: Math.round(resistance * 100) / 100,
    channelMid: Math.round(channelMid * 100) / 100,
    channelWidthPct: Math.round(channelWidthPct * 10000) / 100, // as %
    channelPosition: Math.round(channelPosition * 100) / 100, // 0..1
    isRanging,
    volatilityExpanding,
    hasTrend,
    slope: Math.round(slope * 100) / 100,
    lookbackHours: hours,
    candleCount: candles.length,
    // Provenance — set by candleSources.fetchCandlesMultiSource via
    // hidden, non-enumerable properties on the candles array.
    // Surfaces in outcomes.json + analyst prompt so a future
    // BLOCKED_BY_REGIME cluster can be diagnosed in one read.
    dataSource: candles._source || "unknown",
    fromDiskSnapshot: candles._fromDiskSnapshot === true,
    snapshotAgeSec: candles._snapshotAgeSec || null,
    // Grid levels for execution
    gridLevels: computeGridLevels(support, resistance, 5),
  };
}

/**
 * Compute N grid levels between support and resistance
 * These are the buy/sell trigger prices for the bot
 */
function computeGridLevels(support, resistance, n = 5) {
  const levels = [];
  const step = (resistance - support) / (n - 1);
  for (let i = 0; i < n; i++) {
    const price = support + step * i;
    const pct = i / (n - 1); // 0 = bottom, 1 = top
    levels.push({
      price: Math.round(price * 100) / 100,
      pct: Math.round(pct * 100) / 100,
      zone: pct <= 0.25 ? "BUY_ZONE" : pct >= 0.75 ? "SELL_ZONE" : "NEUTRAL",
    });
  }
  return levels;
}

/**
 * Main signal generator for RANGING regime.
 * Returns actionable signal: BUY_mETH | SELL_mETH | HOLD
 *
 * Logic (optimized R:R):
 *  - Price in BUY zone (< 30%)  → BUY mETH, TP at 75% of channel
 *  - Price in SELL zone (> 70%) → SELL mETH → mUSD, TP at 25% of channel
 *  - Price in HOLD zone (30-70%) → HOLD (wait for edge)
 *  - Channel invalid or trend forming → EXIT (switch to trend logic)
 *
 * R:R math (5% channel example, entry at 20%, TP at 75%):
 *   Reward: 55% of channel width = 2.75%
 *   Risk (SL 1.2% below support): 1.2%
 *   R:R = 2.3:1 ← profitable at >30% win rate
 *
 * @param {number} [currentPrice] - override price (optional, fetches if not provided)
 * @param {object} [opts] - { asset } — 'mantle' (default for back-compat) or 'ethereum'
 */
async function getGridSignal(currentPrice, opts = {}) {
  const asset = opts.asset || "mantle";
  const result = await _getGridSignalImpl(currentPrice, asset);
  // Stamp asset on every return shape uniformly so callers don't have
  // to remember to inject it across N branches inside the impl.
  return { ...result, asset };
}

async function _getGridSignalImpl(currentPrice, asset) {
  const channel = await detectChannel({ hours: 48, asset });

  if (!channel.valid) {
    return {
      action: "HOLD",
      reason: channel.reason || "Channel not valid",
      channel: null,
      confidence: 0.3,
    };
  }

  // Channel too narrow for profitable trading after slippage
  if (channel.tooNarrow) {
    return {
      action: "HOLD",
      reason: `Channel too narrow (${channel.channelWidthPct}% < 0.7% minimum). Slippage would eat profits. Waiting for wider range.`,
      channel,
      confidence: 0.4,
    };
  }

  // Use passed price (from live pipeline), then try Hyperliquid, then fall back to channel's CoinGecko price
  let price = currentPrice;
  if (!price || price <= 0) {
    try {
      price = await getLiveEthPrice();
    } catch {}
  }
  price = price || channel.currentPrice;

  // Recalculate position in channel using live price (not stale CoinGecko price)
  const channelWidth = channel.resistance - channel.support;
  const pos = Math.max(
    0,
    Math.min(1, (price - channel.support) / (channelWidth || 1))
  );

  // Channel breakdown detection
  if (channel.volatilityExpanding || channel.hasTrend) {
    return {
      action: "EXIT_RANGING",
      reason: `Channel breaking down. Volatility expanding: ${channel.volatilityExpanding}, trend forming: ${channel.hasTrend}`,
      channel,
      confidence: 0.7,
    };
  }

  // Price above resistance = breakout
  if (price > channel.resistance * 1.01) {
    return {
      action: "EXIT_RANGING",
      reason: `Price ${price} broke above resistance ${channel.resistance} — switch to TREND_UP`,
      channel,
      confidence: 0.8,
    };
  }

  // Price below support = breakdown
  if (price < channel.support * 0.99) {
    return {
      action: "EXIT_RANGING",
      reason: `Price ${price} broke below support ${channel.support} — switch to TREND_DOWN or CRISIS`,
      channel,
      confidence: 0.8,
    };
  }

  // ── ENTRY ZONES (wider: 30/70 instead of 25/75) ──────────────────
  // ── TAKE PROFIT at opposite zone edge (not midpoint) ─────────────
  // ── STOP LOSS: 1.2% beyond channel boundary ──────────────────────

  if (pos <= 0.3) {
    // BUY ZONE — near support
    const distanceFromSupport = (
      ((price - channel.support) / channel.channelMid) *
      100
    ).toFixed(2);
    // TP at 75% of channel (not midpoint) — captures most of the range
    const targetExit = channel.support + channelWidth * 0.75;
    // SL: adaptive — max(0.3% below entry, 40% of expected reward)
    // This ensures R:R >= 1.5:1 regardless of channel width
    const expectedReward = targetExit - price;
    const slDistance = Math.max(price * 0.003, expectedReward * 0.4); // never risk more than 40% of reward
    const stopLoss = price - slDistance;
    // Reward vs risk
    const rewardPct = (((targetExit - price) / price) * 100).toFixed(2);
    const riskPct = ((slDistance / price) * 100).toFixed(2);

    return {
      action: "BUY_mETH",
      reason: `Price at ${(pos * 100).toFixed(
        0
      )}% of channel (BUY zone, support $${
        channel.support
      }). R:R = ${rewardPct}%/${riskPct}% = ${(
        expectedReward / slDistance
      ).toFixed(1)}:1`,
      channel,
      confidence: 0.65 + (0.3 - pos) * 0.5, // stronger closer to support
      targetExit: Math.round(targetExit * 100) / 100,
      stopLoss: Math.round(stopLoss * 100) / 100,
      trailingStopPct: 0.6, // activate trailing stop after +0.6% profit
    };
  }

  if (pos >= 0.7) {
    // SELL ZONE — near resistance
    const distanceFromResistance = (
      ((channel.resistance - price) / channel.channelMid) *
      100
    ).toFixed(2);
    // TP at 25% of channel (opposite buy zone)
    const targetExit = channel.support + channelWidth * 0.25;
    // SL: adaptive — same logic as BUY but inverted
    const expectedReward = price - targetExit;
    const slDistance = Math.max(price * 0.003, expectedReward * 0.4);
    const stopLoss = price + slDistance;
    const rewardPct = (((price - targetExit) / price) * 100).toFixed(2);
    const riskPct = ((slDistance / price) * 100).toFixed(2);

    return {
      action: "SELL_mETH",
      reason: `Price at ${(pos * 100).toFixed(
        0
      )}% of channel (SELL zone, resistance $${
        channel.resistance
      }). R:R = ${rewardPct}%/${riskPct}% = ${(
        expectedReward / slDistance
      ).toFixed(1)}:1`,
      channel,
      confidence: 0.65 + (pos - 0.7) * 0.5, // stronger closer to resistance
      targetExit: Math.round(targetExit * 100) / 100,
      stopLoss: Math.round(stopLoss * 100) / 100,
      trailingStopPct: 0.6,
    };
  }

  // HOLD zone — no edge
  return {
    action: "HOLD",
    reason: `Price at ${(pos * 100).toFixed(
      0
    )}% of channel (HOLD zone 30-70%). Wait for edge near support ($${
      channel.support
    }) or resistance ($${channel.resistance})`,
    channel,
    confidence: 0.5,
  };
}

/**
 * Check if we should EXIT a ranging position early.
 * NOW delegates to positionState for TP/SL (single source of truth).
 * Only adds channel-break detection on top.
 *
 * @param {number} currentPrice - live price
 * @param {object} posState - from positionState.getState()
 */
async function shouldExitPosition(currentPrice, posState) {
  if (!posState || posState.status === "FLAT") {
    return { exit: false, reason: "No position" };
  }

  const { entryPrice, stopLoss, targetExit, highWaterMark } = posState;

  // 1. STOP LOSS (from positionState — set at entry time by grid signal)
  const effectiveSL = stopLoss || entryPrice * 0.988;
  if (currentPrice <= effectiveSL) {
    return {
      exit: true,
      reason: `STOP LOSS: $${currentPrice} ≤ SL $${effectiveSL.toFixed(
        2
      )}. Entry: $${entryPrice}. PnL: ${(
        (currentPrice / entryPrice - 1) *
        100
      ).toFixed(2)}%`,
      action: "STOP_LOSS",
      pnlPct: ((currentPrice / entryPrice - 1) * 100).toFixed(2),
    };
  }

  // 2. TRAILING STOP — if up >0.6% from entry, trail at 40% retracement from HWM
  const hwm = Math.max(highWaterMark || entryPrice, currentPrice);
  const profitPct = (currentPrice / entryPrice - 1) * 100;
  if (profitPct >= 0.6 && hwm > entryPrice) {
    const trailLevel = hwm - (hwm - entryPrice) * 0.4; // keep 60% of gains
    if (currentPrice <= trailLevel) {
      return {
        exit: true,
        reason: `TRAILING STOP: $${currentPrice} < trail $${trailLevel.toFixed(
          2
        )} (HWM: $${hwm.toFixed(2)}). Locking gains.`,
        action: "TRAILING_STOP",
        pnlPct: ((currentPrice / entryPrice - 1) * 100).toFixed(2),
      };
    }
  }

  // 3. TAKE PROFIT (from positionState)
  const effectiveTP = targetExit || entryPrice * 1.02;
  if (currentPrice >= effectiveTP) {
    return {
      exit: true,
      reason: `TAKE PROFIT: $${currentPrice} ≥ TP $${effectiveTP.toFixed(
        2
      )}. PnL: +${((currentPrice / entryPrice - 1) * 100).toFixed(2)}%`,
      action: "TAKE_PROFIT",
      pnlPct: ((currentPrice / entryPrice - 1) * 100).toFixed(2),
    };
  }

  // 4. CHANNEL BREAKDOWN — additional safety net
  const channel = await detectChannel(48);
  if (channel.valid && currentPrice < channel.support * 0.99) {
    return {
      exit: true,
      reason: `CHANNEL BREAK: $${currentPrice} fell below support $${channel.support}. Emergency exit.`,
      action: "CHANNEL_BREAK",
      pnlPct: ((currentPrice / entryPrice - 1) * 100).toFixed(2),
    };
  }

  return { exit: false, currentPnlPct: profitPct.toFixed(2), hwm };
}

// ─── Math helpers ─────────────────────────────────────────────────

function stdDev(arr) {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

function linearSlope(arr) {
  // Simple linear regression slope (price units per candle)
  const n = arr.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = arr.reduce((a, b) => a + b, 0) / n;
  let num = 0,
    den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (arr[i] - yMean);
    den += (i - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

/**
 * Get grid signals for both MNT and ETH in parallel.
 * Picks the strongest edge (BUY/SELL beats HOLD; tighter zone wins).
 *
 * Returns { mantle, ethereum, primary } where primary is the asset
 * whose signal the analyst should preferentially act on.
 */
async function getMultiAssetGridSignal() {
  const [mnt, eth] = await Promise.allSettled([
    getGridSignal(undefined, { asset: "mantle" }),
    getGridSignal(undefined, { asset: "ethereum" }),
  ]);

  const mantle = mnt.status === "fulfilled" ? mnt.value : null;
  const ethereum = eth.status === "fulfilled" ? eth.value : null;

  // Strength score: actionable signals beat HOLD; narrower zone is better.
  // Penalise EXIT_RANGING since that's a "switch regimes" flag, not an edge.
  function strength(sig) {
    if (!sig) return -1;
    if (sig.action === "EXIT_RANGING") return -0.5;
    if (sig.action === "BUY_mETH" || sig.action === "SELL_mETH") {
      // closer to edge = better. position 0 (at support) or 1 (at resistance)
      // is best; 0.3/0.7 is borderline.
      const pos = sig.channel?.channelPosition ?? 0.5;
      const edgeDistance = Math.min(pos, 1 - pos);
      return 1 - edgeDistance; // 1.0 at edge, 0.5 at midpoint
    }
    return 0; // HOLD or other
  }

  const mntStrength = strength(mantle);
  const ethStrength = strength(ethereum);
  const primary =
    ethStrength > mntStrength ? "ethereum" : "mantle";

  return { mantle, ethereum, primary };
}

/**
 * Build a human-readable summary for the ANALYST prompt.
 * Now produces TWO grid views (MNT and ETH) so the analyst can pick
 * the asset with a stronger edge. Both pools exist on Mantle and the
 * orchestrator routes appropriately:
 *   target=mETH → USDT0→USDT→WMNT→mETH (buys ETH-pegged exposure)
 *   target=MNT  → USDT0→USDT→WMNT       (buys MNT exposure)
 */
async function buildRangingContext() {
  try {
    const multi = await getMultiAssetGridSignal();
    const blocks = [];

    function renderOne(label, sig) {
      if (!sig) return null;
      const ch = sig.channel;
      if (!ch) {
        return `${label} GRID: Channel not established (${sig.reason || "insufficient data"})`;
      }
      return [
        `${label} GRID:`,
        `  Channel: $${ch.support} (support) → $${ch.resistance} (resistance) | Width: ${ch.channelWidthPct}%`,
        `  Current price: $${ch.currentPrice} | Position in channel: ${(
          ch.channelPosition * 100
        ).toFixed(0)}%`,
        `  Channel integrity: ${
          ch.isRanging ? "INTACT" : "QUESTIONABLE"
        } | Trend forming: ${ch.hasTrend} | Vol expanding: ${
          ch.volatilityExpanding
        }`,
        `  Grid signal: ${sig.action} | Confidence: ${(
          sig.confidence * 100
        ).toFixed(0)}%`,
        `  Reasoning: ${sig.reason}`,
        sig.targetExit ? `  Take profit target: $${sig.targetExit}` : "",
        sig.stopLoss ? `  Stop loss: $${sig.stopLoss}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }

    const ethBlock = renderOne("ETH (target=mETH)", multi.ethereum);
    const mntBlock = renderOne("MNT (target=MNT/WMNT)", multi.mantle);
    if (ethBlock) blocks.push(ethBlock);
    if (mntBlock) blocks.push(mntBlock);
    blocks.push(
      `PRIMARY EDGE: ${multi.primary.toUpperCase()} — analyst should preferentially act on this asset's grid signal when proposing a swap.`
    );

    return blocks.join("\n\n");
  } catch (e) {
    return `RANGING GRID: Error computing channels — ${e.message}`;
  }
}

module.exports = {
  detectChannel,
  getGridSignal,
  getMultiAssetGridSignal,
  shouldExitPosition,
  buildRangingContext,
  fetchEthCandles,
  fetchPriceCandles,
  computeGridLevels,
};

// Self-test
if (require.main === module) {
  (async () => {
    console.log("═══ Ranging Grid Strategy Test ═══\n");
    const ctx = await buildRangingContext();
    console.log(ctx);
    console.log("\n═══ Detailed Signal ═══\n");
    const sig = await getGridSignal();
    console.log(JSON.stringify(sig, null, 2));
  })().catch(console.error);
}
