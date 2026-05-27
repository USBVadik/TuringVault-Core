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

### R10: GitHub Actions ↔ Vercel integration audit

The cron pipeline (`agent-cycle.yml`) writes state files back to
`main`; Vercel auto-deploys on push and the frontend reads those
files. This integration SHALL be audited end-to-end.

**Acceptance criteria:**

- WHEN auditing the integration THE auditor SHALL pick the last
  3 cron commits and verify a corresponding Vercel deployment fired
  and went `READY`.
- THE auditor SHALL diff the GitHub Actions secret list against the
  Vercel project environment variable list and flag any drift.
  Examples of must-be-everywhere flags: `RWA_EXECUTE_ENABLED`,
  `CHALLENGE_LIVE_ENABLED`, `AGENT_RUN_MODE`,
  `MANTLE_RPC_URL`.
- THE auditor SHALL identify any cron-written file that the
  frontend reads via filesystem (`fs.readFileSync` in API routes)
  AND verify the `fetchFromGitHub` fallback path is wired (Vercel
  serverless functions don't have access to the repo's `data/`
  directory at runtime — they fall back to GitHub raw).
- THE auditor SHALL check Vercel git-integration filters: cron
  commits use author `TuringVault Cron <cron@turingvault.ai>`;
  Vercel by default deploys all main pushes, but if "Ignored Build
  Step" or commit-author filters are set, cron-only commits could
  be silently skipped.
- WHEN any cron commit fails to trigger a Vercel deploy THIS SHALL
  be flagged as P0 (UI is showing data that's older than what's
  in `main`).

### R11: Vercel deployment + runtime audit

The Vercel project itself SHALL be audited for build failures,
function runtime errors, bundle size regressions, and edge/runtime
mismatches.

**Acceptance criteria:**

- THE auditor SHALL fetch the last 10 Vercel deployments via
  `vercel.com/api/v6/deployments` and tabulate: state (READY /
  ERROR / BUILDING), build duration, commit SHA, deploy URL.
- THE auditor SHALL inspect any deployment with state=ERROR for the
  failing build step + first error line; record under findings.
- THE auditor SHALL fetch runtime logs for `/api/health` and
  `/api/strategy` and grep for `error|throw|undefined|TypeError`;
  any 5xx pattern is P0.
- THE auditor SHALL flag any function whose `maxDuration` is set
  but the typical execution exceeds 80% of that budget (cold start
  + slow upstream = future timeouts).
- THE auditor SHALL spot-check the deployed frontend bundle for
  accidental inclusion of backend modules (any import of `ethers`
  inside a static page increases bundle by ~200KB).
- THE auditor SHALL verify response cache-control headers match
  the dynamic-mode declarations in route files (e.g.
  `dynamic = "force-dynamic"` should not be cached at the edge).

### R12: Secrets + supply-chain audit

Beyond `npm audit`, the auditor SHALL verify no secret material has
ever been committed and that runtime secret handling is correct.

**Acceptance criteria:**

- THE auditor SHALL run `git log --all -p` through a secret-pattern
  scanner (gitleaks-style regex set: AWS keys, private keys, JWT,
  API key formats) on the full repo history. Any hit is P0.
- THE auditor SHALL verify `.gitignore` excludes `.env`,
  `*.env-*`, `gemini-service-account.json`, raw model outputs, and
  any artifact that historically held credentials.
- THE auditor SHALL list every secret the cron uses (env names
  only) and verify each one is present in BOTH GitHub Actions
  repository secrets AND Vercel project env (where the frontend
  needs it).
- THE auditor SHALL re-run `npm audit --production` on root + on
  `frontend/`; document moderate+ findings with mitigation.
- THE auditor SHALL grep all API routes + frontend code for direct
  `process.env.X` access where `X` is a secret name and verify the
  value is never echoed back in any HTTP response (this re-runs
  the secret-leak check from R3 but at the source-code level).
- THE auditor SHALL check the Pinata JWT expiry; any secret with
  < 30 days remaining is flagged.

### R13: Security architecture + threat model audit

The agent + frontend + on-chain stack SHALL be reviewed against a
short threat model. Goes beyond contract-level review (already in
`docs/security-review-2026-05-27.md`) to cover system-wide attack
surface.

**Acceptance criteria:**

- THE auditor SHALL document the threat model under a fixed set
  of actors: anonymous web visitor, hostile GitHub PR contributor,
  compromised Vercel env, compromised GitHub Actions runner,
  compromised agent EOA private key, hostile market data source
  (Elfa/Nansen returning crafted payloads).
- FOR EACH actor THE auditor SHALL list: what they can do, what
  guards prevent the worst outcome, what mitigations are missing.
- THE auditor SHALL specifically check:
  - **LLM prompt injection** — does any user-controlled or
    third-party API field flow into the analyst/validator prompt
    without sanitization? (e.g. token names from CoinGecko, social
    posts from Elfa).
  - **State-file tampering** — can a malicious PR mutate
    `outcomes.json` or `discipline-history.json` to make stats
    look better? Are these files signed / verified?
  - **Discipline-gate bypass** — is there any code path that
    records a cycle as ACCEPTED without the gate running?
  - **IPFS pin tampering** — is the on-chain reasoning hash a hash
    of the IPFS content, or just the CID? (CID is content-
    addressable so this is usually fine, but worth confirming.)
  - **Owner key concentration** — every contract is `onlyOwner`;
    if the agent EOA is compromised, the attacker can drain. List
    the realistic value at risk and any operational mitigations
    (cold key rotation, multisig roadmap).
  - **Frontend XSS** — does any `/api/*` response render unsafe
    HTML? Is there a CSP header? Are reasoning fields rendered
    via React (safe) or `dangerouslySetInnerHTML` (unsafe)?
