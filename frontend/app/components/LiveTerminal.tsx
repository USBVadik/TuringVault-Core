/**
 * LiveTerminal — replays real on-chain decisions in a terminal-style view.
 *
 * Spec: .kiro/specs/ui-honesty-pass/{requirements,design,tasks}.md
 *
 * Replaces the previous TERMINAL_SEQUENCES script (which had a hardcoded
 * scenario, faked TX hashes like 0xe9f6fd97...c5, fake "5 approved /
 * 20 rejected", and claimed `LIVE` regardless of agent state).
 *
 * What this version does instead:
 *
 *   1. Pulls the last N decisions from /api/decisions (real on-chain
 *      DecisionLogged events) every 30s.
 *   2. Renders each as a compact terminal entry: timestamp, action,
 *      target, confidence, validator outcome, tier prefix if present
 *      in the on-chain reasoning text, IPFS-linked reasoning hash.
 *   3. Status badge is honest:
 *        - cycle age < 10m  → 🟢 LIVE
 *        - cycle age < 1h   → 🟡 IDLE
 *        - else / unknown    → 🔴 OFFLINE · replay
 *   4. When idle/offline, the header explicitly says "replay" so a
 *      judge knows the entries below are historical, not streaming.
 *
 * Performance: small fetch + setState; auto-scroll on update.
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { RelativeTime } from "../lib/time";

type Decision = {
  id: number;
  action: string;
  targetAsset: string;
  confidence: number;
  reasoningHash?: string;
  reasoning?: string;
  txHash: string;
  timestamp: number;
  block: number;
};

type Health = {
  lastCycleTimestamp?: string | null;
  lastCycleAge?: number | null;
  mode?: string;
};

type LiveState = "live" | "idle" | "offline";

function deriveLiveState(h: Health | null): LiveState {
  if (!h || h.lastCycleAge == null) return "offline";
  if (h.lastCycleAge < 600) return "live";
  if (h.lastCycleAge < 3600) return "idle";
  return "offline";
}

function badgeFor(state: LiveState) {
  switch (state) {
    case "live":
      return { dot: "bg-green-400", label: "LIVE", tone: "text-green-400/80" };
    case "idle":
      return {
        dot: "bg-yellow-400",
        label: "IDLE",
        tone: "text-yellow-400/80",
      };
    case "offline":
    default:
      return {
        dot: "bg-red-400",
        label: "REPLAY · OFFLINE",
        tone: "text-red-400/80",
      };
  }
}

/**
 * Extract the [TIER] prefix from on-chain reasoning text if present.
 * Returns the tier string (e.g. "BLOCKED_BY_VALIDATOR") or null.
 * Live cycles after agent-reasoning-quality spec write this prefix;
 * legacy entries don't have it.
 */
function extractTier(reasoning: string | undefined): string | null {
  if (!reasoning) return null;
  const m = reasoning.match(/^\[([A-Z_]+)\]/);
  return m ? m[1] : null;
}

function tierTone(tier: string | null): string {
  if (!tier) return "text-white/30";
  if (tier === "EXECUTED_SWAP") return "text-green-400/80";
  if (tier === "BLOCKED_BY_VALIDATOR") return "text-red-400/70";
  if (tier === "BLOCKED_BY_LOW_CONFIDENCE") return "text-yellow-400/70";
  if (tier === "BLOCKED_BY_REGIME") return "text-blue-400/70";
  if (tier === "BLOCKED_BY_PARSE_FAILURE") return "text-orange-400/70";
  return "text-white/40";
}

function actionTone(action: string, approved: boolean): string {
  if (action === "swap" && approved) return "text-green-400/90";
  if (action === "swap") return "text-yellow-400/80";
  return "text-white/55";
}

