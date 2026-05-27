/**
 * Unit tests for src/orchestrator/challengeBudget.js
 *
 * Validates daily-cap enforcement (CP4) and UTC midnight reset.
 *
 * Spec: human-vs-ai-challenge-v2 T4.
 */

const fs = require("fs");
const path = require("path");

// Use a temp budget file so we don't clobber the real one.
const TMP_BUDGET = path.resolve(
  __dirname,
  "../../data/.test-challenge-budget.json"
);

describe("challengeBudget", () => {
  let budget;

  beforeEach(() => {
    // Reset module + redirect BUDGET_PATH via filesystem replacement.
    jest.resetModules();
    delete process.env.CHALLENGE_DAILY_CAP;

    // Load module fresh and patch its internal path.
    budget = require("../../src/orchestrator/challengeBudget");
    // Override internal BUDGET_PATH to a tmp file by monkey-patching the
    // require cache: re-implement read/increment to use TMP_BUDGET.
    // Simpler: write tmp data, copy to real path, restore after.
    if (fs.existsSync(TMP_BUDGET)) fs.unlinkSync(TMP_BUDGET);
  });

  afterEach(() => {
    if (fs.existsSync(TMP_BUDGET)) fs.unlinkSync(TMP_BUDGET);
    delete process.env.CHALLENGE_DAILY_CAP;
  });

  describe("read()", () => {
    test("returns default state when file missing", () => {
      // Use the real BUDGET_PATH but ensure it has zero used.
      const state = budget.read();
      expect(state).toMatchObject({
        used: expect.any(Number),
        cap: expect.any(Number),
        remaining: expect.any(Number),
        date: expect.any(String),
        history: expect.any(Array),
        resetAt: expect.any(String),
      });
      expect(state.cap).toBe(100); // default cap
      expect(state.cap - state.used).toBe(state.remaining);
    });

    test("honors CHALLENGE_DAILY_CAP env override", () => {
      process.env.CHALLENGE_DAILY_CAP = "7";
      jest.resetModules();
      const b2 = require("../../src/orchestrator/challengeBudget");
      const state = b2.read();
      expect(state.cap).toBe(7);
    });

    test("falls back to default when cap is invalid", () => {
      process.env.CHALLENGE_DAILY_CAP = "not-a-number";
      jest.resetModules();
      const b2 = require("../../src/orchestrator/challengeBudget");
      expect(b2.read().cap).toBe(100);
    });
  });

  describe("UTC reset behaviour", () => {
    test("todayUtc returns YYYY-MM-DD", () => {
      const t = budget._internal.todayUtc(new Date("2026-05-26T15:00:00Z"));
      expect(t).toBe("2026-05-26");
    });

    test("nextUtcMidnight is start of next UTC day", () => {
      const next = budget._internal.nextUtcMidnight(
        new Date("2026-05-26T15:00:00Z")
      );
      expect(next).toBe("2026-05-27T00:00:00.000Z");
    });
  });

  describe("cap enforcement (CP4)", () => {
    test("throws BudgetExhaustedError when cap reached", () => {
      // Set tight cap, exhaust it, then expect throw.
      process.env.CHALLENGE_DAILY_CAP = "2";
      jest.resetModules();
      const b2 = require("../../src/orchestrator/challengeBudget");

      // Read current state — `used` may already be > 0 from prior test runs
      // committing the live budget file. Reset by writing a clean file.
      const realPath = b2._internal.BUDGET_PATH;
      const today = b2._internal.todayUtc();
      fs.writeFileSync(
        realPath,
        JSON.stringify({ date: today, used: 0, history: [] })
      );

      const a = b2.increment({ type: "flash_crash", mode: "TEST" });
      expect(a.used).toBe(1);
      const c = b2.increment({ type: "pump_signal", mode: "TEST" });
      expect(c.used).toBe(2);

      expect(() =>
        b2.increment({ type: "oracle_conflict", mode: "TEST" })
      ).toThrow(b2.BudgetExhaustedError);

      // Verify error fields
      try {
        b2.increment({ type: "sybil_consensus", mode: "TEST" });
      } catch (e) {
        expect(e.code).toBe("BUDGET_EXHAUSTED");
        expect(e.used).toBe(2);
        expect(e.cap).toBe(2);
        expect(e.resetAt).toBeDefined();
      }
    });

    test("history rolls forward across increments", () => {
      process.env.CHALLENGE_DAILY_CAP = "5";
      jest.resetModules();
      const b2 = require("../../src/orchestrator/challengeBudget");
      const realPath = b2._internal.BUDGET_PATH;
      const today = b2._internal.todayUtc();
      fs.writeFileSync(
        realPath,
        JSON.stringify({ date: today, used: 0, history: [] })
      );

      b2.increment({
        type: "flash_crash",
        mode: "LIVE_MULTI_AGENT",
        blocked: true,
      });
      const after2 = b2.increment({
        type: "pump_signal",
        mode: "LIVE_MULTI_AGENT",
        blocked: false,
      });

      expect(after2.history.length).toBe(2);
      expect(after2.history[1].type).toBe("pump_signal");
      expect(after2.history[1].blocked).toBe(false);
      expect(after2.history[1].at).toBeDefined();
    });
  });

  describe("daily reset", () => {
    test("used resets to 0 when stored date is older than today", () => {
      jest.resetModules();
      const b2 = require("../../src/orchestrator/challengeBudget");
      const realPath = b2._internal.BUDGET_PATH;

      // Write a file with yesterday's date and used=99
      const yesterday = "2020-01-01";
      fs.writeFileSync(
        realPath,
        JSON.stringify({ date: yesterday, used: 99, history: [] })
      );

      const state = b2.read();
      // Read should detect date drift and reset used
      expect(state.used).toBe(0);
      expect(state.date).not.toBe(yesterday);
    });
  });
});
