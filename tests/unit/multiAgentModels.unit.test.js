/**
 * Regression guard for the multi-agent model roster.
 *
 * The agent-card, README, and the live cron log all claim a Z.ai GLM-5 Analyst
 * (cron logs `model: zai.glm-5` every cycle; the IPFS reasoning manifest records
 * `{ name: "zai.glm-5", role: "analyst", provider: "aws-bedrock" }`). However a
 * stale header comment in multiAgent.js plus a dead single-model skeleton
 * (src/orchestrator/aiEngine.js, MODEL_ID = "...claude-sonnet-4-6") previously
 * made code readers believe the Analyst was Claude.
 *
 * This test pins the real source of truth (multiAgent.js `MODELS`) so the
 * published "three-model adversarial consensus" claim can never silently drift
 * away from the code. See .kiro/steering/no-lying-about-state.md (§5: every
 * integration claim must point to a verifiable artifact).
 */

// Assert the SHIPPED DEFAULTS: ignore any ambient env override so the test is
// deterministic about what production ships when ANALYST_MODEL/VALIDATOR_MODEL
// are unset.
delete process.env.ANALYST_MODEL;
delete process.env.VALIDATOR_MODEL;

const { MODELS } = require("../../src/orchestrator/multiAgent");

describe("multiAgent MODELS roster", () => {
  test("is exported as an object", () => {
    expect(MODELS).toBeDefined();
    expect(typeof MODELS).toBe("object");
  });

  test("declares analyst, validator and arbiter as non-empty strings", () => {
    for (const role of ["analyst", "validator", "arbiter"]) {
      expect(typeof MODELS[role]).toBe("string");
      expect(MODELS[role].length).toBeGreaterThan(0);
    }
  });

  test("uses three DISTINCT models (real multi-model consensus, no echo chamber)", () => {
    const ids = [MODELS.analyst, MODELS.validator, MODELS.arbiter];
    expect(new Set(ids).size).toBe(3);
    expect(MODELS.analyst).not.toBe(MODELS.validator);
  });

  test("matches the published agent-card: GLM analyst, Claude validator, Gemini arbiter", () => {
    expect(MODELS.analyst).toMatch(/glm/i);
    expect(MODELS.validator).toMatch(/claude/i);
    expect(MODELS.arbiter).toMatch(/gemini/i);
  });
});
