/**
 * Unit tests for multi-agent normalizers and consensus logic.
 *
 * These test the most critical parsing functions that translate
 * unpredictable AI output into structured trading decisions.
 */

const {
  normalizeAnalystResponse,
  normalizeValidatorResponse,
  shouldPromoteGridTradeCandidate,
  compactOriginalAnalystProposal,
  getDynamicConfidenceThreshold,
  evaluateConsensus,
  ANALYST_SYSTEM_PROMPT,
} = require("../../src/orchestrator/multiAgent");
const { DEFAULT_CONFIDENCE_FALLBACK } = require("../../src/config/constants");

describe("normalizeAnalystResponse", () => {
  describe("action normalization", () => {
    it('should accept valid "swap" action', () => {
      const result = normalizeAnalystResponse({
        action: "swap",
        confidence: 0.8,
      });
      expect(result.action).toBe("swap");
    });

    it('should accept valid "hold" action', () => {
      const result = normalizeAnalystResponse({
        action: "hold",
        confidence: 0.3,
      });
      expect(result.action).toBe("hold");
    });

    it('should normalize "SWAP" to "swap"', () => {
      const result = normalizeAnalystResponse({
        action: "SWAP",
        confidence: 0.9,
      });
      expect(result.action).toBe("swap");
    });

    it('should use "decision" field as fallback for action', () => {
      const result = normalizeAnalystResponse({
        decision: "swap",
        confidence: 0.7,
      });
      expect(result.action).toBe("swap");
    });

    it('should default to "hold" for unrecognized actions', () => {
      const result = normalizeAnalystResponse({
        action: "buy_everything",
        confidence: 0.9,
      });
      expect(result.action).toBe("hold");
    });

    it('should default to "hold" when action is missing', () => {
      const result = normalizeAnalystResponse({ confidence: 0.9 });
      expect(result.action).toBe("hold");
    });
  });

  describe("confidence normalization", () => {
    it("should pass through valid 0-1 confidence", () => {
      const result = normalizeAnalystResponse({
        action: "swap",
        confidence: 0.85,
      });
      expect(result.confidence).toBe(0.85);
    });

    it("should convert percentage confidence (85) to decimal (0.85)", () => {
      const result = normalizeAnalystResponse({
        action: "swap",
        confidence: 85,
      });
      expect(result.confidence).toBe(0.85);
    });

    it("should clamp confidence above 100 to 1", () => {
      const result = normalizeAnalystResponse({
        action: "swap",
        confidence: 150,
      });
      expect(result.confidence).toBe(1);
    });

    it("should clamp negative confidence to 0", () => {
      const result = normalizeAnalystResponse({
        action: "swap",
        confidence: -0.5,
      });
      expect(result.confidence).toBe(0);
    });

    it("should use fallback for NaN confidence", () => {
      const result = normalizeAnalystResponse({
        action: "swap",
        confidence: "very high",
      });
      expect(result.confidence).toBe(DEFAULT_CONFIDENCE_FALLBACK);
    });

    it('should accept "conf" as alias for confidence', () => {
      const result = normalizeAnalystResponse({ action: "swap", conf: 0.72 });
      expect(result.confidence).toBe(0.72);
    });
  });

  describe("direction normalization", () => {
    it('should normalize "bullish" to "risk_on"', () => {
      const result = normalizeAnalystResponse({
        action: "swap",
        confidence: 0.8,
        direction: "bullish",
      });
      expect(result.direction).toBe("risk_on");
    });

    it('should normalize "bearish" to "risk_off"', () => {
      const result = normalizeAnalystResponse({
        action: "swap",
        confidence: 0.8,
        direction: "bearish",
      });
      expect(result.direction).toBe("risk_off");
    });

    it('should accept "risk_on" directly', () => {
      const result = normalizeAnalystResponse({
        action: "swap",
        confidence: 0.8,
        direction: "risk_on",
      });
      expect(result.direction).toBe("risk_on");
    });

    it('should use "sentiment" as fallback for direction', () => {
      const result = normalizeAnalystResponse({
        action: "swap",
        confidence: 0.8,
        sentiment: "bullish",
      });
      expect(result.direction).toBe("risk_on");
    });

    it('should default to "neutral" for unknown directions', () => {
      const result = normalizeAnalystResponse({
        action: "swap",
        confidence: 0.8,
        direction: "sideways_chaos",
      });
      expect(result.direction).toBe("neutral");
    });
  });

  describe("targetAsset normalization", () => {
    it('should normalize "ETH" to "mETH"', () => {
      const result = normalizeAnalystResponse({
        action: "swap",
        confidence: 0.8,
        targetAsset: "ETH",
      });
      expect(result.targetAsset).toBe("mETH");
    });

    it('should normalize "meth" to "mETH"', () => {
      const result = normalizeAnalystResponse({
        action: "swap",
        confidence: 0.8,
        targetAsset: "meth",
      });
      expect(result.targetAsset).toBe("mETH");
    });

    it('should normalize "USDT" to "USDT" (RWA-aware vocabulary)', () => {
      // After rwa-allocation-active T7, USDT is a first-class targetAsset
      // for rwa_exit actions. It is no longer downgraded to mUSD.
      const result = normalizeAnalystResponse({
        action: "swap",
        confidence: 0.8,
        targetAsset: "USDT",
      });
      expect(result.targetAsset).toBe("USDT");
    });

    it('should normalize "USDT0" to "USDT0" (LayerZero Tether)', () => {
      const result = normalizeAnalystResponse({
        action: "rwa_allocate",
        confidence: 0.8,
        targetAsset: "USDT0",
      });
      expect(result.targetAsset).toBe("USDT0");
    });

    it("should default rwa_allocate target to USDT0 when missing", () => {
      const result = normalizeAnalystResponse({
        action: "rwa_allocate",
        confidence: 0.8,
      });
      expect(result.targetAsset).toBe("USDT0");
    });

    it("should default rwa_exit target to USDT when missing", () => {
      const result = normalizeAnalystResponse({
        action: "rwa_exit",
        confidence: 0.8,
      });
      expect(result.targetAsset).toBe("USDT");
    });

    it('should use "target_asset" snake_case field', () => {
      const result = normalizeAnalystResponse({
        action: "swap",
        confidence: 0.8,
        target_asset: "mETH",
      });
      expect(result.targetAsset).toBe("mETH");
    });

    it('should default to "mUSD" when no target specified', () => {
      const result = normalizeAnalystResponse({
        action: "swap",
        confidence: 0.8,
      });
      expect(result.targetAsset).toBe("mUSD");
    });
  });

  describe("sourceAsset normalization", () => {
    it("should normalize snake_case source asset aliases", () => {
      const result = normalizeAnalystResponse({
        action: "swap",
        confidence: 0.8,
        targetAsset: "mUSD",
        source_asset: "wrapped mnt",
      });
      expect(result.sourceAsset).toBe("WMNT");
    });

    it("should default sourceAsset to null when no source is provided", () => {
      const result = normalizeAnalystResponse({
        action: "swap",
        confidence: 0.8,
        targetAsset: "mETH",
      });
      expect(result.sourceAsset).toBeNull();
    });
  });

  describe("allocationPct normalization", () => {
    it("should pass through valid allocation", () => {
      const result = normalizeAnalystResponse({
        action: "swap",
        confidence: 0.8,
        allocationPct: 30,
      });
      expect(result.allocationPct).toBe(30);
    });

    it("should clamp allocation above 100", () => {
      const result = normalizeAnalystResponse({
        action: "swap",
        confidence: 0.8,
        allocationPct: 200,
      });
      expect(result.allocationPct).toBe(100);
    });

    it("should clamp negative allocation to 0", () => {
      const result = normalizeAnalystResponse({
        action: "swap",
        confidence: 0.8,
        allocationPct: -10,
      });
      expect(result.allocationPct).toBe(0);
    });

    it("should default to 20% when not specified", () => {
      const result = normalizeAnalystResponse({
        action: "swap",
        confidence: 0.8,
      });
      expect(result.allocationPct).toBe(20);
    });

    it('should use "allocation_pct" snake_case field', () => {
      const result = normalizeAnalystResponse({
        action: "swap",
        confidence: 0.8,
        allocation_pct: 45,
      });
      expect(result.allocationPct).toBe(45);
    });
  });

  describe("expectedYield normalization", () => {
    it("drops null expectedYield so valid hold JSON does not fail schema validation", () => {
      const result = normalizeAnalystResponse({
        action: "hold",
        direction: "neutral",
        targetAsset: null,
        sourceAsset: null,
        allocationPct: 0,
        confidence: 0.6,
        reasoning: "Waiting for breakout confirmation.",
        riskFactors: [],
        expectedYield: null,
      });

      expect(result.expectedYield).toBeUndefined();
    });
  });

  describe("reasoning normalization", () => {
    it("should pass through reasoning string", () => {
      const result = normalizeAnalystResponse({
        action: "hold",
        confidence: 0.5,
        reasoning: "Market is choppy",
      });
      expect(result.reasoning).toBe("Market is choppy");
    });

    it('should use "reason" as fallback', () => {
      const result = normalizeAnalystResponse({
        action: "hold",
        confidence: 0.5,
        reason: "Low liquidity",
      });
      expect(result.reasoning).toBe("Low liquidity");
    });

    it("should truncate reasoning to 1000 chars", () => {
      const longReason = "x".repeat(2000);
      const result = normalizeAnalystResponse({
        action: "hold",
        confidence: 0.5,
        reasoning: longReason,
      });
      expect(result.reasoning.length).toBe(1000);
    });

    it("should provide default reasoning when missing", () => {
      const result = normalizeAnalystResponse({
        action: "hold",
        confidence: 0.5,
      });
      expect(result.reasoning).toBeTruthy();
      expect(result.reasoning.length).toBeGreaterThan(0);
    });
  });

  describe("riskFactors normalization", () => {
    it("should pass through array of risk factors", () => {
      const result = normalizeAnalystResponse({
        action: "swap",
        confidence: 0.8,
        riskFactors: ["slippage", "low volume"],
      });
      expect(result.riskFactors).toEqual(["slippage", "low volume"]);
    });

    it("should convert string to array", () => {
      const result = normalizeAnalystResponse({
        action: "swap",
        confidence: 0.8,
        riskFactors: "high volatility",
      });
      expect(result.riskFactors).toEqual(["high volatility"]);
    });

    it('should use "risk_factors" snake_case', () => {
      const result = normalizeAnalystResponse({
        action: "swap",
        confidence: 0.8,
        risk_factors: ["MEV risk"],
      });
      expect(result.riskFactors).toEqual(["MEV risk"]);
    });

    it("should default to empty array", () => {
      const result = normalizeAnalystResponse({
        action: "swap",
        confidence: 0.8,
      });
      expect(result.riskFactors).toEqual([]);
    });
  });

  describe("edge cases", () => {
    it("should handle null input gracefully", () => {
      const result = normalizeAnalystResponse(null);
      expect(result).toBeNull();
    });

    it("should handle non-object input", () => {
      const result = normalizeAnalystResponse("not an object");
      expect(result).toBe("not an object");
    });

    it("should handle GLM-5 YAML-like format after JSON parse", () => {
      // This simulates what happens after the YAML->JSON conversion
      const result = normalizeAnalystResponse({
        action: "swap",
        confidence: 85, // percentage format
        target_asset: "mETH",
        allocation: 25,
        reason: "Funding rate extremely negative",
      });
      expect(result.action).toBe("swap");
      expect(result.confidence).toBe(0.85);
      expect(result.targetAsset).toBe("mETH");
      expect(result.allocationPct).toBe(25);
      expect(result.reasoning).toBe("Funding rate extremely negative");
    });
  });
});

