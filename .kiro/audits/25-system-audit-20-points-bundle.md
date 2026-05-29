# Audit 25 — System Audit 20-Points Bundle (Export for External Review)

**Date packaged**: 2026-05-29
**Purpose**: Hand-off bundle for an external reviewer (Antigravity-
Gemini in this case) to spot-check our pre-submission system audit.
**Source spec**: `.kiro/specs/system-audit-pre-submission/`
**Source consolidated report**: `.kiro/audits/99-consolidated.md`

---

## What this bundle is

In May 2026 we ran a 20-point system audit against the deployed
TuringVault stack (live frontend, GitHub Actions cron, Mantle Mainnet
contracts, IPFS pins, AI pipeline, secrets, design/UX, supply chain,
threat model). It produced 13 surface reports + 1 consolidated report
that flagged 54 findings (15 P0, 20 P1, 17 P2, 2 P3). Most P0s closed,
the rest are either documented `wont-fix-pre-submission` (with reason)
or have a fix commit linked.

This file packages the **review-relevant** parts in one place so an
external reviewer doesn't need to walk the whole `.kiro/` tree:

1. The 15 requirements (R1–R15) of the audit (what we promised to check).
2. The 20-task implementation status with re-audit corrections.
3. The full consolidated findings table with current statuses.
4. What we deliberately did not check, with reasons.

What is NOT in this bundle:
- The 13 individual surface reports (large; available under
  `.kiro/audits/0X-*.md` if reviewer wants to drill into a specific
  finding).
- The post-audit fix commits' diffs (referenced by hash in the
  status column of the findings table).

---

## How to review

The external reviewer should:

1. Read **Section 1 (Requirements)** to understand what we set out
   to audit and the acceptance criteria.
2. Read **Section 2 (Tasks status)** and note: 4 of 20 task output
   files were not on disk despite being marked `[x]` in the original
   spec; we caught this in a re-audit pass on 2026-05-28 and either
   regenerated them (T6, T13) or deferred them with explicit
   acknowledgement (T3, T9). The honest tracking of this miss is part
   of the answer to "did you really audit yourselves" — yes, including
   the audit's own gaps.
3. Read **Section 3 (Consolidated findings)** as a single sortable
   table by severity → surface. Note the `status` column. P0s should
   all be `fixed` or `wont-fix-pre-submission` (with reason).
4. Use **Section 4 (Not checked)** to identify gaps the reviewer
   would attack first if they had time.

If the reviewer wants to verify any individual finding's
`status=fixed`, the workflow is:
- Find the commit hash in the row's notes (where present).
- Re-probe the surface (URL, contract address, file path) and confirm
  the new state.

---

## Section 1 — Requirements (R1–R15)

> Source: `.kiro/specs/system-audit-pre-submission/requirements.md`

### Glossary

- **Surface** — anything an external observer can interact with: a UI
  page, an API endpoint, a contract, a workflow, a state file, a
  document.
- **Claim** — text on a surface asserting reality ("running 24/7",
  "verified on Sourcify", "55% of NAV in RWA"). Each claim must be
  backed by an artifact.
- **Artifact** — a verifiable piece of evidence: TX hash, Sourcify
  URL, GitHub Actions run ID, IPFS CID, contract event log.
- **Honesty rule** — `.kiro/steering/no-lying-about-state.md`. The
  audit flags every violation, even if the engineering underneath
  is fine.

### R1 — Inventory of observable surfaces

WHEN the audit starts THEN a surface inventory file
`.kiro/audits/00-inventory.md` SHALL be created listing every
surface in scope, grouped by category (UI / API / cron / on-chain /
state-file / external-api / document) with URL/path, expected
freshness cadence, and consumer. THE inventory SHALL flag any
surface mentioned in README, pitch deck, or agent-card that does
NOT have a corresponding live URL.

### R2 — UI page-by-page audit

Every page reachable from the live frontend SHALL be fetched and
inspected against its claims. WHEN auditing a UI page THE auditor
SHALL fetch the rendered HTML (or hit the page's primary data
endpoint) and document what loaded successfully, what showed
empty/loading/error states, and what numeric values were displayed.
WHERE a page shows a "live" or "running" badge THE auditor SHALL
verify the underlying data is fresh per its cadence; stale data
with a "live" badge is a violation.

In scope: `/`, `/backtest`, `/challenge`, `/discipline`,
`/proof-explorer`, `/social`.

### R3 — API endpoint audit

Every Next.js API route SHALL be hit and its response shape +
freshness validated. WHEN an endpoint returns 5xx or shape mismatch
THIS SHALL be flagged as a P0 production-path bug. THE auditor
SHALL grep every captured response for secret patterns
(`PRIVATE_KEY`, `AWS_SECRET`, `PINATA_SECRET`, `NANSEN_API_KEY`,
`0x[a-f0-9]{64}` private-key shapes); any hit is a P0 security bug.

In scope: `/api/health`, `/api/decisions`, `/api/strategy`,
`/api/discipline`, `/api/elfa-snapshot`, `/api/backtest`,
`/api/agent-card`, `/api/market`, `/api/performance`,
`/api/proof-explorer`, `/api/reasoning`, `/api/reputation`,
`/api/evolution`, `/api/challenge`.

### R4 — Cron and scheduled-job audit

GitHub Actions workflows SHALL be audited against their actual run
history, not just their YAML. WHEN auditing `agent-cycle.yml` THE
auditor SHALL fetch the last 20 runs from the GitHub Actions API
and tabulate triggered_at, schedule_target, lag_minutes, status,
conclusion, duration_seconds. THE auditor SHALL identify any
schedule slot that did not fire within ±5 min of its target.

### R5 — On-chain audit

