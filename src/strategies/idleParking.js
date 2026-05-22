/**
 * TuringVault Idle Parking Strategy — USDY Yield Optimization
 * 
 * When the multi-agent loop exits a position (goes FLAT), idle mUSD balance
 * should be parked in USDY for 5.25% APY yield from US Treasuries.
 * 
 * Logic:
 *   Position FLAT + regime != TREND_UP → park in USDY
 *   If regime is TREND_UP, keep in mUSD for quick re-entry to mETH
 * 
 * USDY Address: 0x5bE26527e817998A7206475496fDE1E68957c5A6 (Ondo Finance, Mantle)
 */

const positionState = require('./positionState');
const { USDY_ADDRESS, USDY_PARAMS } = require('../rwa/usdyModule');

const USDY_APY = USDY_PARAMS.currentAPY; // 5.25%

/**
 * Determines if idle balance should be parked in USDY.
 * 
 * @param {object} posState - Position state from positionState.getState()
 *   Expected shape: { status: 'FLAT'|'IN_mETH'|'IN_mUSD', ... }
 * @param {string} regime - Current market regime: RANGING|TREND_UP|TREND_DOWN|HOLD|CRISIS
 * @returns {boolean} true if we should park idle funds in USDY
 */
function shouldParkInUSDY(posState, regime) {
  // Only park when position is FLAT (idle in mUSD)
  if (!posState || posState.status !== 'FLAT') {
    return false;
  }

  // Don't park in USDY during TREND_UP — we want quick re-entry to mETH
  // In a strong uptrend, the opportunity cost of being in USDY (slow exit) > 5.25% APY
  if (regime === 'TREND_UP') {
    return false;
  }

  return true;
}

/**
 * Generates an idle parking signal if conditions are met.
 * Reads current position state and determines if parking is appropriate.
 * 
 * @param {string} [regime] - Optional regime override. If not provided, defaults to 'RANGING'
 * @returns {object|null} Signal object or null if no parking needed
 *   Signal shape: { action: 'PARK_USDY', reason: string, apy: number, address: string }
 */
function getIdleParkingSignal(regime = 'RANGING') {
  const state = positionState.getState();

  if (!shouldParkInUSDY(state, regime)) {
    return null;
  }

  const reason = regime === 'CRISIS'
    ? 'Position FLAT during CRISIS — park in USDY for risk-free 5.25% APY (flight to safety)'
    : regime === 'TREND_DOWN'
    ? 'Position FLAT during TREND_DOWN — park in USDY for 5.25% APY while waiting for reversal'
    : regime === 'HOLD'
    ? 'Position FLAT in HOLD regime — park in USDY for 5.25% APY baseline yield'
    : 'Position FLAT in RANGING regime — park idle mUSD in USDY for 5.25% APY';

  return {
    action: 'PARK_USDY',
    reason,
    apy: USDY_APY * 100, // 5.25
    address: USDY_ADDRESS,
    route: 'mUSD → USDY via Merchant Moe LB (binStep 25)',
  };
}

module.exports = { shouldParkInUSDY, getIdleParkingSignal };
