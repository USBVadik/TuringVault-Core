# Honest Pipeline Funnel + Executed-Trade Win Rate — Requirements

## Context

The homepage shows a green "Reputation Score: 23" from the on-chain
`ReputationRegistry.getReputation(0).winRate` (= positiveCount/totalFeedback).
That 23.1% is an artifact: the decision-time `submitFeedback` rule records
every HOLD/BLOCK as score 0, and the contract counts score <= 0 as negative.
Since the agent correctly holds ~78% of the time in a down/crisis market,
the on-chain winRate field is crushed to 23.1% — it measures
"consensus-trade ratio", NOT decision quality, and it misrepresents the agent
as bad. (Verified: identity token 0 = our EOA; token 1 unminted, so agentId 0
is correct; this is not a wrong-id read.)

A judge reading a green "23" next to a "49.5% Win Rate" sees a contradiction
and may conclude the platform is weak or the UI is inflated. We must present
honest, favorable, defensible metrics WITHOUT fabricating per-agent accuracy.

## Investigated, data-grounded facts (origin/main, 700 settled)

- Executed directional trades (executedOnChain && GOOD/BAD): 91; won 62 -> **68.1%**.
- Funnel: 700 decisions -> 152 consensus-approved (22%) -> 91 executed -> 62 won;
  548 blocked (471 deterministic gates, 41 adversarial validator, 36 other).
- Decision quality (GOOD + CORRECT_BLOCK)/realized = 49.5%.
- BLOCKED_BY_VALIDATOR (Claude) was "right" only 10/38 ~26% — so we must NOT
  claim "the validators caught the bad trades". arbiterVote recorded in only 4%
  of rows — so we must NOT break out Gemini's per-agent accuracy.

## Requirements

R1. Add an **executed-trade win rate** (executed directional swaps only) as the
honest headline. Label it explicitly "executed swaps only"; exclude holds and
non-executed intents.

R2. Add an **agent pipeline funnel** of stage COUNTS only (decisions ->
consensus-approved -> executed -> won; blocked split into deterministic gates
vs adversarial validator). Counts are factual; no stage may be labeled with a
"correctness %" that the data does not support (esp. not the validator/arbiter).

R3. **Remove the misleading green "Reputation Score: 23"** headline card.

R4. **Reconcile, do not hide, the on-chain number.** Keep the ERC-8004
on-chain reputation visible as proof (feedback entries + cumulative score) with
a note explaining the raw 23.1% winRate field counts risk-off holds as
non-positive. A judge who reads the contract must find the explanation, not a
contradiction. (no-lying-about-state §1/§3/§5)

R5. Keep the existing decision-quality win rate (49.5%) but relabel it clearly
("Decision quality — incl. correct holds") to distinguish from executed-trade
win rate.

R6. Display-only. No backend/cron change, no contract change, no protected
state file touched. No fabricated/per-agent accuracy anywhere.

## Out of scope (this PR)

- Cron `submitFeedback`/`recordPnL` scoring fix + agentId-1 orphan (separate,
  sensitive change; confirm later).
- Pitch deck edits (follow-up after live UI is honest).
