/**
 * Unit tests for walletRouter.pickSource — the smart source-token
 * picker that fixes the "WMNT drained, 29 MNT sitting idle, agent
 * stuck on INTENT_SWAP_NO_EXEC" failure mode discovered while
 * debugging cycles 149-151.
 *
 * Hardened in audit 28 against the inverse failure: 11 consecutive
 * risk-off cycles (149-159) drained native MNT into WMNT/USDT0
 * because the original wrap path took ALL wrappable MNT minus a
 * 1.0 MNT reserve. New defences:
 *   - GAS_RESERVE_MNT raised 1.0 → 5.0 (enough for a 7-day operator
 *     react window if a sustained risk-off streak fires).
 *   - MAX_WRAP_PER_CYCLE_MNT = 2.0 caps wraps so subsequent cycles
 *     don't consume the entire native float in one shot.
 *   - Sanity gate refuses any wrap that would land remaining native
 *     MNT below the gas reserve.
 */
const {
  pickSource,
  GAS_RESERVE_MNT,
  MAX_WRAP_PER_CYCLE_MNT,
} = require("../../src/dex/walletRouter");

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

  test("stable-heavy wallet does not wrap native MNT for repeated risk-off", () => {
    const r = pickSource({
      direction: "risk-off",
      balances: { WMNT: 0.05, MNT: 29, USDT0: 100, USDT: 0, mETH: 0 },
    });
    expect(r.feasible).toBe(false);
    expect(r.wrapMntFirst).toBe(false);
    expect(r.reason).toMatch(/stable-heavy/);
  });

  test("WMNT below floor + native MNT available + no stable reserve → wrap capped at MAX_WRAP_PER_CYCLE_MNT", () => {
    const r = pickSource({
      direction: "risk-off",
      balances: { WMNT: 0.05, MNT: 29, USDT0: 0, USDT: 0, mETH: 0 },
    });
    expect(r.feasible).toBe(true);
    expect(r.source).toBe("WMNT");
    expect(r.wrapMntFirst).toBe(true);
    // Audit 28: previously wrapped (29 − gasReserve) which destroyed
    // gas runway. Now capped at MAX_WRAP_PER_CYCLE_MNT.
    expect(r.wrapAmountMnt).toBeLessThanOrEqual(MAX_WRAP_PER_CYCLE_MNT);
    expect(r.wrapAmountMnt).toBeGreaterThan(0);
    expect(r.reason).toMatch(/wrap.*MNT.*capped/);
  });

  test("native MNT below gas reserve → refuses to wrap", () => {
    const r = pickSource({
      direction: "risk-off",
      balances: {
        WMNT: 0,
        MNT: GAS_RESERVE_MNT - 0.01,
        USDT0: 0,
        USDT: 0,
        mETH: 0,
      },
    });
    expect(r.feasible).toBe(false);
    expect(r.source).toBeNull();
    expect(r.wrapMntFirst).toBe(false);
  });

  test("sanity gate: refuses wrap that would land remaining MNT below gas reserve", () => {
    // GAS_RESERVE_MNT = 5.0, MAX_WRAP_PER_CYCLE_MNT = 2.0.
    // If wallet has MNT = 6 (only 1 above reserve) and WMNT=0, we
    // could wrap up to 1 — but that would leave native MNT at the
    // reserve floor exactly. Acceptable. If MNT = 5.9 the wrap would
    // be 0.9 which is below WMNT floor (0.1) so wrap would still
    // happen but the post-wrap MNT (5.0) sits exactly at reserve.
    const r = pickSource({
      direction: "risk-off",
      balances: { WMNT: 0, MNT: 6, USDT0: 0, USDT: 0, mETH: 0 },
    });
    // wrappable = 1.0, target = max(0.4, 0.4) = 0.4, capped at 2.0,
    // so wrap = min(1.0, 0.4, 2.0) = 0.4. Remaining MNT = 5.6 ≥ 5.0.
    expect(r.feasible).toBe(true);
    expect(r.wrapAmountMnt).toBeCloseTo(0.4, 4);
  });

  test("WMNT below floor + MNT below gas reserve → fall through to mETH", () => {
    const r = pickSource({
      direction: "risk-off",
      balances: { WMNT: 0.01, MNT: 0.02, USDT0: 0, USDT: 0, mETH: 0.005 },
    });
    expect(r.feasible).toBe(true);
    expect(r.source).toBe("mETH");
    expect(r.path).toEqual(["mETH", "WETH", "WMNT", "USDT", "USDT0"]);
  });

  test("nothing usable → infeasible with diagnostic reason", () => {
    const r = pickSource({
      direction: "risk-off",
      balances: { WMNT: 0.01, MNT: 0.01, USDT0: 0, USDT: 0, mETH: 0 },
    });
    expect(r.feasible).toBe(false);
    expect(r.source).toBeNull();
    expect(r.reason).toMatch(/risk-off infeasible|gas reserve/);
  });

  test("never wraps below the gas-reserve threshold", () => {
    const r = pickSource({
      direction: "risk-off",
      balances: {
        WMNT: 0,
        MNT: GAS_RESERVE_MNT - 0.01,
        USDT0: 0,
        USDT: 0,
        mETH: 0,
      },
    });
    expect(r.source).not.toBe("WMNT");
    expect(r.wrapMntFirst).toBe(false);
  });

  test("sustained-streak protection: 10 consecutive wraps cap total at 10×MAX", () => {
    // Simulate the cycles 149-159 streak: pretend each cycle drains
    // WMNT below floor and re-runs pickSource. The cap should bound
    // total native-MNT consumption to 10 × MAX_WRAP_PER_CYCLE_MNT
    // (= 20 MNT) instead of 10 × (29 − reserve) (= 280 MNT, which
    // is what the old bug would have done if the wallet held that
    // much).
    let mnt = 30;
    let totalWrapped = 0;
    for (let i = 0; i < 10; i++) {
      const r = pickSource({
        direction: "risk-off",
        balances: { WMNT: 0.01, MNT: mnt, USDT0: 100, USDT: 0, mETH: 0 },
      });
      if (!r.feasible) break;
      totalWrapped += r.wrapAmountMnt;
      mnt -= r.wrapAmountMnt;
    }
    expect(totalWrapped).toBeLessThanOrEqual(10 * MAX_WRAP_PER_CYCLE_MNT);
    expect(mnt).toBeGreaterThanOrEqual(GAS_RESERVE_MNT);
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

  test("USDT0 above floor + targetIsMeth → deep WETH bridge path", () => {
    const r = pickSource({
      direction: "risk-on",
      balances: { WMNT: 0, MNT: 0, USDT0: 100, USDT: 0, mETH: 0 },
      targetIsMeth: true,
    });
    expect(r.path).toEqual(["USDT0", "USDT", "WMNT", "WETH", "mETH"]);
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

  test("custom floors override defaults — but cap still applies", () => {
    // Setting a high WMNT floor should still trigger the wrap path,
    // but only if there is enough wrappable MNT for the wrap to clear
    // the new floor AFTER respecting GAS_RESERVE_MNT.
    const r = pickSource({
      direction: "risk-off",
      balances: { WMNT: 0.5, MNT: 30, USDT0: 0, USDT: 0, mETH: 0 },
      floors: { WMNT: 1.0, USDT0: 0.5, mETH: 0.001, USDT: 0.5 },
    });
    // wrappable = 30 − 5 = 25. target = max(1.0 × 4, 0.4) = 4.0,
    // capped at 2.0. So wrap = 2.0 — but 2.0 ≥ floor 1.0 ✅.
    expect(r.feasible).toBe(true);
    expect(r.wrapMntFirst).toBe(true);
    expect(r.wrapAmountMnt).toBeLessThanOrEqual(MAX_WRAP_PER_CYCLE_MNT);
  });
});
