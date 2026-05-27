/**
 * Challenge Budget Tracker — daily cap enforcement for /api/challenge.
 *
 * Persisted in `data/challenge-budget.json` and committed back by the
 * cron's commit-back step like any other state file. The budget enforces
 * a hard daily ceiling so a viral spike on the dashboard can't drain
 * AWS Bedrock credits.
 *
 * UTC-based daily reset. When `date` in the file changes, `used` resets
 * to 0 automatically on the next read.
 *
 * Default cap is 100 invocations/day, overridable via env
 * `CHALLENGE_DAILY_CAP`. Worst case daily spend if cap hit:
 * 100 × ~$0.15 = ~$15 (covered by AWS Activate credits).
 *
 * Spec: human-vs-ai-challenge-v2 (R4.2, design §C6, CP4).
 */

const fs = require("fs");
const path = require("path");

const BUDGET_PATH = path.resolve(__dirname, "../../data/challenge-budget.json");
const HISTORY_LIMIT = 100;

const DEFAULT_CAP = 100;

class BudgetExhaustedError extends Error {
  constructor(used, cap, resetAt) {
    super(`BUDGET_EXHAUSTED: ${used}/${cap} used today. Resets at ${resetAt}.`);
    this.code = "BUDGET_EXHAUSTED";
    this.used = used;
    this.cap = cap;
    this.resetAt = resetAt;
  }
}

function todayUtc(now = new Date()) {
  // YYYY-MM-DD in UTC
  return now.toISOString().slice(0, 10);
}

function nextUtcMidnight(now = new Date()) {
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}

function getCap() {
  const raw = process.env.CHALLENGE_DAILY_CAP;
  if (raw === undefined || raw === null || raw === "") return DEFAULT_CAP;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CAP;
}

function readRaw() {
  try {
    if (!fs.existsSync(BUDGET_PATH)) {
      return { date: todayUtc(), used: 0, history: [] };
    }
    const data = JSON.parse(fs.readFileSync(BUDGET_PATH, "utf-8"));
    return {
      date: data.date ?? todayUtc(),
      used: typeof data.used === "number" ? data.used : 0,
      history: Array.isArray(data.history) ? data.history : [],
    };
  } catch {
    return { date: todayUtc(), used: 0, history: [] };
  }
}

function writeRaw(data) {
  fs.mkdirSync(path.dirname(BUDGET_PATH), { recursive: true });
  fs.writeFileSync(BUDGET_PATH, JSON.stringify(data, null, 2) + "\n");
}

/**
 * Read current budget state, applying UTC-day reset if needed.
 * Returns:
 *   { date, used, cap, remaining, history, resetAt }
 */
function read(now = new Date()) {
  const raw = readRaw();
  const today = todayUtc(now);
  const cap = getCap();

  // Daily reset: when date in file is older than today, zero out `used`.
  if (raw.date !== today) {
    const fresh = { date: today, used: 0, history: raw.history };
    writeRaw(fresh);
    return {
      date: today,
      used: 0,
      cap,
      remaining: cap,
      history: fresh.history.slice(-HISTORY_LIMIT),
      resetAt: nextUtcMidnight(now),
    };
  }

  return {
    date: raw.date,
    used: raw.used,
    cap,
    remaining: Math.max(0, cap - raw.used),
    history: raw.history.slice(-HISTORY_LIMIT),
    resetAt: nextUtcMidnight(now),
  };
}

/**
 * Increment the budget by one. Throws BudgetExhaustedError if the cap
 * would be exceeded (CP4).
 *
 * Pass an `entry` object describing the invocation; it appears in
 * history (capped at HISTORY_LIMIT entries).
 *
 * @param {object} entry — { type, mode, blocked, ... }
 * @returns updated state object (same shape as read())
 */
function increment(entry = {}, now = new Date()) {
  const cur = read(now);
  if (cur.used >= cur.cap) {
    throw new BudgetExhaustedError(cur.used, cur.cap, cur.resetAt);
  }

  const newUsed = cur.used + 1;
  const newHistory = [
    ...cur.history,
    {
      at: now.toISOString(),
      ...entry,
    },
  ];
  if (newHistory.length > HISTORY_LIMIT) {
    newHistory.splice(0, newHistory.length - HISTORY_LIMIT);
  }

  writeRaw({
    date: cur.date,
    used: newUsed,
    history: newHistory,
  });

  return {
    date: cur.date,
    used: newUsed,
    cap: cur.cap,
    remaining: Math.max(0, cur.cap - newUsed),
    history: newHistory,
    resetAt: cur.resetAt,
  };
}

module.exports = {
  read,
  increment,
  BudgetExhaustedError,
  // Exported for unit tests that need to override behaviour.
  _internal: { BUDGET_PATH, todayUtc, nextUtcMidnight, getCap },
};
