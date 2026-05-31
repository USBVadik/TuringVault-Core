# Audit 34 - GitHub Actions to Vercel Bridge

Generated: 2026-05-31
Primary evidence: `raw/cron/vercel-deployments.md`, `raw/security/env-drift.md`, `raw/api/api-route-grep.md`, `raw/api/api_cron_trigger-cycle.json`

## Vercel Deployment Query

The Vercel deployment script returned:

| State | Commit | Created | URL |
| --- | --- | --- | --- |
| ERROR | api | Project not found | - |

The script queried:

`https://api.vercel.com/v6/deployments?limit=10&projectId=frontend-seven-beta-46`

This appears to pass the project name as `projectId`, which Vercel rejects.

## Live Trigger Route

`/api/cron/trigger-cycle` returned 500:

`{"error":"CRON_SECRET not configured","triggered":false}`

## Env Drift

The env drift helper requires two operator-generated files:

- `/tmp/gh-secrets.txt`
- `/tmp/vercel-env.txt`

Those were not present, so GitHub/Vercel secret parity remains manually blocked.

## Findings

| ID | Severity | Surface | Finding | Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| A34-BRIDGE-01 | P0 | Vercel trigger route | The live trigger route cannot run because `CRON_SECRET` is missing in Vercel runtime. | `raw/api/api_cron_trigger-cycle.json` | open |
| A34-BRIDGE-02 | P1 | Vercel deployment audit | Deployment bridge could not be verified because the audit script queries an invalid Vercel project identifier. | `raw/cron/vercel-deployments.md` | open |
| A34-BRIDGE-03 | P1 | Env parity | GitHub/Vercel secret-name parity was not verified. This matters because the trigger route is already proving at least one missing runtime secret. | `raw/security/env-drift.md` | open |

## Not Checked

- Last 3 cron commits to matching Vercel READY deployments.
- Vercel build logs.
- Vercel ignored-build-step configuration.
