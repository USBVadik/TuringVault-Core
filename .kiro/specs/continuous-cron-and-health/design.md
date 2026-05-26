# Continuous Cron + Health — Design

## Decisions taken (closes open questions from requirements.md)

| Q | Decision | Rationale |
|---|---|---|
| Q1 push target | **`main` directly.** | 24 Vercel builds/day < 100 free-tier ceiling; simplest data path; no separate ingest needed. |
| Q2 commit `parse_metrics.json` | **Yes.** | Pure numeric counts, no sensitive content; required for `/api/health.parseSuccessRate24h`. |
| Q3 commit `threshold_state.json` | **Yes.** | Required for `/api/health.thresholdMode`; small JSON, no secrets. |
| Q4 per-cycle artifacts | **No (this spec).** | Adds complexity; raw outputs intentionally gitignored. Future spec if judges request. |
| Q5 interval | **60 minutes.** | 840 GH min/mo vs. 2000 free tier; ~$108/mo Bedrock vs. $216; mascot stays 🟢 within the < 1h threshold. |

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                  GitHub Actions: schedule '0 * * * *'                 │
│                                                                       │
│   1. checkout main                                                    │
│   2. setup-node 22 + npm ci --legacy-peer-deps                        │
│   3. write Gemini key to ./gemini-service-account.json (from secret)  │
│   4. node scripts/run-cycle.js  (5-min timeout)                       │
│        ├─ runMultiAgentCycle({ dryRun: false })                       │
│        ├─ writes: outcomes.json, parse_metrics.json,                  │
│        │          threshold_state.json, position_state.json,          │
│        │          loop_progress.json, last-cycle-summary.json,        │
│        │          cycle-history.json, cycle-failures.json (on error)  │
│        └─ validates each JSON file before commit                      │
│   5. git config user/email = TuringVault Cron / cron@…                │
│   6. git add <state files>                                            │
│   7. if changes: git commit + git pull --rebase + git push            │
│                                                                       │
└─────────────────────────┬────────────────────────────────────────────┘
                          │ push to main
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│   Vercel auto-deploy on main (~60 s build)                            │
│   Frontend reads /api/health, /api/decisions, /api/performance, …    │
│   Mascot turns 🟢 within < 2 polls (≤ 2 min after deploy)            │
└──────────────────────────────────────────────────────────────────────┘
```

Key flow: **GH Actions writes state → push to main → Vercel rebuilds →
front-end picks up.** No additional infrastructure.

## Component design

### C1 — `.github/workflows/agent-cycle.yml`

```yaml
name: Agent Cycle

on:
  schedule:
    - cron: '0 * * * *'    # Every hour, UTC
  workflow_dispatch:        # Manual trigger for debugging

# Prevent overlapping runs (in case a cycle is slow)
concurrency:
  group: agent-cycle
  cancel-in-progress: false

permissions:
  contents: write           # Required for git push back

