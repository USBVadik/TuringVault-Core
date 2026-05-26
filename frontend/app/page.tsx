'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Shield, Brain, TrendingUp, Activity, Wallet, ArrowRightLeft, Cpu, GitBranch, BarChart3, ExternalLink, Terminal } from 'lucide-react';
import { LiveTerminal } from './components/LiveTerminal';
import { VerifyButton } from './components/VerifyButton';
import { RiskMascot } from './components/RiskMascot';
import { RelativeTime } from './lib/time';
import contractsData from './data/contracts.json';

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
// Honesty rule (.kiro/steering/no-lying-about-state.md §5) — every entry must
// have a verifiable code path. Removed: Tencent Cloud (KMS = simulate stub),
// Elfa (replaced when Elfa client lives in src/data/elfa.js), Surf, OpenCheck,
// Orbit AI, Minds, Mirana — all had zero code paths.
const PARTNERS = [
  { name: 'Mantle Network', url: 'https://mantle.xyz' },
  { name: 'Z.ai', url: 'https://z.ai' },
  { name: 'Anthropic', url: 'https://anthropic.com' },
  { name: 'Google', url: 'https://cloud.google.com/vertex-ai' },
  { name: 'Nansen', url: 'https://nansen.ai' },
  { name: 'Elfa', url: 'https://elfa.ai' },
  { name: 'Merchant Moe', url: 'https://merchantmoe.com' },
  { name: 'Ondo Finance', url: 'https://ondo.finance' },
  { name: 'Bybit', url: 'https://bybit.com' },
  { name: 'Pinata', url: 'https://pinata.cloud' },
];

// ═══ EVOLUTION TIMELINE removed in T14 (ui-honesty-pass) ═══
// Previous EVOLUTION_STEPS contained fabricated tx hashes and claimed
// on-chain anchoring that did not exist. Real prompt evolution
// (src/evolution/promptEvolution.js) is currently disabled at runtime
// because evolved prompts cause format instability — see
// multiAgent.js where activeAnalystPrompt = ANALYST_SYSTEM_PROMPT.
// Re-enabling is tracked in spec agent-reasoning-quality.

