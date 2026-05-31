# Audit 34 - Secrets and Supply Chain

Generated: 2026-05-31
Primary evidence: `raw/security/api-secret-scan.md`, `raw/security/git-history-secrets.md`, `raw/security/npm-audit-root.json`, `raw/security/npm-audit-frontend.json`, `raw/security/source-env-and-xss-grep.md`, `raw/security/env-drift.md`

## Secret Scan

| Check | Result |
| --- | --- |
| Captured API response scan | no named secret patterns; tx-hash-shaped false positives |
| Git history secret regex scan | clean |
| Source grep for `dangerouslySetInnerHTML` | no hits in explicit check |
| Env drift | manual input required |

## npm Audit

| Workspace | Production vulnerabilities |
| --- | ---: |
| root | 0 |
| `frontend/` | 0 |

## Findings

| ID | Severity | Surface | Finding | Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| A34-SEC-01 | P1 | Vercel env | Live `/api/cron/trigger-cycle` proves `CRON_SECRET` is missing at runtime; secret parity is not just theoretical. | `raw/api/api_cron_trigger-cycle.json`, `raw/security/env-drift.md` | open |
| A34-SEC-02 | P2 | Env drift audit | Secret-name parity could not be verified without operator-provided GitHub/Vercel env lists. | `raw/security/env-drift.md` | manual |
| A34-SEC-03 | P2 | Secret scanner | Long hex/tx hashes make captured-response secret scans noisy. Keep the named-secret check, but reduce false-positive output. | `raw/security/api-secret-scan.md` | open |
| A34-SEC-04 | P2 | CSP | Live CSP includes `unsafe-inline` and `unsafe-eval`. | `raw/security/live-security-headers.md` | open |

## Not Checked

- Pinata JWT expiry decode.
- Actual secret presence in GitHub Actions and Vercel, because only values-free operator lists can safely prove this.
- Smart contract security internals.
