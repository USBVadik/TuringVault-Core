"use client";

/**
 * /challenge — Adversarial Challenge page (v2).
 *
 * Two modes:
 *   • LIVE_MULTI_AGENT — full timeline with verbatim reasoning from
 *     GLM-5 / Claude / Gemini, optional Mantlescan TX link.
 *   • DETERMINISTIC_RULES — preview mode with the original deterministic
 *     payload + yellow PREVIEW badge.
 *
 * Honesty rule: badge reflects reality (live vs preview) and no copy
 * claims "live" when the response says preview.
 *
 * Spec: human-vs-ai-challenge-v2 (R5, R6, R8).
 */

import { useState } from "react";
import { Zap, Rocket, Eye, Bot, Shield, Skull, Swords } from "lucide-react";

const CHALLENGE_TYPES = [
  { id: "flash_crash", label: "Flash Crash", icon: Zap, tone: "red" },
  { id: "pump_signal", label: "Pump & Dump", icon: Rocket, tone: "green" },
  {
    id: "oracle_conflict",
    label: "Oracle Manipulation",
    icon: Eye,
    tone: "purple",
  },
  {
    id: "sybil_consensus",
    label: "Sybil Consensus",
    icon: Bot,
    tone: "yellow",
  },
];

type LiveAgentTrace = {
  model: string;
  confidence?: number | null;
  reasoning?: string | null;
  timing_ms?: number | null;
  action?: string | null;
  targetAsset?: string | null;
  riskFactors?: string[];
  approved?: boolean | null;
  riskScore?: number | null;
  flaggedIssues?: string[];
  vote?: string | null;
};

type LiveResponse = {
  mode: "LIVE_MULTI_AGENT";
  challenge: {
    type: string;
    injected?: { originalEthPrice?: number | null; appliedAt?: string };
  };
  agents: {
    analyst: LiveAgentTrace;
    validator: LiveAgentTrace;
    arbiter: LiveAgentTrace | null;
  };
  pipelinePath: string;
  consensus: boolean;
  decisionTier: string;
  disagreementSignal: boolean;
  disagreementSummary: string | null;
  verdict: { blocked: boolean; label: string };
  ipfsCid: string | null;
  onChain:
    | {
        anchored: true;
        txHash: string;
        blockNumber: number;
        mantlescan: string;
      }
    | { skipped: true; reason: string; error?: string };
  timing_ms: { decision: number; total: number };
  budget?: { used: number; cap: number; remaining: number; resetAt: string };
};

type PreviewResponse = {
  mode: "DETERMINISTIC_RULES";
  challenge: {
    name: string;
    description: string;
    fake_signal: unknown;
    var_bps?: number;
  };
  result: {
    blocked: boolean;
    confidence: number;
    reasoning: string;
    gates: string[];
    revert_reason: string;
  };
  verification?: {
    contract?: string;
    method?: string;
    max_allowed_bps?: number;
    on_chain_proof?: {
      verified?: boolean;
      totalProposals?: number;
      totalRejected?: number;
      blockRate?: string;
      network?: string;
    };
  };
  note?: string;
};

type ApiError = {
  error: string;
  message?: string;
  retryAfter?: number;
  available?: string[];
};

type ApiResponse = LiveResponse | PreviewResponse | ApiError;

function isLive(r: ApiResponse): r is LiveResponse {
  return (r as LiveResponse).mode === "LIVE_MULTI_AGENT";
}
function isPreview(r: ApiResponse): r is PreviewResponse {
  return (r as PreviewResponse).mode === "DETERMINISTIC_RULES";
}
function isError(r: ApiResponse): r is ApiError {
  return typeof (r as ApiError).error === "string";
}

