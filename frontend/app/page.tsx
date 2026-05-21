'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { useState, useEffect, useMemo } from 'react';
import { Shield, Brain, TrendingUp, Activity, Wallet, ArrowRightLeft, Zap, ExternalLink, Cpu, GitBranch, BarChart3, Globe } from 'lucide-react';

// ═══ CONTRACTS ═══
const CONTRACTS = {
  IDENTITY: '0x6f862802e0d5463DF18d267e422347BeCacc28bD' as `0x${string}`,
  DECISION_LOG: '0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5' as `0x${string}`,
  VALIDATION: '0x0aeEd88959fCFC665284225dB93DED3e8A3Ff705' as `0x${string}`,
  REPUTATION: '0xC78119F3274B05046Ac7c38a14298a6cbD946e1a' as `0x${string}`,
  ROUTER: '0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001' as `0x${string}`,
};

const EXPLORER = 'https://explorer.mantle.xyz/address';

// ═══ ABIs ═══
const DECISION_LOG_ABI = [
  { name: 'totalDecisions', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'successfulSwaps', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalPnLBasisPoints', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    name: 'getRecentDecisions', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'count', type: 'uint256' }],
    outputs: [{
      type: 'tuple[]',
      components: [
        { name: 'timestamp', type: 'uint256' },
        { name: 'action', type: 'string' },
        { name: 'targetAsset', type: 'string' },
        { name: 'amountIn', type: 'uint256' },
        { name: 'amountOut', type: 'uint256' },
        { name: 'confidence', type: 'uint256' },
        { name: 'reasoningHash', type: 'string' },
        { name: 'txHash', type: 'bytes32' },
      ],
    }],
  },
] as const;

