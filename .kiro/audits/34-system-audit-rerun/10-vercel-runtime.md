# Audit 34 - Vercel Runtime

Generated: 2026-05-31
Primary evidence: `raw/_fetch-summary.md`, `raw/cron/vercel-deployments.md`, `raw/security/live-security-headers.md`

## Runtime Health

| Surface | Result |
| --- | --- |
| Public UI | all probed pages returned 200 |
| API | 15 probed API endpoints returned 200; `/api/cron/trigger-cycle` returned 500 |
| Health | `/api/health` returned 21 successes and 0 failures in 24h |
| Deployment list | not available; Vercel API returned project not found |

## Slow Endpoints

| Endpoint | Single-run latency |
| --- | ---: |
| `/api/agent-card` | 4333 ms |
| `/api/strategy` | 2087 ms |
| `/api/challenge` | 1587 ms |
| `/api/evolution` | 1319 ms |
| `/api/proof-explorer` | 1211 ms |

## Headers

Security headers are present:

- HSTS
- `x-content-type-options: nosniff`
- `x-frame-options: DENY`
- `referrer-policy: strict-origin-when-cross-origin`
- `permissions-policy` disabling camera/microphone/geolocation

CSP is present but allows `unsafe-inline` and `unsafe-eval`.

## Findings

| ID | Severity | Surface | Finding | Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| A34-RUNTIME-01 | P0 | `/api/cron/trigger-cycle` | Only 5xx found in the live probe; runtime env is missing `CRON_SECRET`. | `raw/_fetch-summary.md` | open |
| A34-RUNTIME-02 | P1 | `/api/agent-card` | 4.3s single-run latency needs caching or timeout hardening. | `raw/_fetch-summary.md` | open |
| A34-RUNTIME-03 | P1 | `/api/strategy` | 2.1s single-run latency needs caching or data-source split. | `raw/_fetch-summary.md` | open |
| A34-RUNTIME-04 | P2 | CSP | CSP still allows `unsafe-inline` and `unsafe-eval`. Acceptable for hackathon if needed by Next, but should be tightened later. | `raw/security/live-security-headers.md` | open |

## Not Checked

- Real Vercel function logs.
- p95 over 5 repeated calls per endpoint.
- Bundle-size analysis.
