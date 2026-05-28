# Implementation Plan: System Audit Pre-Submission

## Status: SHIPPED

All 20 tasks complete. Consolidated report at `.kiro/audits/99-consolidated.md`.
Remaining open findings converted to backlog spec at `.kiro/specs/post-submission-backlog/`.
Closed 2026-05-28.

## Overview

Sequenced execution plan for `design.md`. Each task produces ONE
Markdown report or ONE script. Tasks are independent enough to be
run separately on different days; the consolidated report (T15) is
the only task that depends on all the others.

**Each task has its own context budget.** Don't try to run more than
one audit task per Kiro session if the session is also doing other
work — context drift is the enemy of accurate audits.

## Tasks

- [x] 1. Audit infrastructure: probe scripts + audits/ directory
    - Refs: design §C1, §C4
    - Outputs:
        - `.kiro/audits/.gitkeep` (NEW)
        - `scripts/audit/fetch-frontend.sh` (NEW)
        - `scripts/audit/gh-actions-runs.sh` (NEW)
        - `scripts/audit/chain-probe.js` (NEW)
        - `scripts/audit/check-secrets.sh` (NEW)
        - `scripts/audit/probe-external.sh` (NEW)
        - `scripts/audit/vercel-deployments.sh` (NEW)
        - `scripts/audit/env-drift.sh` (NEW)
        - `scripts/audit/git-history-secrets.sh` (NEW)
        - `scripts/audit/screenshot-pages.js` (NEW — Playwright)
        - `scripts/audit/lighthouse-pages.sh` (NEW)
    - Acceptance:
        - All 10 scripts exist and are executable.
        - `fetch-frontend.sh` saves raw responses under
          `.kiro/audits/raw/<surface>.html|json`.
        - `gh-actions-runs.sh` accepts a workflow filename and
          prints a Markdown table of last N runs.
        - `vercel-deployments.sh` lists last N deployments via
          Vercel API + state per commit.
        - `env-drift.sh` produces a Markdown table comparing GH
          Actions secret names vs Vercel project env names; never
          prints values.
        - `git-history-secrets.sh` runs gitleaks-style regex set
          over `git log --all -p`.
        - `check-secrets.sh` greps a directory for secret patterns
          and exits non-zero on any hit.
        - `probe-external.sh` hits 7 external APIs with --silent
          and prints status only.
        - `screenshot-pages.js` captures every public page at
          1440 / 1024 / 768 / 375 widths via Playwright; saves to
          `.kiro/audits/raw/screens/<width>/<page>.png`.
        - `lighthouse-pages.sh` runs Lighthouse on each page +
          axe-core via Playwright; emits JSON under
          `.kiro/audits/raw/lighthouse/`.
        - shellcheck clean for shell scripts; `node --check` clean
          for JS.

- [x] 2. R1: Surface inventory
    - Refs: R1, design §C1
    - Output: `.kiro/audits/00-inventory.md` (NEW)
    - Method:
        - Walk `frontend/app/*/page.tsx` and `frontend/app/api/*/route.ts`
          to enumerate UI pages + API routes.
        - Walk `.github/workflows/*.yml` for cron jobs.
        - Walk `deployments.json` for contracts.
        - Walk `data/` and `src/data/` for state files.
        - Grep README + pitch deck for external URLs they claim.
    - Acceptance:
        - All 6 categories covered (UI / API / cron / on-chain /
          state / external).
        - Every surface has: name, URL/path, expected freshness,
          consumer, source-of-truth file.
        - Cross-check: any surface mentioned in README that isn't
          live → flagged in "orphaned claims" table.

- [x] 3. R2: UI pages audit
    - Refs: R2
    - Output: `.kiro/audits/01-ui-pages.md` (NEW)
    - Method (per page in inventory):
        - `curl -L -s -o raw/<page>.html <URL>`
        - Record HTTP status, render time, size.
        - Open the saved HTML, identify visible numeric metrics
          and "live" / "running" badges.
        - For each metric: trace to its API endpoint, cross-check
          freshness.
    - Acceptance:
        - All 6 pages probed at least once with timestamp.
        - Per-page table with: status, key metrics, source of
          each metric, mismatch if any.
        - At least one verbatim quoted UI claim per page that the
          auditor verified against backend reality.

