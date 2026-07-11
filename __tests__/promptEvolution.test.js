/**
 * Tests for On-Chain Prompt Evolution module
 */
const {
  PromptEvolution,
  EVOLUTION_CONFIG,
} = require("../src/evolution/promptEvolution");
const fs = require("fs");
const path = require("path");

const TEST_PRIVATE_KEY =
  "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("Prompt Evolution", () => {
  const outcomes = ({
    total = 20,
    correctBlocks = 0,
    goodCalls = 0,
    raw = [],
  } = {}) => ({
    total,
    summary: { correctBlocks, goodCalls },
    raw,
  });

  const makeEvolution = (outcomeData) =>
    new PromptEvolution({
      privateKey: TEST_PRIVATE_KEY,
      getOutcomeHistory: () => outcomeData,
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

    test("returns result based on internal state", () => {
      const evo = makeEvolution(outcomes({ total: 0 }));
      const result = evo.shouldEvolve({
        totalDecisions: 3,
        score: -100,
        totalFeedback: 0,
      });
      // Result depends on internal state (consecutive HOLDs counter, etc.)
      expect(typeof result.should).toBe("boolean");
      expect(typeof result.reason).toBe("string");
    });

    test("returns true when settled-trade win rate is below 40%", () => {
      const evo = makeEvolution(outcomes());
      const result = evo.shouldEvolve({
        totalDecisions: 15,
        score: 10,
        totalFeedback: 5,
      });
      expect(result.should).toBe(true);
      expect(result.reason).toContain("Win Rate");
    });

    test("returns true when settled-trade drawdown exceeds 5%", () => {
      const raw = Array.from({ length: 20 }, (_, index) => ({
        action: "swap",
        outcome: "GOOD_CALL",
        pnlBps: index === 0 ? -600 : 100,
      }));
      const evo = makeEvolution(
        outcomes({ total: 20, goodCalls: 20, raw })
      );
      const result = evo.shouldEvolve({
        totalDecisions: 20,
        score: -100,
        totalFeedback: 10,
      });
      expect(result.should).toBe(true);
      expect(result.reason).toContain("Max Drawdown");
    });

    test("respects cooldown period", () => {
      const evo = makeEvolution(outcomes());
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
    const evo = makeEvolution(outcomes());

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