describe("multi-agent prompt guardrails", () => {
  test("analyst prompt distinguishes upward EXIT_RANGING from bearish breakdown", () => {
    expect(ANALYST_SYSTEM_PROMPT).toMatch(/EXIT_RANGING/i);
    expect(ANALYST_SYSTEM_PROMPT).toMatch(/broke above resistance/i);
    expect(ANALYST_SYSTEM_PROMPT).toMatch(/TREND_UP/i);
  });

  test("analyst prompt requires portfolio-aware risk-off restraint", () => {
    expect(ANALYST_SYSTEM_PROMPT).toMatch(/stable-heavy/i);
    expect(ANALYST_SYSTEM_PROMPT).toMatch(/do not propose repeated risk_off/i);
  });

  test("analyst prompt requires explicit risk-off source asset", () => {
    expect(ANALYST_SYSTEM_PROMPT).toMatch(/sourceAsset="mETH"/);
    expect(ANALYST_SYSTEM_PROMPT).toMatch(/sourceAsset="WMNT"/);
  });
});

describe("grid candidate promotion", () => {
  test("treats null analyst output as abstention instead of throwing", () => {
    const candidate = {
      active: true,
      direction: "risk_on",
      targetAsset: "mETH",
    };

    expect(shouldPromoteGridTradeCandidate(candidate, null)).toBe(true);
  });

  test("audit snapshot handles null analyst output", () => {
    expect(compactOriginalAnalystProposal(null)).toBeNull();
  });
});

