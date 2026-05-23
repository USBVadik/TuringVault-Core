'use client';

import { useState, useEffect } from 'react';

export default function BacktestPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/backtest').then(r => r.json()).then(setData);
  }, []);

  if (!data) return <div className="min-h-screen bg-[#0a0a0f] text-white p-8 flex items-center justify-center"><span className="animate-pulse text-white/30">Loading backtest...</span></div>;

  const { summary, equityCurve, trades } = data;
  const maxNav = Math.max(...equityCurve.map((p: any) => p.nav));
  const minNav = Math.min(...equityCurve.map((p: any) => p.nav));

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-8">
      <div className="max-w-5xl mx-auto">
        <a href="/" className="text-xs text-white/30 hover:text-white/60 mb-4 block">← Back to Dashboard</a>
        <h1 className="text-3xl font-bold mb-2">📊 Backtest Results</h1>
        <p className="text-white/40 text-sm mb-8">30-day simulated performance · ETH ranging channel {summary.channel}</p>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard label="Total Return" value={`+${summary.totalReturn}%`} color="green" />
          <StatCard label="Sharpe Ratio" value={summary.sharpe.toFixed(2)} color="purple" />
          <StatCard label="Max Drawdown" value={`-${summary.maxDrawdown}%`} color="red" />
          <StatCard label="Win Rate" value={`${summary.winRate}%`} color="blue" />
          <StatCard label="Total Trades" value={summary.totalTrades} color="white" />
          <StatCard label="Avg Trade" value={`+${summary.avgTradeReturn}%`} color="green" />
          <StatCard label="ETH Hold" value={`${summary.ethHold}%`} color="red" />
          <StatCard label="Alpha vs Hold" value={`+${(summary.totalReturn - summary.ethHold).toFixed(1)}%`} color="green" />
        </div>

        {/* Equity Curve */}
        <div className="p-6 rounded-lg border border-white/[0.06] bg-white/[0.02] mb-6">
          <h3 className="text-xs font-bold text-white/60 uppercase mb-4">Equity Curve (normalized $100 start)</h3>
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
              {equityCurve.filter((p: any) => p.trade).map((p: any, i: number) => {
                const idx = equityCurve.indexOf(p);
                const y = 100 - ((p.nav - minNav) / (maxNav - minNav)) * 90 - 5;
                return <circle key={i} cx={idx} cy={y} r="1.5" fill={p.trade === 'BUY' ? '#4ade80' : '#f87171'} />;
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
            <div className="absolute top-0 left-0 text-[9px] text-white/20">${maxNav.toFixed(0)}</div>
            <div className="absolute bottom-0 left-0 text-[9px] text-white/20">${minNav.toFixed(0)}</div>
            <div className="absolute top-0 right-0 text-[9px] text-white/20">Day 30</div>
            <div className="absolute bottom-0 right-2 text-[9px] text-green-400/60">
              ● BUY &nbsp; <span className="text-red-400/60">● SELL</span>
            </div>
          </div>
        </div>

        {/* Trade Table */}
        <div className="p-6 rounded-lg border border-white/[0.06] bg-white/[0.02]">
          <h3 className="text-xs font-bold text-white/60 uppercase mb-4">Recent Trades (sample)</h3>
          <div className="space-y-1 font-mono text-xs">
            <div className="grid grid-cols-5 text-white/30 pb-2 border-b border-white/[0.04]">
              <span>HOUR</span><span>TYPE</span><span>ENTRY</span><span>EXIT</span><span>PNL</span>
            </div>
            {trades.map((t: any, i: number) => (
              <div key={i} className={`grid grid-cols-5 py-1 ${t.pnl > 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                <span className="text-white/40">h{t.hour}</span>
                <span>{t.type}</span>
                <span>${t.entry}</span>
                <span>${t.exit}</span>
                <span>{t.pnl > 0 ? '+' : ''}{t.pnl.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Methodology */}
        <div className="mt-6 p-4 rounded-lg border border-white/[0.04] bg-white/[0.01]">
          <p className="text-[10px] text-white/20 leading-relaxed">
            <strong className="text-white/30">Methodology:</strong> Ranging grid strategy backtested over 720 hourly candles (30 days). 
            Buy zone: bottom 30% of channel. Sell zone: top 70%. Adaptive SL with trailing stop. 
            Slippage: 0.15% (MerchantMoe v2.2). Gas: $0.02/swap (Mantle L2). 
            No look-ahead bias — channel computed from rolling 48h lookback window.
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
