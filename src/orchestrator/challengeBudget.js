/**
 * Challenge Budget Tracker — daily cap enforcement for /api/challenge.
 *
 * Persists to data/challenge-budget.json so the cron's commit-back step
 * picks it up like any other state file.
 *
 * Spec: human-vs-ai-challenge-v2 R4 / design §C6 / CP4.
 */

const fs = require('fs');
const path = require('path');

const BUDGET_PATH = path.resolve(__dirname, '../../data/challenge-budget.json');
const HISTORY_LIMIT = 100;

function todayUtc(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10); // YYYY-MM-DD
}

function nextUtcMidnight(now = Date.now()) {
  const d = new Date(now);
  d.setUTCHours(24, 0, 0, 0); // tomorrow 00:00 UTC
  return d.toISOString();
}

function readBudget(nowMs = Date.now()) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(BUDGET_PATH, 'utf-8'));
  } catch {
    data = { date: todayUtc(nowMs), used: 0, history: [] };
  }
  // Auto-reset if date rolled over.
  if (data.date !== todayUtc(nowMs)) {
    data = { date: todayUtc(nowMs), used: 0, history: data.history || [] };
  }
  return data;
}

function writeBudget(data) {
  fs.mkdirSync(path.dirname(BUDGET_PATH), { recursive: true });
  fs.writeFileSync(BUDGET_PATH, JSON.stringify(data, null, 2) + '\n');
}

/**
 * Try to consume one slot of the daily budget. If the cap is exceeded,
 * throws BUDGET_EXHAUSTED with `resetAt` ISO string attached.
 *
 * @param {object} entry — metadata about the invocation, persisted to history
 * @param {number} cap — daily cap (default 100; can be overridden via env in callers)
 * @param {number} nowMs — Date.now() override for testing
 * @returns {object} the updated budget object
 */
function increment(entry = {}, cap = 100, nowMs = Date.now()) {
  const data = readBudget(nowMs);
  if (data.used >= cap) {
    const err = new Error('BUDGET_EXHAUSTED');
    err.code = 'BUDGET_EXHAUSTED';
    err.resetAt = nextUtcMidnight(nowMs);
    err.used = data.used;
    err.cap = cap;
    throw err;
  }
  data.used += 1;
  data.history = data.history || [];
  data.history.push({
    at: new Date(nowMs).toISOString(),
    ...entry,
  });
  // Keep history bounded.
  if (data.history.length > HISTORY_LIMIT) {
    data.history.splice(0, data.history.length - HISTORY_LIMIT);
  }
  writeBudget(data);
  return data;
}

/**
 * Snapshot of current budget without mutating.
 */
function status(cap = 100, nowMs = Date.now()) {
  const data = readBudget(nowMs);
  return {
    date: data.date,
    used: data.used,
    cap,
    remaining: Math.max(0, cap - data.used),
    resetAt: nextUtcMidnight(nowMs),
  };
}

module.exports = {
  readBudget,
  writeBudget,
  increment,
  status,
  todayUtc,
  nextUtcMidnight,
  BUDGET_PATH,
  HISTORY_LIMIT,
};
