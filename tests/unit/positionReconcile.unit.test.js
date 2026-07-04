const {
  shouldReconcileStalePosition,
  MAX_CYCLES_IN_POSITION,
} = require("../../src/strategies/positionState.js");

describe("shouldReconcileStalePosition", () => {
  const stuck = { status: "IN_mETH", cycleCount: MAX_CYCLES_IN_POSITION + 3 };

  test("reconciles a stuck past-max-hold position when no alpha swap executed", () => {
    expect(
      shouldReconcileStalePosition(stuck, { alphaSwapExecuted: false })
    ).toBe(true);
  });

  test("fires regardless of block reason (blocked cycles have no execution)", () => {
    // low-confidence / regime / validator blocks all leave alphaSwapExecuted=false
    expect(shouldReconcileStalePosition(stuck, {})).toBe(true);
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

  test("fires exactly at the max-hold boundary", () => {
    expect(
      shouldReconcileStalePosition(
        { status: "IN_MNT", cycleCount: MAX_CYCLES_IN_POSITION },
        { alphaSwapExecuted: false }
      )
    ).toBe(true);
  });

  test("handles missing/empty state safely", () => {
    expect(
      shouldReconcileStalePosition(undefined, { alphaSwapExecuted: false })
    ).toBe(false);
    expect(shouldReconcileStalePosition({}, {})).toBe(false);
  });
});
