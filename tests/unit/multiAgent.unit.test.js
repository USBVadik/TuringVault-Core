/**
 * Unit tests for multi-agent normalizers and consensus logic.
 *
 * These test the most critical parsing functions that translate
 * unpredictable AI output into structured trading decisions.
 */

const {
  normalizeAnalystResponse,
  normalizeValidatorResponse,
  getDynamicConfidenceThreshold,
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
