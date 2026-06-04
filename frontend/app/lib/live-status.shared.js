/**
 * Pure-JS, framework-free copy of the deriveLiveStatus / isAutonomousLive
 * logic from live-status.ts. The TS file re-exports from here so there
 * is one source of truth and root jest (which doesn't transpile TS) can
 * cover the thresholds.
 *
 * Steering rule .kiro/steering/no-lying-about-state.md §2 §3 binds this
 * surface — keep the rules in this single file.
 */

const LIVE_THRESHOLD_S = 10 * 60;
const IDLE_THRESHOLD_S = 35 * 60;
const STALE_THRESHOLD_S = 90 * 60;

const TONES = {
  live: {
    dot: "bg-emerald-400",
    text: "text-emerald-300",
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/10",
  },
  idle: {
    dot: "bg-cyan-400",
    text: "text-cyan-300",
    border: "border-cyan-500/40",
    bg: "bg-cyan-500/10",
  },
  stale: {
    dot: "bg-yellow-400",
    text: "text-yellow-300",
    border: "border-yellow-500/40",
    bg: "bg-yellow-500/10",
  },
  offline: {
    dot: "bg-red-400",
    text: "text-red-300",
    border: "border-red-500/40",
    bg: "bg-red-500/10",
  },
  syncing: {
    dot: "bg-cyan-300",
    text: "text-cyan-200",
    border: "border-cyan-500/30",
    bg: "bg-cyan-500/10",
  },
};

function fmtAge(seconds) {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 60 * 60) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 24 * 60 * 60) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
}

function deriveTier(ageSec) {
  if (ageSec == null) return "offline";
  if (ageSec < LIVE_THRESHOLD_S) return "live";
  if (ageSec < IDLE_THRESHOLD_S) return "idle";
  if (ageSec < STALE_THRESHOLD_S) return "stale";
  return "offline";
}

function deriveModeLabel(mode) {
  if (!mode) return "";
  if (mode === "cron-github-actions" || mode === "cron")
    return "Cron · GH Actions";
  if (mode === "cron-local") return "Cron · local";
  if (mode === "manual" || mode === "manual-trigger") return "Manual run";
  if (mode === "showcase" || String(mode).startsWith("showcase"))
    return "Showcase mode";
  if (mode === "unknown") return "";
  return String(mode).slice(0, 24);
}

function deriveLiveStatus(health) {
  if (health && health.status === "degraded") {
    return {
      tier: "offline",
      label: "DEGRADED",
      tone: TONES.offline,
      detail:
        "/api/health is reporting degraded — backend state files unavailable",
      modeLabel: deriveModeLabel(health.mode || null),
    };
  }
  const ageSec =
    health && typeof health.lastCycleAge === "number"
      ? health.lastCycleAge
      : null;
  const tier = deriveTier(ageSec);
  const modeLabel = deriveModeLabel((health && health.mode) || null);
  const tone = TONES[tier];

  switch (tier) {
    case "live":
      return {
        tier,
        label: "LIVE",
        tone,
        detail: `last cycle ${ageSec != null ? fmtAge(ageSec) : "—"}${
          modeLabel ? " · " + modeLabel : ""
        }`,
        modeLabel,
      };
    case "idle":
      return {
        tier,
        label: "IDLE",
        tone,
        detail: `between cron slots — last cycle ${
          ageSec != null ? fmtAge(ageSec) : "—"
        }${modeLabel ? " · " + modeLabel : ""}`,
        modeLabel,
      };
    case "stale":
      return {
        tier,
        label: "STALE",
        tone,
        detail: `cron missed a slot — last cycle ${
          ageSec != null ? fmtAge(ageSec) : "—"
        }${modeLabel ? " · " + modeLabel : ""}`,
        modeLabel,
      };
    case "offline":
    default:
      return {
        tier: "offline",
        label: "OFFLINE",
        tone: TONES.offline,
        detail:
          ageSec == null
            ? "no recent cycle data — agent may not be running"
            : `last cycle ${fmtAge(ageSec)} — cron not firing`,
        modeLabel,
      };
  }
}

function deriveLiveStatusDisplay(health, options = {}) {
  if (options.loading && !health) {
    return {
      tier: "syncing",
      label: "SYNCING",
      tone: TONES.syncing,
      detail: "loading live snapshot — no freshness claim yet",
      modeLabel: "",
    };
  }
  return deriveLiveStatus(health);
}

function isAutonomousLive(health) {
  if (!health || health.status === "degraded") return false;
  if (health.lastCycleAge == null || health.lastCycleAge >= LIVE_THRESHOLD_S)
    return false;
  const m = health.mode || "";
  return m === "cron-github-actions" || m === "cron" || m === "cron-local";
}

const LIVE_THRESHOLDS = {
  liveMaxSec: LIVE_THRESHOLD_S,
  idleMaxSec: IDLE_THRESHOLD_S,
  staleMaxSec: STALE_THRESHOLD_S,
};

module.exports = {
  deriveLiveStatus,
  deriveLiveStatusDisplay,
  isAutonomousLive,
  LIVE_THRESHOLDS,
};
