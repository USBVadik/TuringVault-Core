/**
 * TuringVault — Performance Metrics Tracker
 *
 * Tracks NAV snapshots, computes Sharpe ratio, max drawdown,
 * time-to-recovery. Persists to src/data/performance.json.
 */
const fs = require("fs");
const path = require("path");

const DATA_PATH = path.resolve(__dirname, "../data/performance.json");
const RISK_FREE_RATE = 0.05; // 5% annualized (T-bill proxy)

function loadData() {
  if (fs.existsSync(DATA_PATH))
    return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  return { snapshots: [], metrics: {} };
}

function saveData(data) {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

/**
 * Record a NAV snapshot (call after each cycle or on schedule)
 * @param {number} navUsd - Total portfolio value in USD
 * @param {object} breakdown - { mnt, meth, musd } balances
 */
function recordSnapshot(navUsd, breakdown = {}) {
  const data = loadData();
  data.snapshots.push({
    timestamp: Date.now(),
    nav: navUsd,
    ...breakdown,
  });
  data.metrics = computeMetrics(data.snapshots);
  saveData(data);
  return data.metrics;
}

/**
 * Compute all performance metrics from NAV history
 */
function computeMetrics(snapshots) {
  if (snapshots.length < 2)
    return { sharpe: 0, maxDrawdown: 0, recoveryHours: 0, totalReturn: 0 };

  const navs = snapshots.map((s) => s.nav);
  const first = navs[0];
  const last = navs[navs.length - 1];
  const totalReturn = (last - first) / first;

  // Daily returns (approximate — each snapshot as a period)
  const returns = [];
  for (let i = 1; i < navs.length; i++) {
    returns.push((navs[i] - navs[i - 1]) / navs[i - 1]);
  }

  // Sharpe ratio (annualized)
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdDev = Math.sqrt(
    returns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / returns.length
  );

  // Annualize based on snapshot frequency
  const totalHours =
    (snapshots[snapshots.length - 1].timestamp - snapshots[0].timestamp) /
    3600000;
  const periodsPerYear = 8760 / (totalHours / snapshots.length) || 1;
  const annualizedReturn = avgReturn * periodsPerYear;
  const annualizedStd = stdDev * Math.sqrt(periodsPerYear);
  const sharpe =
    annualizedStd > 0 ? (annualizedReturn - RISK_FREE_RATE) / annualizedStd : 0;

  // Max drawdown
  let peak = navs[0];
  let maxDrawdown = 0;
  let drawdownStart = 0;
  let recoveryTime = 0;
  let inDrawdown = false;
  let ddStartTime = 0;

  for (let i = 0; i < navs.length; i++) {
    if (navs[i] > peak) {
      if (inDrawdown) {
        const recovery = (snapshots[i].timestamp - ddStartTime) / 3600000;
        recoveryTime = Math.max(recoveryTime, recovery);
        inDrawdown = false;
      }
      peak = navs[i];
    }
    const dd = (peak - navs[i]) / peak;
    if (dd > maxDrawdown) {
      maxDrawdown = dd;
      if (!inDrawdown) {
        inDrawdown = true;
        ddStartTime = snapshots[i].timestamp;
      }
    }
  }

  // Win rate from returns
  const wins = returns.filter((r) => r > 0).length;
  const winRate = returns.length > 0 ? wins / returns.length : 0;

  return {
    sharpe: Math.round(sharpe * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 10000) / 100, // percentage
    recoveryHours: Math.round(recoveryTime * 10) / 10,
    totalReturn: Math.round(totalReturn * 10000) / 100, // percentage
    winRate: Math.round(winRate * 100),
    snapshots: snapshots.length,
    hoursTracked: Math.round(totalHours * 10) / 10,
  };
}

function getMetrics() {
  const data = loadData();
  return data.metrics || {};
}

function getSnapshots(limit = 100) {
  const data = loadData();
  return data.snapshots.slice(-limit);
}

module.exports = { recordSnapshot, getMetrics, getSnapshots, computeMetrics };
