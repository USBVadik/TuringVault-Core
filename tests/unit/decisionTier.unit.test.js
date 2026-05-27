/**
 * Unit tests for decisionTier.classifyDecisionTier.
 *
 * Spec: .kiro/specs/agent-reasoning-quality/{requirements,design,tasks}.md (T3)
 */

const {
  classifyDecisionTier,
  TIERS,
} = require("../../src/orchestrator/decisionTier");

// Convenience builders so each test reads top-down.
const analyst = (confidence = 0.8) => ({
  confidence,
  action: "swap",
  targetAsset: "mETH",
});
const validator = (approved = true) => ({ approved, validatorConfidence: 0.8 });
const decision = (overrides = {}) => ({
  analyst: analyst(),
  validator: validator(),
  consensus: true,
  action: "swap",
  ...overrides,
});
const market = (regime = "TREND_UP") => ({
  structuredSignals: { regime: { regime } },
});

describe("classifyDecisionTier", () => {
  // ── Parse failure ────────────────────────────────────────────────
  test("null analyst → BLOCKED_BY_PARSE_FAILURE", () => {
    expect(classifyDecisionTier(decision({ analyst: null }), market())).toBe(
      TIERS.BLOCKED_BY_PARSE_FAILURE
    );
  });

  test("null validator → BLOCKED_BY_PARSE_FAILURE", () => {
    expect(classifyDecisionTier(decision({ validator: null }), market())).toBe(
      TIERS.BLOCKED_BY_PARSE_FAILURE
    );
  });

  test("both null → BLOCKED_BY_PARSE_FAILURE", () => {
    expect(
      classifyDecisionTier({ analyst: null, validator: null }, market())
    ).toBe(TIERS.BLOCKED_BY_PARSE_FAILURE);
  });

  test("completely empty decision → BLOCKED_BY_PARSE_FAILURE", () => {
    expect(classifyDecisionTier({}, {})).toBe(TIERS.BLOCKED_BY_PARSE_FAILURE);
  });

  test("null decision argument → BLOCKED_BY_PARSE_FAILURE", () => {
    expect(classifyDecisionTier(null, null)).toBe(
      TIERS.BLOCKED_BY_PARSE_FAILURE
    );
  });

  // ── Low confidence (precedes regime check) ───────────────────────
  test("analyst.confidence below default threshold → LOW_CONFIDENCE", () => {
    expect(
      classifyDecisionTier(decision({ analyst: analyst(0.4) }), market())
    ).toBe(TIERS.BLOCKED_BY_LOW_CONFIDENCE);
  });

  test("LOW_CONFIDENCE wins over regime HOLD (pipeline order)", () => {
    expect(
      classifyDecisionTier(decision({ analyst: analyst(0.4) }), market("HOLD"))
    ).toBe(TIERS.BLOCKED_BY_LOW_CONFIDENCE);
  });

  test("elevated _activeThreshold raises bar", () => {
    // 0.7 confidence, base threshold 0.6 → would pass.
    // With elevated 0.85, fails → LOW_CONFIDENCE.
    expect(
      classifyDecisionTier(
        decision({ analyst: analyst(0.7), _activeThreshold: 0.85 }),
        market()
      )
    ).toBe(TIERS.BLOCKED_BY_LOW_CONFIDENCE);
  });

  // ── Regime block ─────────────────────────────────────────────────
  test("regime HOLD → BLOCKED_BY_REGIME", () => {
    expect(classifyDecisionTier(decision(), market("HOLD"))).toBe(
      TIERS.BLOCKED_BY_REGIME
    );
  });

  test("regime UNKNOWN → BLOCKED_BY_REGIME", () => {
    expect(classifyDecisionTier(decision(), market("UNKNOWN"))).toBe(
      TIERS.BLOCKED_BY_REGIME
    );
  });

  test("consensus true + action hold → BLOCKED_BY_REGIME (fallthrough)", () => {
    expect(
      classifyDecisionTier(
        decision({ action: "hold", analyst: { ...analyst(), action: "hold" } }),
        market("TREND_UP")
      )
    ).toBe(TIERS.BLOCKED_BY_REGIME);
  });

  // ── Validator veto ───────────────────────────────────────────────
  test("validator.approved=false → BLOCKED_BY_VALIDATOR", () => {
    expect(
      classifyDecisionTier(decision({ validator: validator(false) }), market())
    ).toBe(TIERS.BLOCKED_BY_VALIDATOR);
  });

  test("validator.approved missing → BLOCKED_BY_VALIDATOR (treated as false)", () => {
    expect(
      classifyDecisionTier(
        decision({
          validator: {
            /* no approved field */
          },
        }),
        market()
      )
    ).toBe(TIERS.BLOCKED_BY_VALIDATOR);
  });

  // ── Executed swap ────────────────────────────────────────────────
  test("all green + consensus + swap → EXECUTED_SWAP", () => {
    expect(classifyDecisionTier(decision(), market("TREND_UP"))).toBe(
      TIERS.EXECUTED_SWAP
    );
  });

  test("contrarian regime still allows EXECUTED_SWAP", () => {
    expect(classifyDecisionTier(decision(), market("CONTRARIAN_LONG"))).toBe(
      TIERS.EXECUTED_SWAP
    );
  });

  test("RANGING regime still allows EXECUTED_SWAP", () => {
    expect(classifyDecisionTier(decision(), market("RANGING"))).toBe(
      TIERS.EXECUTED_SWAP
    );
  });

  // ── Determinism ──────────────────────────────────────────────────
  test("same inputs give same output (no randomness)", () => {
    const d = decision({ analyst: analyst(0.85) });
    const m = market("TREND_DOWN");
    const a = classifyDecisionTier(d, m);
    const b = classifyDecisionTier(d, m);
    expect(a).toBe(b);
  });
});
