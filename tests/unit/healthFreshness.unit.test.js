const {
  newestOutcomeIso,
  pickFreshestByIso,
  pickFreshestOutcomes,
} = require("../../frontend/app/api/health/freshness.shared.js");

describe("health freshness source selection", () => {
  test("uses newer GitHub summary when local state file is stale", () => {
    const localSummary = {
      cycleEndedAt: "2026-05-31T22:16:27.193Z",
      decisionId: 205,
    };
    const githubSummary = {
      cycleEndedAt: "2026-06-01T11:01:07.935Z",
      decisionId: 211,
    };

    const picked = pickFreshestByIso(
      localSummary,
      githubSummary,
      (summary) => summary?.cycleEndedAt ?? null
    );

    expect(picked).toBe(githubSummary);
  });

  test("compares outcome databases by newest recorded or settled timestamp", () => {
    const localOutcomes = {
      pending: [{ decisionId: 205, recordedAt: "2026-05-31T22:16:17.087Z" }],
      settled: [],
    };
    const githubOutcomes = {
      pending: [{ decisionId: 211, recordedAt: "2026-06-01T11:00:42.000Z" }],
      settled: [],
    };

    expect(newestOutcomeIso(localOutcomes)).toBe("2026-05-31T22:16:17.087Z");
    expect(pickFreshestOutcomes(localOutcomes, githubOutcomes)).toBe(
      githubOutcomes
    );
  });
});
