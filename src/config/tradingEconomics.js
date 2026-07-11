const DEFAULT_MIN_TRADE_USD = 10;
const DEFAULT_MAX_TRADE_USD = 15;
const DEFAULT_MIN_EXIT_USD = 1;
const EXECUTION_BUFFER = 1.05;

function positiveNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function getMinTradeUsd(value = process.env.RWA_MIN_PER_CYCLE_USD) {
  return positiveNumber(value, DEFAULT_MIN_TRADE_USD);
}

function getMaxTradeUsd(value = process.env.RWA_MAX_PER_CYCLE_USD) {
  return positiveNumber(value, DEFAULT_MAX_TRADE_USD);
}

function getMinExitUsd(value = process.env.RWA_MIN_EXIT_USD) {
  return positiveNumber(value, DEFAULT_MIN_EXIT_USD);
}

function executableAllocationPct(sourceUsd, minTradeUsd = getMinTradeUsd()) {
  const available = Math.max(0, Number(sourceUsd) || 0);
  if (available < minTradeUsd) return null;
  return Math.min(
    100,
    Math.max(1, Math.ceil(((minTradeUsd * EXECUTION_BUFFER) / available) * 100))
  );
}

module.exports = {
  DEFAULT_MIN_TRADE_USD,
  DEFAULT_MAX_TRADE_USD,
  DEFAULT_MIN_EXIT_USD,
  EXECUTION_BUFFER,
  executableAllocationPct,
  getMinTradeUsd,
  getMaxTradeUsd,
  getMinExitUsd,
};
