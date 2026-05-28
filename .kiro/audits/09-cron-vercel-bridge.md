# Audit: GitHub Actions ↔ Vercel Bridge (R10)

**Run at:** 2026-05-28T08:49Z
**Auditor:** Kiro (Claude Opus 4)
**Method environment:** Local macOS, Vercel API via token, git log, source inspection

## Scope

| Surface | Type | Expected freshness | Source of expectation |
|---------|------|--------------------|-----------------------|
| Cron commits → Vercel deploys | Integration | Every cron push triggers deploy | agent-cycle.yml pushes to main; Vercel auto-deploys on main push |
| GH Actions secrets ↔ Vercel env vars | Config drift | Secrets needed by frontend should exist in Vercel | R10 acceptance criteria |
| API route fs.readFileSync fallback | Code path | Each fs read has a fetchFromGitHub fallback | Vercel serverless has no repo filesystem |
| Vercel "Ignored Build Step" config | Config | No filter blocking cron commits | R10 requirement |

## Method

1. **Cron commits:** `git log --author="TuringVault Cron" --format="%H %ai %s" -3`
2. **Vercel deployments:** Hit `https://api.vercel.com/v6/deployments?limit=10&projectId=prj_ixWx8Sj1lrGGXyFIgFvJsLq95icw` with bearer token.
3. **Env drift:** Extracted GH Actions secret names from `agent-cycle.yml` (`grep -o 'secrets\.[A-Z_]*'`). Queried Vercel project env API (`/v9/projects/.../env`).
4. **Filesystem fallback:** `grep -rn "fs.readFileSync" frontend/app/api/*/route.ts` then `grep -rn "fetchFromGitHub\|raw.githubusercontent"` on same files.
5. **Ignored Build Step:** Queried Vercel project settings API for `commandForIgnoringBuildStep`.

## 1. Per-Cron-Commit Deployment Status

| Commit SHA | Commit time (UTC) | Vercel state | Deploy URL | Time push→ready (s) |
|------------|-------------------|--------------|-----------|---------------------|
| `8ea46d0f6356` | 2026-05-28T05:02:45 | **READY** | frontend-gyhkie4l7-usbvadiks-projects.vercel.app | ~50 (created 05:02:48, build 47s) |
| `8cd5aa84efcc` | 2026-05-28T04:39:58 | **READY** | frontend-clr86sny3-usbvadiks-projects.vercel.app | ~55 (created 04:40:01, build 52s) |
| `b55e7f15b028` | 2026-05-27T23:51:20 | **READY** | frontend-f5m7hwd3x-usbvadiks-projects.vercel.app | ~50 (created 23:51:23, build 47s) |

**Verdict:** ✅ All 3 cron commits triggered a Vercel deployment and reached READY state within ~50-55 seconds. No P0 here.

Push-to-deploy latency: ~3s from git push to Vercel `created` timestamp, then 47-52s build. Total push→ready ≈ 50-55s.

## 2. Environment Variable Drift

### GH Actions secrets (from workflow YAML):

| Secret name | In GH Actions | In Vercel | Severity |
|-------------|:---:|:---:|----------|
| AWS_ACCESS_KEY_ID | ✓ | ✗ | — (backend only) |
| AWS_REGION | ✓ | ✗ | — (backend only) |
| AWS_SECRET_ACCESS_KEY | ✓ | ✗ | — (backend only) |
| ELFA_API_KEY | ✓ | ✓ | — |
| GEMINI_PROJECT_ID | ✓ | ✗ | — (backend only) |
| GITHUB_TOKEN | ✓ | ✗ | — (built-in) |
| GOOGLE_APPLICATION_CREDENTIALS_JSON | ✓ | ✗ | — (backend only) |
| MANTLE_RPC_URL | ✓ | ✗ | **P2** |
| NANSEN_API_KEY | ✓ | ✗ | — (backend only) |
| PINATA_API_KEY | ✓ | ✗ | — (backend only) |
| PINATA_JWT | ✓ | ✗ | — (backend only) |
| PINATA_SECRET | ✓ | ✗ | — (backend only) |
| PRIVATE_KEY | ✓ | ✗ | — (backend only) |
| NEXT_PUBLIC_BASE_URL | ✗ | ✓ | — (frontend only) |

### Feature flags specifically required by R10:

| Flag | In GH Actions | In Vercel | Analysis |
|------|:---:|:---:|----------|
| `RWA_EXECUTE_ENABLED` | ✓ (hardcoded `"true"` in workflow env) | ✗ | **P2** — frontend doesn't currently read this; only cron uses it |
| `CHALLENGE_LIVE_ENABLED` | ✗ | ✗ | Not referenced in either; feature appears code-gated |
| `AGENT_RUN_MODE` | ✓ (hardcoded `cron-github-actions`) | ✗ | **P2** — frontend doesn't read this at runtime |
| `MANTLE_RPC_URL` | ✓ (from secret) | ✗ | **P2** — frontend API routes don't use RPC directly; on-chain reads happen in cron |

**Verdict:** The Vercel project has only 2 env vars (`ELFA_API_KEY`, `NEXT_PUBLIC_BASE_URL`). This is acceptable because the frontend API routes read data from **committed state files** (pushed by cron) rather than calling external APIs or chain RPCs directly. The feature flags `RWA_EXECUTE_ENABLED`, `CHALLENGE_LIVE_ENABLED`, `AGENT_RUN_MODE` are backend/cron-only. No P0 drift — the missing vars are not consumed by any deployed frontend code path.

