"use client";

/**
 * /social — Elfa social-attention drill-down.
 *
 * Shows the live snapshot from /api/elfa-snapshot for ETH, BTC and any
 * other ticker the user types. Surfaces:
 *   - mindshare + rank + change
 *   - smart vs ct repost breakdown
 *   - engagement averages (views / likes)
 *
 * Honesty rule: when ELFA_API_KEY is unset on this deployment OR when the
 * upstream API errors, render an explicit "data unavailable, here is why"
 * panel rather than fabricating numbers.
 *
 * Source: src/data/elfa.js + frontend/app/api/elfa-snapshot/route.ts.
 * Endpoints used (Elfa REST V2):
 *   GET /v2/data/top-mentions?ticker&timeWindow
 *   GET /v2/aggregations/trending-tokens?timeWindow
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";

type Snapshot = {
  available: boolean;
  reason?: string;
  symbol?: string | null;
  timeWindow?: string | null;
  fetchedAt?: string | null;
  signal?: "BULLISH" | "BEARISH" | "NEUTRAL";
  strength?: number;
  sentiment?: number | null;
  mentionCount?: number | null;
  smartReposts?: number | null;
  ctReposts?: number | null;
  smartShare?: number | null;
  avgViews?: number | null;
  avgLikes?: number | null;
  mindshare?: number | null;
  mindshareChange?: number | null;
  mindshareRank?: number | null;
  source?: string;
};

const DEFAULT_TICKERS = ["ETH", "BTC", "SOL", "MNT"] as const;

function relTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms) || ms < 0) return iso;
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function signalColor(s: string | undefined): string {
  if (s === "BULLISH") return "text-emerald-400";
  if (s === "BEARISH") return "text-red-400";
  return "text-white/60";
}

function signalBg(s: string | undefined): string {
  if (s === "BULLISH") return "bg-emerald-500/[0.06] border-emerald-500/20";
  if (s === "BEARISH") return "bg-red-500/[0.06] border-red-500/20";
  return "bg-white/[0.02] border-white/[0.06]";
}

function fmtNum(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function SocialPage() {
  const [tickers, setTickers] = useState<string[]>([...DEFAULT_TICKERS]);
  const [data, setData] = useState<Record<string, Snapshot | null>>({});
  const [loading, setLoading] = useState(true);
  const [customInput, setCustomInput] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function fetchAll() {
      setLoading(true);
      const entries = await Promise.all(
        tickers.map(async (sym) => {
          try {
            const r = await fetch(`/api/elfa-snapshot?symbol=${sym}`, {
              cache: "no-store",
            });
            if (!r.ok) return [sym, null] as const;
            const j = (await r.json()) as Snapshot;
            return [sym, j] as const;
          } catch {
            return [sym, null] as const;
          }
        })
      );
      if (!cancelled) {
        const map: Record<string, Snapshot | null> = {};
        for (const [sym, snap] of entries) map[sym] = snap;
        setData(map);
        setLoading(false);
      }
    }
    fetchAll();
    const id = setInterval(fetchAll, 5 * 60 * 1000); // 5 min refresh
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [tickers]);

  function addTicker() {
    const sym = customInput.trim().toUpperCase();
    if (!sym || tickers.includes(sym)) {
      setCustomInput("");
      return;
    }
    setTickers((prev) => [...prev, sym]);
    setCustomInput("");
  }

  return (
    <main className="relative min-h-screen px-6 py-10 max-w-[1100px] mx-auto text-white">
      <header className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <MessageCircle className="w-6 h-6 text-purple-400" />
            Social Attention{" "}
            <span className="text-white/40 font-normal">· Elfa REST v2</span>
          </h1>
        </div>
        <p className="text-xs text-white/40 mt-2 max-w-3xl leading-relaxed">
          Live snapshot of the 5th structured signal feeding the agent:
          mindshare leaderboard rank, 24h surge, and the breakdown of reposts
          from smart vs ct (crypto-twitter generic) accounts. V2 strips raw
          tweet content for ToS compliance — sentiment is reported as{" "}
          <code className="font-mono text-white/60">null</code> rather than
          fabricated. Refreshes every 5 min.
        </p>
        <div className="mt-3 text-[10px] font-mono text-white/30">
          Source:{" "}
          <a
            href="https://github.com/USBVadik/TuringVault-Core/blob/main/src/data/elfa.js"
            target="_blank"
            rel="noreferrer"
            className="text-purple-300/70 hover:text-purple-200"
          >
            src/data/elfa.js
          </a>
          {" · "}
          <a
            href="https://github.com/USBVadik/TuringVault-Core/blob/main/frontend/app/api/elfa-snapshot/route.ts"
            target="_blank"
            rel="noreferrer"
            className="text-purple-300/70 hover:text-purple-200"
          >
            /api/elfa-snapshot
          </a>
        </div>
      </header>

      {/* Add custom ticker */}
      <div className="mb-6 flex items-center gap-2">
        <input
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTicker()}
          placeholder="add ticker e.g. PEPE"
          className="bg-white/[0.04] border border-white/10 rounded px-3 py-1.5 text-sm font-mono w-48 placeholder-white/20 focus:outline-none focus:border-purple-500/40"
        />
        <button
          onClick={addTicker}
          className="px-3 py-1.5 text-xs font-mono bg-purple-500/15 border border-purple-500/30 text-purple-200 rounded hover:bg-purple-500/25"
        >
          add
        </button>
        <span className="text-[10px] text-white/30 ml-2">
          {loading
            ? "loading…"
            : `${tickers.length} ticker${
                tickers.length === 1 ? "" : "s"
              } tracked`}
        </span>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tickers.map((sym) => {
          const d = data[sym];
          if (!d) {
            return (
              <div
                key={sym}
                className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.02]"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-semibold">{sym}</span>
                  <span className="text-[10px] font-mono text-white/30">
                    loading…
                  </span>
                </div>
              </div>
            );
          }

          if (!d.available) {
            const isMissingKey = /no_api_key|not configured/i.test(
              d.reason || ""
            );
            return (
              <div
                key={sym}
                className="p-5 rounded-xl border border-yellow-500/20 bg-yellow-500/[0.04]"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-semibold">{sym}</span>
                  <span className="text-[10px] font-mono text-yellow-300/70">
                    unavailable
                  </span>
                </div>
                <p className="text-xs text-white/50 leading-relaxed">
                  {isMissingKey
                    ? "ELFA_API_KEY not configured on this deployment."
                    : `Upstream error: ${(d.reason || "unknown").slice(
                        0,
                        200
                      )}`}
                </p>
              </div>
            );
          }

          const win = d.timeWindow || "24h";
          const dms = d.mindshareChange;
          const dmsLabel =
            dms == null
              ? "—"
              : `${dms >= 0 ? "+" : ""}${Number(dms).toFixed(1)}%`;
          const dmsColor =
            dms == null
              ? "text-white/40"
              : dms >= 0
              ? "text-emerald-400/80"
              : "text-red-400/80";

          return (
            <div
              key={sym}
              className={`p-5 rounded-xl border ${signalBg(d.signal)}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold">{sym}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${signalColor(
                      d.signal
                    )}`}
                  >
                    {d.signal}
                  </span>
                  <span className="text-[10px] font-mono text-white/30">
                    strength{" "}
                    {d.strength != null
                      ? `${Math.round(d.strength * 100)}%`
                      : "—"}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-white/30">
                  {win} window · {relTime(d.fetchedAt)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="p-2.5 rounded bg-white/[0.03]">
                  <div className="text-[9px] text-white/30 uppercase tracking-wider mb-1">
                    Mindshare
                  </div>
                  <div className="text-lg font-mono font-bold">
                    {d.mindshare != null
                      ? `${Number(d.mindshare).toFixed(2)}%`
                      : "—"}
                  </div>
                  <div className={`text-[10px] font-mono mt-0.5 ${dmsColor}`}>
                    {dmsLabel}
                  </div>
                </div>
                <div className="p-2.5 rounded bg-white/[0.03]">
                  <div className="text-[9px] text-white/30 uppercase tracking-wider mb-1">
                    Rank
                  </div>
                  <div className="text-lg font-mono font-bold">
                    {d.mindshareRank != null ? `#${d.mindshareRank}` : "—"}
                  </div>
                  <div className="text-[10px] font-mono text-white/30 mt-0.5">
                    in trending top 50
                  </div>
                </div>
                <div className="p-2.5 rounded bg-white/[0.03]">
                  <div className="text-[9px] text-white/30 uppercase tracking-wider mb-1">
                    Mentions
                  </div>
                  <div className="text-lg font-mono font-bold">
                    {fmtNum(d.mentionCount)}
                  </div>
                  <div className="text-[10px] font-mono text-white/30 mt-0.5">
                    top {d.mentionCount ?? 0} sampled
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3 text-[11px]">
                <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
                  <div className="text-[9px] text-white/30 uppercase tracking-wider mb-0.5">
                    Reposts
                  </div>
                  <div className="font-mono">
                    <span className="text-emerald-400/80">
                      {d.smartReposts ?? 0} smart
                    </span>
                    <span className="text-white/30"> / </span>
                    <span className="text-white/55">{d.ctReposts ?? 0} ct</span>
                  </div>
                  <div className="text-[10px] text-white/40 mt-0.5">
                    smart-share{" "}
                    {d.smartShare != null
                      ? `${Math.round(Number(d.smartShare) * 100)}%`
                      : "—"}
                  </div>
                </div>
                <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
                  <div className="text-[9px] text-white/30 uppercase tracking-wider mb-0.5">
                    Engagement (avg)
                  </div>
                  <div className="font-mono text-white/70">
                    {fmtNum(d.avgViews)} views · {fmtNum(d.avgLikes)} likes
                  </div>
                  <div className="text-[10px] text-white/40 mt-0.5">
                    across sampled mentions
                  </div>
                </div>
              </div>

              <a
                href={`/api/elfa-snapshot?symbol=${sym}`}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] font-mono text-purple-300/60 hover:text-purple-200"
              >
                raw JSON →
              </a>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="mt-10 pt-6 border-t border-white/[0.05] text-[11px] text-white/40 leading-relaxed max-w-3xl">
        <p>
          The agent reads the same payload every cycle (rolled into the
          analyst's structured-signals prompt alongside funding rate, on-chain
          flow, yield spread, and liquidation map). The classifier turns
          mindshare-surge + smart-share into BULLISH / BEARISH / NEUTRAL;
          sentiment itself is intentionally left null because Elfa V2 strips raw
          tweet content for ToS compliance and we refuse to fabricate one.
        </p>
        <p className="mt-3">
          See the prompt-summary line shipped to GLM-5 inside{" "}
          <a
            href="https://github.com/USBVadik/TuringVault-Core/blob/main/src/orchestrator/signalEngine.js"
            target="_blank"
            rel="noreferrer"
            className="text-purple-300/70 hover:text-purple-200"
          >
            src/orchestrator/signalEngine.js
          </a>
          .
        </p>
      </div>
    </main>
  );
}
