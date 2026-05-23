/**
 * Technical Analysis — RSI, EMA, MACD, Bollinger Bands
 * Calculated locally from CoinGecko price history (FREE, no API key)
 * Provides buy/sell signals for grid trading strategy
 */

const CACHE_TTL = 15 * 60 * 1000; // 15 min cache
let priceCache = {};

async function getPriceHistory(coin = "ethereum", days = 30) {
  const key = `${coin}_${days}d`;
  if (priceCache[key] && Date.now() - priceCache[key].ts < CACHE_TTL) {
    return priceCache[key].data;
  }
  
  const resp = await fetch(
    `https://api.coingecko.com/api/v3/coins/${coin}/market_chart?vs_currency=usd&days=${days}`
  );
  if (!resp.ok) throw new Error(`CoinGecko ${resp.status}`);
  const data = await resp.json();
  const prices = data.prices.map(([ts, price]) => ({ ts, price }));
  priceCache[key] = { data: prices, ts: Date.now() };
  return prices;
}

// ─── INDICATORS ───

function calcEMA(prices, period) {
  const k = 2 / (period + 1);
  let ema = prices[0];
  const result = [ema];
  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

function calcRSI(prices, period = 14) {
  const changes = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }
  
  let avgGain = 0, avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  const rsiValues = [];
  for (let i = period; i < changes.length; i++) {
    if (changes[i] > 0) {
      avgGain = (avgGain * (period - 1) + changes[i]) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(changes[i])) / period;
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsiValues.push(100 - 100 / (1 + rs));
  }
  return rsiValues;
}

