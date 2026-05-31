# Audit 34 - API Endpoints

Generated: 2026-05-31
Primary evidence: `raw/_fetch-summary.md`, `raw/api/*.json`, `raw/api/api-route-grep.md`

## Live Endpoint Results

| Endpoint | HTTP | Latency | Cache | Notable fields |
| --- | ---: | ---: | --- | --- |
| `/api/health` | 200 | 49 ms | HIT | `lastCycleAge=4317`, `succeeded24h=21`, `failed24h=0` |
| `/api/decisions` | 200 | 51 ms | HIT | `total=203`, `approved=133`, `rejected=70`, latest `BLOCKED_BY_PORTFOLIO` |
| `/api/strategy` | 200 | 2087 ms | MISS | strategy/regime/position payload |
| `/api/discipline` | 200 | 191 ms | MISS | latest/history/summary |
| `/api/elfa-snapshot` | 200 | 666 ms | MISS | social snapshot |
| `/api/backtest` | 200 | 339 ms | MISS | summary/equity/trades |
| `/api/agent-card` | 200 | 4333 ms | MISS | source `on-chain-tokenURI`, total 203 |
| `/api/market` | 200 | 59 ms | HIT | price/sentiment/yield |
| `/api/performance` | 200 | 608 ms | MISS | NAV 135.38, +1757 bps, settled 67 |
| `/api/proof-explorer` | 200 | 1211 ms | MISS | total decisions 202 |
| `/api/reasoning` | 200 | 429 ms | MISS | latest cycle/evolution/progress |
| `/api/reputation` | 200 | 549 ms | MISS | score/win-rate payload |
| `/api/evolution` | 200 | 1319 ms | MISS | token/evolution payload |
| `/api/challenge` | 200 | 1587 ms | MISS | challenge verification payload |
| `/api/yield-meth` | 200 | 161 ms | PRERENDER | degraded cached mETH APY |
| `/api/cron/trigger-cycle` | 500 | 296 ms | MISS | `CRON_SECRET not configured` |

## Findings

| ID | Severity | Endpoint | Finding | Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| A34-API-01 | P0 | `/api/cron/trigger-cycle` | Live Vercel trigger route returns 500 because `CRON_SECRET` is not configured. If this route is meant to be the schedule bridge/fallback, it is currently broken. | `raw/api/api_cron_trigger-cycle.json` | open |
| A34-API-02 | P1 | `/api/agent-card` | Slow live response, 4333 ms. This is close to serverless timeout risk and poor UX for fresh card renders. | `raw/_fetch-summary.md` | open |
| A34-API-03 | P1 | `/api/strategy` | Slow live response, 2087 ms. | `raw/_fetch-summary.md` | open |
| A34-API-04 | P1 | `/api/decisions` vs `/api/proof-explorer` | Decision count mismatch: decisions reports 203, proof explorer reports 202. | `raw/_fetch-summary.md` | open |
| A34-API-05 | P2 | API capture secret scan | No named secrets found, but tx hashes still produce noisy long-hex output in scan artifacts. | `raw/security/api-secret-scan.md` | open |
| A34-API-06 | P2 | `/api/elfa-snapshot` source | `export const dynamic` and `const ELFA_BASE` appear on the same source line; harmless but easy to clean. | `raw/api/api-route-grep.md` | open |

## Secret Scan

`scripts/audit/check-secrets.sh` found no named secret patterns in captured API responses. It did detect transaction-hash-shaped strings in JSON captures; these are not credentials but the scanner remains noisy.

## Not Checked

- A full schema diff against every consuming React component was not completed.
- Sustained load/95p API probing was not completed; the table above is single-run live evidence.
- Dynamic replay endpoints need representative IDs.
