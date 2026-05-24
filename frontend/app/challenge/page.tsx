'use client';

import { useState } from 'react';

const CHALLENGE_TYPES = [
  { id: 'flash_crash', label: '⚡ Flash Crash', color: 'red' },
  { id: 'pump_signal', label: '🚀 Pump & Dump', color: 'green' },
  { id: 'oracle_conflict', label: '🔮 Oracle Manipulation', color: 'purple' },
  { id: 'sybil_consensus', label: '🤖 Sybil Consensus', color: 'yellow' },
];

export default function ChallengePage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState('');

  async function runChallenge(type: string) {
    setSelectedType(type);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/challenge?type=${type}`);
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setResult({ error: 'Failed to reach agent' });
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <a href="/" className="text-xs text-white/30 hover:text-white/60 mb-4 block">← Back to Dashboard</a>
          <h1 className="text-3xl font-bold mb-2">
            <span className="text-red-400">⚔️</span> Adversarial Challenge
          </h1>
          <p className="text-white/40 text-sm">
            Test the agent&apos;s defenses. Inject fake market signals and see if the AI detects & blocks them.
            <br />
            <span className="text-white/20">Human vs AI — can you trick it into a bad trade?</span>
          </p>
        </div>

        {/* Challenge Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {CHALLENGE_TYPES.map(c => (
            <button
              key={c.id}
              onClick={() => runChallenge(c.id)}
              disabled={loading}
              className={`p-4 rounded-lg border transition-all text-left
                ${selectedType === c.id ? 'border-white/30 bg-white/[0.06]' : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'}
                ${loading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
              `}
            >
              <div className="text-lg mb-1">{c.label}</div>
              <div className="text-[10px] text-white/30 uppercase">Attack Vector</div>
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="glass-card p-8 text-center">
            <div className="animate-pulse text-white/40">
              ⏳ Injecting adversarial signal into agent pipeline...
            </div>
          </div>
        )}

        {/* Result */}
        {result && !result.error && (
          <div className="space-y-4">
            {/* Detection Status */}
            <div className={`p-6 rounded-lg border ${result.result.blocked ? 'border-green-500/30 bg-green-500/[0.03]' : 'border-red-500/30 bg-red-500/[0.03]'}`}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{result.result.blocked ? '🛡️' : '💀'}</span>
                <div>
                  <div className={`text-lg font-bold ${result.result.blocked ? 'text-green-400' : 'text-red-400'}`}>
                    {result.result.blocked ? 'ATTACK BLOCKED' : 'ATTACK SUCCEEDED'}
                  </div>
                  <div className="text-xs text-white/40">
                    Confidence: {result.result.confidence}%
                  </div>
                </div>
              </div>
            </div>

            {/* Challenge Details */}
            <div className="p-6 rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <h3 className="text-xs font-bold text-white/60 uppercase mb-3">Attack: {result.challenge.name}</h3>
              <p className="text-sm text-white/50 mb-4">{result.challenge.description}</p>
              
              <div className="bg-black/30 rounded p-3 font-mono text-xs text-red-300/80 mb-4">
                <div className="text-white/30 mb-1">// Injected fake signal:</div>
                <pre>{JSON.stringify(result.challenge.fake_signal, null, 2)}</pre>
              </div>
            </div>

            {/* Agent Reasoning */}
            <div className="p-6 rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <h3 className="text-xs font-bold text-white/60 uppercase mb-3">Agent Reasoning</h3>
              <p className="text-sm text-white/70 leading-relaxed mb-4">{result.result.reasoning}</p>
              
              <h4 className="text-xs font-bold text-white/40 uppercase mb-2">Safety Gates Triggered:</h4>
              <div className="flex flex-wrap gap-2">
                {result.result.gates.map((g: string, i: number) => (
                  <span key={i} className="px-2 py-1 bg-green-500/10 border border-green-500/20 rounded text-[10px] text-green-400 font-mono">
                    ✓ {g}
                  </span>
                ))}
              </div>
            </div>

            {/* On-Chain Verification */}
            <div className="p-6 rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <h3 className="text-xs font-bold text-white/60 uppercase mb-3">On-Chain Verification</h3>
              <div className="font-mono text-xs space-y-1 text-white/50">
                <div>Contract: <span className="text-purple-300">{result.verification.contract}</span></div>
                <div>Method: <span className="text-blue-300">{result.verification.method}</span></div>
                <div>VaR of Attack: <span className="text-red-300">{result.verification.var_bps} bps</span> → Max Allowed: <span className="text-green-300">{result.verification.max_allowed_bps} bps</span></div>
                <div>Would Revert: <span className="text-red-300">{result.verification.would_revert ? 'YES — BLOCKED' : 'NO'}</span></div>
                <div>Reason: <span className="text-yellow-300">{result.verification.reason || result.verification.revert_reason}</span></div>
              </div>
              {result.verification.on_chain_proof?.verified && (
                <div className="mt-4 pt-3 border-t border-white/5 space-y-1 text-[10px]">
                  <div className="text-green-400/80 font-bold uppercase">✓ Live Contract Verified</div>
                  <div className="text-white/30">
                    ValidationRegistry: {result.verification.on_chain_proof.totalProposals} proposals, {result.verification.on_chain_proof.totalRejected} rejected ({result.verification.on_chain_proof.blockRate} block rate)
                  </div>
                  <div className="text-white/20">Network: {result.verification.on_chain_proof.network}</div>
                </div>
              )}
            </div>

            {/* Mode indicator */}
            <div className="p-3 rounded-lg border border-white/[0.04] bg-white/[0.01] text-center">
              <span className="text-[10px] text-white/25 font-mono">
                MODE: {result.mode} · These are the SAME rules enforced on every live decision
              </span>
            </div>
          </div>
        )}

        {/* Explanation */}
        {!result && !loading && (
          <div className="p-8 rounded-lg border border-white/[0.04] bg-white/[0.01] text-center">
            <p className="text-white/30 text-sm">
              Select an attack vector above to challenge the agent.<br />
              The AI must detect and block every adversarial signal — proving its reasoning is sound.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