Every contract referenced in `deployments.json` SHALL be checked
on Mantle Mainnet. WHEN auditing a deployed contract THE auditor
SHALL verify bytecode is non-empty, the Sourcify match status, and
the Mantlescan verification status. WHEN auditing recent activity
THE auditor SHALL fetch the last 20 transactions from the agent EOA
and classify each. THE auditor SHALL compare the on-chain count of
decisions against `outcomes.json` length; any divergence > 1 SHALL
be flagged.

### R6 — State-file audit

Every JSON file under `data/` and `src/data/` that is read by an
API route or the cron SHALL be audited (last-modified, size, schema,
row count). WHEN a file is consumed by an API route THE auditor
SHALL verify the route's reader can parse the current shape (no
missing fields, no type drift). THE auditor SHALL spot-check 5
random rows in `outcomes.json` for obvious nonsense (NaN, future
timestamps, missing required fields).

### R7 — Agent pipeline data-flow audit

The multi-agent pipeline (GLM Analyst → Claude Validator → Gemini
Arbiter) SHALL be audited end-to-end on a single representative
cycle. THE auditor SHALL pick 1 recent EXECUTED_SWAP cycle and 1
recent BLOCKED_BY_LOW_CONFIDENCE cycle and produce a "data card"
showing the full data flow. THE auditor SHALL flag stale market
data (>60s old at decision time), templated/repetitive Analyst
reasoning, validator-as-rubber-stamp risk, silent Arbiter when it
should fire, and signals claimed in README that were not actually
present in the prompt context.

### R8 — External APIs audit

Every third-party dependency SHALL be verified live: Pinata, AWS
Bedrock, Vertex AI, Mantle RPC, CoinGecko, Elfa V2, Nansen. WHEN
a dependency is unreachable or returns auth errors THIS SHALL be
classified by impact: blocking / degrading / cosmetic. THE auditor
SHALL document the exact failure mode in code if a dependency is
down (does the cycle exit 0 quietly, throw, or fall back).

### R9 — Documents and claims audit

Every external-facing document SHALL be cross-checked against the
honesty rule: `README.md`, `docs/pitch-deck/index.html`,
`agent-card.json`, `agent-card-v2.json`, frontend home page text.
THE auditor SHALL extract every quantitative claim and link each
to a verifiable artifact. THE auditor SHALL flag claims where the
artifact is missing, contradicts the claim, or uses absolute
language ("always", "never", "100%") the data cannot support.

### R10 — GitHub Actions ↔ Vercel integration audit

Cron commits → Vercel deploys SHALL be audited end-to-end. THE
auditor SHALL pick the last 3 cron commits and verify a
corresponding Vercel deployment fired and went `READY`. THE auditor
SHALL diff the GitHub Actions secret list against the Vercel
project env list. THE auditor SHALL identify any cron-written file
that the frontend reads via filesystem AND verify the
`fetchFromGitHub` fallback path is wired (Vercel serverless has no
repo filesystem at runtime).

### R11 — Vercel deployment + runtime audit

THE auditor SHALL fetch the last 10 Vercel deployments via API and
tabulate state, build duration, commit SHA. THE auditor SHALL
inspect any `state=ERROR` deployment for the failing build step.
THE auditor SHALL fetch runtime logs for `/api/health` and
`/api/strategy` and grep for `error|throw|undefined|TypeError`;
any 5xx pattern is P0.

### R12 — Secrets + supply-chain audit

THE auditor SHALL run `git log --all -p` through a secret-pattern
scanner over the full repo history. Any hit is P0. THE auditor
SHALL verify `.gitignore` excludes `.env`, `*.env-*`,
`gemini-service-account.json`, etc. THE auditor SHALL list every
secret the cron uses and verify each one is present in BOTH GitHub
Actions repository secrets AND Vercel project env. THE auditor
SHALL re-run `npm audit --production` on root + on `frontend/`.

### R13 — Security architecture + threat model audit

THE auditor SHALL document the threat model for: anonymous web
visitor, hostile GitHub PR contributor, compromised Vercel env,
compromised GitHub Actions runner, compromised agent EOA private
key, hostile market data source. Specific checks: LLM prompt
injection, state-file tampering, Discipline-gate bypass, IPFS pin
tampering, owner-key concentration, frontend XSS. THE auditor
SHALL produce a 1-page summary suitable for the pitch deck.

### R14 — Design + UX audit

Every public page SHALL be evaluated against an explicit rubric
covering typography, spacing/grid, color, hierarchy,
microinteractions, motion, hero/wow moment, information design,
polish, accessibility. THE auditor SHALL benchmark against 3
reference dashboards (Linear, Vercel, Mercury or Stripe Atlas).
THE auditor SHALL produce a Design Playbook at
`docs/design-playbook.md`. THE auditor SHALL produce a "10 quick
wins" list — design changes that take < 30 min each.

### R15 — Consolidated findings + remediation plan

The audit SHALL produce a single consolidated report listing every
finding ordered by severity. EACH finding SHALL have id, severity
(P0/P1/P2/P3), surface, expected, actual, suspected root cause,
suggested fix, status (open/in-progress/fixed/wont-fix-pre-submission).
THE report SHALL list explicitly what was NOT audited and why.

### Success criteria (closure conditions)

The audit is done WHEN:

1. All surface reports under `.kiro/audits/0X-*.md` exist (one per
   R1–R14).
2. Each report follows the required output shape (scope, method,
   findings, not-checked).
3. The consolidated report `99-consolidated.md` lists every finding
   with severity and status.
4. Every P0 has either `status=fixed` (with linked commit) or
   `status=wont-fix-pre-submission` (with operator decision).
5. No surface in scope has been "audited" without an artifact of
   verification.
