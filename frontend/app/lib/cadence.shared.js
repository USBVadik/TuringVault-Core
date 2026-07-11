/**
 * Frontend/runtime view of the canonical GitHub Actions cadence.
 * Keep these values aligned with agent-cycle.yml and agent-watchdog.yml.
 */
const LIVE_THRESHOLD_S = 10 * 60;
const SCHEDULE_FRESHNESS_THRESHOLD_S = 3 * 60 * 60;
const IDLE_THRESHOLD_S = SCHEDULE_FRESHNESS_THRESHOLD_S + 15 * 60;
const WATCHDOG_STALE_THRESHOLD_S = 3.5 * 60 * 60;
const OFFLINE_THRESHOLD_S = 4 * 60 * 60;
const EXPECTED_CYCLES_PER_DAY = Math.round(
  (24 * 60 * 60) / SCHEDULE_FRESHNESS_THRESHOLD_S
);

module.exports = {
  EXPECTED_CYCLES_PER_DAY,
  IDLE_THRESHOLD_S,
  LIVE_THRESHOLD_S,
  OFFLINE_THRESHOLD_S,
  SCHEDULE_FRESHNESS_THRESHOLD_S,
  WATCHDOG_STALE_THRESHOLD_S,
};
