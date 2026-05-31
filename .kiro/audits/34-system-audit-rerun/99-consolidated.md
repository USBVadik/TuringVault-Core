# Audit 34 - Consolidated Findings

Generated: 2026-05-31
Run directory: `.kiro/audits/34-system-audit-rerun/`
Original spec: `.kiro/specs/system-audit-pre-submission/tasks.md`

## Scope Verdict

This is a fresh broad rerun of the old 20-task audit structure, but it is not a perfect historical replay of every acceptance criterion. Audit 34 produced live raw artifacts for UI/API, cron, chain, state, external deps, security, documents, pipeline, screenshots, and Lighthouse. Manual gaps remain where credentials or operator-only lists are required.

The earlier work before Audit 34 was not the full 20-task rerun. It was a post-fix review of specific bugs plus CodeRabbit/adversarial review. Audit 34 is the first fresh broad rerun in this thread.

## Severity Distribution

| Severity | Count |
| --- | ---: |
| P0 | 5 |
| P1 | 20 |
| P2 | 21 |
| Manual/Not checked | 7 |

## P0 Findings

| ID | Surface | Finding | Status |
| --- | --- | --- | --- |
| A34-API-01 | `/api/cron/trigger-cycle` | Live trigger route returns 500: `CRON_SECRET not configured`. | open |
| A34-BRIDGE-01 | Vercel bridge | Same missing `CRON_SECRET` means the independent Vercel trigger/bridge is not operational. | open |
| A34-RUNTIME-01 | Vercel runtime | The only live 5xx in the API probe is the cron trigger route. | open |
| A34-UI-01 | `/proof-explorer` | Stale old proof copy is visible on the live proof page. | open |
| A34-CHAIN-01 | Proof/Sourcify claim | Chain truth is 5/6 current contracts Sourcify-perfect; UI must not expose old 4/5 or ambiguous proof copy. | open |

## P1 Findings

| ID | Surface | Finding | Status |
| --- | --- | --- | --- |
| A34-CRON-01 | GitHub schedule | Last 20 scheduled agent runs covered only 46.5% of expected half-hour slots. | open |
| A34-API-02 | `/api/agent-card` | 4333 ms single-run latency. | open |
| A34-RUNTIME-02 | `/api/agent-card` | Same runtime latency issue; cache or timeout hardening needed. | open |
| A34-API-03 | `/api/strategy` | 2087 ms single-run latency. | open |
| A34-RUNTIME-03 | `/api/strategy` | Same runtime latency issue. | open |
| A34-API-04 | decisions/proof API | `/api/decisions` reports 203, `/api/proof-explorer` reports 202. | open |
| A34-CHAIN-02 | replay manifests | Cycle 201 verifies, but cycle 202 manifest is missing. | open |
| A34-CHAIN-03 | registry vs outcomes | On-chain proposals exceed outcome rows by 73; semantics need documentation or reconciliation. | open |
| A34-STATE-01 | grid subsystem | Grid bot files have not updated since 2026-05-27. | open |
| A34-STATE-02 | position state | `position_state.json` did not update with latest evening cycle. | open |
| A34-PIPE-01 | trading behavior | Latest captured executed swap is risk-off mUSD; sampled mETH action was blocked. | open |
| A34-PIPE-02 | proof pipeline | Sampled IPFS proofs exist, but latest proof counts/manifests lag current totals. | open |
| A34-BRIDGE-02 | deployment audit | Vercel deployment list cannot be fetched because audit script uses invalid project ID. | open |
| A34-BRIDGE-03 | env parity | GitHub/Vercel secret parity not verified; live route already proves a missing Vercel secret. | open |
| A34-SEC-01 | runtime env | `CRON_SECRET` missing at runtime. | open |
| A34-THREAT-01 | proof integrity | Anchor binding partial: cycle 201 passes, cycle 202 missing. | open |
| A34-THREAT-02 | scheduler bridge | Broken Vercel trigger weakens independent scheduler story. | open |
| A34-UX-01 | home mobile | Mobile overflow on `/`. | open |
| A34-UX-02 | discipline mobile | Mobile overflow on `/discipline`. | open |
| A34-UX-03 | proof page | Stale proof copy visible in DOM. | open |

## P2 Findings

