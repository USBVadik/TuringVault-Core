# Audit style

This rule governs how I conduct any "audit", "review", "check the
system", "проверь" request. Workspace-level rule, always loaded.

## Core principle

**Audit the live system, not the code.** Code that compiles is not
the same as a system that works. UI claims that look honest in JSX
are not the same as UI claims that match reality on the deployed
site. A passing unit test is not the same as a working production
flow.

## Procedure for any audit request

1. **Never start by reading source code in isolation.** Start by
   inventorying observable surfaces: live URLs, deployed contracts,
   cron run history, state files on disk, external APIs.

2. **For every UI page mentioned in scope:** fetch it (curl, browser,
   API call) and read what it actually shows. Compare against what
   it claims (badges, stats, timestamps). Mismatches between visible
   text and underlying data are the highest-priority bugs.

3. **For every cron / scheduled job:** read the **actual run history**
   from the platform API (GitHub Actions API for `agent-cycle.yml`,
   etc.), not just the YAML. Look at last 20+ runs: did the schedule
   fire when it claimed, did it succeed, what was the lag.

4. **For every API endpoint in scope:** hit it. Validate the response
   shape against what the consumer (frontend) expects. Validate
   freshness (timestamps in response). Grep the response for any
   leaked secret patterns.

5. **For every state file on disk:** check last-modified time against
   expected cadence; check schema against the writer's code; spot
   any rows with "obviously stale" timestamps or nonsense values.

6. **For every external claim** (README, pitch deck, submission text,
   agent-card metadata): the claim must point to a verifiable artifact.
   "Live", "running", "verified" — each needs evidence. Either
   produce the evidence or label the claim "demo / simulated /
   paper-ready".

## Severity & ordering

End-to-end mismatches (UI shows X, backend writes Y) outrank
code-style issues every time. Report findings ordered by:

1. **User-visible truth violations** — UI lies about state.
2. **Production-path bugs** — money, security, data loss.
3. **Reliability** — cron skips, retry handling, error surfacing.
4. **Code quality** — only after the above are addressed.

## Don't do this

- Don't claim to have "audited" something I only read the source of.
  If I couldn't reach the live deployment from this environment,
  say so explicitly: "I read the code and X looks correct, but I
  could not verify against the live deployment because Y."
- Don't conflate "tests pass" with "feature works". Tests pass on
  unit fixtures; features work against real APIs and real users.
- Don't assume cron + frontend + backend are still in sync just
  because each of them looks fine in isolation. They drift, especially
  after refactors.

## Required output shape

Every audit produces a report with:

- **Scope**: what was audited (with timestamps of when each surface
  was checked).
- **Method per surface**: how the surface was verified (e.g.
  "Hit /api/health from this environment at 21:16 UTC, parsed JSON,
  checked lastCycleAge field"). This is auditable later.
- **Findings**: ordered by severity above. Each finding has: surface,
  expected, actual, suspected root cause, suggested fix.
- **Not checked**: what I deliberately or accidentally skipped, with
  reason. This prevents false confidence.

## When honesty rule applies

`.kiro/steering/no-lying-about-state.md` is binding for any UI claim.
An audit must explicitly flag any place that violates it, even if
the underlying engineering is fine.