6. The audit reports survive in git history under `.kiro/audits/`.
7. The threat model from R13 is summarised in 1 page.
8. Every secret listed by the cron is present in both GitHub
   Actions secrets AND Vercel project env.
9. The Design Playbook from R14 exists with type scale, color
   tokens, spacing scale, motion tokens, and a "10 quick wins"
   backlog.

---

## Section 2 — Tasks status (with re-audit corrections)

> Source: `.kiro/specs/system-audit-pre-submission/tasks.md`

### Status header

**Status: SHIPPED** (with re-audit appendix 2026-05-28). All 20 task
boxes were ticked at original close. A re-audit pass on 2026-05-28
found that 4 of 20 task output files were never produced on disk
despite the `[x]` mark; this appendix preserves the original status
line for the audit trail and corrects with the truth below.

### Task → Output → Disk presence → Status today

| # | Task (1-line) | Required output file | Was on disk? | Status today |
|---|---|---|---|---|
| 1 | Audit infrastructure: probe scripts + audits/ dir | `scripts/audit/*` (10 scripts) | yes | shipped |
| 2 | R1 surface inventory | `.kiro/audits/00-inventory.md` | yes | shipped |
| 3 | R2 UI pages audit | `.kiro/audits/01-ui-pages.md` | **no** | **deferred to post-submission backlog**; UI pages partially covered by 13-design-ux.md |
| 4 | R3 API endpoint audit | `.kiro/audits/02-api-endpoints.md` | yes | shipped |
| 5 | R4 cron + GH Actions audit | `.kiro/audits/03-cron-and-actions.md` | yes | shipped |
| 6 | R5 on-chain audit | `.kiro/audits/04-on-chain.md` | **no → REGEN 2026-05-28** | shipped (regenerated) |
| 7 | R6 state-file audit | `.kiro/audits/05-state-files.md` | yes | shipped |
| 8 | R7 pipeline data-flow audit | `.kiro/audits/06-pipeline-data-flow.md` | yes | shipped |
| 9 | R8 external APIs audit | `.kiro/audits/07-external-apis.md` | **no** | **deferred to post-submission backlog**; external APIs partially covered in 06-pipeline-data-flow |
| 10 | R9 documents + claims audit | `.kiro/audits/08-documents-and-claims.md` | yes | shipped |
| 11 | R10 cron-vercel bridge audit | `.kiro/audits/09-cron-vercel-bridge.md` | yes | shipped |
| 12 | R11 Vercel runtime audit | `.kiro/audits/10-vercel-runtime.md` | yes | shipped |
| 13 | R12 secrets + supply-chain audit | `.kiro/audits/11-secrets-and-supply.md` | **no → REGEN 2026-05-28** | shipped (regenerated) |
| 14 | R13 threat model | `.kiro/audits/12-threat-model.md` | yes | shipped |
| 15 | R14 design + UX audit | `.kiro/audits/13-design-ux.md` | yes | shipped |
| 16 | R15 consolidated findings | `.kiro/audits/99-consolidated.md` | yes | shipped |
| 17 | Spec acceptance success criterion #4 (P0 disposition) | inline in 99-consolidated | yes | shipped (15/15 P0 closed) |
| 18 | Spec acceptance #6 (audit reports survive in git) | git history | yes | shipped |
| 19 | Spec acceptance #7 (threat model 1-page summary) | docs/ summary | yes | shipped |
| 20 | Spec acceptance #9 (Design Playbook + 10 quick wins) | docs/design-playbook.md | yes | shipped |

### Spec correction (2026-05-28)

The re-audit was triggered by an unrelated trigger — the operator
caught that the agent had not actually traded for a week despite
cron logs saying `EXECUTED_SWAP`. Investigation
(`.kiro/audits/2026-05-28-trading-unblock.md`) revealed: between
the original audit and the re-audit, the codebase had migrated
Step 4.7 to a hardcoded `mUSD ↔ mETH` swap that worked against
zero balance and silently advertised `EXECUTED_SWAP` for ten
consecutive cycles (113-122) without ever broadcasting a DEX TX.
This violates the workspace honesty rule §3 + §4. Fix landed in
commits `0b710de`, `8e4a335`, `aa0ebce`, `0f4c4e0`, `145388a`
(backfill), `74de441`. First post-fix autonomous trade: cron
cycle 123, three real DEX TXs at block 95926135-95926148.

The trading-unblock investigation is a strong-evidence example of
the audit working as intended even when its own checkboxes were
optimistic.

---

## Section 3 — Consolidated findings

> Source: `.kiro/audits/99-consolidated.md`

**Total findings**: 54 (15 P0 / 20 P1 / 17 P2 / 2 P3).

### Severity bar

```
P0  ████████████████  15
P1  ████████████████████  20
P2  █████████████████  17
P3  ██  2
```

### P0 — Critical (15 findings)