- [x] 4. R3: API endpoints audit
    - Refs: R3
    - Output: `.kiro/audits/02-api-endpoints.md` (NEW)
    - Method (per endpoint in inventory):
        - Hit endpoint, capture status + JSON response.
        - Diff response shape against the consuming component's
          destructuring (grep `frontend/app/**/*.tsx` for usage).
        - Run `check-secrets.sh` on every captured response.
        - Validate timestamps in response (parse, compare to now,
          classify as fresh / stale / missing).
    - Acceptance:
        - All 14 endpoints listed in R3 captured + analyzed.
        - Findings table includes any 5xx, any shape drift, any
          stale timestamps, any secret hits.
        - Raw responses preserved under `.kiro/audits/raw/api/`.

- [x] 5. R4: Cron + GitHub Actions audit
    - Refs: R4
    - Output: `.kiro/audits/03-cron-and-actions.md` (NEW)
    - Method:
        - `gh-actions-runs.sh agent-cycle.yml 20` → run history table.
        - `gh-actions-runs.sh ci.yml 5` → CI history table.
        - For agent-cycle: compute lag from each schedule slot;
          flag any > 5 min late or skipped.
        - List required secrets (names only) via GH API.
    - Acceptance:
        - Run-history table for both workflows present, with
          triggered_at + lag_minutes columns.
        - At least one root-cause hypothesis for any consistent
          lag pattern (e.g. ":00 peak load").
        - Secrets list verified (names only, never values).
        - If any P0 reliability issue (cron skipped > 2 hours) →
          flagged with suggested fix.

- [x] 6. R5: On-chain audit
    - Refs: R5
    - Output: `.kiro/audits/04-on-chain.md` (NEW)
    - Method:
        - For each address in `deployments.json`: eth_getCode,
          Sourcify check, Mantlescan API check (getabi).
        - For agent EOA `0xDC783CDBfA993f3FC299460627b204E83bf4fb5a`:
          fetch last 20 TXs from Mantle RPC, classify by destination
          contract.
        - Compare on-chain TuringVaultValidationRegistry total
          proposals vs `outcomes.json` length.
    - Acceptance:
        - Per-contract table: address, bytecode_present,
          sourcify_status, mantlescan_status.
        - Recent TX classification table with 20 rows.
        - Drift between on-chain + outcomes.json reported as a
          single integer with sign.
        - README claim "Sourcify-verified" cross-referenced with
          actual status; mismatch = P0.

- [x] 7. R6: State files audit
    - Refs: R6
    - Output: `.kiro/audits/05-state-files.md` (NEW)
    - Method:
        - `find data src/data -name '*.json' -exec stat ...` →
          last-modified table.
        - For each file: parse top-level keys, count rows.
        - Pick 5 random rows from `outcomes.json`, validate fields
          against the writer schema in
          `src/orchestrator/outcomeTracker.js`.
        - For files updated by cron: verify last-modified is within
          expected cadence (e.g. `last-cycle-summary.json` should
          be hourly).
    - Acceptance:
        - All JSON files under `data/` and `src/data/` listed.
        - Schema-vs-reality check for at least 3 highest-traffic
          files (outcomes, threshold_state, parse_metrics).
        - Stale-file findings: any file with mtime older than its
          expected cadence + 2x buffer is P1.

- [x] 8. R7: Pipeline data-flow audit
    - Refs: R7
    - Output: `.kiro/audits/06-pipeline-data-flow.md` (NEW)
    - Method:
        - Pick 1 EXECUTED_SWAP cycle and 1 BLOCKED_BY_LOW_CONFIDENCE
          cycle from `cycle-history.json` (last 7 days preferred).
        - For each:
            - Pull outcomes.json entry → extract IPFS CID.
            - Fetch IPFS pin content via Pinata gateway.
            - Pull on-chain proposal data via
              `TuringVaultValidationRegistry.proposals(id)`.
            - Look at `raw_model_outputs/<decisionId>/` if exists.
        - Build a "data card" Markdown table for each cycle.
        - Run 5 quality checks:
            - was market data fresh at decision time?
            - is analyst reasoning unique vs last 5 cycles?
            - did validator disagree at least once in the same
              window?
            - did arbiter fire when expected?
            - were claimed signals (Elfa, Nansen, regime) actually
              in the prompt context?
    - Acceptance:
        - 2 data cards produced, each with all 5 layers (analyst,
          validator, arbiter, discipline, ipfs link).
        - 5 quality checks reported per cycle with PASS/FAIL/N-A.
        - Any "Validator never disagreed in last 20 cycles"
          finding is P1.
        - Any signal that README claims is in the pipeline but is
          NOT in the prompt context is P0 honesty violation.

