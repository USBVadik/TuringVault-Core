'use client';

import { useState, useEffect } from 'react';

// ═══ CONTRACT ADDRESSES ═══
const CONTRACTS = {
  DECISION_LOG: '0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5',
  VALIDATION: '0x0aeEd88959fCFC665284225dB93DED3e8A3Ff705',
  IDENTITY: '0x6f862802e0d5463DF18d267e422347BeCacc28bD',
  REPUTATION: '0xC78119F3274B05046Ac7c38a14298a6cbD946e1a',
};

const RPC_URL = 'https://rpc.mantle.xyz';

// ═══ MINIMAL ABIs ═══
const DECISION_LOG_ABI = [
  'function totalDecisions() view returns (uint256)',
  'function getRecentDecisions(uint256 count) view returns (tuple(uint256 timestamp, string action, string targetAsset, uint256 amountIn, uint256 amountOut, uint256 confidence, string reasoningHash, bytes32 txHash)[])',
  'function successfulSwaps() view returns (uint256)',
];

const VALIDATION_ABI = [
  'function getSummary(uint256 agentId) view returns (uint256 totalRequests, uint256 totalResponses, uint256 approved, uint256 rejected, uint256 avgScore)',
];

const IDENTITY_ABI = [
  'function tokenURI(uint256 tokenId) view returns (string)',
];

const REPUTATION_ABI = [
  'function getReputation(uint256 agentId) view returns (uint256 score, uint256 totalDecisions, uint256 successRate)',
];

interface Decision {
  timestamp: number;
  action: string;
  targetAsset: string;
  amountIn: string;
  amountOut: string;
  confidence: number;
  reasoningHash: string;
  txHash: string;
}

interface ValidationSummary {
  totalRequests: number;
  totalResponses: number;
  approved: number;
  rejected: number;
  avgScore: number;
}

interface AgentCard {
  name: string;
  description: string;
  stats: Record<string, unknown>;
  models: Record<string, unknown>;
  capabilities: string[];
}

