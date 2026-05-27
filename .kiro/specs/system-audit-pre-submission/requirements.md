# Requirements Document

## Introduction

End-to-end audit of TuringVault before the Mantle Turing Test 2026
submission deadline (2026-06-15 18:59 UTC). Goal is to find every
surface where the **deployed reality** diverges from **claimed
behavior** — UI states, README claims, pitch deck assertions,
agent-card metadata — and fix the high-severity divergences
before judges see them.

Past sessions found bugs in /backtest, /social, /discipline (TX Proof
gate), the cron schedule, and the Live Agent Pipeline staleness — all
**user-visible** before they were code-visible. This spec exists so the
agent (Kiro) audits live behaviour first, source second, every time.

The audit produces a tree of inspection reports under `.kiro/audits/`
that survive the spec — so anyone (judge, future me, contributor) can
read what was checked and when.

## Glossary

- **Surface** — anything an external observer can interact with: a UI
  page, an API endpoint, a contract, a workflow, a state file, a
  document.
- **Claim** — text on a surface asserting reality ("running 24/7",
  "verified on Sourcify", "55% of NAV in RWA"). Each claim must be
  backed by an artifact.
- **Artifact** — a verifiable piece of evidence: TX hash on Mantlescan,
  Sourcify URL, GitHub Actions run ID, IPFS CID, contract event log.
- **Honesty rule** — `.kiro/steering/no-lying-about-state.md`. The audit
  flags every violation, even if the engineering underneath is fine.

## Requirements

### R1: Inventory of observable surfaces

The audit MUST start with a complete inventory of every surface
that contributes to a judge's experience.

**Acceptance criteria:**

- WHEN the audit starts THEN a surface inventory file
  `.kiro/audits/00-inventory.md` SHALL be created listing every
  surface in scope, grouped by category (UI / API / cron / on-chain /
  state-file / external-api / document).
- THE inventory SHALL include the URL or path of each surface, the
  expected freshness cadence (real-time / hourly / on-demand /
  immutable), and the consumer that depends on the surface.
- THE inventory SHALL flag any surface mentioned in README, pitch deck,
  or agent-card that does NOT have a corresponding live URL.

### R2: UI page-by-page audit

Every page reachable from the live frontend
(`https://frontend-seven-beta-46.vercel.app`) SHALL be fetched and
inspected against its claims.

**Acceptance criteria:**

- WHEN auditing a UI page THE auditor SHALL fetch the rendered HTML
  (or hit the page's primary data endpoint) and document what loaded
  successfully, what showed empty / loading / error states, and what
  numeric values were displayed.
- WHEN a page shows a numeric metric THE auditor SHALL trace that
  metric to its source (contract read, state file, computed) and
  verify the source agrees with what the page shows.
- WHERE a page shows a "live" or "running" badge THE auditor SHALL
  verify the underlying data is fresh per its cadence; stale data
  with a "live" badge is a violation.
- IF a page returns 5xx, blank, or "no data" while the README claims
  it works, THIS SHALL be flagged as a P0 finding.

In scope (final list lives in `00-inventory.md`):

- `/` (landing dashboard)
- `/backtest`
- `/challenge`
- `/discipline`
- `/proof-explorer`
- `/social`

### R3: API endpoint audit

Every Next.js API route SHALL be hit and its response shape +
freshness validated.

**Acceptance criteria:**

- WHEN auditing an endpoint THE auditor SHALL hit it from this
  environment and capture: HTTP status, response shape, presence of
  required fields, freshness of timestamps, response size, and
  Cache-Control / dynamic mode.
- WHERE the endpoint is a frontend data source THE auditor SHALL
  diff the response shape against the consuming component's expected
  shape (TypeScript types or destructuring).
- WHEN an endpoint returns 5xx or shape mismatch THIS SHALL be flagged
  as a P0 production-path bug.
- THE auditor SHALL grep every captured response for secret patterns
  (`PRIVATE_KEY`, `AWS_SECRET`, `PINATA_SECRET`, `NANSEN_API_KEY`,
  `0x[a-f0-9]{64}` private-key shapes); any hit is a P0 security bug.

In scope (final list lives in `00-inventory.md`):

- `/api/health`, `/api/decisions`, `/api/strategy`, `/api/discipline`,
  `/api/elfa-snapshot`, `/api/backtest`, `/api/agent-card`,
  `/api/market`, `/api/performance`, `/api/proof-explorer`,
  `/api/reasoning`, `/api/reputation`, `/api/evolution`,
  `/api/challenge`.

### R4: Cron and scheduled-job audit

GitHub Actions workflows that drive the agent SHALL be audited
against their actual run history, not just their YAML.

**Acceptance criteria:**

- WHEN auditing `agent-cycle.yml` THE auditor SHALL fetch the last
  20 runs from the GitHub Actions API and tabulate: triggered_at,
  schedule_target, lag_minutes, status, conclusion, duration_seconds.
- THE auditor SHALL identify any schedule slot that did not fire
  within ±5 min of its target (skipped or delayed).
- WHEN auditing `ci.yml` THE auditor SHALL inspect the latest 5 runs
  for failing jobs and capture the failing job names + first error.
- THE auditor SHALL verify the secrets the workflow expects are set
  (by listing them via the GH API; values are NEVER fetched).

### R5: On-chain audit

Every contract referenced in `deployments.json` SHALL be checked
on Mantle Mainnet.

**Acceptance criteria:**

- WHEN auditing a deployed contract THE auditor SHALL verify
  bytecode at the address is non-empty (eth_getCode), the Sourcify
  match status, and the Mantlescan verification status.
- WHEN auditing recent activity THE auditor SHALL fetch the last
  20 transactions from the agent EOA and classify each: cycle
  attestation / RWA swap / directional swap / other.
- THE auditor SHALL compare the on-chain count of decisions against
  `outcomes.json` length; any divergence > 1 SHALL be flagged.
- WHERE README or agent-card claims a verification status THIS
  status SHALL match the live blockchain reality.

### R6: State-file audit

Every JSON file under `data/` and `src/data/` that is read by an
API route or the cron SHALL be audited.

**Acceptance criteria:**

- THE auditor SHALL list every file under `data/` and `src/data/`
  with: last-modified, size, schema (top-level keys), row count if
  applicable.
- WHEN a file is consumed by an API route THE auditor SHALL verify
  the route's reader can parse the current shape (no missing fields,
  no type drift).
