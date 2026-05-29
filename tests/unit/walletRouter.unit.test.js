/**
 * Unit tests for walletRouter.pickSource — the smart source-token
 * picker that fixes the "WMNT drained, 29 MNT sitting idle, agent
 * stuck on INTENT_SWAP_NO_EXEC" failure mode discovered while
 * debugging cycles 149-151.
 */
const { pickSource, GAS_RESERVE_MNT } = require("../../src/dex/walletRouter");

describe("walletRouter.pickSource — risk-off", () => {
  test("WMNT above floor → use WMNT directly, no wrap", () => {
    const r = pickSource({
      direction: "risk-off",
      balances: { WMNT: 5, MNT: 0, USDT0: 100, USDT: 0, mETH: 0 },
    });
    expect(r.feasible).toBe(true);
    expect(r.source).toBe("WMNT");
    expect(r.wrapMntFirst).toBe(false);
    expect(r.path).toEqual(["WMNT", "USDT", "USDT0"]);
    expect(r.sourceBalance).toBe(5);
  });

  test("WMNT below floor + native MNT available → wrap MNT first", () => {
    const r = pickSource({
      direction: "risk-off",
      balances: { WMNT: 0.05, MNT: 29, USDT0: 100, USDT: 0, mETH: 0 },
    });
    expect(r.feasible).toBe(true);
    expect(r.source).toBe("WMNT");
    expect(r.wrapMntFirst).toBe(true);
    // Should wrap (29 - gas reserve) so the swap has meaningful size.
    expect(r.wrapAmountMnt).toBeCloseTo(29 - GAS_RESERVE_MNT, 5);
    expect(r.sourceBalance).toBeCloseTo(0.05 + (29 - GAS_RESERVE_MNT), 5);
    expect(r.reason).toMatch(/wrap.*MNT/);
  });

  test("WMNT below floor + MNT below gas reserve → fall through to mETH", () => {
    const r = pickSource({
      direction: "risk-off",
      balances: { WMNT: 0.01, MNT: 0.02, USDT0: 0, USDT: 0, mETH: 0.005 },
    });
    expect(r.feasible).toBe(true);
    expect(r.source).toBe("mETH");
    expect(r.path).toEqual(["mETH", "WMNT", "USDT", "USDT0"]);
  });

  test("nothing usable → infeasible with diagnostic reason", () => {
    const r = pickSource({
      direction: "risk-off",
      balances: { WMNT: 0.01, MNT: 0.01, USDT0: 100, USDT: 0, mETH: 0 },
    });
    expect(r.feasible).toBe(false);
    expect(r.source).toBeNull();
    expect(r.reason).toMatch(/risk-off infeasible/);
  });

  test("never wraps below the gas-reserve threshold", () => {
    const r = pickSource({
      direction: "risk-off",
      balances: { WMNT: 0, MNT: GAS_RESERVE_MNT - 0.01, USDT0: 0, USDT: 0, mETH: 0 },
    });
    // Wrappable < floor ⇒ should NOT pick MNT path.
    expect(r.source).not.toBe("WMNT");
    expect(r.wrapMntFirst).toBe(false);
  });
});

describe("walletRouter.pickSource — risk-on", () => {
  test("USDT0 above floor → use USDT0", () => {
    const r = pickSource({
      direction: "risk-on",
      balances: { WMNT: 0, MNT: 0, USDT0: 100, USDT: 0, mETH: 0 },
    });
    expect(r.feasible).toBe(true);
    expect(r.source).toBe("USDT0");
    expect(r.path).toEqual(["USDT0", "USDT", "WMNT"]);
  });

  test("USDT0 above floor + targetIsMeth → 4-leg path", () => {
    const r = pickSource({
      direction: "risk-on",
      balances: { WMNT: 0, MNT: 0, USDT0: 100, USDT: 0, mETH: 0 },
      targetIsMeth: true,
    });
    expect(r.path).toEqual(["USDT0", "USDT", "WMNT", "mETH"]);
  });

  test("USDT0 below floor + USDT available → fallback to USDT", () => {
    const r = pickSource({
      direction: "risk-on",
      balances: { WMNT: 0, MNT: 0, USDT0: 0.1, USDT: 5, mETH: 0 },
    });
    expect(r.source).toBe("USDT");
    expect(r.path).toEqual(["USDT", "WMNT"]);
  });

  test("nothing stable → infeasible", () => {
    const r = pickSource({
      direction: "risk-on",
      balances: { WMNT: 5, MNT: 0, USDT0: 0, USDT: 0, mETH: 0 },
    });
    expect(r.feasible).toBe(false);
    expect(r.reason).toMatch(/risk-on infeasible/);
  });
});

describe("walletRouter.pickSource — guards", () => {
  test("unknown direction returns infeasible with reason", () => {
    const r = pickSource({
      direction: "sideways",
      balances: { WMNT: 100, MNT: 100, USDT0: 100, USDT: 100, mETH: 100 },
    });
    expect(r.feasible).toBe(false);
    expect(r.reason).toMatch(/unknown direction/);
  });

  test("custom floors override defaults", () => {
    // Setting a high WMNT floor should force the wrap path even when
    // we have a fair amount of WMNT.
    const r = pickSource({
      direction: "risk-off",
      balances: { WMNT: 0.5, MNT: 5, USDT0: 100, USDT: 0, mETH: 0 },
      floors: { WMNT: 1.0, USDT0: 0.5, mETH: 0.001, USDT: 0.5 },
    });
    expect(r.wrapMntFirst).toBe(true);
  });
});