| # | ID | Surface | Expected | Actual | Root cause | Suggested fix | Status |
|---|---|---|---|---|---|---|---|
| 1 | api-1 | `/api/evolution` | 200 with snapshot | 500: viem `tokenURI(uint256)` reverted on Identity for tokenId=1 | Token #1 doesn't exist | Fetch tokenId=0 or guard | fixed |
| 2 | cron-1 | `agent-cycle.yml` | Hourly fire reliable | 37% slot success rate over 24h | GH Actions skips schedules under platform load | Reword README to "best-effort hourly" + audit-09 mitigations | wont-fix-pre-submission (platform limitation) |
| 3 | bridge-1 | `/api/decisions` | GitHub fallback when fs unavailable | Returns empty array silently | Missing `fetchFromGitHub` | Add fallback (same as `/api/health`) | fixed |
| 4 | bridge-2 | `/api/discipline` | GitHub fallback | Returns null silently | Missing `fetchFromGitHub` | Add fallback | fixed |
| 5 | bridge-3 | `/api/performance` | GitHub fallback | Returns null silently | Missing `fetchFromGitHub` | Add fallback | fixed |
| 6 | P0-1 | README + pitch-deck + agent-card | Consistent rejection rate | "57%" / "61.5%" / "65%" — three different numbers | Stale documents; no SoT | Harmonize from agent-card | fixed |
| 7 | P0-2 | README + pitch-deck + agent-card | Consistent RWA NAV | "55%+" / 55 / "74% NAV" — 19pp gap | Pitch deck not updated | Pick SoT and sync | fixed |
| 8 | P0-3 | README + pitch-deck | Consistent decision count | "104+" / "102+" | Pitch deck stale | Update pitch deck | fixed |
| 9 | P0-4 | pitch-deck slide 5 | Honest Sourcify status | "All contracts verified" drops Router caveat | Copy oversight | Change to "4/5 Sourcify-verified" | fixed (later 6/6 in audit 22) |
| 10 | P0-5 | README + agent-card | Consistent confidence gate | README "< 65%"; code 0.6 (60%) | Doc drift | Sync wording to 60% | fixed |
| 11 | P0-6 | README + agent-card | Consistent R:R ratio | README "≥ 2:1"; validator prompt "≥ 1.5:1" | Doc drift | Document actual enforced ratio | fixed |
| 12 | design-P0-1 | /backtest, /discipline, /social | Entry animations present | Zero motion — jarring vs animated home | Pages built without anim framework | Add `anim-fade-up` + stagger | fixed |
| 13 | design-P0-2 | /backtest equity curve | Interactive chart with hover tooltips | Static SVG path only | Built as static SVG | Add hover tooltips + crosshair | wont-fix-pre-submission (>30min) |
| 14 | design-P0-3 | /backtest, /discipline, /social, /challenge | Mobile responsive | Only home page has @media 768px | Sub-pages built without breakpoints | Add stack-to-1-col rules | fixed |
| 15 | cron-4 | health.lastCycleAge | < 65 min | 6406 sec = 106 min when probed | Direct consequence of cron-1 | Resolve via cron-1 | wont-fix-pre-submission (depends on cron-1) |

### P1 — Reliability (20 findings)

| # | ID | Surface | Expected | Actual | Root cause | Suggested fix | Status |
|---|---|---|---|---|---|---|---|
| 16 | api-2 | `/api/agent-card` | < 1s typical | 4550ms | Round-trips IPFS gateway every render | Cache resolved tokenURI for 60s | open |
| 17 | api-3 | `/api/strategy` | < 500ms | 2113ms | Recomputes NAV every call | Add 30s in-memory cache | open |
| 18 | api-4 | `/api/elfa-snapshot` | Useful sentiment field | `sentiment: null` always | Elfa V2 stripped raw text | Verify UI handles null | open |
| 19 | api-5 | `/api/strategy` | rwaAllocation.lastRebalanceAt fresh | null despite swap executed | Reader doesn't pick up latest RWA ts | Fix computation | open |
| 20 | api-6 | `/api/reputation` | normalizedScore reflects winRate | winRate 40.9, normalizedScore 100 | Normalizer caps at 100 | Recompute or expose both honestly | open |
| 21 | api-7 | `/api/reasoning` | Fresh timestamp | Matches cycle ~2h ago | Consequence of cron-1 | Resolved by cron fix | open |
| 22 | api-8 | `/api/performance` vs `/api/reputation` | Consistent winRate | 45.1% vs 40.9% | Two routes, two methods | Pick one + document | open |
| 23 | cron-3 | `agent-cycle.yml` run 15 | 60-100s duration | 340s | Bedrock latency or RPC retry | Add per-stage timing | open |
| 24 | pipe-1 | `outcomes.json → disagreementSignal` | Validator rejects some | `disagreementSignal=false` for ALL 20 most recent | Validator structurally approves | Lower threshold OR reframe as advisory | open |
| 25 | bridge-4 | `/api/strategy` (position_state) | GitHub fallback | Only outcomes.json has it | Incomplete fallback | Add raw.githubusercontent fallback | open |
| 26 | bridge-5 | `/api/reasoning` | GitHub fallback | Returns empty objects | Missing fetchFromGitHub | Add fallback for progress/evolution/intents | open |
| 27 | bridge-6 | `/api/agent-card` | GitHub fallback | Returns null | Missing fetchFromGitHub | Add fallback | open |
| 28 | threat-1 | Prompt construction | Token symbols sanitized before LLM | Raw interpolation | No sanitization layer | Add `stripControlChars` wrapper | open (later closed in commit `61abaae` per SUBMISSION-CHANGELOG) |
| 29 | threat-2 | CI workflow | State-file writes gated to cron-only | No CI gate | Missing CODEOWNERS + path rules | Add CODEOWNERS + CI step | open |
| 30 | threat-3 | Live deployment | CSP + X-Frame-Options + X-Content-Type-Options | Only HSTS | No `headers` config | Add security headers in next.config.js | open |
| 31 | P1-1 | README + pitch-deck | Gas claim backed by artifact | "$0.004 per tx" — no TX receipt | Never computed from actuals | Add gas-cost sample | open (later closed: `scripts/audit/gas-cost-sample.js` + `cycle-123.json`) |
| 32 | P1-2 | README | Nansen tool count verified | "36 analytics tools" — uncounted | Marketing copy | Count or remove number | open |
| 33 | P1-3 | pitch-deck | Unit test count current | "156/156" — may be stale | Static slide | Update count (now 266/266) | open |
| 34 | P1-4 | pitch-deck | External claims time-bounded | "$1.1M Merchant Moe pool" no date | Time-sensitive external data | Add "as of [date]" qualifier | open |
| 35 | P1-5 | pitch-deck | Spec count verified | "8 specs, >500 ACs" — uncounted | Marketing approximation | Count or soften | open |