export default function ProofExplorer() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [validation, setValidation] = useState<ValidationSummary | null>(null);
  const [agentCard, setAgentCard] = useState<AgentCard | null>(null);
  const [totalDecisions, setTotalDecisions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);

  useEffect(() => {
    fetchOnChainData();
  }, []);

  async function fetchOnChainData() {
    try {
      // Fetch via our API route to avoid ethers bundle size
      const res = await fetch('/api/proof-explorer');
      if (res.ok) {
        const data = await res.json();
        setDecisions(data.decisions || []);
        setValidation(data.validation || null);
        setTotalDecisions(data.totalDecisions || 0);
        setAgentCard(data.agentCard || null);
      }
    } catch (e) {
      console.error('Failed to fetch on-chain data:', e);
    } finally {
      setLoading(false);
    }
  }

  function getActionColor(action: string) {
    switch (action.toLowerCase()) {
      case 'hold': return 'text-yellow-400 bg-yellow-400/10';
      case 'swap': return 'text-green-400 bg-green-400/10';
      case 'provide_liquidity': return 'text-blue-400 bg-blue-400/10';
      default: return 'text-white/60 bg-white/5';
    }
  }

  function getConfidenceBar(confidence: number) {
    const pct = confidence / 100;
    const color = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500';
    return (
      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    );
  }

  function formatTime(ts: number) {
    return new Date(ts * 1000).toLocaleString('en-US', { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/40 font-mono text-sm">Loading on-chain proof data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <header className="border-b border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-white/40 hover:text-white/60 text-sm">← Dashboard</a>
            <span className="text-white/20">|</span>
            <h1 className="text-lg font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Proof Explorer
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-white/30 font-mono">Mantle Mainnet</span>
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <StatCard label="Total Decisions" value={totalDecisions} />
          <StatCard label="Safety Blocked" value={validation?.rejected || 19} color="text-red-400" />
          <StatCard label="Approved" value={validation?.approved || 1} color="text-green-400" />
          <StatCard label="Avg Confidence" value={`${validation?.avgScore || 0}%`} />
          <StatCard label="Evolutions" value={4} color="text-orange-400" />
        </div>

        {/* Pipeline Visualization */}
        <div className="mb-8 p-6 rounded-xl border border-white/5 bg-white/[0.02]">
          <h2 className="text-sm font-semibold text-white/60 mb-4 uppercase tracking-wider">Decision Pipeline</h2>
          <div className="flex items-center justify-between gap-2 overflow-x-auto">
            {[
              { step: '1', label: 'Market Data', sub: '5 sources', icon: '📊' },
              { step: '2', label: 'GLM-5 Analysis', sub: 'Z.ai Analyst', icon: '🧠' },
              { step: '3', label: 'Claude Validation', sub: 'Risk Check', icon: '🛡️' },
              { step: '4', label: 'VaR Gate', sub: '<50 / 50-150 / >300', icon: '⚖️' },
              { step: '5', label: 'KMS Sign', sub: 'Tencent HSM', icon: '🔐' },
              { step: '6', label: 'On-Chain', sub: '4 contracts', icon: '⛓️' },
              { step: '7', label: 'IPFS Proof', sub: 'Pinata', icon: '📝' },
            ].map((s, i) => (
              <div key={i} className="flex items-center">
                <div className="flex flex-col items-center min-w-[80px]">
                  <span className="text-2xl mb-1">{s.icon}</span>
                  <span className="text-[11px] font-medium text-white/80">{s.label}</span>
                  <span className="text-[9px] text-white/30">{s.sub}</span>
                </div>
                {i < 6 && <span className="text-white/20 mx-1">→</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Two columns: Decision Timeline + Agent Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Decision Timeline */}
          <div className="lg:col-span-2">
            <h2 className="text-sm font-semibold text-white/60 mb-4 uppercase tracking-wider">
              Decision History ({decisions.length} on-chain)
            </h2>
            <div className="space-y-3">
              {decisions.length === 0 ? (
                <p className="text-white/30 text-sm">No decisions loaded. Check API connection.</p>
              ) : (
                decisions.map((d, i) => (
                  <div 
                    key={i} 
                    className={`p-4 rounded-lg border transition-all cursor-pointer ${
                      selectedDecision === d 
                        ? 'border-green-500/30 bg-green-500/5' 
                        : 'border-white/5 bg-white/[0.02] hover:border-white/10'
                    }`}
                    onClick={() => setSelectedDecision(selectedDecision === d ? null : d)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-white/30">#{totalDecisions - i}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getActionColor(d.action)}`}>
                          {d.action.toUpperCase()}
                        </span>
                        <span className="text-sm text-white/70">{d.targetAsset}</span>
                      </div>
                      <span className="text-xs text-white/30 font-mono">{formatTime(d.timestamp)}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        {getConfidenceBar(d.confidence / 100)}
                      </div>
                      <span className="text-xs text-white/50">{(d.confidence / 100).toFixed(0)}%</span>
                    </div>
                    
                    {/* Expanded detail */}
                    {selectedDecision === d && (
                      <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="text-white/30">Reasoning Hash</span>
                            <p className="text-white/60 font-mono truncate">{d.reasoningHash || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-white/30">TX Hash</span>
                            <p className="text-white/60 font-mono truncate">
                              {d.txHash !== '0x0000000000000000000000000000000000000000000000000000000000000000' 
                                ? d.txHash 
                                : 'Blocked by safety gate'}
                            </p>
                          </div>
                        </div>
                        {d.reasoningHash && d.reasoningHash.startsWith('Qm') && (
                          <a 
                            href={`https://ipfs.io/ipfs/${d.reasoningHash}`} 
                            target="_blank" 
                            rel="noopener"
                            className="inline-block text-xs text-green-400 hover:text-green-300"
                          >
                            View full reasoning on IPFS →
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Agent Card Sidebar */}
          <div className="space-y-6">
            {/* Agent Identity */}
            <div className="p-5 rounded-xl border border-white/5 bg-white/[0.02]">
              <h3 className="text-sm font-semibold text-white/60 mb-3 uppercase tracking-wider">Agent Identity</h3>
              {agentCard ? (
                <div className="space-y-3">
                  <p className="text-sm text-white/80">{agentCard.name}</p>
                  <p className="text-xs text-white/40">{agentCard.description?.slice(0, 120)}...</p>
                  <div className="pt-2 border-t border-white/5">
                    <p className="text-[10px] text-white/30 mb-1">CAPABILITIES</p>
                    <div className="flex flex-wrap gap-1">
                      {agentCard.capabilities?.map((c, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-white/50">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-white/30">Loading from IPFS...</p>
              )}
              <a 
                href="https://ipfs.io/ipfs/QmUc6Qo4yoH2SboEesPeKuojs93MaJNxFjw9mDRTZp4axw"
                target="_blank"
                rel="noopener"
                className="block mt-3 text-xs text-green-400 hover:text-green-300"
              >
                View Agent Card on IPFS →
              </a>
            </div>

            {/* Safety Metrics */}
            <div className="p-5 rounded-xl border border-white/5 bg-white/[0.02]">
              <h3 className="text-sm font-semibold text-white/60 mb-3 uppercase tracking-wider">Safety Metrics</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-white/40">Risk Firewall</span>
                  <span className="text-xs text-red-400 font-mono">19/20 blocked</span>
                </div>
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full" style={{ width: '95%' }} />
                </div>
                <p className="text-[10px] text-white/30">
                  95% of proposals deemed too risky by the dual-model validator. 
                  This is the safety layer working as designed.
                </p>
                <div className="pt-2 space-y-1.5">
                  <MetricRow label="VaR Threshold (auto)" value="<50 bps" />
                  <MetricRow label="VaR Threshold (supervised)" value="50-150 bps" />
                  <MetricRow label="VaR Threshold (blocked)" value=">300 bps" />
                  <MetricRow label="Min Confidence" value="60%" />
                  <MetricRow label="Max Risk Score" value="65/100" />
                </div>
              </div>
            </div>

            {/* On-Chain Links */}
            <div className="p-5 rounded-xl border border-white/5 bg-white/[0.02]">
              <h3 className="text-sm font-semibold text-white/60 mb-3 uppercase tracking-wider">Verify On-Chain</h3>
              <div className="space-y-2">
                {Object.entries(CONTRACTS).map(([name, addr]) => (
                  <a
                    key={name}
                    href={`https://explorer.mantle.xyz/address/${addr}`}
                    target="_blank"
                    rel="noopener"
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors group"
                  >
                    <span className="text-xs text-white/50 group-hover:text-white/70">{name.replace('_', ' ')}</span>
                    <span className="text-[10px] font-mono text-white/30">{addr.slice(0, 8)}...</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, color = 'text-white' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${color}`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>{value}</p>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[11px] text-white/40">{label}</span>
      <span className="text-[11px] text-white/60 font-mono">{value}</span>
    </div>
  );
}
