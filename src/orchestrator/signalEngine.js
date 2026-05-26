/**
 * TuringVault — Signal Engine
 *
 * Replaces the "text blob" approach in unifiedMarketData.js with
 * TYPED, STRUCTURED signals that GLM-5 receives as a clean JSON object —
 * not buried in a paragraph of text.
 *
 * Signals:
 *   fundingRate    — from Byreal perps (annualised %)
 *                    extreme negative → contrarian long signal
 *                    extreme positive → crowded long, caution
 *
 *   liquidationMap — estimated liquidation clusters
 *                    (inferred from OI + funding delta, no mempool needed)
 *                    below price = support (longs get squeezed if price drops)
 *                    above price = resistance (shorts get squeezed if rises)
 *
 *   onChainFlow    — Nansen smart money net flow (USD, 24h)
 *                    positive = accumulation, negative = distribution
 *
 *   yieldSpread    — mETH yield minus USDY risk-free rate
 *                    positive = mETH worth holding
 *                    negative = better to be in stables
 *
 *   regime         — detected market regime
 *                    one of: TREND_UP | TREND_DOWN | RANGING | CRISIS
 *
 * Each signal has: value, signal (BULLISH/BEARISH/NEUTRAL), strength (0-1), source
 */

const { ExecutionEngine } = require('../execution/executionEngine');
const { NansenMCPClient } = require('../mcp/nansenMCP');
const { getSocialSignal: getElfaSignal } = require('../data/elfa');
const { buildRangingContext, getGridSignal } = require('../strategies/rangingGrid');
const { applyPositionAwareness, tickCycle, updateHWM } = require('../strategies/positionState');

const CACHE = {};
const TTL = 5 * 60 * 1000; // 5 min

function cached(key, fn) {
  const e = CACHE[key];
  if (e && Date.now() - e.ts < TTL) return Promise.resolve(e.data);
  return fn().then(d => { CACHE[key] = { data: d, ts: Date.now() }; return d; })
             .catch(() => e?.data || null);
}

async function fetchJson(url, timeout = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

// ─── 1. Funding Rate Signal ────────────────────────────────────────
// Byreal already gives us fundingAnnualized per coin.
// We extract ETH specifically and classify it.

async function getHyperliquidFunding() {
  try {
    const r = await fetchJson('https://api.hyperliquid.xyz/info', 8000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
    });
    const assets = r[0]?.universe;
    const ctxs = r[1];
    if (!assets || !ctxs) return null;
    const idx = assets.findIndex(a => a.name === 'ETH');
    if (idx === -1) return null;
    const fr = parseFloat(ctxs[idx]?.funding || 0);
    return fr * 3 * 365 * 100; // annualized %
  } catch { return null; }
}

async function getFundingSignal() {
  return cached('funding_signal', async () => {
    try {
      // Try Byreal first (has more signals), fallback to Hyperliquid
      let funding = null;
      let ethSignal = null;

      try {
        const engine = new ExecutionEngine({ dryRun: true });
        const signals = await engine.getSignals();
        for (const items of Object.values(signals)) {
          if (!Array.isArray(items)) continue;
          const eth = items.find(s =>
            s.coin?.toUpperCase() === 'ETH' || s.symbol?.toUpperCase()?.includes('ETH')
          );
          if (eth) { ethSignal = eth; break; }
        }
        if (ethSignal) funding = parseFloat(ethSignal.fundingAnnualized || 0);
      } catch {}

      // Fallback: Hyperliquid public API (no auth needed)
      if (funding === null) {
        funding = await getHyperliquidFunding();
      }

      if (funding === null) return { available: false, source: 'byreal' };

      // Funding interpretation:
      //   < -20%  = extreme negative → shorts paying longs → contrarian LONG
      //   -20% to -5% = negative → mild long bias
      //   -5% to +5%  = neutral
      //   +5% to +20% = positive → crowded longs → caution
      //   > +20%  = extreme positive → likely top, CAUTION

      let signal, strength;
      if (funding < -20) {
        signal = 'BULLISH'; strength = 0.85;
      } else if (funding < -5) {
        signal = 'BULLISH'; strength = 0.55;
      } else if (funding > 20) {
        signal = 'BEARISH'; strength = 0.80;
      } else if (funding > 5) {
        signal = 'BEARISH'; strength = 0.50;
      } else {
        signal = 'NEUTRAL'; strength = 0.20;
      }

      return {
        available: true,
        value: funding,
        signal,
        strength,
        rsi: parseFloat(ethSignal?.rsi || 50),
        openInterest: ethSignal?.openInterest || null,
        source: 'byreal',
        raw: ethSignal,
      };
    } catch {
      return { available: false, source: 'byreal' };
    }
  });
}

