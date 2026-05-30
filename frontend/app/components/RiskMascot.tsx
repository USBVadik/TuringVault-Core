/**
 * RiskMascot — bottom-right liveness indicator.
 *
 * Polls /api/health every 60 seconds and renders one of three states:
 *   🟢 Active   — last cycle within 10 minutes
 *   🟡 Idle     — last cycle within 1 hour
 *   🔴 Offline  — last cycle older than 1 hour OR endpoint unreachable
 *
 * Replaces the previous inline RiskMascot in page.tsx that was hardcoded
 * to varLevel={95} (always Supervised). Per .kiro/steering/no-lying-about-
 * state.md, "live" indicators must reflect verifiable backend reality —
 * this component does that and nothing more. No VaR figure is shown
 * until /api/health exposes a real per-cycle VaR (deferred to
 * continuous-cron-and-health spec).
 *
 * Spec: .kiro/specs/ui-honesty-pass/{requirements,design,tasks}.md (T7, R1)
 */

"use client";

import { useEffect, useState } from "react";
import { RelativeTime } from "../lib/time";

type Health = {
  status?: "ok" | "degraded";
  lastCycleTimestamp?: string | null;
  lastCycleAge?: number | null;
  mode?: string;
};

type State = "active" | "idle" | "offline";

const DISPLAY: Record<State, { emoji: string; label: string; tone: string }> = {
  active: {
    emoji: "🟢",
    label: "Active",
    tone: "border-green-500/30 bg-green-500/[0.04]",
  },
  idle: {
    emoji: "🟡",
    label: "Idle",
    tone: "border-yellow-500/30 bg-yellow-500/[0.04]",
  },
  offline: {
    emoji: "🔴",
    label: "Offline",
    tone: "border-red-500/30 bg-red-500/[0.04]",
  },
};

function deriveState(h: Health | null): State {
  if (!h || h.lastCycleAge === null || h.lastCycleAge === undefined)
    return "offline";
  if (h.lastCycleAge < 600) return "active"; // < 10m
  if (h.lastCycleAge < 3600) return "idle"; // < 1h
  return "offline";
}

const REFRESH_MS = 60_000;

export function RiskMascot() {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchOnce() {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setHealth(null);
          return;
        }
        const data = (await res.json()) as Health;
        if (!cancelled) setHealth(data);
      } catch {
        if (!cancelled) setHealth(null);
      }
    }

    fetchOnce();
    const id = setInterval(fetchOnce, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const state = deriveState(health);
  const display = DISPLAY[state];
  const ts = health?.lastCycleTimestamp;
  const mode = health?.mode ?? "unknown";

  return (
    <div
      role="status"
      aria-label={`Agent status: ${display.label}`}
      className={`fixed bottom-6 right-6 flex items-center gap-2 px-3 py-2 rounded-full border backdrop-blur-md ${display.tone}`}
      style={{ zIndex: "var(--z-toast)" }}
    >
      <span className="text-lg" aria-hidden="true">
        {display.emoji}
      </span>
      <div className="text-xs">
        <p className="text-white/70 font-medium">{display.label}</p>
        <p className="text-white/30 font-mono text-[10px]">
          {ts ? (
            <>
              last cycle <RelativeTime ts={ts} />
            </>
          ) : (
            "no recent data"
          )}
          {" · "}
          {mode}
        </p>
      </div>
    </div>
  );
}
