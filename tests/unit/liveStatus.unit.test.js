/**
 * Tests for the frontend's live-status helper. Pins the threshold
 * decisions so a future refactor can't quietly turn STALE into LIVE
 * (a steering-rule §2 violation: claiming "Autonomous" on a screen
 * where the cron actually skipped a slot).
 *
 * The TS surface in frontend/app/lib/live-status.ts re-exports the
 * runtime from live-status.shared.js, which is what we test here.
 */
const {
  deriveLiveStatus,
  deriveLiveStatusDisplay,
  isAutonomousLive,
  LIVE_THRESHOLDS,
} = require("../../frontend/app/lib/live-status.shared.js");

describe("deriveLiveStatus tiers", () => {
  test("null health → OFFLINE (loading window must not claim LIVE)", () => {
    const s = deriveLiveStatus(null);
    expect(s.tier).toBe("offline");
    expect(s.label).toBe("OFFLINE");
  });

  test("degraded status → OFFLINE/DEGRADED no matter the age", () => {
    const s = deriveLiveStatus({
      status: "degraded",
      lastCycleAge: 30,
      mode: "cron-github-actions",
    });
    expect(s.tier).toBe("offline");
    expect(s.label).toBe("DEGRADED");
  });

  test("age 0..LIVE_MAX-1 → LIVE", () => {
    expect(deriveLiveStatus({ lastCycleAge: 0 }).tier).toBe("live");
    expect(
      deriveLiveStatus({ lastCycleAge: LIVE_THRESHOLDS.liveMaxSec - 1 }).tier
    ).toBe("live");
  });

  test("age LIVE_MAX..IDLE_MAX-1 → IDLE", () => {
    expect(
      deriveLiveStatus({ lastCycleAge: LIVE_THRESHOLDS.liveMaxSec }).tier
    ).toBe("idle");
    expect(
      deriveLiveStatus({ lastCycleAge: LIVE_THRESHOLDS.idleMaxSec - 1 }).tier
    ).toBe("idle");
  });

  test("age IDLE_MAX..STALE_MAX-1 → STALE", () => {
    expect(
      deriveLiveStatus({ lastCycleAge: LIVE_THRESHOLDS.idleMaxSec }).tier
    ).toBe("stale");
    expect(
      deriveLiveStatus({ lastCycleAge: LIVE_THRESHOLDS.staleMaxSec - 1 }).tier
    ).toBe("stale");
  });

  test("age >= STALE_MAX → OFFLINE", () => {
    expect(
      deriveLiveStatus({ lastCycleAge: LIVE_THRESHOLDS.staleMaxSec }).tier
    ).toBe("offline");
    expect(deriveLiveStatus({ lastCycleAge: 99999 }).tier).toBe("offline");
  });
});

describe("deriveLiveStatus modeLabel (steering rule §2)", () => {
  test("cron-github-actions → 'Cron · GH Actions'", () => {
    expect(
      deriveLiveStatus({ lastCycleAge: 60, mode: "cron-github-actions" })
        .modeLabel
    ).toBe("Cron · GH Actions");
  });

  test("manual → 'Manual run'", () => {
    expect(
      deriveLiveStatus({ lastCycleAge: 60, mode: "manual" }).modeLabel
    ).toBe("Manual run");
  });

  test("unknown is suppressed (no fake autonomy claim)", () => {
    expect(
      deriveLiveStatus({ lastCycleAge: 60, mode: "unknown" }).modeLabel
    ).toBe("");
    expect(deriveLiveStatus({ lastCycleAge: 60 }).modeLabel).toBe("");
  });

  test("showcase prefix surfaces as 'Showcase mode'", () => {
    expect(
      deriveLiveStatus({ lastCycleAge: 60, mode: "showcase-2026-04" })
        .modeLabel
    ).toBe("Showcase mode");
  });
});

describe("deriveLiveStatusDisplay loading honesty", () => {
  test("first-render loading state does not claim OFFLINE", () => {
    const s = deriveLiveStatusDisplay(null, { loading: true });
    expect(s.tier).toBe("syncing");
    expect(s.label).toBe("SYNCING");
    expect(s.detail).toMatch(/loading live snapshot/i);
  });

  test("after loading, null health is still OFFLINE", () => {
    const s = deriveLiveStatusDisplay(null, { loading: false });
    expect(s.tier).toBe("offline");
    expect(s.label).toBe("OFFLINE");
  });
});

describe("isAutonomousLive AND-gate", () => {
  test("true ONLY when live age + cron mode together", () => {
    expect(
      isAutonomousLive({ lastCycleAge: 60, mode: "cron-github-actions" })
    ).toBe(true);
    expect(isAutonomousLive({ lastCycleAge: 60, mode: "cron" })).toBe(true);
    expect(isAutonomousLive({ lastCycleAge: 60, mode: "cron-local" })).toBe(
      true
    );
  });

  test("false when mode is manual even if age is fresh", () => {
    expect(isAutonomousLive({ lastCycleAge: 30, mode: "manual" })).toBe(false);
  });

  test("false when age is stale even on cron mode", () => {
    expect(
      isAutonomousLive({
        lastCycleAge: LIVE_THRESHOLDS.liveMaxSec + 1,
        mode: "cron-github-actions",
      })
    ).toBe(false);
  });

  test("false when health is null or degraded", () => {
    expect(isAutonomousLive(null)).toBe(false);
    expect(
      isAutonomousLive({
        status: "degraded",
        lastCycleAge: 30,
        mode: "cron-github-actions",
      })
    ).toBe(false);
  });
});