// ─── 2. Liquidation Map (estimated) ───────────────────────────────
// We can't read Hyperliquid mempool from Mantle, but we can ESTIMATE
// liquidation pressure from:
//   - OI (open interest)
//   - funding rate direction (who's underwater)
//   - price distance from round numbers (psychological clusters)
//
// This gives a "soft" liquidation map: where pressure is concentrated.

async function getLiquidationMap(currentPrice) {
  if (!currentPrice || currentPrice <= 0) return { available: false };

  try {
    // Round number clusters (where people set leverage)
    const roundNumbers = [
      Math.floor(currentPrice / 500) * 500,
      Math.ceil(currentPrice / 500) * 500,
      Math.floor(currentPrice / 1000) * 1000,
      Math.ceil(currentPrice / 1000) * 1000,
    ].filter((v, i, a) => a.indexOf(v) === i && v !== currentPrice);

    // Estimate squeeze levels based on typical leverage (10x-20x)
    const lev10_low  = +(currentPrice * 0.90).toFixed(0);  // 10x long liq ~10% below
    const lev20_low  = +(currentPrice * 0.95).toFixed(0);  // 20x long liq ~5% below
    const lev10_high = +(currentPrice * 1.10).toFixed(0);  // 10x short liq ~10% above
    const lev20_high = +(currentPrice * 1.05).toFixed(0);  // 20x short liq ~5% above

    // If funding is very positive: longs are crowded → long liquidations below are the risk
    // If funding is very negative: shorts are crowded → short liquidations above are the risk
    const fundingData = await getFundingSignal();
    const funding = fundingData?.value || 0;

    const longCrowded = funding > 5;
    const shortCrowded = funding < -5;

    return {
      available: true,
      currentPrice,
      // Below price: long liquidation zones (if price drops here, cascades down)
      longLiquidations: [
        { price: lev20_low, leverage: '20x', risk: longCrowded ? 'HIGH' : 'MEDIUM' },
        { price: lev10_low, leverage: '10x', risk: longCrowded ? 'MEDIUM' : 'LOW' },
      ],
      // Above price: short liquidation zones (if price rises here, cascades up)
      shortLiquidations: [
        { price: lev20_high, leverage: '20x', risk: shortCrowded ? 'HIGH' : 'MEDIUM' },
        { price: lev10_high, leverage: '10x', risk: shortCrowded ? 'MEDIUM' : 'LOW' },
      ],
      roundNumberClusters: roundNumbers,
      primaryRisk: longCrowded ? 'LONG_SQUEEZE_BELOW' : shortCrowded ? 'SHORT_SQUEEZE_ABOVE' : 'BALANCED',
      source: 'estimated_from_oi_funding',
    };
  } catch {
    return { available: false };
  }
}

// ─── 3. On-Chain Flow Signal ───────────────────────────────────────
// Nansen smart money net flow. We use general_search (free) with
// specific query to extract flow data. Parsed heuristically.

