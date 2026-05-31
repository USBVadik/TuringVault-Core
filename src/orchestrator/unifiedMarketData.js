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

const { sanitizeExternalText } = require("../utils/sanitize");

require("dotenv").config({
  path: require("path").resolve(__dirname, "../../.env"),
});
const { NansenMCPClient } = require("../mcp/nansenMCP");
const { ExecutionEngine } = require("../execution/executionEngine");
const { getDerivativesContext } = require("../data/coinGlass");
const { getFullTechnicalContext } = require("../data/technicalAnalysis");

const CACHE = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 min for price data
const NANSEN_CACHE_TTL = 15 * 60 * 1000; // 15 min for Nansen (expensive)

function cached(key, ttl, fn) {
  const entry = CACHE[key];
  if (entry && Date.now() - entry.ts < ttl) return entry.data;
  return fn()
    .then((data) => {
      CACHE[key] = { data, ts: Date.now() };
      return data;
    })
    .catch(() => entry?.data || null);
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
    // Multi-source ticker fetch with disk-snapshot fallback. Replaces
    // the single-source CoinGecko simple/price call that was the
    // second layer of data starvation we discovered while
    // investigating cycles 130-145 (audit 19). The chain is:
    //   CoinGecko → Binance ETHUSDT + Bybit MNTUSDT → Hyperliquid
    //   → on-disk snapshot (1h max age).
    // Provenance is surfaced via _source / _fromDiskSnapshot so the
    // outcomes ledger can record which feed produced each cycle's
    // base prices.
    const {
      fetchPricesMultiSource,
    } = require("../strategies/priceSources");
    const r = await fetchPricesMultiSource();
    if (!r || r.ethPrice <= 0) {
      throw new Error(
        `No price data: ${r?.errors?.join(" | ") || "unknown"}`
      );
    }
    return {
      ethPrice: r.ethPrice,
      ethChange24h: r.ethChange24h ?? 0,
      mntPrice: r.mntPrice,
      mntChange24h: r.mntChange24h ?? 0,
      _source: r.source,
      _fromDiskSnapshot: r.fromDiskSnapshot,
      _snapshotAgeSec: r.snapshotAgeSec ?? null,
    };
  });
}

async function getMantleTVL() {
  return cached("mantle_tvl", CACHE_TTL, async () => {
    const data = await fetchWithTimeout("https://api.llama.fi/v2/chains");
    const mantle = data?.find((c) => c.name === "Mantle");
    return { tvl: mantle?.tvl || 0 };
  });
}