export default function Home() {
  const { address, isConnected } = useAccount();
  const [marketData, setMarketData] = useState<any>(null);
  const [reasoningStep, setReasoningStep] = useState(0);
  const [chainData, setChainData] = useState<any>(null);
  const [liveNotification, setLiveNotification] = useState<any>(null);
  const prevTotalRef = useRef(0);

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
  const [reputationData, setReputationData] = useState<any>(null);
  useEffect(() => {
    fetch('/api/reputation').then(r => r.json()).then(setReputationData).catch(() => {});
  }, []);

  // ═══ AGENT CARD (T9) ═══
  const [agentCard, setAgentCard] = useState<any>(null);
  useEffect(() => {
    fetch('/api/agent-card').then(r => r.ok ? r.json() : null).then(setAgentCard).catch(() => {});
  }, []);

  // ═══ AGENT HEALTH (T13) ═══
  const [health, setHealth] = useState<any>(null);
  useEffect(() => {
    let cancelled = false;
    async function fetchHealth() {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        if (!cancelled) setHealth(res.ok ? await res.json() : null);
      } catch {
        if (!cancelled) setHealth(null);
      }
    }
    fetchHealth();
    const id = setInterval(fetchHealth, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);
  const isStale = health?.lastCycleAge != null && health.lastCycleAge > 600;

  // Compose hero badge text from card; fallback to generic when card unavailable
  const heroBadge = (() => {
    const m = agentCard?.models;
    const a = m?.analyst?.model;
    const v = m?.validator?.model;
    const ar = m?.arbiter?.model;
    if (a && v && ar) {
      return `ERC-8004 Identity · ${a} → ${v} → ${ar} · Mantle Mainnet`;
    }
    return 'ERC-8004 Identity · Multi-model adversarial consensus · Mantle Mainnet';
  })();

  // ═══ WRITE CONTRACT ═══  (kept for future deposit feature)
  // const { writeContract, data: txHash } = useWriteContract();
  // const { isLoading: isTxPending, isSuccess: isTxConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  // ═══ MARKET DATA ═══
  const FALLBACK_MARKET = {
    ethPrice: 2847, ethChange24h: -1.2, sentiment: 'cautious_neutral',
    mETHYield: 3.41, mantleTVL: 4200000000, fearGreedValue: 42,
    lastUpdated: '2026-05-20T18:30:00Z',
  };

  // ═══ VAULT PERFORMANCE (live wallet balance) ═══
  const [perfData, setPerfData] = useState<any>(null);
  const [strategyData, setStrategyData] = useState<any>(null);
  const [disciplineData, setDisciplineData] = useState<any>(null);
  const [elfaData, setElfaData] = useState<any>(null);
  useEffect(() => {
    fetch('/api/performance').then(r => r.ok ? r.json() : null).then(setPerfData).catch(() => {});
    fetch('/api/strategy').then(r => r.ok ? r.json() : null).then(setStrategyData).catch(() => {});
    fetch('/api/discipline').then(r => r.ok ? r.json() : null).then(setDisciplineData).catch(() => {});
    fetch('/api/elfa-snapshot').then(r => r.ok ? r.json() : null).then(setElfaData).catch(() => {});
  }, []);

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

        {/* ═══ DEMO MODE BANNER (no-lying-about-state.md) ═══ */}
        <div
          role="note"
          aria-live="polite"
          className="mb-6 -mx-6 px-6 py-2 text-center text-[10px] text-yellow-300/80 bg-yellow-400/[0.04] border-y border-yellow-400/10 anim-fade-up anim-delay-1"
        >
          Demo Mode · No public deposits · Stats below are agent-lifetime aggregate (agentId=0)
        </div>

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
              <div className="flex items-center gap-3 justify-center lg:justify-start mb-3 flex-wrap">
                <Shield className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-mono text-purple-300/60" title="Models read live from agent identity tokenURI on Mantle Mainnet, fetched fresh from IPFS each load">{heroBadge}</span>
                <CardSourceBadge card={agentCard} />
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-3">
                <span className="bg-gradient-to-r from-purple-400 to-green-400 bg-clip-text text-transparent">Proof-of-Reasoning</span>
                <br />
                <span className="text-white/90 text-2xl lg:text-3xl">The AI that proves why it didn&apos;t trade</span>
              </h2>
              <p className="text-sm text-white/40 max-w-lg">
                Multi-model adversarial consensus with on-chain proof of every reasoning step.{' '}
                {totalRejected && totalProposals
                  ? `${totalRejected}/${totalProposals}`
                  : '—'}{' '}
                proposals blocked by validator before execution.
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 shrink-0">
              <div className="text-center" title="Proposals submitted by Analyst, recorded on Mantle Mainnet (ValidationRegistry.totalProposals)">
                <div className="stat-number">{totalProposals || totalDecisions || '—'}</div>
                <div className="text-[10px] text-white/30 mt-2 uppercase tracking-wide">On-Chain Proofs</div>
              </div>
              <div className="text-center" title="Proposals rejected by Validator before any swap executed (ValidationRegistry.totalRejected)">
                <div className="stat-number text-red-400">{totalRejected || '—'}</div>
                <div className="text-[10px] text-white/30 mt-2 uppercase tracking-wide">Trades Blocked</div>
              </div>
              <div className="text-center" title="Percentage of proposals blocked by adversarial validation (totalRejected / totalProposals)">
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
            <h2 className="text-xs font-bold text-white/60 uppercase tracking-[0.2em]">
              Agent Performance · Lifetime aggregate (agentId=0)
            </h2>
            <span className="ml-auto text-[10px] font-mono text-green-300/40">on-chain + outcomes.json</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]" title="On-chain reputation NFT score (ReputationRegistry.getReputation)">
              <div className="text-[8px] text-white/25 uppercase tracking-wider mb-1">Lifetime</div>
              <div className="text-xl font-bold text-green-400">{reputationData?.normalizedScore ?? '—'}</div>
              <div className="text-[9px] text-white/30 mt-1 uppercase">Reputation Score</div>
            </div>
            <div className="text-center p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]" title="(GOOD_CALL + CORRECT_BLOCK) / Settled — derived from outcomes.json">
              <div className="text-[8px] text-white/25 uppercase tracking-wider mb-1">Lifetime</div>
              <div className="text-xl font-bold text-white/90">{perfData?.winRate != null ? `${perfData.winRate.toFixed(1)}%` : '—'}</div>
              <div className="text-[9px] text-white/30 mt-1 uppercase">Win Rate</div>
            </div>
            <div className="text-center p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]" title="Resolved outcomes in src/data/outcomes.json (settled[]).length">
              <div className="text-[8px] text-white/25 uppercase tracking-wider mb-1">Lifetime</div>
              <div className="text-xl font-bold text-white/90">{perfData?.settledCount ?? '—'}</div>
              <div className="text-[9px] text-white/30 mt-1 uppercase">Settled Outcomes</div>
            </div>
            <div className="text-center p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]" title="Sum of pnlBps across settled[] (basis points)">
              <div className="text-[8px] text-white/25 uppercase tracking-wider mb-1">Lifetime</div>
              <div className={`text-xl font-bold ${(perfData?.cumulativePnlBps ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {perfData?.cumulativePnlBps != null
                  ? `${perfData.cumulativePnlBps >= 0 ? '+' : ''}${perfData.cumulativePnlBps} bps`
                  : '—'}
              </div>
              <div className="text-[9px] text-white/30 mt-1 uppercase">Cumulative PnL</div>
            </div>
            <div className="text-center p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]" title="Good Calls / Bad Calls — see outcomes.json scoring">
              <div className="text-[8px] text-white/25 uppercase tracking-wider mb-1">Lifetime</div>
              <div className="text-xl font-bold text-yellow-400">
                {perfData ? `${perfData.goodCallCount ?? 0} / ${perfData.badCallCount ?? 0}` : '—'}
              </div>
              <div className="text-[9px] text-white/30 mt-1 uppercase">W / L Ratio</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/[0.04]">
            <div className="flex flex-wrap items-center gap-3 text-[10px] text-white/30">
              <span title="src/cron/agentCron.js — pauses after MAX_CONSECUTIVE_ERRORS=3, capped at MAX_DAILY_CYCLES=288">
                Circuit breaker: <span className="text-white/50">3 consecutive errors → pause</span>
              </span>
              <span>·</span>
              <span title="src/orchestrator/multiAgent.js — Validator REJECTs unless R:R ≥ 1.5:1, riskScore ≤ 75, regime supports trade">
                Validator gate: <span className="text-white/50">R:R ≥ 1.5, risk ≤ 75</span>
              </span>
              <span>·</span>
              <a
                href="https://github.com/USBVadik/TuringVault-Core/blob/main/src/orchestrator/multiAgent.js"
                target="_blank"
                rel="noreferrer"
                className="text-purple-400/60 hover:text-purple-400"
              >
                source
              </a>
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
              <span className="ml-auto text-[9px] font-mono text-white/20" title="Liveness derived from /api/health (loop_progress.json mtime + outcomes.json freshness)">
                Mantle Mainnet · last cycle{' '}
                {health?.lastCycleTimestamp ? <RelativeTime ts={health.lastCycleTimestamp} /> : '—'}
              </span>
            </div>
            {isStale ? (
              <div
                role="alert"
                className="mb-3 border border-yellow-400/30 bg-yellow-400/[0.04] text-yellow-300/80 px-3 py-2 rounded text-[11px] font-mono"
              >
                ⚠ Agent idle for <RelativeTime ts={health.lastCycleTimestamp} />.
                Cron mode: <span className="text-yellow-200/80">{health?.mode ?? 'unknown'}</span>.
                Lifetime stats below remain valid; recent decision feed is paused.
              </div>
            ) : null}
            <LiveTerminal />
          </div>

          {/* Right column — col 3, rows 1+2: Funding above Verify */}
          <div className="row-span-2 flex flex-col gap-5">
            {/* Agent Wallet · Operator Account (T11) */}
            <div>
              <div className="flex items-center gap-2 mb-3 pl-1">
                <Wallet className="w-4 h-4 text-purple-400" />
                <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Agent Wallet · Operator Account</span>
              </div>
              <div className="glass-card p-5">
                {/* NAV + holdings (T8.1 follow-up: full breakdown after USDT0/USDT/WMNT were missing) */}
                <div className="space-y-3 mb-5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-white/30 uppercase tracking-wider">NAV (Total)</span>
                    <span className="text-sm font-mono font-bold text-green-400" title="Sum of MNT + all ERC-20 balances × USD price; on-chain reads">
                      {perfData?.nav != null ? `~$${perfData.nav.toFixed(2)}` : '—'}
                    </span>
                  </div>
                  {perfData?.holdings && (
                    <div className="grid grid-cols-1 gap-1 pl-2 border-l border-white/[0.04]">
                      {[
                        ['MNT',         'native'],
                        ['WMNT',        'wrapped'],
                        ['mETH',        'staking'],
                        ['USDT_legacy', 'USDT'],
                        ['USDT0',       'USDT0'],
                        ['mUSD',        'mUSD'],
                        ['USDY',        'USDY · RWA'],
                      ].map(([sym, label]) => {
                        const bal = perfData.holdings[sym];
                        const price = perfData.prices?.[sym];
                        if (bal == null || bal === 0) return null;
                        const usd = price != null ? bal * price : null;
                        return (
                          <div key={sym} className="flex justify-between items-center text-[10px] font-mono text-white/40">
                            <span>{label}</span>
                            <span>
                              {bal} <span className="text-white/25">·</span>{' '}
                              <span className="text-white/55">{usd != null ? `$${usd.toFixed(2)}` : '—'}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-white/30 uppercase tracking-wider">Custody Model</span>
                    <span className="text-sm font-mono text-yellow-300/70" title="Funds held in EOA. Vault contract pattern is in development.">
                      EOA · custodial demo
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-white/30 uppercase tracking-wider">Vault Contract</span>
                    <span className="text-[10px] font-mono text-white/40">planned · spec in progress</span>
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
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-white/25 uppercase tracking-widest">Active Strategy</p>
                    {strategyData?.lastUpdated ? (
                      <span className="text-[9px] font-mono text-white/20">
                        cached · last update <RelativeTime ts={strategyData.lastUpdated} />
                      </span>
                    ) : null}
                  </div>
                  <div className="funding-strategy-row">
                    <span className="text-[10px] font-mono text-purple-400/70">Regime</span>
                    <span className="text-[10px] font-mono text-yellow-400/70">{strategyData?.regime || '—'}</span>
                  </div>
                  <div className="funding-strategy-row">
                    <span className="text-[10px] font-mono text-purple-400/70">Grid Channel</span>
                    <span className="text-[10px] font-mono text-white/50">{strategyData?.channel ? `$${strategyData.channel.support} – $${strategyData.channel.resistance}` : '—'}</span>
                  </div>
                  <div className="funding-strategy-row">
                    <span className="text-[10px] font-mono text-purple-400/70">Position</span>
                    <span className="text-[10px] font-mono text-green-400/70">{strategyData?.position || '—'}</span>
                  </div>
                  <div className="funding-strategy-row">
                    <span className="text-[10px] font-mono text-purple-400/70">TP / SL</span>
                    <span className="text-[10px] font-mono text-white/50">{strategyData?.tp && strategyData?.sl ? `${strategyData.tp} / ${strategyData.sl}${strategyData.riskReward ? ` (R:R ${strategyData.riskReward}:1)` : ''}` : 'N/A (FLAT)'}</span>
                  </div>
                  <div className="funding-strategy-row">
                    <span className="text-[10px] font-mono text-purple-400/70">Risk Gate</span>
                    <span className="text-[10px] font-mono text-green-400/70">VaR {strategyData?.varGate || '< 150 bps'}</span>
                  </div>

                  {/* RWA allocation row — rwa-allocation-active T12 */}
                  {strategyData?.rwaAllocation ? (
                    <>
                      <div className="funding-strategy-row" title="rwa-treasury class = USDT0 + USDY (paper-ready). % of NAV from on-chain reads. Spec: rwa-allocation-active.">
                        <span className="text-[10px] font-mono text-purple-400/70">RWA · Treasury</span>
                        <span className="text-[10px] font-mono text-emerald-400/80">
                          {strategyData.rwaAllocation.currentPctNav != null
                            ? `${strategyData.rwaAllocation.currentPctNav}% of NAV${
                                strategyData.rwaAllocation.rwaUsd != null
                                  ? ` ($${strategyData.rwaAllocation.rwaUsd.toFixed(2)})`
                                  : ''
                              }`
                            : '—'}
                        </span>
                      </div>
                      <div className="funding-strategy-row" title="USDT0 = LayerZero-bridged Tether (Treasury-collateralised, 1:1 USD peg, no APY claim). USDY = Ondo tokenized Treasuries — paper-ready, Mantle pool currently dry.">
                        <span className="text-[10px] font-mono text-purple-400/70">RWA assets</span>
                        <span className="text-[10px] font-mono text-white/50">
                          USDT0 ·{' '}
                          <span className={
                            strategyData.rwaAllocation.executeEnabled
                              ? 'text-emerald-400/80'
                              : 'text-yellow-400/60'
                          }>
                            {strategyData.rwaAllocation.executeEnabled ? 'live' : 'simulated'}
                          </span>{' '}
                          <span className="text-white/30">·</span>{' '}
                          USDY · <span className="text-white/30">paper-ready</span>
                        </span>
                      </div>
                      {strategyData.rwaAllocation.executeEnabled && strategyData.rwaAllocation.lastRebalanceAt ? (
                        <div className="funding-strategy-row">
                          <span className="text-[10px] font-mono text-purple-400/70">Last RWA swap</span>
                          <span className="text-[10px] font-mono text-white/50">
                            <RelativeTime ts={strategyData.rwaAllocation.lastRebalanceAt} />
                            {strategyData.rwaAllocation.source !== 'none' && (
                              <span className="text-white/30"> · {strategyData.rwaAllocation.source}</span>
                            )}
                          </span>
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  {/* Elfa social signal strip — Elfa REST v2 (src/data/elfa.js) */}
                  <ElfaSocialStripRow data={elfaData} />

                  {/* Discipline Layer strip — discipline-layer-ui R3 */}
                  <DisciplineStripRow data={disciplineData} />
                </div>
                {/* CTA — honest custody disclosure */}
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/[0.03] border border-white/8 w-full justify-center">
                    <Shield className="w-3.5 h-3.5 text-yellow-400/50" />
                    <span className="text-[10px] font-mono text-white/40">
                      Demo capital{perfData?.nav != null ? ` · ~$${perfData.nav.toFixed(2)}` : ''}
                    </span>
                  </div>
                  <p className="text-[9px] text-white/15 mt-2">Vault contract pattern in development</p>
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

          {/* AI Reasoning — col 2, row 2 (T12: labelled as static example) */}
          <div className="glass-card p-6 anim-fade-up anim-delay-4">
            <div className="flex items-center gap-2 mb-5">
              <Cpu className="w-4 h-4 text-green-400" />
              <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">AI Reasoning</span>
              <span
                className="ml-auto text-[9px] text-yellow-400/60 font-mono"
                title="These lines are static examples of what a real reasoning trace looks like. Real per-cycle reasoning is on the Proof Explorer."
              >
                Example · static
              </span>
            </div>
            <div className="space-y-1">
              {REASONING_LINES.map((line, i) => (
                <div key={i} className={`reasoning-line ${i === reasoningStep ? 'active' : ''} ${i < reasoningStep ? 'success' : ''}`}>
                  {i === reasoningStep && <span className="cursor-blink">{line}</span>}
                  {i !== reasoningStep && line}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-white/25 mt-4 leading-relaxed">
              Example pipeline lines. Real per-cycle reasoning is on the{' '}
              <a href="/proof-explorer" className="text-purple-400/70 hover:text-purple-400 underline-offset-2">
                Proof Explorer
              </a>{' '}
              — IPFS-pinned per decision.
            </p>
          </div>

        </div>

        {/* ═══ EVOLUTION TIMELINE — disabled in production (T14) ═══ */}
        <section className="glass-card p-8 mb-8 anim-fade-up anim-delay-6">
          <div className="flex items-center gap-3 mb-2">
            <GitBranch className="w-4 h-4 text-purple-400" />
            <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">On-Chain Prompt Evolution</span>
            <span className="ml-auto text-[10px] font-mono text-yellow-400/60" title="Module exists in src/evolution/promptEvolution.js but evolved prompts are bypassed at runtime to stabilize JSON output formatting (see multiAgent.js).">
              Module exists · currently disabled in production
            </span>
          </div>
          <p className="text-xs text-white/35 mb-3 max-w-2xl leading-relaxed">
            The agent&apos;s prompt-evolution module can mutate the analyst system prompt based on settlement
            outcomes and pin each version to IPFS. It is currently disabled at runtime to keep JSON output
            stable across model providers. The pinned base prompt is{' '}
            <code className="text-purple-300/70">v{agentCard?.systemPromptVersion ?? '—'}</code>{' '}
            (last updated{' '}
            {agentCard?.systemPromptLastUpdated ? (
              <RelativeTime ts={agentCard.systemPromptLastUpdated} />
            ) : (
              '—'
            )}
            ). Re-enabling is tracked as a follow-up spec.
          </p>
          <div className="flex flex-wrap gap-3 text-[10px]">
            <a
              href="https://github.com/USBVadik/TuringVault-Core/blob/main/src/evolution/promptEvolution.js"
              target="_blank"
              rel="noreferrer"
              className="text-purple-400/70 hover:text-purple-400"
            >
              src/evolution/promptEvolution.js
            </a>
            <span className="text-white/20">·</span>
            <a
              href="https://github.com/USBVadik/TuringVault-Core/blob/main/src/orchestrator/multiAgent.js"
              target="_blank"
              rel="noreferrer"
              className="text-purple-400/70 hover:text-purple-400"
            >
              bypass site (multiAgent.js)
            </a>
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
            {recentDecisions == null ? (
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
              recentDecisions.map((d: any, i: number) => {
                const tsLabel = d.timestamp
                  ? new Date(d.timestamp * 1000).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—';
                const amount = d.amountIn != null && d.amountIn !== '0'
                  ? `${(Number(d.amountIn) / 1e18).toFixed(3)} ${d.targetAsset}`
                  : '—';
                return (
                  <div key={i} className="table-v2-row grid-cols-6">
                    <span className="text-white/40 font-mono text-[11px]">{tsLabel}</span>
                    <span className={`font-bold text-[11px] ${d.action === 'swap' ? 'text-green-400' : 'text-purple-400'}`}>
                      {d.action.toUpperCase()}
                    </span>
                    <span className="text-white/80 font-medium">{d.targetAsset}</span>
                    <span className="text-white/50 font-mono text-[11px]">{amount}</span>
                    <span className="text-white/70 font-mono">{(d.confidence / 100).toFixed(1)}%</span>
                    <span className="text-white/25 truncate font-mono text-[10px]">{parseReasoning(d.reasoningHash)}</span>
                  </div>
                );
              })
            ) : (
              <div className="px-6 py-16 text-center">
                <div className="text-white/15 text-sm">No decisions recorded yet</div>
                <div className="text-white/10 text-xs mt-2">AI Agent is analyzing market conditions...</div>
              </div>
            )}
          </div>
        </section>

        {/* ═══ CONTRACTS + FOOTER (T15) ═══ */}
        <footer className="mt-16 pt-8 pb-12 border-t border-white/5 relative">
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-purple-900/[0.03] to-transparent rounded-b-3xl" />
          <div className="flex flex-col items-center gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 max-w-4xl w-full">
              {contractsData.map((c) => (
                <div key={c.address} className="flex items-center gap-2 text-[10px] font-mono">
                  <a
                    href={c.explorer}
                    target="_blank"
                    rel="noreferrer"
                    className="text-white/40 hover:text-purple-400 transition-colors flex items-center gap-1.5"
                    title={c.role}
                  >
                    <span className="text-white/55">{c.name}</span>
                    <span className="text-white/30">{c.address.slice(0, 6)}…{c.address.slice(-4)}</span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-50 group-hover:opacity-100" />
                  </a>
                  {c.sourcify === 'full' ? (
                    <a
                      href={c.sourcifyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-green-400/70 hover:text-green-400 text-[9px]"
                      title="Sourcify full match — bytecode + metadata verified"
                    >
                      ✓ verified
                    </a>
                  ) : c.sourcify === 'partial' ? (
                    <a
                      href={c.sourcifyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-yellow-400/70 hover:text-yellow-400 text-[9px]"
                      title="Sourcify partial match"
                    >
                      ~ partial
                    </a>
                  ) : (
                    <span
                      className="text-yellow-400/40 text-[9px]"
                      title={c.sourcifyNote ?? 'Not verified on Sourcify'}
                    >
                      not verified
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-white/15">
              Mantle Turing Test Hackathon 2026 ·{' '}
              <a href="https://github.com/USBVadik/TuringVault-Core" className="text-purple-400/40 hover:text-purple-400" target="_blank" rel="noreferrer">
                GitHub
              </a>
            </p>
          </div>
        </footer>
      </main>
      <RiskMascot />
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

/* ═══ RISK STATE MASCOT — moved to ./components/RiskMascot.tsx (T7) ═══ */

/* ═══ AGENT CARD SOURCE BADGE — surfaces live tokenURI vs repo fallback ═══ */
function CardSourceBadge({ card }: { card: any }) {
  if (!card) return null;
  const source = card.source ?? null;
  const cid = card.ipfsCid ?? null;
  const gw = card.fetchedFromGateway ?? null;

  if (source === 'on-chain-tokenURI' && cid) {
    const short = `${cid.slice(0, 6)}…${cid.slice(-4)}`;
    const ipfsUrl = gw || `https://gateway.pinata.cloud/ipfs/${cid}`;
    return (
      <a
        href={ipfsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-400/90 hover:text-emerald-300 hover:bg-emerald-500/15 transition-colors"
        title={`Live from on-chain tokenURI(0) → IPFS ${cid}\nGateway: ${gw}\nClick to open the pinned blob.`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        live · IPFS {short}
      </a>
    );
  }
  if (source === 'repo-snapshot') {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[10px] font-mono text-amber-400/90"
        title={card.error || 'On-chain tokenURI unreachable; using repo snapshot. Mascot will turn green when IPFS gateway recovers.'}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
        repo snapshot
      </span>
    );
  }
  if (source === 'none') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-[10px] font-mono text-red-400/90" title="Both tokenURI and snapshot unreachable">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
        unreachable
      </span>
    );
  }
  return null;
}