async function getOnChainFlowSignal() {
  return cached('onchain_flow', async () => {
    const apiKey = process.env.NANSEN_API_KEY;
    if (!apiKey) return { available: false, source: 'nansen' };

    try {
      const client = new NansenMCPClient(apiKey);
      // general_search is free — ask specifically about ETH smart money
      const result = await client.callTool('general_search', {
        query: 'ETH smart money inflow outflow 24h Mantle',
      });

      const text = result?.content?.[0]?.text || JSON.stringify(result).slice(0, 1000);

      // Heuristic parse: look for inflow/outflow mentions
      const inflowMatch = text.match(/inflow[:\s]+\$?([\d,.]+)(M|K|B)?/i);
      const outflowMatch = text.match(/outflow[:\s]+\$?([\d,.]+)(M|K|B)?/i);

      const parseAmount = (match) => {
        if (!match) return 0;
        const n = parseFloat(match[1].replace(/,/g, ''));
        const mult = match[2] === 'B' ? 1e9 : match[2] === 'M' ? 1e6 : match[2] === 'K' ? 1e3 : 1;
        return n * mult;
      };

      const inflow = parseAmount(inflowMatch);
      const outflow = parseAmount(outflowMatch);
      const netFlow = inflow - outflow;

      let signal, strength;
      if (netFlow > 5e6) {
        signal = 'BULLISH'; strength = Math.min(0.9, netFlow / 50e6);
      } else if (netFlow < -5e6) {
        signal = 'BEARISH'; strength = Math.min(0.9, -netFlow / 50e6);
      } else {
        signal = 'NEUTRAL'; strength = 0.2;
      }

      return {
        available: true,
        netFlowUsd: netFlow,
        inflow,
        outflow,
        signal,
        strength,
        rawText: text.slice(0, 300),
        source: 'nansen_general_search',
      };
    } catch {
      return { available: false, source: 'nansen' };
    }
  });
}

// ─── 4. Yield Spread Signal ────────────────────────────────────────

async function getYieldSpreadSignal(mETHYield = 3.5) {
  const USDY_RISK_FREE = 4.5; // Ondo USDY approximate yield
  const spread = mETHYield - USDY_RISK_FREE;

  let signal, strength;
  if (spread > 1.5) {
    signal = 'BULLISH'; strength = Math.min(0.9, spread / 5);
  } else if (spread > 0) {
    signal = 'BULLISH'; strength = 0.35;
  } else if (spread > -1) {
    signal = 'NEUTRAL'; strength = 0.2;
  } else {
    signal = 'BEARISH'; strength = Math.min(0.8, -spread / 5);
  }

  return {
    available: true,
    mETHYield,
    usdyYield: USDY_RISK_FREE,
    spread: +spread.toFixed(2),
    signal,
    strength,
    source: 'calculated',
  };
}

// ─── 5. Regime Detector ────────────────────────────────────────────
// Synthesise funding + flow + F&G + price change into a regime label.
// This tells GLM-5 WHAT MODE to reason in, not just raw numbers.

