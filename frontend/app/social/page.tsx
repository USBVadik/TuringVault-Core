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

import { type ReactNode, useEffect, useState } from "react";
import { Database, MessageCircle, Plus, Radio, Search } from "lucide-react";
import styles from "./social.module.css";

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

const DEFAULT_TICKERS = ["ETH", "BTC", "SOL"] as const;

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

function signalBg(s: string | undefined): string {
  if (s === "BULLISH") return styles.signalBullish;
  if (s === "BEARISH") return styles.signalBearish;
  return styles.signalNeutral;
}

function signalTone(s: string | undefined): string {
  if (s === "BULLISH") return styles.toneBullish;
  if (s === "BEARISH") return styles.toneBearish;
  return styles.toneNeutral;
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

  const snapshots = tickers.map((sym) => data[sym]).filter(Boolean) as Snapshot[];
  const available = snapshots.filter((d) => d.available);
  const unavailable = snapshots.filter((d) => !d.available);
  const bullishCount = available.filter((d) => d.signal === "BULLISH").length;
  const bearishCount = available.filter((d) => d.signal === "BEARISH").length;
  const strongest = available.reduce<Snapshot | null>((best, d) => {
    if (!best) return d;
    return (d.strength ?? 0) > (best.strength ?? 0) ? d : best;
  }, null);
  const newestFetch = available
    .map((d) => d.fetchedAt)
    .filter(Boolean)
    .sort((a, b) => Date.parse(b || "") - Date.parse(a || ""))[0];
  const coverageLabel = loading
    ? "syncing"
    : `${available.length}/${tickers.length} live`;
  const socialBias =
    bullishCount > bearishCount
      ? "bullish"
      : bearishCount > bullishCount
      ? "bearish"
      : "neutral";

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}>
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Social intelligence</span>
              <span>Elfa REST v2</span>
          </div>
          <h1>Track the crowd signal before it reaches the trade prompt.</h1>
          <p>
            Live snapshot of the 5th structured signal feeding the agent:
            mindshare rank, 24h surge, smart-account reposts, and engagement
            quality. Raw tweet content stays out of the product, so sentiment is
            left null instead of fabricated.
          </p>
          <div className={styles.sourceStrip}>
            <a
              href="https://github.com/USBVadik/TuringVault-Core/blob/main/src/data/elfa.js"
              target="_blank"
              rel="noreferrer"
            >
              src/data/elfa.js
            </a>
            <a
              href="https://github.com/USBVadik/TuringVault-Core/blob/main/frontend/app/api/elfa-snapshot/route.ts"
              target="_blank"
              rel="noreferrer"
            >
              /api/elfa-snapshot
            </a>
          </div>
        </div>

        <div className={styles.commandCard}>
          <div>
            <div className={styles.commandLabel}>Signal state</div>
            <strong className={signalTone(socialBias.toUpperCase())}>
              {loading ? "SYNCING" : socialBias.toUpperCase()}
            </strong>
          </div>
          <div className={styles.commandGrid}>
            <CommandStat label="Coverage" value={coverageLabel} />
            <CommandStat
              label="Strongest"
              value={
                strongest?.symbol
                  ? `${strongest.symbol} ${Math.round((strongest.strength ?? 0) * 100)}%`
                  : "—"
              }
            />
            <CommandStat label="Bullish" value={String(bullishCount)} />
            <CommandStat label="Offline" value={String(unavailable.length)} />
          </div>
          <div className={styles.freshnessLine}>
            <Radio className="w-3.5 h-3.5" />
            <span>refreshes every 5 min · latest {relTime(newestFetch)}</span>
          </div>
        </div>
      </section>

      <section className={styles.operatorBar}>
        <div>
          <span>Tracked tickers</span>
          <strong>
            {loading
              ? "loading"
              : `${tickers.length} ticker${tickers.length === 1 ? "" : "s"}`}
          </strong>
        </div>
        <div className={styles.addTicker}>
          <Search className="w-4 h-4" />
          <input
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTicker()}
            placeholder="add ticker e.g. PEPE"
            aria-label="Add ticker"
          />
          <button onClick={addTicker} aria-label="Add ticker">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </section>

      <section className={styles.cardGrid}>
        {tickers.map((sym) => {
          const d = data[sym];
          if (!d) {
            return (
              <div
                key={sym}
                className={`${styles.assetCard} ${styles.loadingCard}`}
              >
                <div className={styles.cardTopline}>
                  <span>{sym}</span>
                  <em />
                </div>
                <div className={styles.metricGrid}>
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className={styles.metricBox}>
                      <span />
                      <strong />
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          if (!d.available) {
            const reason = d.reason || "";
            const isMissingKey = /no_api_key|not configured/i.test(reason);
            const isRateLimit =
              /429|rate.?limit|RATE_LIMIT|monthly.*limit|quota/i.test(reason);
            let message: string;
            let badgeLabel = "unavailable";
            if (isMissingKey) {
              message = "ELFA_API_KEY not configured on this deployment.";
            } else if (isRateLimit) {
              message =
                "Elfa free-tier monthly quota exceeded — refreshes on the 1st of next month. Live mindshare paused; the rest of the agent (CoinGecko, Nansen, Byreal, DeFiLlama) keeps running.";
              badgeLabel = "rate-limited";
            } else {
              message = `Upstream error: ${reason.slice(0, 200)}`;
            }
            return (
              <div
                key={sym}
                className={`${styles.assetCard} ${styles.unavailableCard}`}
              >
                <div className={styles.cardTopline}>
                  <span>{sym}</span>
                  <em>
                    {badgeLabel}
                  </em>
                </div>
                <p>
                  {message}
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
              className={`${styles.assetCard} ${signalBg(d.signal)}`}
            >
              <div className={styles.cardHeader}>
                <div>
                  <span className={styles.symbol}>{sym}</span>
                  <span
                    className={`${styles.signalPill} ${signalTone(d.signal)}`}
                  >
                    {d.signal}
                  </span>
                </div>
                <span>
                  {win} window · {relTime(d.fetchedAt)}
                </span>
              </div>

              <div className={styles.strengthTrack}>
                <span
                  style={{
                    width: `${
                      d.strength != null
                        ? Math.min(100, Math.max(0, d.strength * 100))
                        : 0
                    }%`,
                  }}
                />
              </div>

              <div className={styles.metricGrid}>
                <MetricBox label="Mindshare">
                  <strong>
                    {d.mindshare != null
                      ? `${Number(d.mindshare).toFixed(2)}%`
                      : "—"}
                  </strong>
                  <em className={dmsColor}>
                    {dmsLabel}
                  </em>
                </MetricBox>
                <MetricBox label="Rank">
                  <strong>
                    {d.mindshareRank != null ? `#${d.mindshareRank}` : "—"}
                  </strong>
                  <em>
                    in trending top 50
                  </em>
                </MetricBox>
                <MetricBox label="Mentions">
                  <strong>
                    {fmtNum(d.mentionCount)}
                  </strong>
                  <em>
                    top {d.mentionCount ?? 0} sampled
                  </em>
                </MetricBox>
              </div>

              <div className={styles.detailGrid}>
                <div>
                  <span>Reposts</span>
                  <strong>
                    <b>
                      {d.smartReposts ?? 0} smart
                    </b>
                    <i>{d.ctReposts ?? 0} ct</i>
                  </strong>
                  <em>
                    smart-share{" "}
                    {d.smartShare != null
                      ? `${Math.round(Number(d.smartShare) * 100)}%`
                      : "—"}
                  </em>
                </div>
                <div>
                  <span>Engagement avg</span>
                  <strong>
                    {fmtNum(d.avgViews)} views · {fmtNum(d.avgLikes)} likes
                  </strong>
                  <em>
                    across sampled mentions
                  </em>
                </div>
              </div>

              <a
                href={`/api/elfa-snapshot?symbol=${sym}`}
                target="_blank"
                rel="noreferrer"
                className={styles.rawLink}
              >
                <Database className="w-3 h-3" />
                raw JSON →
              </a>
            </div>
          );
        })}
      </section>

      <section className={styles.footerNote}>
        <p>
          The agent reads the same payload every cycle (rolled into the
          analyst&apos;s structured-signals prompt alongside funding rate, on-chain
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
      </section>
    </main>
  );
}

function CommandStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MetricBox({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.metricBox}>
      <span>{label}</span>
      {children}
    </div>
  );
}