export default function ChallengePage() {
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<
    "analyst" | "validator" | "arbiter" | null
  >(null);
  const [selectedType, setSelectedType] = useState("");

  async function runChallenge(type: string) {
    setSelectedType(type);
    setLoading(true);
    setResult(null);
    setStage("analyst");
    // Animate stages so user knows pipeline is alive — actual stages run server-side.
    const t1 = setTimeout(() => setStage("validator"), 4000);
    const t2 = setTimeout(() => setStage("arbiter"), 8000);
    try {
      const res = await fetch(`/api/challenge?type=${type}`);
      const data: ApiResponse = await res.json();
      setResult(data);
    } catch {
      setResult({ error: "failed to reach agent" });
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      setLoading(false);
      setStage(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-8">
      <div className="max-w-[1200px] mx-auto anim-fade-up">
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Swords className="w-7 h-7 text-red-400" />
            Adversarial Challenge
          </h1>
          <p className="text-white/40 text-sm">
            Inject fake market signals and watch the multi-agent pipeline react.
            <br />
            <span className="text-white/20">
              Live mode: GLM-5 → Claude 4.6 → Gemini 3.5 Flash, full reasoning
              verbatim. Preview mode: deterministic-rules simulation.
            </span>
          </p>
        </div>

        {/* Attack buttons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {CHALLENGE_TYPES.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                onClick={() => runChallenge(c.id)}
                disabled={loading}
                className={`p-4 rounded-lg border transition-all text-left
                ${
                  selectedType === c.id
                    ? "border-white/30 bg-white/[0.04]"
                    : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                }
                ${loading ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
              >
                <div className="text-lg mb-1 flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  {c.label}
                </div>
                <div className="text-[10px] text-white/30 uppercase">
                  Attack Vector
                </div>
              </button>
            );
          })}
        </div>

        {/* Loading with 3-stage progress */}
        {loading && (
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-6">
            <div className="text-white/50 text-sm mb-4">
              Running attack through live multi-agent pipeline (this is a real
              round-trip, takes ~10s)…
            </div>
            <ProgressTimeline current={stage} />
          </div>
        )}

        {/* Result */}
        {result && !loading && (
          <div className="space-y-4">
            {isError(result) && (
              <div className="p-6 rounded-lg border border-red-500/30 bg-red-500/[0.03]">
                <div className="text-red-400 font-bold mb-1">
                  ⚠ {result.error}
                </div>
                {result.message && (
                  <div className="text-xs text-white/50 font-mono">
                    {result.message}
                  </div>
                )}
                {result.retryAfter && (
                  <div className="text-xs text-white/40 mt-2">
                    Retry after {result.retryAfter}s
                  </div>
                )}
              </div>
            )}

            {isLive(result) && <LiveResultBlock result={result} />}
            {isPreview(result) && (
              <PreviewResultBlock result={result} type={selectedType} />
            )}
          </div>
        )}

        {!result && !loading && (
          <div className="p-12 rounded-lg border border-white/[0.04] bg-white/[0.01] flex flex-col items-center text-center">
            <Shield className="w-12 h-12 text-white/10 mb-4" />
            <h3 className="text-white/50 text-sm font-medium mb-1">
              No attack selected
            </h3>
            <p className="text-white/25 text-xs max-w-sm">
              Choose an attack vector above to inject adversarial signals into
              the live multi-agent pipeline. The agent must detect and block
              every manipulated signal in real-time.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Live result rendering ───────────────────────────────────────

function LiveResultBlock({ result }: { result: LiveResponse }) {
  const blocked = result.verdict.blocked;
  return (
    <>
      <ModeBadge mode="LIVE_MULTI_AGENT" />

      {/* Verdict */}
      <div
        className={`p-6 rounded-lg border ${
          blocked
            ? "border-green-500/30 bg-green-500/[0.03]"
            : "border-red-500/30 bg-red-500/[0.03]"
        }`}
      >
        <div className="flex items-center gap-3 mb-2">
          {blocked ? (
            <Shield className="w-6 h-6 text-green-400" />
          ) : (
            <Skull className="w-6 h-6 text-red-400" />
          )}
          <div>
            <div
              className={`text-lg font-bold ${
                blocked ? "text-green-400" : "text-red-400"
              }`}
            >
              {result.verdict.label}
            </div>
            <div className="text-xs text-white/40 font-mono">
              tier: {result.decisionTier} · path: {result.pipelinePath} ·{" "}
              {result.timing_ms.total}ms total
            </div>
          </div>
        </div>
        {result.disagreementSignal && result.disagreementSummary && (
          <div className="mt-3 px-3 py-2 rounded bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-300/80">
            Models disagreed — {result.disagreementSummary}
          </div>
        )}
      </div>

      {/* Injected signal */}
      {result.challenge.injected && (
        <div className="p-6 rounded-lg border border-white/[0.06] bg-white/[0.02]">
          <h3 className="text-xs font-bold text-white/60 uppercase mb-3">
            Attack injected
          </h3>
          <div className="bg-black/30 rounded p-3 font-mono text-xs text-red-300/80">
            <pre>{JSON.stringify(result.challenge.injected, null, 2)}</pre>
          </div>
        </div>
      )}

      {/* Agent timeline */}
      <AgentCard role="ANALYST" tone="purple" agent={result.agents.analyst} />
      <AgentCard
        role="VALIDATOR"
        tone="cyan"
        agent={result.agents.validator}
        disagreed={result.disagreementSignal}
      />
      {result.agents.arbiter && (
        <AgentCard role="ARBITER" tone="amber" agent={result.agents.arbiter} />
      )}

      {/* On-chain anchor */}
      {"anchored" in result.onChain && result.onChain.anchored ? (
        <div className="p-6 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.03]">
          <h3 className="text-xs font-bold text-emerald-400/80 uppercase mb-2">
            ✓ Anchored on-chain
          </h3>
          <div className="font-mono text-xs space-y-1 text-white/60">
            <div>
              tx:{" "}
              <a
                href={result.onChain.mantlescan}
                className="text-emerald-300 hover:text-emerald-200 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {result.onChain.txHash.slice(0, 18)}…
              </a>
            </div>
            <div>block: {result.onChain.blockNumber}</div>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-lg border border-white/[0.04] bg-white/[0.01] text-center">
          <span className="text-[10px] text-white/30 font-mono">
            on-chain anchor: skipped (
            {"skipped" in result.onChain ? result.onChain.reason : "unknown"})
          </span>
        </div>
      )}

      {/* IPFS pin */}
      {result.ipfsCid && (
        <div className="p-3 rounded-lg border border-white/[0.04] bg-white/[0.01] text-center">
          <span className="text-[10px] text-white/30 font-mono">
            IPFS reasoning blob:{" "}
            <a
              href={`https://gateway.pinata.cloud/ipfs/${result.ipfsCid}`}
              className="text-purple-300 hover:text-purple-200"
              target="_blank"
              rel="noopener noreferrer"
            >
              {result.ipfsCid.slice(0, 14)}…
            </a>
          </span>
        </div>
      )}

      {/* Footer: budget */}
      {result.budget && (
        <div className="pt-3 text-center">
          <span className="text-[10px] text-white/20 font-mono">
            daily challenge budget: {result.budget.used}/{result.budget.cap}{" "}
            used
            {result.budget.resetAt
              ? ` · resets ${new Date(result.budget.resetAt).toLocaleString()}`
              : ""}
          </span>
        </div>
      )}
    </>
  );
}

// ─── Preview (deterministic) result rendering ────────────────────

function PreviewResultBlock({
  result,
}: {
  result: PreviewResponse;
  type: string;
}) {
  return (
    <>
      <ModeBadge mode="DETERMINISTIC_RULES" />

      <div
        className={`p-6 rounded-lg border ${
          result.result.blocked
            ? "border-green-500/30 bg-green-500/[0.03]"
            : "border-red-500/30 bg-red-500/[0.03]"
        }`}
      >
        <div className="flex items-center gap-3 mb-3">
          {result.result.blocked ? (
            <Shield className="w-6 h-6 text-green-400" />
          ) : (
            <Skull className="w-6 h-6 text-red-400" />
          )}
          <div>
            <div
              className={`text-lg font-bold ${
                result.result.blocked ? "text-green-400" : "text-red-400"
              }`}
            >
              {result.result.blocked ? "ATTACK BLOCKED" : "ATTACK SUCCEEDED"}
            </div>
            <div className="text-xs text-white/40">
              Confidence: {result.result.confidence}% · preview / deterministic
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 rounded-lg border border-white/[0.06] bg-white/[0.02]">
        <h3 className="text-xs font-bold text-white/60 uppercase mb-3">
          Attack: {result.challenge.name}
        </h3>
        <p className="text-sm text-white/50 mb-4">
          {result.challenge.description}
        </p>
        <div className="bg-black/30 rounded p-3 font-mono text-xs text-red-300/80 mb-4">
          <div className="text-white/30 mb-1">{`// Injected fake signal:`}</div>
          <pre>{JSON.stringify(result.challenge.fake_signal, null, 2)}</pre>
        </div>
      </div>

      <div className="p-6 rounded-lg border border-white/[0.06] bg-white/[0.02]">
        <h3 className="text-xs font-bold text-white/60 uppercase mb-3">
          Deterministic reasoning
        </h3>
        <p className="text-sm text-white/70 leading-relaxed mb-4">
          {result.result.reasoning}
        </p>
        <h4 className="text-xs font-bold text-white/40 uppercase mb-2">
          Gates that would fire:
        </h4>
        <div className="flex flex-wrap gap-2">
          {result.result.gates.map((g, i) => (
            <span
              key={i}
              className="px-2 py-1 bg-green-500/10 border border-green-500/20 rounded text-[10px] text-green-400 font-mono"
            >
              ✓ {g}
            </span>
          ))}
        </div>
      </div>

      {result.verification?.on_chain_proof?.verified && (
        <div className="p-6 rounded-lg border border-white/[0.06] bg-white/[0.02]">
          <h3 className="text-xs font-bold text-white/60 uppercase mb-3">
            On-chain liveness probe
          </h3>
          <div className="font-mono text-xs space-y-1 text-white/50">
            <div>
              Contract:{" "}
              <span className="text-purple-300">
                {result.verification.contract}
              </span>
            </div>
            <div>
              Method:{" "}
              <span className="text-blue-300">
                {result.verification.method}
              </span>
            </div>
            <div>
              ValidationRegistry:{" "}
              {result.verification.on_chain_proof.totalProposals} proposals ·{" "}
              {result.verification.on_chain_proof.totalRejected} rejected ·
              block rate {result.verification.on_chain_proof.blockRate}
            </div>
            <div>Network: {result.verification.on_chain_proof.network}</div>
          </div>
        </div>
      )}

      {result.note && (
        <div className="p-3 rounded-lg border border-white/[0.04] bg-white/[0.01] text-center">
          <span className="text-[10px] text-white/30 font-mono">
            {result.note}
          </span>
        </div>
      )}
    </>
  );
}

// ─── Reusable bits ───────────────────────────────────────────────

function ModeBadge({
  mode,
}: {
  mode: "LIVE_MULTI_AGENT" | "DETERMINISTIC_RULES";
}) {
  const live = mode === "LIVE_MULTI_AGENT";
  return (
    <div
      className={`p-3 rounded-lg border text-center ${
        live
          ? "border-emerald-500/30 bg-emerald-500/[0.04]"
          : "border-yellow-500/30 bg-yellow-500/[0.04]"
      }`}
    >
      <span
        className={`inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest ${
          live ? "text-emerald-400/90" : "text-yellow-400/80"
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            live ? "bg-emerald-400 animate-pulse" : "bg-yellow-400"
          }`}
        />
        {live ? "LIVE · multi-agent pipeline" : "PREVIEW · deterministic rules"}
      </span>
    </div>
  );
}

function AgentCard({
  role,
  tone,
  agent,
  disagreed,
}: {
  role: string;
  tone: "purple" | "cyan" | "amber";
  agent: LiveAgentTrace;
  disagreed?: boolean;
}) {
  const colors = {
    purple: { ring: "border-purple-500/30", glow: "text-purple-300/90" },
    cyan: { ring: "border-cyan-500/30", glow: "text-cyan-300/90" },
    amber: { ring: "border-amber-500/30", glow: "text-amber-300/90" },
  }[tone];

  return (
    <div
      className={`p-6 rounded-lg border ${colors.ring} bg-white/[0.02] ${
        disagreed ? "ring-1 ring-yellow-500/20" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3
          className={`text-xs font-bold ${colors.glow} uppercase tracking-widest`}
        >
          {role}
        </h3>
        <span className="text-[10px] text-white/30 font-mono">
          {agent.model}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
        {agent.confidence != null && (
          <Stat
            label="confidence"
            value={`${Math.round((agent.confidence ?? 0) * 100)}%`}
          />
        )}
        {agent.timing_ms != null && (
          <Stat
            label="latency"
            value={`${(agent.timing_ms / 1000).toFixed(2)}s`}
          />
        )}
        {agent.action && <Stat label="action" value={agent.action} />}
        {agent.targetAsset && <Stat label="target" value={agent.targetAsset} />}
        {agent.approved != null && (
          <Stat label="approved" value={agent.approved ? "✓" : "✗"} />
        )}
        {agent.riskScore != null && (
          <Stat label="risk score" value={`${agent.riskScore}/100`} />
        )}
        {agent.vote && <Stat label="vote" value={agent.vote} />}
      </div>
      {agent.reasoning && (
        <div className="text-sm text-white/70 leading-relaxed mb-3 whitespace-pre-wrap">
          {agent.reasoning}
        </div>
      )}
      {agent.flaggedIssues && agent.flaggedIssues.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {agent.flaggedIssues.map((flag, i) => (
            <span
              key={i}
              className="px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20 rounded text-[10px] text-yellow-400 font-mono"
            >
              ⚠ {flag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="font-mono">
      <div className="text-[9px] text-white/30 uppercase tracking-widest">
        {label}
      </div>
      <div className="text-white/80">{value}</div>
    </div>
  );
}

function ProgressTimeline({
  current,
}: {
  current: "analyst" | "validator" | "arbiter" | null;
}) {
  const steps: Array<"analyst" | "validator" | "arbiter"> = [
    "analyst",
    "validator",
    "arbiter",
  ];
  const idx = current ? steps.indexOf(current) : -1;
  return (
    <div className="flex items-center gap-3">
      {steps.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s} className="flex-1 flex flex-col items-center">
            <div
              className={`w-3 h-3 rounded-full mb-1
              ${
                done
                  ? "bg-emerald-400"
                  : active
                  ? "bg-purple-400 animate-pulse"
                  : "bg-white/10"
              }`}
            />
            <div
              className={`text-[10px] uppercase tracking-widest font-mono
              ${
                active
                  ? "text-purple-300"
                  : done
                  ? "text-emerald-300/70"
                  : "text-white/30"
              }`}
            >
              {s}
            </div>
          </div>
        );
      })}
    </div>
  );
}
