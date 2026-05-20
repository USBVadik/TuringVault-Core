/**
 * TuringVault — Unified Market Intelligence
 * 
 * Aggregates data from ALL partner protocols:
 *   1. CoinGecko — ETH price & market cap
 *   2. DeFiLlama — Mantle TVL
 *   3. Fear & Greed Index — sentiment
 *   4. Nansen MCP — Smart Money flows (institutional intelligence)
 *   5. Byreal Perps — trading signals (RSI, funding, OI)
 * 
 * Returns formatted context string for LLM prompt injection.
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });
const { NansenMCPClient } = require("../mcp/nansenMCP");
const { ExecutionEngine } = require("../execution/executionEngine");

const CACHE = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 min for price data
const NANSEN_CACHE_TTL = 15 * 60 * 1000; // 15 min for Nansen (expensive)

function cached(key, ttl, fn) {
  const entry = CACHE[key];
  if (entry && Date.now() - entry.ts < ttl) return entry.data;
  return fn().then(data => { CACHE[key] = { data, ts: Date.now() }; return data; }).catch(() => entry?.data || null);
}

async function fetchWithTimeout(url, options = {}, timeout = 8000) {
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

// ─── Data Sources ─────────────────────────────────────────────────

async function getEthPrice() {
  return cached("eth_price", CACHE_TTL, async () => {
    const data = await fetchWithTimeout(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,mantle&vs_currencies=usd&include_24hr_change=true"
    );
    return {
      ethPrice: data.ethereum?.usd || 0,
      ethChange24h: data.ethereum?.usd_24h_change || 0,
      mntPrice: data.mantle?.usd || 0,
      mntChange24h: data.mantle?.usd_24h_change || 0
    };
  });
}

async function getMantleTVL() {
  return cached("mantle_tvl", CACHE_TTL, async () => {
    const data = await fetchWithTimeout("https://api.llama.fi/v2/chains");
    const mantle = data?.find(c => c.name === "Mantle");
    return { tvl: mantle?.tvl || 0 };
  });
}

async function getFearGreed() {
  return cached("fear_greed", CACHE_TTL, async () => {
    const data = await fetchWithTimeout("https://api.alternative.me/fng/?limit=1");
    const val = data?.data?.[0];
    return {
      value: parseInt(val?.value || 50),
      classification: val?.value_classification || "Neutral"
    };
  });
}

async function getNansenIntelligence() {
  return cached("nansen_mcp", NANSEN_CACHE_TTL, async () => {
    const apiKey = process.env.NANSEN_API_KEY;
    if (!apiKey) return { available: false };
    
    const client = new NansenMCPClient(apiKey);
    
    // Use general_search (free/cheap) to get market context
    const [methData, smartMoney] = await Promise.allSettled([
      client.callTool("general_search", { query: "mETH Mantle top movers" }),
      client.callTool("smart_traders_and_funds_token_balances", { request: {} })
    ]);

    return {
      available: true,
      meth: methData.status === "fulfilled" ? methData.value : null,
      smartMoney: smartMoney.status === "fulfilled" ? smartMoney.value : null
    };
  });
}

async function getByrealSignals() {
  return cached("byreal_signals", CACHE_TTL, async () => {
    try {
      const engine = new ExecutionEngine({ dryRun: true });
      const signals = await engine.getSignals();
      
      // Extract top signals
      const allSignals = [];
      for (const [category, items] of Object.entries(signals)) {
        if (Array.isArray(items)) {
          allSignals.push(...items.slice(0, 3).map(s => ({ ...s, category })));
        }
      }
      
      return {
        available: true,
        topSignals: allSignals.slice(0, 8),
        timestamp: new Date().toISOString()
      };
    } catch {
      return { available: false };
    }
  });
}

// ─── Main Aggregator ─────────────────────────────────────────────

async function getUnifiedMarketContext() {
  const [price, tvl, fng, nansen, byreal] = await Promise.allSettled([
    getEthPrice(),
    getMantleTVL(),
    getFearGreed(),
    getNansenIntelligence(),
    getByrealSignals()
  ]);

  const eth = price.status === "fulfilled" ? price.value : {};
  const mantleTvl = tvl.status === "fulfilled" ? tvl.value : {};
  const fearGreed = fng.status === "fulfilled" ? fng.value : {};
  const nansenData = nansen.status === "fulfilled" ? nansen.value : {};
  const byrealData = byreal.status === "fulfilled" ? byreal.value : {};

  // Format for LLM prompt injection
  let context = `=== MARKET INTELLIGENCE (${new Date().toISOString()}) ===\n\n`;
  
  context += `[PRICE DATA]\n`;
  context += `ETH: $${eth.ethPrice?.toFixed(2) || "N/A"} (24h: ${eth.ethChange24h?.toFixed(2) || 0}%)\n`;
  context += `MNT: $${eth.mntPrice?.toFixed(4) || "N/A"} (24h: ${eth.mntChange24h?.toFixed(2) || 0}%)\n`;
  context += `Mantle TVL: $${(mantleTvl.tvl / 1e9)?.toFixed(2) || "N/A"}B\n\n`;
  
  context += `[SENTIMENT]\n`;
  context += `Fear & Greed: ${fearGreed.value || "N/A"} (${fearGreed.classification || "Unknown"})\n\n`;

  if (nansenData.available && nansenData.meth) {
    context += `[NANSEN SMART MONEY - mETH/Mantle]\n`;
    const text = nansenData.meth?.content?.[0]?.text || JSON.stringify(nansenData.meth).slice(0, 500);
    context += text.slice(0, 800) + "\n\n";
  }

  if (nansenData.available && nansenData.smartMoney && !nansenData.smartMoney?.isError) {
    context += `[NANSEN SMART MONEY - Token Holdings]\n`;
    const text = nansenData.smartMoney?.content?.[0]?.text || JSON.stringify(nansenData.smartMoney).slice(0, 500);
    context += text.slice(0, 800) + "\n\n";
  }

  if (byrealData.available && byrealData.topSignals?.length > 0) {
    context += `[BYREAL PERPS SIGNALS]\n`;
    for (const sig of byrealData.topSignals) {
      context += `  ${sig.coin} ${sig.direction} (RSI=${sig.rsi}, funding=${sig.fundingAnnualized}, score=${sig.score})\n`;
    }
    context += "\n";
  }

  context += `=== END MARKET DATA ===`;

  return {
    raw: { eth, mantleTvl, fearGreed, nansenData, byrealData },
    promptContext: context,
    ethPrice: eth.ethPrice || 0,
    ethChange24h: eth.ethChange24h || 0,
    fearGreedValue: fearGreed.value || 50,
    fearGreedClass: fearGreed.classification || "Neutral"
  };
}

module.exports = { getUnifiedMarketContext };