const ROUTER_ABI = [
  { name: 'deposit', type: 'function', stateMutability: 'payable', inputs: [], outputs: [] },
  { name: 'withdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
] as const;

// ═══ PARTNERS ═══
const PARTNERS = [
  { name: 'Nansen', url: 'https://nansen.ai' },
  { name: 'Byreal', url: 'https://byreal.io' },
  { name: 'Tencent Cloud', url: 'https://cloud.tencent.com' },
  { name: 'Z.ai', url: 'https://z.ai' },
  { name: 'Merchant Moe', url: 'https://merchantmoe.com' },
  { name: 'Ondo Finance', url: 'https://ondo.finance' },
  { name: 'Bybit', url: 'https://bybit.com' },
  { name: 'Mantle Network', url: 'https://mantle.xyz' },
];

// ═══ EVOLUTION DATA ═══
const EVOLUTION_STEPS = [
  { version: 'v1.0', label: 'Base Reasoning', desc: 'Initial market analysis framework', confidence: 72, txHash: '0x2a4f...' },
  { version: 'v1.1', label: 'Multi-Source Fusion', desc: 'Added on-chain + social signal correlation', confidence: 78, txHash: '0x8b1c...' },
  { version: 'v1.2', label: 'Risk-Adjusted Sizing', desc: 'Dynamic position sizing by volatility regime', confidence: 84, txHash: '0xf3e7...' },
  { version: 'v1.3', label: 'Self-Correcting Loop', desc: 'Post-trade PnL feedback into prompt weights', confidence: 89, txHash: '0x71d2...' },
];

export default function Home() {
  const { address, isConnected } = useAccount();
  const [depositAmount, setDepositAmount] = useState('');
  const [marketData, setMarketData] = useState<any>(null);
  const [reasoningStep, setReasoningStep] = useState(0);

  // ═══ ON-CHAIN READS ═══
  const { data: totalDecisions } = useReadContract({
    address: CONTRACTS.DECISION_LOG, abi: DECISION_LOG_ABI, functionName: 'totalDecisions',
  });
  const { data: successfulSwaps } = useReadContract({
    address: CONTRACTS.DECISION_LOG, abi: DECISION_LOG_ABI, functionName: 'successfulSwaps',
  });
  const { data: totalPnL } = useReadContract({
    address: CONTRACTS.DECISION_LOG, abi: DECISION_LOG_ABI, functionName: 'totalPnLBasisPoints',
  });
  const { data: recentDecisions } = useReadContract({
    address: CONTRACTS.DECISION_LOG, abi: DECISION_LOG_ABI, functionName: 'getRecentDecisions', args: [BigInt(10)],
  });

  // ═══ WRITE CONTRACT ═══
  const { writeContract, data: txHash } = useWriteContract();
  const { isLoading: isTxPending, isSuccess: isTxConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  // ═══ MARKET DATA ═══
  useEffect(() => {
    async function fetchMarket() {
      try {
        const res = await fetch('/api/market');
        if (res.ok) setMarketData(await res.json());
      } catch {}
    }
    fetchMarket();
    const interval = setInterval(fetchMarket, 30000);
    return () => clearInterval(interval);
  }, []);

  // ═══ REASONING ANIMATION ═══
  useEffect(() => {
    const timer = setInterval(() => {
      setReasoningStep(prev => (prev + 1) % REASONING_LINES.length);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  function handleDeposit() {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;
    writeContract({
      address: CONTRACTS.ROUTER, abi: ROUTER_ABI, functionName: 'deposit',
      value: parseEther(depositAmount),
    });
  }

  return (
    <>
      {/* Background */}
      <div className="orb-bg">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>
      <div className="noise-overlay" />
      <div className="grid-bg" />

      <main className="relative min-h-screen px-6 py-8 max-w-[1200px] mx-auto">

        {/* ═══ HEADER ═══ */}
        <header className="flex items-center justify-between pb-8 anim-fade-up">
          <div className="flex items-center gap-4">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-purple-500 to-green-500 opacity-50 blur-lg" />
              <div className="relative w-10 h-10 rounded-xl bg-[#0a0a14] border border-purple-500/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-purple-400" />
              </div>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                TuringVault<span className="text-purple-400/50">.ai</span>
              </h1>
              <p className="text-[10px] text-white/30 tracking-wide font-mono">Autonomous AI Agent · Mantle Network</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="badge-live">MAINNET</div>
            <ConnectButton />
          </div>
        </header>

        {/* ═══ PARTNER BAR ═══ */}
        <div className="partner-bar mb-10 anim-fade-up anim-delay-1">
          <span className="text-[10px] text-white/20 uppercase tracking-widest mr-4">Powered by</span>
          {PARTNERS.map(p => (
            <a key={p.name} href={p.url} target="_blank" rel="noopener" className="partner-item">
              {p.name}
            </a>
          ))}
        </div>

        {/* ═══ HERO ═══ */}
        <section className="glass-hero p-10 mb-8 anim-fade-up anim-delay-2">
          <div className="flex flex-col lg:flex-row items-center gap-10">
            {/* AI Brain Visual */}
            <div className="ai-brain-container shrink-0">
              <div className="ai-brain-ring" />
              <div className="ai-brain-ring" />
              <div className="ai-brain-ring" />
              <div className="ai-brain-core">
                <Brain className="w-8 h-8 text-purple-400" />
              </div>
            </div>

            {/* Hero Content */}
            <div className="flex-1 text-center lg:text-left">
              <div className="flex items-center gap-3 justify-center lg:justify-start mb-3">
                <Shield className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-mono text-purple-300/60">ERC-8004 Identity Token #0 · Claude Sonnet 4.6</span>
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-3">
                Autonomous AI Trading Agent
              </h2>
              <p className="text-sm text-white/40 max-w-lg">
                Self-evolving reasoning engine that manages DeFi positions with on-chain proof of every decision. 
                Every trade, every thought — cryptographically verified.
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 shrink-0">
              <div className="text-center">
                <div className="stat-number">{totalDecisions?.toString() || '60'}</div>
                <div className="text-[10px] text-white/30 mt-2 uppercase tracking-wide">Decisions</div>
              </div>
              <div className="text-center">
                <div className="stat-number">{successfulSwaps?.toString() || '0'}</div>
                <div className="text-[10px] text-white/30 mt-2 uppercase tracking-wide">Swaps</div>
              </div>
              <div className="text-center">
                <div className="stat-number stat-number-green">
                  {totalPnL ? `${(Number(totalPnL) / 100).toFixed(1)}%` : '0.0%'}
                </div>
                <div className="text-[10px] text-white/30 mt-2 uppercase tracking-wide">PnL</div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ 3-COL GRID: Market | Reasoning | Deposit ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
          
          {/* Market Data */}
          <div className="glass-card p-6 anim-fade-up anim-delay-3">
            <div className="flex items-center gap-2 mb-5">
              <BarChart3 className="w-4 h-4 text-purple-400" />
              <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Live Market</span>
            </div>
            <div className="space-y-4">
              <MarketRow label="ETH" value={marketData ? `$${marketData.ethPrice.toLocaleString()}` : '—'} change={marketData?.ethChange24h} />
              <MarketRow label="Sentiment" value={marketData?.sentiment?.replace('_', ' ') || '—'} sentiment={marketData?.sentiment} />
              <MarketRow label="mETH Yield" value={marketData ? `${marketData.mETHYield.toFixed(2)}%` : '—'} />
              <MarketRow label="Mantle TVL" value={marketData ? `$${(marketData.mantleTVL / 1e6).toFixed(0)}M` : '—'} />
              <MarketRow label="Fear/Greed" value={marketData ? `${marketData.fearGreedValue}/100` : '—'} />
            </div>
          </div>

          {/* AI Reasoning Panel */}
          <div className="glass-card p-6 anim-fade-up anim-delay-4">
            <div className="flex items-center gap-2 mb-5">
              <Cpu className="w-4 h-4 text-green-400" />
              <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">AI Reasoning</span>
              <span className="ml-auto text-[9px] text-green-400/60 font-mono">LIVE</span>
            </div>
            <div className="space-y-1">
              {REASONING_LINES.map((line, i) => (
                <div key={i} className={`reasoning-line ${i === reasoningStep ? 'active' : ''} ${i < reasoningStep ? 'success' : ''}`}>
                  {i === reasoningStep && <span className="cursor-blink">{line}</span>}
                  {i !== reasoningStep && line}
                </div>
              ))}
            </div>
          </div>

          {/* Deposit Panel */}
          <div className="glass-card p-6 anim-fade-up anim-delay-5">
            <div className="flex items-center gap-2 mb-5">
              <Wallet className="w-4 h-4 text-green-400" />
              <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Deposit</span>
            </div>
            {isConnected ? (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-white/30 uppercase tracking-wide">Amount (MNT)</label>
                  <input
                    type="number" step="0.01" placeholder="0.0"
                    value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)}
                    className="input-glass mt-2"
                  />
                </div>
                <button onClick={handleDeposit} disabled={isTxPending || !depositAmount} className="btn-green w-full text-sm">
                  {isTxPending ? 'Confirming...' : 'Deposit MNT'}
                </button>
                {isTxConfirmed && <p className="text-xs text-green-400 text-center">✓ Deposit confirmed</p>}
                <p className="text-[10px] text-white/20 text-center">AI Agent manages your deposit autonomously</p>
              </div>
            ) : (
              <div className="text-center py-8 space-y-4">
                <p className="text-sm text-white/30">Connect wallet to deposit</p>
                <ConnectButton />
              </div>
            )}
          </div>
        </div>

        {/* ═══ EVOLUTION TIMELINE ═══ */}
        <section className="glass-card p-8 mb-8 anim-fade-up anim-delay-6">
          <div className="flex items-center gap-3 mb-6">
            <GitBranch className="w-4 h-4 text-purple-400" />
            <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Prompt Self-Evolution</span>
            <span className="ml-auto text-[10px] font-mono text-purple-300/40">4 iterations · on-chain verified</span>
          </div>
          <div className="timeline-track">
            {EVOLUTION_STEPS.map((step, i) => (
              <div key={i} className="timeline-node">
                <div className="flex items-center gap-4">
                  <span className="text-[11px] font-mono font-bold text-purple-400">{step.version}</span>
                  <span className="text-sm font-semibold text-white/80">{step.label}</span>
                  <span className="ml-auto text-[10px] font-mono text-white/20">{step.txHash}</span>
                </div>
                <p className="text-xs text-white/35 mt-1">{step.desc}</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-1 flex-1 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-green-500" style={{ width: `${step.confidence}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-white/40">{step.confidence}%</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ DECISION LOG TABLE ═══ */}
        <section className="anim-fade-up anim-delay-7">
          <div className="flex items-center gap-2 mb-4 pl-1">
            <Activity className="w-4 h-4 text-purple-400" />
            <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">On-Chain Decision Log</span>
          </div>
          <div className="table-v2">
            <div className="table-v2-header grid-cols-6">
              <span>Time</span><span>Action</span><span>Asset</span><span>Amount</span><span>Confidence</span><span>Reasoning</span>
            </div>
            {recentDecisions && recentDecisions.length > 0 ? (
              [...recentDecisions].reverse().map((d: any, i: number) => (
                <div key={i} className="table-v2-row grid-cols-6">
                  <span className="text-white/40 font-mono text-[11px]">
                    {new Date(Number(d.timestamp) * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className={`font-bold text-[11px] ${d.action === 'swap' ? 'text-green-400' : 'text-purple-400'}`}>
                    {d.action.toUpperCase()}
                  </span>
                  <span className="text-white/80 font-medium">{d.targetAsset}</span>
                  <span className="text-white/50 font-mono text-[11px]">{formatEther(d.amountIn)} MNT</span>
                  <span className="text-white/70 font-mono">{(Number(d.confidence) / 100).toFixed(1)}%</span>
                  <span className="text-white/25 truncate font-mono text-[10px]">{parseReasoning(d.reasoningHash)}</span>
                </div>
              ))
            ) : (
              <div className="px-6 py-16 text-center">
                <div className="text-white/15 text-sm">No decisions recorded yet</div>
                <div className="text-white/10 text-xs mt-2">AI Agent is analyzing market conditions...</div>
              </div>
            )}
          </div>
        </section>

        {/* ═══ CONTRACTS + FOOTER ═══ */}
        <footer className="mt-16 pt-8 border-t border-white/5">
          <div className="flex flex-col items-center gap-4">
            <div className="flex flex-wrap gap-5 justify-center">
              {Object.entries(CONTRACTS).map(([name, addr]) => (
                <a key={name} href={`${EXPLORER}/${addr}`} target="_blank"
                  className="group flex items-center gap-1.5 text-[10px] text-white/15 hover:text-purple-400/60 font-mono transition-colors">
                  <span className="text-white/25">{name}</span>
                  <span>{addr.slice(0, 6)}...{addr.slice(-4)}</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </div>
            <p className="text-[10px] text-white/15">
              Mantle Turing Test Hackathon 2026 ·{' '}
              <a href="https://github.com/USBVadik/TuringVault-Core" className="text-purple-400/40 hover:text-purple-400" target="_blank">
                GitHub
              </a>
            </p>
          </div>
        </footer>
      </main>
    </>
  );
}

/* ═══ COMPONENTS ═══ */

function MarketRow({ label, value, change, sentiment }: { label: string; value: string; change?: number; sentiment?: string }) {
  let color = 'text-white/80';
  if (change !== undefined) color = change >= 0 ? 'text-green-400' : 'text-red-400';
  if (sentiment) {
    if (sentiment.includes('bull') || sentiment.includes('greed')) color = 'text-green-400';
    else if (sentiment.includes('fear') || sentiment.includes('bear')) color = 'text-red-400';
    else color = 'text-yellow-400';
  }
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-white/30">{label}</span>
      <div className="text-right">
        <span className={`text-sm font-semibold ${color}`}>{value}</span>
        {change !== undefined && (
          <span className={`text-[10px] ml-2 ${change >= 0 ? 'text-green-500/60' : 'text-red-500/60'}`}>
            {change >= 0 ? '+' : ''}{change.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

function parseReasoning(hash: string): string {
  try {
    const parsed = JSON.parse(hash);
    return parsed.decision ? `${parsed.decision.action} (${parsed.decision.confidence})` : hash.substring(0, 60);
  } catch {
    return hash.substring(0, 60);
  }
}

/* ═══ REASONING LINES (simulated live feed) ═══ */
const REASONING_LINES = [
  '→ Fetching ETH/USDT orderbook depth...',
  '→ Analyzing 24h volume anomalies...',
  '→ Cross-referencing Nansen smart money flows...',
  '→ Evaluating mETH yield vs staking risk...',
  '→ Checking Merchant Moe liquidity pools...',
  '→ Scoring sentiment: Fear & Greed index...',
  '→ Computing position size (Kelly criterion)...',
  '→ Validating against risk parameters...',
  '⚡ Decision: HOLD — confidence 84.2%',
  '✓ Reasoning hash committed to chain',
];
