const HEALTH_REUSE_TTL_MS = 25_000;

function computeLastCycleAge(lastCycleTimestamp, nowMs = Date.now()) {
  if (!lastCycleTimestamp) return null;
  const ts = Date.parse(lastCycleTimestamp);
  if (Number.isNaN(ts)) return null;
  return Math.max(0, Math.floor((nowMs - ts) / 1000));
}

function cloneHealthWithFreshAge(snapshot, nowMs = Date.now(), overrides = {}) {
  if (!snapshot) return null;
  return {
    ...snapshot,
    ...overrides,
    lastCycleAge: computeLastCycleAge(snapshot.lastCycleTimestamp, nowMs),
  };
}

function canReuseHealthPayload(
  snapshot,
  cachedAtMs,
  nowMs = Date.now(),
  ttlMs = HEALTH_REUSE_TTL_MS
) {
  return Boolean(
    snapshot &&
      cachedAtMs &&
      nowMs >= cachedAtMs &&
      nowMs - cachedAtMs < ttlMs
  );
}

module.exports = {
  HEALTH_REUSE_TTL_MS,
  canReuseHealthPayload,
  cloneHealthWithFreshAge,
  computeLastCycleAge,
};
