/**
 * Validate trading constants are sane and consistent.
 */

const constants = require('../../src/config/constants');

describe('Trading Constants', () => {
  describe('sanity checks', () => {
    it('BASE_CONFIDENCE_THRESHOLD should be between 0 and 1', () => {
      expect(constants.BASE_CONFIDENCE_THRESHOLD).toBeGreaterThan(0);
      expect(constants.BASE_CONFIDENCE_THRESHOLD).toBeLessThan(1);
    });

    it('ELEVATED should be higher than BASE confidence', () => {
      expect(constants.ELEVATED_CONFIDENCE_THRESHOLD).toBeGreaterThan(constants.BASE_CONFIDENCE_THRESHOLD);
    });

    it('VALIDATOR_TOLERANCE should be small positive number', () => {
      expect(constants.VALIDATOR_TOLERANCE).toBeGreaterThan(0);
      expect(constants.VALIDATOR_TOLERANCE).toBeLessThan(0.2);
    });

    it('MAX_RISK_SCORE should be between 0 and 100', () => {
      expect(constants.MAX_RISK_SCORE).toBeGreaterThan(0);
      expect(constants.MAX_RISK_SCORE).toBeLessThanOrEqual(100);
    });

    it('MIN_RISK_REWARD_RATIO should be >= 1', () => {
      expect(constants.MIN_RISK_REWARD_RATIO).toBeGreaterThanOrEqual(1);
    });

    it('MAX_SINGLE_SWAP_PCT should be <= 100', () => {
      expect(constants.MAX_SINGLE_SWAP_PCT).toBeGreaterThan(0);
      expect(constants.MAX_SINGLE_SWAP_PCT).toBeLessThanOrEqual(100);
    });

    it('signal weights should sum to ~1.0', () => {
      const sum = constants.FUNDING_WEIGHT + constants.REGIME_WEIGHT + constants.GRID_WEIGHT + constants.NANSEN_WEIGHT;
      expect(sum).toBeCloseTo(1.0, 2);
    });

    it('regime thresholds should be ordered correctly', () => {
      expect(constants.REGIME_RANGING_THRESHOLD).toBeLessThan(constants.REGIME_TRENDING_THRESHOLD);
    });
  });

  describe('on-chain consistency', () => {
    it('on-chain BPS values should be in valid range', () => {
      expect(constants.MIN_ANALYST_CONFIDENCE_BPS).toBeLessThanOrEqual(10000);
      expect(constants.MIN_VALIDATOR_CONFIDENCE_BPS).toBeLessThanOrEqual(10000);
      expect(constants.MAX_RISK_SCORE_BPS).toBeLessThanOrEqual(10000);
    });

    it('on-chain analyst confidence should match off-chain', () => {
      const offChain = constants.BASE_CONFIDENCE_THRESHOLD;
      const onChain = constants.MIN_ANALYST_CONFIDENCE_BPS / 10000;
      // On-chain is stricter (uses elevated threshold for safety)
      expect(onChain).toBeGreaterThanOrEqual(offChain);
    });
  });
});
