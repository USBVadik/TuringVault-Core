/**
 * RWA Allocation Limits — central source of truth for the
 * `rwaAllocator` and `MerchantMoeDEX.executeSwap` safety gates.
 *
 * Each value can be overridden via `process.env.RWA_*` without code
 * change, so the operator can tune from GitHub Actions secrets without
 * a redeploy.
 *
 * Spec: .kiro/specs/rwa-allocation-active (R2.6, R2.7, R4.1, design §C2)
 */

function num(key, fallback) {
  const raw = process.env[key];
  if (raw === undefined || raw === "" || raw === null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

module.exports = {
  // Per-cycle ceiling — single swap can't move more than this in USD.
  // Default $5 sized for current ~$40 NAV demo wallet.
  MAX_PER_CYCLE_USD: num("RWA_MAX_PER_CYCLE_USD", 5),

  // Per-day rolling 24 h ceiling across all RWA swaps.
  MAX_PER_DAY_USD: num("RWA_MAX_PER_DAY_USD", 25),

  // Min wallet stable-USD balance to even attempt a swap. Anti-dust.
  MIN_BALANCE_USD: num("RWA_MIN_BALANCE_USD", 2),

  // Max price impact accepted by executeSwap, in basis points.
  // 100 bps = 1%. Cheap protection against a thin pool.
  MAX_PRICE_IMPACT_BPS: num("RWA_MAX_PRICE_IMPACT_BPS", 100),

  // Slippage applied when computing minAmountOut. 50 bps = 0.5%.
  DEFAULT_SLIPPAGE_BPS: num("RWA_DEFAULT_SLIPPAGE_BPS", 50),

  // Cooldown between successful idle-parking swaps.
  IDLE_PARKING_COOLDOWN_MS: num(
    "RWA_IDLE_PARKING_COOLDOWN_MS",
    6 * 60 * 60 * 1000
  ),

  // Idle-parking trigger: minimum continuous FLAT duration before parking
  // can fire. Operator can lower for testing (e.g., 60_000) and revert.
  IDLE_PARKING_MIN_FLAT_MS: num(
    "RWA_IDLE_PARKING_MIN_FLAT_MS",
    24 * 60 * 60 * 1000
  ),

  // Fraction of idle stable-USD balance to park per idle-parking trigger.
  // 0.20 = move 20% of idle USDT into USDT0 each parking event.
  IDLE_PARKING_FRACTION: num("RWA_IDLE_PARKING_FRACTION", 0.2),
};
