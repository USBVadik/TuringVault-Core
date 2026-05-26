'use client';

import { useState } from 'react';

type ChallengeType = 'flash_crash' | 'pump_signal' | 'oracle_conflict' | 'sybil_consensus';

const CHALLENGE_TYPES: { id: ChallengeType; label: string; color: string }[] = [
  { id: 'flash_crash', label: '⚡ Flash Crash', color: 'red' },
  { id: 'pump_signal', label: '🚀 Pump & Dump', color: 'green' },
  { id: 'oracle_conflict', label: '🔮 Oracle Manipulation', color: 'purple' },
  { id: 'sybil_consensus', label: '🤖 Sybil Consensus', color: 'yellow' },
];

// ─── Response shapes ──────────────────────────────────────────────────

type LiveAgent = {
  model: string;
  action?: string | null;
  targetAsset?: string | null;
  approved?: boolean | null;
  vote?: string | null;
  confidence: number | null;
  reasoning: string | null;
  riskFactors?: string[];
  flaggedIssues?: string[];
  recommendation?: string | null;
  riskScore?: number | null;
};

type LiveResponse = {
  mode: 'LIVE_MULTI_AGENT';
  challenge: { type: string; params: Record<string, unknown>; injected: { type: string; appliedAt: string; originalEthPrice: number } };
  agents: { analyst: LiveAgent; validator: LiveAgent; arbiter: LiveAgent | null };
  pipelinePath: 'analyst-validator' | 'analyst-validator-arbiter';
  consensus: boolean;
  decisionTier: string;
  disagreementSignal: boolean;
  disagreementSummary: string | null;
  verdict: { blocked: boolean; label: string };
  ipfsCid: string | null;
  onChain:
    | { anchored: true; txHash: string; blockNumber: number; mantlescan: string }
    | { skipped: true; reason: string };
  timing_ms: { decision: number; total: number };
  on_chain_proof?: { verified: boolean; totalProposals?: number; totalRejected?: number; blockRate?: string; network?: string };
  budget?: { used: number; cap: number; remaining: number };
};

type PreviewResponse = {
  mode: 'DETERMINISTIC_RULES';
  challenge: { name: string; description: string; attack_vector: string; fake_signal: object; expected_behavior: string; var_bps: number };
  result: { blocked: boolean; confidence: number; reasoning: string; gates: string[]; revert_reason: string };
  agent_response: { detected: boolean; action: string; reasoning: string; confidence_in_block: number; safety_gates_triggered: string[] };
  verification: { contract: string; method: string; would_revert: boolean; reason: string; var_bps: number; max_allowed_bps: number };
  on_chain_proof?: { verified: boolean; totalProposals?: number; totalRejected?: number; blockRate?: string; network?: string };
  note?: string;
};

type ApiError = { error: string; message?: string; retryAfter?: number };
type ApiResponse = LiveResponse | PreviewResponse | ApiError;

