const {
  sanitizeCardStats,
} = require("../../frontend/app/lib/agent-card-honesty.shared.js");

describe("Agent Card public stats honesty", () => {
  test("hides stale on-chain Agent Card stats instead of exposing old counters", () => {
    const result = sanitizeCardStats(
      {
        totalDecisions: 409,
        snapshotAt: "2026-06-09T09:44:26.300Z",
        consensusRate: "100%",
      },
      {
        nowMs: Date.parse("2026-06-11T10:00:00.000Z"),
        maxAgeMs: 36 * 60 * 60 * 1000,
      }
    );

    expect(result.cardStats).toBeNull();
    expect(result.cardStatsStatus).toBe("stale-hidden");
    expect(result.cardStatsNote).toMatch(/live stats/i);
  });

  test("removes ambiguous 100 percent consensus claims from otherwise fresh card stats", () => {
    const result = sanitizeCardStats(
      {
        totalDecisions: 457,
        snapshotAt: "2026-06-11T09:44:26.300Z",
        consensusRate: "100%",
        validatorApprovalRate: "73.0%",
      },
      {
        nowMs: Date.parse("2026-06-11T10:00:00.000Z"),
      }
    );

    expect(result.cardStats).toMatchObject({
      totalDecisions: 457,
      validatorApprovalRate: "73.0%",
    });
    expect(result.cardStats).not.toHaveProperty("consensusRate");
    expect(result.cardStatsStatus).toBe("sanitized");
  });

  test("keeps fresh scoped stats when they do not contain misleading fields", () => {
    const result = sanitizeCardStats(
      {
        totalDecisions: 457,
        snapshotAt: "2026-06-11T09:44:26.300Z",
        realizedTradingPnlBps: null,
      },
      {
        nowMs: Date.parse("2026-06-11T10:00:00.000Z"),
      }
    );

    expect(result.cardStats).toMatchObject({
      totalDecisions: 457,
      realizedTradingPnlBps: null,
    });
    expect(result.cardStatsStatus).toBe("card-author-declared");
  });
});
