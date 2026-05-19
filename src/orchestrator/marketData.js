/**
 * Market Data Feeds — Real data from free APIs
 * Sources:
 *   - DeFiLlama: TVL, yields, protocol data
 *   - CoinGecko: ETH price, market cap, volume
 *   - Fear & Greed Index: market sentiment
 */

const ENDPOINTS = {
  // DeFiLlama - free, no key needed
  DEFILLAMA_YIELDS: "https://yields.llama.fi/pools",
  DEFILLAMA_TVL: "https://api.llama.fi/v2/chains",
  
  // CoinGecko - free tier (30 calls/min)
  COINGECKO_ETH: "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,mantle&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true",
  
  // Alternative.me Fear & Greed
  FEAR_GREED: "https://api.alternative.me/fng/?limit=1"
};

async function fetchWithTimeout(url, timeout = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
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
    // Find mETH yield pools on Mantle
    const methPools = data.data.filter(p => 
      (p.symbol?.toLowerCase().includes("meth") || p.project?.toLowerCase().includes("mantle")) &&
      p.chain === "Mantle"
    ).sort((a, b) => b.tvlUsd - a.tvlUsd);

    if (methPools.length > 0) {
      return {
        bestYield: methPools[0].apy,
        pool: methPools[0].symbol,
        tvl: methPools[0].tvlUsd,
        project: methPools[0].project
      };
    }
    
    // Fallback: any Mantle yield
    const mantlePools = data.data.filter(p => p.chain === "Mantle")
      .sort((a, b) => b.tvlUsd - a.tvlUsd);
    
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
    
    // Map to our sentiment enum
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
    return {
      tvl: mantle?.tvl || 0,
      change1d: mantle?.change_1d || 0,
      change7d: mantle?.change_7d || 0
    };
  } catch (err) {
    console.warn("[MarketData] DeFiLlama TVL failed:", err.message);
    return { tvl: 0, change1d: 0, change7d: 0 };
  }
}

/**
 * Aggregate all market data into the format AI engine expects
 */
async function getMarketData() {
  const [price, yield_, fearGreed, tvl] = await Promise.all([
    getETHPrice(),
    getMETHYield(),
    getFearGreedIndex(),
    getMantleTVL()
  ]);

  // Estimate smart money flow from TVL change
  const smartMoneyFlow = tvl.tvl * (tvl.change1d / 100);

  // Estimate volatility from 24h price change
  const volatility = Math.min(Math.abs(price.ethChange24h || 0) / 10, 1.0);

  return {
    ethPrice: price.ethPrice,
    ethChange24h: price.ethChange24h,
    mantlePrice: price.mantlePrice,
    mETHYield: yield_.bestYield,
    mETHPool: yield_.pool,
    sentiment: fearGreed.sentiment,
    fearGreedValue: fearGreed.value,
    smartMoneyFlow: Math.round(smartMoneyFlow),
    volatility: parseFloat(volatility.toFixed(2)),
    mantleTVL: tvl.tvl,
    mantleTVLChange1d: tvl.change1d,
    timestamp: Date.now()
  };
}

module.exports = { getMarketData, getETHPrice, getMETHYield, getFearGreedIndex, getMantleTVL };
