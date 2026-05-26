# Requirements Document

## Introduction

The hackathon is called **Mantle Turing Test** — adversarial challenge is in the name. Our `/challenge` page is *technically* live (4 attack-vector buttons, result UI, on-chain verification block), but the agent's reasoning is **pre-canned in a `DETECTION_RULES` map** rather than coming from the actual multi-agent pipeline. The frontend honestly labels this as `mode: DETERMINISTIC_RULES`, which keeps us compliant with `.kiro/steering/no-lying-about-state.md`, but it gives away the killer narrative win.

A judge who opens this page sees:

1. Buttons + animation
2. A reasoning paragraph that, if they grep the repo, lives as a string literal
3. An on-chain verification block (real — `ValidationRegistry.totalProposals` is read live)

The on-chain block is honest. The reasoning is not the agent. That's the gap this spec closes.

`human-vs-ai-challenge-v2` rebuilds the page so each attack invocation:

- Calls the **real multi-agent pipeline** (`getMultiAgentDecision`) with the attack vector merged into the live market context
- Returns the **actual GLM-5 + Claude 4.6 + Gemini 3.5** reasoning verbatim
- Shows the analyst → validator → arbiter chain with real timings, real disagreement signals, real consensus output
- Anchors the result on-chain via `ValidationRegistry.submitProposal` so judges can verify the challenge actually went through the same gates as a production cycle

The same safety gates that protect production capital protect the agent during a challenge. If the user picks "flash crash injection", the analyst sees a perturbed market, the validator catches the anomaly, the arbiter breaks ties, and the on-chain attestation chain records the rejection. Same code path. Different inputs.

The page becomes a **live demo of Proof-of-Reasoning** — the strongest product narrative we have for the AI x RWA Track judges who are evaluating "radical transparency" as one of the three defining features.

## Requirements

### Requirement 1: Replace pre-canned detection map with live multi-agent invocation

**User Story:** As a hackathon judge, I want every challenge result to come from the same models that drive production decisions, so that the page is provably non-templated.

#### Acceptance Criteria

1. WHEN a user selects an attack vector and the challenge endpoint is invoked, THEN the system SHALL call `getMultiAgentDecision(market)` from `src/orchestrator/multiAgent.js` with the attack vector merged into a real `unifiedMarketContext`.

2. WHEN `getMultiAgentDecision` returns, THEN the response SHALL include the verbatim `analyst.reasoning`, `validator.reasoning`, and `arbiter.reasoning` (when arbiter fired) without rewriting or templating.

3. THE response SHALL include `analyst.confidence`, `validator.validatorConfidence`, `validator.riskScore`, `validator.flaggedIssues[]`, and the consensus boolean exactly as the production cycle records them.

4. THE response SHALL include `mode: 'LIVE_MULTI_AGENT'` (replacing `DETERMINISTIC_RULES`).

5. THE response SHALL include `_timing: { analyst, validator, arbiter, total }` measured in milliseconds — judges can see the round-trip is real (multi-second), not a templated 50ms reply.

6. WHEN `getMultiAgentDecision` throws (Bedrock rate-limit, network, parse failure), THE endpoint SHALL return HTTP 503 with `{ error, retryAfter }` — never a template fallback that pretends to be live reasoning.

### Requirement 2: Attack vector injection without breaking the orchestrator

**User Story:** As a developer, I want attack vectors to compose with the live market context cleanly, so that the only difference between a challenge and a production cycle is the perturbed input.

#### Acceptance Criteria

1. THE system SHALL define 4 attack types as pure functions `applyAttack(unifiedMarket, attackType, params)` returning a perturbed `unifiedMarket` of the same shape:
   - `flash_crash` — apply a -20% price perturbation, set sentiment to extreme_panic, fearGreed to 3
   - `pump_signal` — +15% price, sentiment euphoric, fake volume spike
   - `oracle_conflict` — set CoinGecko vs Hyperliquid prices to 7.8% apart in `structuredSignals.signals.divergence`
   - `sybil_consensus` — inject pre-baked agent-card / reputation history claiming 100% historical win rate

