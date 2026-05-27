/**
 * Tests for On-Chain Prompt Evolution module
 */
const {
  PromptEvolution,
  EVOLUTION_CONFIG,
} = require("../src/evolution/promptEvolution");
const fs = require("fs");
const path = require("path");

describe("Prompt Evolution", () => {
  let evo;

  beforeAll(() => {
    evo = new PromptEvolution();
  });

  describe("shouldEvolve", () => {
    const logPath = path.resolve(__dirname, "../src/data/evolution_log.json");
    let backup;

    beforeEach(() => {
      backup = fs.existsSync(logPath) ? fs.readFileSync(logPath) : null;
      // Clear log so cooldown doesn't interfere
      if (fs.existsSync(logPath)) fs.unlinkSync(logPath);
    });

    afterEach(() => {
      if (backup) fs.writeFileSync(logPath, backup);
      else if (fs.existsSync(logPath)) fs.unlinkSync(logPath);
    });

    test("returns false when too few decisions", () => {
      const result = evo.shouldEvolve({
        totalDecisions: 3,
        score: -100,
        totalFeedback: 0,
      });
      expect(result.should).toBe(false);
      expect(result.reason).toContain("Need");
    });

    test("returns true when enough decisions and seeking optimization", () => {
      const result = evo.shouldEvolve({
        totalDecisions: 15,
        score: 10,
        totalFeedback: 5,
      });
      expect(result.should).toBe(true);
      expect(result.reason).toContain("optimization");
    });

    test("returns true on poor performance", () => {
      const result = evo.shouldEvolve({
        totalDecisions: 20,
        score: -100,
        totalFeedback: 10,
      });
      expect(result.should).toBe(true);
      expect(result.reason).toContain("Poor performance");
    });

    test("respects cooldown period", () => {
      fs.writeFileSync(
        logPath,
        JSON.stringify({
          evolutions: [{ timestamp: new Date().toISOString() }],
        })
      );

      const result = evo.shouldEvolve({
        totalDecisions: 50,
        score: -200,
        totalFeedback: 20,
      });
      expect(result.should).toBe(false);
      expect(result.reason).toContain("Cooldown");
    });
  });

  describe("incrementVersion", () => {
    test("increments patch version", () => {
      expect(evo.incrementVersion("2.0.0")).toBe("2.0.1");
      expect(evo.incrementVersion("2.0.8")).toBe("2.0.9");
    });

    test("rolls over to minor version", () => {
      expect(evo.incrementVersion("2.0.9")).toBe("2.1.0");
    });
  });

  describe("EVOLUTION_CONFIG", () => {
    test("has sane defaults", () => {
      expect(EVOLUTION_CONFIG.minDecisionsForReflection).toBeGreaterThanOrEqual(
        5
      );
      expect(EVOLUTION_CONFIG.cooldownHours).toBeGreaterThanOrEqual(1);
      expect(EVOLUTION_CONFIG.maxPromptLength).toBeLessThanOrEqual(5000);
    });
  });
});
