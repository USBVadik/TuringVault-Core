const {
  shouldReconcileStalePosition,
  MAX_CYCLES_IN_POSITION,
} = require("../../src/strategies/positionState.js");

describe("shouldReconcileStalePosition", () => {
  const stuck = { status: "IN_mETH", cycleCount: MAX_CYCLES_IN_POSITION + 3 };

  test("does not forget a stuck position while executable inventory remains", () => {
    expect(
      shouldReconcileStalePosition(stuck, {
        alphaSwapExecuted: false,
        sourceInventoryUsd: 15,
        minExitUsd: 1,
      })
    ).toBe(false);
  });

  test("reconciles only a confirmed sub-dust residual after max hold", () => {
    expect(
      shouldReconcileStalePosition(stuck, {
        sourceInventoryUsd: 0.4,
        minExitUsd: 1,
      })
    ).toBe(true);
  });

  test("does NOT reconcile when an alpha swap actually executed", () => {
    expect(
      shouldReconcileStalePosition(stuck, { alphaSwapExecuted: true })
    ).toBe(false);
  });

  test("does NOT reconcile a FLAT position", () => {
    expect(
      shouldReconcileStalePosition(
        { status: "FLAT", cycleCount: 99 },
        { alphaSwapExecuted: false }
      )
    ).toBe(false);
  });

  test("does NOT reconcile a healthy position still under max-hold", () => {
    expect(
      shouldReconcileStalePosition(
        { status: "IN_mETH", cycleCount: MAX_CYCLES_IN_POSITION - 5 },
        { alphaSwapExecuted: false }
      )
    ).toBe(false);
  });

  test("does not fire at the max-hold boundary without wallet evidence", () => {
    expect(
      shouldReconcileStalePosition(
        { status: "IN_MNT", cycleCount: MAX_CYCLES_IN_POSITION },
        { alphaSwapExecuted: false }
      )
    ).toBe(false);
  });

  test("handles missing/empty state safely", () => {
    expect(
      shouldReconcileStalePosition(undefined, { alphaSwapExecuted: false })
    ).toBe(false);
    expect(shouldReconcileStalePosition({}, {})).toBe(false);
  });
});
