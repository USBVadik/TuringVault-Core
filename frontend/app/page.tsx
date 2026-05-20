'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { useState, useEffect } from 'react';
import { Shield, Brain, TrendingUp, Activity, Wallet, ArrowRightLeft, Zap, ExternalLink } from 'lucide-react';

// Contract addresses — Mantle Mainnet
const CONTRACTS = {
  IDENTITY: '0x6f862802e0d5463DF18d267e422347BeCacc28bD' as `0x${string}`,
  DECISION_LOG: '0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5' as `0x${string}`,
  VALIDATION: '0x0aeEd88959fCFC665284225dB93DED3e8A3Ff705' as `0x${string}`,
  REPUTATION: '0xC78119F3274B05046Ac7c38a14298a6cbD946e1a' as `0x${string}`,
  ROUTER: '0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001' as `0x${string}`,
};

const EXPLORER_BASE = 'https://explorer.mantle.xyz/address';

// ABIs
const DECISION_LOG_ABI = [
  {
    name: 'totalDecisions',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'successfulSwaps',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'totalPnLBasisPoints',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getRecentDecisions',
    type: 'function',
    stateMutability: 'view',
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
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
] as const;

export default function Home() {
  const { address, isConnected } = useAccount();
  const [depositAmount, setDepositAmount] = useState('');
  const [marketData, setMarketData] = useState<any>(null);

  // Read on-chain data
  const { data: totalDecisions } = useReadContract({
    address: CONTRACTS.DECISION_LOG,
    abi: DECISION_LOG_ABI,
    functionName: 'totalDecisions',
  });

  const { data: successfulSwaps } = useReadContract({
    address: CONTRACTS.DECISION_LOG,
    abi: DECISION_LOG_ABI,
    functionName: 'successfulSwaps',
  });

  const { data: totalPnL } = useReadContract({
    address: CONTRACTS.DECISION_LOG,
    abi: DECISION_LOG_ABI,
    functionName: 'totalPnLBasisPoints',
  });

  const { data: recentDecisions } = useReadContract({
    address: CONTRACTS.DECISION_LOG,
    abi: DECISION_LOG_ABI,
    functionName: 'getRecentDecisions',
    args: [BigInt(10)],
  });

  // Write contract (deposit)
  const { writeContract, data: txHash } = useWriteContract();
  const { isLoading: isTxPending, isSuccess: isTxConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  // Fetch market data from API
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

  function handleDeposit() {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;
    writeContract({
      address: CONTRACTS.ROUTER,
      abi: ROUTER_ABI,
      functionName: 'deposit',
      value: parseEther(depositAmount),
    });
  }

  return (
    <>
      {/* Background layers */}
      <div className="mesh-gradient-bg" />
      <div className="grid-overlay" />

      <main className="relative min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
        {/* ═══ HEADER ═══ */}
        <header className="flex items-center justify-between pb-6 animate-reveal">
          <div className="flex items-center gap-4">
            {/* Logo mark */}
            <div className="relative w-11 h-11">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-purple-500 to-green-500 opacity-60 blur-md" />
              <div className="relative w-11 h-11 rounded-xl bg-[#0c0c18] border border-purple-500/30 flex items-center justify-center">
                <Zap className="w-5 h-5 text-purple-400" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                TuringVault<span className="text-purple-400/60">.ai</span>
              </h1>
              <p className="text-[11px] text-white/35 tracking-wide">AI-Managed RWA Router · Mantle Network</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="badge-live">LIVE</div>
            <ConnectButton />
          </div>
        </header>

        {/* ═══ AGENT IDENTITY — HERO CARD ═══ */}
        <section className="glass-card-hero p-8 animate-reveal delay-1">
          <div className="flex items-center gap-4 mb-8">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-xl" />
              <div className="relative w-12 h-12 rounded-full bg-purple-900/50 border border-purple-500/30 flex items-center justify-center">
                <Shield className="w-6 h-6 text-purple-400" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white">TuringVault AI Agent</h2>
              <p className="text-xs text-purple-300/60 font-mono">Claude Sonnet 4.6 · ERC-8004 Identity Token #0</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              label="Total Decisions"
              value={totalDecisions?.toString() || '—'}
              icon={<Brain className="w-4 h-4 text-purple-400" />}
            />
            <StatCard
              label="Successful Swaps"
              value={successfulSwaps?.toString() || '0'}
              icon={<ArrowRightLeft className="w-4 h-4 text-green-400" />}
            />
            <StatCard
              label="Cumulative PnL"
              value={totalPnL ? `${(Number(totalPnL) / 100).toFixed(2)}%` : '0.00%'}
              icon={<TrendingUp className="w-4 h-4 text-green-400" />}
              highlight
            />
          </div>
        </section>

        {/* ═══ MARKET + DEPOSIT GRID ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-6">
          {/* Market Cards */}
          <div className="lg:col-span-2 space-y-4 animate-reveal delay-2">
            <h3 className="text-[11px] font-semibold text-white/40 uppercase tracking-[0.15em] pl-1">
              Live Market Data
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MarketCard
                label="ETH Price"
                value={marketData ? `$${marketData.ethPrice.toLocaleString()}` : '—'}
                change={marketData?.ethChange24h}
              />
              <MarketCard
                label="Sentiment"
                value={marketData?.sentiment?.replace('_', ' ').toUpperCase() || '—'}
                sentiment={marketData?.sentiment}
              />
              <MarketCard
                label="mETH Yield"
                value={marketData ? `${marketData.mETHYield.toFixed(2)}%` : '—'}
              />
              <MarketCard
                label="Mantle TVL"
                value={marketData ? `$${(marketData.mantleTVL / 1e6).toFixed(0)}M` : '—'}
              />
            </div>
          </div>

          {/* Deposit Panel */}
          <div className="glass-card p-6 animate-reveal delay-3">
            <div className="flex items-center gap-2 mb-5">
              <Wallet className="w-4 h-4 text-green-400" />
              <h3 className="text-sm font-semibold text-white/90">Deposit to Vault</h3>
            </div>
            {isConnected ? (
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] text-white/40 uppercase tracking-wide">Amount (MNT)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.0"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="input-glass w-full mt-2"
                  />
                </div>
                <button
                  onClick={handleDeposit}
                  disabled={isTxPending || !depositAmount}
                  className="btn-green w-full text-sm"
                >
                  {isTxPending ? 'Confirming...' : 'Deposit MNT'}
                </button>
                {isTxConfirmed && (
                  <p className="text-xs text-green-400 text-center glow-text-green">✓ Deposit confirmed</p>
                )}
                <p className="text-[10px] text-white/25 text-center">
                  AI Agent manages your deposit autonomously
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-white/40 mb-4">Connect wallet to deposit</p>
                <ConnectButton />
              </div>
            )}
          </div>
        </div>

        {/* ═══ DECISION LOG ═══ */}
        <section className="mt-8 animate-reveal delay-4">
          <div className="flex items-center gap-2 mb-4 pl-1">
            <Activity className="w-4 h-4 text-purple-400" />
            <h3 className="text-[11px] font-semibold text-white/40 uppercase tracking-[0.15em]">
              On-Chain AI Decisions · Proof of Reasoning
            </h3>
          </div>
          <div className="table-glass">
            <div className="table-header grid grid-cols-5 gap-2 px-5 py-3 text-[10px] uppercase tracking-[0.12em] text-white/30 font-medium">
              <span>Time</span><span>Action</span><span>Target</span><span>Confidence</span><span>Reasoning</span>
            </div>
            {recentDecisions && recentDecisions.length > 0 ? (
              [...recentDecisions].reverse().map((d: any, i: number) => (
                <div key={i} className="table-row grid grid-cols-5 gap-2 px-5 py-3.5 text-xs">
                  <span className="text-white/40 font-mono text-[11px]">
                    {new Date(Number(d.timestamp) * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className={`font-bold text-[11px] ${d.action === 'swap' ? 'text-green-400' : 'text-purple-400'}`}>
                    {d.action.toUpperCase()}
                  </span>
                  <span className="text-white/80 font-medium">{d.targetAsset}</span>
                  <span className="text-white/70 font-mono">{(Number(d.confidence) / 100).toFixed(1)}%</span>
                  <span className="text-white/30 truncate font-mono text-[10px]">{parseReasoning(d.reasoningHash)}</span>
                </div>
              ))
            ) : (
              <div className="px-5 py-12 text-center">
                <div className="text-white/20 text-sm">No decisions yet</div>
                <div className="text-white/10 text-xs mt-1">AI Agent is analyzing market conditions...</div>
              </div>
            )}
          </div>
        </section>

        {/* ═══ FOOTER ═══ */}
        <footer className="mt-16 pt-6 border-t border-white/5 animate-reveal delay-5">
          <div className="flex flex-col items-center gap-3">
            <p className="text-[11px] text-white/25">
              Mantle Turing Test Hackathon 2026 ·{' '}
              <a href="https://github.com/USBVadik/TuringVault-Core" className="text-purple-400/60 hover:text-purple-400 transition-colors" target="_blank">
                GitHub
              </a>
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              {Object.entries(CONTRACTS).map(([name, addr]) => (
                <a
                  key={name}
                  href={`${EXPLORER_BASE}/${addr}`}
                  target="_blank"
                  className="group flex items-center gap-1 text-[10px] text-white/15 hover:text-purple-400/60 font-mono transition-colors"
                >
                  {name}: {addr.slice(0, 8)}...{addr.slice(-4)}
                  <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}

/* ═══ COMPONENTS ═══ */

function StatCard({ label, value, icon, highlight }: { label: string; value: string; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="stat-card">
      <div className="flex items-center gap-2 text-white/35 text-[10px] uppercase tracking-[0.12em] mb-3">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`stat-value ${highlight ? 'glow-text-green' : ''}`}>{value}</div>
    </div>
  );
}

function MarketCard({ label, value, change, sentiment }: { label: string; value: string; change?: number; sentiment?: string }) {
  let color = 'text-white/90';
  if (change !== undefined) color = change >= 0 ? 'text-green-400' : 'text-red-400';
  if (sentiment) {
    if (sentiment.includes('bull') || sentiment.includes('greed')) color = 'text-green-400';
    else if (sentiment.includes('fear') || sentiment.includes('bear')) color = 'text-red-400';
    else color = 'text-yellow-400';
  }
  return (
    <div className="glass-card p-4">
      <div className="text-[10px] uppercase text-white/30 tracking-wide mb-2">{label}</div>
      <div className={`text-sm font-bold ${color}`}>{value}</div>
      {change !== undefined && (
        <div className={`text-[10px] mt-1 ${change >= 0 ? 'text-green-500/70' : 'text-red-500/70'}`}>
          {change >= 0 ? '+' : ''}{change.toFixed(2)}% 24h
        </div>
      )}
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
