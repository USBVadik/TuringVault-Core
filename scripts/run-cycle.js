#!/usr/bin/env node
/**
 * Cron-runner: a single multi-agent cycle for use in GitHub Actions.
 *
 * - Loads .env via dotenv (locally) but in CI all env comes from
 *   GitHub repo secrets, no .env present.
 * - Calls runMultiAgentCycle({ dryRun: false }) once.
 * - Writes data/last-cycle-summary.json on success and on error.
 * - Updates data/cycle-history.json (rolling last 100).
 * - Appends to data/cycle-failures.json on error (rolling last 200).
 * - Validates every state file is valid JSON before exiting.
 *
 * Exit codes:
 *   0 = cycle ran (success or soft failure with summary written).
 *   2 = state file corruption (JSON unparseable). Workflow fails so
 *       we don't push corrupt state.
 *   99 = fatal in run-cycle.js itself (uncaught synchronous throw).
 *
 * NOTE: env values are NEVER printed. Do not add console.log of
 * process.env.* here.
 *
 * Spec: .kiro/specs/continuous-cron-and-health (R1, R3, R6)
 */

const fs = require("fs");
const path = require("path");

// Local .env load (no-op in CI when file is absent).
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const REPO_ROOT = path.resolve(__dirname, "..");

const HISTORY_PATH = path.join(REPO_ROOT, "data", "cycle-history.json");
const SUMMARY_PATH = path.join(REPO_ROOT, "data", "last-cycle-summary.json");
const FAILURES_PATH = path.join(REPO_ROOT, "data", "cycle-failures.json");

const HISTORY_LIMIT = 100;
const FAILURES_LIMIT = 200;

// State files we expect the cycle to update. Each is JSON-validated
// before we exit so we never push corrupt data.
const STATE_FILES = [
  "src/data/outcomes.json",
  "src/data/parse_metrics.json",
  "src/data/threshold_state.json",
  "src/data/position_state.json",
  "src/data/grid_bot_state.json",
  "src/data/grid_param_history.json",
  "data/loop_progress.json",
];

function readJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
}

function appendHistory(entry) {
  const cur = readJsonSafe(HISTORY_PATH);
  const list = Array.isArray(cur) ? cur : [];
  list.push(entry);
  if (list.length > HISTORY_LIMIT) list.splice(0, list.length - HISTORY_LIMIT);
  writeJson(HISTORY_PATH, list);
}

function appendFailure(entry) {
  const cur = readJsonSafe(FAILURES_PATH);
  const list = Array.isArray(cur) ? cur : [];
  list.push(entry);
  if (list.length > FAILURES_LIMIT)
    list.splice(0, list.length - FAILURES_LIMIT);
  writeJson(FAILURES_PATH, list);
}

function validateStateFiles() {
  const errors = [];
  for (const rel of STATE_FILES) {
    const abs = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(abs)) continue; // missing = ok, may not have been created yet
    try {
      JSON.parse(fs.readFileSync(abs, "utf-8"));
    } catch (e) {
      errors.push(`${rel}: ${(e?.message ?? String(e)).slice(0, 80)}`);
    }
  }
  return errors;
}

async function main() {
  const cycleStartedAt = new Date().toISOString();
  const startMs = Date.now();

  /** @type {{
   *   cycleStartedAt: string,
   *   cycleEndedAt: string | null,
   *   durationSeconds: number | null,
   *   decisionId: number | null,
   *   decisionTier: string | null,
   *   consensus: boolean | null,
   *   txHashes: string[],
   *   ipfsCid: string | null,
   *   mode: string,
   *   githubRunUrl: string | null,
   *   errors: string[],
   * }} */
  const summary = {
    cycleStartedAt,
    cycleEndedAt: null,
    durationSeconds: null,
    decisionId: null,
    decisionTier: null,
    consensus: null,
    txHashes: [],
    ipfsCid: null,
    mode: process.env.AGENT_RUN_MODE || "unknown",
    githubRunUrl: process.env.GITHUB_RUN_URL || null,
    errors: [],
  };

  try {
    const {
      runMultiAgentCycle,
    } = require("../src/orchestrator/multiAgentLoop");
    const result = await runMultiAgentCycle({ dryRun: false });

    // After T4 patch, runMultiAgentCycle returns:
    //   { decision, decisionTier, disagreementSignal, consensus, proposalId,
    //     rwaIntent, rwaResult } for both dryRun and live paths.
    summary.decisionId =
      typeof result?.proposalId === "number" ? result.proposalId : null;
    summary.decisionTier = result?.decisionTier ?? null;
    summary.consensus =
      typeof result?.consensus === "boolean" ? result.consensus : null;

    // RWA execution surface (rwa-allocation-active T10).
    if (result?.rwaIntent) {
      summary.rwa = {
        source: result.rwaIntent.source ?? null,
        executed: result.rwaIntent.executed === true,
        amountInUsd: result.rwaIntent.amountInUsd ?? null,
        from: result.rwaIntent.from ?? null,
        to: result.rwaIntent.to ?? null,
        blockedReason: result.rwaIntent.blockedReason ?? null,
      };
      if (result.rwaResult?.executed && result.rwaResult.txHash) {
        summary.txHashes.push(result.rwaResult.txHash);
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    summary.errors.push(msg.slice(0, 200));
    appendFailure({ at: cycleStartedAt, error: msg.slice(0, 200) });
    // Don't rethrow — write a summary so the workflow can still commit
    // a "we tried, here's why it failed" record.
  }

  // Validate the state files the cycle should have written. Pure JSON
  // validity check; we don't enforce schema here.
  const validationErrors = validateStateFiles();
  if (validationErrors.length) {
    summary.errors.push(...validationErrors.map((e) => `state-validate: ${e}`));
  }

  summary.cycleEndedAt = new Date().toISOString();
  summary.durationSeconds = Math.round((Date.now() - startMs) / 10) / 100;

  writeJson(SUMMARY_PATH, summary);

  appendHistory({
    cycleStartedAt,
    cycleEndedAt: summary.cycleEndedAt,
    durationSeconds: summary.durationSeconds,
    decisionTier: summary.decisionTier,
    consensus: summary.consensus,
    hasErrors: summary.errors.length > 0,
  });

  if (validationErrors.length > 0) process.exit(2);
  process.exit(0);
}

main().catch((e) => {
  // Never echo env. Print message + first stack frame only.
  const msg = e instanceof Error ? e.message : String(e);
  console.error("Fatal in run-cycle.js:", msg.slice(0, 500));
  if (e instanceof Error && e.stack) {
    console.error(e.stack.split("\n").slice(0, 5).join("\n"));
  }
  process.exit(99);
});
