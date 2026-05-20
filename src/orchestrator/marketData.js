/**
 * Market Data Feeds — Real data from multiple sources
 * Sources:
 *   - DeFiLlama: TVL, yields, protocol data
 *   - CoinGecko: ETH price, market cap, volume
 *   - Fear & Greed Index: market sentiment
 *   - Nansen API: Smart money netflows (cached 15 min to preserve credits)
 */

const ENDPOINTS = {
  DEFILLAMA_YIELDS: "https://yields.llama.fi/pools",
  DEFILLAMA_TVL: "https://api.llama.fi/v2/chains",
  COINGECKO_ETH: "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,mantle&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true",
  FEAR_GREED: "https://api.alternative.me/fng/?limit=1",
  NANSEN_NETFLOW: "https://api.nansen.ai/api/v1/smart-money/netflow"
};

// Nansen cache — 15 min to preserve 1000 credits
const nansenCache = { data: null, ts: 0 };
const NANSEN_CACHE_MS = 15 * 60 * 1000;

async function fetchWithTimeout(url, timeout = 10000, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal, ...options });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Nansen Smart Money Netflows
 * Returns: { totalNetflow24h, topBuying: [{symbol, netflow}], topSelling: [...], sentiment }
 * Cached 15 min to conserve API credits.
 */
async function getNansenSmartMoney() {
  const apiKey = process.env.NANSEN_API_KEY;
  if (!apiKey) {
    console.warn("[Nansen] No API key — skipping smart money data");
    return null;
  }

  // Return cached data if fresh
  if (nansenCache.data && Date.now() - nansenCache.ts < NANSEN_CACHE_MS) {
    console.log("[Nansen] Using cached data (age:", Math.round((Date.now() - nansenCache.ts) / 1000), "s)");
    return nansenCache.data;
  }

  try {
    console.log("[Nansen] Fetching smart money netflows...");
    const data = await fetchWithTimeout(
      ENDPOINTS.NANSEN_NETFLOW,
      15000,
      {
        method: "POST",
        headers: {
          "apiKey": apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chains: ["ethereum"],
          filters: {
            include_smart_money_labels: ["Fund", "Smart Trader"],
            include_stablecoins: false,
            include_native_tokens: true
          },
          order_by: [{ field: "net_flow_24h_usd", direction: "DESC" }]
        })
      }
    );

    if (!data.data || !Array.isArray(data.data)) {
      throw new Error("Unexpected Nansen response format");
    }

    const tokens = data.data;

    // Top 3 tokens being accumulated
    const topBuying = tokens
      .filter(t => (t.net_flow_24h_usd || 0) > 0)
      .slice(0, 3)
      .map(t => ({ symbol: t.token_symbol, netflow24h: Math.round(t.net_flow_24h_usd) }));

    // Top 3 tokens being distributed
    const topSelling = tokens
      .filter(t => (t.net_flow_24h_usd || 0) < 0)
      .sort((a, b) => a.net_flow_24h_usd - b.net_flow_24h_usd)
      .slice(0, 3)
      .map(t => ({ symbol: t.token_symbol, netflow24h: Math.round(t.net_flow_24h_usd) }));

    // Total smart money flow (positive = accumulation, negative = distribution)
    const totalNetflow24h = tokens.reduce((sum, t) => sum + (t.net_flow_24h_usd || 0), 0);

    // Sentiment signal: positive total flow = smart money bullish
    const nansenSentiment = totalNetflow24h > 50000 ? "bullish"
      : totalNetflow24h > 0 ? "slightly_bullish"
      : totalNetflow24h > -50000 ? "slightly_bearish"
      : "bearish";

    const result = {
      totalNetflow24h: Math.round(totalNetflow24h),
      topBuying,
      topSelling,
      nansenSentiment,
      tokenCount: tokens.length,
      source: "nansen_live"
    };

    // Cache it
    nansenCache.data = result;
    nansenCache.ts = Date.now();

    console.log(`[Nansen] Smart money 24h netflow: $${result.totalNetflow24h.toLocaleString()} (${nansenSentiment})`);
    if (topBuying.length) console.log(`[Nansen] Top buying: ${topBuying.map(t => t.symbol).join(", ")}`);

    return result;
  } catch (err) {
    console.warn("[Nansen] API failed:", err.message);
    // Return stale cache if available
    if (nansenCache.data) {
      console.log("[Nansen] Returning stale cache after error");
      return nansenCache.data;
    }
    return null;
  }
}

async function getETHPrice() {
  try {
    const data = await fetchWithTimeout(ENDPOINTS.COINGECKO_ETH);
    return {
      ethPrice: data.ethereum.usd,
      ethChange24h: data.ethereum.usd_24h_change,
      mantlePrice: data.mantle?.usd || 0,
      mantleChange24h: data.mantle?.usd_24h_change || 0
    };
  } catch (err) {
    console.warn("[MarketData] CoinGecko failed:", err.message);
    return { ethPrice: 0, ethChange24h: 0, mantlePrice: 0, mantleChange24h: 0 };
  }
}

