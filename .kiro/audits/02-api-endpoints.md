# Audit: API Endpoints

**Run at:** 2026-05-27 22:02 UTC
**Auditor:** Kiro (Claude Opus 4.7)
**Method environment:** local shell, fetching from
`https://frontend-seven-beta-46.vercel.app`
**Raw artefacts:** `.kiro/audits/raw/api/`

## Scope

All 14 API routes from `00-inventory.md`. Each was hit once via
`fetch-frontend.sh`; raw responses preserved under `raw/api/`.

## Method per surface

`curl -s -L -o raw/api/<name>.json -w '%{http_code}|...' --max-time 30 <URL>`.
Each captured response was: parsed as JSON, scanned with
`check-secrets.sh` (false positive on `0x[a-f0-9]{64}` because
TX hashes match — no real secrets found), inspected for shape and
freshness.

## Latency snapshot

| Route | HTTP | Bytes | Latency (ms) |
|-------|------|-------|--------------|
| `/api/health` | 200 | 1423 | 595 |
| `/api/decisions` | 200 | 11148 | 1573 |
| `/api/strategy` | 200 | 494 | 2113 |
| `/api/discipline` | 200 | 3235 | 289 |
| `/api/elfa-snapshot` | 200 | 326 | 1690 |
| `/api/backtest` | 200 | 5798 | 504 |
| `/api/agent-card` | 200 | 1779 | 4550 |
| `/api/market` | 200 | 285 | 390 |
| `/api/performance` | 200 | 584 | 579 |
| `/api/proof-explorer` | 200 | 16941 | 1038 |
| `/api/reasoning` | 200 | 485 | 551 |
| `/api/reputation` | 200 | 152 | 613 |
| `/api/evolution` | **500** | 594 | 702 |
| `/api/challenge` | 200 | 1209 | 1371 |

## Findings

| ID | Sev | Surface | Expected | Actual | Root cause | Suggested fix |
|----|-----|---------|----------|--------|------------|---------------|
| api-1 | **P0** | `/api/evolution` | 200 with evolution snapshot | 500: viem `tokenURI(uint256)` reverted on Identity contract for tokenId=1 | Route reads `tokenURI(1)` from `TuringVaultIdentity` but token #1 doesn't exist (tokenId starts at 0) OR has been unset. Production breakage. | Either fetch tokenId=0, or read `totalAgents()` first and use the latest, or guard the call with a try/catch and return a degraded payload. |
| api-2 | P1 | `/api/agent-card` | < 1s typical | 4550 ms (one-shot) | Round-trips IPFS gateway every render. No caching. | Cache the resolved tokenURI content for 60s. |
| api-3 | P1 | `/api/strategy` | < 500 ms | 2113 ms | Recomputes NAV from on-chain reads + CoinGecko on every call. | Add 30s in-memory cache or `revalidate=30`. |
| api-4 | P1 | `/api/elfa-snapshot` | sentiment field useful | `sentiment: null` always (V2 stripped raw text per ToS) | V2 design choice — not a bug, but UI may still show "—". | Verify UI handles `null` gracefully (covered in 01 ui audit). |
| api-5 | P1 | `/api/strategy` | rwaAllocation.lastRebalanceAt fresh after RWA swap | `lastRebalanceAt: null` despite `health.lastCycleSummary.rwa.executed:true` for last cycle | The health summary records the swap but `/api/strategy` reader doesn't pick up the latest RWA timestamp from `outcomes.json`. UI would not show "live · last allocation Xm ago" even though we did swap. | Re-read computation in `frontend/app/api/strategy/route.ts` — should fall back to latest `rwaIntent.executed:true` row in `outcomes.json` via fetchFromGitHub. |
| api-6 | P1 | `/api/reputation` | normalizedScore reflects winRate | `winRate: "40.9", normalizedScore: 100` (hard-coded ceiling) | If raw normalizer caps at 100 even for 40% winRate, judges see "100/100" alongside a 40% rate. Truth violation on R9 honesty rule. | Recompute normalized as `winRate * 100 / 100` or expose both values. |
| api-7 | P1 | `/api/reasoning` | timestamp + recent | response present, but matches a cycle from ~2h ago — stale | Same root cause as cron lag (see audit 03). | Resolved by fixing cron schedule. |
| api-8 | P1 | `/api/performance` | live numbers | `nav: 139.43` derived correctly, `winRate: 45.1` differs from `/api/reputation`'s `40.9` | Two routes compute winRate via different denominators (one over settled outcomes, one over reputation feedback). | Pick one; document the difference in tooltip. |
| api-9 | P2 | All API routes | Cache-Control set per dynamic mode | not validated in this run | Need explicit headers check via `curl -I`. | Probe in re-audit. |
| api-10 | P2 | secret leak scan | clean | `check-secrets.sh` matched `0x[a-f0-9]{64}` (TX hashes) — false positive | Pattern is over-broad; tighten to exclude common TX-hash contexts. | Update `check-secrets.sh` regex to exclude when context word "txHash"/"hash":"" precedes. |
| api-11 | P3 | `/api/discipline` | tx_proof rollup | works correctly after the morning fix (commit `0e307e4`) — confirmed by `latest.checks[0]={"name":"tx_proof", "status":"SKIP"}` for hold cycle | Already fixed. | None. |

## Honesty-rule check on responses

| Surface | Claim | Evidence | Verdict |
|---------|-------|----------|---------|
| `/api/agent-card` | `sourcify: "all four contracts full-match verified"` | Sourcify returns full_match for 6, none for Router (`0x8187...7001`); 4-of-7 is wrong number too | **HONESTY VIOLATION** — fix wording or count |
| `/api/agent-card` | `consensusRate: "100%"` | Stat calculator divides "validated" by "total proposals", but **every** proposal is validated by definition (validator always responds), so this is always 100% — meaningless metric. | Reword to "validation coverage" or remove. |
| `/api/agent-card` | `avgVaR: "~100 bps"` | hard-coded text, not computed | Either compute or label as illustrative. |
| `/api/agent-card` | `gasEfficiency: "~0.005 MNT per TX"` | hard-coded, not computed | Same. |
| `/api/agent-card` | `signing: "ethers.Wallet on the cron runner; vault contract pattern + hardware-KMS signing are roadmap items, not current production"` | Honest framing — good. | Keep. |
| `/api/decisions` | reasoning fields look genuine and varied | spot-checked 5 rows, distinct text | OK. |

## Not checked

| Surface | Reason |
|---------|--------|
| Cache-Control headers per route | will add HEAD probes in re-audit |
| Response schema diff vs frontend types | needs walking each consuming component |
| 5xx behavior under sustained load | out of scope for hackathon audit |