### P2 — Code Quality / Polish (17 findings)

| # | ID | Surface | Expected | Actual | Root cause | Suggested fix | Status |
|---|---|---|---|---|---|---|---|
| 36 | api-9 | All API routes | Cache-Control validated | Not validated in initial run | Probe gap | HEAD probes in re-audit | open |
| 37 | api-10 | `check-secrets.sh` | Clean pattern match | False positive on TX hashes matching `0x[a-f0-9]{64}` | Over-broad regex | Tighten regex | open |
| 38 | SF-01 | `src/data/trajectories.json` | Updated each cycle | mtime 17.5h old | Writer may be disabled | Verify wiring; mark legacy if so | open |
| 39 | SF-02 | `src/data/grid_*.json` (4 files) | Updated when grid bot acts | All stale (17.5h) | Grid bot paused | Document as inactive subsystem | open |
| 40 | pipe-2 | `outcomes.json` #108-111 | Unique reasoning per cycle | Validator reasoning near-identical for HOLD | LLM produces structurally similar text | Expected; weakens claim but not incorrect | open |
| 41 | pipe-3 | IPFS pin `dataSources` | All signals listed | Elfa missing from hardcoded array | Static list not updated | Add "Elfa Social" to src/ipfs/storage.js | open |
| 42 | pipe-4 | README architecture | Listed signals match code | "Hyperliquid" listed but no direct integration | Labeling issue (Byreal aggregates) | Rename or footnote | open (closed: README footnote 1) |
| 43 | pipe-5 | `raw_model_outputs/` | Files exist per decision | Only files from 2026-05-26 testing | Raw capture disabled or ephemeral | Document IPFS pins as canonical | open (later closed: replay-manifests in audit 16) |
| 44 | bridge-7 | Vercel env vars | Feature flags in both environments | Only 2 env vars on Vercel vs 13 on GH Actions | Frontend reads state files, not secrets | Acceptable; document | accepted |
| 45 | vercel-1 | 5 API routes | `force-dynamic` declared | Missing on /api/backtest, elfa, evolution, market, reasoning | Routes added without standard header | Add `export const dynamic = "force-dynamic"` | open |
| 46 | vercel-2 | `/api/proof-explorer` | Explicit dynamic OR documented caching | Sets s-maxage=30 without route-level dynamic export | Intentional design | Document caching decision | open |
| 47 | threat-4 | Agent EOA | Multisig/timelock for contract admin | Single EOA owns all contracts | Hackathon expediency | Accepted; document multisig roadmap | accepted |
| 48 | threat-5 | Market data | Cross-validated price from 2+ oracles | Single CoinGecko source | Design simplicity | Low priority — discipline freshness gate limits exposure | open (later closed: multi-source feeds in audits 19/20) |
| 49 | threat-6 | Branch protection | Protected main with required reviews | No branch protection; direct push | Solo-dev workflow | Add post-submission | open |
| 50 | design-P2-1 | All pages | Formal 4px/8px spacing scale | Gap/padding varies arbitrarily | No design tokens | Define and apply | open |
| 51 | design-P2-2 | All pages | 3 text opacity levels | 6+ alpha variants of white | Organic growth | Consolidate to primary/secondary/muted | open |
| 52 | design-P2-3 | All pages | Page transitions on navigation | Hard cut between pages | No shared layout animation | Add Next.js layout transitions or framer-motion | open |

### P3 — Cosmetic (2 findings)

| # | ID | Surface | Issue | Status |
|---|---|---|---|---|
| 53 | api-11 | `/api/discipline` | tx_proof rollup works (already fixed in commit `0e307e4`) | fixed |
| 54 | SF-03 | `data/challenge-budget.json` | Date field shows yesterday — correct lazy daily reset behaviour | fixed (no action needed) |

### P0 disposition table (closure check)

Every P0 must have `status=fixed` or `status=wont-fix-pre-submission`
before close-out. Re-probe was performed 2026-05-28 against the live
deployment for every `fixed` row.

| # | ID | Status | Re-probe |
|---|---|---|---|
| 1 | api-1 | fixed | ✅ HTTP 200, valid data |
| 2 | cron-1 | wont-fix-pre-submission | N/A (platform limitation) |
| 3 | bridge-1 | fixed | ✅ 121 decisions returned |
| 4 | bridge-2 | fixed | ✅ dict with 5 keys |
| 5 | bridge-3 | fixed | ✅ dict with 5 keys |
| 6 | P0-1 | fixed | ✅ All docs say 61.5% |
| 7 | P0-2 | fixed | ✅ Harmonized to 55% |
| 8 | P0-3 | fixed | ✅ All say 104+ |
| 9 | P0-4 | fixed | ✅ "4/5 Sourcify-verified" |
| 10 | P0-5 | fixed | ✅ README says "< 60%" |
| 11 | P0-6 | fixed | ✅ No "2:1" in README |
| 12 | design-P0-1 | fixed | ✅ anim-fade-up deployed |
| 13 | design-P0-2 | wont-fix-pre-submission | N/A (>30 min; backlog) |
| 14 | design-P0-3 | fixed | ✅ 768px media queries deployed |
| 15 | cron-4 | wont-fix-pre-submission | N/A (depends on cron-1) |

### Absolute language requiring tightening (cross-doc)