describe("normalizeValidatorResponse", () => {
  describe("approved normalization", () => {
    it("should accept boolean true", () => {
      const result = normalizeValidatorResponse({
        approved: true,
        validatorConfidence: 0.8,
        riskScore: 40,
      });
      expect(result.approved).toBe(true);
    });

    it("should accept boolean false", () => {
      const result = normalizeValidatorResponse({
        approved: false,
        validatorConfidence: 0.4,
        riskScore: 80,
      });
      expect(result.approved).toBe(false);
    });

    it('should convert string "true" to boolean', () => {
      const result = normalizeValidatorResponse({
        approved: "true",
        validatorConfidence: 0.8,
        riskScore: 40,
      });
      expect(result.approved).toBe(true);
    });

    it('should convert string "yes" to boolean true', () => {
      const result = normalizeValidatorResponse({
        approved: "yes",
        validatorConfidence: 0.8,
        riskScore: 40,
      });
      expect(result.approved).toBe(true);
    });

    it('should use "approve" as fallback field', () => {
      const result = normalizeValidatorResponse({
        approve: true,
        validatorConfidence: 0.8,
        riskScore: 40,
      });
      expect(result.approved).toBe(true);
    });

    it("should default to false when missing", () => {
      const result = normalizeValidatorResponse({
        validatorConfidence: 0.8,
        riskScore: 40,
      });
      expect(result.approved).toBe(false);
    });
  });

  describe("validatorConfidence normalization", () => {
    it("should pass through valid 0-1 confidence", () => {
      const result = normalizeValidatorResponse({
        approved: true,
        validatorConfidence: 0.82,
        riskScore: 30,
      });
      expect(result.validatorConfidence).toBe(0.82);
    });

    it("should convert percentage to decimal", () => {
      const result = normalizeValidatorResponse({
        approved: true,
        validatorConfidence: 78,
        riskScore: 30,
      });
      expect(result.validatorConfidence).toBe(0.78);
    });

    it('should use "validator_confidence" snake_case', () => {
      const result = normalizeValidatorResponse({
        approved: true,
        validator_confidence: 0.9,
        riskScore: 30,
      });
      expect(result.validatorConfidence).toBe(0.9);
    });

    it('should fall back to "confidence" field', () => {
      const result = normalizeValidatorResponse({
        approved: true,
        confidence: 0.75,
        riskScore: 30,
      });
      expect(result.validatorConfidence).toBe(0.75);
    });

    it("should use fallback for NaN", () => {
      const result = normalizeValidatorResponse({
        approved: true,
        validatorConfidence: "high",
        riskScore: 30,
      });
      expect(result.validatorConfidence).toBe(DEFAULT_CONFIDENCE_FALLBACK);
    });
  });

  describe("riskScore normalization", () => {
    it("should pass through valid risk score", () => {
      const result = normalizeValidatorResponse({
        approved: true,
        validatorConfidence: 0.8,
        riskScore: 55,
      });
      expect(result.riskScore).toBe(55);
    });

    it('should use "risk_score" snake_case', () => {
      const result = normalizeValidatorResponse({
        approved: true,
        validatorConfidence: 0.8,
        risk_score: 42,
      });
      expect(result.riskScore).toBe(42);
    });
  });

  describe("edge cases", () => {
    it("should handle null input", () => {
      const result = normalizeValidatorResponse(null);
      expect(result).toBeNull();
    });

    it("should handle complete validator response", () => {
      const result = normalizeValidatorResponse({
        approved: true,
        validatorConfidence: 82,
        riskScore: 35,
        reasoning: "Funding rate confirms direction, R:R is 2.1:1",
        flaggedIssues: ["slippage concern on large order"],
        recommendation: "approve with reduced size",
      });
      expect(result.approved).toBe(true);
      expect(result.validatorConfidence).toBe(0.82);
      expect(result.riskScore).toBe(35);
      expect(result.reasoning).toBe(
        "Funding rate confirms direction, R:R is 2.1:1"
      );
    });
  });
});