/* ═══ ELFA SOCIAL STRIP — Elfa REST v2, src/data/elfa.js ═══ */
function ElfaSocialStripRow({ data }: { data: any }) {
  // Honest empty/error states first — never fabricate.
  if (!data) {
    return (
      <div className="funding-strategy-row" title="Elfa social snapshot loading...">
        <span className="text-[10px] font-mono text-purple-400/70">Elfa Social</span>
        <span className="text-[10px] font-mono text-white/30">—</span>
      </div>
    );
  }

  if (!data.available) {
    const reason = data.reason ?? 'unavailable';
    const isMissingKey = /no_api_key|not configured/i.test(reason);
    return (
      <div
        className="funding-strategy-row"
        title={
          isMissingKey
            ? 'ELFA_API_KEY not set on this deployment. Source: src/data/elfa.js'
            : `Elfa API: ${reason}`
        }
      >
        <span className="text-[10px] font-mono text-purple-400/70">Elfa Social</span>
        <span className="text-[10px] font-mono text-white/30">
          {isMissingKey ? 'API key not set' : 'unavailable'}
        </span>
      </div>
    );
  }

  const sig = data.signal as 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  const sigColor =
    sig === 'BULLISH'
      ? 'text-emerald-400/80'
      : sig === 'BEARISH'
        ? 'text-red-400/80'
        : 'text-white/50';

  const ms = data.mindshare != null ? Number(data.mindshare).toFixed(2) : null;
  const dms = data.mindshareChange != null ? Number(data.mindshareChange).toFixed(0) : null;
  const sentimentStr = data.sentiment != null ? Number(data.sentiment).toFixed(2) : '—';
  const smart = data.smartAccountMentions ?? 0;
  const sym = data.symbol ?? 'ETH';
  const win = data.timeWindow ?? (data.windowHours != null ? `${data.windowHours}h` : '24h');

  // Stale check: any snapshot older than the cycle period (90 min) is stale.
  const fetchedAt = data.fetchedAt ? Date.parse(data.fetchedAt) : null;
  const ageMs = fetchedAt ? Date.now() - fetchedAt : null;
  const stale = ageMs != null && ageMs > 90 * 60 * 1000;

  return (
    <>
      <div
        className="funding-strategy-row"
        title={`Elfa REST v1 · ${win} window · entity-graph-filtered. Sentiment range -1..+1 (current ${sentimentStr}). Source: src/data/elfa.js`}
      >
        <span className="text-[10px] font-mono text-purple-400/70">Elfa Social ({sym})</span>
        <span className="text-[10px] font-mono flex items-center gap-2">
          <span className={sigColor}>{sig}</span>
          {ms != null && (
            <span className="text-white/40">
              mindshare {ms}%
              {dms != null && (
                <span className={Number(dms) >= 0 ? 'text-emerald-400/60' : 'text-red-400/60'}>
                  {' '}
                  ({Number(dms) >= 0 ? '+' : ''}
                  {dms}%)
                </span>
              )}
            </span>
          )}
          {stale && <span className="text-yellow-400/80 ml-1">stale</span>}
        </span>
      </div>
      <div className="funding-strategy-row">
        <span className="text-[10px] font-mono text-purple-400/70"></span>
        <span className="text-[10px] font-mono text-white/30">
          smart-account mentions: <span className="text-white/55">{smart}</span>
          {' · '}
          sentiment <span className="text-white/55">{sentimentStr}</span>
        </span>
      </div>
    </>
  );
}

