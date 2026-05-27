/**
 * Discipline Layer History — rolling per-cycle persistence.
 *
 * The discipline verifier runs on every multi-agent cycle and produces
 * a result object with per-gate checks. Until now we only persisted
 * the rolled-up status string in `outcomes.json` and lost the
 * per-check detail.
 *
 * This module appends a compact entry per cycle to
 * `data/discipline-history.json` (rolling last 100), and exposes
 * `summary()` for aggregate reporting on /api/discipline.
 *
 * Spec: discipline-layer-ui R1.
 */

const fs = require("fs");
const path = require("path");

const HISTORY_PATH = path.resolve(
  __dirname,
  "../../data/discipline-history.json"
);
const HISTORY_LIMIT = 100;

const KNOWN_GATES = ["tx_proof", "price_freshness", "drift_detection"];

function readSafe() {
  try {
    if (!fs.existsSync(HISTORY_PATH)) return [];
    const data = JSON.parse(fs.readFileSync(HISTORY_PATH, "utf-8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeSafe(list) {
  fs.mkdirSync(path.dirname(HISTORY_PATH), { recursive: true });
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(list, null, 2) + "\n");
}

/**
 * Append a compact entry from a verifier result.
 *
 * @param {object} args
 * @param {number|null} args.decisionId   — proposalId of the cycle, if any
 * @param {object} args.proofResult       — return value of disciplineLayer.verify()
 * @returns the new entry
 */
function append({ decisionId, proofResult }) {
  const list = readSafe();
  const checks = Array.isArray(proofResult?.checks)
    ? proofResult.checks.map((c) => ({
        name: c.name,
        status: c.status,
        // Persist detail so /discipline tooltips can explain what each
        // gate saw (e.g. "Price data was 5s old"). Capped to keep the
        // history file compact.
        detail:
          typeof c.detail === "string" ? c.detail.slice(0, 200) : undefined,
      }))
    : [];

  const entry = {
    at: new Date().toISOString(),
    decisionId: decisionId ?? null,
    verdict: proofResult?.status ?? "UNKNOWN",
    checks,
    blockReason: proofResult?.blockReason ?? null,
  };
  list.push(entry);
  if (list.length > HISTORY_LIMIT) list.splice(0, list.length - HISTORY_LIMIT);
  writeSafe(list);
  return entry;
}

/**
 * Append an error placeholder when the verifier itself crashed.
 * Honesty rule: judges should see degraded states, not silent skips.
 */
function appendError({ decisionId, error }) {
  const list = readSafe();
  const entry = {
    at: new Date().toISOString(),
    decisionId: decisionId ?? null,
    verdict: "ERROR",
    checks: [],
    error: String(error?.message ?? error).slice(0, 200),
  };
  list.push(entry);
  if (list.length > HISTORY_LIMIT) list.splice(0, list.length - HISTORY_LIMIT);
  writeSafe(list);
  return entry;
}

function read() {
  return readSafe();
}

/**
 * Aggregate over up to the last `limit` entries.
 *   acceptedCount / blockedCount / skippedCount / errorCount
 *   gatePassRates: { tx_proof, price_freshness, drift_detection }
 *     where each rate = PASS_count / (PASS+FAIL+WARN count) — SKIP & ERROR excluded
 */
function summary(limit = HISTORY_LIMIT) {
  const list = readSafe().slice(-limit);
  const counts = { ACCEPTED: 0, BLOCKED: 0, SKIPPED: 0, ERROR: 0, UNKNOWN: 0 };
  const gateStats = Object.fromEntries(
    KNOWN_GATES.map((g) => [g, { pass: 0, fail: 0, warn: 0, skip: 0 }])
  );

  for (const e of list) {
    const v = e?.verdict ?? "UNKNOWN";
    counts[v] = (counts[v] ?? 0) + 1;
    for (const c of e?.checks ?? []) {
      if (!KNOWN_GATES.includes(c.name)) continue;
      const s = String(c.status ?? "").toLowerCase();
      if (s === "pass") gateStats[c.name].pass++;
      else if (s === "fail") gateStats[c.name].fail++;
      else if (s === "warn") gateStats[c.name].warn++;
      else if (s === "skip") gateStats[c.name].skip++;
    }
  }

  const gatePassRates = {};
  for (const g of KNOWN_GATES) {
    const s = gateStats[g];
    const total = s.pass + s.fail + s.warn;
    gatePassRates[g] =
      total > 0 ? Math.round((s.pass / total) * 1000) / 10 : null;
  }

  return {
    totalEntries: list.length,
    acceptedCount: counts.ACCEPTED,
    blockedCount: counts.BLOCKED,
    skippedCount: counts.SKIPPED,
    errorCount: counts.ERROR,
    gatePassRates,
    firstCycleAt: list[0]?.at ?? null,
    latestCycleAt: list[list.length - 1]?.at ?? null,
  };
}

module.exports = {
  append,
  appendError,
  read,
  summary,
  KNOWN_GATES,
  HISTORY_PATH,
};
