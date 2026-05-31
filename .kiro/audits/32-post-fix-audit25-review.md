# External Review of TuringVault Pre-Submission Audit

start_time: 2026-05-31T20:15:09Z
end_time:   2026-05-31T20:31:57Z
elapsed:    16.8 minutes
reviewer:   GPT-5 Codex (Codex desktop)
environment: local workspace `/Users/usbdick/Documents/TuringVault-Core`; probes run from zsh/Node fetch against public Vercel, GitHub, Sourcify, and Mantle RPC-backed scripts

## WP-1 Source-document evidence (3+ quotations)

> "Every P0 must have `status=fixed` or `status=wont-fix-pre-submission` before audit close-out." -- `.kiro/audits/99-consolidated.md:213-218`

> "For the prior week, every cron commit message read `cycle N EXECUTED_SWAP` ... No corresponding DEX TX existed on-chain." -- `.kiro/audits/2026-05-28-trading-unblock.md:13-19`

> "Token symbols from CoinGecko/Nansen flow into LLM prompt without sanitization" -- `.kiro/audits/12-threat-model.md:76-82`

> "WHERE README or agent-card claims a verification status THIS status SHALL match the live blockchain reality." -- `.kiro/specs/system-audit-pre-submission/requirements.md:128-144`

## WP-2 Live-surface probe log (4+ probes)

| URL | HTTP status | timestamp | Notable fields |
| --- | --- | --- | --- |
| `https://frontend-seven-beta-46.vercel.app/api/health` | 200 | 2026-05-31T20:23:36Z | `status:"ok"`, `lastCycleTimestamp:"2026-05-31T19:43:41.125Z"`, `lastCycleAge:2337`, `cyclesSucceeded24h:21`, `cyclesFailed24h:0` |
| `https://frontend-seven-beta-46.vercel.app/api/decisions` | 200 | 2026-05-31T20:23:36Z | `total:202`, `totalApproved:133`, `totalRejected:69`, latest `displayTier:"BLOCKED_BY_PORTFOLIO"`, `executedOnChain:false` |
| `https://frontend-seven-beta-46.vercel.app/api/performance` | 200 | 2026-05-31T20:23:36Z | `nav:135.39`, `settledCount:67`, `winRate:46.3`, `cumulativePnlBps:1757`, `USDT0:106.3711` |
| `https://frontend-seven-beta-46.vercel.app/api/discipline` | 200 | 2026-05-31T20:23:37Z | checks include `price_freshness:PASS`, `drift_detection:PASS` |
| `https://frontend-seven-beta-46.vercel.app/api/yield-meth` | 200 | 2026-05-31T20:23:37Z | `source:"cached:defillama+l1-rpc"`, `degraded:true`, `assetHealth:"ok"`, `apyPct:2.12371` |
| `https://frontend-seven-beta-46.vercel.app/replay` | 200 | 2026-05-31T20:23:37Z | HTML rendered, title fragment present |
| `https://github.com/USBVadik/TuringVault-Core/actions/workflows/replay-validator.yml` | 200 | 2026-05-31T20:23:38Z | GitHub Actions page rendered |
| Sourcify listed URL, unencoded commas | 400 | 2026-05-31T20:23:38Z | `Parameter 'addresses' must be url encoded` |
| Sourcify same addresses, URL-encoded retry | 200 | 2026-05-31T20:23:49Z | first five addresses `status:"perfect"`; Router `0x8187...7001` `status:"false"` |
| `https://frontend-seven-beta-46.vercel.app/api/cron/trigger-cycle` | 500 | 2026-05-31T20:31:57Z | `{"error":"CRON_SECRET not configured","triggered":false}` |
| `https://frontend-seven-beta-46.vercel.app/proof-explorer?audit=e6bc1b4` | 200 | 2026-05-31T20:31:57Z | `x-vercel-cache:HIT`, `age:825`, still rendered old `5 contracts - 4 Sourcify-verified` copy |

## WP-3 Sample-and-verify

### P0 fixed (>=2)

| ID | re-probe command/url | output | verdict |
| --- | --- | --- | --- |
| `api-1` | `/api/evolution` | HTTP 200 at 2026-05-31T20:24:16Z; `currentVersion:"3.0.0"`, `totalEvolutions:6` | fixed holds |
| `bridge-1` | `/api/decisions` | HTTP 200; `total:202`, `totalApproved:133`, `totalRejected:69`, latest `BLOCKED_BY_PORTFOLIO` | fixed holds |
| `bridge-3` | `/api/performance` | HTTP 200; `settledCount:67`, `cumulativePnlBps:1757` | fixed holds |

### P0 wont-fix (>=2)

