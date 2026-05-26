/**
 * /api/elfa-snapshot — live Elfa social snapshot for the dashboard strip.
 *
 * Honesty rule: when ELFA_API_KEY is unset or upstream fails, returns
 * `{ available: false, reason: '...' }` so the UI can render an honest
 * empty state. We never fabricate values.
 */

import { NextResponse } from 'next/server';

const ELFA_BASE = process.env.ELFA_BASE_URL || 'https://api.elfa.ai/v2';
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

function classify(sentiment: number | null, mindshareChange: number | null) {
  if (sentiment == null) return { signal: 'NEUTRAL', strength: 0.2 };
  const dms = mindshareChange ?? 0;
  if (sentiment > 0.20 && dms > 20) return { signal: 'BULLISH', strength: 0.85 };
  if (sentiment < -0.20 && dms > 20) return { signal: 'BEARISH', strength: 0.85 };
  if (sentiment > 0.10) return { signal: 'BULLISH', strength: Math.min(0.6, 0.25 + Math.abs(sentiment)) };
  if (sentiment < -0.10) return { signal: 'BEARISH', strength: Math.min(0.6, 0.25 + Math.abs(sentiment)) };
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
  const hours = Number(url.searchParams.get('hours') || '24');

  const [mentions, mindshare] = await Promise.all([
    fetchElfa(
      `/aggregations/mentions?symbols=${encodeURIComponent(symbol)}&period=${hours}h`
    ),
    fetchElfa(
      `/aggregations/mindshare?symbols=${encodeURIComponent(symbol)}&period=${hours}h`
    ),
  ]);

  const mErr = mentions?.__error;
  const mshErr = mindshare?.__error;
  if ((!mentions || mErr) && (!mindshare || mshErr)) {
    return NextResponse.json(
      {
        available: false,
        reason: mErr || mshErr || 'no_data',
        symbol,
        windowHours: hours,
        fetchedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  }

  const m = Array.isArray(mentions?.data) ? mentions.data[0] : mentions?.data;
  const ms = Array.isArray(mindshare?.data) ? mindshare.data[0] : mindshare?.data;

  const sentiment = typeof m?.sentiment === 'number' ? m.sentiment : null;
  const mentionCount = m?.mentionCount ?? m?.count ?? null;
  const smartAccountMentions = m?.smartAccountCount ?? null;
  const mindshareValue = ms?.mindshare ?? null;
  const mindshareChange = typeof ms?.change === 'number' ? ms.change : null;
  const mindshareRank = ms?.rank ?? null;

  const { signal, strength } = classify(sentiment, mindshareChange);

  return NextResponse.json({
    available: true,
    symbol,
    windowHours: hours,
    fetchedAt: new Date().toISOString(),
    signal,
    strength,
    sentiment,
    mentionCount,
    smartAccountMentions,
    mindshare: mindshareValue,
    mindshareChange,
    mindshareRank,
    source: 'elfa-rest-v2',
  });
}