- THE auditor SHALL produce a 1-page summary suitable for the
  pitch deck: "Threat model + mitigations" in plain language.

### R14: Design + UX audit

Judges judge with their eyes for the first 30 seconds. The product
is information-dense by design, but information density without
craft reads as "engineer dashboard", not "product". This audit
identifies the specific gap between the current visual language and
a reference-class web app (Linear, Vercel, Stripe Atlas, Mercury,
Arc, Raycast).

**Acceptance criteria:**

- THE auditor SHALL evaluate every public page against an explicit
  rubric covering: typography system, spacing/grid, color,
  hierarchy, microinteractions, motion, hero/wow moment,
  information design, polish details, accessibility.
- THE auditor SHALL inspect 8 concrete dimensions per page:
  1. **Typography** — is there a defined type scale (sizes follow
     a ratio like 1.25 or 1.333), are body/display fonts paired
     intentionally, are tabular figures used for stat values, do
     numerical changes "jump" or animate, is letter-spacing
     adjusted for headlines vs body, are font-weights varied
     (300/500/700) vs everything-400?
  2. **Spacing & grid** — is there a consistent 4px or 8px base
     unit, are gutters between cards equal, is content max-width
     constrained on ultra-wide screens, is vertical rhythm
     preserved across sections, is whitespace generous around
     hero elements?
  3. **Color & tone** — is the palette limited to 3-5 colors with
     a 50-900 tonal scale per color, is dark mode layered grays
     (not pure black on pure black), is the accent color used
     sparingly (no more than 1-2 elements per viewport), do
     contrast ratios pass WCAG AA?
  4. **Hierarchy & focus** — does each section have ONE clear
     focal point, is there an obvious reading order (F-pattern
     or Z-pattern), are stat cards equal weight or is the most
     important one larger, are CTA buttons distinct from
     navigation?
  5. **Microinteractions** — do interactive elements have
     hover/focus/active states that move/glow/shift, are focus
     rings visible (a11y) but stylish, do clicks feel responsive
     (< 100 ms feedback), do empty/loading/error states have
     personality (not just "—" or spinner)?
  6. **Motion & animation** — are page transitions present (vs
     instant snap), do numbers count up on first render
     (CountUp pattern), is there scroll-triggered reveal for
     content below the fold, are easings smooth (cubic-bezier,
     not linear), do animations stagger (cascade) vs all at once,
     is motion respectful of prefers-reduced-motion?
  7. **Hero & wow** — does the landing page have a hero moment
     in the first 800 px (animated gradient mesh, particle
     system, 3D element, generative art, motion graphic, or
     a single bold animated stat)? Is there ANYTHING memorable a
     judge would screenshot?
  8. **Information design** — are stats shown WITH context
     (vs benchmark, sparkline, %change, conditional color), do
     charts tell a story (not just data dumps), is conditional
     formatting used (green for good, red for bad, amber for
     warning), are numbers humanized (1.2K vs 1234)?
- THE auditor SHALL benchmark against 3 reference dashboards
  (Linear's home, Vercel's overview, Mercury or Stripe Atlas)
  and produce a side-by-side observation: what they do that we
  don't.
- THE auditor SHALL run the live site through Lighthouse and
  axe-core; capture Performance / Accessibility / Best Practices
  / SEO scores and any a11y violations. Accessibility issues
  drag perceived professionalism even when invisible.
- THE auditor SHALL produce a **Design Playbook** at
  `docs/design-playbook.md` capturing:
  - Type scale + font pairing decision.
  - Color tokens + semantic mapping (success/warning/danger,
    surface/elevated/border).
  - Spacing scale.
  - Motion easing + duration tokens.
  - Component states standard (default/hover/focus/active/
    disabled).
- THE auditor SHALL produce a "10 quick wins" list — design
  changes that take < 30 min each and visibly improve perceived
  craft (e.g. font swap, accent color tweak, motion on stat
  numbers, hero gradient mesh, focus ring polish).

### R15: Consolidated findings + remediation plan

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

1. All surface-area reports under `.kiro/audits/0X-*.md` exist
   (one per requirement R1–R14).
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
7. The threat model from R13 is summarised in 1 page and ready
   to drop into the pitch deck if useful.
8. Every secret listed by the cron is present in both GitHub
   Actions secrets AND Vercel project env (R10, R12).
9. The Design Playbook from R14 exists at `docs/design-playbook.md`
   with type scale, color tokens, spacing scale, motion tokens,
   and a "10 quick wins" backlog applied or queued.

## Out of Scope

- Penetration testing of the smart contracts beyond the system-level
  threat model (deep contract-level audit is in
  `docs/security-review-2026-05-27.md`).
- Performance / load testing of the frontend.
- Recursive audit of every npm dependency (only `npm audit` summary
  is in scope; full SBOM / CVE walk is post-submission backlog).
- Re-deployment of contracts (any change touching deployed contracts
  is documented but not executed pre-submission).
- Live multi-agent challenge wiring (deferred per
  `.kiro/specs/human-vs-ai-challenge-v2`).
- Formal verification of contract invariants.