async function getMETHYield() {
  try {
    const data = await fetchWithTimeout(ENDPOINTS.DEFILLAMA_YIELDS);
    const methPools = data.data.filter(p =>
      (p.symbol?.toLowerCase().includes("meth") || p.project?.toLowerCase().includes("mantle")) &&
      p.chain === "Mantle"
    ).sort((a, b) => b.tvlUsd - a.tvlUsd);

    if (methPools.length > 0) {
      return { bestYield: methPools[0].apy, pool: methPools[0].symbol, tvl: methPools[0].tvlUsd, project: methPools[0].project };
    }

    const mantlePools = data.data.filter(p => p.chain === "Mantle").sort((a, b) => b.tvlUsd - a.tvlUsd);
    return {
      bestYield: mantlePools[0]?.apy || 3.5,
      pool: mantlePools[0]?.symbol || "unknown",
      tvl: mantlePools[0]?.tvlUsd || 0,
      project: mantlePools[0]?.project || "unknown"
    };
  } catch (err) {
    console.warn("[MarketData] DeFiLlama yields failed:", err.message);
    return { bestYield: 3.5, pool: "fallback", tvl: 0, project: "unknown" };
  }
}

async function getFearGreedIndex() {
  try {
    const data = await fetchWithTimeout(ENDPOINTS.FEAR_GREED);
    const value = parseInt(data.data[0].value);
    const classification = data.data[0].value_classification;
    let sentiment;
    if (value <= 20) sentiment = "extreme_fear";
    else if (value <= 40) sentiment = "bearish";
    else if (value <= 60) sentiment = "neutral";
    else if (value <= 80) sentiment = "bullish";
    else sentiment = "extreme_greed";
    return { value, classification, sentiment };
  } catch (err) {
    console.warn("[MarketData] Fear&Greed failed:", err.message);
    return { value: 50, classification: "Neutral", sentiment: "neutral" };
  }
}

async function getMantleTVL() {
  try {
    const data = await fetchWithTimeout(ENDPOINTS.DEFILLAMA_TVL);
    const mantle = data.find(c => c.name === "Mantle");
    return { tvl: mantle?.tvl || 0, change1d: mantle?.change_1d || 0, change7d: mantle?.change_7d || 0 };
  } catch (err) {
    console.warn("[MarketData] DeFiLlama TVL failed:", err.message);
    return { tvl: 0, change1d: 0, change7d: 0 };
  }
}

/**
 * Aggregate all market data — now with real Nansen smart money signals
 */
async function getMarketData() {
  const [price, yield_, fearGreed, tvl, nansen] = await Promise.all([
    getETHPrice(),
    getMETHYield(),
    getFearGreedIndex(),
    getMantleTVL(),
    getNansenSmartMoney()
  ]);

  // Smart money flow: prefer real Nansen data, fallback to TVL-derived estimate
  const smartMoneyFlow = nansen
    ? nansen.totalNetflow24h
    : Math.round(tvl.tvl * (tvl.change1d / 100));

  // Combined sentiment: weight Fear&Greed + Nansen signal
  let combinedSentiment = fearGreed.sentiment;
  if (nansen) {
    const fgBullish = fearGreed.value >= 50;
    const nansenBullish = nansen.nansenSentiment.includes("bullish");
    if (fgBullish && nansenBullish) combinedSentiment = "bullish";
    else if (!fgBullish && !nansenBullish) combinedSentiment = "bearish";
    else combinedSentiment = "neutral"; // disagreement → neutral
  }

  // Volatility from 24h price change
  const volatility = Math.min(Math.abs(price.ethChange24h || 0) / 10, 1.0);

  return {
    ethPrice: price.ethPrice,
    ethChange24h: price.ethChange24h,
    mantlePrice: price.mantlePrice,
    mETHYield: yield_.bestYield,
    mETHPool: yield_.pool,
    sentiment: combinedSentiment,
    fearGreedIndex: fearGreed.value,
    fearGreedClassification: fearGreed.classification,
    smartMoneyFlow,
    smartMoneySource: nansen ? "nansen_live" : "tvl_estimate",
    nansenTopBuying: nansen?.topBuying || [],
    nansenTopSelling: nansen?.topSelling || [],
    nansenSentiment: nansen?.nansenSentiment || null,
    volatility: parseFloat(volatility.toFixed(2)),
    mantleTVL: tvl.tvl,
    mantleTVLChange1d: tvl.change1d,
    timestamp: Date.now()
  };
}

module.exports = { getMarketData, getETHPrice, getMETHYield, getFearGreedIndex, getMantleTVL, getNansenSmartMoney };