| ID | reasoning verbatim | defensible at T-17? |
| --- | --- | --- |
| `cron-1` | `wont-fix-pre-submission (platform limitation)` | Partly defensible only as "best-effort hourly"; not defensible as reliable 30-minute cron. A Vercel bridge is now in repo, but live `/api/cron/trigger-cycle` is inert until Vercel envs exist. |
| `design-P0-2` | `wont-fix-pre-submission (>30min)` | Defensible: static backtest SVG lacks hover/crosshair, but this is not a capital-safety or honesty blocker if labelled as backlog. |
| `cron-4` | `wont-fix-pre-submission (depends on cron-1)` | Defensible only while `/api/health.lastCycleAge` is presented as ground truth. The live bridge 500 means this remains operationally unresolved. |

### P1 sample (>=5, distinct surfaces)

| ID | suggested fix still appropriate? | status up to date? | one way the row could be wrong |
| --- | --- | --- | --- |
| `api-3` `/api/strategy` | Yes: caching/revalidate still appropriate; live probe took about 1.9-2.0s despite `cached:true`. | Still effectively open. | Could be wrong if cold start, Vercel edge location, or upstream RPC dominated the single measurement. |
| `api-6` `/api/reputation` | Partly: live now returns `winRate:"49.8"`, `normalizedScore:50`, not the old hard-coded 100. | Stale row. | Could still be inconsistent because `/api/performance.winRate` is `46.3`; denominators may differ. |
| `threat-1` prompt construction | Original fix request was right; recursive sanitizer now exists and tests pass. | Stale row; later changelog/test evidence closed it. | Could overstate "strip control chars" because LF/tab are intentionally preserved; the meaningful injection delimiters are filtered. |
| `threat-3` security headers | Original fix was right; live headers now include CSP/HSTS/X-Content-Type/X-Frame. | Stale row. | CSP still permits `unsafe-inline`/`unsafe-eval`, so "headers present" is not "hardened CSP". |
| `P1-1` gas claim | Gas sample artifact now exists in README and scripts. | Stale row. | Gas estimates can drift with MNT price and route mix; docs should call it a verified sample, not a universal cost. |
| `P1-2` Nansen tool count | README now says 9 named tools with code path. | Stale row. | "Used per cycle" can be wrong if Nansen API degrades or returns cached/fallback data. |

### P2 sample (>=1)

`api-10`: After commit `e6bc1b4`, `bash scripts/audit/check-secrets.sh .kiro/audits/raw` exits 0 and prints `Transaction-hash-shaped strings` plus `No named secret patterns found`. This fixes the TX-hash false positive, but introduces residual risk: an unlabeled `0x[a-fA-F0-9]{64}` private-key-shaped value now reports but does not fail.

### Not-checked sample (>=1)

`Playwright not installed`: currently false. `npx playwright --version` returns `Version 1.60.0`. It may have been honest in the old audit environment, but the current post-fix audit cannot use it as an excuse; screenshot/Lighthouse/axe follow-up should be rerun.

## WP-4 Already-shipped checks (per recommendation)

| recommendation | grep query | match? |
| --- | --- | --- |
| Configure Vercel `CRON_SECRET` + `GH_DISPATCH_TOKEN` and prove `/api/cron/trigger-cycle` no longer returns 500. | `rg -n "CRON_SECRET|GH_DISPATCH_TOKEN|trigger-cycle|Vercel cron bridge|cron bridge" .kiro/SUBMISSION-CHANGELOG.md .kiro/audits frontend .github README.md` | Code exists in `frontend/vercel.json` and route, but no changelog proof and live endpoint returns `CRON_SECRET not configured`; operational work not shipped. |
| Force/verify Vercel deploy so proof explorer uses `6 contracts - 5/6 Sourcify-verified`. | `rg -n "5 contracts - 4 Sourcify|contractProofSummary|5/6 Sourcify|Audit 26 supersedes|Sourcify-verified|Proof Explorer" .kiro/SUBMISSION-CHANGELOG.md .kiro/audits frontend README.md assets` | Code helper shipped, live page still old/cached; deployment proof not shipped. |
| Supersede stale rows in `99-consolidated.md`/Audit25 after post-fix changes. | `rg -n "api-10|threat-1|threat-3|P1-1|P1-2|open \\(later closed|wont-fix-pre-submission" .kiro/SUBMISSION-CHANGELOG.md .kiro/audits` | Matches show several rows still `open` while code/docs are fixed; status reconciliation not shipped. |
| Replace `Playwright not installed` not-checked reason with real screenshots/Lighthouse/axe run. | `rg -n "Playwright not installed|Lighthouse|axe|screenshots at 4 viewport" .kiro/audits .kiro/specs` | Old not-checked text remains; `npx playwright --version` proves current env has Playwright. |
| Harden secret scanner beyond TX-hash false-positive split. | `rg -n "check-secrets|Transaction-hash-shaped|secret-shaped|api-10|entropy|0x\\[a-fA-F0-9\\]\\{64\\}" .kiro/SUBMISSION-CHANGELOG.md .kiro/audits scripts tests README.md` | Current partial fix shipped; no entropy/allowlist hardening found. |