function detectRegime({ fearGreed, ethChange24h, fundingSignal, flowSignal }) {
  const fg = fearGreed || 50;
  const change = ethChange24h || 0;
  const funding = fundingSignal?.value || 0;
  const flowBull = flowSignal?.signal === 'BULLISH';
  const flowBear = flowSignal?.signal === 'BEARISH';

  // CRISIS: extreme fear + sharp drop
  if (fg < 20 && change < -5) {
    return { regime: 'CRISIS', confidence: 0.85,
      implication: 'Capital preservation priority. HOLD or mUSD defensive allocation.' };
  }

  // TREND_UP: greed + positive price + smart money in
  if (fg > 60 && change > 1 && (flowBull || funding > 0)) {
    return { regime: 'TREND_UP', confidence: 0.75,
      implication: 'Risk-on justified. mETH allocation if yield spread positive.' };
  }

  // TREND_DOWN: fear + negative price + smart money out
  if (fg < 35 && change < -1 && (flowBear || funding > 10)) {
    return { regime: 'TREND_DOWN', confidence: 0.72,
      implication: 'Reduce risk. mUSD allocation or HOLD depending on depth of decline.' };
  }

  // CONTRARIAN_LONG: extreme negative funding = crowded shorts = coiled spring
  if (funding < -15 && fg < 40) {
    return { regime: 'CONTRARIAN_LONG', confidence: 0.65,
      implication: 'Crowded shorts. Potential reversal. Small mETH position may be justified.' };
  }

  // RANGING: confirmed only if price movement is small AND no clear directional pressure
  // Not a catch-all — requires absence of trend evidence
  const weakTrend = Math.abs(change) < 1.5 && fg > 30 && fg < 65 && Math.abs(funding) < 8;
  if (weakTrend) {
    return { regime: 'RANGING', confidence: 0.55,
      implication: 'Low volatility, no directional pressure. Mean-reversion grid strategy active.' };
  }

  // Soft TREND_DOWN: mild bearish but not crisis
  if (change < -1 || (fg < 40 && funding > 5)) {
    return { regime: 'TREND_DOWN', confidence: 0.60,
      implication: 'Mild bearish. Reduce risk exposure, rotate toward mUSD.' };
  }

  // Default: UNCERTAIN — do NOT default to RANGING (dangerous to grid-trade in unknown regime)
  return { regime: 'HOLD', confidence: 0.35,
    implication: 'Mixed/unclear signals. No regime confirmed. HOLD until clarity. Grid strategy NOT active.' };
}

// ─── Main export ───────────────────────────────────────────────────

/**
 * Get all structured signals in one call.
 * Returns a clean typed object ready for LLM prompt injection.
 *
 * @param {object} marketCtx - from getUnifiedMarketContext()
 */
async function getStructuredSignals(marketCtx = {}) {
  const [funding, flow, yieldSpread, social] = await Promise.allSettled([
    getFundingSignal(),
    getOnChainFlowSignal(),
    getYieldSpreadSignal(marketCtx.mETHYield || 3.5),
    getElfaSignal(marketCtx.symbol || 'ETH', { hours: 24 }),
  ]);

  const fundingData  = funding.status  === 'fulfilled' ? funding.value  : { available: false };
  const flowData     = flow.status     === 'fulfilled' ? flow.value     : { available: false };
  const yieldData    = yieldSpread.status === 'fulfilled' ? yieldSpread.value : { available: false };
  const socialData   = social.status   === 'fulfilled' ? social.value   : { available: false };

  const currentPrice = marketCtx.ethPrice || 0;
  const liqMap = currentPrice > 0
    ? await getLiquidationMap(currentPrice)
    : { available: false };

  const regime = detectRegime({
    fearGreed: marketCtx.fearGreedValue,
    ethChange24h: marketCtx.ethChange24h,
    fundingSignal: fundingData,
    flowSignal: flowData,
  });

  // Count bullish vs bearish signals for quick summary
  const signals = [fundingData, flowData, yieldData, socialData];
  const bullish = signals.filter(s => s?.signal === 'BULLISH').length;
  const bearish = signals.filter(s => s?.signal === 'BEARISH').length;
  const consensus = bullish > bearish ? 'BULLISH' : bearish > bullish ? 'BEARISH' : 'NEUTRAL';

  // ── RANGING: enrich with grid/channel data ──────────────────────
  let rangingData = null;
  let rangingContext = '';
  if (regime.regime === 'RANGING') {
    try {
      const rawGridSignal = await getGridSignal(currentPrice || undefined);
      // Apply position awareness — prevents double-buying, handles TP/SL
      const gridSignal = applyPositionAwareness(rawGridSignal, currentPrice || rawGridSignal.channel?.currentPrice);
      // Tick cycle counter if we're in a position
      tickCycle();
      // Update high water mark for trailing stop
      if (currentPrice) updateHWM(currentPrice);
      const ctx = await buildRangingContext();
      rangingData = gridSignal;
      rangingContext = ctx;
      // Annotate context with position state
      if (gridSignal.positionState?.status !== 'FLAT') {
        rangingContext += `\n  Position: ${gridSignal.positionState.status} since $${gridSignal.positionState.entryPrice} (cycle ${gridSignal.positionState.cycleCount})`;
      }
      if (gridSignal.overrideReason) {
        rangingContext += `\n  Override: ${gridSignal.overrideReason}`;
      }
    } catch (e) {
      rangingContext = `RANGING GRID: unavailable — ${e.message}`;
    }
  }

  return {
    timestamp: new Date().toISOString(),
    regime,
    consensus,
    bullishSignals: bullish,
    bearishSignals: bearish,
    signals: {
      funding: fundingData,
      onChainFlow: flowData,
      yieldSpread: yieldData,
      social: socialData,
      liquidationMap: liqMap,
      ranging: rangingData,
    },
    // Compact prompt string for injection into analyst prompt
    promptSummary: buildPromptSummary({ regime, consensus, fundingData, flowData, yieldData, socialData, liqMap, currentPrice, rangingContext }),
  };
}