2. THE attack functions SHALL NOT mutate the original market context — they return a new object (immutable composition).

3. EACH attack function SHALL include an `attackProvenance` field on the returned context: `{ type, params, appliedAt }` so downstream IPFS pinning records what was injected.

4. WHEN no attack is specified, `applyAttack` SHALL be a no-op identity function.

### Requirement 3: On-chain attestation for challenge results

**User Story:** As a judge, I want every challenge to leave a verifiable on-chain trail, so that "the agent blocked my attack" is provable, not claimed.

#### Acceptance Criteria

1. WHEN `RWA_EXECUTE_ENABLED=true` AND `CHALLENGE_ANCHOR_ENABLED=true` (separate flag, default false), THE endpoint SHALL submit one `ValidationRegistry.submitProposal` TX with action prefixed `[CHALLENGE-{type}]`.

2. WHEN the on-chain attestation is enabled, THE response SHALL include the TX hash + block number + Mantlescan URL.

3. WHEN attestation is NOT enabled, the response SHALL include `onChain: { skipped: true, reason: 'attestation gate off' }` — honest, no fake hash.

4. THE attestation SHALL NOT submit additional `validateProposal`, `logDecision`, or `submitFeedback` TXs — challenge attestations are single-shot to keep cost predictable (each Bedrock+Vertex call costs ~$0.15 already).

### Requirement 4: Cost and abuse guards

**User Story:** As an operator, I want to bound the Bedrock spend on this page so a viral spike doesn't drain credits.

#### Acceptance Criteria

1. THE endpoint SHALL implement a per-IP rate limit: max 5 challenges per IP per hour, tracked in-memory (Vercel functions are stateless across cold-starts, so this is a soft limit).

2. THE endpoint SHALL implement a global daily cap: max 100 challenge invocations per UTC day, persisted to `data/challenge-budget.json` and enforced via the cron commit-back loop. Once cap hit, all challenges return HTTP 429 with `{ error: 'daily challenge budget exhausted', resetAt }`.

3. THE endpoint SHALL refuse to invoke the live pipeline when `CHALLENGE_LIVE_ENABLED !== 'true'` — defaults to off. When off, the endpoint returns the existing deterministic-rules response with `mode: 'DETERMINISTIC_RULES'` and a banner explaining live mode is paused. Operator runbook documents how to flip the flag.

4. THE endpoint SHALL NOT echo any AWS / Vertex / Pinata credentials in error messages, even in debug mode.

5. EACH live invocation SHALL log estimated cost (~$0.15) to a rolling counter so the operator can monitor spend.

### Requirement 5: Frontend transparency surface

**User Story:** As a judge, I want the page to clearly show whether I'm seeing live model output or a deterministic preview, so that I can trust what I see.

#### Acceptance Criteria

1. THE page SHALL display a top-level mode badge: green `LIVE · multi-agent pipeline` when `mode === 'LIVE_MULTI_AGENT'`, yellow `PREVIEW · deterministic rules` otherwise.

2. THE page SHALL render the analyst → validator → (arbiter) chain as a vertical timeline with each agent's:
   - role label
   - model identifier (`zai.glm-5`, `us.anthropic.claude-sonnet-4-6`, `gemini-3.5-flash`)
   - confidence score
   - reasoning text (verbatim, not summarized)
   - response time in seconds
   - any flagged issues (validator only)

3. WHEN `consensus === true` AND the action is one of `swap | rwa_allocate | rwa_exit`, THE page SHALL render a red "ATTACK SUCCEEDED" banner. Otherwise green "ATTACK BLOCKED".

4. THE page SHALL show the `decisionTier` value (e.g., `BLOCKED_BY_VALIDATOR`, `BLOCKED_BY_LOW_CONFIDENCE`) since that's the agent's first-class explanation surface.

