/**
 * TuringVault — Elfa Social Intelligence Client
 *
 * Pulls structured social signals from the Elfa REST API v2. Designed to plug
 * into signalEngine as a fifth signal alongside funding / on-chain flow /
 * yield spread / regime.
 *
 * Auth model — API Key:
 *   Header: x-elfa-api-key: <ELFA_API_KEY>
 *   Endpoint base: https://api.elfa.ai
 *   Free tier: 1 000 credits / month, 60 RPM.
 *
 * Endpoints used (paths verified via the official V2 migration guide:
 * https://docs.elfa.ai/migration-guide):
 *
 *   GET /v2/ping                                         — connectivity smoke test
 *   GET /v2/key-status                                   — API key validity
 *   GET /v2/aggregations/trending-tokens?timeWindow      — trending leaderboard
 *   GET /v2/data/top-mentions?ticker&timeWindow          — top mentions for a ticker
 *
 * Honesty rule (.kiro/steering/no-lying-about-state.md §5):
 *   - If ELFA_API_KEY is unset, every getter returns { available: false }.
 *   - Every signal carries a `source: 'elfa-rest-v2'` tag so the dashboard can
 *     label it correctly. We never fabricate values when the API is down.
 *
 * V2 response shape (consistent across endpoints):
 *   { success: true, data: [...], metadata?: { total, page, pageSize } }
 *   V2 strips raw tweet content for ToS compliance — only metadata
 *   (mentioned_at, account_name, like/repost/view counts, account_tags) is
 *   returned, plus aggregated mention counts on the trending endpoint.
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
 * V2 returns { success, data: [...], metadata } where each item carries:
 *   { source_ref_id, mentioned_at, account_name, like_count, repost_count,
 *     view_count, account_tags: [...] }
 * No raw text content — V2 strips it for ToS compliance.
 */
async function getTopMentions(ticker, timeWindow = '24h', pageSize = 10) {
  return cached(`elfa_top_${ticker}_${timeWindow}_${pageSize}`, async () => {
    const params = new URLSearchParams({
      ticker,
      timeWindow,
      page: '1',
      pageSize: String(pageSize),
    });
    return fetchElfa(`/v2/data/top-mentions?${params.toString()}`);
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
    return fetchElfa(`/v2/aggregations/trending-tokens?${params.toString()}`);
  });
}

/**
 * Quick smoke test for the configured API key. Cheap (single GET).
 */