async function getFearGreed() {
  return cached("fear_greed", CACHE_TTL, async () => {
    const data = await fetchWithTimeout(
      "https://api.alternative.me/fng/?limit=1"
    );
    const val = data?.data?.[0];
    return {
      value: parseInt(val?.value || 50),
      classification: val?.value_classification || "Neutral",
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
      client.callTool("smart_traders_and_funds_token_balances", {
        request: {},
      }),
    ]);

    return {
      available: true,
      meth: methData.status === "fulfilled" ? methData.value : null,
      smartMoney: smartMoney.status === "fulfilled" ? smartMoney.value : null,
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
          allSignals.push(
            ...items.slice(0, 3).map((s) => ({ ...s, category }))
          );
        }
      }

      return {
        available: true,
        topSignals: allSignals.slice(0, 8),
        timestamp: new Date().toISOString(),
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
    getByrealSignals(),
  ]);

  const eth = price.status === "fulfilled" ? price.value : {};
  const mantleTvl = tvl.status === "fulfilled" ? tvl.value : {};
  const fearGreed = fng.status === "fulfilled" ? fng.value : {};
  const nansenData = nansen.status === "fulfilled" ? nansen.value : {};
  const byrealData = byreal.status === "fulfilled" ? byreal.value : {};

  // Format for LLM prompt injection
  let context = `=== MARKET INTELLIGENCE (${new Date().toISOString()}) ===\n\n`;

  context += `[PRICE DATA]\n`;
  context += `ETH: $${eth.ethPrice?.toFixed(2) || "N/A"} (24h: ${
    eth.ethChange24h?.toFixed(2) || 0
  }%)\n`;
  context += `MNT: $${eth.mntPrice?.toFixed(4) || "N/A"} (24h: ${
    eth.mntChange24h?.toFixed(2) || 0
  }%)\n`;
  context += `Mantle TVL: $${(mantleTvl.tvl / 1e9)?.toFixed(2) || "N/A"}B\n`;
  // Steering rule §1: when prices come from a fallback or stale
  // snapshot, label them so the analyst (and any judge replaying
  // the manifest) sees which feed was upstream.
  if (eth._source && eth._source !== "coingecko") {
    if (eth._fromDiskSnapshot) {
      context += `Price source: ${eth._source} (cached ${
        eth._snapshotAgeSec || 0
      }s ago — upstream feeds unreachable; cycle reasoning should treat prices as stale)\n`;
    } else {
      context += `Price source: ${eth._source} (CoinGecko fallback — primary feed unavailable)\n`;
    }
  }
  context += `\n`;

  context += `[SENTIMENT]\n`;
  context += `Fear & Greed: ${fearGreed.value || "N/A"} (${
    fearGreed.classification || "Unknown"
  })\n\n`;

  if (nansenData.available && nansenData.meth) {
    context += `[NANSEN SMART MONEY - mETH/Mantle]\n`;
    const rawText =
      nansenData.meth?.content?.[0]?.text ||
      JSON.stringify(nansenData.meth).slice(0, 500);
    context += sanitizeExternalText(rawText, 800) + "\n\n";
  }

  if (
    nansenData.available &&
    nansenData.smartMoney &&
    !nansenData.smartMoney?.isError
  ) {
    context += `[NANSEN SMART MONEY - Token Holdings]\n`;
    const rawText =
      nansenData.smartMoney?.content?.[0]?.text ||
      JSON.stringify(nansenData.smartMoney).slice(0, 500);
    context += sanitizeExternalText(rawText, 800) + "\n\n";
  }

  if (byrealData.available && byrealData.topSignals?.length > 0) {
    context += `[BYREAL PERPS SIGNALS]\n`;
    for (const sig of byrealData.topSignals) {
      const coin = sanitizeExternalText(String(sig.coin || ""), 20);
      const dir = sanitizeExternalText(String(sig.direction || ""), 10);
      context += `  ${coin} ${dir} (RSI=${sig.rsi}, funding=${sig.fundingAnnualized}, score=${sig.score})\n`;
    }
    context += "\n";
  }

  // ─── DERIVATIVES (Funding + Liquidations) ───
  try {
    const derivatives = await getDerivativesContext();
    if (derivatives.funding) {
      context += `[DERIVATIVES / FUNDING]\n`;
      context += `Avg Funding Rate: ${(
        derivatives.funding.avgFundingRate * 100
      ).toFixed(3)}%\n`;
      context += `Signal: ${derivatives.funding.fundingSignal}\n`;
      context += `${derivatives.funding.interpretation}\n`;
      if (derivatives.funding.topExchanges?.length > 0) {
        context += `Top exchanges: ${derivatives.funding.topExchanges
          .map((e) => `${e.exchange}:${(e.funding * 100).toFixed(3)}%`)
          .join(", ")}\n`;
      }
      context += "\n";
    }
    if (derivatives.liquidations) {
      context += `[VOLATILITY / LIQUIDATION ZONES]\n`;
      context += `Intraday vol: ${derivatives.liquidations.avgIntradayRange?.toFixed(
        2
      )}% (${derivatives.liquidations.volatilitySignal})\n`;
      context += `Est. long liquidation zone: $${derivatives.liquidations.estimatedLiquidationZones?.longLiquidation}\n`;
      context += `Est. short liquidation zone: $${derivatives.liquidations.estimatedLiquidationZones?.shortLiquidation}\n\n`;
    }
  } catch (e) {
    context += `[DERIVATIVES] Error: ${e.message}\n\n`;
  }

  // ─── TECHNICAL ANALYSIS (RSI, EMA, MACD, Bollinger) ───
  try {
    const ta = await getFullTechnicalContext();
    if (ta.ethereum) {
      context += `[TECHNICAL ANALYSIS — ETH]\n`;
      context += `Overall: ${ta.ethereum.overallSignal} (score: ${ta.ethereum.score})\n`;
      context += `RSI(14): ${ta.ethereum.indicators.rsi.value} (${ta.ethereum.indicators.rsi.trend})\n`;
      context += `EMA: 9=${ta.ethereum.indicators.ema.ema9} / 21=${ta.ethereum.indicators.ema.ema21} (${ta.ethereum.indicators.ema.trend})\n`;
      context += `MACD: histogram ${ta.ethereum.indicators.macd.histogram} (${ta.ethereum.indicators.macd.trend})\n`;
      if (ta.ethereum.indicators.bollinger) {
        context += `Bollinger: position ${ta.ethereum.indicators.bollinger.position} (band width ${ta.ethereum.indicators.bollinger.bandwidth})\n`;
      }
      context += `Signals: ${ta.ethereum.signals
        .map((s) => `${s.indicator}=${s.strength}`)
        .join(", ")}\n\n`;
    }
    if (ta.mantle) {
      context += `[TECHNICAL ANALYSIS — MNT]\n`;
      context += `Overall: ${ta.mantle.overallSignal} (score: ${ta.mantle.score})\n`;
      context += `RSI(14): ${ta.mantle.indicators.rsi.value} (${ta.mantle.indicators.rsi.trend})\n`;
      context += `EMA: ${ta.mantle.indicators.ema.trend} | MACD: ${ta.mantle.indicators.macd.trend}\n\n`;
    }
  } catch (e) {
    context += `[TECHNICAL ANALYSIS] Error: ${e.message}\n\n`;
  }

  context += `=== END MARKET DATA ===`;

  return {
    raw: { eth, mantleTvl, fearGreed, nansenData, byrealData },
    promptContext: context,
    ethPrice: eth.ethPrice || 0,
    ethChange24h: eth.ethChange24h || 0,
    mntPrice: eth.mntPrice || 0,
    mntChange24h: eth.mntChange24h || 0,
    mantleTVL: mantleTvl.tvl || 0,
    fearGreedValue: fearGreed.value || 50,
    fearGreedClass: fearGreed.classification || "Neutral",
    // Provenance for downstream consumers (outcomes ledger, dashboards).
    // null when getEthPrice failed entirely; otherwise the source
    // string from priceSources.js (e.g. "coingecko", "binance+bybit",
    // "hyperliquid", "<x>-snapshot").
    _priceSource: eth._source || null,
    _priceFromSnapshot: eth._fromDiskSnapshot === true,
    _priceSnapshotAgeSec: eth._snapshotAgeSec ?? null,
  };
}

module.exports = { getUnifiedMarketContext };
