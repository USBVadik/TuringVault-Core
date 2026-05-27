# Implementation Plan: Human vs AI Challenge v2

## Overview

Sequenced execution plan for `design.md`. Each task references its requirement (R#) and component (C#). Tick `[x]` as you go.

**Test gate before merge:** tasks 1–11 done; tasks 12–15 are post-merge live verification with `CHALLENGE_LIVE_ENABLED=true`.

## Tasks

- [ ] 1. Create `src/orchestrator/attackVectors.js`

  - Refs: R2, design §C1, CP3
  - File: `src/orchestrator/attackVectors.js` (NEW)
  - Body: pure `applyAttack(market, type, params)` plus 4 attack functions per design.
  - Acceptance:
    - 4 attacks: `flash_crash`, `pump_signal`, `oracle_conflict`, `sybil_consensus`
    - `applyAttack(m, 'none')` is identity
    - `attackProvenance` field set on returned context
    - Original input not mutated (immutable composition)

- [ ] 2. Create `src/orchestrator/runChallenge.js`

  - Refs: R1, R2, R3, design §C2, CP6
  - File: `src/orchestrator/runChallenge.js` (NEW)
  - Body: orchestrator that calls `getUnifiedMarketContext` -> `applyAttack` -> `getMultiAgentDecision` -> `classifyDecisionTier` -> IPFS pin -> optional `submitProposal`.
  - Acceptance:
    - Returns `ChallengeResponse` per design data model
    - Reasoning is verbatim from `decision.*.reasoning` (no templating)
    - When `anchorOnChain=false`, no on-chain TX issued
    - When `anchorOnChain=true`, single `submitProposal` TX with `[CHALLENGE-{type}]` action prefix
    - IPFS pin uses `CHALLENGE-{type}` name prefix
    - Returns `pipelinePath`, `disagreementSignal`, `disagreementSummary`, `decisionTier`

- [ ] 3. Add daily budget tracker `data/challenge-budget.json`

  - Refs: R4.2, design §C6
  - Files:
    - `data/challenge-budget.json` (initial empty placeholder)
    - `src/orchestrator/challengeBudget.js` (NEW — `read`, `increment`, `dailyResetIfNeeded`)
  - Acceptance:
    - Read returns `{ date, used, history[] }`
    - Increment bumps `used` and appends to `history` (last 100 entries)
    - When date changes, resets `used` to 0
    - Cron's commit-back step picks up the file naturally (no workflow changes)

- [ ] 4. Unit tests

  - Refs: R7, design "Testing Strategy" Layer 1, CP3, CP4
  - Files:
    - `tests/unit/attackVectors.unit.test.js` (NEW)
    - `tests/unit/challengeBudget.unit.test.js` (NEW)
  - Acceptance:
    - 4 attacks × {immutability, provenance, same-shape} = 12 cases
    - Budget cap test: cap=2 + 3 increments expects third to throw `BUDGET_EXHAUSTED`
    - Date-reset test: stub Date.now, ensure used resets across UTC midnight
    - All tests pass via `node_modules/.bin/jest tests/unit`

- [ ] 5. Rewrite `frontend/app/api/challenge/route.ts`

  - Refs: R1, R3, R4, R8, design §C3, CP1, CP2, CP5
  - File: `frontend/app/api/challenge/route.ts` (REWRITE)
  - Changes:
    - `export const maxDuration = 60`
    - GET handler: rate-limit, daily-cap, mode dispatch (live vs preview)
    - Live path imports `runChallenge` from backend (option A monorepo)
    - Preview path returns existing `DETERMINISTIC_RULES` payload with `mode: 'DETERMINISTIC_RULES'`
    - 503 on live pipeline failure with `retryAfter: 60`
    - 429 on rate-limit / budget exhausted
  - Acceptance:
    - When `CHALLENGE_LIVE_ENABLED !== 'true'`, response always has `mode: 'DETERMINISTIC_RULES'`
    - When `CHALLENGE_LIVE_ENABLED === 'true'`, response has `mode: 'LIVE_MULTI_AGENT'` + verbatim agent reasoning
    - Rate-limit triggers after 5 requests from same IP within 1h
    - Daily cap enforced (test with `CHALLENGE_DAILY_CAP=2` + 3 invocations)

- [ ] 6. Rewrite `frontend/app/challenge/page.tsx`

  - Refs: R5, R6, R8, design §C4
  - File: `frontend/app/challenge/page.tsx` (REWRITE)
  - Changes:
    - Mode badge at top (LIVE green / PREVIEW yellow)
    - Vertical timeline rendering all 3 agent cards (analyst -> validator -> arbiter when present)
    - Each agent card: model name, confidence ring, reasoning verbatim, timing ms
    - Disagreement highlight when `disagreementSignal === true`
    - Verdict banner (BLOCKED green / SUCCEEDED red)
    - On-chain block when anchored
    - Footer: daily budget remaining
    - 3-stage progress UI during loading (analyst -> validator -> arbiter)
  - Acceptance:
    - All 4 attacks render full timeline in live mode
    - Preview mode shows existing layout with PREVIEW badge
    - No copy claims "live" when flag is off
    - On-chain TX link works when anchored
    - `npx next build` clean

- [ ] 7. Backend invocation shim

  - Refs: design §C5
  - File: `frontend/lib/runChallenge.ts` (NEW)
  - Body: thin re-export of `src/orchestrator/runChallenge.js` for the Next.js route to import.
  - Acceptance:
    - `import { runChallenge } from '@/lib/runChallenge'` works in route.ts
    - Vercel build doesn't break on backend module resolution
    - Bundle size increase < 5MB

- [ ] 8. Operator runbook `.kiro/runbooks/challenge-operations.md`

  - Refs: R7
  - File: `.kiro/runbooks/challenge-operations.md` (NEW)
  - Sections:
    - Enable live mode (`CHALLENGE_LIVE_ENABLED=true`)
    - Enable on-chain anchor (`CHALLENGE_ANCHOR_ENABLED=true`)
    - Spend monitoring (link to AWS Bedrock dashboard)
    - Pause live mode mid-event (flip secret to `false`)
    - Reset daily budget (delete `data/challenge-budget.json` and let cron recreate)
    - Common failures (Vercel timeout, Bedrock 429, Vertex outage)
  - Acceptance:
    - All 6 sections present
    - Linked from README

- [ ] 9. Update README "Adversarial Challenge" subsection

  - Refs: R7.2
  - File: `README.md` (MODIFY)
  - Changes:
    - 2-paragraph subsection under "Strategy" or "Live System"
    - Link to `/challenge` and to runbook
    - Mention live vs preview mode honesty
  - Acceptance:
    - Honesty rule passes (no false-live claim)
    - Internal links resolve

- [ ] 10. Add new GitHub Actions secrets to runbook

  - Refs: R7.1
  - File: `.kiro/runbooks/challenge-operations.md` (already from task 8)
  - Action (operator-side): add `CHALLENGE_LIVE_ENABLED` and `CHALLENGE_ANCHOR_ENABLED` to repo secrets
  - Acceptance:
    - Operator confirms 2 new secrets set (one initially `false`, one initially `false`)

- [ ] 11. Verify backend doesn't shadow production state

  - Refs: CP2
  - Action: run `runChallenge` locally with `anchor=false`, snapshot `src/data/outcomes.json`, `src/data/threshold_state.json`, `src/data/position_state.json` before and after, diff.
  - Acceptance:
    - No production state file modified by a challenge invocation
    - `data/challenge-budget.json` correctly increments
    - `data/last-cycle-summary.json` NOT touched (challenge ≠ cycle)

- [ ] 12. First live workflow test (manual `/challenge` invocation)

  - Refs: R1, R5, "Testing Strategy" Layer 3, Success Criteria #1, #2
  - Action (operator-side):
    - Set `CHALLENGE_LIVE_ENABLED=true` in Vercel env (NOT GitHub Actions — the route runs on Vercel)
    - Hit `/challenge` page on prod, click `flash_crash`
    - Watch network tab for `/api/challenge` response
  - Acceptance:
    - Response.mode === `LIVE_MULTI_AGENT`
    - All 3 agents reasoning fields are non-empty and not in any source-code file (`grep` check)
    - Timing > 5s (confirms real Bedrock + Vertex calls)
    - Frontend renders timeline with all 3 cards

- [ ] 13. First on-chain anchored challenge

  - Refs: R3, Success Criteria #3
  - Action (operator-side):
    - Set `CHALLENGE_ANCHOR_ENABLED=true` in Vercel env
    - Hit `/challenge` again with same attack
  - Acceptance:
    - Response.onChain.anchored === true
    - txHash valid 0x-prefixed 66-char hex
    - Mantlescan link opens, shows `[CHALLENGE-flash_crash]` in action field
    - `data/challenge-budget.json` shows `used: 2` (after 2 invocations)

- [ ] 14. Daily budget enforcement test

  - Refs: R4.2, CP4, Success Criteria #5
  - Action: temporarily set `CHALLENGE_DAILY_CAP=2` env, hit endpoint 3 times.
  - Acceptance:
    - Third call returns HTTP 429 with `error: 'daily challenge budget exhausted'`
    - Reset `CHALLENGE_DAILY_CAP` back to 100 after test

- [ ] 15. Final spec close-out
  - Refs: all
  - Action: tick all task checkboxes; tick Success Criteria 1–8 in `requirements.md`. Update DoraHacks submission to mention live challenge with link.
  - Acceptance:
    - All `[ ]` boxes are `[x]`
    - Submission updated only AFTER at least one anchored challenge exists

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": [1, 3],
      "rationale": "Pure-functions foundation: attack vectors and budget tracker. No deps on each other or on later tasks."
    },
    {
      "wave": 2,
      "tasks": [2],
      "rationale": "runChallenge orchestrator depends on attackVectors (task 1). Budget tracker (task 3) optional but cleaner if present."
    },
    {
      "wave": 3,
      "tasks": [4],
      "rationale": "Unit tests need attackVectors (1), budget tracker (3), and runChallenge stubs (2)."
    },
    {
      "wave": 4,
      "tasks": [7],
      "rationale": "Backend shim wraps task 2 for frontend bundling. Independent of API route changes."
    },
    {
      "wave": 5,
      "tasks": [5, 6],
      "rationale": "API route rewrite (5) and page rewrite (6) both depend on the shim (7) and the backend (2). Can land in parallel."
    },
    {
      "wave": 6,
      "tasks": [8, 9],
      "rationale": "Runbook (8) and README link (9) document the system once code is complete. Runbook before README so the link target exists."
    },
    {
      "wave": 7,
      "tasks": [10, 11],
      "rationale": "Operator-side secret setup (10) is documented; verification of state isolation (11) is a sanity gate before going live."
    },
    {
      "wave": 8,
      "tasks": [12],
      "rationale": "First live invocation. Requires everything above merged + Vercel env var set."
    },
    {
      "wave": 9,
      "tasks": [13],
      "rationale": "First anchored invocation. Requires task 12 to confirm live path works + anchor flag set."
    },
    {
      "wave": 10,
      "tasks": [14],
      "rationale": "Budget enforcement verified live."
    },
    {
      "wave": 11,
      "tasks": [15],
      "rationale": "Spec close-out only after all live verifications pass."
    }
  ]
}
```

## Notes

### Out of scope reminder

- Custom-attack POST endpoint (deferred to v3)
- SSE streaming (single response with frontend animation)
- Smart-contract changes
- Per-challenge tokenURI updates on Identity NFT

### Operator-side prerequisites for task 12

Before kicking off task 12, the operator must:

1. Add `CHALLENGE_LIVE_ENABLED=true` to **Vercel** env vars (Project -> Settings -> Environment Variables -> Production)
2. Confirm AWS Bedrock + Vertex AI keys reachable from Vercel (same secrets as cron)
3. Have at least 0.005 MNT in the wallet for task 13's anchor TX
4. Bookmark Mantlescan + Bedrock spend dashboards
5. Test on Vercel preview (PR build) BEFORE flipping production flag

### Cost forecast

Worst case if 100/day cap hit every day: ~$15/day. Hackathon judging window is ~3 days (12-15 June). Total worst case spend: $45. AWS Activate $10k credits cover comfortably.