describe("evaluateConsensus", () => {
  const analystDecision = {
    action: "swap",
    targetAsset: "mETH",
    confidence: 0.7,
  };

  it("treats validator.approved=false as a hard veto even if arbiter approves", () => {
    const result = evaluateConsensus({
      analystDecision,
      confidenceThreshold: 0.55,
      validator: {
        approved: false,
        validatorConfidence: 0.9,
        riskScore: 20,
      },
      arbiterVote: { vote: "approve", confidence: 0.95 },
    });

    expect(result.consensus).toBe(false);
    expect(result.validatorHardVeto).toBe(true);
    expect(result.needsArbiter).toBe(false);
    expect(result.blockReason).toMatch(/hard veto/i);
  });

  it("treats riskScore over the ceiling as a hard veto", () => {
    const result = evaluateConsensus({
      analystDecision,
      confidenceThreshold: 0.55,
      validator: {
        approved: true,
        validatorConfidence: 0.9,
        riskScore: 90,
      },
      arbiterVote: { vote: "approve", confidence: 0.95 },
    });

    expect(result.consensus).toBe(false);
    expect(result.validatorHardVeto).toBe(true);
    expect(result.blockReason).toMatch(/risk too high/i);
  });

  it("allows arbiter only for soft validator-confidence disagreement", () => {
    const preArbiter = evaluateConsensus({
      analystDecision,
      confidenceThreshold: 0.55,
      validator: {
        approved: true,
        validatorConfidence: 0.42,
        riskScore: 20,
      },
    });

    expect(preArbiter.consensus).toBe(false);
    expect(preArbiter.validatorHardVeto).toBe(false);
    expect(preArbiter.needsArbiter).toBe(true);

    const postArbiter = evaluateConsensus({
      analystDecision,
      confidenceThreshold: 0.55,
      validator: {
        approved: true,
        validatorConfidence: 0.42,
        riskScore: 20,
      },
      arbiterVote: { vote: "approve", confidence: 0.8 },
    });

    expect(postArbiter.consensus).toBe(true);
    expect(postArbiter.validatorHardVeto).toBe(false);
  });

  it("does not call arbiter when the analyst itself does not want an action", () => {
    const result = evaluateConsensus({
      analystDecision: {
        action: "hold",
        targetAsset: "mUSD",
        confidence: 0.9,
      },
      confidenceThreshold: 0.55,
      validator: {
        approved: true,
        validatorConfidence: 0.9,
        riskScore: 20,
      },
    });

    expect(result.consensus).toBe(false);
    expect(result.needsArbiter).toBe(false);
  });
});

