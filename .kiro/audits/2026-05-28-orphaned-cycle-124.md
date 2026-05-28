# 2026-05-28 — Orphaned cycle 124 (post-fix observation)

| Meta | Value |
|------|-------|
| Auditor | Kiro (operator-supervised) |
| Date | 2026-05-28 |
| Trigger | After Заход 1 + Заход 2 of the re-audit, the operator pinged "go". Re-checking cycle persistence revealed an orphan that the previous trading-unblock investigation missed. |
| Severity | P1 — burns ~120K gas to no end and creates a phantom on-chain ValidationRegistry entry, but does not affect operator funds or the trading happy-path. |
| Status | Open. Not fixed today. Detector (`74de441`) catches the post-Step-6 orphan, but this orphan died before Step 6 — detector won't see it. |

---

## What happened

ValidationRegistry shows `totalProposals = 127` (latest proposalId = 126). In `src/data/outcomes.json` and in cron commit history we see decisionIds 119, 120, 121, 122, 123, 125, 126. **Decisions 124 is missing from both.**

On-chain trace for the agent EOA shows the following sequence between cycle 123's successful completion and cycle 125's start:

| Timestamp (UTC) | Block | Method | Comment |
|---|---:|---|---|
| 15:36:48 | 95926148 | swapExactTokensForTokens | cycle 123 directional leg 2 |
| 15:36:58 | 95926153 | setAgentURI | cycle 123 finalize |
| **15:40:10** | **95926249** | **submitProposal** | **orphan cycle 124 starts** |
| **15:40:16** | **95926252** | **validateProposal** | **orphan cycle 124 second TX** |
| (gap — no logDecision, no submitFeedback, no swap, no setAgentURI) | | | |
| 17:03:02 | 95928735 | submitProposal | cycle 125 (proposalId=125) |

Decoded `submitProposal` data for the orphan:

- action: `swap`
- targetAsset: `mUSD`
- confidence: 6800 (0.68)
- reasoning: starts with "TREND_DOWN regime (60% confidence) with bearish signal consensus and negative yield spread (-1%) favors defensive rotation to mUSD. ETH price at $1987.70 is down 4.09% with RSI falling to 36.7, approa…"

This is materially **different** from cycle 123's reasoning ("ETH down 4.18% with RSI at 35.9 approaching oversold"). So cycle 124 is a real, fresh agent decision — not a duplicate retry of 123.

## What we know about its lifecycle

- **No GH Actions run** of `agent-cycle.yml` corresponds to the 15:40 timestamp. The last run before then was `id=26584834030` (workflow_dispatch by operator at 15:34:57Z, completed 15:37:03Z). The next run was `id=26589613368` (schedule, started 17:02:03Z).
- **No cron commit** for cycle 124 exists in `git log --author='TuringVault Cron'`.
- **No `data/last-cycle-summary.json`** entry survived (it was overwritten by cycle 125 at 17:03 and again by cycle 126 at 17:30).
- **No outcomes.json row** exists.
- The two on-chain TXs (`0xbe48531a…` submit + the validate at +6 sec) confirm only that:
  - `multiAgentLoop.js` made it past Step 4's TX1 (submitProposal) and TX2 (validateProposal).
  - It either threw or was killed before Step 4's TX3 (logDecision), TX4 (submitFeedback), or any subsequent step.

## Suspected origin

`workflow_dispatch` at 15:34 was triggered by the operator. The `agent-cycle.yml` workflow has cron schedules at minute `:17` and `:47`. GH Actions schedule slot `15:47` is the closest plausible auto-trigger; it could have run early or have been picked up by the runner at 15:40 and silently skipped to log. We cannot confirm because no run object exists in the API.

Alternatives:
- **Stale local process**: I had started `node scripts/run-cycle.js` locally and stopped it via `control_bash_process stop` before it broadcast TXs (or so I thought). If it had time to make TX1 + TX2 and then was interrupted, this is what we'd see. Nonce of the orphan submitProposal is 660; my probe-execute-live at 14:53 used nonce 656 (4 attestations not relevant here). Need to compare to runner state to confirm.
- **GH Actions runner that ghosted**: a scheduled run that started but failed to produce a run record in the API (very rare but possible during platform incidents).

The TX nonce (660) and the local time of my interrupt are the cheapest disambiguation. I lean toward operator-side: I issued `control_bash_process stop` for terminal 29 about 3 minutes after starting `node scripts/run-cycle.js`. SIGTERM during async waits for `tx2.wait()` would let TX1 + TX2 settle but kill the process before TX3 was even called. The nonce 660 trail is consistent: my own shell, not GH Actions.

**If this hypothesis is correct, this is operator-induced, not a code bug.** It would explain why no scheduled run record exists for 15:40.

## Why the persistence detector did NOT catch it

Detector (`74de441`) is wired into `scripts/run-cycle.js` AFTER Step 6 completes. The cycle 124 process was killed before Step 4 finished, let alone Step 6. So:

- summary.errors[] would not have been written (process killed mid-pipeline).
- last-cycle-summary.json would not have been overwritten (writeJson never called).
- The detector's existence is correct for the original O-1 case (cycle 123, full pipeline, persist failed at last step) but cannot help with mid-pipeline kills like this one.

## Recommended remediation (later)

P1 — make Step 4 atomic:
- Today TX1, TX2, TX3, TX4 are sequential awaits with no rollback. If process dies between TX2 and TX3, you get an orphan.
- Simplest fix: surround Step 4 in try/catch, and if any of TX1–TX4 throws, write a partial-cycle summary with `decisionTier='ABORTED_MID_PIPELINE'` and the proposalId so we can detect orphans later.
- Better: let cycles always WRITE the proposalId to a fixed local file (`data/inflight-proposal.json`) before TX1 and remove it after TX4. On startup, run-cycle.js checks for a stale inflight file and emits a P0 error.

P2 — settle/resolve any orphan proposals:
- ValidationRegistry probably exposes a `recordExecution` or `recordPnL` for closing the proposal lifecycle. We can write a one-shot script that scans for proposals where validateProposal landed but no follow-up TXs hit, and resolves them deterministically (probably "blocked-by-orphan" status).

P3 — make the detector also run on STARTUP, not only POST-Step-6:
- At cycle start, check the latest proposalId on-chain vs the latest decisionId in outcomes.json. If on-chain is ahead by ≥ 1, log a P0 "orphan detected" with the gap.

## Steering compliance

- `audit-style.md`: this finding came directly from "did UI/state/onchain claims match each other?" — by re-running the basic counts after fixing the trading bug. The original audit didn't catch it because it ran on cycles that all reached Step 6 successfully.
- `no-lying-about-state.md`: the orphan is invisible to every UI surface today. Decision feed skips it, last-cycle-summary doesn't know about it, dashboard counters keep going. That's not a lie per se, but it's a place where on-chain reality has 1 more entry than any UI shows. Worth surfacing once we have a reliable way to identify orphans.
