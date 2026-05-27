/**
 * CoinGlass — Funding Rates, Open Interest, Liquidations
 * Free tier: public endpoints (no API key needed for basic data)
 * Signals: crowded longs = danger, high funding = mean-reversion signal
 */

const CACHE_TTL = 30 * 60 * 1000; // 30 min cache
let cache = {};

async function fetchWithCache(key, url, ttl = CACHE_TTL) {
  if (cache[key] && Date.now() - cache[key].ts < ttl) return cache[key].data;
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "TuringVault/1.0" },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    cache[key] = { data, ts: Date.now() };
    return data;
  } catch (e) {
    console.log(`  [CoinGlass] ${key} fetch failed: ${e.message}`);
    return cache[key]?.data || null;
  }
}

/**
 * Get funding rates from multiple exchanges
 * Positive = longs pay shorts (bullish crowded → contrarian bearish)
 * Negative = shorts pay longs (bearish crowded → contrarian bullish)
 */
async function getFundingRates() {
  // Use CoinGecko derivatives for funding (free, no key)
  const data = await fetchWithCache(
    "funding",
    "https://api.coingecko.com/api/v3/derivatives?order=open_interest_btc_desc"
  );
  if (!data || !Array.isArray(data)) return null;

  // Filter ETH perpetuals
  const ethPerps = data
    .filter((d) => d.symbol?.includes("ETH") && d.contract_type === "perpetual")
    .slice(0, 10);

  const avgFunding =
    ethPerps.reduce((sum, p) => sum + (parseFloat(p.funding_rate) || 0), 0) /
    (ethPerps.length || 1);
  const totalOI = ethPerps.reduce((sum, p) => sum + (p.open_interest || 0), 0);

  // Classify
  let signal = "NEUTRAL";
  if (avgFunding > 0.01) signal = "OVERHEATED_LONGS"; // > 0.01% = crowded
  else if (avgFunding > 0.005) signal = "SLIGHTLY_LONG";
  else if (avgFunding < -0.01) signal = "OVERHEATED_SHORTS";
  else if (avgFunding < -0.005) signal = "SLIGHTLY_SHORT";

  return {
    avgFundingRate: avgFunding,
    fundingSignal: signal,
    totalOpenInterest: totalOI,
    topExchanges: ethPerps.slice(0, 5).map((p) => ({
      exchange: p.market,
      funding: parseFloat(p.funding_rate) || 0,
      openInterest: p.open_interest,
      spread: p.bid_ask_spread_percentage,
    })),
    interpretation: getInterpretation(signal, avgFunding),
  };
}

/**
 * Get liquidation data (estimated from price moves + OI changes)
 */
async function getLiquidationContext() {
  // Use CoinGecko OHLC for volatility-based liquidation estimate
  const data = await fetchWithCache(
    "eth_ohlc",
    "https://api.coingecko.com/api/v3/coins/ethereum/ohlc?vs_currency=usd&days=1"
  );
  if (!data || !Array.isArray(data)) return null;

  // Calculate intraday volatility
  const ranges = data.map(([ts, o, h, l, c]) => ((h - l) / o) * 100);
  const avgRange = ranges.reduce((s, r) => s + r, 0) / ranges.length;
  const maxRange = Math.max(...ranges);

  // Estimate liquidation zones (leveraged positions get liquidated at ~5-10% moves)
  const lastPrice = data[data.length - 1]?.[4] || 2100;
  const liqLongs = lastPrice * 0.93; // 7% drop wipes 10x longs
  const liqShorts = lastPrice * 1.07; // 7% pump wipes 10x shorts

  return {
    avgIntradayRange: avgRange,
    maxIntradayRange: maxRange,
    currentPrice: lastPrice,
    estimatedLiquidationZones: {
      longLiquidation: Math.round(liqLongs),
      shortLiquidation: Math.round(liqShorts),
    },
    volatilitySignal:
      avgRange > 3 ? "HIGH" : avgRange > 1.5 ? "MODERATE" : "LOW",
  };
}

function getInterpretation(signal, rate) {
  switch (signal) {
    case "OVERHEATED_LONGS":
      return `Funding ${(rate * 100).toFixed(
        3
      )}% — longs are crowded. High probability of long squeeze / correction. BEARISH contrarian signal.`;
    case "SLIGHTLY_LONG":
      return `Funding ${(rate * 100).toFixed(
        3
      )}% — mild long bias. Normal bull market conditions. NEUTRAL.`;
    case "OVERHEATED_SHORTS":
      return `Funding ${(rate * 100).toFixed(
        3
      )}% — shorts are crowded. High probability of short squeeze / pump. BULLISH contrarian signal.`;
    case "SLIGHTLY_SHORT":
      return `Funding ${(rate * 100).toFixed(
        3
      )}% — mild short bias. Caution prevails. Slightly BULLISH contrarian.`;
    default:
      return `Funding balanced. No strong directional crowding.`;
  }
}

/**
 * Combined derivatives intelligence for agent prompt
 */
async function getDerivativesContext() {
  const [funding, liquidations] = await Promise.all([
    getFundingRates(),
    getLiquidationContext(),
  ]);

  return { funding, liquidations };
}

module.exports = {
  getFundingRates,
  getLiquidationContext,
  getDerivativesContext,
};