- [x] 9. R8: External APIs audit
    - Refs: R8
    - Output: `.kiro/audits/07-external-apis.md` (NEW)
    - Method:
        - `probe-external.sh` runs each probe with timeout 10s.
        - For each: status, latency, auth-error vs network-error
          classification.
        - Trace consumer code: how does the cycle behave when this
          dep is down? (does it throw, fall back, log silently?)
    - Acceptance:
        - 6 external deps probed (Pinata, Bedrock, Vertex, Mantle
          RPC, CoinGecko, Elfa, Nansen).
        - Failure-mode classification per dep: blocking /
          degrading / cosmetic.
        - Any "blocking" failure mode that doesn't surface to UI
          is a P0 honesty risk.

- [x] 10. R9: Documents + claims audit
    - Refs: R9
    - Output: `.kiro/audits/08-documents-and-claims.md` (NEW)
    - Method:
        - Extract every quantitative or absolute claim from
          README.md, `docs/pitch-deck/index.html`, agent-card JSONs.
        - Build a claim → artifact table.
        - For each claim: hyperlink the verifying artifact OR
          mark "no artifact" / "contradicts artifact".
    - Acceptance:
        - At least 30 distinct claims extracted (README typically
          has more).
        - 100% of claims have a status: verified / no-artifact /
          contradicts.
        - Claims using "always", "never", "100%", "running 24/7"
          flagged for tightening regardless of artifact.

- [x] 11. R10: GitHub Actions ↔ Vercel bridge audit
    - Refs: R10
    - Output: `.kiro/audits/09-cron-vercel-bridge.md` (NEW)
    - Method:
        - Pull last 3 cron commits from `git log --author="TuringVault Cron"`.
        - For each: query Vercel API for the deployment matching that
          commit SHA. Capture state, build duration, deploy URL.
        - Run `env-drift.sh` to diff GH Actions secret list vs
          Vercel project env list. Look specifically for feature
          flags that should be in both
          (`RWA_EXECUTE_ENABLED`, `CHALLENGE_LIVE_ENABLED`,
          `AGENT_RUN_MODE`, `MANTLE_RPC_URL`).
        - Walk every `frontend/app/api/*/route.ts` for
          `fs.readFileSync` calls and verify each has a
          `fetchFromGitHub` fallback.
        - Read Vercel "Ignored Build Step" / git filter config.
    - Acceptance:
        - Per-cron-commit row: commit SHA, Vercel deploy state,
          deployed URL, time-from-push-to-ready.
        - Env drift table: secret name, in-GH-Actions, in-Vercel,
          severity if diverged.
        - Filesystem-fallback table: route, has-fs-read, has-GH-
          fallback, gap (if any) → P0 finding.
        - Any cron commit without a corresponding READY Vercel
          deploy is P0.

- [x] 12. R11: Vercel deployment + runtime audit
    - Refs: R11
    - Output: `.kiro/audits/10-vercel-runtime.md` (NEW)
    - Method:
        - Hit Vercel API for last 10 deployments, tabulate state
          + duration + commit.
        - For any ERROR state: pull build logs, capture failing
          step + first error line.
        - Hit `/api/health`, `/api/strategy`, `/api/decisions`,
          `/api/discipline` 5x each, capture 95p latency and any
          5xx.
        - Walk every API route file for `maxDuration` declarations;
          compare against typical observed latency from the probes.
        - For each `frontend/app/page.tsx` and any client
          component: grep for backend module imports
          (`require('ethers')`, `from 'ethers'` outside `/lib/`)
          that bloat the bundle.
        - Inspect Cache-Control headers on dynamic routes;
          confirm they match `dynamic = "force-dynamic"`.
    - Acceptance:
        - Deployment health table for last 10 deploys with
          state distribution.
        - Any function with p95 latency > 80% of `maxDuration` is
          P1.
        - Any route returning 5xx or wrong cache headers is P0.
        - Bundle-bloat findings recorded but only P2 unless they
          cause a build failure.

