'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { useState, useEffect } from 'react';
import { Shield, Brain, TrendingUp, Activity, Wallet, ArrowRightLeft } from 'lucide-react';

// Contract addresses (Mantle Sepolia)
const CONTRACTS = {
  IDENTITY: '0x582E6a649B99784829193E14bB7Af8c4A482E165' as `0x${string}`,
  DECISION_LOG: '0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5' as `0x${string}`,
  ROUTER: '0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001' as `0x${string}`,
};

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
    <main className="min-h-screen p-6 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between pb-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-lg">
            🤖
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">TuringVault<span className="text-gray-600">.ai</span></h1>
            <p className="text-xs text-gray-500">AI-Managed RWA Router on Mantle</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-900/30 border border-green-500/30 text-green-400 text-xs">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            LIVE
          </div>
          <ConnectButton />
        </div>
      </header>

      {/* Agent Identity Card */}
      <section className="mt-6 p-6 rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 border border-green-500/20">
        <div className="flex items-center gap-4 mb-6">
          <Shield className="w-8 h-8 text-green-400" />
          <div>
            <h2 className="text-lg font-bold text-white">TuringVault AI Agent</h2>
            <p className="text-xs text-green-400">Claude Sonnet 4.6 · ERC-8004 Identity Token #0</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total Decisions" value={totalDecisions?.toString() || '—'} icon={<Brain className="w-4 h-4" />} />
          <StatCard label="Successful Swaps" value={successfulSwaps?.toString() || '0'} icon={<ArrowRightLeft className="w-4 h-4" />} />
          <StatCard label="Cumulative PnL" value={totalPnL ? `${(Number(totalPnL) / 100).toFixed(2)}%` : '0.00%'} icon={<TrendingUp className="w-4 h-4" />} />
        </div>
      </section>

      {/* Market + Deposit Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        {/* Market Cards */}
        <div className="space-y-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Live Market Data</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MarketCard label="ETH Price" value={marketData ? `$${marketData.ethPrice.toLocaleString()}` : '—'} change={marketData?.ethChange24h} />
            <MarketCard label="Sentiment" value={marketData?.sentiment?.replace('_', ' ').toUpperCase() || '—'} sentiment={marketData?.sentiment} />
            <MarketCard label="mETH Yield" value={marketData ? `${marketData.mETHYield.toFixed(2)}%` : '—'} />
            <MarketCard label="Mantle TVL" value={marketData ? `$${(marketData.mantleTVL / 1e6).toFixed(0)}M` : '—'} />
          </div>
        </div>

        {/* Deposit Panel */}
        <div className="p-5 rounded-xl bg-gray-900 border border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-4 h-4 text-green-400" />
            <h3 className="text-sm font-semibold text-white">Deposit to Vault</h3>
          </div>
          {isConnected ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">Amount (MNT)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.0"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:border-green-500 focus:outline-none"
                />
              </div>
              <button
                onClick={handleDeposit}
                disabled={isTxPending || !depositAmount}
                className="w-full py-2.5 rounded-lg bg-green-500 text-black font-bold text-sm hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isTxPending ? 'Confirming...' : 'Deposit MNT'}
              </button>
              {isTxConfirmed && (
                <p className="text-xs text-green-400 text-center">✅ Deposit confirmed!</p>
              )}
              <p className="text-[10px] text-gray-600 text-center">
                AI Agent manages your deposit autonomously
              </p>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500 mb-3">Connect wallet to deposit</p>
              <ConnectButton />
            </div>
          )}
        </div>
      </div>

      {/* Decision Log */}
      <section className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-green-400" />
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">On-Chain AI Decisions (Proof of Reasoning)</h3>
        </div>
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <div className="grid grid-cols-5 gap-2 px-4 py-2 bg-gray-900 text-[11px] uppercase tracking-wider text-gray-500">
            <span>Time</span><span>Action</span><span>Target</span><span>Confidence</span><span>Reasoning</span>
          </div>
          {recentDecisions && recentDecisions.length > 0 ? (
            [...recentDecisions].reverse().map((d: any, i: number) => (
              <div key={i} className="grid grid-cols-5 gap-2 px-4 py-3 border-t border-gray-800/50 text-xs hover:bg-gray-900/50">
                <span className="text-gray-400">
                  {new Date(Number(d.timestamp) * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className={d.action === 'swap' ? 'text-green-400 font-bold' : 'text-yellow-400 font-bold'}>
                  {d.action.toUpperCase()}
                </span>
                <span className="text-white">{d.targetAsset}</span>
                <span className="text-white">{(Number(d.confidence) / 100).toFixed(1)}%</span>
                <span className="text-gray-500 truncate">{parseReasoning(d.reasoningHash)}</span>
              </div>
            ))
          ) : (
            <div className="px-4 py-8 text-center text-gray-600 text-sm">
              No decisions yet. AI Agent is analyzing market conditions...
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-12 pt-6 border-t border-gray-800 text-center">
        <p className="text-xs text-gray-600">
          Mantle Turing Test Hackathon 2026 ·{' '}
          <a href="https://github.com/USBVadik/TuringVault-Core" className="text-green-500 hover:underline" target="_blank">GitHub</a>
        </p>
        <div className="flex flex-wrap gap-4 justify-center mt-2">
          {Object.entries(CONTRACTS).map(([name, addr]) => (
            <a key={name} href={`https://explorer.sepolia.mantle.xyz/address/${addr}`} target="_blank"
              className="text-[10px] text-gray-700 hover:text-green-500 font-mono">
              {name}: {addr.slice(0, 8)}...{addr.slice(-4)}
            </a>
          ))}
        </div>
      </footer>
    </main>
  );
}

// Helper components
function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700/50">
      <div className="flex items-center gap-2 text-gray-500 text-[11px] uppercase tracking-wider mb-2">
        {icon}{label}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

function MarketCard({ label, value, change, sentiment }: { label: string; value: string; change?: number; sentiment?: string }) {
  let color = 'text-white';
  if (change !== undefined) color = change >= 0 ? 'text-green-400' : 'text-red-400';
  if (sentiment) {
    if (sentiment.includes('bull') || sentiment.includes('greed')) color = 'text-green-400';
    else if (sentiment.includes('fear') || sentiment.includes('bear')) color = 'text-red-400';
    else color = 'text-yellow-400';
  }
  return (
    <div className="p-3 rounded-lg bg-gray-900 border border-gray-800">
      <div className="text-[10px] uppercase text-gray-500 mb-1">{label}</div>
      <div className={`text-sm font-bold ${color}`}>{value}</div>
      {change !== undefined && (
        <div className={`text-[10px] ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
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