/* ═══ DISCIPLINE LAYER STRIP — discipline-layer-ui R3/R5 ═══ */
function DisciplineStripRow({ data }: { data: any }) {
  if (!data) {
    return (
      <div className="funding-strategy-row">
        <span className="text-[10px] font-mono text-purple-400/70">Discipline Layer</span>
        <span className="text-[10px] font-mono text-white/30">—</span>
      </div>
    );
  }

  const latest = data.latest;
  const latestEntry = data.latestEntry;

  // Honest empty state
  if (!latest && !latestEntry) {
    return (
      <div className="funding-strategy-row" title="Discipline Layer is implemented (src/orchestrator/disciplineLayer.js) but has not yet recorded a cycle. New cycles auto-populate this strip.">
        <span className="text-[10px] font-mono text-purple-400/70">Discipline Layer</span>
        <span className="text-[10px] font-mono text-white/30">awaiting first cycle</span>
      </div>
    );
  }

  const verdict = latest?.status ?? latestEntry?.verdict ?? 'UNKNOWN';
  const checks = latest?.checks ?? latestEntry?.checks ?? [];
  const blockReason = latest?.blockReason ?? latestEntry?.blockReason ?? null;
  const at = latestEntry?.at;

  // Stale check (>6h)
  const ageMs = at ? Date.now() - Date.parse(at) : null;
  const stale = ageMs != null && ageMs > 6 * 3600 * 1000;

  // Render gate icons
  const KNOWN: Array<'tx_proof' | 'price_freshness' | 'drift_detection'> = ['tx_proof', 'price_freshness', 'drift_detection'];
  const labels: Record<string, string> = {
    tx_proof: 'tx',
    price_freshness: 'fresh',
    drift_detection: 'drift',
  };
  const fullLabels: Record<string, string> = {
    tx_proof: 'TX Proof — execution exists on chain, sender matches wallet, status=1',
    price_freshness: 'Price Freshness — market data <60s old at decision time',
    drift_detection: 'Drift Detection — action aligns with declared regime',
  };
  const checkByName: Record<string, any> = {};
  for (const c of checks) checkByName[c.name] = c;

  function dot(status: string | undefined): string {
    const s = (status ?? '').toLowerCase();
    if (s === 'pass') return 'text-emerald-400';
    if (s === 'fail') return 'text-red-400';
    if (s === 'warn') return 'text-yellow-400';
    if (s === 'skip') return 'text-white/30';
    return 'text-white/20';
  }
  function symbol(status: string | undefined): string {
    const s = (status ?? '').toLowerCase();
    if (s === 'pass') return '✓';
    if (s === 'fail') return '✗';
    if (s === 'warn') return '⚠';
    if (s === 'skip') return '○';
    return '·';
  }

  return (
    <>
      <div
        className="funding-strategy-row"
        title={
          verdict === 'BLOCKED'
            ? `Last cycle BLOCKED: ${blockReason ?? 'unknown'}`
            : verdict === 'ERROR'
              ? 'Last verifier run errored — see /discipline'
              : stale
                ? `Last check ${ageMs ? Math.round(ageMs / 3600000) : '?'}h old`
                : 'Post-execution proof verification (Synrail-inspired). Click View history.'
        }
      >
        <span className="text-[10px] font-mono text-purple-400/70">Discipline Layer</span>
        <span className="text-[10px] font-mono flex items-center gap-2">
          {KNOWN.map((g) => {
            const c = checkByName[g];
            return (
              <span key={g} title={fullLabels[g] + (c?.detail ? ` — ${c.detail}` : '')} className={`${dot(c?.status)} font-mono`}>
                {symbol(c?.status)} {labels[g]}
              </span>
            );
          })}
          {stale && <span className="text-yellow-400/80 ml-2">stale</span>}
          {verdict === 'BLOCKED' && <span className="text-red-400/80 ml-2">BLOCKED</span>}
          {verdict === 'ERROR' && <span className="text-yellow-400/80 ml-2">ERROR</span>}
        </span>
      </div>
      <div className="funding-strategy-row">
        <span className="text-[10px] font-mono text-purple-400/70"></span>
        <span className="text-[10px] font-mono text-white/30">
          last verdict: <span className={
            verdict === 'ACCEPTED' ? 'text-emerald-400/80'
            : verdict === 'BLOCKED' ? 'text-red-400/80'
            : verdict === 'ERROR' ? 'text-yellow-400/80'
            : 'text-white/50'
          }>{verdict}</span>
          {' · '}
          <a href="/discipline" className="text-purple-300/70 hover:text-purple-200 underline">view history</a>
        </span>
      </div>
    </>
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