- WHERE the file is updated by the cron THE auditor SHALL verify the
  last-modified timestamp aligns with the cron cadence.
- THE auditor SHALL spot-check 5 random rows in `outcomes.json` for
  obvious nonsense (NaN, future timestamps, missing required fields).

### R7: Agent pipeline data-flow audit

The multi-agent pipeline (GLM Analyst → Claude Validator → Gemini
Arbiter) SHALL be audited end-to-end on a single representative
cycle, focusing on the data each agent receives and the consistency
of their conclusions.

**Acceptance criteria:**

- THE auditor SHALL pick 1 recent EXECUTED_SWAP cycle and 1 recent
  BLOCKED_BY_LOW_CONFIDENCE cycle from `cycle-history.json`.
- FOR EACH chosen cycle THE auditor SHALL produce a "data card"
  showing: market context delivered to the Analyst (regime, prices,
  signals freshness, social signals, on-chain Nansen data), the
  Analyst's verdict (action, confidence, reasoning hash), the
  Validator's response (confidence, risk score, agreement status),
  the Arbiter's verdict (when invoked), and the final discipline
  verdict.
- THE auditor SHALL flag any case where:
  - Stale market data (> 60 s old at decision time) was used.
  - The Analyst's reasoning is templated / repetitive across cycles.
  - The Validator never disagrees (validator-as-rubber-stamp risk).
  - The Arbiter is silent when it should fire (per
    `geminiArbiter.js` rules).
  - A signal claimed in README (Elfa social, Nansen smart-money,
    regime) was not actually present in the prompt context.

### R8: External APIs audit

Every third-party dependency the agent or frontend calls SHALL be
verified live.

**Acceptance criteria:**

- THE auditor SHALL hit each external API with a minimal probe:
  Pinata (key-status), AWS Bedrock (list-models), Vertex AI
  (project-existence), Mantle RPC (block-number), CoinGecko
  (prices), Elfa V2 (ping), Nansen (key-status).
- WHEN a dependency is unreachable or returns auth errors THIS
  SHALL be classified by impact: blocking (cycle cannot run) /
  degrading (graceful fallback) / cosmetic.
- THE auditor SHALL document the exact failure mode in code if a
  dependency is down (does the cycle exit 0 quietly, throw, or
  fall back to a default).

### R9: Documents and claims audit

Every external-facing document SHALL be cross-checked against the
honesty rule.

**Acceptance criteria:**

- IN scope: `README.md`, `docs/pitch-deck/index.html` (and PDF),
  `agent-card.json`, `agent-card-v2.json`, `SUBMISSION.md` (if
  present), and any text on the live frontend home page.
- THE auditor SHALL extract every quantitative claim ("55%+ of NAV",
  "61% rejection rate", "verified on Sourcify", "running 24/7") and
  link each to a verifiable artifact.
- THE auditor SHALL flag any claim where:
  - The artifact is missing.
  - The artifact contradicts the claim (e.g. "verified" but
    Mantlescan returns "not verified").
  - The claim uses absolute language ("always", "never", "100%")
    that the data cannot fully support.

### R10: Consolidated findings + remediation plan

The audit SHALL produce a single consolidated report listing every
finding, ordered by severity, with a remediation status for each.

**Acceptance criteria:**

- THE final report SHALL live at `.kiro/audits/99-consolidated.md`.
- EACH finding SHALL have: id, severity (P0 / P1 / P2 / P3), surface,
  expected, actual, suspected root cause, suggested fix, status
  (open / in-progress / fixed / wont-fix-pre-submission).
- THE report SHALL list explicitly what was NOT audited and why,
  to prevent false confidence.
- WHEN the spec is closed THE auditor SHALL have status=fixed or
  wont-fix-pre-submission for every P0; P1+ may remain open if
  outside the hackathon window.

## Success Criteria

The audit is done WHEN:

1. All 10 surface-area reports under `.kiro/audits/0X-*.md` exist.
2. Each report follows the required output shape from
   `audit-style.md` (scope, method, findings, not-checked).
3. The consolidated report `99-consolidated.md` lists every finding
   with severity and status.
4. Every P0 finding has either status=fixed (with linked commit) or
   status=wont-fix-pre-submission (with operator decision recorded).
5. No surface in scope has been "audited" without an artifact of
   verification (a fetched response, a captured run ID, etc.).
6. The audit reports survive in git history under `.kiro/audits/`
   so judges can see the rigor.

## Out of Scope

- Penetration testing of the smart contracts (already covered in
  `docs/security-review-2026-05-27.md`).
- Performance / load testing of the frontend.
- Recursive audit of every npm dependency (only `npm audit` summary
  is in scope).
- Re-deployment of contracts (any change touching deployed contracts
  is documented but not executed pre-submission).
- Live multi-agent challenge wiring (deferred per
  `.kiro/specs/human-vs-ai-challenge-v2`).