## WP-5 Re-audit appendix verification

ls output for the 4 files:

```text
ls: .kiro/audits/01-ui-pages.md: No such file or directory
ls: .kiro/audits/07-external-apis.md: No such file or directory
-rw-r--r--@ 1 usbdick  staff  9757 May 28 19:22 .kiro/audits/04-on-chain.md
-rw-r--r--@ 1 usbdick  staff  8086 May 28 19:24 .kiro/audits/11-secrets-and-supply.md
```

trading-unblock evidence:

> "Found that for cycles 113-122, every commit said `EXECUTED_SWAP` but the agent EOA never called any DEX router" -- `.kiro/audits/2026-05-28-trading-unblock.md:33-35`

> "Fix: keep `decisionTier` as-is ... introduce `executionStatus` in `run-cycle.js` ... rewrite `decisionTier='INTENT_SWAP_NO_EXEC'`" -- `.kiro/audits/2026-05-28-trading-unblock.md:94-103`

The audit trail is sufficient for the historical false-execution bug: it names the bad cycle range, root cause, TX evidence, code-level fix, backfill semantics, and proof-gating tests. Residual caveat: old `decisionTier` values remain in raw outcomes by design, so UI/API must keep using `_displayTier`/proof status.

## WP-6 Time log

start_time: 2026-05-31T20:15:09Z
end_time:   2026-05-31T20:31:57Z
elapsed:    16.8 minutes

## Adversarial probes (>=4)

A. Stale-numbers probe. README is explicitly snapshot-labelled at 2026-05-29: 158 total, 65 rejected, 41%; live `/api/decisions` is 202 total, 69 rejected, 34.2%. This exceeds 10% on total/block-rate but is not a lie because README labels it a snapshot and points to live endpoints. Live `/api/agent-card` is current: `totalDecisions:202`, `approvedExecutions:133`, `safetyBlockedActions:69`. Local `assets/agent-card.json` remains a stale snapshot and should not be treated as live.

B. Honest-defaults probe. Grep shows `EVOLVED_PROMPTS_ENABLED` default-off in `src/orchestrator/multiAgent.js`, `CHALLENGE_LIVE_ENABLED` default-off in `frontend/app/api/challenge/route.ts`, `HEARTBEAT_MODE_ENABLED` secret-gated/default-off in `src/orchestrator/heartbeatMode.js`, and `RWA_EXECUTE_ENABLED:"true"` only in `.github/workflows/agent-cycle.yml`. The execution flag is intentionally on for cron; no UI claim found that hides a default-off flag.

C. Phantom-yield probe. `frontend/app/page.tsx` labels mETH yield as either `mETH Yield - realised` or `mETH - projected/day`. `/api/yield-meth` returned `source:"cached:defillama+l1-rpc"`, `degraded:true`, `assetHealth:"ok"`, `apyPct:2.12371`, `passiveYieldUsd:0`, `apyProjectedDailyUsd:0.0007589`. The UI is honest enough because projected yield is labelled projected when realised yield is zero.

D. Bypass-the-validator probe. `scripts/run-cycle.js` demotes `EXECUTED_SWAP` without a DEX TX to `INTENT_SWAP_NO_EXEC`; `frontend/app/api/decisions/route.ts` derives `executedOnChain`; `outcomeTracker.js` proof-gates `_displayTier`. Tests passed: `decisionProofStatus`, `outcomesIntegrity`, and `decisionTier` (35 tests). No current path found that can display `EXECUTED_SWAP` without accepted proof.

E. Replay-anchor cryptography probe. `node scripts/verify-onchain-anchor.js 201` recomputed `manifestHash` and `combinedAnchor`, matched stored fields and on-chain bytes32, and printed `binding holds`.

F. Sourcify reality probe. Encoded Sourcify lookup returned 5 `perfect` contracts and Router `status:"false"`. Therefore the old "all six perfect" premise is false, but README/API agent-card now correctly say 5 of 6. Live Proof Explorer page still showed old `5 contracts - 4 Sourcify-verified` copy due Vercel cache/deploy lag.