- [x] 13. R12: Secrets + supply-chain audit
    - Refs: R12
    - Output: `.kiro/audits/11-secrets-and-supply.md` (NEW)
    - Method:
        - `git-history-secrets.sh` runs gitleaks-style regex set
          over `git log --all -p`. Patterns: AWS access key,
          AWS secret, EVM private key, JWT, Pinata JWT, generic
          long-token. Any hit dumps the commit + line.
        - Verify `.gitignore` excludes `.env`, `*.env-*`,
          `gemini-service-account.json`, `raw_model_outputs/`,
          `.kiro/audits/raw/` (since raw/ may capture API responses).
        - Run `npm audit --production` on root and `frontend/`,
          summarize moderate+ findings with affected packages.
        - Grep all source for `process.env.<SECRET_NAME>` reads;
          for each, trace whether the value is ever logged or
          included in an HTTP response. Cross-check against the
          `/api/health` route's documented "no secrets ever"
          guarantee.
        - Decode and log expiry of `PINATA_JWT` (jwt.decode);
          flag if < 30 days remain.
        - Cross-reference with R10 env drift table.
    - Acceptance:
        - History scan: ZERO hits OR every hit explained
          (e.g. test fixtures, well-known dummy keys).
        - npm audit table per workspace.
        - Secret-flow trace table: env name, read sites,
          response paths reached, leak risk.
        - JWT expiry status.
        - Any active credential found in git history is P0
          (rotate + force-push if needed).

- [x] 14. R13: Security architecture + threat model
    - Refs: R13
    - Output: `.kiro/audits/12-threat-model.md` (NEW)
    - Method:
        - Define actor list: anonymous web visitor, hostile PR
          author, compromised Vercel env, compromised GH Actions
          runner, compromised agent EOA, hostile Elfa/Nansen
          payload, hostile market data (CoinGecko spoof).
        - For each actor: capability table (what they can do),
          guard table (what stops the worst case), gap list
          (where mitigations are missing).
        - Specifically test:
            - Inject a hostile token symbol via market data into
              the Analyst prompt — does normalization strip
              control chars / prompt-injection markers?
            - Construct a PR that flips a stat in `outcomes.json`
              — is there a CI gate that rejects writes by
              non-cron authors?
            - Re-read `disciplineLayer.js` for any code path that
              records ACCEPTED without running gates.
            - Verify on-chain `reasoningHash` is keccak of the
              IPFS pin content (or just the CID, which is fine
              because CID is content-addressed).
            - List every `dangerouslySetInnerHTML` in the
              frontend (must be zero outside markdown rendering).
            - Check CSP / X-Frame-Options / X-Content-Type-Options
              on the live deployment.
            - Estimate worst-case loss if the agent EOA private
              key leaks (current wallet balance + drainable
              positions).
        - Produce a 1-page summary suitable for the pitch deck.
    - Acceptance:
        - Actor × capability × guard × gap matrix complete.
        - 7 specific tests above each have a verdict
          (PASS / FAIL / N-A / NEEDS-FIX).
        - Worst-case-loss estimate is honest: USD figure with
          source of truth.
        - 1-page summary ready (markdown, not slides).
        - Any FAIL on the 7 tests is P0 unless it's a known
          accepted risk (custodial EOA pattern is accepted).