function buildPromptSummary({ regime, consensus, fundingData, flowData, yieldData, socialData, liqMap, currentPrice, rangingContext }) {
  const lines = [];
  lines.push(`[STRUCTURED SIGNALS — ${new Date().toISOString().slice(0, 16)}]`);
  lines.push(`Regime: ${regime.regime} (confidence ${(regime.confidence * 100).toFixed(0)}%) — ${regime.implication}`);
  lines.push(`Signal consensus: ${consensus}`);

  if (fundingData?.available) {
    lines.push(`Funding rate (ETH): ${fundingData.value?.toFixed(2)}% annualised → ${fundingData.signal} (strength ${(fundingData.strength * 100).toFixed(0)}%)`);
    if (fundingData.rsi) lines.push(`RSI (ETH perps): ${fundingData.rsi?.toFixed(1)}`);
  }

  if (flowData?.available && flowData.netFlowUsd !== 0) {
    const dir = flowData.netFlowUsd > 0 ? 'INFLOW' : 'OUTFLOW';
    lines.push(`Smart money 24h: ${dir} $${Math.abs(flowData.netFlowUsd / 1e6).toFixed(1)}M → ${flowData.signal}`);
  }

  if (yieldData?.available) {
    lines.push(`Yield spread (mETH vs USDY): ${yieldData.spread > 0 ? '+' : ''}${yieldData.spread}% → ${yieldData.signal}`);
  }

  if (socialData?.available) {
    const ms = socialData.mindshare != null ? socialData.mindshare.toFixed(2) : '—';
    const dms = socialData.mindshareChange != null ? `${socialData.mindshareChange > 0 ? '+' : ''}${socialData.mindshareChange.toFixed(0)}%` : '—';
    const sm = socialData.smartAccountMentions ?? 0;
    const sr = socialData.smartRatio != null ? `${Math.round(socialData.smartRatio * 100)}%` : '—';
    lines.push(`Social attention (Elfa, ${socialData.timeWindow || '24h'}): mindshare ${ms}% (${dms}), ${sm} smart-account mentions (${sr} ratio) → ${socialData.signal} (strength ${(socialData.strength * 100).toFixed(0)}%)`);
  }

  if (liqMap?.available) {
    lines.push(`Liquidation risk: ${liqMap.primaryRisk}`);
    lines.push(`Key liq levels below: $${liqMap.longLiquidations?.map(l => l.price).join(', $')}`);
    lines.push(`Key liq levels above: $${liqMap.shortLiquidations?.map(l => l.price).join(', $')}`);
  }

  // Inject ranging grid data when in RANGING regime
  if (rangingContext) {
    lines.push('');
    lines.push(rangingContext);
  }

  return lines.join('\n');
}

module.exports = { getStructuredSignals, getFundingSignal, getOnChainFlowSignal, getYieldSpreadSignal, getLiquidationMap, detectRegime };