jobs:
  cycle:
    name: Run multi-agent cycle
    runs-on: ubuntu-latest
    timeout-minutes: 8       # Hard ceiling; cycle itself has 5m timeout

    env:
      AGENT_RUN_MODE: cron-github-actions
      MANTLE_RPC_URL: ${{ secrets.MANTLE_RPC_URL }}
      PRIVATE_KEY: ${{ secrets.PRIVATE_KEY }}
      AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
      AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
      AWS_REGION: ${{ secrets.AWS_REGION }}
      NANSEN_API_KEY: ${{ secrets.NANSEN_API_KEY }}
      PINATA_JWT: ${{ secrets.PINATA_JWT }}
      PINATA_API_KEY: ${{ secrets.PINATA_API_KEY }}
      PINATA_SECRET: ${{ secrets.PINATA_SECRET }}
      GEMINI_PROJECT_ID: ${{ secrets.GEMINI_PROJECT_ID }}
      GITHUB_RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}

    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci --legacy-peer-deps

      - name: Write Gemini service account key
        env:
          GOOGLE_APPLICATION_CREDENTIALS_JSON: ${{ secrets.GOOGLE_APPLICATION_CREDENTIALS_JSON }}
        run: |
          if [ -z "$GOOGLE_APPLICATION_CREDENTIALS_JSON" ]; then
            echo "::warning::GOOGLE_APPLICATION_CREDENTIALS_JSON not set; arbiter will fall back to conservative-block."
          else
            echo "$GOOGLE_APPLICATION_CREDENTIALS_JSON" > ./gemini-service-account.json
            chmod 600 ./gemini-service-account.json
          fi

      - name: Run cycle
        run: timeout 300 node scripts/run-cycle.js
        # GOOGLE_APPLICATION_CREDENTIALS env points to ./gemini-service-account.json
        # in the runner's cwd; geminiArbiter.js already resolves it via the env.
        env:
          GOOGLE_APPLICATION_CREDENTIALS: ./gemini-service-account.json

      - name: Commit state changes
        run: |
          git config user.name "TuringVault Cron"
          git config user.email "cron@turingvault.ai"

          # Gemini key never gets committed even if checkout caches it.
          rm -f gemini-service-account.json

          # Stage only the state files we care about. Anything else stays untracked.
          git add \
            src/data/outcomes.json \
            src/data/parse_metrics.json \
            src/data/threshold_state.json \
            src/data/position_state.json \
            src/data/grid_bot_state.json \
            src/data/grid_param_history.json \
            data/loop_progress.json \
            data/last-cycle-summary.json \
            data/cycle-history.json \
            data/cycle-failures.json 2>/dev/null || true

          if git diff --cached --quiet; then
            echo "No state changes to commit."
            exit 0
          fi

          # Read summary for commit message; fall back to a placeholder.
          if [ -f data/last-cycle-summary.json ]; then
            DECISION_ID=$(jq -r '.decisionId // "?"' data/last-cycle-summary.json)
            TIER=$(jq -r '.decisionTier // "UNKNOWN"' data/last-cycle-summary.json)
            TIMESTAMP=$(jq -r '.cycleEndedAt // "?"' data/last-cycle-summary.json)
          else
            DECISION_ID="?"
            TIER="UNKNOWN"
            TIMESTAMP=$(date -u +%FT%TZ)
          fi

          git commit -m "chore(cron): cycle ${DECISION_ID} ${TIMESTAMP} ${TIER}"

          # Retry once on rebase conflict.
          git pull --rebase --autostash origin main || true
          git push origin main || (sleep 5 && git pull --rebase --autostash origin main && git push origin main)
```

Notes:
- `concurrency.cancel-in-progress: false` so a slow cycle isn't aborted
  by the next hour's trigger; instead the new run waits.
- `timeout-minutes: 8` on the job + `timeout 300` on the node call
  guarantees we never burn unbounded GH minutes.
- The job has `permissions: contents: write` so the default
  `GITHUB_TOKEN` can push to main. No PAT needed.

### C2 — `scripts/run-cycle.js`

```javascript
#!/usr/bin/env node
/**
 * Cron-runner: a single multi-agent cycle for use in GitHub Actions.
 *
 * - Loads .env via dotenv (locally) but in CI all env comes from
 *   GitHub repo secrets, no .env present.
 * - Calls runMultiAgentCycle({ dryRun: false }) once.
 * - Writes data/last-cycle-summary.json on success and on error.
 * - Updates data/cycle-history.json (rolling last 100).
 * - Appends to data/cycle-failures.json on error.
 * - Validates every state file is valid JSON before exiting.
 *
 * Spec: .kiro/specs/continuous-cron-and-health (R1, R3, R6)
 */

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const HISTORY_PATH = path.resolve(__dirname, '../data/cycle-history.json');
const SUMMARY_PATH = path.resolve(__dirname, '../data/last-cycle-summary.json');
const FAILURES_PATH = path.resolve(__dirname, '../data/cycle-failures.json');
const HISTORY_LIMIT = 100;

// State files we expect the cycle to update; we validate each is parseable.
const STATE_FILES = [
  'src/data/outcomes.json',
  'src/data/parse_metrics.json',
  'src/data/threshold_state.json',
  'src/data/position_state.json',
  'src/data/grid_bot_state.json',
  'src/data/grid_param_history.json',
  'data/loop_progress.json',
];

function readJsonSafe(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); }
  catch { return null; }
}

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
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
  // Keep only last 200 failures so file doesn't grow unbounded
  if (list.length > 200) list.splice(0, list.length - 200);
  writeJson(FAILURES_PATH, list);
}

function validateStateFiles() {
  const errors = [];
  for (const rel of STATE_FILES) {
    const abs = path.resolve(__dirname, '..', rel);
    if (!fs.existsSync(abs)) continue; // missing = ok, may not have been created yet
    try { JSON.parse(fs.readFileSync(abs, 'utf-8')); }
    catch (e) { errors.push(`${rel}: ${e.message?.slice(0, 80)}`); }
  }
  return errors;
}