| # | Original claim | Document | Suggested rewrite |
|---|---|---|---|
| A | "EVERY decision on-chain (impossible on L1)" | README | "every completed cycle's decision" + "cost-prohibitive on L1" |
| B | "Validator prompt is IMMUTABLE" | README | "not subject to auto-evolution (operator-only changes)" |
| C | "100%" parse success (×3 docs) | README, pitch-deck, agent-card | "100% over measured 24h window (N=X cycles)" |
| D | "Autonomous" / "every allocation" | README, pitch-deck | "Hourly autonomous cycle" / "every proposed allocation" |
| E | "consensusRate: 100%" | agent-card | "100% of cycles reached a consensus outcome (including REJECT)" |
| F | "all contracts verified" | pitch-deck | "4/5 contracts Sourcify-verified" (later 6/6 after audit 14) |

---

## Section 4 — What was NOT checked, with reasons

(Aggregated across all 13 surface reports.)

### From 00-inventory
- Lighthouse / axe scores — Playwright not installed in audit env.
- Bundle sizes — requires `next build` output dump.

### From 02-api-endpoints
- Per-route Cache-Control headers (HEAD probes) — deferred.
- Response schema diff vs frontend types — needs walking each
  consuming component.
- 5xx behaviour under sustained load — out of hackathon scope.

### From 03-cron-and-actions
- ci.yml run history — operator-visible separately.
- Per-step timing breakdown — requires modifying run-cycle.js.
- Secret list via GH API — `gh` CLI not installed.

### From 05-state-files
- `raw_model_outputs/` deep-dive — per-decision subdirectories.
- API route parse-error handling — covered in R3.
- Cross-validation cycle-history vs outcomes — different retention,
  not a discrepancy.

### From 06-pipeline-data-flow
- IPFS content integrity vs on-chain hash — contract stores reasoning
  directly; CID is content-addressed.
- Pinata pin persistence guarantee — both CIDs returned 200; cannot
  predict future expiry.
- Elfa signal freshness at decision time — cache wrapper without
  explicit TTL verification.
- Raw model output completeness for all 119 proposals — only
  testing-phase files exist.

### From 08-documents-and-claims
- Live on-chain event count vs claimed — could not query Mantle RPC
  from this environment.
- Actual current RWA NAV % — requires wallet balance query.
- Pinata pin list for prompt versions — requires `PINATA_JWT`.
- Nansen MCP tool count — would require reading full nansenMCP.js.
- Unit test count (156) — requires `npm test` run.
- Merchant Moe pool TVL — external DEX state, time-varying.

### From 09-cron-vercel-bridge
- Vercel build logs for cron deploys — no API access without
  team-level auth.
- GH Actions secret list via API — `gh` CLI not available.
- Vercel deploy hooks / webhook config — not exposed via public API.
- Historical cron commits older than last 10 deploys — older history
  not fetched.

### From 10-vercel-runtime
- Runtime logs (error grep) — requires log drain or `vercel logs` CLI.
- `/api/challenge` latency probe — requires POST + LLM call (cost).
- Build logs for ERROR deployments — no ERROR states found.
- Full bundle size analysis — requires `next build --profile`.

### From 12-threat-model
- Smart contract exploit paths (reentrancy, overflow) — covered by
  `docs/security-review-2026-05-27.md`.
- Vercel env variable listing (actual presence) — requires Vercel API
  token.
- Live token balances held by Router — requires multicall or
  Mantlescan scan.
- Rate limiting on API routes — no auth = no rate-limit concern.
- DNS/domain hijacking risk — out of scope.

### From 13-design-ux
- Actual screenshots at 4 viewport widths — Playwright not installed.
- Lighthouse scores — no Lighthouse CLI available.
- axe-core automated accessibility scan — no standalone runner.
- Mobile viewport rendering — cannot render at mobile widths from
  audit env.
- Cross-browser rendering — no BrowserStack available.

### Reports not produced (4 of 20 task outputs)

| Report | Covers | Reason |
|---|---|---|
| `01-ui-pages.md` | R2 per-page UI audit | Task marked complete but file not on disk; **deferred** to post-submission backlog (UI partially covered by `13-design-ux.md`) |
| `04-on-chain.md` | R5 contract bytecode + Sourcify + TX classification | Task marked complete but file not on disk; **regenerated 2026-05-28** |
| `07-external-apis.md` | R8 external dependency probes | Task marked complete but file not on disk; **deferred** to post-submission backlog (external APIs partially covered in `06-pipeline-data-flow.md`) |
| `11-secrets-and-supply.md` | R12 git history scan + npm audit + JWT expiry | Task marked complete but file not on disk; **regenerated 2026-05-28** |

---

## Section 5 — Out-of-scope (what the audit deliberately did not aim at)

- Penetration testing of smart contracts beyond the system-level
  threat model (deep contract-level audit lives in
  `docs/security-review-2026-05-27.md`).
- Performance / load testing of the frontend.
- Recursive audit of every npm dependency (only `npm audit` summary
  in scope; full SBOM / CVE walk in post-submission backlog).
- Re-deployment of contracts (any change touching deployed contracts
  is documented but not executed pre-submission).
- Live multi-agent challenge wiring (deferred per
  `.kiro/specs/human-vs-ai-challenge-v2`).
- Formal verification of contract invariants.

---

## Section 6 — Reviewer protocol (binding)

This section replaces the previous "checklist for spot-checking".
The previous version produced a one-minute review with a SOLID
verdict and three checkmarks — confirmation-shopping, not audit
work. This protocol is structured to make a one-minute pass
impossible.

### Calibration warning before you start

A previous reviewer of an earlier version of this bundle:

- Produced a SOLID verdict in under 60 seconds.
- Spot-checked 3 P0 findings (the most public, most-grepped ones)
  and zero P1/P2 findings.
- Did not open the underlying surface reports
  (`01..13-*.md`, `99-consolidated.md`,
  `2026-05-28-trading-unblock.md`).
- Recommended an action ("Audit the Prompt Anchor Hash") that was
  already shipped in audit 18 + `.github/workflows/replay-validator.yml`.