function isLive(r: ApiResponse): r is LiveResponse {
  return 'mode' in r && r.mode === 'LIVE_MULTI_AGENT';
}
function isPreview(r: ApiResponse): r is PreviewResponse {
  return 'mode' in r && r.mode === 'DETERMINISTIC_RULES';
}
function isError(r: ApiResponse): r is ApiError {
  return 'error' in r;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function fmtPct(n: number | null | undefined, decimals = 0): string {
  if (n == null) return '—';
  return `${(n * 100).toFixed(decimals)}%`;
}

function fmtMs(ms: number | undefined): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

// ─── Page ─────────────────────────────────────────────────────────────

export default function ChallengePage() {
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<ChallengeType | ''>('');

  async function runChallenge(type: ChallengeType) {
    setSelectedType(type);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/challenge?type=${type}`);
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ error: 'Failed to reach agent' });
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <a href="/" className="text-xs text-white/30 hover:text-white/60 mb-4 block">← Back to Dashboard</a>
          <h1 className="text-3xl font-bold mb-2">
            <span className="text-red-400">⚔️</span> Adversarial Challenge
          </h1>
          <p className="text-white/40 text-sm">
            Inject adversarial market signals into the agent&apos;s pipeline. Watch the same multi-agent reasoning
            chain that drives production decisions.
            <br />
            <span className="text-white/20">Human vs AI — can you trick it into a bad allocation?</span>
          </p>
        </div>

        {/* Mode banner — pulled from the response when present */}
        {result && !isError(result) && (
          <ModeBanner mode={isLive(result) ? 'LIVE_MULTI_AGENT' : 'DETERMINISTIC_RULES'} />
        )}

        {/* Challenge Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 mt-4">
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
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-8 text-center">
            <div className="animate-pulse text-white/50">
              Running attack through live multi-agent pipeline…
            </div>
            <div className="text-[11px] text-white/25 mt-3 font-mono">
              analyst (GLM-5) → validator (Claude 4.6) → arbiter (Gemini 3.5)
            </div>
            <div className="text-[10px] text-white/20 mt-1">
              Real model calls. ~8–12s round-trip.
            </div>
          </div>
        )}

        {/* Error */}
        {result && isError(result) && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/[0.04] p-6">
            <div className="text-red-400 text-sm font-bold mb-1">⚠ {result.error}</div>
            {result.message && <div className="text-white/40 text-xs">{result.message}</div>}
            {result.retryAfter && (
              <div className="text-white/30 text-[11px] mt-2">Retry after ~{result.retryAfter}s</div>
            )}
          </div>
        )}

        {/* Live result */}
        {result && isLive(result) && <LiveResultPanel data={result} />}

        {/* Preview / deterministic-rules result */}
        {result && isPreview(result) && <PreviewResultPanel data={result} />}

        {/* Default explanation */}
        {!result && !loading && (
          <div className="p-8 rounded-lg border border-white/[0.04] bg-white/[0.01] text-center">
            <p className="text-white/30 text-sm">
              Select an attack vector above to challenge the agent.<br />
              The pipeline must detect and block every adversarial signal — proving its reasoning is sound.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────

function ModeBanner({ mode }: { mode: 'LIVE_MULTI_AGENT' | 'DETERMINISTIC_RULES' }) {
  if (mode === 'LIVE_MULTI_AGENT') {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.04] p-3 mb-2 flex items-center gap-3">
        <span className="text-lg">🟢</span>
        <div>
          <div className="text-emerald-300 text-xs font-bold uppercase tracking-wider">LIVE · multi-agent pipeline</div>
          <div className="text-white/40 text-[11px]">Verbatim reasoning from GLM-5, Claude 4.6, Gemini 3.5. Same code as production.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/[0.04] p-3 mb-2 flex items-center gap-3">
      <span className="text-lg">🟡</span>
      <div>
        <div className="text-yellow-300 text-xs font-bold uppercase tracking-wider">PREVIEW · deterministic rules</div>
        <div className="text-white/40 text-[11px]">Live multi-agent mode is paused. The gates shown are the same rules enforced in production.</div>
      </div>
    </div>
  );
}

function VerdictBanner({ blocked, label, tier }: { blocked: boolean; label: string; tier?: string }) {
  return (
    <div className={`p-6 rounded-lg border ${blocked ? 'border-emerald-500/30 bg-emerald-500/[0.03]' : 'border-red-500/30 bg-red-500/[0.03]'}`}>
      <div className="flex items-center gap-3 mb-1">
        <span className="text-2xl">{blocked ? '🛡️' : '💀'}</span>
        <div className={`text-lg font-bold ${blocked ? 'text-emerald-400' : 'text-red-400'}`}>{label}</div>
      </div>
      {tier && (
        <div className="text-[11px] text-white/35 font-mono ml-9">decisionTier: {tier}</div>
      )}
    </div>
  );
}

function AgentCard({
  role,
  highlight,
  children,
}: {
  role: string;
  highlight?: 'disagree' | 'consensus' | null;
  children: React.ReactNode;
}) {
  const borderClass =
    highlight === 'disagree'
      ? 'border-yellow-500/30 bg-yellow-500/[0.03]'
      : highlight === 'consensus'
      ? 'border-emerald-500/20'
      : 'border-white/[0.06]';
  return (
    <div className={`relative pl-8 pb-4`}>
      <div className="absolute left-2 top-1.5 w-2 h-2 rounded-full bg-white/30" />
      <div className="absolute left-[11px] top-3 bottom-0 w-px bg-white/10" />
      <div className={`rounded-lg border ${borderClass} bg-white/[0.02] p-4`}>
        <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2 font-bold">{role}</div>
        {children}
      </div>
    </div>
  );
}

function LiveResultPanel({ data }: { data: LiveResponse }) {
  return (
    <div className="space-y-3">
      <VerdictBanner blocked={data.verdict.blocked} label={data.verdict.label} tier={data.decisionTier} />

      {data.disagreementSignal && data.disagreementSummary && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/[0.04] p-3">
          <div className="text-yellow-300 text-xs font-bold uppercase mb-1">Models disagreed</div>
          <div className="text-white/60 text-[11px]">{data.disagreementSummary}</div>
        </div>
      )}

      {/* Injected attack summary */}
      {data.challenge.injected && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2 font-bold">Injected Attack</div>
          <div className="text-[11px] font-mono text-white/50 space-y-0.5">
            <div>type: <span className="text-red-300">{data.challenge.injected.type}</span></div>
            <div>baseline ETH: <span className="text-white/70">${data.challenge.injected.originalEthPrice?.toFixed(2)}</span></div>
            <div>at: <span className="text-white/70">{data.challenge.injected.appliedAt}</span></div>
          </div>
        </div>
      )}

      {/* Pipeline timeline */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-4">
        <div className="text-[10px] text-white/40 uppercase tracking-wider mb-3 font-bold">
          Pipeline · {data.pipelinePath}
        </div>

        <AgentCard role={`ANALYST · ${data.agents.analyst.model}`}>
          <div className="text-[11px] font-mono text-white/40 mb-1">
            {data.agents.analyst.action} {data.agents.analyst.targetAsset} · confidence {fmtPct(data.agents.analyst.confidence)}
          </div>
          <p className="text-sm text-white/70 leading-relaxed">{data.agents.analyst.reasoning}</p>
        </AgentCard>

        <AgentCard
          role={`VALIDATOR · ${data.agents.validator.model}`}
          highlight={data.disagreementSignal ? 'disagree' : null}
        >
          <div className="text-[11px] font-mono text-white/40 mb-1">
            {data.agents.validator.approved ? '✅ APPROVED' : '❌ REJECTED'} · confidence {fmtPct(data.agents.validator.confidence)} · risk {data.agents.validator.riskScore}
          </div>
          <p className="text-sm text-white/70 leading-relaxed mb-2">{data.agents.validator.reasoning}</p>
          {data.agents.validator.flaggedIssues && data.agents.validator.flaggedIssues.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {data.agents.validator.flaggedIssues.map((f, i) => (
                <span key={i} className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded text-[10px] text-red-300 font-mono">
                  ⚠ {f}
                </span>
              ))}
            </div>
          )}
        </AgentCard>

        {data.agents.arbiter && (
          <AgentCard role={`ARBITER · ${data.agents.arbiter.model}`}>
            <div className="text-[11px] font-mono text-white/40 mb-1">
              vote: {data.agents.arbiter.vote} · confidence {fmtPct(data.agents.arbiter.confidence)}
            </div>
            <p className="text-sm text-white/70 leading-relaxed">{data.agents.arbiter.reasoning}</p>
          </AgentCard>
        )}
      </div>

      {/* On-chain anchor */}
      {data.onChain && 'anchored' in data.onChain && data.onChain.anchored && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.04] p-4">
          <div className="text-emerald-300 text-xs font-bold uppercase mb-2">✓ Anchored on Mantle</div>
          <a href={data.onChain.mantlescan} target="_blank" rel="noopener noreferrer" className="text-[11px] font-mono text-emerald-300/80 underline break-all">
            {data.onChain.txHash}
          </a>
          <div className="text-[10px] text-white/30 mt-1">block {data.onChain.blockNumber}</div>
        </div>
      )}
      {data.onChain && 'skipped' in data.onChain && (
        <div className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-3 text-center">
          <span className="text-[11px] text-white/30">On-chain anchor: {data.onChain.reason}</span>
        </div>
      )}

      {/* IPFS pin */}
      {data.ipfsCid && (
        <div className="text-[10px] text-white/25 font-mono text-center">
          IPFS proof: {data.ipfsCid}
        </div>
      )}

      {/* On-chain verification block (live read of ValidationRegistry) */}
      {data.on_chain_proof?.verified && (
        <div className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-3 text-center">
          <div className="text-[10px] text-white/30">
            ValidationRegistry · {data.on_chain_proof.totalProposals} proposals · {data.on_chain_proof.totalRejected} rejected ({data.on_chain_proof.blockRate} block rate)
          </div>
          <div className="text-[10px] text-white/20 mt-0.5">Network: {data.on_chain_proof.network}</div>
        </div>
      )}

      {/* Timing + budget */}
      <div className="flex justify-between items-center text-[10px] text-white/25 font-mono px-1 pt-1">
        <span>round-trip: {fmtMs(data.timing_ms.total)} (decision: {fmtMs(data.timing_ms.decision)})</span>
        {data.budget && (
          <span>daily budget: {data.budget.used}/{data.budget.cap} used · {data.budget.remaining} left</span>
        )}
      </div>
    </div>
  );
}

function PreviewResultPanel({ data }: { data: PreviewResponse }) {
  return (
    <div className="space-y-3">
      <VerdictBanner
        blocked={data.result.blocked}
        label={data.result.blocked ? 'ATTACK BLOCKED' : 'ATTACK SUCCEEDED'}
      />

      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2 font-bold">{data.challenge.name}</div>
        <p className="text-sm text-white/50 mb-3">{data.challenge.description}</p>
        <div className="bg-black/30 rounded p-3 font-mono text-xs text-red-300/80 mb-3">
          <div className="text-white/30 mb-1">// Injected fake signal:</div>
          <pre className="whitespace-pre-wrap break-all">{JSON.stringify(data.challenge.fake_signal, null, 2)}</pre>
        </div>
      </div>

      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2 font-bold">Deterministic Reasoning</div>
        <p className="text-sm text-white/70 leading-relaxed mb-3">{data.result.reasoning}</p>
        <div className="text-[10px] text-white/40 uppercase mb-2 font-bold">Safety Gates</div>
        <div className="flex flex-wrap gap-1.5">
          {data.result.gates.map((g, i) => (
            <span key={i} className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[10px] text-emerald-300 font-mono">
              ✓ {g}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2 font-bold">On-Chain Verification</div>
        <div className="font-mono text-[11px] space-y-1 text-white/50">
          <div>contract: <span className="text-purple-300">{data.verification.contract}</span></div>
          <div>method: <span className="text-blue-300">{data.verification.method}</span></div>
          <div>VaR of attack: <span className="text-red-300">{data.verification.var_bps} bps</span> → max allowed: <span className="text-emerald-300">{data.verification.max_allowed_bps} bps</span></div>
          <div>would revert: <span className="text-red-300">{data.verification.would_revert ? 'YES' : 'NO'}</span></div>
          <div>reason: <span className="text-yellow-300">{data.verification.reason}</span></div>
        </div>
      </div>

      {data.on_chain_proof?.verified && (
        <div className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-3 text-center">
          <div className="text-[10px] text-emerald-400/80 font-bold uppercase mb-0.5">✓ Live Contract Verified</div>
          <div className="text-[10px] text-white/30">
            ValidationRegistry · {data.on_chain_proof.totalProposals} proposals · {data.on_chain_proof.totalRejected} rejected ({data.on_chain_proof.blockRate} block rate)
          </div>
          <div className="text-[10px] text-white/20 mt-0.5">Network: {data.on_chain_proof.network}</div>
        </div>
      )}

      <div className="text-[10px] text-white/25 font-mono text-center pt-1">
        {data.note}
      </div>
    </div>
  );
}
