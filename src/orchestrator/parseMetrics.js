/**
 * Parse Metrics + Raw Output Logging
 *
 * Two purposes:
 *   1. recordParseMetric()  — count json_ok / yaml_ok / failed per agent role,
 *                             rolled by day. Surfaced via /api/health as
 *                             parseSuccessRate24h.
 *   2. persistRawOutput()   — write each model's raw response text to disk
 *                             so we can grep for "confidence: 25" patterns
 *                             when diagnosing GLM-5 quirks.
 *
 * Both file targets are in .gitignore (operator diagnostics, not public).
 * Both functions are best-effort — they MUST NOT throw upward.
 *
 * Spec: .kiro/specs/agent-reasoning-quality/{requirements,design,tasks}.md
 *       (R2, R3; design C5)
 */

const fs = require("fs");
const path = require("path");

const METRICS_PATH = path.resolve(
  __dirname,
  "../../src/data/parse_metrics.json"
);
const RAW_DIR = path.resolve(__dirname, "../../src/data/raw_model_outputs");

const MAX_RAW_BYTES = 50_000; // truncate insanely long responses

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function ensureDirs() {
  fs.mkdirSync(path.dirname(METRICS_PATH), { recursive: true });
  fs.mkdirSync(RAW_DIR, { recursive: true });
}

function loadMetrics() {
  ensureDirs();
  try {
    return JSON.parse(fs.readFileSync(METRICS_PATH, "utf8"));
  } catch {
    return { byDay: {} };
  }
}

function saveMetrics(m) {
  ensureDirs();
  // Atomic-ish write — write to temp file, then rename.
  const tmp = METRICS_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(m, null, 2));
  fs.renameSync(tmp, METRICS_PATH);
}

/**
 * Record one parse outcome.
 * @param {string} agentRole - 'analyst' | 'validator' | 'arbiter' | 'validator-retry'
 * @param {string} outcome   - 'json_ok' | 'yaml_ok' | 'failed'
 */
function recordParseMetric(agentRole, outcome) {
  if (!agentRole || !outcome) return;
  if (!["json_ok", "yaml_ok", "failed"].includes(outcome)) return;

  try {
    const m = loadMetrics();
    const day = todayKey();
    const bucket = (m.byDay[day] = m.byDay[day] || {});
    const role = (bucket[agentRole] = bucket[agentRole] || {
      json_ok: 0,
      yaml_ok: 0,
      failed: 0,
    });
    role[outcome] = (role[outcome] || 0) + 1;
    saveMetrics(m);
  } catch {
    // Swallow — never block a cycle on metrics.
  }
}

/**
 * Persist a model's raw response text to disk.
 * @param {string} text     - exact response from Bedrock
 * @param {string} modelId  - e.g., 'zai.glm-5'
 * @param {string} agentRole - 'analyst' | 'validator' | 'arbiter' | …
 */
function persistRawOutput(text, modelId, agentRole) {
  try {
    ensureDirs();
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    // 4-char random suffix prevents collisions when multiple calls land
    // within the same millisecond (rare in prod, common in tests).
    const suffix = Math.random().toString(36).slice(2, 6);
    const fn = path.join(RAW_DIR, `${ts}_${agentRole}_${suffix}.txt`);
    const header =
      `# model=${modelId || "unknown"} ` +
      `agent=${agentRole} ` +
      `timestamp=${new Date().toISOString()}\n\n`;
    const body = String(text || "").slice(0, MAX_RAW_BYTES);
    fs.writeFileSync(fn, header + body);
  } catch {
    // Swallow — diagnostic only.
  }
}

/**
 * Compute rolling-window stats over the last `hours` hours.
 * @param {number} hours
 * @returns {{
 *   total: number, jsonOk: number, yamlOk: number, failed: number,
 *   successRate: number | null
 * }}
 */
function getRollingMetrics(hours = 24) {
  const m = loadMetrics();
  const cutoffMs = Date.now() - hours * 3600 * 1000;
  let jsonOk = 0;
  let yamlOk = 0;
  let failed = 0;

  for (const [day, bucket] of Object.entries(m.byDay || {})) {
    // End-of-day timestamp; if any of that day overlaps cutoff, count it.
    const dayEnd = Date.parse(`${day}T23:59:59.999Z`);
    if (Number.isNaN(dayEnd) || dayEnd < cutoffMs) continue;
    for (const role of Object.values(bucket || {})) {
      jsonOk += role.json_ok || 0;
      yamlOk += role.yaml_ok || 0;
      failed += role.failed || 0;
    }
  }

  const total = jsonOk + yamlOk + failed;
  return {
    total,
    jsonOk,
    yamlOk,
    failed,
    successRate: total > 0 ? (jsonOk + yamlOk) / total : null,
  };
}

module.exports = {
  recordParseMetric,
  persistRawOutput,
  getRollingMetrics,
  // Exported only for tests / inspection
  _paths: { METRICS_PATH, RAW_DIR },
};
