const {
  shouldReconcileStalePosition,
  MAX_CYCLES_IN_POSITION,
} = require("../../src/strategies/positionState.js");

describe("shouldReconcileStalePosition", () => {
  const stuck = { status: "IN_mETH", cycleCount: MAX_CYCLES_IN_POSITION + 1 };

  test("reconciles a stuck past-max-hold position whose exit could not execute", () => {
    expect(
      shouldReconcileStalePosition(stuck, {
        swapExecuted: false,
        wasExitIntent: true,
      })
    ).toBe(true);
  });

  test("does NOT reconcile when the swap actually executed", () => {
    expect(
      shouldReconcileStalePosition(stuck, {
        swapExecuted: true,
        wasExitIntent: true,
      })
    ).toBe(false);
  });

  test("does NOT reconcile a FLAT position", () => {
    expect(
      shouldReconcileStalePosition(
        { status: "FLAT", cycleCount: 99 },
        { swapExecuted: false, wasExitIntent: true }
      )
    ).toBe(false);
  });

  test("does NOT reconcile when the intent was not a risk-off exit (e.g. risk-on buy)", () => {
    expect(
      shouldReconcileStalePosition(stuck, {
        swapExecuted: false,
        wasExitIntent: false,
      })
    ).toBe(false);
  });

  test("does NOT reconcile a healthy position still under max-hold", () => {
    expect(
      shouldReconcileStalePosition(
        { status: "IN_mETH", cycleCount: MAX_CYCLES_IN_POSITION - 5 },
        { swapExecuted: false, wasExitIntent: true }
      )
    ).toBe(false);
  });

  test("fires exactly at the max-hold boundary", () => {
    expect(
      shouldReconcileStalePosition(
        { status: "IN_MNT", cycleCount: MAX_CYCLES_IN_POSITION },
        { swapExecuted: false, wasExitIntent: true }
      )
    ).toBe(true);
  });

  test("handles missing/empty state safely", () => {
    expect(
      shouldReconcileStalePosition(undefined, {
        swapExecuted: false,
        wasExitIntent: true,
      })
    ).toBe(false);
    expect(shouldReconcileStalePosition({}, {})).toBe(false);
  });
});
