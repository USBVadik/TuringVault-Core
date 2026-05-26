/**
 * TuringVault — Elfa Social Intelligence Client
 *
 * Pulls structured social signals (mention velocity, mindshare, smart-account
 * sentiment) from the Elfa REST API v2. Designed to plug into signalEngine
 * as a fifth signal alongside funding / on-chain flow / yield spread / regime.
 *
 * Auth model — API Key:
 *   Header: x-elfa-api-key: <ELFA_API_KEY>
 *   Endpoint: https://api.elfa.ai/v2/...
 *   Free tier: 1 000 credits / month, 60 RPM. Hourly cron uses ~6-12 credits/h
 *   so well within the free quota.
 *
 *   Reference: https://docs.elfa.ai/
 *
 * Honesty rule (.kiro/steering/no-lying-about-state.md §5):
 *   - If ELFA_API_KEY is unset, every getter returns { available: false }.
 *   - Every signal carries a `source: 'elfa-rest-v2'` tag so the dashboard can
 *     label it correctly. We never fabricate values when the API is down.
 */

const ELFA_BASE = process.env.ELFA_BASE_URL || 'https://api.elfa.ai/v2';
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
 * Token mention metrics (24h window).
 * Returns { mentionCount, smartAccountMentions, sentiment } or null.
 */
async function getMentions(symbol, hours = 24) {
  return cached(`elfa_mentions_${symbol}_${hours}`, async () => {
    const data = await fetchElfa(
      `/aggregations/mentions?symbols=${encodeURIComponent(symbol)}&period=${hours}h`
    );
    if (!data || !data.data) return null;
    const t = Array.isArray(data.data) ? data.data[0] : data.data;
    if (!t) return null;
    return {
      symbol,
      mentionCount: Number(t.mentionCount ?? t.count ?? 0),
      smartAccountMentions: Number(t.smartAccountCount ?? 0),
      sentiment: typeof t.sentiment === 'number' ? t.sentiment : null,
      windowHours: hours,
    };
  });
}

/**
 * Mindshare leaderboard for a token (% of all crypto mentions in window).
 * Returns { mindshare, rank, mindshareChange } or null.
 */
async function getMindshare(symbol, hours = 24) {
  return cached(`elfa_mindshare_${symbol}_${hours}`, async () => {
    const data = await fetchElfa(
      `/aggregations/mindshare?symbols=${encodeURIComponent(symbol)}&period=${hours}h`
    );
    if (!data || !data.data) return null;
    const t = Array.isArray(data.data) ? data.data[0] : data.data;
    if (!t) return null;
    return {
      symbol,
      mindshare: Number(t.mindshare ?? 0),
      rank: t.rank != null ? Number(t.rank) : null,
      mindshareChange: typeof t.change === 'number' ? t.change : null,
      windowHours: hours,
    };
  });
}

/**
 * Combined Elfa signal — same shape as signalEngine produces for funding /
 * onChainFlow / yieldSpread. Aggregates mentions + mindshare into a single
 * BULLISH/BEARISH/NEUTRAL classification.
 *
 * Heuristic:
 *   - sentiment > 0.20 AND mindshareChange > +20% → BULLISH (strong attention)
 *   - sentiment < -0.20 AND mindshareChange > +20% → BEARISH (negative attention spike)
 *   - sentiment > 0.10 → BULLISH (mild)
 *   - sentiment < -0.10 → BEARISH (mild)
 *   - else NEUTRAL
 *
 * Strength is bounded 0..1 from |sentiment| × log10(1 + max(0, mindshareChange)/5)
 */
async function getSocialSignal(symbol = 'ETH', { hours = 24 } = {}) {
  if (!process.env.ELFA_API_KEY) {
    return { available: false, source: 'elfa-rest-v2', reason: 'no_api_key' };
  }
  try {
    const [mentions, mindshare] = await Promise.all([
      getMentions(symbol, hours),
      getMindshare(symbol, hours),
    ]);

    if (!mentions && !mindshare) {
      return { available: false, source: 'elfa-rest-v2', reason: 'no_data' };
    }

    const sentiment = mentions?.sentiment ?? null;
    const mindshareChange = mindshare?.mindshareChange ?? 0;

    let signal = 'NEUTRAL';
    let strength = 0.2;

    if (sentiment != null) {
      const absS = Math.abs(sentiment);
      const surge = Math.max(0, mindshareChange);
      const surgeBoost = Math.log10(1 + surge / 5); // 0 at flat, ~0.6 at 20% surge

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
    }

    return {
      available: true,
      source: 'elfa-rest-v2',
      symbol,
      windowHours: hours,
      signal,
      strength,
      sentiment,
      mentionCount: mentions?.mentionCount ?? null,
      smartAccountMentions: mentions?.smartAccountMentions ?? null,
      mindshare: mindshare?.mindshare ?? null,
      mindshareChange,
      mindshareRank: mindshare?.rank ?? null,
    };
  } catch (err) {
    console.warn(`[Elfa] getSocialSignal failed: ${err.message}`);
    return { available: false, source: 'elfa-rest-v2', reason: err.message };
  }
}

/**
 * Snapshot for the dashboard — same data, plus a short label suitable for the
 * UI strip. Returned object is JSON-serialisable.
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
              ? ` (${sig.mindshareChange > 0 ? '+' : ''}${sig.mindshareChange.toFixed(0)}%)`
              : ''
          }`,
  };
}

module.exports = {
  getMentions,
  getMindshare,
  getSocialSignal,
  getDashboardSnapshot,
};