5. WHEN the on-chain attestation TX hash is present, THE page SHALL render a "Verified on Mantlescan" link.

6. THE page SHALL show the daily budget remaining and rate-limit status as small footer text — total transparency on the demo's bounds.

### Requirement 6: Disagreement-amplification feature

**User Story:** As a judge looking for AI x RWA Track narrative depth, I want to see when the agents disagree, so that the multi-agent value is provable.

#### Acceptance Criteria

1. WHEN `analyst.confidence > 0.6 AND validator.approved === false`, THE response SHALL set `disagreementSignal: true` and `disagreementSummary` with a short auto-generated diff (e.g., "Analyst: BUY mETH at 70% confidence. Validator: REJECTED — flagged R:R below 1.5:1").

2. WHEN `disagreementSignal === true`, THE page SHALL render a yellow "Models disagreed" highlight on the timeline.

3. THE response SHALL include a `pipelinePath: 'analyst-validator-arbiter' | 'analyst-validator'` field — judges see which path executed.

### Requirement 7: Documentation and operator runbook

**User Story:** As an operator, I want clear instructions for enabling, pausing, and monitoring this page.

#### Acceptance Criteria

1. THE file `.kiro/runbooks/challenge-operations.md` SHALL document:
   - How to enable live mode (`CHALLENGE_LIVE_ENABLED=true`)
   - How to enable on-chain attestation (`CHALLENGE_ANCHOR_ENABLED=true`)
   - How to monitor spend (link to AWS Bedrock dashboard)
   - How to pause live mode mid-event (flip secret to `false`)
   - How to reset the daily budget if needed
   - Common failure modes and recovery

2. THE README SHALL include a one-paragraph "Adversarial Challenge" subsection linking to the runbook and to `/challenge` on the live dashboard.

3. THE submission text on DoraHacks MAY reference live challenge mode AFTER the flag is on and at least one challenge has been recorded on-chain — not before.

### Requirement 8: Honesty rule compliance

**User Story:** As a judge, I want the page to claim only what's true.

#### Acceptance Criteria

1. WHEN `CHALLENGE_LIVE_ENABLED !== 'true'`, no copy on the page SHALL describe the result as "live multi-agent reasoning". The badge SHALL clearly read PREVIEW.

2. WHEN `CHALLENGE_ANCHOR_ENABLED !== 'true'`, no copy SHALL claim "verified on-chain" — only "deterministic gates would block this".

3. THE on-chain verification block (which already reads `ValidationRegistry.totalProposals` live) SHALL remain as-is — it accurately attests the contract is alive and has handled real proposals, regardless of whether THIS specific challenge anchored.

4. THE response SHALL never fabricate a TX hash, model output, or confidence score — every field is either live-from-source or marked as preview.

## Non-Functional Requirements

### NFR1: Latency budget

A live challenge runs the same 3-model pipeline as a production cycle. Expected p50 latency: 8–12 seconds (analyst ~3s + validator ~4s + optional arbiter ~3s). Frontend SHALL show a 3-stage progress indicator so users don't bail thinking it's broken.

### NFR2: Repo size discipline

`data/challenge-budget.json` is tiny (~200 bytes). No new large files.

### NFR3: Smart-contract inertia

This spec changes ZERO smart-contract code. All contracts deployed already (`ValidationRegistry`, `DecisionLog`, etc.) are reused unchanged.

### NFR4: Backwards compatibility

The existing GET endpoint with the old `DETERMINISTIC_RULES` map SHALL remain available at `?mode=preview` so the page still works when live mode is paused.

### NFR5: Cost ceiling

Worst case daily spend if cap is hit: 100 × $0.15 = $15/day. AWS Activate $10k credits cover comfortably. Monitor weekly.

## Success Criteria

This spec is done WHEN:

1. `/challenge` page invokes the live multi-agent pipeline for at least one of the 4 attack types end-to-end
2. The response includes verbatim model reasoning (greppable in IPFS-pinned blob, not in repo source)
3. At least one challenge has been anchored on-chain via `ValidationRegistry.submitProposal` with a `[CHALLENGE-*]` prefix
4. The page mode badge reflects reality (live/preview)
5. Daily budget enforcement is verified (test with cap=2 + 3 invocations expecting third to 429)
6. The runbook is comprehensible to someone who hasn't read this spec
7. Honesty checklist passes
8. Submission text on DoraHacks is updated to reference the live challenge feature with a link

## Open Questions

1. **Should each challenge eat a full cycle's gas (4 TXs) or just one attestation TX?**
   - Recommendation: **one attestation TX** (R3.4). Production cycle costs are ~0.005 MNT × 4 = 0.02 MNT (~$0.014). Challenges burning 4 TXs each at 100/day cap = $1.40/day in gas. One TX = $0.35/day. Not material either way; one TX simplifies the cost model and avoids polluting the ValidationRegistry feed.

2. **Should the live pipeline path use the CURRENT live market context or a frozen snapshot?**
   - Live: more realistic (pipeline sees actual conditions and the perturbation), but the analyst will refuse trades on calm-market days regardless of the perturbation, dulling the demo.
   - Frozen: more dramatic (we can pre-compose a "high-volatility" baseline), but it's no longer pulling real data.
   - Recommendation: **live** (R2.1). Honesty rule wins. Sometimes the analyst will decline to trade not because of the attack but because real conditions are calm — which is itself a strong narrative ("the agent didn't even need our attack to refuse").

3. **Should the challenge result be pinned to IPFS like a regular cycle?**
   - Pro: full reasoning chain becomes an immutable artifact.
   - Con: 100 IPFS pins/day on a free Pinata tier may rate-limit our production cron.
   - Recommendation: **yes, pin** (in design). Our Pinata plan is 5000 pins/month free. 100/day = 3000/month. Comfortable. Add `[CHALLENGE-*]` prefix to the pin name to distinguish.

4. **Should there be a custom-attack form (POST endpoint) where users craft their own signal?**
   - Pro: hero feature for "adversarial" narrative. Users can really stress-test the agent.
   - Con: arbitrary user input → arbitrary Bedrock cost; need stricter validation.
   - Recommendation: **defer to v3**. Ship 4 canonical attacks first, see judge reaction.

5. **Frontend SSE streaming vs. single response?**
   - SSE: 3-stage progressive reveal (analyst → validator → arbiter), more dramatic.
   - Single: simpler, fits Vercel function limits.
   - Recommendation: **single response** with frontend pre-animation. Vercel Edge Functions don't love long-running SSE; keeps deploy simple.

## Dependencies

- `src/orchestrator/multiAgent.js`: `getMultiAgentDecision` already production-ready (reused unchanged)
- `src/orchestrator/unifiedMarketData.js`: `getUnifiedMarketContext` already production-ready
- `src/ipfs/storage.js`: `uploadReasoningProof` already production-ready
- `ValidationRegistry` contract: already deployed
- GitHub Actions secrets: 11 already set; add `CHALLENGE_LIVE_ENABLED`, `CHALLENGE_ANCHOR_ENABLED`

## Risks

- **R-A**: Vercel function timeout (default 10s, max 60s on Pro, 300s on Pro+). Live pipeline takes 8–12s. Mitigation: set `export const maxDuration = 60;` on the route. Test on prod.
- **R-B**: Bedrock rate-limit during a viral spike. Mitigation: per-IP + global daily caps (R4).
- **R-C**: A judge gets a slow response and bails. Mitigation: 3-stage progress UI (NFR1).
- **R-D**: Live mode flag accidentally left on after hackathon. Mitigation: runbook entry, cost-monitoring alert at $5/day.
- **R-E**: Attack injection breaks `getMultiAgentDecision` due to malformed context. Mitigation: pure-function `applyAttack` returning same-shape object (R2.2); zod schema validation before pipeline call.