function calcMACD(prices) {
  const ema12 = calcEMA(prices, 12);
  const ema26 = calcEMA(prices, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = calcEMA(macdLine.slice(26), 9);
  const histogram = macdLine.slice(26).map((v, i) => 
    i < signalLine.length ? v - signalLine[i] : 0
  );
  return { macdLine: macdLine.slice(-5), signalLine: signalLine.slice(-5), histogram: histogram.slice(-5) };
}

function calcBollingerBands(prices, period = 20) {
  if (prices.length < period) return null;
  const recent = prices.slice(-period);
  const mean = recent.reduce((s, p) => s + p, 0) / period;
  const stdDev = Math.sqrt(recent.reduce((s, p) => s + (p - mean) ** 2, 0) / period);
  return {
    upper: mean + 2 * stdDev,
    middle: mean,
    lower: mean - 2 * stdDev,
    bandwidth: (4 * stdDev / mean) * 100, // % width
    currentPrice: prices[prices.length - 1],
    position: (prices[prices.length - 1] - (mean - 2 * stdDev)) / (4 * stdDev) // 0-1 position within bands
  };
}

// ─── MAIN ANALYSIS ───

async function getTechnicalAnalysis(coin = "ethereum") {
  const history = await getPriceHistory(coin, 30);
  const prices = history.map(p => p.price);
  
  if (prices.length < 30) return { error: "Insufficient data" };

  // Calculate all indicators
  const rsiAll = calcRSI(prices, 14);
  const rsi = rsiAll[rsiAll.length - 1];
  const rsiPrev = rsiAll[rsiAll.length - 2];

  const ema9 = calcEMA(prices, 9);
  const ema21 = calcEMA(prices, 21);
  const ema50 = calcEMA(prices, 50);
  
  const macd = calcMACD(prices);
  const bollinger = calcBollingerBands(prices, 20);
  
  const currentPrice = prices[prices.length - 1];
  const ema9Now = ema9[ema9.length - 1];
  const ema21Now = ema21[ema21.length - 1];

  // ─── SIGNALS ───
  const signals = [];
  
  // RSI
  if (rsi < 30) signals.push({ indicator: "RSI", signal: "OVERSOLD", strength: "STRONG_BUY", value: rsi.toFixed(1) });
  else if (rsi < 40) signals.push({ indicator: "RSI", signal: "APPROACHING_OVERSOLD", strength: "BUY", value: rsi.toFixed(1) });
  else if (rsi > 70) signals.push({ indicator: "RSI", signal: "OVERBOUGHT", strength: "STRONG_SELL", value: rsi.toFixed(1) });
  else if (rsi > 60) signals.push({ indicator: "RSI", signal: "APPROACHING_OVERBOUGHT", strength: "SELL", value: rsi.toFixed(1) });
  else signals.push({ indicator: "RSI", signal: "NEUTRAL", strength: "HOLD", value: rsi.toFixed(1) });

  // EMA crossover
  if (ema9Now > ema21Now && ema9[ema9.length - 2] <= ema21[ema21.length - 2]) {
    signals.push({ indicator: "EMA_CROSS", signal: "GOLDEN_CROSS_9_21", strength: "BUY" });
  } else if (ema9Now < ema21Now && ema9[ema9.length - 2] >= ema21[ema21.length - 2]) {
    signals.push({ indicator: "EMA_CROSS", signal: "DEATH_CROSS_9_21", strength: "SELL" });
  } else if (ema9Now > ema21Now) {
    signals.push({ indicator: "EMA_CROSS", signal: "BULLISH_TREND", strength: "BUY" });
  } else {
    signals.push({ indicator: "EMA_CROSS", signal: "BEARISH_TREND", strength: "SELL" });
  }

  // MACD
  const lastHist = macd.histogram[macd.histogram.length - 1];
  const prevHist = macd.histogram[macd.histogram.length - 2];
  if (lastHist > 0 && prevHist <= 0) signals.push({ indicator: "MACD", signal: "BULLISH_CROSSOVER", strength: "BUY" });
  else if (lastHist < 0 && prevHist >= 0) signals.push({ indicator: "MACD", signal: "BEARISH_CROSSOVER", strength: "SELL" });
  else if (lastHist > 0) signals.push({ indicator: "MACD", signal: "BULLISH", strength: "BUY" });
  else signals.push({ indicator: "MACD", signal: "BEARISH", strength: "SELL" });

  // Bollinger position
  if (bollinger) {
    if (bollinger.position < 0.1) signals.push({ indicator: "BOLLINGER", signal: "AT_LOWER_BAND", strength: "BUY" });
    else if (bollinger.position > 0.9) signals.push({ indicator: "BOLLINGER", signal: "AT_UPPER_BAND", strength: "SELL" });
    else signals.push({ indicator: "BOLLINGER", signal: "MID_BAND", strength: "HOLD" });
  }

  // Aggregate score
  const scoreMap = { STRONG_BUY: 2, BUY: 1, HOLD: 0, SELL: -1, STRONG_SELL: -2 };
  const totalScore = signals.reduce((s, sig) => s + (scoreMap[sig.strength] || 0), 0);
  const maxScore = signals.length * 2;
  const normalizedScore = totalScore / maxScore; // -1 to +1

  let overallSignal = "HOLD";
  if (normalizedScore > 0.4) overallSignal = "STRONG_BUY";
  else if (normalizedScore > 0.15) overallSignal = "BUY";
  else if (normalizedScore < -0.4) overallSignal = "STRONG_SELL";
  else if (normalizedScore < -0.15) overallSignal = "SELL";

  return {
    coin,
    currentPrice: currentPrice.toFixed(2),
    indicators: {
      rsi: { value: rsi.toFixed(1), prev: rsiPrev?.toFixed(1), trend: rsi > rsiPrev ? "rising" : "falling" },
      ema: { ema9: ema9Now.toFixed(2), ema21: ema21Now.toFixed(2), trend: ema9Now > ema21Now ? "bullish" : "bearish" },
      macd: { histogram: lastHist.toFixed(4), trend: lastHist > prevHist ? "improving" : "weakening" },
      bollinger: bollinger ? {
        upper: bollinger.upper.toFixed(2),
        lower: bollinger.lower.toFixed(2),
        position: (bollinger.position * 100).toFixed(0) + "%",
        bandwidth: bollinger.bandwidth.toFixed(1) + "%"
      } : null,
    },
    signals,
    overallSignal,
    score: normalizedScore.toFixed(2),
    summary: getSummary(overallSignal, rsi, ema9Now, ema21Now, normalizedScore, currentPrice)
  };
}

function getSummary(signal, rsi, ema9, ema21, score, price) {
  const parts = [];
  parts.push(`TA Score: ${(score * 100).toFixed(0)}/100 → ${signal}`);
  parts.push(`RSI ${rsi.toFixed(0)} (${rsi < 30 ? "oversold" : rsi > 70 ? "overbought" : "neutral"})`);
  parts.push(`EMA9 ${ema9 > ema21 ? "above" : "below"} EMA21 (${ema9 > ema21 ? "bullish" : "bearish"} trend)`);
  parts.push(`Price $${price.toFixed(0)}`);
  return parts.join(" | ");
}

/**
 * Get TA for both ETH and MNT
 */
async function getFullTechnicalContext() {
  const [eth, mnt] = await Promise.all([
    getTechnicalAnalysis("ethereum"),
    getTechnicalAnalysis("mantle")
  ]);
  return { ethereum: eth, mantle: mnt };
}

module.exports = { getTechnicalAnalysis, getFullTechnicalContext };
