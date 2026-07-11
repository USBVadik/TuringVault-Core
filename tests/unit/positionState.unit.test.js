const {
  applyPositionAwarenessToState,
  buildEnteredPositionState,
  buildStateWithExecutionBasis,
  buildPositionAfterExit,
} = require("../../src/strategies/positionState");

describe("positionState", () => {
  test("applies take-profit lifecycle to an IN_MNT position", () => {
    const adjusted = applyPositionAwarenessToState(
      { action: "HOLD", reason: "MNT channel neutral" },
      0.47,
      {
        status: "IN_MNT",
        entryPrice: 0.43,
        targetExit: 0.46,
        stopLoss: 0.41,
        cycleCount: 2,
      }
    );

    expect(adjusted.action).toBe("SELL_mETH");
    expect(adjusted.overrideReason).toBe("TAKE_PROFIT");
    expect(adjusted.reason).toMatch(/MNT/);
  });

  test("hydrates a legacy active position from a receipt-backed open lot", () => {
    const next = buildStateWithExecutionBasis(
      { status: "IN_mETH", entryPrice: 1769.66, executionAmountOut: null },
      {
        asset: "mETH",
        quantity: 0.005,
        costUsd: 10.5,
        txHash: "0xentry",
      }
    );

    expect(next.executionAmountOut).toBe(0.005);
    expect(next.executionCostUsd).toBe(10.5);
    expect(next.executionEntryPrice).toBe(2100);
    expect(next.executionTxHash).toBe("0xentry");
  });

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

  test("preserves execution cost basis on fresh positions", () => {
    const next = buildEnteredPositionState(
      { status: "FLAT", entryPrice: null },
      {
        status: "IN_mETH",
        entryPrice: 1743.24,
        targetExit: 1769.3886,
        stopLoss: 1711.86168,
        allocationPct: 25,
        executionEntryPrice: 1907.1314226942789,
        executionCostUsd: 5,
        executionAmountOut: 0.002621738565314133,
        executionSourceAsset: "USDT0",
        executionTargetAsset: "mETH",
        executionTxHash: "0xabc",
      },
      "2026-06-22T01:52:06.980Z"
    );

    expect(next.executionEntryPrice).toBe(1907.1314226942789);
    expect(next.executionCostUsd).toBe(5);
    expect(next.executionAmountOut).toBe(0.002621738565314133);
    expect(next.executionSourceAsset).toBe("USDT0");
    expect(next.executionTargetAsset).toBe("mETH");
    expect(next.executionTxHash).toBe("0xabc");
  });

  test("keeps a partially exited position tracked with reduced cost basis", () => {
    const next = buildPositionAfterExit(
      {
        status: "IN_mETH",
        entryPrice: 1800,
        targetExit: 1830,
        stopLoss: 1765,
        allocationPct: 20,
        executionEntryPrice: 2000,
        executionCostUsd: 10,
        executionAmountOut: 0.005,
        executionSourceAsset: "USDT0",
        executionTargetAsset: "mETH",
      },
      {
        sourceAsset: "mETH",
        amountIn: 0.002,
        remainingSourceUsd: 30,
        minTradeUsd: 10,
        reason: "TAKE_PROFIT",
        nowIso: "2026-07-10T10:00:00.000Z",
      }
    );

    expect(next.status).toBe("IN_mETH");
    expect(next.executionAmountOut).toBeCloseTo(0.003, 12);
    expect(next.executionCostUsd).toBeCloseTo(6, 12);
    expect(next.executionEntryPrice).toBeCloseTo(2000, 12);
    expect(next.lastPartialExitReason).toBe("TAKE_PROFIT");
    expect(next.cycleCount).toBe(0);
  });

  test("closes tracking only when the remaining source is sub-floor", () => {
    const next = buildPositionAfterExit(
      {
        status: "IN_MNT",
        entryPrice: 0.43,
        executionCostUsd: 10,
        executionAmountOut: 23,
      },
      {
        sourceAsset: "WMNT",
        amountIn: 20,
        remainingSourceUsd: 1.3,
        minTradeUsd: 10,
        reason: "TAKE_PROFIT",
        nowIso: "2026-07-10T11:00:00.000Z",
      }
    );

    expect(next.status).toBe("FLAT");
    expect(next.lastExitReason).toBe("TAKE_PROFIT");
  });

  test("keeps a residual tracked when it is below entry floor but above exit floor", () => {
    const next = buildPositionAfterExit(
      {
        status: "IN_MNT",
        entryPrice: 0.43,
        executionCostUsd: 10,
        executionAmountOut: 23,
      },
      {
        sourceAsset: "WMNT",
        amountIn: 20,
        remainingSourceUsd: 1.3,
        minTradeUsd: 10,
        minExitUsd: 1,
        reason: "TAKE_PROFIT",
        nowIso: "2026-07-10T11:30:00.000Z",
      }
    );

    expect(next.status).toBe("IN_MNT");
    expect(next.executionAmountOut).toBeCloseTo(3, 12);
  });

  test("enterPosition persists execution fields instead of dropping them", () => {
    const fs = require("fs");
    const os = require("os");
    const path = require("path");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "position-state-"));
    const originalPath = process.env.POSITION_STATE_PATH;
    process.env.POSITION_STATE_PATH = path.join(tmpDir, "state.json");
    jest.resetModules();
    const isolated = require("../../src/strategies/positionState");

    isolated.enterPosition({
      status: "IN_mETH",
      entryPrice: 1800,
      targetExit: 1830,
      stopLoss: 1765,
      allocationPct: 15,
      executionEntryPrice: 1960,
      executionCostUsd: 10.5,
      executionAmountOut: 0.005357,
      executionSourceAsset: "USDT0",
      executionTargetAsset: "mETH",
      executionTxHash: "0xfill",
    });

    expect(isolated.getState()).toMatchObject({
      executionEntryPrice: 1960,
      executionCostUsd: 10.5,
      executionAmountOut: 0.005357,
      executionTxHash: "0xfill",
    });

    if (originalPath === undefined) delete process.env.POSITION_STATE_PATH;
    else process.env.POSITION_STATE_PATH = originalPath;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    jest.resetModules();
  });
});