## 3. Filesystem Fallback Table

Routes that use `fs.readFileSync` to read backend state files:

| Route | Has fs.readFileSync | Has GitHub raw fallback | Gap |
|-------|:---:|:---:|------|
| `/api/health` | ✓ (6 files) | ✓ (`fetchFromGitHub` helper, 6 fallbacks) | None |
| `/api/strategy` | ✓ (2 files: outcomes.json, position_state.json) | **Partial** — outcomes.json has raw.githubusercontent fallback; position_state.json does NOT | **P1** |
| `/api/decisions` | ✓ (outcomes.json) | ✗ — returns empty if file missing (`if (!fs.existsSync(p)) return out`) | **P0** |
| `/api/discipline` | ✓ (discipline-history.json) | ✗ — returns null on catch | **P0** |
| `/api/performance` | ✓ (multiple files) | ✗ — returns null on catch | **P0** |
| `/api/reasoning` | ✓ (4 files: progress, evolution, intents, loop log) | ✗ — uses existsSync guard, returns empty objects | **P1** |
| `/api/agent-card` | ✓ (agent-card JSON) | ✗ — returns null if file missing | **P1** |

### Analysis

On Vercel serverless, the working directory does NOT contain the repo's `data/` or `src/data/` directories. The cron pushes state files to `main`, but Vercel's build only includes what's in `frontend/` (root directory = `frontend`, with `sourceFilesOutsideRootDirectory: true`).

**Critical question:** Does `sourceFilesOutsideRootDirectory: true` mean Vercel's build copies `src/data/` and `data/` into the serverless function bundle?

Given that `sourceFilesOutsideRootDirectory: true` is set AND the project root is `frontend`, Vercel will include files from the parent directory referenced by relative paths (e.g., `path.resolve(process.cwd(), "..", "src", "data", "outcomes.json")`). This means `fs.readFileSync` calls **may actually work** if the build step properly includes these files.

**However:** Only `/api/health` has a proper `fetchFromGitHub` fallback. If the serverless filesystem path resolution ever fails (cold start edge case, Vercel config change, file not included in bundle), all other routes silently return empty/null with no error signal to the user. This is a reliability concern.

## 4. Vercel "Ignored Build Step" / Git Filter Config

| Setting | Value |
|---------|-------|
| `commandForIgnoringBuildStep` | `null` (not configured) |
| `rootDirectory` | `frontend` |
| `sourceFilesOutsideRootDirectory` | `true` |
| Framework | Next.js (auto-detected) |

**Verdict:** ✅ No ignore filter is configured. Every push to `main` (including cron commits from author "TuringVault Cron") will trigger a build. Combined with Section 1 evidence (all 3 recent cron commits deployed), the bridge is working as intended.

## Findings

| ID | Severity | Surface | Expected | Actual | Root cause | Suggested fix |
|----|----------|---------|----------|--------|------------|---------------|
| bridge-1 | **P0** | `/api/decisions` | GitHub fallback when fs unavailable | Returns empty array silently — no fallback, no error signal | Missing fetchFromGitHub pattern | Add fetchFromGitHub fallback (same pattern as /api/health) |
| bridge-2 | **P0** | `/api/discipline` | GitHub fallback when fs unavailable | Returns null silently | Missing fetchFromGitHub pattern | Add fetchFromGitHub fallback |
| bridge-3 | **P0** | `/api/performance` | GitHub fallback when fs unavailable | Returns null silently | Missing fetchFromGitHub pattern | Add fetchFromGitHub fallback |
| bridge-4 | **P1** | `/api/strategy` (position_state) | GitHub fallback for all fs reads | Only outcomes.json has fallback; position_state.json returns default on fail | Incomplete fallback implementation | Add raw.githubusercontent fallback for position_state.json |
| bridge-5 | **P1** | `/api/reasoning` | GitHub fallback | Returns empty objects when files missing; no GitHub fetch | Missing fetchFromGitHub pattern | Add fetchFromGitHub for progress/evolution/intents files |
| bridge-6 | **P1** | `/api/agent-card` | GitHub fallback | Returns null if agent-card.json missing from fs | Missing fetchFromGitHub pattern | Add fetchFromGitHub fallback |
| bridge-7 | **P2** | Vercel env vars | Feature flags present in both environments | Only 2 env vars on Vercel vs 13 secrets on GH Actions | Frontend doesn't need most secrets (cron-only) | Acceptable; document that frontend reads state files not secrets |

### Severity justification for bridge-1/2/3 (P0):

These are P0 under the honesty rule because: if `sourceFilesOutsideRootDirectory` behavior changes, or if Vercel's file bundling has an edge case, these routes will return empty/null data with **no error signal**. The UI would show "no data" or empty states while the actual data exists in the repo. Only `/api/health` has the defensive fallback pattern. The risk is real because Vercel's `sourceFilesOutsideRootDirectory` is an undocumented-behavior dependency — the routes should not silently degrade.

**Mitigating factor:** As of this audit, all 3 recent cron deploys are READY and the live site appears to serve data correctly (implying fs reads currently work). The P0 is for the fragility of the integration, not an active breakage.

## Not checked

| Surface | Reason |
|---------|--------|
| Vercel build logs for cron deploys | No API endpoint for per-deployment build logs without team access |
| GH Actions secret list via API | `gh` CLI not available in this environment; secret names extracted from YAML instead |
| Vercel deploy hooks / webhook config | Not exposed via public project API |
| Historical cron commits that may have failed to deploy | Only last 10 Vercel deployments fetched; older history not checked |
