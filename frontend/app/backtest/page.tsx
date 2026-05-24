'use client';

import { useState, useEffect } from 'react';

export default function BacktestPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/backtest').then(r => r.json()).then(setData);
  }, []);

  if (!data) return <div className="min-h-screen bg-[#0a0a0f] text-white p-8 flex items-center justify-center"><span className="animate-pulse text-white/30">Loading performance data...</span></div>;

  const { summary, equityCurve, trades } = data;
  const maxNav = Math.max(...equityCurve.map((p: any) => p.nav));
  const minNav = Math.min(...equityCurve.map((p: any) => p.nav));

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-8">
      <div className="max-w-5xl mx-auto">
        <a href="/" className="text-xs text-white/30 hover:text-white/60 mb-4 block">← Back to Dashboard</a>
        <h1 className="text-3xl font-bold mb-2">📊 Live Performance</h1>
        <p className="text-white/40 text-sm mb-2">{summary.period} · Real on-chain execution results</p>
        <p className="text-[10px] text-white/20 mb-8">Source: {summary.dataSource}</p>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard label="Cumulative PnL" value={`+${summary.cumulativeBps} bps`} color="green" />
          <StatCard label="Total Return" value={`+${summary.totalReturn}%`} color="green" />
          <StatCard label="Max Drawdown" value={`-${summary.maxDrawdownBps} bps`} color="red" />
          <StatCard label="Avg Trade" value={`${summary.avgTradeBps > 0 ? '+' : ''}${summary.avgTradeBps} bps`} color="purple" />
          <StatCard label="Settled Trades" value={summary.totalTrades} color="white" />
          <StatCard label="Positive" value={summary.positiveTrades} color="green" />
          <StatCard label="Negative" value={summary.negativeTrades} color="red" />
          <StatCard label="Neutral" value={summary.neutralTrades} color="blue" />
        </div>

        {/* Equity Curve */}
        <div className="p-6 rounded-lg border border-white/[0.06] bg-white/[0.02] mb-6">
          <h3 className="text-xs font-bold text-white/60 uppercase mb-4">Equity Curve (normalized $100 start · real execution)</h3>
          <div className="relative h-48 w-full">
            <svg viewBox={`0 0 ${equityCurve.length} 100`} className="w-full h-full" preserveAspectRatio="none">
              {/* Grid lines */}
              <line x1="0" y1="50" x2={equityCurve.length} y2="50" stroke="rgba(255,255,255,0.05)" />
              <line x1="0" y1="25" x2={equityCurve.length} y2="25" stroke="rgba(255,255,255,0.03)" />
              <line x1="0" y1="75" x2={equityCurve.length} y2="75" stroke="rgba(255,255,255,0.03)" />
              
              {/* Equity line */}
              <polyline
                points={equityCurve.map((p: any, i: number) => {
                  const y = 100 - ((p.nav - minNav) / (maxNav - minNav)) * 90 - 5;
                  return `${i},${y}`;
                }).join(' ')}
                fill="none"
                stroke="url(#gradient)"
                strokeWidth="0.8"
              />
              
              {/* Gradient fill under curve */}
              <polygon
                points={`0,100 ${equityCurve.map((p: any, i: number) => {
                  const y = 100 - ((p.nav - minNav) / (maxNav - minNav)) * 90 - 5;
                  return `${i},${y}`;
                }).join(' ')} ${equityCurve.length - 1},100`}
                fill="url(#fillGradient)"
              />
              
              {/* Trade markers */}
              {equityCurve.filter((p: any) => p.action).map((p: any, i: number) => {
                const idx = equityCurve.indexOf(p);
                const y = 100 - ((p.nav - minNav) / (maxNav - minNav)) * 90 - 5;
                return <circle key={i} cx={idx} cy={y} r="1.5" fill={p.action === 'swap' ? '#4ade80' : '#a78bfa'} />;
              })}
              
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
            
            {/* Y axis labels */}
            <div className="absolute top-0 left-0 text-[9px] text-white/20">${maxNav.toFixed(2)}</div>
            <div className="absolute bottom-0 left-0 text-[9px] text-white/20">${minNav.toFixed(2)}</div>
            <div className="absolute bottom-0 right-2 text-[9px] text-green-400/60">
              ● SWAP &nbsp; <span className="text-purple-400/60">● HOLD</span>
            </div>
          </div>
        </div>

        {/* Trade Table */}
        <div className="p-6 rounded-lg border border-white/[0.06] bg-white/[0.02]">
          <h3 className="text-xs font-bold text-white/60 uppercase mb-4">Recent Settled Decisions</h3>
          <div className="space-y-1 font-mono text-xs">
            <div className="grid grid-cols-5 text-white/30 pb-2 border-b border-white/[0.04]">
              <span>#</span><span>ACTION</span><span>ASSET</span><span>PRICE</span><span>PNL (bps)</span>
            </div>
            {trades.map((t: any, i: number) => (
              <div key={i} className={`grid grid-cols-5 py-1 ${t.pnlBps > 0 ? 'text-green-400/70' : t.pnlBps < 0 ? 'text-red-400/70' : 'text-white/40'}`}>
                <span className="text-white/40">#{t.idx}</span>
                <span className="uppercase">{t.action}</span>
                <span>{t.asset}</span>
                <span>${t.price?.toFixed(2) || '—'}</span>
                <span>{t.pnlBps > 0 ? '+' : ''}{t.pnlBps}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Methodology */}
        <div className="mt-6 p-4 rounded-lg border border-white/[0.04] bg-white/[0.01]">
          <p className="text-[10px] text-white/20 leading-relaxed">
            <strong className="text-white/30">Data Source:</strong> All results from actual on-chain execution via ValidationRegistry contract. 
            Each decision goes through multi-agent consensus (GLM-5 analyst + Claude Sonnet 4.6 validator), 
            logged to Mantle L1 with IPFS reasoning anchoring. PnL measured at next decision cycle vs entry price.
            No simulation, no backtesting — pure live performance.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colors: Record<string, string> = {
    green: 'text-green-400', red: 'text-red-400', purple: 'text-purple-400',
    blue: 'text-blue-400', white: 'text-white/80',
  };
  return (
    <div className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
      <div className={`text-lg font-bold ${colors[color]}`}>{value}</div>
      <div className="text-[10px] text-white/30 uppercase">{label}</div>
    </div>
  );
}
