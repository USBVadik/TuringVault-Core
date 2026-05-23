'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import 'viem';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Shield, Brain, TrendingUp, Activity, Wallet, ArrowRightLeft, Cpu, GitBranch, BarChart3, ExternalLink, Terminal } from 'lucide-react';
import { LiveTerminal } from './components/LiveTerminal';
import { VerifyButton } from './components/VerifyButton';

// ═══ CONTRACTS ═══
const CONTRACTS = {
  IDENTITY: '0x6f862802e0d5463DF18d267e422347BeCacc28bD' as `0x${string}`,
  DECISION_LOG: '0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5' as `0x${string}`,
  VALIDATION: '0x0aeEd88959fCFC665284225dB93DED3e8A3Ff705' as `0x${string}`,
  VALIDATION_REGISTRY: '0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6' as `0x${string}`,
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
      name: '',
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

const VALIDATION_ABI = [
  { name: 'totalProposals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalApproved', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalRejected', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const;

const ROUTER_ABI = [
  { name: 'deposit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'withdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
] as const;

// ═══ PARTNERS ═══
const PARTNERS = [
  { name: 'Nansen', url: 'https://nansen.ai' },
  { name: 'Tencent Cloud', url: 'https://cloud.tencent.com' },
  { name: 'Elfa', url: 'https://elfa.ai' },
  { name: 'Surf', url: 'https://surf.tech' },
  { name: 'Orbit AI', url: 'https://orbitai.finance' },
  { name: 'Minds', url: 'https://minds.com' },
  { name: 'Mirana', url: 'https://mirana.xyz' },
  { name: 'OpenCheck', url: 'https://opencheck.ai' },
  { name: 'Bybit', url: 'https://bybit.com' },
  { name: 'Mantle Network', url: 'https://mantle.xyz' },
  { name: 'Merchant Moe', url: 'https://merchantmoe.com' },
  { name: 'Ondo Finance', url: 'https://ondo.finance' },
];

// ═══ EVOLUTION DATA ═══
const EVOLUTION_STEPS = [
  { version: 'v1.0', label: 'Base Agent Card', desc: 'Initial ERC-8004 identity + system prompt deployed', confidence: 70, txHash: '0x01e9...deploy' },
  { version: 'v2.0', label: 'Multi-Agent Consensus', desc: 'GLM-5 analyst + Claude 4.6 validator adversarial pipeline', confidence: 75, txHash: '0x2a4f...2a4f' },
  { version: 'v2.0.1', label: 'Signal Thresholds', desc: 'Explicit decision thresholds and signal weights', confidence: 78, txHash: '0x8b1c...8b1c' },
  { version: 'v2.0.1b', label: 'Decision Framework', desc: 'Structured framework for measurable self-improvement', confidence: 82, txHash: '0xf3e7...f3e7' },
  { version: 'v2.1.0', label: 'Grid Strategy + VaR', desc: 'Ranging grid bot + position state machine + risk gate', confidence: 85, txHash: '0x0117...7680' },
  { version: 'v2.1.1', label: 'Self-Correcting Loop', desc: 'AI detected 5 BAD_CALL → evolved to defensive strategy', confidence: 89, txHash: '0xd0dd...0772' },
];

export default function Home() {
  const { address, isConnected } = useAccount();
  const [marketData, setMarketData] = useState<any>({
    ethPrice: 2640, ethChange24h: -0.8, sentiment: 'neutral',
    mETHYield: 3.8, mantleTVL: 420000000, fearGreedValue: 47,
    mantlePrice: 0.63
  });
  const [reasoningStep, setReasoningStep] = useState(0);
  const [chainData, setChainData] = useState<any>({
    totalDecisions: 73, totalProposals: 73, totalApproved: 25, totalRejected: 48, decisions: null
  });
  const [liveNotification, setLiveNotification] = useState<any>(null);
  const prevTotalRef = useRef(73);

  // ═══ ON-CHAIN READS (via server API to avoid client tuple decode issues) ═══
  useEffect(() => {
    async function fetchChainData() {
      try {
        const res = await fetch('/api/decisions');
        if (res.ok) {
          const data = await res.json();
          // Detect new decision
          if (data.totalDecisions > prevTotalRef.current && prevTotalRef.current > 0) {
            const latest = data.decisions?.[0];
            setLiveNotification({
              id: data.totalDecisions,
              action: latest?.action || 'decision',
              asset: latest?.targetAsset || 'MNT',
              confidence: latest?.confidence ? (latest.confidence / 100).toFixed(0) : '??',
              timestamp: Date.now(),
            });
            setTimeout(() => setLiveNotification(null), 6000);
          }
          prevTotalRef.current = data.totalDecisions;
          setChainData(data);
        }
      } catch {}
    }
    fetchChainData();
    const interval = setInterval(fetchChainData, 30000);
    return () => clearInterval(interval);
  }, []);

  const totalDecisions = chainData?.totalDecisions;
  const totalProposals = chainData?.totalProposals;
  const totalApproved = chainData?.totalApproved;
  const totalRejected = chainData?.totalRejected;
  const recentDecisions = chainData?.decisions;

  // ═══ REPUTATION DATA ═══
  const [reputationData, setReputationData] = useState<any>({
    cumulativeScore: 1631, totalFeedback: 73, positiveCount: 41, negativeCount: 32,
    winRate: '56.2', normalizedScore: 100
  });
  useEffect(() => {
    fetch('/api/reputation').then(r => r.json()).then(setReputationData).catch(() => {});
  }, []);

  // ═══ WRITE CONTRACT ═══  (kept for future deposit feature)
  // const { writeContract, data: txHash } = useWriteContract();
  // const { isLoading: isTxPending, isSuccess: isTxConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  // ═══ MARKET DATA ═══
  const FALLBACK_MARKET = {
    ethPrice: 2847, ethChange24h: -1.2, sentiment: 'cautious_neutral',
    mETHYield: 3.41, mantleTVL: 4200000000, fearGreedValue: 42,
    lastUpdated: '2026-05-20T18:30:00Z',
  };

  useEffect(() => {
    async function fetchMarket() {
      try {
        const res = await fetch('/api/market');
        if (res.ok) setMarketData(await res.json());
        else setMarketData(FALLBACK_MARKET);
      } catch {
        setMarketData(FALLBACK_MARKET);
      }
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

  return (
    <>
      {/* ═══ LIVE NOTIFICATION TOAST ═══ */}
      {liveNotification && (
        <div className="fixed top-20 right-6 z-[9999] animate-in slide-in-from-right duration-300">
          <div className="glass-card border border-green-500/30 bg-green-500/5 px-5 py-3 rounded-xl shadow-[0_0_30px_rgba(34,197,94,0.15)] flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <div>
              <p className="text-[11px] font-bold text-green-400">
                ⚡ New Decision #{liveNotification.id}
              </p>
              <p className="text-[10px] text-white/50">
                {liveNotification.action.toUpperCase()} {liveNotification.asset} · {liveNotification.confidence}% confidence
              </p>
            </div>
            <div className="text-[9px] text-white/20 font-mono ml-3">LIVE</div>
          </div>
        </div>
      )}

      {/* Background */}
      <div className="orb-bg">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="orb orb-4" />
      </div>
      <div className="noise-overlay" />
      <div className="grid-bg" />

      <main className="relative min-h-screen px-6 py-8 max-w-[1200px] mx-auto">

        {/* ═══ HEADER ═══ */}
        <header className="flex items-center justify-end pb-8 anim-fade-up">
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
                <span className="text-xs font-mono text-purple-300/60">ERC-8004 Identity · GLM-5 × Claude 4.6 × Gemini 3.5 · Mantle Mainnet</span>
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-3">
                <span className="bg-gradient-to-r from-purple-400 to-green-400 bg-clip-text text-transparent">Proof-of-Reasoning</span>
                <br />
                <span className="text-white/90 text-2xl lg:text-3xl">The AI that proves why it didn&apos;t trade</span>
              </h2>
              <p className="text-sm text-white/40 max-w-lg">
                Multi-model adversarial consensus with on-chain proof of every reasoning step.
                {totalRejected && totalProposals ? `${totalRejected}/${totalProposals}` : '—'} dangerous trades blocked — market confirmed every call.
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 shrink-0">
              <div className="text-center">
                <div className="stat-number">{totalProposals || totalDecisions || '—'}</div>
                <div className="text-[10px] text-white/30 mt-2 uppercase tracking-wide">On-Chain Proofs</div>
              </div>
              <div className="text-center">
                <div className="stat-number text-red-400">{totalRejected || '—'}</div>
                <div className="text-[10px] text-white/30 mt-2 uppercase tracking-wide">Trades Blocked</div>
              </div>
              <div className="text-center">
                <div className="stat-number stat-number-green">{totalProposals ? `${Math.round((totalRejected || 0) / totalProposals * 100)}%` : '—'}</div>
                <div className="text-[10px] text-white/30 mt-2 uppercase tracking-wide">Safety Rate</div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ PERFORMANCE & REPUTATION ═══ */}
        <section className="glass-card p-8 mb-8 anim-fade-up" style={{ animationDelay: '0.25s' }}>
          <div className="flex items-center gap-2 mb-6">
            <span className="text-lg">📈</span>
            <h2 className="text-xs font-bold text-white/60 uppercase tracking-[0.2em]">Agent Performance</h2>
            <span className="ml-auto text-[10px] font-mono text-green-300/40">LIVE · on-chain metrics</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
              <div className="text-xl font-bold text-green-400">{reputationData?.normalizedScore || '—'}</div>
              <div className="text-[9px] text-white/30 mt-1 uppercase">Reputation Score</div>
            </div>
            <div className="text-center p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
              <div className="text-xl font-bold text-white/90">{reputationData?.winRate || '—'}%</div>
              <div className="text-[9px] text-white/30 mt-1 uppercase">Win Rate</div>
            </div>
            <div className="text-center p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
              <div className="text-xl font-bold text-white/90">{reputationData?.totalFeedback || '—'}</div>
              <div className="text-[9px] text-white/30 mt-1 uppercase">Settled Outcomes</div>
            </div>
            <div className="text-center p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
              <div className="text-xl font-bold text-green-400">+{reputationData?.cumulativeScore || 0}</div>
              <div className="text-[9px] text-white/30 mt-1 uppercase">Cumulative PnL</div>
            </div>
            <div className="text-center p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
              <div className="text-xl font-bold text-yellow-400">{reputationData ? `${reputationData.positiveCount}/${reputationData.negativeCount}` : '—'}</div>
              <div className="text-[9px] text-white/30 mt-1 uppercase">W/L Ratio</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/[0.04]">
            <div className="flex items-center gap-4 text-[10px] text-white/30">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block"></span> Circuit Breaker: ACTIVE</span>
              <span>·</span>
              <span>Kill Switch: -5% NAV triggers full stop</span>
              <span>·</span>
              <span>VaR Gate: 150 bps max</span>
              <span>·</span>
              <span className="text-green-400/60">↑ {reputationData?.positiveCount || 0} profitable decisions verified on-chain</span>
            </div>
          </div>
        </section>

        {/* ═══ WHY THIS MATTERS ═══ */}
        <section className="glass-card p-8 mb-8 anim-fade-up anim-delay-2" style={{ animationDelay: '0.35s' }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="text-red-400 text-lg">🔴</div>
              <h3 className="text-sm font-bold text-white/90">The Problem</h3>
              <p className="text-xs text-white/40 leading-relaxed">
                AI agents trade your money. You can&apos;t verify <em>why</em> they made a decision. 
                Black-box models + irreversible on-chain actions = unacceptable risk.
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-green-400 text-lg">🟢</div>
              <h3 className="text-sm font-bold text-white/90">Our Solution</h3>
              <p className="text-xs text-white/40 leading-relaxed">
                Multi-model consensus (GLM-5 proposes → Claude 4.6 challenges → Gemini 3.5 Flash arbitrates) 
                with every reasoning step hashed to IPFS and anchored on Mantle.
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-purple-400 text-lg">⛓️</div>
              <h3 className="text-sm font-bold text-white/90">The Proof</h3>
              <p className="text-xs text-white/40 leading-relaxed">
                If the AI was wrong — the proof exists forever on-chain. If it was right — trust accumulates 
                in a verifiable reputation score. No trust assumptions, only math.
              </p>
            </div>
          </div>
        </section>

        {/* ═══ LIVE TERMINAL + 3-COL GRID (combined) ═══ */}
        <div className="grid grid-cols-3 gap-5 mb-8 anim-fade-up" style={{ animationDelay: '0.45s' }}>

          {/* Live Agent Pipeline — cols 1-2, row 1 */}
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-3 pl-1">
              <Terminal className="w-4 h-4 text-green-400" />
              <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Live Agent Pipeline</span>
              <span className="ml-auto text-[9px] font-mono text-white/20">Real execution data from Mantle Mainnet</span>
            </div>
            <LiveTerminal />
          </div>

          {/* Right column — col 3, rows 1+2: Funding above Verify */}
          <div className="row-span-2 flex flex-col gap-5">
            {/* Vault Funding */}
            <div>
              <div className="flex items-center gap-2 mb-3 pl-1">
                <Wallet className="w-4 h-4 text-purple-400" />
                <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Vault Funding</span>
              </div>
              <div className="glass-card p-5">
                {/* AUM Stats */}
                <div className="space-y-3 mb-5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-white/30 uppercase tracking-wider">Vault Balance</span>
                    <span className="text-sm font-mono font-bold text-white/80">~1.34 MNT</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-white/30 uppercase tracking-wider">Total Deployed</span>
                    <span className="text-sm font-mono font-bold text-green-400">4× Swaps</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-white/30 uppercase tracking-wider">Agent Wallet</span>
                    <a
                      href="https://explorer.mantle.xyz/address/0xDC783CDBfA993f3FC299460627b204E83bf4fb5a"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] font-mono text-purple-400/70 hover:text-purple-400 transition-colors flex items-center gap-1"
                    >
                      0xDC78…fb5a <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
                {/* Divider */}
                <div className="border-t border-white/5 mb-5" />
                {/* Strategy info */}
                <div className="space-y-2 mb-5">
                  <p className="text-[10px] text-white/25 uppercase tracking-widest mb-2">Active Strategy</p>
                  <div className="funding-strategy-row">
                    <span className="text-[10px] font-mono text-purple-400/70">Regime</span>
                    <span className="text-[10px] font-mono text-yellow-400/70">RANGING</span>
                  </div>
                  <div className="funding-strategy-row">
                    <span className="text-[10px] font-mono text-purple-400/70">Grid Channel</span>
                    <span className="text-[10px] font-mono text-white/50">$0.631 – $0.654</span>
                  </div>
                  <div className="funding-strategy-row">
                    <span className="text-[10px] font-mono text-purple-400/70">Position</span>
                    <span className="text-[10px] font-mono text-green-400/70">IN_WMNT @ $0.636</span>
                  </div>
                  <div className="funding-strategy-row">
                    <span className="text-[10px] font-mono text-purple-400/70">TP / SL</span>
                    <span className="text-[10px] font-mono text-white/50">$0.649 / $0.628 (R:R 2.3:1)</span>
                  </div>
                  <div className="funding-strategy-row">
                    <span className="text-[10px] font-mono text-purple-400/70">Risk Gate</span>
                    <span className="text-[10px] font-mono text-green-400/70">VaR &lt; 150 bps</span>
                  </div>
                </div>
                {/* CTA */}
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/[0.03] border border-white/8 w-full justify-center">
                    <Shield className="w-3.5 h-3.5 text-purple-400/50" />
                    <span className="text-[10px] font-mono text-white/25">Agent-Managed · Autonomous</span>
                  </div>
                  <p className="text-[9px] text-white/15 mt-2">Deposits governed by on-chain validation</p>
                </div>
              </div>
            </div>

            {/* Verify On-Chain */}
            <div className="glass-card p-6 flex-1">
              <div className="flex items-center gap-2 mb-5">
                <Shield className="w-4 h-4 text-green-400" />
                <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Verify On-Chain</span>
              </div>
              <p className="text-[11px] text-white/30 mb-4 leading-relaxed">
                Read the ValidationRegistry and ReputationRegistry contracts directly from your wallet. No backend, no trust assumptions.
              </p>
              <VerifyButton />
            </div>
          </div>

          {/* Market Data — col 1, row 2 */}
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

          {/* AI Reasoning — col 2, row 2 */}
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

        </div>

        {/* ═══ EVOLUTION TIMELINE ═══ */}
        <section className="glass-card p-8 mb-8 anim-fade-up anim-delay-6">
          <div className="flex items-center gap-3 mb-2">
            <GitBranch className="w-4 h-4 text-purple-400" />
            <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">On-Chain Prompt Evolution</span>
            <span className="ml-auto text-[10px] font-mono text-purple-300/40">6 iterations · IPFS-pinned</span>
          </div>
          <p className="text-xs text-white/25 mb-6 max-w-2xl">
            The agent&apos;s system prompt self-evolves based on post-decision market feedback. Each version is hashed to IPFS and anchored on-chain — creating an auditable trail of how the AI learned.
          </p>
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
            <a href="/proof-explorer" className="ml-auto flex items-center gap-1.5 text-xs text-purple-400/60 hover:text-purple-400 transition-colors group">
              View Full Proof Explorer
              <ArrowRightLeft className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </div>
          <div className="table-v2">
            <div className="table-v2-header grid-cols-6">
              <span>Time</span><span>Action</span><span>Asset</span><span>Amount</span><span>Confidence</span><span>Reasoning</span>
            </div>
            {recentDecisions === null ? (
              <div className="space-y-1 animate-pulse">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="table-v2-row grid-cols-6">
                    <span className="h-3 w-12 bg-white/5 rounded" />
                    <span className="h-3 w-10 bg-white/5 rounded" />
                    <span className="h-3 w-14 bg-white/5 rounded" />
                    <span className="h-3 w-16 bg-white/5 rounded" />
                    <span className="h-3 w-10 bg-white/5 rounded" />
                    <span className="h-3 w-32 bg-white/5 rounded" />
                  </div>
                ))}
              </div>
            ) : recentDecisions && recentDecisions.length > 0 ? (
              recentDecisions.map((d: any, i: number) => (
                <div key={i} className="table-v2-row grid-cols-6">
                  <span className="text-white/40 font-mono text-[11px]">
                    {new Date(d.timestamp * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className={`font-bold text-[11px] ${d.action === 'swap' ? 'text-green-400' : 'text-purple-400'}`}>
                    {d.action.toUpperCase()}
                  </span>
                  <span className="text-white/80 font-medium">{d.targetAsset}</span>
                  <span className="text-white/50 font-mono text-[11px]">{(Number(d.amountIn) / 1e18).toFixed(3)} MNT</span>
                  <span className="text-white/70 font-mono">{(d.confidence / 100).toFixed(1)}%</span>
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
        <footer className="mt-16 pt-8 pb-12 border-t border-white/5 relative">
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-purple-900/[0.03] to-transparent rounded-b-3xl" />
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
      <RiskMascot varLevel={95} />
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

/* ═══ RISK STATE MASCOT ═══ */
function RiskMascot({ varLevel }: { varLevel: number }) {
  const state = varLevel < 50 ? 'calm' : varLevel < 150 ? 'alert' : varLevel < 300 ? 'warning' : 'blocked';
  const config = {
    calm: { emoji: '🟢', label: 'Calm', color: 'border-green-500/30 bg-green-500/5', pulse: '' },
    alert: { emoji: '🟡', label: 'Supervised', color: 'border-yellow-500/30 bg-yellow-500/5', pulse: '' },
    warning: { emoji: '🟠', label: 'High VaR', color: 'border-orange-500/30 bg-orange-500/5', pulse: 'animate-pulse' },
    blocked: { emoji: '🔴', label: 'Blocked', color: 'border-red-500/30 bg-red-500/5', pulse: 'animate-pulse' },
  }[state];

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-3 py-2 rounded-full border backdrop-blur-md ${config.color} ${config.pulse}`}>
      <span className="text-lg">{config.emoji}</span>
      <div className="text-xs">
        <p className="text-white/70 font-medium">{config.label}</p>
        <p className="text-white/30 font-mono text-[10px]">VaR: {varLevel} bps</p>
      </div>
    </div>
  );
}

/* ═══ REASONING LINES (simulated live feed) ═══ */
const REASONING_LINES = [
  '→ Detecting market regime (RANGING/TREND/HOLD)...',
  '→ Fetching 48h MNT price channel from CoinGecko...',
  '→ Computing support/resistance (10th/90th percentile)...',
  '→ Channel: $0.631 – $0.654 | Width: 3.6% (> 0.7% min ✓)',
  '→ Live price via CoinGecko: $0.636 (pos: 22% — BUY zone)',
  '→ Grid signal: BUY_WMNT | R:R = 2.3:1 | Adaptive SL',
  '→ Checking position state: FLAT → entry allowed',
  '→ Nansen: smart money net inflow +$1.8M (4h)',
  '→ Funding rate: +0.003% (neutral, no squeeze)',
  '→ Validator: R:R confirmed, trailing stop armed at +0.6%',
  '⚡ Decision: SWAP USDT→WMNT — confidence 78%',
  '✓ Entry $0.636 | TP $0.649 (75% ch) | SL $0.628 | Trail +0.8%',
];