| ID | Surface | Finding | Status |
| --- | --- | --- | --- |
| A34-API-05 | secret scanner | Captured API scans still noisy on transaction hashes. | open |
| A34-API-06 | source formatting | `api/elfa-snapshot` has same-line export/const formatting. | open |
| A34-CRON-02 | audit helper | `gh-actions-runs.sh` assumes only `:17` slot. | open |
| A34-CRON-03 | replay validator | Workflow inventoried but not deeply audited. | open |
| A34-CHAIN-04 | Router | Router bytecode exists but is not Sourcify-perfect. | open |
| A34-STATE-03 | state audit helper | outcome sample timestamp field should use `recordedAt`. | open |
| A34-PIPE-03 | R7 quality checks | Full five-check rubric was only partially rerun. | open |
| A34-EXT-01 | external probe | Mantle RPC health should use JSON-RPC POST, not GET. | open |
| A34-EXT-02 | LLM providers | Bedrock/Vertex not probed without SDK auth. | open |
| A34-EXT-03 | Nansen/smart money | Smart-money feed not independently probed. | open |
| A34-DOC-01 | `assets/agent-card.json` | Static asset stale at 158 decisions vs live 203. | open |
| A34-DOC-02 | README | Snapshot stats stale but labelled. | open |
| A34-SEC-02 | env drift | Secret parity requires operator-provided lists. | manual |
| A34-SEC-03 | scanner | Reduce long-hex false-positive output. | open |
| A34-SEC-04 | CSP | CSP includes `unsafe-inline` and `unsafe-eval`. | open |
| A34-THREAT-03 | prompt injection | Hostile external payload sanitizer not tested. | open |
| A34-THREAT-04 | worst-case loss | Token balances/allowances not enumerated. | open |
| A34-UX-04 | tap targets | Tiny tap targets remain. | open |
| A34-UX-05 | Lighthouse | Home performance score 73. | open |
| A34-RUNTIME-04 | CSP | Same CSP hardening item. | open |
| A34-EXT-MANUAL | external auth | Authenticated Pinata/JWT expiry not checked. | manual |

## What This Says About Risk-on Buying

Audit 34 supports the user's live observation: the captured recent executed swap is defensive `mUSD`, while the sampled `mETH` target was blocked by low confidence. The earlier portfolio-guard fix may prevent repeated stable-heavy risk-off churn, but this audit does not prove that the agent has started buying mETH/MNT in production. The next engineering fix should focus on the decision-to-execution path for risk-on grid entries, with Mantle asset vocabulary kept correct: native ETH is not the Mantle risk asset; use `mETH` and/or `WETH` where the route actually supports it.

## Not Checked / Manual Gaps

| Gap | Why |
| --- | --- |
| GitHub/Vercel env drift | needs values-free operator secret-name lists |
| Vercel deployment history | current script queries invalid project ID |
| Vercel build/runtime logs | needs Vercel access/logs |
| Bedrock/Vertex health | SDK auth required |
| Nansen/smart-money data freshness | provider path not independently probed |
| full R9 30+ claim extraction | only spot-check repeated |
| axe-core | package/runner not available in this workspace |
| `/replay/[id]` | needs representative ID in UI probe |
| EOA token balances/allowances | native MNT only captured |

## Raw Artifact Index

- `raw/_fetch-summary.md`
- `raw/api/*.json`
- `raw/cron/*.md`
- `raw/onchain/*.md`
- `raw/external/probe-external.md`
- `raw/state/state-files.md`
- `raw/security/*`
- `raw/design/screens/*.png`
- `raw/design/lighthouse/*.json`
- `raw/docs-claims.md`
- `raw/pipeline-data-cards.md`
- `raw/pipeline-ipfs-probes.md`

## Recommended Next Fix Order

1. Restore Vercel runtime env for `CRON_SECRET` and validate `/api/cron/trigger-cycle`.
2. Fix live `/proof-explorer` copy and any cached stale Sourcify wording.
3. Reconcile decision/proof/manifest counts: 203 vs 202 vs manifest 201.
4. Verify and tune risk-on execution path specifically for `mETH`, `WETH`, and `MNT` on Mantle.
5. Add external scheduler fallback if the product needs better than GitHub's best-effort schedule.
6. Cache `/api/agent-card` and `/api/strategy`.

## Post-rebase Note

While publishing this audit, `origin/main` advanced with two cron commits:

- `9b89ade` - cycle 202, `BLOCKED_BY_PORTFOLIO`
- `c71123e` - cycle 203, `BLOCKED_BY_PARSE_FAILURE`

Those commits landed after the raw Audit 34 captures. They reinforce the risk-on/execution concern but are not included in the timestamped raw API snapshots above.