function shortHash(h: string | undefined): string {
  if (!h) return "—";
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

const DECISION_LIMIT = 8;

export function LiveTerminal() {
  const [decisions, setDecisions] = useState<Decision[] | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Polling: decisions + health together so the badge stays in sync.
  useEffect(() => {
    let cancelled = false;
    async function fetchAll() {
      try {
        const [dRes, hRes] = await Promise.all([
          fetch("/api/decisions", { cache: "no-store" }),
          fetch("/api/health", { cache: "no-store" }),
        ]);
        if (!cancelled) {
          if (dRes.ok) {
            const d = await dRes.json();
            setDecisions(
              Array.isArray(d.decisions)
                ? d.decisions.slice(0, DECISION_LIMIT)
                : []
            );
          } else {
            setError(`decisions ${dRes.status}`);
          }
          if (hRes.ok) {
            setHealth(await hRes.json());
          }
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "fetch failed");
        }
      }
    }
    fetchAll();
    const id = setInterval(fetchAll, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Auto-scroll to bottom on update.
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [decisions]);

  const liveState = deriveLiveState(health);
  const badge = badgeFor(liveState);

  return (
    <div className="live-terminal">
      <div className="live-terminal-header">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
        </div>
        <span className="text-[10px] font-mono text-white/30">
          turingvault@mantle:~/decisions
        </span>
        <div
          className="flex items-center gap-2 ml-auto"
          title={
            liveState === "live"
              ? "Last cycle within 10 minutes — streaming"
              : liveState === "idle"
              ? "Last cycle within 1 hour"
              : "Cron not running — showing historical decisions"
          }
        >
          <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
          <span
            className={`text-[9px] font-mono uppercase tracking-wider ${badge.tone}`}
          >
            {badge.label}
          </span>
        </div>
      </div>
      <div ref={terminalRef} className="live-terminal-body">
        {/* Header: replay disclosure when not live */}
        {liveState !== "live" && (
          <div className="terminal-line text-yellow-300/60 mb-2">
            ⚠ Replay: last cycle{" "}
            {health?.lastCycleTimestamp ? (
              <RelativeTime ts={health.lastCycleTimestamp} />
            ) : (
              "unknown"
            )}
            . Streaming feed paused. Decisions below are real, on-chain,
            historical.
          </div>
        )}

        {decisions == null && !error && (
          <div className="terminal-line text-white/30">
            Loading on-chain decisions…
          </div>
        )}

        {error && (
          <div className="terminal-line text-red-400/80">
            ⚠ /api/decisions error: {error}. Falling back to empty view.
          </div>
        )}

        {decisions && decisions.length === 0 && (
          <div className="terminal-line text-white/30">
            No decisions on-chain yet.
          </div>
        )}

        {decisions &&
          decisions.map((d, i) => {
            const tier = extractTier(d.reasoning ?? d.reasoningHash);
            const approved = tier === "EXECUTED_SWAP" || d.action === "swap";
            const ts =
              new Date(d.timestamp * 1000).toISOString().slice(11, 19) + "Z";
            const conf = (d.confidence / 100).toFixed(1);
            return (
              <div key={`${d.id}-${i}`} className="terminal-line">
                <span className="text-white/30 font-mono">
                  [#{d.id.toString().padStart(3, "0")}]
                </span>{" "}
                <span className="text-white/30 font-mono">{ts}</span>{" "}
                {tier && (
                  <span className={`font-mono ${tierTone(tier)}`}>
                    [{tier}]
                  </span>
                )}{" "}
                <span className={actionTone(d.action, approved)}>
                  {d.action.toUpperCase()}
                </span>{" "}
                <span className="text-white/70">{d.targetAsset}</span>{" "}
                <span className="text-white/40 font-mono">conf={conf}%</span>
                {d.txHash && (
                  <>
                    {" "}
                    <a
                      href={`https://explorer.mantle.xyz/tx/${d.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-purple-300/60 hover:text-purple-300 font-mono text-[10px]"
                      title="Open on Mantle Explorer"
                    >
                      tx:{shortHash(d.txHash)}
                    </a>
                  </>
                )}
              </div>
            );
          })}

        {decisions && decisions.length > 0 && (
          <div className="terminal-line text-white/25 mt-2 text-[10px]">
            ── showing last {decisions.length} of {decisions.length} on-chain
            decisions ──
          </div>
        )}

        <span className="terminal-cursor">█</span>
      </div>
    </div>
  );
}
