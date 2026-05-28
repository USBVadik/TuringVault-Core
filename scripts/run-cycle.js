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
    stageTiming: null,
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
    //     rwaIntent, rwaResult, directionalSwap } for both dryRun and
    //     live paths.
    summary.decisionId =
      typeof result?.proposalId === "number" ? result.proposalId : null;
    summary.decisionTier = result?.decisionTier ?? null;
    summary.consensus =
      typeof result?.consensus === "boolean" ? result.consensus : null;

    // Per-stage timing instrumentation (CI-02). The decision object carries
    // _timing from multiAgent.js: { start, analyst, validator, arbiter? }.
    // We surface these as absolute durations in the summary so slow-stage
    // spikes are observable without re-running the cycle.
    const t = result?.decision?._timing;
    if (t && t.start) {
      summary.stageTiming = {
        marketDataMs: t.marketReady ? t.marketReady - t.start : null,
        analystMs: typeof t.analyst === "number" ? t.analyst : null,
        validatorMs: typeof t.validator === "number" ? t.validator : null,
        arbiterMs: typeof t.arbiter === "number" ? t.arbiter : null,
        onChainMs: t.onChainEnd ? t.onChainEnd - (t.onChainStart || t.start) : null,
        ipfsMs: typeof t.ipfs === "number" ? t.ipfs : null,
        rwaMs: typeof t.rwa === "number" ? t.rwa : null,
      };
    } else {
      // Fallback: at minimum record total pipeline time.
      summary.stageTiming = { totalPipelineMs: Date.now() - startMs };
    }

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

    // Directional swap surface (multiAgentLoop Step 4.7). Persist into
    // the summary so the cron commit and downstream readers can tell a
    // real swap from a logged-but-unexecuted intent.
    //
    // 2-leg paths emit a `legs[]` array; we surface the full leg list
    // and push every leg's txHash into summary.txHashes so the cron
    // commit reflects the real on-chain footprint. The previous version
    // only pushed the final-leg txHash, which silently hid leg-1 (e.g.
    // cycle 123 USDT->USDT0 leg-1 was missing from the summary even
    // though it landed on-chain in block 95926142).
    if (result?.directionalSwap) {
      const ds = result.directionalSwap;
      summary.directionalSwap = {
        executed: ds.executed === true,
        direction: ds.direction ?? null,
        from: ds.from ?? null,
        to: ds.to ?? null,
        amountIn: ds.amountIn ?? null,
        amountOut: ds.amountOut ?? null,
        reason: ds.reason ?? null,
        error: ds.error ?? null,
        legs: Array.isArray(ds.legs)
          ? ds.legs.map((leg) => ({
              leg: leg.leg ?? null,
              from: leg.from ?? null,
              to: leg.to ?? null,
              txHash: leg.txHash ?? null,
              blockNumber: leg.blockNumber ?? null,
              amountIn: leg.amountIn ?? null,
              amountOut: leg.amountOut ?? null,
              reason: leg.reason ?? null,
            }))
          : null,
      };
      // Push every leg's txHash that successfully landed on-chain.
      // For single-shot swaps (rare path with no legs[]), fall back
      // to ds.txHash.
      const legHashes = Array.isArray(ds.legs)
        ? ds.legs.map((l) => l.txHash).filter(Boolean)
        : [];
      if (legHashes.length > 0) {
        summary.txHashes.push(...legHashes);
      } else if (ds.executed === true && ds.txHash) {
        summary.txHashes.push(ds.txHash);
      }
    }

    // Honest decisionTier: the upstream decisionTier classifier
    // (src/orchestrator/decisionTier.js) marks any consensus + swap
    // as EXECUTED_SWAP regardless of whether a DEX TX actually
    // happened. That label is fine internally as a signal of intent,
    // but it propagates into the cron commit message and into the
    // dashboard's "Last cycle" badge, where it reads as a claim of
    // execution. If neither rwa nor directional swap broadcast a tx,
    // overwrite the tier to INTENT_SWAP_NO_EXEC so the commit log,
    // the summary file, and any downstream UI consumer all see the
    // same truthful status.
    //
    // Workspace rule: .kiro/steering/no-lying-about-state.md (4)
    // — animation is fine; fake liveness is not. EXECUTED_SWAP without
    // a TX is fake liveness on a high-prominence surface.
    const hasOnchainSwap =
      (result?.rwaResult?.executed === true && !!result?.rwaResult?.txHash) ||
      (result?.directionalSwap?.executed === true &&
        !!result?.directionalSwap?.txHash);
    if (
      summary.decisionTier === "EXECUTED_SWAP" &&
      result?.consensus === true &&
      !hasOnchainSwap
    ) {
      summary.executionStatus = "INTENT_ONLY";
      summary.decisionTier = "INTENT_SWAP_NO_EXEC";
    } else if (hasOnchainSwap) {
      summary.executionStatus = "EXECUTED";
    } else {
      // Block / hold / dry-run paths keep their existing tier and
      // get a synonymous executionStatus so the field is always set.
      summary.executionStatus = result?.decisionTier ?? "UNKNOWN";
    }

    // Outcome-persistence detector. Step 6 in multiAgentLoop calls
    // outcomeTracker.record({ decisionId, ... }) inside a try/catch
    // that silently swallows any throw. If it fails, the cycle still
    // writes last-cycle-summary.json + commits to main, but the row
    // never lands in src/data/outcomes.json — meaning the settle loop
    // never gets a chance to grade the decision and the dashboard's
    // decision feed is missing one row.
    //
    // We can't fix that condition from here (the data is in a
    // different process by the time run-cycle.js sees it), but we can
    // at least surface the discrepancy as an error in summary so the
    // operator knows to investigate. Cycle 123 (commit f2cc66c) was
    // the canonical example of this silent failure.
    if (
      typeof summary.decisionId === "number" &&
      result?.consensus !== null
    ) {
      try {
        const outcomesPath = path.join(REPO_ROOT, "src/data/outcomes.json");
        if (fs.existsSync(outcomesPath)) {
          const outcomesDb = JSON.parse(
            fs.readFileSync(outcomesPath, "utf-8")
          );
          const all = [
            ...(outcomesDb.pending ?? []),
            ...(outcomesDb.settled ?? []),
          ];
          const found = all.some((e) => e?.decisionId === summary.decisionId);
          if (!found) {
            const msg = `outcome-not-persisted: cycle ${summary.decisionId} missing from src/data/outcomes.json after Step 6`;
            summary.errors.push(msg);
            console.error(`⚠️  ${msg}`);
          }
        }
      } catch (e) {
        // best-effort detector; never fail the cycle on it
        summary.errors.push(
          `outcome-detector-failed: ${(e?.message || String(e)).slice(0, 100)}`
        );
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
