const DEFAULT_MAX_CARD_STATS_AGE_MS = 36 * 60 * 60 * 1000;

function hasMisleadingConsensusRate(stats) {
  return /^100(?:\.0)?%/.test(String(stats?.consensusRate || "").trim());
}

function sanitizeAgentCardStats(stats) {
  const sanitized = { ...stats };
  let touched = false;

  if (hasMisleadingConsensusRate(sanitized)) {
    delete sanitized.consensusRate;
    touched = true;
  }

  return { sanitized, touched };
}

function sanitizeCardStats(rawStats, options = {}) {
  if (!rawStats || typeof rawStats !== "object" || Array.isArray(rawStats)) {
    return {
      cardStats: null,
      cardStatsStatus: "missing",
      cardStatsNote:
        "Agent Card does not carry scoped stats; live stats are served by /api/decisions and /api/performance.",
    };
  }

  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  const maxAgeMs = Number.isFinite(options.maxAgeMs)
    ? options.maxAgeMs
    : DEFAULT_MAX_CARD_STATS_AGE_MS;
  const snapshotAt =
    typeof rawStats.snapshotAt === "string" ? rawStats.snapshotAt : null;
  const snapshotMs = snapshotAt ? Date.parse(snapshotAt) : NaN;
  const stale =
    !Number.isFinite(snapshotMs) || Math.max(0, nowMs - snapshotMs) > maxAgeMs;

  if (stale) {
    return {
      cardStats: null,
      cardStatsStatus: "stale-hidden",
      cardStatsNote: snapshotAt
        ? `Agent Card stats snapshot (${snapshotAt}) is stale; live stats are served by /api/decisions and /api/performance.`
        : "Agent Card stats are missing snapshotAt; live stats are served by /api/decisions and /api/performance.",
    };
  }

  const { sanitized, touched } = sanitizeAgentCardStats(rawStats);

  if (touched) {
    return {
      cardStats: sanitized,
      cardStatsStatus: "sanitized",
      cardStatsNote:
        "Removed ambiguous Agent Card consensusRate; live approval/rejection stats are served by /api/decisions.",
    };
  }

  return {
    cardStats: sanitized,
    cardStatsStatus: "card-author-declared",
    cardStatsNote:
      "Card-author-declared snapshot only; live stats are served by /api/decisions and /api/performance.",
  };
}

module.exports = {
  DEFAULT_MAX_CARD_STATS_AGE_MS,
  sanitizeCardStats,
};
