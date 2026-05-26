/**
 * TuringVault — Elfa Social Intelligence Client
 *
 * Pulls structured social signals (mention velocity, smart-account engagement,
 * trending-token rank) from the Elfa REST API. Designed to plug into
 * signalEngine as a fifth signal alongside funding / on-chain flow / yield
 * spread / regime.
 *
 * Auth model — API Key:
 *   Header: x-elfa-api-key: <ELFA_API_KEY>
 *   Endpoint base: https://api.elfa.ai (v1 paths confirmed via open-source
 *   AgentiPy reference implementation:
 *   https://github.com/niceberginc/agentipy/blob/main/agentipy/tools/use_elfa_ai.py)
 *
 *   Free tier: 1 000 credits / month, 60 RPM.
 *
 * Honesty rule (.kiro/steering/no-lying-about-state.md §5):
 *   - If ELFA_API_KEY is unset, every getter returns { available: false }.
 *   - Every signal carries a `source: 'elfa-rest-v1'` tag so the dashboard can
 *     label it correctly. We never fabricate values when the API is down.
 *
 * Endpoints used:
 *   GET /v1/key-status                   — smoke test for the key
 *   GET /v1/top-mentions?ticker&timeWindow — recent top mentions for a ticker
 *   GET /v1/trending-tokens?timeWindow   — global trending list (used to derive
 *                                          a mindshare proxy for our ticker)
 */

const ELFA_BASE = process.env.ELFA_BASE_URL || 'https://api.elfa.ai';
const TIMEOUT_MS = 8000;

// ── Local cache (stops repeat pulls within a single cycle) ────────────
const CACHE = {};
const TTL_MS = 5 * 60 * 1000; // 5 min — same as signalEngine cache

function cached(key, fn) {
  const e = CACHE[key];
  if (e && Date.now() - e.ts < TTL_MS) return Promise.resolve(e.data);
  return fn()
    .then((d) => {
      CACHE[key] = { data: d, ts: Date.now() };
      return d;
    })
    .catch(() => e?.data || null);
}

async function fetchElfa(path, { timeout = TIMEOUT_MS } = {}) {
  const apiKey = process.env.ELFA_API_KEY;
  if (!apiKey) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`${ELFA_BASE}${path}`, {
      method: 'GET',
      headers: {
        'x-elfa-api-key': apiKey,
        Accept: 'application/json',
      },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(
        `[Elfa] ${path} → HTTP ${res.status}: ${text.slice(0, 200)}`
      );
      return null;
    }
    return await res.json();
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.warn(`[Elfa] ${path} failed: ${err.message}`);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Top mentions for a ticker in the given time window.
 * Returns the raw payload (data/total) or null. Each item typically carries:
 *   { content, mentioned_at, source, sentiment?, smart_engagement_count?, ... }
 */
async function getTopMentions(ticker, timeWindow = '24h', pageSize = 10) {
  return cached(`elfa_top_${ticker}_${timeWindow}_${pageSize}`, async () => {
    const params = new URLSearchParams({
      ticker,
      timeWindow,
      page: '1',
      pageSize: String(pageSize),
      includeAccountDetails: 'false',
    });
    return fetchElfa(`/v1/top-mentions?${params.toString()}`);
  });
}

/**
 * Trending tokens leaderboard. We use this to derive a mindshare proxy for
 * our ticker — its rank and the share of total mentions it commands.
 */
async function getTrendingTokens(timeWindow = '24h', pageSize = 50) {
  return cached(`elfa_trending_${timeWindow}_${pageSize}`, async () => {
    const params = new URLSearchParams({
      timeWindow,
      page: '1',
      pageSize: String(pageSize),
      minMentions: '5',
    });
    return fetchElfa(`/v1/trending-tokens?${params.toString()}`);
  });
}

/**
 * Quick smoke test for the configured API key. Cheap (single GET).
 */
async function getKeyStatus() {
  return fetchElfa('/v1/key-status');
}

// ── Helpers to extract signal-shaped data ─────────────────────────────

function summariseMentionPayload(payload) {
  if (!payload) return null;
  const items = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.data?.data)
      ? payload.data.data
      : Array.isArray(payload)
        ? payload
        : [];
  if (!items.length) return null;

  let smart = 0;
  let total = 0;
  let sentSum = 0;
  let sentCount = 0;

  for (const m of items) {
    total += 1;
    const eng = Number(
      m.smart_engagement_count ?? m.smartEngagementCount ?? 0
    );
    if (eng > 0) smart += 1;
    const s =
      typeof m.sentiment === 'number'
        ? m.sentiment
        : typeof m.sentimentScore === 'number'
          ? m.sentimentScore
          : null;
    if (s != null) {
      sentSum += s;
      sentCount += 1;
    }
  }

  return {
    mentionCount: total,
    smartAccountMentions: smart,
    sentiment: sentCount ? +(sentSum / sentCount).toFixed(3) : null,
  };
}