async function main() {
  const cycleStartedAt = new Date().toISOString();
  const startMs = Date.now();
  let summary = {
    cycleStartedAt,
    cycleEndedAt: null,
    durationSeconds: null,
    decisionId: null,
    decisionTier: null,
    consensus: null,
    txHashes: [],
    ipfsCid: null,
    mode: process.env.AGENT_RUN_MODE || 'unknown',
    githubRunUrl: process.env.GITHUB_RUN_URL || null,
    errors: [],
  };

  try {
    const { runMultiAgentCycle } = require('../src/orchestrator/multiAgentLoop');
    const result = await runMultiAgentCycle({ dryRun: false });

    // runMultiAgentCycle currently returns the decision object on success.
    // In dryRun=false path it returns the multi-agent decision (not a richly-
    // typed summary), so we fish out what we can.
    summary.decisionId = result?.proposalId ?? null;     // future-proofed
    summary.decisionTier = result?.decisionTier ?? null;
    summary.consensus = result?.consensus ?? null;
    // tx hashes are written to ValidationRegistry/DecisionLog via the
    // orchestrator; pulling them back from the result requires a small
    // patch in multiAgentLoop. For now, we leave [] and the proof
    // is in outcomes.json + on-chain.
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    summary.errors.push(msg.slice(0, 200));
    appendFailure({ at: cycleStartedAt, error: msg.slice(0, 200) });
    // Don't rethrow — write a summary so the workflow can still commit
    // a "we tried, here's why it failed" record.
  }

  // Validate state files written by the cycle (runMultiAgentCycle persists
  // these as a side effect).
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

  // Exit codes:
  //   0 = cycle ran (success or soft failure with summary written)
  //   2 = state file corruption (something bad happened, fail the workflow)
  if (validationErrors.length > 0) process.exit(2);
  process.exit(0);
}

main().catch((e) => {
  console.error('Fatal in run-cycle.js:', e);
  process.exit(99);
});
```

Decisions:
- **Cycle-level errors are soft (exit 0)** so the workflow still commits
  a summary that records the failure — keeps front-end honest about
  liveness.
- **State-file corruption is hard (exit 2)** so the workflow fails and
  we don't push corrupt JSON.
- **`txHashes` is `[]` for now.** Wiring `runMultiAgentCycle` to return
  the 4 TX hashes is a small refactor; out of scope here. The hashes
  are still recorded on chain and visible via `/api/decisions`.

### C3 — Slight `multiAgentLoop.js` patch

Add to the function's return object so the cycle-runner can capture the tier:

```javascript
// At the end of runMultiAgentCycle, replace `return decision;` with:
return {
  decision,
  decisionTier,
  disagreementSignal,
  consensus: decision.consensus,
  proposalId: typeof proposalId === 'bigint' ? Number(proposalId) : proposalId,
};
```

This is the same return shape that the dryRun branch already returns,
so making it consistent simplifies `run-cycle.js`. The existing
`mainMultiAgent.js` consumer reads `result.consensus` — that field is
preserved in the new shape. Verify `runBatch.js` too.

### C4 — `/api/health` extensions

Frontend route `frontend/app/api/health/route.ts` gains three new reads:

```typescript
// 1. lastCycleSummary — embed the file directly
const summary = safeReadJson<unknown>(backendPath('data', 'last-cycle-summary.json'));

// 2. runHistory — last 5 entries from cycle-history.json
const historyAll = safeReadJson<unknown[]>(backendPath('data', 'cycle-history.json')) ?? [];
const runHistory = historyAll.slice(-5).map((e) => ({
  cycleStartedAt: e.cycleStartedAt,
  decisionTier: e.decisionTier,
  durationSeconds: e.durationSeconds,
}));