G. Cron-honesty probe. GitHub API last 20 `agent-cycle.yml` schedule runs were all `completed/success`, spanning 2026-05-30T22:41:59Z to 2026-05-31T19:42:16Z. That is roughly 20/21 hourly coverage, but only about 20/42 half-hour slots. "Best-effort hourly" is defensible; "reliable every 30 min" is not.

H. Sanitisation probe. `sanitizeForPrompt()` recursively walks arrays/objects at unlimited depth and sanitizer tests pass (19 tests). `multiAgent.js` sanitizes structured signals, sentiment, Nansen sentiment, promptContext, portfolioContext, and whitelists Nansen top-buying symbols with `/^[A-Za-z0-9]{1,12}$/`. Caveat: cycle detection is intentionally absent, so callers must not pass cyclic objects.

## Findings

What this audit catches well:

- It caught real false-execution semantics (`EXECUTED_SWAP` without DEX TX) and preserved enough evidence to audit the backfill.
- It caught self-audit integrity gaps: two missing reports remain honestly listed, two regenerated reports exist.
- It has useful live-surface discipline: `/api/health`, `/api/decisions`, `/api/performance`, `/api/discipline`, replay anchors, and Sourcify reality all remain externally probeable.

What this audit misses or under-claims:

- Audit status rows are stale after later fixes. `threat-1`, `threat-3`, `P1-1`, `P1-2`, and `api-10` have code/docs evidence that diverges from `open` rows.
- The pushed Vercel cron bridge is not operational until Vercel envs are configured. Live endpoint returns 500.
- Live Proof Explorer still shows old Sourcify copy despite repo code being fixed, so production deploy/cache proof is missing.
- The secret scanner fix reduces false positives but weakens the old "any 0x64 hit is a failure" interpretation.
- The old not-checked reason "Playwright not installed" is now stale.

Specific concerns by row id:

- `cron-1` / `cron-4`: status can remain `wont-fix` only if docs keep saying best-effort hourly and `/api/health` remains the ground truth. The new Vercel bridge must be validated separately.
- `P0-4`: repo/docs now say 5/6 Sourcify, Sourcify live confirms 5/6, but Proof Explorer live page has not picked up the new copy.
- `api-10`: fixed for TX hashes, but a security scanner should still fail on high-confidence private keys, even when not named.
- `api-3`: strategy endpoint latency remains above the audit target.
- `threat-1`: code fix exists, but audit row state is stale; update consolidated report or add a supersession index.

## Recommendations (<=5)

1. Configure Vercel `CRON_SECRET` and `GH_DISPATCH_TOKEN`, then run an authorized probe proving `/api/cron/trigger-cycle` returns `cycle-fresh` or dispatches. Rationale: bridge code is useless while live endpoint returns 500. Estimate: 0.5-1h. Blast radius if sloppy: duplicate workflow_dispatch runs and nonce pressure. Not already shipped: WP-4 grep found code only; live probe refuted operational readiness.

2. Force/verify the Vercel deployment for commit `e6bc1b4` and re-probe `/proof-explorer` until it renders `6 contracts - 5/6 Sourcify-verified`. Rationale: live UI still contradicts current chain truth. Estimate: 0.5h. Blast radius if sloppy: stale public claim during judging. Not already shipped: WP-4 grep found helper code, live page still old/cached.

3. Add a post-fix supersession table for stale consolidated rows. Rationale: the audit trail is now better than the status table. Estimate: 1-2h. Blast radius if sloppy: reviewers trust stale `open`/`fixed` labels. Not already shipped: WP-4 grep shows stale rows remain.

4. Replace the Playwright/Lighthouse/axe not-checked excuse with a real run. Rationale: Playwright is installed now. Estimate: 1-3h. Blast radius if sloppy: screenshots can hide hydration/loading states if taken too early. Not already shipped: WP-4 grep shows old reason remains.

5. Improve `check-secrets.sh` with contextual allowlists or entropy rules so TX hashes do not fail, but unlabeled private-key-shaped hex still fails when high-confidence. Rationale: current fix trades false positives for a possible false negative. Estimate: 1-2h. Blast radius if sloppy: noisy CI or missed key. Not already shipped: WP-4 grep found no entropy/allowlist hardening.

## Verdict

SOLID-WITH-CAVEATS

Justification: `api-1`, `bridge-1`, and `bridge-3` fixed claims held under live reprobe, and the false `EXECUTED_SWAP` class is now guarded by proof-gated display/tests. The caveats are not cosmetic: `cron-1`/`cron-4` remain operationally weak until Vercel envs are configured, `P0-4` is correct in repo/API but stale on the live Proof Explorer page, and `api-10` needs stronger scanner semantics before I would call the security surface fully closed.