function findTickerInTrending(trendingPayload, ticker) {
  if (!trendingPayload) return null;
  const items = Array.isArray(trendingPayload?.data)
    ? trendingPayload.data
    : Array.isArray(trendingPayload?.data?.data)
      ? trendingPayload.data.data
      : Array.isArray(trendingPayload)
        ? trendingPayload
        : [];
  if (!items.length) return null;

  const upper = ticker.toUpperCase();
  let totalMentions = 0;
  for (const t of items) {
    totalMentions += Number(
      t.mentions ?? t.mentionCount ?? t.count ?? 0
    );
  }
  for (let i = 0; i < items.length; i += 1) {
    const t = items[i];
    const sym = String(t.token ?? t.ticker ?? t.symbol ?? '').toUpperCase();
    if (sym === upper) {
      const mentions = Number(t.mentions ?? t.mentionCount ?? t.count ?? 0);
      const mindshare =
        totalMentions > 0 ? +(100 * (mentions / totalMentions)).toFixed(2) : null;
      const change =
        typeof t.mentions_change_percentage === 'number'
          ? t.mentions_change_percentage
          : typeof t.changePct === 'number'
            ? t.changePct
            : null;
      return {
        rank: i + 1,
        mentions,
        mindshare,
        mindshareChange: change,
      };
    }
  }
  return null;
}

// ── Main signal getter ─────────────────────────────────────────────────

/**
 * Combined Elfa signal — same shape as signalEngine produces for funding /
 * onChainFlow / yieldSpread. Aggregates mentions + trending into a single
 * BULLISH/BEARISH/NEUTRAL classification.
 *
 * Heuristic:
 *   sentiment > +0.20 AND mindshareChange > 20% → BULLISH (strong attention)
 *   sentiment < -0.20 AND mindshareChange > 20% → BEARISH (negative attention spike)
 *   sentiment > +0.10 → BULLISH (mild)
 *   sentiment < -0.10 → BEARISH (mild)
 *   else → NEUTRAL
 */
async function getSocialSignal(symbol = 'ETH', { timeWindow = '24h' } = {}) {
  if (!process.env.ELFA_API_KEY) {
    return { available: false, source: 'elfa-rest-v1', reason: 'no_api_key' };
  }
  try {
    const [mentionsRaw, trendingRaw] = await Promise.all([
      getTopMentions(symbol, timeWindow, 10),
      getTrendingTokens(timeWindow, 50),
    ]);

    const m = summariseMentionPayload(mentionsRaw);
    const t = findTickerInTrending(trendingRaw, symbol);

    if (!m && !t) {
      return { available: false, source: 'elfa-rest-v1', reason: 'no_data' };
    }

    const sentiment = m?.sentiment ?? null;
    const mindshareChange = t?.mindshareChange ?? 0;

    let signal = 'NEUTRAL';
    let strength = 0.2;

    if (sentiment != null) {
      const surge = Math.max(0, mindshareChange);
      const surgeBoost = Math.log10(1 + surge / 5);
      const absS = Math.abs(sentiment);

      if (sentiment > 0.20 && mindshareChange > 20) {
        signal = 'BULLISH';
        strength = Math.min(0.9, 0.5 + surgeBoost);
      } else if (sentiment < -0.20 && mindshareChange > 20) {
        signal = 'BEARISH';
        strength = Math.min(0.9, 0.5 + surgeBoost);
      } else if (sentiment > 0.10) {
        signal = 'BULLISH';
        strength = Math.min(0.6, 0.25 + absS);
      } else if (sentiment < -0.10) {
        signal = 'BEARISH';
        strength = Math.min(0.6, 0.25 + absS);
      } else {
        signal = 'NEUTRAL';
        strength = 0.2;
      }
    } else if (t?.mindshare != null && mindshareChange > 30) {
      // Fallback when sentiment is missing — strong mindshare surge alone
      // counts as a soft BULLISH attention signal.
      signal = 'BULLISH';
      strength = 0.4;
    }

    return {
      available: true,
      source: 'elfa-rest-v1',
      symbol,
      windowHours: timeWindow,
      signal,
      strength,
      sentiment,
      mentionCount: m?.mentionCount ?? null,
      smartAccountMentions: m?.smartAccountMentions ?? null,
      mindshare: t?.mindshare ?? null,
      mindshareChange,
      mindshareRank: t?.rank ?? null,
    };
  } catch (err) {
    console.warn(`[Elfa] getSocialSignal failed: ${err.message}`);
    return { available: false, source: 'elfa-rest-v1', reason: err.message };
  }
}

/**
 * Snapshot for the dashboard — same data, plus a short label for the UI strip.
 */
async function getDashboardSnapshot(symbol = 'ETH') {
  const sig = await getSocialSignal(symbol);
  if (!sig.available) {
    return {
      available: false,
      reason: sig.reason || 'unknown',
      symbol,
      fetchedAt: new Date().toISOString(),
    };
  }
  return {
    available: true,
    symbol,
    fetchedAt: new Date().toISOString(),
    signal: sig.signal,
    strength: sig.strength,
    sentiment: sig.sentiment,
    mentionCount: sig.mentionCount,
    smartAccountMentions: sig.smartAccountMentions,
    mindshare: sig.mindshare,
    mindshareChange: sig.mindshareChange,
    mindshareRank: sig.mindshareRank,
    summary:
      sig.signal === 'NEUTRAL'
        ? `${symbol} mindshare ${sig.mindshare?.toFixed(2) ?? '—'}% · neutral`
        : `${symbol} ${sig.signal.toLowerCase()} · mindshare ${sig.mindshare?.toFixed(2) ?? '—'}%${
            sig.mindshareChange != null
              ? ` (${sig.mindshareChange > 0 ? '+' : ''}${Number(sig.mindshareChange).toFixed(0)}%)`
              : ''
          }`,
  };
}

module.exports = {
  getTopMentions,
  getTrendingTokens,
  getKeyStatus,
  getSocialSignal,
  getDashboardSnapshot,
};
