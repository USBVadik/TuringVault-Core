# Audit 34 - Threat Model

Generated: 2026-05-31
Primary evidence: `raw/security/*`, `raw/onchain/*`, `raw/external/*`

## Actors, Guards, and Gaps

| Actor | Capability | Existing guard | Audit 34 gap |
| --- | --- | --- | --- |
| Anonymous visitor | Read public UI/API, spam unauthenticated GETs | No private values in health/API captures; security headers present | No rate-limit review; slow endpoints could be abused |
| Hostile PR author | Modify state/docs/code before merge | CI exists | No branch-protection/CODEOWNERS proof in Audit 34 |
| Compromised Vercel env | Trigger broken runtime paths, leak env if route logs it | Health route does not echo secrets; source grep done | Env parity unknown; `CRON_SECRET` missing |
| Compromised GH runner | Write state, push artifacts, dispatch cycle | GitHub workflow success visible | Secret-name inventory not captured |
| Compromised agent EOA | Spend wallet funds/sign transactions | Limited observed native balance | Worst-case token balances were not fully enumerated |
| Hostile market/social payload | Prompt injection through external signal text | LLM validation and discipline layers | Prompt-input sanitizer not independently tested |
| External data outage | Stale/empty market/social inputs | Some routes degrade/cached | Provider-specific cycle fallback not fully traced |

## Seven Specific Tests From Original R13

| Test | Verdict | Notes |
| --- | --- | --- |
| hostile token symbol normalization | NOT CHECKED | requires prompt-construction test fixture |
| PR state-file tamper gate | NOT CHECKED | CI/path-ownership not audited deeply |
| Discipline accepted-without-gates path | NOT CHECKED | not re-read in Audit 34 |
| on-chain anchor binding | PARTIAL PASS | cycle 201 passes, cycle 202 manifest missing |
| `dangerouslySetInnerHTML` listing | PASS | explicit grep found none |
| live security headers | PARTIAL PASS | headers present, CSP allows unsafe inline/eval |
| worst-case loss estimate | PARTIAL | native MNT balance captured; token balances not enumerated |

## Findings

| ID | Severity | Surface | Finding | Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| A34-THREAT-01 | P1 | Proof integrity | Anchor binding is proven for cycle 201 but not for latest expected cycle 202. | `raw/onchain/verify-anchor-cycle-201.md`, `raw/onchain/verify-anchor-cycle-202.md` | open |
| A34-THREAT-02 | P1 | Scheduler bridge | Missing Vercel `CRON_SECRET` weakens independent scheduling/fallback story. | `09-cron-vercel-bridge.md` | open |
| A34-THREAT-03 | P2 | Prompt injection | Hostile external payload sanitization was not independently tested in this rerun. | this report | open |
| A34-THREAT-04 | P2 | Worst-case loss | Only native MNT was measured; token balances/allowances were not enumerated. | `raw/onchain/chain-probe.md` | open |

## One-page Summary

Audit 34 found no exposed credentials in captured API responses, no secret-pattern hits in git history, and no production npm vulnerabilities. The main risk is operational honesty/reliability: the GitHub schedule is green when it runs but misses many intended half-hour slots, the Vercel trigger route is currently broken by missing runtime config, and the latest proof/replay artifacts lag current decision totals. The public security-header baseline is present, but CSP remains permissive. The agent EOA holds about 19.25 native MNT; token balances were not enumerated.
