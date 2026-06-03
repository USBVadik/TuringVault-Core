const {
  buildEnteredPositionState,
} = require("../../src/strategies/positionState");

describe("positionState", () => {
  test("merges same-asset scale-ins into average entry and increments count", () => {
    const next = buildEnteredPositionState(
      {
        status: "IN_MNT",
        entryPrice: 0.67,
        entryTime: "2026-06-03T01:00:00.000Z",
        targetExit: 0.69,
        stopLoss: 0.64,
        highWaterMark: 0.68,
        allocationPct: 20,
        cycleCount: 3,
        scaleInCount: 1,
      },
      {
        status: "IN_MNT",
        entryPrice: 0.642,
        targetExit: 0.68,
        stopLoss: 0.625,
        allocationPct: 10,
      },
      "2026-06-03T02:00:00.000Z"
    );

    expect(next.status).toBe("IN_MNT");
    expect(next.entryTime).toBe("2026-06-03T01:00:00.000Z");
    expect(next.entryPrice).toBeCloseTo(0.660667, 6);
    expect(next.allocationPct).toBe(30);
    expect(next.scaleInCount).toBe(2);
    expect(next.lastScaleInAt).toBe("2026-06-03T02:00:00.000Z");
    expect(next.targetExit).toBe(0.68);
    expect(next.stopLoss).toBe(0.625);
    expect(next.highWaterMark).toBe(0.68);
  });

  test("starts a fresh position without inheriting scale-in metadata", () => {
    const next = buildEnteredPositionState(
      {
        status: "FLAT",
        entryPrice: null,
        allocationPct: null,
      },
      {
        status: "IN_mETH",
        entryPrice: 1920,
        targetExit: 1980,
        stopLoss: 1880,
        allocationPct: 25,
      },
      "2026-06-03T03:00:00.000Z"
    );

    expect(next.status).toBe("IN_mETH");
    expect(next.entryPrice).toBe(1920);
    expect(next.entryTime).toBe("2026-06-03T03:00:00.000Z");
    expect(next.scaleInCount).toBe(0);
    expect(next.lastScaleInAt).toBeNull();
  });
});