// 3. cyclesFailed24h — count of failures within last 24h
const failures = safeReadJson<{ at: string }[]>(backendPath('data', 'cycle-failures.json')) ?? [];
const cutoffMs = Date.now() - 24 * 3600 * 1000;
const cyclesFailed24h = failures.filter((f) => Date.parse(f.at) >= cutoffMs).length;
```

Add fields to `HealthResponse` type. No breaking changes — these are
additive.

### C5 — `data/last-cycle-summary.json` layout

```json
{
  "cycleStartedAt": "2026-05-26T13:00:00.000Z",
  "cycleEndedAt": "2026-05-26T13:01:12.470Z",
  "durationSeconds": 72.47,
  "decisionId": 98,
  "decisionTier": "BLOCKED_BY_LOW_CONFIDENCE",
  "consensus": false,
  "txHashes": [],
  "ipfsCid": null,
  "mode": "cron-github-actions",
  "githubRunUrl": "https://github.com/USBVadik/TuringVault-Core/actions/runs/123456789",
  "errors": []
}
```

≤ 2 KB always. Provides judges with a deep-link to the actual GH
Actions run that produced each cycle.

### C6 — `.kiro/runbooks/cron-operations.md`

Single-page operator reference. Sections:

1. **First-time setup** — list of GH Actions secrets to create, exact
   names, where to paste each.
2. **Pause the agent** — Actions tab → Workflow → ⋯ → Disable.
3. **Manual cycle** — Actions tab → Workflow → Run workflow.
4. **Reading logs** — direct URL pattern + grep tips for common
   failure modes.
5. **Soft vs hard failure** — definitions and what each looks like in
   the workflow output.
6. **Recover from stuck nonce** — instructions for clearing a
   pending TX.
7. **Cost monitoring** — links + thresholds.
8. **Disabling Gemini arbiter temporarily** — for diagnosis.

## Files touched

```
NEW:
  .github/workflows/agent-cycle.yml
  scripts/run-cycle.js
  .kiro/runbooks/cron-operations.md
  data/last-cycle-summary.json   (initial empty placeholder, optional)

MODIFIED:
  src/orchestrator/multiAgentLoop.js
    - return shape unified to { decision, decisionTier, disagreementSignal,
      consensus, proposalId } in both dryRun and live paths
  frontend/app/api/health/route.ts
    - lastCycleSummary, runHistory, cyclesFailed24h fields
  README.md
    - "Running" section: add link to GH Actions cron + runbook

UNCHANGED:
  contracts/*  (no contract changes)
  Other agent logic
  src/data/raw_model_outputs/  (still gitignored)
```

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Vercel rebuild storm if cron lands on every hour exactly. | 24/day < 100/day free tier. Documented in NFR4. |
| Push race when operator and cron commit at the same time. | `git pull --rebase --autostash` retry; cron commits are state-files-only so conflicts are rare. |
| GH Actions cron drift (free-tier delays). | 60-min interval absorbs ≤ 30 min of drift before mascot turns 🟡. |
| Bedrock rate-limit causes a series of soft failures. | Each cycle is independent; failures logged to `cycle-failures.json` and surfaced via `cyclesFailed24h`. |
| Gemini service account key leaks. | Stored as GitHub secret (encrypted at rest), written to disk in CI only, removed before commit-back step, repo `.gitignore` already excludes `*.json` keys via the existing `.env*` rules — but we add `gemini-service-account.json` explicitly. |
| Repo size growth. | Per-cycle commit ≤ 10 KB. Annual: ~85 MB. Acceptable for a hackathon project. Post-hackathon git-filter-repo cleans if needed. |
| State-file write contention if a future spec adds a parallel cron. | Single `concurrency: agent-cycle` group blocks parallel runs. |
| Bedrock spend forecast wrong. | Workflow runs visible in real-time; if a single cycle costs >$1, alert in cron-operations runbook to investigate. |

## Test plan

1. **Local dry-run of `run-cycle.js`** with `dryRun: true` (set in code
   for one test run) — verify summary file written, history file
   updated, no errors.
2. **First live run via `workflow_dispatch`** — manually trigger from
   the Actions UI before scheduling kicks in. Watch logs. Verify:
   - `last-cycle-summary.json` committed back
   - `/api/health.lastCycleAge` < 600 s within 2 min
   - Mascot turns 🟢
3. **Wait for one scheduled run** to confirm cron path works.
4. **Disable workflow** via UI; wait > 60 min; verify mascot turns 🟡
   (correct honest behavior).
5. **Re-enable** workflow; verify mascot turns 🟢 again on the next run.

## Out of scope confirmation

This spec does NOT:
- Modify smart contracts.
- Change agent decision logic.
- Add new model providers.
- Add new RWA assets to the strategy (separate spec
  `rwa-allocation-active`).
- Build a vault contract (separate spec).
- Add per-cycle artifact uploads (deferred).
- Backfill missing decisions for the 23 May → present gap (out of scope;
  if needed, a one-shot manual script).
