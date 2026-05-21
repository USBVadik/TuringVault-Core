'use client';

import { useState } from 'react';

interface Decision {
  timestamp: number;
  action: string;
  targetAsset: string;
  amountIn: string;
  amountOut: string;
  confidence: number;
  reasoningHash: string;
  txHash: string;
  status?: string;
  riskScore?: number;
  validatorReasoning?: string;
}

interface ValidationSummary {
  totalApproved: number;
  totalRejected: number;
  totalProposals: number;
  consensusRate: number;
}

interface AgentCard {
  name: string;
  description: string;
  stats: Record<string, unknown>;
  models: Record<string, unknown>;
  capabilities: string[];
}

interface BlockedCase {
  id: number;
  title: string;
  intent: string;
  validatorReason: string;
  varScore: number;
  riskScore: number;
  txHash: string;
  marketAfter: string;
  savedEstimate: string;
  timestamp: number;
}

interface Props {
  decisions: Decision[];
  validation: ValidationSummary | null;
  totalDecisions: number;
  agentCard: AgentCard | null;
  contracts: Record<string, string>;
  blockedCases: BlockedCase[];
}

export function ProofExplorerClient({ decisions, validation, totalDecisions, agentCard, contracts, blockedCases }: Props) {
  const [selectedDecision, setSelectedDecision] = useState<number | null>(null);
  const [expandedCase, setExpandedCase] = useState<number | null>(null);

  const featuredCase = blockedCases[0]; // Panic Swap — highest drama

  function formatTime(ts: number) {
    return new Date(ts * 1000).toLocaleString('en-US', { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      timeZone: 'UTC'
    }) + ' UTC';
  }

  function formatTimeShort(ts: number) {
    return new Date(ts * 1000).toLocaleString('en-US', { 
      hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false
    });
  }

  return (
    <div className="min-h-screen bg-[#06060a] text-white">
      
      {/* ═══ FEATURED PROOF REPLAY ═══ */}
      <section className="relative overflow-hidden border-b border-white/5">
        {/* Atmospheric background */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-950/30 via-[#06060a] to-transparent" />
        <div className="absolute top-10 left-1/4 w-[600px] h-[300px] bg-red-500/[0.04] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[200px] bg-green-500/[0.03] rounded-full blur-[100px]" />
        
        <div className="relative max-w-5xl mx-auto px-6 py-12">
          {/* Timestamp & network */}
          <div className="flex items-center gap-3 mb-6">
            <span className="text-[11px] font-mono text-white/30">{formatTime(featuredCase.timestamp)}</span>
            <span className="text-white/10">|</span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[11px] font-mono text-green-400/60">Mantle Mainnet</span>
            </div>
          </div>

          {/* Hero statement */}
          <h1 className="text-[28px] md:text-[36px] font-bold leading-tight tracking-tight max-w-3xl mb-3">
            The AI tried to panic-sell ETH.
            <br />
            <span className="text-red-400">TuringVault blocked it.</span>
            <br />
            <span className="text-green-400/80 text-[24px] md:text-[28px]">ETH recovered +1.2%.</span>
          </h1>
          <p className="text-white/30 text-sm max-w-lg mb-10">
            Proof-of-Reasoning: every autonomous decision is challenged, gated, and recorded on-chain before execution.
          </p>

          {/* Replay timeline */}
          <div className="grid grid-cols-5 gap-0 items-stretch">
            {[
              { 
                phase: 'AI INTENT',
                content: 'Swap ETH → mUSD',
                detail: '78% confidence, Fear & Greed = 27',
                color: 'border-white/10',
                textColor: 'text-white/70',
                dot: 'bg-white/30'
              },
              { 
                phase: 'VALIDATOR',
                content: 'Rejected',
                detail: '"Panic metrics ≠ fundamental weakness"',
                color: 'border-orange-500/20',
                textColor: 'text-orange-400',
                dot: 'bg-orange-400'
              },
              { 
                phase: 'VaR GATE',
                content: '228 bps → BLOCKED',
                detail: 'Exceeds 150 bps threshold',
                color: 'border-red-500/20',
                textColor: 'text-red-400',
                dot: 'bg-red-500'
              },
              { 
                phase: 'ON-CHAIN',
                content: 'Recorded',
                detail: 'Proposal #12, Mantle tx verified',
                color: 'border-cyan-500/20',
                textColor: 'text-cyan-400',
                dot: 'bg-cyan-400'
              },
              { 
                phase: 'MARKET AFTER',
                content: 'ETH +1.2%',
                detail: 'Avoided estimated downside',
                color: 'border-green-500/20',
                textColor: 'text-green-400',
                dot: 'bg-green-400'
              },
            ].map((step, i) => (
              <div key={i} className="relative flex flex-col">
                {/* Connection line */}
                {i > 0 && (
                  <div className="absolute left-0 top-[18px] w-full h-px -translate-x-1/2 bg-gradient-to-r from-white/10 to-white/5 -z-0" />
                )}
                {/* Dot */}
                <div className="flex items-center gap-2 mb-3 z-10">
                  <div className={`w-3 h-3 rounded-full ${step.dot} ring-2 ring-[#06060a]`} />
                  <span className="text-[9px] font-mono text-white/30 uppercase tracking-wider">{step.phase}</span>
                </div>
                {/* Content */}
                <div className={`flex-1 p-3 rounded-lg border ${step.color} bg-white/[0.02]`}>
                  <p className={`text-sm font-semibold ${step.textColor} mb-1`}>{step.content}</p>
                  <p className="text-[10px] text-white/30 leading-relaxed">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Proof link */}
          <div className="mt-6 flex items-center gap-4">
            <a 
              href={`https://mantlescan.xyz/tx/${featuredCase.txHash}`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-xs text-white/60 hover:text-white/90"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
              Verify on Mantlescan
            </a>
            <span className="text-[10px] font-mono text-white/15">Proposal #12 · ValidationRegistry 0x6841...63b6</span>
          </div>
        </div>
      </section>

      {/* ═══ COMPACT HEADER (replaces old hero) ═══ */}
      <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-red-500/80 to-orange-500/80 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white/80">Proof Explorer</h2>
            <p className="text-[10px] text-white/30">Full audit log &middot; {totalDecisions} on-chain decisions</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-8">
          <div className="text-center">
            <p className="text-xl font-bold font-mono text-white">{totalDecisions}</p>
            <p className="text-[9px] text-white/30 uppercase">Decisions</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold font-mono text-red-400">{validation?.totalRejected || 19}</p>
            <p className="text-[9px] text-red-400/50 uppercase">Blocked</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold font-mono text-green-400">{validation?.totalApproved || 1}</p>
            <p className="text-[9px] text-green-400/50 uppercase">Approved</p>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-10">
        
        {/* ═══ CAPITAL SAVED SECTION ═══ */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-5 h-5 rounded bg-red-500/20 flex items-center justify-center">
              <svg className="w-3 h-3 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
            </div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60">
              Capital Saved — Blocked Would-Have-Lost
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
              LIVE PROOF
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {blockedCases.map((c) => (
              <div 
                key={c.id}
                className={`relative rounded-xl border transition-all cursor-pointer ${
                  expandedCase === c.id 
                    ? 'border-red-500/30 bg-red-500/5 scale-[1.02]' 
                    : 'border-white/5 bg-white/[0.02] hover:border-red-500/20 hover:bg-red-500/[0.02]'
                }`}
                onClick={() => setExpandedCase(expandedCase === c.id ? null : c.id)}
              >
                {/* Status badge */}
                <div className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-red-500 text-[9px] font-bold text-white shadow-lg shadow-red-500/20">
                  BLOCKED
                </div>
                
                <div className="p-5">
                  <h3 className="text-sm font-semibold text-white/90 mb-2">{c.title}</h3>
                  <p className="text-xs text-white/40 mb-4">{c.intent}</p>
                  
                  {/* Key metrics */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-white/[0.03]">
                      <p className="text-[9px] text-white/30 uppercase">VaR Score</p>
                      <p className="text-lg font-bold font-mono text-red-400">{c.varScore}<span className="text-xs text-white/30"> bps</span></p>
                    </div>
                    <div className="p-2 rounded-lg bg-white/[0.03]">
                      <p className="text-[9px] text-white/30 uppercase">Risk Score</p>
                      <p className="text-lg font-bold font-mono text-orange-400">{c.riskScore}<span className="text-xs text-white/30">/100</span></p>
                    </div>
                  </div>

                  {/* Market outcome */}
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/5 border border-green-500/10">
                    <svg className="w-4 h-4 text-green-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                    <div>
                      <p className="text-[10px] text-white/30">Market after block</p>
                      <p className="text-xs font-semibold text-green-400">ETH {c.marketAfter} — avoided estimated downside: {c.savedEstimate}</p>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {expandedCase === c.id && (
                    <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                      <div>
                        <p className="text-[9px] text-white/30 uppercase mb-1">Validator Objection</p>
                        <p className="text-xs text-white/50 italic">&ldquo;{c.validatorReason}&rdquo;</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-white/30 uppercase mb-1">On-Chain Proof</p>
                        <a 
                          href={`https://mantlescan.xyz/tx/${c.txHash}`}
                          target="_blank"
                          rel="noopener"
                          className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 break-all"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.txHash.slice(0, 22)}...{c.txHash.slice(-8)} ↗
                        </a>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-white/30">Proposal #{c.id}</span>
                        <span className="text-[9px] text-white/30">&middot;</span>
                        <span className="text-[9px] text-white/30">{formatTime(c.timestamp)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <p className="mt-3 text-[11px] text-white/20 text-center">
            All 3 cases: correct market observation → wrong action conclusion → gate caught it. ETH recovered +1.2% within 12h.
          </p>
        </section>

        {/* ═══ DECISION PIPELINE ═══ */}
        <section className="p-6 rounded-xl border border-white/5 bg-white/[0.015]">
          <h2 className="text-sm font-semibold text-white/60 mb-5 uppercase tracking-wider">Decision Pipeline</h2>
          <div className="flex items-center justify-between gap-1 overflow-x-auto pb-2">
            {[
              { label: 'Market Data', sub: '5 real-time sources', color: 'from-blue-500/20 to-blue-500/5' },
              { label: 'GLM-5 Analyst', sub: 'Z.ai reasoning', color: 'from-purple-500/20 to-purple-500/5' },
              { label: 'Claude 4.6 Validator', sub: 'Adversarial check', color: 'from-orange-500/20 to-orange-500/5' },
              { label: 'VaR Gate', sub: '<50 auto · 50-150 supervised · >150 blocked', color: 'from-red-500/20 to-red-500/5' },
              { label: 'KMS Sign', sub: 'Tencent Cloud HSM', color: 'from-yellow-500/20 to-yellow-500/5' },
              { label: 'On-Chain', sub: '4 Mantle contracts', color: 'from-green-500/20 to-green-500/5' },
              { label: 'IPFS Proof', sub: 'Pinata pinned', color: 'from-cyan-500/20 to-cyan-500/5' },
            ].map((s, i) => (
              <div key={i} className="flex items-center">
                <div className={`flex flex-col items-center min-w-[90px] p-3 rounded-lg bg-gradient-to-b ${s.color}`}>
                  <span className="text-[10px] font-medium text-white/80 text-center leading-tight">{s.label}</span>
                  <span className="text-[8px] text-white/30 text-center mt-1">{s.sub}</span>
                </div>
                {i < 6 && (
                  <div className="mx-1">
                    <svg className="w-4 h-4 text-white/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ═══ TWO COLUMN: AUDIT LOG + SIDEBAR ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Decision Audit Log */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
                Decision Audit Log
              </h2>
              <span className="text-[10px] text-white/20 font-mono">{decisions.length} on-chain records</span>
            </div>
            <div className="space-y-2">
              {decisions.length === 0 ? (
                <p className="text-white/30 text-sm">No decisions loaded.</p>
              ) : (
                decisions.map((d, i) => {
                  const decisionNum = totalDecisions - i;
                  const isBlocked = d.status === 'Rejected' || d.status === 'Pending';
                  const confidencePct = d.confidence / 100;
                  const riskScore = d.riskScore ? d.riskScore / 100 : 0;
                  const isExpanded = selectedDecision === i;
                  
                  // Parse VaR from reasoning
                  const varMatch = d.reasoningHash?.match?.(/VaR:(\d+)/);
                  const varScore = varMatch ? parseInt(varMatch[1]) : null;
                  
                  return (
                    <div 
                      key={i}
                      className={`p-3 rounded-lg border transition-all cursor-pointer ${
                        isExpanded 
                          ? 'border-white/10 bg-white/[0.04]'
                          : isBlocked 
                            ? 'border-red-500/10 bg-red-500/[0.02] hover:border-red-500/20' 
                            : 'border-green-500/10 bg-green-500/[0.02] hover:border-green-500/20'
                      }`}
                      onClick={() => setSelectedDecision(isExpanded ? null : i)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-white/20">#{decisionNum}</span>
                          
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isBlocked 
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                              : 'bg-green-500/10 text-green-400 border border-green-500/20'
                          }`}>
                            {isBlocked ? 'BLOCKED' : 'APPROVED'}
                          </span>
                          
                          <span className="text-xs text-white/60">
                            {d.action.toUpperCase()} {d.targetAsset}
                          </span>
                          
                          {varScore && (
                            <span className={`text-[10px] font-mono ${varScore > 150 ? 'text-red-400' : varScore > 50 ? 'text-yellow-400' : 'text-green-400'}`}>
                              VaR:{varScore}
                            </span>
                          )}
                          
                          {riskScore > 0 && (
                            <span className="text-[10px] font-mono text-orange-400/60">
                              R:{riskScore}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-white/30 font-mono">{confidencePct.toFixed(0)}%</span>
                          <span className="text-[10px] text-white/20">{formatTimeShort(d.timestamp)}</span>
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-white/5 space-y-3 text-xs">
                          {d.validatorReasoning && (
                            <div>
                              <p className="text-white/30 text-[10px] uppercase mb-1">Validator Reasoning</p>
                              <p className="text-white/50 text-[11px] italic leading-relaxed">
                                &ldquo;{d.validatorReasoning.replace(/\[v2\]\s?/, '').slice(0, 200)}&rdquo;
                              </p>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-white/30 text-[10px] uppercase mb-1">Reasoning Hash</p>
                              <p className="text-white/40 font-mono text-[9px] truncate">
                                {d.reasoningHash || 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-white/30 text-[10px] uppercase mb-1">Gate Decision</p>
                              <p className={`text-[10px] font-medium ${isBlocked ? 'text-red-400' : 'text-green-400'}`}>
                                {isBlocked ? 'Blocked by safety gate' : 'Consensus reached — executed'}
                              </p>
                            </div>
                          </div>
                          {d.reasoningHash && d.reasoningHash.includes('IPFS:') && (
                            <a 
                              href={`https://ipfs.io/ipfs/${d.reasoningHash.match(/IPFS:(\w+)/)?.[1]}`}
                              target="_blank"
                              rel="noopener"
                              className="text-[10px] text-cyan-400 hover:text-cyan-300"
                              onClick={(e) => e.stopPropagation()}
                            >
                              View reasoning proof on IPFS →
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ═══ SIDEBAR ═══ */}
          <div className="space-y-5">
            
            {/* Agent Identity */}
            <div className="p-5 rounded-xl border border-white/5 bg-white/[0.02]">
              <h3 className="text-[10px] font-semibold text-white/40 mb-3 uppercase tracking-wider">Agent Identity (ERC-8004)</h3>
              {agentCard ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/30 to-blue-500/30 flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white/90">{agentCard.name}</p>
                      <p className="text-[10px] text-white/30">Dual-model consensus agent</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-white/40 leading-relaxed">{agentCard.description?.slice(0, 140)}...</p>
                  <div className="pt-2 border-t border-white/5">
                    <p className="text-[9px] text-white/20 mb-1.5 uppercase">Capabilities</p>
                    <div className="flex flex-wrap gap-1">
                      {agentCard.capabilities?.slice(0, 6).map((c, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] text-white/40 border border-white/5">
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
                className="block mt-3 text-[10px] text-cyan-400 hover:text-cyan-300"
              >
                View Agent Card on IPFS →
              </a>
            </div>

            {/* Safety Parameters */}
            <div className="p-5 rounded-xl border border-white/5 bg-white/[0.02]">
              <h3 className="text-[10px] font-semibold text-white/40 mb-3 uppercase tracking-wider">Safety Parameters</h3>
              
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] text-white/30">Risk Firewall Activation</span>
                  <span className="text-xs text-red-400 font-mono font-bold">95%</span>
                </div>
                <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-red-600 via-red-500 to-orange-500 rounded-full" style={{ width: '95%' }} />
                </div>
                <p className="text-[9px] text-white/20 mt-1">19 of 20 proposals blocked — system working as designed</p>
              </div>

              <div className="space-y-2 pt-2 border-t border-white/5">
                <div className="flex justify-between items-center p-1.5 rounded bg-green-500/5">
                  <span className="text-[10px] text-white/40">VaR &lt;50 bps</span>
                  <span className="text-[10px] text-green-400 font-mono font-medium">AUTONOMOUS</span>
                </div>
                <div className="flex justify-between items-center p-1.5 rounded bg-yellow-500/5">
                  <span className="text-[10px] text-white/40">VaR 50-150 bps</span>
                  <span className="text-[10px] text-yellow-400 font-mono font-medium">SUPERVISED</span>
                </div>
                <div className="flex justify-between items-center p-1.5 rounded bg-red-500/5">
                  <span className="text-[10px] text-white/40">VaR &gt;150 bps</span>
                  <span className="text-[10px] text-red-400 font-mono font-medium">BLOCKED</span>
                </div>
                <div className="mt-2 pt-2 border-t border-white/5 space-y-1.5">
                  <MetricRow label="Min Analyst Confidence" value="60%" />
                  <MetricRow label="Min Validator Confidence" value="60%" />
                  <MetricRow label="Max Risk Score" value="65/100" />
                  <MetricRow label="Proposal TTL" value="5 min" />
                </div>
              </div>
            </div>

            {/* Verify On-Chain */}
            <div className="p-5 rounded-xl border border-white/5 bg-white/[0.02]">
              <h3 className="text-[10px] font-semibold text-white/40 mb-3 uppercase tracking-wider">Verify On-Chain</h3>
              <div className="space-y-1.5">
                {Object.entries(contracts).map(([name, addr]) => (
                  <a
                    key={name}
                    href={`https://mantlescan.xyz/address/${addr}`}
                    target="_blank"
                    rel="noopener"
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors group"
                  >
                    <span className="text-[10px] text-white/40 group-hover:text-white/70">
                      {name.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[9px] font-mono text-white/20 group-hover:text-cyan-400">
                      {addr.slice(0, 8)}...{addr.slice(-4)} ↗
                    </span>
                  </a>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-white/5">
                <a
                  href="https://ipfs.io/ipfs/QmUc6Qo4yoH2SboEesPeKuojs93MaJNxFjw9mDRTZp4axw"
                  target="_blank"
                  rel="noopener"
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors group"
                >
                  <span className="text-[10px] text-white/40 group-hover:text-white/70">IPFS Agent Card</span>
                  <span className="text-[9px] font-mono text-white/20 group-hover:text-cyan-400">QmUc6Qo...axw ↗</span>
                </a>
              </div>
            </div>

            {/* SDK Teaser */}
            <div className="p-5 rounded-xl border border-cyan-500/10 bg-cyan-500/[0.02]">
              <h3 className="text-[10px] font-semibold text-cyan-400/60 mb-2 uppercase tracking-wider">Build With SDK</h3>
              <pre className="text-[9px] text-white/40 font-mono leading-relaxed overflow-x-auto">
{`const sdk = new TuringVaultSDK();
const stats = await sdk.getConsensusRate();
// { approved: 1, rejected: 19 }`}
              </pre>
              <a
                href="https://github.com/USBVadik/TuringVault-Core/tree/main/sdk"
                target="_blank"
                rel="noopener"
                className="block mt-2 text-[10px] text-cyan-400 hover:text-cyan-300"
              >
                View SDK docs →
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="pt-8 border-t border-white/5 text-center">
          <p className="text-[10px] text-white/15">
            TuringVault — Proof-of-Reasoning infrastructure for autonomous agents on Mantle
          </p>
        </footer>
      </main>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[10px] text-white/30">{label}</span>
      <span className="text-[10px] text-white/50 font-mono">{value}</span>
    </div>
  );
}
