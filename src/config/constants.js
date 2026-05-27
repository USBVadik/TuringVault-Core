/**
 * TuringVault Trading Constants
 *
 * All magic numbers used across the orchestrator, extracted here
 * for visibility, auditability, and easy tuning.
 */

module.exports = {
  // === Confidence Thresholds ===
  BASE_CONFIDENCE_THRESHOLD: 0.6, // Minimum analyst confidence to consider a trade
  ELEVATED_CONFIDENCE_THRESHOLD: 0.85, // Threshold after consecutive losses (circuit breaker)
  VALIDATOR_TOLERANCE: 0.05, // Validator can be this much below analyst threshold
  DEFAULT_CONFIDENCE_FALLBACK: 0.5, // When AI returns non-numeric confidence

  // === Risk Parameters ===
  MAX_RISK_SCORE: 75, // Validator risk score ceiling (0-100)
  MIN_RISK_REWARD_RATIO: 1.5, // Minimum R:R to approve a trade
  MAX_DRAWDOWN_PCT: 8, // Portfolio drawdown % that triggers pause

  // === Position Sizing ===
  MAX_SINGLE_SWAP_PCT: 50, // Max % of portfolio in single swap
  MAX_SLIPPAGE_BPS: 100, // 1% default slippage tolerance

  // === AI Model Config ===
  ANALYST_TEMPERATURE: 0.3, // Higher = more creative trades
  VALIDATOR_TEMPERATURE: 0.05, // Lower = more conservative validation
  ARBITER_TEMPERATURE: 0.1, // Tiebreaker temperature
  MAX_TOKENS_ANALYST: 2048, // Token budget for analyst response
  MAX_TOKENS_VALIDATOR: 1024, // Token budget for validator response

  // === Timing ===
  CYCLE_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes between cycles
  SIGNAL_CACHE_TTL_MS: 5 * 60 * 1000, // 5 minutes signal cache
  PROPOSAL_TTL_SECONDS: 300, // On-chain proposal validity window
  SWAP_DEADLINE_SECONDS: 300, // DEX swap deadline

  // === Circuit Breakers ===
  MAX_CONSECUTIVE_ERRORS: 3, // Errors before auto-pause
  MAX_DAILY_CYCLES: 288, // Hard cap on daily executions
  CONFIDENCE_BOOST_PER_LOSS: 0.05, // Threshold raises after each loss

  // === Signal Weights ===
  FUNDING_WEIGHT: 0.25, // Weight of funding rate in composite signal
  REGIME_WEIGHT: 0.35, // Weight of regime detection
  GRID_WEIGHT: 0.25, // Weight of grid signal
  NANSEN_WEIGHT: 0.15, // Weight of smart money flow

  // === Regime Classification ===
  REGIME_TRENDING_THRESHOLD: 0.65, // Above this = trending market
  REGIME_RANGING_THRESHOLD: 0.35, // Below this = ranging market

  // === On-chain ===
  MIN_ANALYST_CONFIDENCE_BPS: 8500, // 85% in basis points (contract)
  MIN_VALIDATOR_CONFIDENCE_BPS: 7500, // 75% in basis points (contract)
  MAX_RISK_SCORE_BPS: 6000, // 60% in basis points (contract)
};
