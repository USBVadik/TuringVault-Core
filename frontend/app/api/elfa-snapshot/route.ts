/**
 * /api/elfa-snapshot — live Elfa social snapshot for the dashboard strip.
 *
 * Endpoint paths verified against the official V2 migration guide:
 *   https://docs.elfa.ai/migration-guide
 *
 *   GET /v2/data/top-mentions?ticker&timeWindow&page&pageSize
 *   GET /v2/aggregations/trending-tokens?timeWindow&page&pageSize&minMentions
 *
 * V2 strips raw tweet content for ToS compliance — only metadata
 * (mentioned_at, account_name, like/repost/view counts, account_tags) is
 * returned. We derive the BULLISH/BEARISH/NEUTRAL classification from the
 * *attention* signal: mindshare surge + smart-account ratio.
 *
 * Honesty rule: when ELFA_API_KEY is unset or upstream fails, returns
 * `{ available: false, reason: '...' }` so the UI can render an honest
 * empty state. We never fabricate values.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";const ELFA_BASE = process.env.ELFA_BASE_URL || "https://api.elfa.ai";
const TIMEOUT_MS = 8000;

async function fetchElfa(path: string) {
  const apiKey = process.env.ELFA_API_KEY;
  if (!apiKey) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${ELFA_BASE}${path}`, {
      method: "GET",
      headers: {
        "x-elfa-api-key": apiKey,
        Accept: "application/json",
      },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { __error: `HTTP ${res.status}: ${text.slice(0, 160)}` };
    }
    return await res.json();
  } catch (err: any) {
    return { __error: err?.message || "fetch failed" };
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

  // V2 actual fields (verified via debug=1):
  //   { tweetId, link, likeCount, repostCount, viewCount, quoteCount,
  //     replyCount, bookmarkCount, mentionedAt, type,
  //     repostBreakdown: { smart, ct } }
  let smartReposts = 0;
  let ctReposts = 0;
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
    smartReposts,
    ctReposts,
    avgViews: total ? Math.round(viewSum / total) : 0,
    avgLikes: total ? Math.round(likeSum / total) : 0,
    avgReposts: total ? Math.round(repostSum / total) : 0,
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

  // V2 returns lowercase token names: { token: "btc", current_count, previous_count, change_percent }
  const target = ticker.toLowerCase();
  let totalMentions = 0;
  for (const t of items) {
    totalMentions += Number(t.current_count ?? t.mentions ?? t.count ?? 0);
  }
  for (let i = 0; i < items.length; i += 1) {
    const t = items[i];
    const sym = String(t.token ?? t.ticker ?? t.symbol ?? "").toLowerCase();
    if (sym === target) {
      const mentions = Number(t.current_count ?? t.mentions ?? t.count ?? 0);
      const previous = Number(t.previous_count ?? 0);
      const mindshare =
        totalMentions > 0
          ? +(100 * (mentions / totalMentions)).toFixed(2)
          : null;
      let change: number | null = null;
      if (typeof t.change_percent === "number") change = t.change_percent;
      else if (previous > 0)
        change = +(((mentions - previous) / previous) * 100).toFixed(1);
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

function classify(mindshareChange: number | null, smartShare: number) {
  const dms = mindshareChange ?? 0;
  if (dms > 50 && smartShare >= 0.2)
    return { signal: "BULLISH", strength: 0.85 };
  if (dms > 20)
    return {
      signal: "BULLISH",
      strength: Math.min(0.6, 0.3 + Math.log10(1 + dms / 5)),
    };
  if (dms < -30)
    return {
      signal: "BEARISH",
      strength: Math.min(0.6, 0.3 + Math.log10(1 + Math.abs(dms) / 5)),
    };
  return { signal: "NEUTRAL", strength: 0.2 };
}

export async function GET(req: Request) {
  if (!process.env.ELFA_API_KEY) {
    return NextResponse.json(
      {
        available: false,
        reason: "ELFA_API_KEY not configured on this deployment",
        symbol: null,
        fetchedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  }

  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") || "ETH").toUpperCase();
  const timeWindow = url.searchParams.get("timeWindow") || "24h";

  const params = new URLSearchParams({
    ticker: symbol,
    timeWindow,
    page: "1",
    pageSize: "10",
  });
  const trendParams = new URLSearchParams({
    timeWindow,
    page: "1",
    pageSize: "50",
    minMentions: "5",
  });

  const [mentions, trending] = await Promise.all([
    fetchElfa(`/v2/data/top-mentions?${params.toString()}`),
    fetchElfa(`/v2/aggregations/trending-tokens?${trendParams.toString()}`),
  ]);

  const mErr = mentions?.__error;
  const tErr = trending?.__error;

  if ((!mentions || mErr) && (!trending || tErr)) {
    return NextResponse.json(
      {
        available: false,
        reason: mErr || tErr || "no_data",
        symbol,
        timeWindow,
        fetchedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  }

  const mSum = mErr ? null : summariseMentions(mentions);
  const tSum = tErr ? null : findInTrending(trending, symbol);

  const mindshareChange = tSum?.mindshareChange ?? null;
  const totalReposts = (mSum?.smartReposts ?? 0) + (mSum?.ctReposts ?? 0);
  const smartShare = totalReposts > 0 ? mSum!.smartReposts / totalReposts : 0;

  const { signal, strength } = classify(mindshareChange, smartShare);

  return NextResponse.json({
    available: true,
    symbol,
    timeWindow,
    fetchedAt: new Date().toISOString(),
    signal,
    strength,
    sentiment: null, // V2 strips raw content
    mentionCount: mSum?.mentionCount ?? null,
    smartReposts: mSum?.smartReposts ?? 0,
    ctReposts: mSum?.ctReposts ?? 0,
    smartShare: +smartShare.toFixed(2),
    avgViews: mSum?.avgViews ?? null,
    avgLikes: mSum?.avgLikes ?? null,
    mindshare: tSum?.mindshare ?? null,
    mindshareChange,
    mindshareRank: tSum?.rank ?? null,
    source: "elfa-rest-v2",
  });
}