- [x] 15. R14: Design + UX audit
    - Refs: R14
    - Outputs:
        - `.kiro/audits/13-design-ux.md` (NEW)
        - `docs/design-playbook.md` (NEW)
    - Method:
        - Take screenshots of every public page at viewport widths
          1440, 1024, 768, 375. Save under `.kiro/audits/raw/screens/`.
        - For each page run the 8-dimension rubric from R14:
          typography, spacing/grid, color, hierarchy,
          microinteractions, motion, hero/wow, information design.
          Score 1-5 per dimension with verbatim observations
          ("the stat numbers don't animate on first paint",
          "card padding is 12px on left, 16px on right",
          "accent purple appears 14 times in viewport, dilutes
          its meaning").
        - Run Lighthouse on each page (Performance / Accessibility
          / Best Practices / SEO) — store JSON outputs.
        - Run axe-core via playwright on each page; capture
          serious + critical violations.
        - Side-by-side comparison: pick 3 reference dashboards
          (Linear's home, Vercel's overview, Mercury or Stripe
          Atlas) — what specific design moves do they make that
          we don't (e.g. "Linear uses 14px body with -0.011em
          letter-spacing, we use 14px with 0", "Vercel has
          gradient mesh hero, we have static card grid").
        - Produce the Design Playbook with:
            - Type scale (e.g. 12 / 14 / 16 / 20 / 24 / 32 / 48 px,
              1.25 ratio).
            - Font pairing: display vs body (e.g. "Geist Sans
              variable for everything, weights 400/500/700,
              tabular-nums for stats, JetBrains Mono for hashes").
            - Color tokens: primary brand, semantic
              (success/warning/danger/info), surface levels (bg /
              card / elevated / border), accent (one, used
              sparingly).
            - Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64
              px (or 4px base if Tailwind default).
            - Motion tokens: duration (150 / 250 / 400 ms),
              easing (cubic-bezier(0.16, 1, 0.3, 1) for entries,
              cubic-bezier(0.4, 0, 0.2, 1) for exits), stagger
              delay 30-50 ms.
            - Component states standard (default / hover / focus
              / active / disabled / loading).
        - Compile a "10 quick wins" list of < 30 min changes.
          Examples:
            - Swap default font to Geist Sans variable.
            - Add `tabular-nums` class to all stat values.
            - Add CountUp animation to hero stats on first paint.
            - Replace static bg-black with subtle radial gradient
              mesh.
            - Add focus-visible rings with brand-tinted outline.
            - Stagger card entry animation on landing.
            - Replace `—` empty state with line-art illustration
              or playful copy.
            - Add gradient on top border of "live" cards (only
              when actually live).
            - Tabular figures + monospace for hashes.
            - Round corners consistently (one radius value
              repeated, not 4 different ones).
    - Acceptance:
        - 13-design-ux.md has the 8-dimension scorecard for
          every public page.
        - Lighthouse + axe results stored as raw artifacts.
        - 3-way comparison with reference dashboards produced
          (specific observations, not vibes).
        - design-playbook.md exists with all 5 token sets.
        - "10 quick wins" backlog included; each item has
          estimated time + expected visual impact.
        - Any P0 finding is a true UX blocker (broken state, a11y
          critical, content unreadable). Most design findings are
          P1 / P2.

- [x] 16. R15: Consolidated findings + remediation
    - Refs: R15
    - Output: `.kiro/audits/99-consolidated.md` (NEW)
    - Method:
        - Aggregate every finding from reports 01–13.
        - Sort by severity, then by surface.
        - Add `status` column; default open.
        - For trivial / inline fixes already done, set status=fixed
          and link the commit.
        - Build "Not checked" section by aggregating each report's
          not-checked block.
    - Acceptance:
        - All findings from 01–13 present (no orphans).
        - Severity distribution histogram at top.
        - Every P0 has either status=fixed or
          wont-fix-pre-submission with operator-recorded reason.
        - "Not checked" section is non-empty (false-confidence
          guard).

- [x] 17. Apply trivial inline fixes
    - Refs: R15, design §C6
    - Action:
        - For each finding in 99-consolidated.md flagged "trivial"
          (one-line copy fix, env var rename, missing tooltip,
          design quick win), apply the fix and link the commit
          hash in the findings table.
        - Anything touching deployed contracts → DO NOT apply,
          mark wont-fix-pre-submission with reason.
        - Anything that needs > 30 min to investigate → leave open
          and convert to a backlog spec.
    - Acceptance:
        - At least all P0 trivial fixes applied (or confirmed
          non-trivial → wont-fix).
        - At least 5 of the "10 quick wins" from R14 landed.
        - No commit references audit but breaks a passing test
          (`npm test` clean after).

- [x] 18. Re-run probes after fixes
    - Refs: R15
    - Action:
        - Re-run `fetch-frontend.sh`, `vercel-deployments.sh`,
          screenshot capture, Lighthouse — sanity-check the fixes
          worked end-to-end.
        - Update findings statuses in 99-consolidated.md.
    - Acceptance:
        - Every status=fixed finding has a re-probe artifact under
          `.kiro/audits/raw/post-fix/`.
        - Lighthouse scores improved or held steady on every page.
        - Any fix that didn't actually move the metric → status
          rolled back to open with note.

- [x] 19. Convert remaining open findings into a backlog spec
    - Refs: R15
    - Action:
        - For all P1+ findings still open, generate a single
          "post-submission backlog" entry under
          `.kiro/specs/post-submission-backlog/` with a short
          requirements doc and a flat task list.
    - Acceptance:
        - Backlog spec exists with one requirement per finding
          group (UI / cron / pipeline / docs / vercel / security
          / design).
        - Each backlog task has refs back to the audit finding ID
          for traceability.

- [x] 20. Final audit close-out
    - Refs: R15, all
    - Action:
        - Add Status: SHIPPED block to this tasks.md.
        - Tick all 9 success criteria in requirements.md.
        - Commit the audits/ tree as one final
          `chore(audit): system audit pre-submission complete`
          commit.
    - Acceptance:
        - All `[ ]` boxes are `[x]`.
        - Single closing commit references the audit spec
          directory.
        - Operator (you) reads the consolidated report and signs
          off in chat.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": [1],
      "rationale": "Probe scripts must exist before any audit task can capture artifacts deterministically."
    },
    {
      "wave": 2,
      "tasks": [2],
      "rationale": "Inventory feeds every other surface audit. Without 00-inventory the rest don't have a defined scope."
    },
    {
      "wave": 3,
      "tasks": [3, 4, 5, 6, 7, 9, 13],
      "rationale": "Seven independent surface audits — UI, API, cron, on-chain, state, external, secrets/supply. They don't share output files and can run in parallel sessions. Secrets/supply (T13) is read-only over the repo + git history so it's also independent."
    },
    {
      "wave": 4,
      "tasks": [8, 11, 12],
      "rationale": "Pipeline data-flow (T8) consumes API + state + on-chain audits. Cron-Vercel bridge (T11) consumes cron audit + API audit (filesystem fallback check). Vercel runtime (T12) consumes API endpoint observations + bridge findings."
    },
    {
      "wave": 5,
      "tasks": [14, 15],
      "rationale": "Threat model audit (T14) aggregates findings from pipeline, secrets, on-chain, and the bridge. Design+UX audit (T15) consumes the live UI captured in wave 3. They share no output files."
    },
    {
      "wave": 6,
      "tasks": [10],
      "rationale": "Documents + claims audit cross-references every surface audit's findings, including design language consistency between README/pitch-deck/live UI."
    },
    {
      "wave": 7,
      "tasks": [16],
      "rationale": "Consolidation requires every prior audit (01-13) to be written."
    },
    {
      "wave": 8,
      "tasks": [17],
      "rationale": "Inline fixes happen after the consolidated finding list is stable. Includes the design quick wins from R14."
    },
    {
      "wave": 9,
      "tasks": [18],
      "rationale": "Post-fix re-probes verify the fixes landed end-to-end; re-run Lighthouse to confirm design fixes didn't regress anything."
    },
    {
      "wave": 10,
      "tasks": [19],
      "rationale": "Backlog spec collects whatever survived the fix wave."
    },
    {
      "wave": 11,
      "tasks": [20],
      "rationale": "Spec close-out only after backlog hand-off is clean."
    }
  ]
}
```

## Notes

### Why one report per task (not one mega-doc)

If the audit lives in one giant Markdown, my context fills up and I
miss things. One file per concern keeps each session focused. The
consolidated report (T11) is allowed to be long because by then the
hard thinking is done and the work is mechanical aggregation.

### Why probe scripts (T1) come before any audit

The first time you said "audit", I read code. Without scripts, every
audit starts ad-hoc. With scripts, "re-run audit on 2026-06-10"
becomes a 5 min job that produces a diffable artifact, not a
2-hour code-reading session. Scripts also force me to capture raw
output instead of trusting my memory.

### Bounded context per session

Treat T3–T9 as separate Kiro sessions if at all possible. Mixing two
audit tasks in one session is exactly how the Discipline-Layer
roll-up bug got missed last time — I had too much in scope and lost
the thread.

### What this audit does NOT replace

- The security review (`docs/security-review-2026-05-27.md`) — already
  done, not redoing.
- The hackathon submission text — that's a separate spec.
- Operator judgment on pivots — if the audit finds a fundamental
  problem, this spec doesn't decide what to do; it surfaces it.
