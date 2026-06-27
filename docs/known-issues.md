# Known Issues

Honest record of known quirks and the rationale for not fixing them mid-judging.
Workspace rule: `.kiro/steering/no-lying-about-state.md` — surface, don't hide.

---

## #1 — On-chain reputation `winRate` understates decision quality (~23%)

**Symptom.** `ReputationRegistry.getReputation(0).winRate` reads **23.1%**
(positiveCount 193 / totalFeedback 835). A judge reading the contract sees 23%
next to the dashboard's 49.5% decision quality / 68% trade win rate.

**Root cause.** The decision-time feedback rule scores every HOLD as `0`:

- `src/orchestrator/multiAgentLoop.js` — `submitFeedback(0, repScore)` where
  `repScore = consensus ? confidence*50 : 0` (a hold/block submits `0`).
- `contracts/TuringVaultReputationRegistry.sol` — counts `score > 0` as
  positive and `score <= 0` (including **0**) as negative:
  ```solidity
  uint256 positiveCount; // score > 0
  uint256 negativeCount; // score <= 0
  ...
  if (score > 0) { rep.positiveCount++; } else { rep.negativeCount++; }
  ```

The agent correctly holds ~78% of cycles in a down/crisis market, so ~642 of
835 feedback entries are score-0 holds counted as negatives. The on-chain
`winRate` therefore measures **consensus-trade ratio**, NOT decision quality,
and *understates* a disciplined, capital-preserving agent.

(Note: `cumulativeScore` on-chain is **+6826** — net positive — because holds
add 0 to the score but +1 to negativeCount. So the struct internally
contradicts: positive cumulative score, "low" winRate.)

**Verified.** Identity token **0** is owned by the agent EOA
(`0xDC78…fb5a`); token 1 is unminted. So `agentId 0` is the canonical agent and
`/api/reputation` reads the correct id — this is a scoring-rule artifact, not a
wrong-id read.

**User-facing reconciliation (shipped).** The UI does not present 23% as a
win rate. Instead:
- Homepage **Trade Win Rate 68%** (executed directional swaps, 62/91) and
  **Decision Quality 49.5%** (`(GOOD_CALL + CORRECT_BLOCK)/realized`, credits
  correct risk-off holds).
- Homepage reconciliation line explains the on-chain 23.1% field explicitly.
- `/api/performance` documents the methodology; the agent pipeline funnel shows
  the stage counts.

**Decision — not fixed during judging.** Rationale:
1. It modifies the live transaction-signing cron (regression risk with no safe
   staging).
2. Changing on-chain reputation scoring mid-judging could read as
   metric-gaming — bad for a "radical transparency" submission.
3. The 835 historical entries are immutable, so the on-chain `winRate` would
   recover only marginally within the judging window.
4. The UI already reconciles the number honestly.

**Future work (post-hackathon).** Move reputation scoring to settlement time
(`outcomeTracker`, which knows the realized outcome) and credit `CORRECT_BLOCK`
(a correct risk-off hold) as positive feedback, so the on-chain `winRate`
converges to decision quality. Alternatively, stop submitting score-0 feedback
for holds so the denominator reflects only graded trade decisions.

---

## #2 — `recordPnL` writes to an orphan `agentId 1`

**Symptom.** PnL-based reputation is recorded under `agentId 1`, but the
canonical agent is Identity token **0** (token 1 is unminted).

**Location.** `src/orchestrator/outcomeTracker.js` — `recordPnL(1, pnlBps, …)`.

**Effect.** PnL reputation accumulates on a non-canonical id that the UI
(`/api/reputation` → `getReputation(0)`) never reads. It also splits reputation
across two ids (feedback on 0 via `submitFeedback`, pnl on 1 via `recordPnL`).
This is where the pre-fix phantom-PnL on-chain records (see the phantom-PnL
fix) accumulated. `getReputation` (feedback aggregate) is separate from
`getAgentScore` (pnl aggregate), so the UI is not corrupted by this — but the
data is split and partly orphaned.

**Decision — not repointed during judging** (same live-cron rationale as #1).

**Future work.** Repoint `recordPnL` to `agentId 0` so pnl and feedback
reputation accumulate on the canonical agent.
