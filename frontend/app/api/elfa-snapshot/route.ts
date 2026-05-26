/**
 * /api/elfa-snapshot — live Elfa social snapshot for the dashboard strip.
 *
 * Honesty rule: when ELFA_API_KEY is unset or upstream fails, returns
 * `{ available: false, reason: '...' }` so the UI can render an honest
 * empty state. We never fabricate values.
 *
 * Endpoint paths verified against the open-source AgentiPy client:
 *   https://github.com/niceberginc/agentipy/blob/main/agentipy/tools/use_elfa_ai.py
 *   - GET /v1/top-mentions?ticker&timeWindow
 *   - GET /v1/trending-tokens?timeWindow
 */

import { NextResponse } from 'next/server';

const ELFA_BASE = process.env.ELFA_BASE_URL || 'https://api.elfa.ai';
const TIMEOUT_MS = 8000;

async function fetchElfa(path: string) {
  const apiKey = process.env.ELFA_API_KEY;
  if (!apiKey) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
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
      return { __error: `HTTP ${res.status}: ${text.slice(0, 160)}` };
    }
    return await res.json();
  } catch (err: any) {
    return { __error: err?.message || 'fetch failed' };
  } finally {
    clearTimeout(t);
  }
}

function summariseMentions(payload: any) {
  if (!payload) return null;
  const items: any[] = Array.isArray(payload?.data)
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

function findInTrending(payload: any, ticker: string) {
  if (!payload) return null;
  const items: any[] = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.data?.data)
      ? payload.data.data
      : Array.isArray(payload)
        ? payload
        : [];
  if (!items.length) return null;

  const upper = ticker.toUpperCase();
  let totalMentions = 0;
  for (const t of items) {
    totalMentions += Number(t.mentions ?? t.mentionCount ?? t.count ?? 0);
  }
  for (let i = 0; i < items.length; i += 1) {
    const t = items[i];
    const sym = String(t.token ?? t.ticker ?? t.symbol ?? '').toUpperCase();
    if (sym === upper) {
      const mentions = Number(t.mentions ?? t.mentionCount ?? t.count ?? 0);
      const mindshare =
        totalMentions > 0
          ? +(100 * (mentions / totalMentions)).toFixed(2)
          : null;
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

function classify(sentiment: number | null, mindshareChange: number | null) {
  if (sentiment == null) {
    if (mindshareChange != null && mindshareChange > 30) {
      return { signal: 'BULLISH', strength: 0.4 };
    }
    return { signal: 'NEUTRAL', strength: 0.2 };
  }
  const dms = mindshareChange ?? 0;
  if (sentiment > 0.20 && dms > 20) return { signal: 'BULLISH', strength: 0.85 };
  if (sentiment < -0.20 && dms > 20) return { signal: 'BEARISH', strength: 0.85 };
  if (sentiment > 0.10)
    return { signal: 'BULLISH', strength: Math.min(0.6, 0.25 + Math.abs(sentiment)) };
  if (sentiment < -0.10)
    return { signal: 'BEARISH', strength: Math.min(0.6, 0.25 + Math.abs(sentiment)) };
  return { signal: 'NEUTRAL', strength: 0.2 };
}

export async function GET(req: Request) {
  if (!process.env.ELFA_API_KEY) {
    return NextResponse.json(
      {
        available: false,
        reason: 'ELFA_API_KEY not configured on this deployment',
        symbol: null,
        fetchedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  }

  const url = new URL(req.url);
  const symbol = (url.searchParams.get('symbol') || 'ETH').toUpperCase();
  const timeWindow = url.searchParams.get('timeWindow') || '24h';

  const params = new URLSearchParams({
    ticker: symbol,
    timeWindow,
    page: '1',
    pageSize: '10',
    includeAccountDetails: 'false',
  });
  const trendParams = new URLSearchParams({
    timeWindow,
    page: '1',
    pageSize: '50',
    minMentions: '5',
  });

  const [mentions, trending] = await Promise.all([
    fetchElfa(`/v1/top-mentions?${params.toString()}`),
    fetchElfa(`/v1/trending-tokens?${trendParams.toString()}`),
  ]);

  const mErr = mentions?.__error;
  const tErr = trending?.__error;

  if ((!mentions || mErr) && (!trending || tErr)) {
    return NextResponse.json(
      {
        available: false,
        reason: mErr || tErr || 'no_data',
        symbol,
        timeWindow,
        fetchedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  }

  const mSum = mErr ? null : summariseMentions(mentions);
  const tSum = tErr ? null : findInTrending(trending, symbol);

  const sentiment = mSum?.sentiment ?? null;
  const mindshareChange = tSum?.mindshareChange ?? null;

  const { signal, strength } = classify(sentiment, mindshareChange);

  return NextResponse.json({
    available: true,
    symbol,
    timeWindow,
    fetchedAt: new Date().toISOString(),
    signal,
    strength,
    sentiment,
    mentionCount: mSum?.mentionCount ?? null,
    smartAccountMentions: mSum?.smartAccountMentions ?? null,
    mindshare: tSum?.mindshare ?? null,
    mindshareChange,
    mindshareRank: tSum?.rank ?? null,
    source: 'elfa-rest-v1',
  });
}
