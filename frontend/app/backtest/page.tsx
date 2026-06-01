"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Activity, BarChart3, Database, ShieldCheck, TrendingUp } from "lucide-react";
import { Skeleton } from "../components/Skeleton";

function BacktestSkeleton() {
  return (
    <div className="performance-page min-h-screen text-white">
      <div className="performance-shell">
        <div className="flex items-center gap-3 mb-2">
          <BarChart3 className="w-7 h-7 text-purple-400" />
          <Skeleton className="w-48 h-8" />
        </div>
        <Skeleton className="w-64 h-4 mb-2" />
        <Skeleton className="w-32 h-3 mb-8" />

        {/* Stats skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <Skeleton className="w-20 h-6 mb-2" />
              <Skeleton className="w-16 h-3" />
            </div>
          ))}
        </div>

        {/* Chart skeleton */}
        <div className="p-6 rounded-lg border border-white/[0.06] bg-white/[0.02] mb-6">
          <Skeleton className="w-48 h-4 mb-4" />
          <Skeleton className="w-full h-48" />
        </div>

        {/* Table skeleton */}
        <div className="p-6 rounded-lg border border-white/[0.06] bg-white/[0.02]">
          <Skeleton className="w-40 h-4 mb-4" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="w-full h-6" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BacktestPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/backtest")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white p-8 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-2">Failed to load performance data</p>
          <p className="text-white/40 text-sm">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return <BacktestSkeleton />;

  const { summary, equityCurve, trades } = data;
  const maxNav = Math.max(...equityCurve.map((p: any) => p.nav));
  const minNav = Math.min(...equityCurve.map((p: any) => p.nav));
  const hitRate =
    summary.totalTrades > 0
      ? Math.round((summary.positiveTrades / summary.totalTrades) * 100)
      : 0;
  const scoreTone = summary.cumulativeBps >= 0 ? "positive" : "negative";
  const latestTrade = trades[trades.length - 1] ?? null;

  return (
    <div className="performance-page min-h-screen text-white">
      <div className="performance-shell anim-fade-up">
        <section className="performance-hero">
          <div className="performance-hero-copy">
            <p className="performance-kicker">
              <BarChart3 className="w-4 h-4" />
              Model outcome ledger
            </p>
            <h1>Outcome Score</h1>
            <p>
              {summary.period} scored decisions. This is decision-quality
              review, not realized wallet PnL.
            </p>
            <div className="performance-source-pill">
              <Database className="w-3.5 h-3.5" />
              <span>{summary.dataSource}</span>
            </div>
          </div>

          <div className={`performance-score-card ${scoreTone}`}>
            <span>Outcome score</span>
            <strong>
              {summary.cumulativeBps > 0 ? "+" : ""}
              {summary.cumulativeBps} bps
            </strong>
            <div className="performance-score-grid">
              <span>Score return</span>
              <em>
                {summary.totalReturn > 0 ? "+" : ""}
                {summary.totalReturn}%
              </em>
              <span>Hit rate</span>
              <em>{hitRate}%</em>
              <span>Last row</span>
              <em>
                {latestTrade
                  ? `#${latestTrade.idx} ${String(latestTrade.action).toUpperCase()}`
                  : "-"}
              </em>
            </div>
          </div>
        </section>

        {/* Summary Stats */}
        <div className="performance-stat-grid">
          <StatCard
            label="Outcome Score"
            value={`+${summary.cumulativeBps} bps`}
            color="green"
          />
          <StatCard
            label="Score Return"
            value={`+${summary.totalReturn}%`}
            color="green"
          />
          <StatCard
            label="Max Drawdown"
            value={`-${summary.maxDrawdownBps} bps`}
            color="red"
          />
          <StatCard
            label="Avg Trade"
            value={`${summary.avgTradeBps > 0 ? "+" : ""}${
              summary.avgTradeBps
            } bps`}
            color="purple"
          />
          <StatCard
            label="Settled Trades"
            value={summary.totalTrades}
            color="white"
          />
          <StatCard
            label="Positive"
            value={summary.positiveTrades}
            color="green"
          />
          <StatCard
            label="Negative"
            value={summary.negativeTrades}
            color="red"
          />
          <StatCard
            label="Neutral"
            value={summary.neutralTrades}
            color="blue"
          />
        </div>

        {/* Equity Curve */}
        <div className="performance-panel performance-chart-panel">
          <div className="performance-panel-header">
            <div>
              <span>Score curve</span>
              <strong>Normalized $100 start</strong>
            </div>
            <div className="performance-panel-badge">
              <TrendingUp className="w-3.5 h-3.5" />
              {summary.totalTrades} settled
            </div>
          </div>
          <EquityCurveChart equityCurve={equityCurve} maxNav={maxNav} minNav={minNav} />
        </div>

        {/* Trade Table */}
        <div className="performance-panel">
          <div className="performance-panel-header">
            <div>
              <span>Recent settled decisions</span>
              <strong>Outcome-score rows</strong>
            </div>
            <div className="performance-panel-badge muted">
              <Activity className="w-3.5 h-3.5" />
              latest {trades.length}
            </div>
          </div>
          <div className="performance-table-wrap">
            <div className="performance-table">
              <div className="performance-table-head">
                <span>#</span>
                <span>Action</span>
                <span>Asset</span>
                <span>Price</span>
                <span>Score</span>
              </div>
              {trades.map((t: any, i: number) => (
                <div
                  key={i}
                  className={`performance-table-row ${
                    t.pnlBps > 0
                      ? "positive"
                      : t.pnlBps < 0
                      ? "negative"
                      : "neutral"
                  }`}
                >
                  <span>#{t.idx}</span>
                  <span>{String(t.action).toUpperCase()}</span>
                  <span>{t.asset}</span>
                  <span>${t.price?.toFixed(2) || "-"}</span>
                  <span>
                    {t.pnlBps > 0 ? "+" : ""}
                    {t.pnlBps} bps
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Methodology */}
        <div className="performance-methodology">
          <ShieldCheck className="w-4 h-4" />
          <p>
            <strong>Data Source:</strong> This page charts outcomeTracker scoring
            from settled decisions in outcomes.json. It is useful for
            model-quality review, but it is not realized wallet PnL. DEX
            execution truth lives on each decision row via executedOnChain,
            directionalSwap, and transaction hashes.
          </p>
        </div>
      </div>
    </div>
  );
}

function EquityCurveChart({
  equityCurve,
  maxNav,
  minNav,
}: {
  equityCurve: any[];
  maxNav: number;
  minNav: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{
    idx: number;
    x: number;
    y: number;
  } | null>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || equityCurve.length === 0) return;
      const relX = e.clientX - rect.left;
      const pct = relX / rect.width;
      const idx = Math.max(
        0,
        Math.min(equityCurve.length - 1, Math.round(pct * (equityCurve.length - 1)))
      );
      setHover({ idx, x: relX, y: e.clientY - rect.top });
    },
    [equityCurve.length]
  );

  const hoverPoint = hover ? equityCurve[hover.idx] : null;
  const pnlFromStart = hoverPoint
    ? ((hoverPoint.nav - 100) * 100).toFixed(0)
    : null;
  const navRange = Math.max(maxNav - minNav, 1);
  const yForNav = (nav: number) => 100 - ((nav - minNav) / navRange) * 90 - 5;

  return (
    <div
      ref={containerRef}
      className="performance-chart relative h-48 w-full cursor-crosshair"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHover(null)}
    >
      <svg
        viewBox={`0 0 ${equityCurve.length} 100`}
        className="w-full h-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Equity curve chart showing NAV from $${minNav.toFixed(2)} to $${maxNav.toFixed(2)} over ${equityCurve.length} data points. Hover for details.`}
      >
        {/* Grid lines */}
        <line x1="0" y1="50" x2={equityCurve.length} y2="50" stroke="rgba(255,255,255,0.05)" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1="25" x2={equityCurve.length} y2="25" stroke="rgba(255,255,255,0.03)" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1="75" x2={equityCurve.length} y2="75" stroke="rgba(255,255,255,0.03)" vectorEffect="non-scaling-stroke" />

        {/* Equity line */}
        <polyline
          points={equityCurve
            .map((p: any, i: number) => {
              const y = yForNav(p.nav);
              return `${i},${y}`;
            })
            .join(" ")}
          fill="none"
          stroke="url(#gradient)"
          strokeWidth="2.4"
          vectorEffect="non-scaling-stroke"
        />

        {/* Gradient fill under curve */}
        <polygon
          points={`0,100 ${equityCurve
            .map((p: any, i: number) => {
              const y = yForNav(p.nav);
              return `${i},${y}`;
            })
            .join(" ")} ${equityCurve.length - 1},100`}
          fill="url(#fillGradient)"
        />

        {/* Trade markers */}
        {equityCurve
          .filter((p: any) => p.action)
          .map((p: any, i: number) => {
            const idx = equityCurve.indexOf(p);
            const y = yForNav(p.nav);
            return (
              <circle
                key={i}
                cx={idx}
                cy={y}
                r="1"
                fill={p.action === "swap" ? "#4ade80" : "#a78bfa"}
              />
            );
          })}

        {/* Hover crosshair */}
        {hover && (
          <line
            x1={hover.idx}
            y1="0"
            x2={hover.idx}
            y2="100"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1"
            strokeDasharray="2,2"
            vectorEffect="non-scaling-stroke"
          />
        )}

        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
          <linearGradient id="fillGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(167,139,250,0.15)" />
            <stop offset="100%" stopColor="rgba(167,139,250,0)" />
          </linearGradient>
        </defs>
      </svg>

      {/* Hover tooltip */}
      {hover && hoverPoint && (
        <div
          className="absolute pointer-events-none z-10 px-2.5 py-1.5 rounded-md bg-black/90 border border-white/10 text-[10px] font-mono shadow-lg backdrop-blur-sm whitespace-nowrap"
          style={{
            left: Math.min(hover.x + 12, (containerRef.current?.clientWidth ?? 300) - 140),
            top: Math.max(hover.y - 40, 0),
          }}
        >
          <div className="text-white/80">
            Score NAV: <span className="text-green-400">${hoverPoint.nav?.toFixed(2)}</span>
          </div>
          <div className="text-white/50">
            Score: <span className={Number(pnlFromStart) >= 0 ? "text-green-400" : "text-red-400"}>
              {Number(pnlFromStart) >= 0 ? "+" : ""}{pnlFromStart} bps
            </span>
          </div>
          {hoverPoint.action && (
            <div className="text-purple-300 uppercase">{hoverPoint.action}</div>
          )}
          {hoverPoint.date && (
            <div className="text-white/30">{hoverPoint.date}</div>
          )}
        </div>
      )}

      {/* Y axis labels */}
      <div className="absolute top-0 left-0 text-[9px] text-white/20">
        ${maxNav.toFixed(2)}
      </div>
      <div className="absolute bottom-0 left-0 text-[9px] text-white/20">
        ${minNav.toFixed(2)}
      </div>
      <div className="absolute bottom-0 right-2 text-[9px] text-green-400/60">
        ● SWAP &nbsp; <span className="text-purple-400/60">● HOLD</span>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  const colors: Record<string, string> = {
    green: "positive",
    red: "negative",
    purple: "accent",
    blue: "info",
    white: "neutral",
  };
  return (
    <div className={`performance-stat-card ${colors[color]}`}>
      <div>{value}</div>
      <span>{label}</span>
    </div>
  );
}
