/**
 * TS surface for the live-status helpers. The implementation lives in
 * live-status.shared.js so root Jest (no TS transpile) can test it.
 * This file just re-exports the runtime values + adds TS types.
 *
 * Steering rule .kiro/steering/no-lying-about-state.md §2 §3 binds
 * the badge surface — see live-status.shared.js for the rule logic.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const shared = require("./live-status.shared.js");

export type LivenessTier = "live" | "idle" | "stale" | "offline" | "syncing";

export interface HealthForLiveness {
  lastCycleTimestamp?: string | null;
  lastCycleAge?: number | null;
  mode?: string | null;
  status?: "ok" | "degraded";
}

export interface LiveStatus {
  tier: LivenessTier;
  label: string;
  tone: {
    dot: string;
    text: string;
    border: string;
    bg: string;
  };
  detail: string;
  modeLabel: string;
}

export const deriveLiveStatus: (
  health: HealthForLiveness | null
) => LiveStatus = shared.deriveLiveStatus;

export const deriveLiveStatusDisplay: (
  health: HealthForLiveness | null,
  options?: { loading?: boolean }
) => LiveStatus = shared.deriveLiveStatusDisplay;

export const isAutonomousLive: (
  health: HealthForLiveness | null
) => boolean = shared.isAutonomousLive;

export const LIVE_THRESHOLDS: {
  liveMaxSec: number;
  idleMaxSec: number;
  staleMaxSec: number;
} = shared.LIVE_THRESHOLDS;