async function getKeyStatus() {
  return fetchElfa('/v2/key-status');
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

  // V2 actual shape (verified via /api/elfa-snapshot?debug=1 against the
  // production endpoint):
  //   { tweetId, link, likeCount, repostCount, viewCount, quoteCount,
  //     replyCount, bookmarkCount, mentionedAt, type,
  //     repostBreakdown: { smart, ct } }
  //
  // V2 strips raw content for ToS compliance, so we cannot run NLP-derived
  // sentiment ourselves. We use repostBreakdown.smart (the number of *smart*
  // accounts that reposted this mention) as the smart-attention proxy.
  let smartReposts = 0;
  let ctReposts = 0; // CT = "crypto twitter" generic
  let total = 0;
  let viewSum = 0;
  let likeSum = 0;
  let repostSum = 0;

  for (const m of items) {
    total += 1;
    const rb = m.repostBreakdown || {};
    smartReposts += Number(rb.smart ?? 0);
    ctReposts += Number(rb.ct ?? 0);
    viewSum += Number(m.viewCount ?? m.view_count ?? 0);
    likeSum += Number(m.likeCount ?? m.like_count ?? 0);
    repostSum += Number(m.repostCount ?? m.repost_count ?? 0);
  }

  return {
    mentionCount: total,
    // Total smart reposts across all top mentions — better signal than
    // counting "is the original tweet from a smart account" (V2 doesn't
    // expose author tags any more anyway).
    smartReposts,
    ctReposts,
    avgViews: total ? Math.round(viewSum / total) : 0,
    avgLikes: total ? Math.round(likeSum / total) : 0,
    avgReposts: total ? Math.round(repostSum / total) : 0,
    // V2 does not expose raw sentiment. Surface honestly null.
    sentiment: null,
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

  // V2 returns tokens lowercase: { token: "btc", current_count, previous_count, change_percent }
  const target = ticker.toLowerCase();
  let totalMentions = 0;
  for (const t of items) {
    totalMentions += Number(t.current_count ?? t.mentions ?? t.count ?? 0);
  }
  for (let i = 0; i < items.length; i += 1) {
    const t = items[i];
    const sym = String(t.token ?? t.ticker ?? t.symbol ?? '').toLowerCase();
    if (sym === target) {
      const mentions = Number(t.current_count ?? t.mentions ?? t.count ?? 0);
      const previous = Number(t.previous_count ?? 0);
      const mindshare =
        totalMentions > 0
          ? +(100 * (mentions / totalMentions)).toFixed(2)
          : null;
      let change = null;
      if (typeof t.change_percent === 'number') {
        change = t.change_percent;
      } else if (previous > 0) {
        change = +(((mentions - previous) / previous) * 100).toFixed(1);
      }
      return {
        rank: i + 1,
        mentions,
        previous,
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
 * onChainFlow / yieldSpread.
 *
 * V2 does not expose raw sentiment, so we derive the BULLISH/BEARISH/NEUTRAL
 * classification from the *attention* signal:
 *   - mindshare surge (mentions vs previous window)
 *   - smart-repost ratio: smartReposts / (smartReposts + ctReposts).
 *     "ct" = generic "crypto twitter" reposters, "smart" = curated accounts.
 *     A high ratio means the attention is coming from accounts Elfa has
 *     classified as informed.
 *
 * Logic:
 *   - mindshareChange > +50% AND smartShare >= 0.20 → BULLISH (high conviction)
 *   - mindshareChange > +20%                        → BULLISH (mild surge)
 *   - mindshareChange < -30%                        → BEARISH (attention collapsing)
 *   - else                                          → NEUTRAL
 *
 * This is an *attention* signal, not a directional sentiment forecast — it
 * tells the analyst "social attention is heating up / cooling down". The
 * Validator can still REJECT directional swaps if regime contradicts.
 */
async function getSocialSignal(symbol = 'ETH', { timeWindow = '24h' } = {}) {
  if (!process.env.ELFA_API_KEY) {
    return { available: false, source: 'elfa-rest-v2', reason: 'no_api_key' };
  }
  try {
    const [mentionsRaw, trendingRaw] = await Promise.all([
      getTopMentions(symbol, timeWindow, 10),
      getTrendingTokens(timeWindow, 50),
    ]);

    const m = summariseMentionPayload(mentionsRaw);
    const t = findTickerInTrending(trendingRaw, symbol);

    if (!m && !t) {
      return { available: false, source: 'elfa-rest-v2', reason: 'no_data' };
    }

    const mindshareChange = t?.mindshareChange ?? 0;
    const totalReposts = (m?.smartReposts ?? 0) + (m?.ctReposts ?? 0);
    const smartShare = totalReposts > 0 ? (m.smartReposts / totalReposts) : 0;

    let signal = 'NEUTRAL';
    let strength = 0.2;

    if (mindshareChange > 50 && smartShare >= 0.20) {
      signal = 'BULLISH';
      strength = 0.85;
    } else if (mindshareChange > 20) {
      signal = 'BULLISH';
      strength = Math.min(0.6, 0.3 + Math.log10(1 + mindshareChange / 5));
    } else if (mindshareChange < -30 && t?.rank != null) {
      signal = 'BEARISH';
      strength = Math.min(0.6, 0.3 + Math.log10(1 + Math.abs(mindshareChange) / 5));
    }

    return {
      available: true,
      source: 'elfa-rest-v2',
      symbol,
      timeWindow,
      signal,
      strength,
      sentiment: null, // V2 strips raw content; honestly null
      mentionCount: m?.mentionCount ?? null,
      smartReposts: m?.smartReposts ?? 0,
      ctReposts: m?.ctReposts ?? 0,
      smartShare: +smartShare.toFixed(2),
      avgViews: m?.avgViews ?? null,
      avgLikes: m?.avgLikes ?? null,
      mindshare: t?.mindshare ?? null,
      mindshareChange,
      mindshareRank: t?.rank ?? null,
    };
  } catch (err) {
    console.warn(`[Elfa] getSocialSignal failed: ${err.message}`);
    return { available: false, source: 'elfa-rest-v2', reason: err.message };
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
