#!/usr/bin/env node
/**
 * Best-effort failure evidence writer for runner-level failures around
 * scripts/run-cycle.js, especially shell timeout exits that kill Node before
 * run-cycle can write its own summary.
 */

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(
  process.env.CYCLE_FAILURE_REPO_ROOT || path.join(__dirname, "..")
);
const HISTORY_PATH = path.join(REPO_ROOT, "data", "cycle-history.json");
const SUMMARY_PATH = path.join(REPO_ROOT, "data", "last-cycle-summary.json");
const FAILURES_PATH = path.join(REPO_ROOT, "data", "cycle-failures.json");
const HISTORY_LIMIT = 100;
const FAILURES_LIMIT = 200;

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

function appendRolling(p, entry, limit) {
  const cur = readJsonSafe(p);
  const list = Array.isArray(cur) ? cur : [];
  list.push(entry);
  if (list.length > limit) list.splice(0, list.length - limit);
  writeJson(p, list);
}

function buildSummary({ now = new Date(), message, exitCode } = {}) {
  const cycleStartedAt = process.env.CYCLE_STARTED_AT || now.toISOString();
  const cycleEndedAt = now.toISOString();
  const startedMs = Date.parse(cycleStartedAt);
  const durationSeconds = Number.isFinite(startedMs)
    ? Math.round(((now.getTime() - startedMs) / 1000) * 10) / 10
    : null;
  const normalizedExitCode = Number(exitCode ?? process.env.CYCLE_EXIT_CODE);
  const timedOut = normalizedExitCode === 124 || normalizedExitCode === 137;
  const error =
    message ||
    (timedOut
      ? `run-cycle timed out with exit code ${normalizedExitCode}`
      : `run-cycle failed with exit code ${normalizedExitCode || "unknown"}`);

  return {
    cycleStartedAt,
    cycleEndedAt,
    durationSeconds,
    stageTiming: null,
    decisionId: null,
    decisionTier: timedOut ? "CYCLE_TIMEOUT" : "CYCLE_FAILED",
    consensus: null,
    txHashes: [],
    ipfsCid: null,
    mode: process.env.AGENT_RUN_MODE || "unknown",
    githubRunUrl: process.env.GITHUB_RUN_URL || null,
    errors: [error.slice(0, 200)],
    executionStatus: "FAILED",
  };
}

function writeFailureSummary({ message, exitCode } = {}) {
  const summary = buildSummary({ message, exitCode });
  writeJson(SUMMARY_PATH, summary);
  appendRolling(
    HISTORY_PATH,
    {
      cycleStartedAt: summary.cycleStartedAt,
      cycleEndedAt: summary.cycleEndedAt,
      durationSeconds: summary.durationSeconds,
      decisionTier: summary.decisionTier,
      consensus: summary.consensus,
      hasErrors: true,
    },
    HISTORY_LIMIT
  );
  appendRolling(
    FAILURES_PATH,
    {
      at: summary.cycleStartedAt,
      error: summary.errors[0],
      exitCode: Number(exitCode ?? process.env.CYCLE_EXIT_CODE) || null,
    },
    FAILURES_LIMIT
  );
  return summary;
}

if (require.main === module) {
  writeFailureSummary({
    message: process.argv.slice(2).join(" ") || null,
    exitCode: process.env.CYCLE_EXIT_CODE,
  });
}

module.exports = {
  buildSummary,
  writeFailureSummary,
};