If your review pattern matches any bullet above, your conclusion is
not trusted regardless of which side it lands on. The same answer
becomes useful only when the work product behind it is visible.

This protocol is structured around producing that work product.

### Mandatory work products

Your output is judged by these artefacts existing in your response.
Skip any one of them and the review is rejected as incomplete.

**WP-1 — Source-document evidence.** You MUST produce inline
quotations from at least three of these files, with the exact
file path + line range cited next to each quotation:

  - `.kiro/audits/99-consolidated.md`
  - `.kiro/audits/2026-05-28-trading-unblock.md`
  - `.kiro/audits/06-pipeline-data-flow.md`
  - `.kiro/audits/12-threat-model.md`
  - `.kiro/audits/13-design-ux.md`
  - `.kiro/specs/system-audit-pre-submission/requirements.md`

The quotations must be material to a finding you discuss, not
ornamental.

**WP-2 — Live-surface probe log.** You MUST hit at least four of
the live URLs below from your own environment, paste the literal
HTTP status + a relevant fragment of the JSON response, and time-
stamp the probe in ISO format:

  - https://frontend-seven-beta-46.vercel.app/api/health
  - https://frontend-seven-beta-46.vercel.app/api/decisions
  - https://frontend-seven-beta-46.vercel.app/api/performance
  - https://frontend-seven-beta-46.vercel.app/api/discipline
  - https://frontend-seven-beta-46.vercel.app/api/yield-meth
  - https://frontend-seven-beta-46.vercel.app/replay
  - https://github.com/USBVadik/TuringVault-Core/actions/workflows/replay-validator.yml
  - https://sourcify.dev/server/check-by-addresses?chainIds=5000&addresses=0x6f862802e0d5463DF18d267e422347BeCacc28bD,0xC78119F3274B05046Ac7c38a14298a6cbD946e1a,0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6,0x0aeEd88959fCFC665284225dB93DED3e8A3Ff705,0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5,0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001

If a probe fails, paste the failure (DNS error, 5xx, timeout). A
network failure from your environment is acceptable; not running
the probe is not.

