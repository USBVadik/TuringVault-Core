const CRON_STALE_AFTER_SEC = 75 * 60;

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function shouldDispatchAgentCycle(health) {
  if (!health || typeof health !== "object") {
    return {
      dispatch: true,
      reason: "health-unavailable",
      staleAfterSec: CRON_STALE_AFTER_SEC,
    };
  }

  const lastCycleAge = toFiniteNumber(health.lastCycleAge);
  if (lastCycleAge === null) {
    return {
      dispatch: true,
      reason: "health-age-missing",
      staleAfterSec: CRON_STALE_AFTER_SEC,
    };
  }

  if (lastCycleAge < CRON_STALE_AFTER_SEC) {
    return {
      dispatch: false,
      reason: "cycle-fresh",
      lastCycleAge,
      staleAfterSec: CRON_STALE_AFTER_SEC,
    };
  }

  return {
    dispatch: true,
    reason: "cycle-stale",
    lastCycleAge,
    staleAfterSec: CRON_STALE_AFTER_SEC,
  };
}

module.exports = {
  CRON_STALE_AFTER_SEC,
  shouldDispatchAgentCycle,
};