describe("getDynamicConfidenceThreshold", () => {
  it("should return a number between 0 and 1", () => {
    const threshold = getDynamicConfidenceThreshold();
    expect(typeof threshold).toBe("number");
    expect(threshold).toBeGreaterThanOrEqual(0);
    expect(threshold).toBeLessThanOrEqual(1);
  });

  it("should return at least BASE_CONFIDENCE_THRESHOLD", () => {
    const { BASE_CONFIDENCE_THRESHOLD } = require("../../src/config/constants");
    const threshold = getDynamicConfidenceThreshold();
    expect(threshold).toBeGreaterThanOrEqual(BASE_CONFIDENCE_THRESHOLD);
  });
});

// ─────────────────────────────────────────────────────────────────
// Audit 31: prompt-content invariants for the risk_on/risk_off
// asymmetry fix. Earlier the analyst prompt encouraged risk_off swaps
// during fear regimes but had no symmetric trigger for oversold-
// bounce buys, producing 28/28 swaps to mUSD over a 7-day window
// with zero risk_on entries. The OVERSOLD COUNTER-BIAS section now
// gives the LLM an explicit counter-trend rule for RSI<30 +
// Fear&Greed<25 setups. These tests guard against silent removal of
// that section in future prompt edits.
// ─────────────────────────────────────────────────────────────────
describe("ANALYST_SYSTEM_PROMPT — counter-bias invariants (audit 31)", () => {
  const {
    ANALYST_SYSTEM_PROMPT,
  } = require("../../src/orchestrator/multiAgent");

  it("should be a non-empty string", () => {
    expect(typeof ANALYST_SYSTEM_PROMPT).toBe("string");
    expect(ANALYST_SYSTEM_PROMPT.length).toBeGreaterThan(500);
  });

  it("should contain the OVERSOLD COUNTER-BIAS section", () => {
    expect(ANALYST_SYSTEM_PROMPT).toMatch(/OVERSOLD COUNTER-BIAS/i);
  });

  it("should describe the RSI<30 + Fear&Greed<25 setup", () => {
    expect(ANALYST_SYSTEM_PROMPT).toMatch(/RSI\(4h\)\s*<\s*30/);
    expect(ANALYST_SYSTEM_PROMPT).toMatch(/Fear&Greed\s*<\s*25/);
  });

  it("should explicitly reference risk_on as a valid output for oversold setups", () => {
    // The section must produce a path where the analyst proposes
    // direction="risk_on" for a counter-trend bounce. We assert the
    // string is present in the OVERSOLD section, not just elsewhere.
    const idx = ANALYST_SYSTEM_PROMPT.search(/OVERSOLD COUNTER-BIAS/);
    expect(idx).toBeGreaterThan(0);
    const section = ANALYST_SYSTEM_PROMPT.slice(idx, idx + 1500);
    expect(section).toMatch(/risk_on/);
    expect(section).toMatch(/mETH/);
  });

  it("should include a HARD BLOCK against pure falling-knife setups", () => {
    // The counter-bias must NOT be unconditional — it has to refuse
    // counter-trend longs when smart money is bleeding out on new
    // lows. Guards against the LLM hallucinating "buy the dip" on
    // every red candle.
    expect(ANALYST_SYSTEM_PROMPT).toMatch(/HARD BLOCK/);
    expect(ANALYST_SYSTEM_PROMPT).toMatch(/falling knife/i);
  });

  it("should keep the risk_off / mUSD path intact (no asymmetric removal)", () => {
    // The fix adds counter-bias; it must NOT remove the original
    // risk_off rules. Guards against an over-zealous future prompt
    // edit that swings the bias the other way.
    expect(ANALYST_SYSTEM_PROMPT).toMatch(/risk_off/);
    expect(ANALYST_SYSTEM_PROMPT).toMatch(/mUSD/);
  });
});