**WP-3 — Sample-and-verify quotas.** You MUST sample, not cherry-
pick:

  - At least **2 P0 findings marked `fixed`** — re-probe and paste
    the literal evidence (curl output, on-chain query result,
    grep snippet) that the fix holds today.
  - At least **2 P0 findings marked `wont-fix-pre-submission`** —
    quote the operator's reasoning verbatim and explain whether
    the trade-off is defensible at T-17 days.
  - At least **5 P1 findings, sampled across distinct surfaces** —
    for each, state whether the suggested fix is still appropriate,
    whether the row's status is up-to-date relative to the latest
    SUBMISSION-CHANGELOG entries, and one concrete way the row
    could be wrong.
  - At least **1 P2 finding** — same drill.
  - At least **1 finding from the "Not checked" section** — argue
    whether the stated reason is honest engineering ("Playwright
    not installed in audit env") or excuse-shaped.

Sampling rule: if you find yourself selecting only the cleanest /
most-public findings, re-roll. The audit's value is tested by what
it catches in the messy middle, not by what it gets right at the
edges.

**WP-4 — Already-shipped check.** Before recommending any new
work, you MUST grep `.kiro/SUBMISSION-CHANGELOG.md` and the
`.kiro/audits/` directory for keywords related to your
recommendation. If a previous audit (any of audits 16, 17, 18,
19, 20, 21, 22, 23, 24) already shipped what you are about to
suggest, the recommendation is auto-rejected. The reviewer of v1
of this bundle suggested "Audit the Prompt Anchor Hash" while
audit 18 + the daily Replay Validator CI workflow already
implement it. Don't repeat that.

For each recommendation in your output, paste the grep query you
ran and the (lack of) match.

**WP-5 — Re-audit appendix verification.** The spec was marked
`SHIPPED` while 4 of 20 task outputs were not on disk. You MUST:

  - Verify all four named files (`01-ui-pages.md`,
    `04-on-chain.md`, `07-external-apis.md`,
    `11-secrets-and-supply.md`) — paste `ls -la` output for each.
  - Open `2026-05-28-trading-unblock.md` and quote the cycle range
    where the bot silently advertised `EXECUTED_SWAP` without
    broadcasting a DEX TX. State whether the fix evidence (commit
    hashes, post-fix TX hashes) is sufficient for an audit trail.

**WP-6 — Time log.** Reviews under 15 minutes of real wall time
will be rejected automatically as "verdict-shopping". Stamp your
review with start_time and end_time at the top of your output (ISO
UTC). The tooling can run faster than you read; the bottleneck is
your skepticism, not your tool latency.

### Adversarial probes (must run at least four of these)

Each probe below targets a specific failure mode the audit could
have. Run at least four. If a probe surfaces a real issue, log it
even if it weakens the SOLID verdict.

A. **Stale-numbers probe.** Open the README claim grid and
   `assets/agent-card.json`. Compare every numeric claim
   (decision count, block rate, win rate, settled outcomes,
   cumulative PnL bps, cron uptime). Hit `/api/health` +
   `/api/performance` and confirm each claim is within 10%
   of the live value. Paste the diff table.

B. **Honest-defaults probe.** Grep `EVOLVED_PROMPTS_ENABLED`,
   `RWA_EXECUTE_ENABLED`, `CHALLENGE_LIVE_ENABLED`,
   `HEARTBEAT_MODE_ENABLED` across `src/` and `frontend/`.
   For each: is the default off (steering rule §5)? Is there a
   visible UI surface that lies about the flag's state when it
   is off? Paste each grep result.

C. **Phantom-yield probe.** Open `frontend/app/page.tsx` and
   confirm the new "Passive · LST" tile (audit 24) renders the
   word "projected" or "realised" honestly per the API response.
   Hit `/api/yield-meth` from your environment and paste the
   `source`, `degraded`, `assetHealth`, `apyPct` fields. Cross-
   check the UI label against the API state.

D. **Bypass-the-validator probe.** Read
   `src/orchestrator/multiAgent.js` and the heartbeat/mode files.
   Find every code path that produces `decisionTier =
   "EXECUTED_SWAP"`. Confirm at least one of `validator approve` OR
   the Heartbeat gate AND `directionalSwap.executed === true` is
   structurally required for that label. If you find a path that
   can stamp `EXECUTED_SWAP` without a real TX, that is a P0.
   The audit caught exactly this class of bug in cycles 113-122
   per `2026-05-28-trading-unblock.md`; verify the regression
   is locked out.

E. **Replay-anchor cryptography probe.** Pick one cycle ID from
   the most recent 10 manifests under
   `.kiro/audits/raw/replay-manifests/`. Recompute
   `combinedAnchor = keccak256(utf8(ipfsCid) ‖ manifestHash)`
   from the manifest fields. Compare against the bytes32 stored
   on-chain in `DecisionLog.txHash` for the matching decision
   ID (offset-tolerant lookup is documented in audit 18). State
   whether the binding holds. If your environment can't read
   Mantle, run `node scripts/verify-onchain-anchor.js <cycle-id>`
   and paste the output.

F. **Sourcify reality probe.** Hit the Sourcify URL above and
   parse the response. Confirm all six contract addresses return
   `status: perfect`. The README and pitch deck both claim 6/6
   `perfect` — fail this probe and that claim is at risk.

G. **Cron-honesty probe.** Hit
   `https://github.com/USBVadik/TuringVault-Core/actions/workflows/agent-cycle.yml`
   and tabulate the last 20 runs. State the actual slot success
   rate. Compare against the `wont-fix-pre-submission` reasoning
   for `cron-1`. The audit's claim is "best-effort hourly"; if
   the pattern is materially worse than that, flag it.

H. **Sanitisation probe.** Read
   `src/orchestrator/multiAgent.js` (or the prompt-builder it
   delegates to) and trace every external string that reaches
   an LLM prompt: Nansen `top_buying[].symbol`, Elfa mentions,
   CoinGecko ids. Confirm `sanitizeForPrompt()` (or equivalent)
   wraps each. Per `.kiro/SUBMISSION-CHANGELOG.md`, commit
   `61abaae` made this recursive at unlimited depth. Test that
   claim by reading the function and saying whether it actually
   handles nested objects.

### Required output format

Your review MUST be structured exactly as below. Anything else is
a process violation.

```
# External Review of TuringVault Pre-Submission Audit

start_time: <ISO UTC>
end_time:   <ISO UTC>
elapsed:    <minutes>
reviewer:   <model name + version>
environment: <where probes were run from>

## WP-1 Source-document evidence (3+ quotations)

> [quote 1, file path, line range]
…

## WP-2 Live-surface probe log (4+ probes)

| URL | HTTP status | timestamp | Notable fields |
| --- | --- | --- | --- |

## WP-3 Sample-and-verify

### P0 fixed (≥2)

| ID | re-probe command/url | output | verdict |

### P0 wont-fix (≥2)

| ID | reasoning verbatim | defensible at T-17? |

### P1 sample (≥5, distinct surfaces)

| ID | suggested fix still appropriate? | status up to date? | one way the row could be wrong |

### P2 sample (≥1)

### Not-checked sample (≥1)

## WP-4 Already-shipped checks (per recommendation)

| recommendation | grep query | match? |

## WP-5 Re-audit appendix verification

ls output for the 4 files:
…
trading-unblock evidence:
…

## WP-6 Time log

(restated)

## Adversarial probes (≥4)

A. … through H.

## Findings

What this audit catches well:
…

What this audit misses or under-claims:
…

Specific concerns by row id:
…

## Recommendations (≤5)

For each: rationale, hours, blast radius if shipped sloppily, and
proof that it is NOT already shipped.

## Verdict

SOLID / SOLID-WITH-CAVEATS / WEAK / DODGY

Justification — must reference at least three rows by id from your
sample.
```

### Anti-conclusion-shopping clauses (binding)

- A SOLID verdict is invalid unless WP-3 sampling and WP-4
  already-shipped checks are present in the output.
- A WEAK verdict requires you to name at least two specific row ids
  whose `status=fixed` claim you successfully refuted with evidence.
- A DODGY verdict requires evidence of a deliberate
  misrepresentation (claim X says Y, reality says Z, with both
  sources cited). It is not a dump for "I don't like this".
- If your review elapsed time is below 15 minutes, your verdict is
  rejected and you are asked to re-run.
- If you produce a recommendation that is already shipped (per
  WP-4), the entire output is rejected — not just that one
  recommendation. The bar is: read the changelog before you write.

---

## Notes for the reviewer

This bundle's value to a hackathon judge is the existence of the
trail more than any single finding. The protocol above exists
because a reviewer can produce a verdict that *sounds* like an
audit without doing audit work. The work product is what makes it
trustworthy.

If at any point you find yourself drafting a verdict before you
have the WP-1 through WP-6 artefacts in hand, stop and run the
probes first. The shape of the artefacts will tell you whether the
verdict you were about to write is supported by evidence or by
narrative.

If you encounter a finding row that conflicts with what
SUBMISSION-CHANGELOG.md says shipped, raise it as a P0 of its own
— the integrity of the audit framework matters more than any
individual fix status.

You are reviewing on behalf of an operator who cannot afford a
review that flatters the work and misses the gaps. Your job is to
find what we missed; everything you confirm is a footnote.
