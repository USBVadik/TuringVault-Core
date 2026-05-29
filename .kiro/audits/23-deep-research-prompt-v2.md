# Audit 23 — Deep Research Prompt v2 for Antigravity-Gemini

**Date**: 2026-05-29 (later in same day, post-correction)
**Author**: Solo dev USBVadik via Kiro
**Predecessor**: `.kiro/audits/22-deep-research-prompt.md` — v1 prompt
+ Gemini's response + my triage + post-mortem on the Aave V3
recommendation that violated honest risk assessment.

**Why a v2**: The first deep-research run was useful but had three
weaknesses we want to avoid this time:

1. Gemini re-recommended already-shipped work (CI replay validator,
   on-chain anchor, SWR caching) despite the explicit "do NOT
   re-recommend" list — likely because the list was buried mid-prompt.
2. Gemini recommended **Aave V3 Mantle integration** without
   considering the protocol's recent incident history (CAPO oracle
   $26M March 10, KelpDAO bridge cascade $230M bad debt April 18,
   Mantle was heaviest L2 exposure, recovery still partial as of
   mid-May). I forwarded the recommendation without due diligence;
   operator caught it. New steering rule shipped:
   `.kiro/steering/external-integration-due-diligence.md`.
3. Gemini's "bot is barely trading" finding was based on stale
   `outcomes.json` data. Cycles 149-157 are all EXECUTED_SWAP.

This v2 prompt is calibrated to those three failure modes.

---

## How to use this file

1. Open Antigravity-Gemini (the version with repo + shell access).
2. Activate Deep Research mode.
3. Paste the entire block under "PROMPT — paste below this line".
4. Save Gemini's raw response to
   `.kiro/audits/raw/23-deep-research-v2/gemini-<timestamp>.md`.
5. Triage findings using the rules at the end of this file before
   shipping anything.

---

## PROMPT — paste below this line

```
ROLE
You are a senior strategic auditor with direct read access to this
repository AND web/deep-research access. You specialise in DeFi-AI
agent hackathons, RWA tokenisation, agent identity standards
(ERC-8004), and on-chain accountability primitives. Your output
will drive the final ~17-day push of a solo-developer hackathon
submission. Be ruthlessly specific, verifiable, and prioritised.
Every recommendation must be testable against either a code path
in this repo or a public artefact (TX, IPFS CID, contract event).

You have two superpowers a normal deep-research run does not:
1. You can read every file in this repo. Use that to verify each
   claim in the README against actual code, not just descriptions.
2. You can run shell commands (jest, foundry, eslint, scripts/*).
   Use that to confirm the test/lint state I describe matches
   reality, and to find regressions.

If a discrepancy exists between this prompt and what the repo
actually contains, the repo wins. Flag the discrepancy explicitly.

CALIBRATION SIGNALS — what the previous run got wrong

Before forming any opinion, internalise these failure modes from
audit 22 (the v1 of this prompt). Avoid repeating them.

1. **Stale data masquerading as live data.** The previous run
   reported "bot is barely trading: 4 swaps out of 145" by reading
   `outcomes.json` without cross-checking against `/api/decisions`
   or recent replay manifests. **Cycles 149-157 are all
   EXECUTED_SWAP** post the smart-router landing on 2026-05-29.
   Always cross-check disk state against the live API + on-chain
   counters before forming an "agent is broken" finding.

2. **Re-recommending already-shipped work.** The previous run
   re-recommended CI Replay Validator (already shipped in
   `.github/workflows/replay-validator.yml`), on-chain anchor of
   manifest hash (already shipped in audit 18), and SWR caching
   for Mantlescan 502s (already shipped, `x-vercel-cache: HIT`
   confirmed in production). The "what is already shipped" list
   below is binding — if you recommend something on it, the
   operator must reject the entire output as not-listening.

3. **Honest-risk-collapsing recommendations.** The previous run
   suggested "Fix Grid Constraints (Force execution)" as P0 — i.e.
   override the adversarial validator to push more trades through.
   This violates honesty rule §3 (no phantom PnL) and §4 (fake
   liveness). The bot's adversarial-block narrative is its single
   strongest pitch axis. Any recommendation that bypasses, weakens,
   or pretends-around the validator is auto-AVOID.

4. **External integration recommendations without incident
   research.** The previous run recommended Aave V3 Mantle
   integration (4.17% USDT0 supply yield) without acknowledging
   that Aave was hit by a $230M KelpDAO bridge cascade on
   2026-04-18 with Mantle as heaviest L2 exposure, plus a $26M
   CAPO oracle misconfiguration on 2026-03-10, with bad debt
   recovery still partial as of 2026-05-13. **Aave V3 is now under
   a temporary taboo for this submission — do not propose it.**
   See "Hard taboos" section below for the full list.

CONTEXT — what we are building

Project: TuringVault — autonomous AI x RWA portfolio agent on
Mantle Mainnet (chain 5000).

Hackathon: Mantle Turing Test 2026, Phase 2 "AI Awakening".
Submission: https://dorahacks.io/buidl/43986
Deadline: 2026-06-15 18:59 UTC. Today is 2026-05-29. Solo dev
(USBVadik). ~17 calendar days remain, ~10 effective coding days.

Primary target: AI x RWA Track 1st prize ($25k). Sponsored
exclusively by Mantle. Scoring: 60% general (AI x RWA depth,
technical completeness, Mantle integration, compliance) + 40%
Real-World Validity (clear asset category, defined target users,
complete UX).

Secondary target: 20-Project Deployment Award.

The three defining features the Mantle brief calls out:
1. On-chain benchmarking of AI (every decision recorded on Mantle).
2. ERC-8004 agent identity standard.
3. Radical transparency (live observable agents).

Strategic wedge: "First AI agent on Mantle that proves every RWA
allocation decision survived adversarial challenge BEFORE
execution. Not a black-box trading bot — an accountable RWA
portfolio agent (mETH staking yield + capital preservation through
USDT0 + risk-gated rebalancing) with on-chain proof for every
allocation. Targeted at DAO treasuries and on-chain funds that
want yield without delegating to a black-box agent."

LIVE SYSTEM SURFACES — verify against these, do not trust me

Frontend (Vercel): https://frontend-seven-beta-46.vercel.app
Replay page (per cycle): https://frontend-seven-beta-46.vercel.app/replay
Proof Explorer: https://frontend-seven-beta-46.vercel.app/proof-explorer
Discipline Layer: https://frontend-seven-beta-46.vercel.app/discipline
Adversarial Challenge arena: https://frontend-seven-beta-46.vercel.app/challenge
Backtest equity curve: https://frontend-seven-beta-46.vercel.app/backtest
Health endpoint: https://frontend-seven-beta-46.vercel.app/api/health
Decisions endpoint: https://frontend-seven-beta-46.vercel.app/api/decisions
Performance endpoint: https://frontend-seven-beta-46.vercel.app/api/performance

Repo: https://github.com/USBVadik/TuringVault-Core (public)
GitHub Actions cron: https://github.com/USBVadik/TuringVault-Core/actions/workflows/agent-cycle.yml
Daily replay validator: https://github.com/USBVadik/TuringVault-Core/actions/workflows/replay-validator.yml
Replay manifests: https://github.com/USBVadik/TuringVault-Core/tree/main/.kiro/audits/raw/replay-manifests

Mantle Mainnet contracts (all 6/6 Sourcify-verified `perfect`,
status checked 2026-05-29). The first three are the canonical
ERC-8004 three-registry stack:
  Identity:           0x6f862802e0d5463DF18d267e422347BeCacc28bD
  ReputationRegistry: 0xC78119F3274B05046Ac7c38a14298a6cbD946e1a
  ValidationRegistry: 0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6
  ValidationHelper:   0x0aeEd88959fCFC665284225dB93DED3e8A3Ff705
  DecisionLog:        0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5
  Router:             0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001

Live counters (verified 2026-05-29 19:42 UTC, refresh yourself):
  ValidationRegistry.totalProposals:   158
  Approved on-chain:                    93
  Rejected on-chain:                    65 (41.1% block rate)
  Realised PnL across 67 settled:       +1757 bps (+17.57%)
  winRate (GOOD_CALL+CORRECT_BLOCK / settled):  46.3%
  cyclesSucceeded / failed in last 24h: 30 / 1 (96.7% uptime)
  parseSuccessRate24h:                  100% (N=31)
  lastCycleAge at probe time:           115s (LIVE band)

Stack:
  AI: Z.ai GLM-5 (analyst, AWS Bedrock) → Anthropic Claude
      Sonnet 4.6 (validator, Bedrock) → Google Gemini 3.5 Flash
      (arbiter, Vertex AI). Two-of-three consensus required.
  Data: CoinGecko (with multi-source fallback chain to
        Binance/Bybit → Hyperliquid → disk snapshot), Nansen MCP
        (paid tier, 9 named tools), DeFiLlama, Hyperliquid funding,
        Elfa V2 social, Byreal funding/OI. Provenance tagged per
        cycle with `_priceSource` / `_candleSource` /
        `_fromDiskSnapshot`.
  Storage: IPFS via Pinata for full reasoning chains.
  Anchor: combinedAnchor = keccak256(utf8(ipfsCid) ‖ manifestHash)
          written to DecisionLog.txHash + ReputationRegistry.reasoningHash
          every cycle. No contract redeploy.
  Execution: Merchant Moe Liquidity Book v2.2.
  Smart wallet router: auto-wraps native MNT → WMNT, falls back
                       to mETH/USDT when WMNT depleted.
  RWA: USDT0 active (LayerZero omnichain Tether, treasury-
       collateralised, no APY claim), USDY paper-ready (Mantle
       pool dry).
  Cron: GitHub Actions twice/hour at :17 :47 UTC, best-effort.
  Tests: 256/256 jest passing across 17 suites. 29 Foundry
         property/fuzz tests (~11k randomized invocations).

WHAT IS ALREADY SHIPPED — do NOT re-recommend any of these

This list is binding. Recommending anything below is a signal you
did not read it. Treat as done:

Audits 12-21 (closed in earlier sessions):
  - P0 Heartbeat Mode (gated, alternating, capped, never aggregated
    with alpha) — first live heartbeat TX cycle 146.
  - P0 Multi-source candle + price feeds (CoinGecko →
    Binance/Bybit → Hyperliquid → disk snapshot) closing the
    16-cycle BLOCKED_BY_REGIME root cause.
  - P0 Smart wallet router with auto MNT→WMNT wrap + mETH fallback
    + pre-flight gas reserve.
  - P0 On-chain anchor of replay manifest hash (combinedAnchor in
    DecisionLog.txHash + ReputationRegistry.reasoningHash, no
    contract redeploy).
  - P1 /replay/<cycle-id> server-rendered public verification page
    with binding panel + live on-chain anchor verification.
  - P1 Daily CI replay validator (random-cycle anchor recompute,
    no secrets needed for the load-bearing on-chain check).
  - P1 Live status badge gated by /api/health (LIVE → IDLE → STALE
    → OFFLINE thresholds, mode label per workspace honesty rule §2).
  - P1 Provenance pill on dashboard rows when a fallback feed
    fired.
  - P2 SWR caching + module-scoped snapshot fallback for upstream
    502s, explorer fallback links on /proof-explorer + /replay/[id].
  - ERC-8004 three-registry implementation, all six contracts
    Sourcify `perfect`, all three registries actively written
    every cycle (Identity tokenURI auto-refresh, Reputation
    submitFeedback per cycle, Validation submitProposal+
    submitValidation per decision).
  - Foundry property/fuzz tests for the three ERC-8004 registries
    including formal AND-of-four-gates proof.
  - Snyk SAST + SCA clean.
  - Nansen API key rotated to paid tier; smart_traders_*,
    token_dex_trades, address_portfolio all return 200; Smart
    Money Holdings block now in analyst prompt.

Audit 22 (closed today, in this session):
  - DAO Treasury target-user framing landed on:
    homepage hero subtitle, README new "Who this is for" section,
    both agent-cards (description fields).
  - Number drift refresh: 147+ → 158+, 44% → 41%, 4/5 Sourcify →
    6/6 Sourcify `perfect`, agent-card snapshot 2026-05-26 →
    2026-05-29 19:42 UTC, totalDecisions 104 → 158, blockRate
    61.5% → 41.1%. Added: realised PnL +1757 bps, 67 settled,
    46.3% winRate, 30/31 cron uptime in 24h, parseSuccessRate24h
    100%.
  - FALLBACK_MARKET useMemo fix in `frontend/app/page.tsx`,
    frontend lint 17 → 15 warnings.

If you find any of the above NOT actually shipped (regression),
that is a P0 finding. Otherwise, do not propose any of them.

HARD TABOOS — do not propose these under any framing

These are out-of-scope for this submission, not because they are
bad ideas in general, but because the cost-benefit at T-17 days
does not work.

1. **No contract redeploy.** Sourcify `perfect` × 6/6 is
   load-bearing for the pitch (Claim #2 in the README grid). Any
   recommendation that requires redeploying a contract is auto-AVOID.

2. **Aave V3 Mantle integration (idle USDT0 supply or any other
   path).** Reasoning, with sources:

   - 2026-03-10: Aave's CAPO oracle misconfiguration → $26M
     wstETH unfair liquidations (2.85% undervaluation).
     Source: ccn.com/analysis/crypto/aave-founder-refunds-trader-swaps-mistake-aave-price/
   - 2026-04-18: KelpDAO 1-of-1 DVN bridge flaw → $292M unbacked
     rsETH used as Aave V3 collateral → ~$200M borrowed in WETH
     → ~$177-230M bad debt in WETH pool. **Mantle and Arbitrum
     were the heaviest L2 exposure.** $6.6B liquidity drained
     from Aave in 24h.
     Source: forbes.com/sites/digital-assets/2026/04/18/withdraw-now-inside-aaves-sudden-200m-bad-debt-crisis/
   - 2026-04-27: $300M "DeFi United" recovery fund pledged
     (Consensys, Lido, EtherFi, Mantle DAO, Arbitrum DAO, Solana
     Foundation). Mantle proposed lending up to 30,000 ETH to
     Aave DAO to cover bad debt.
     Source: coindesk.com/tech/2026/04/27/industry-leaders-are-pouring-hundreds-of-millions-into-a-rescue-plan-for-aave-users-after-massive-crypto-hack
   - 2026-05-13: Aave restored WETH borrowing limits across six
     networks, but bad debt recovery is still partial; $71M ETH
     return blocked by North Korea sanctions claims litigation.
     Source: kucoin.com/news/flash/aave-restores-weth-borrowing-across-six-networks

   This is exactly the integration shape the project's narrative
   exists to refuse. Going on-stage with "AI portfolio agent that
   proves every allocation survived adversarial challenge — supplied
   to a protocol still in partial recovery" reads as either
   disconnected from current events or aware and reckless. Either
   reading loses the prize.

3. **No Phala TEE / hardware attestation.** Our Reproducible AI
   narrative is hardware-vendor-free on purpose.

4. **No multi-DEX aggregator (Odos / 1inch).** Previous audit
   explicitly DEFER'd. Merchant Moe is enough for the pitch.

5. **No new chain (cross-chain / LayerZero).** Out of AI x RWA scope.

6. **No ERC-4626 vault.** EOA + custodial pattern documented;
   vault contract is roadmap-only.

7. **No new lending market integration (Lendle, Init Capital,
   Aurelius, Spark, Morpho, Compound, etc.) before submission.**
   The new steering rule
   `.kiro/steering/external-integration-due-diligence.md` requires
   90-day exploit research, bad debt status, oracle integrity,
   bridge/DVN exposure, governance status, and time-to-recovery
   to be cited inline before any such recommendation. Within the
   T-17-day window the cost-benefit does not justify it. Native
   yield paths (mETH staking, etc.) are preferred.

8. **No "force more trades through the validator" / "lower
   confidence threshold to push execution"** style recommendations.
   The adversarial-block narrative is the pitch's single strongest
   axis; bypassing it for actionability optics is auto-AVOID.

9. **No ve-tokenomics, no token launch, no Telegram Mini App.**

PRE-FLIGHT — READ THESE FIRST (before forming any opinion)

Tier 1 — read in full:
  .kiro/SUBMISSION-CHANGELOG.md           — single source of truth;
                                            recent CORRECTION block
                                            on Aave reclassification
                                            is critical context
  .kiro/steering/no-lying-about-state.md  — binding honesty rules
  .kiro/steering/hackathon-context.md     — track strategy & deadline
  .kiro/steering/audit-style.md           — verify live system, not
                                            just code
  .kiro/steering/external-integration-due-diligence.md  — NEW;
                                            governs every external
                                            integration recommendation
  README.md                               — public claim grid
  agent-card-v2.json                      — ERC-8004 metadata (v2)
  assets/agent-card.json                  — ERC-8004 metadata
                                            (cron-pinned)

Tier 2 — read the most recent ten audits, with audit 22 as the
must-read:
  .kiro/audits/13-competitive-and-claims-recheck.md
  .kiro/audits/14-erc8004-coverage-and-claims-fix.md
  .kiro/audits/15-foundry-fuzz-coverage.md
  .kiro/audits/16-reproducible-ai-capture.md
  .kiro/audits/17-heartbeat-mode.md
  .kiro/audits/18-onchain-anchor-replay-manifest.md
  .kiro/audits/19-blind-grid-rate-limit.md
  .kiro/audits/20-blind-prices-second-layer.md
  .kiro/audits/21-smart-wallet-router.md
  .kiro/audits/22-deep-research-prompt.md  — first run + corrections

Tier 3 — read these code paths to ground every recommendation:
  src/orchestrator/multiAgent.js          — three-model consensus
  src/orchestrator/multiAgentLoop.js      — main cycle, recently
                                            heavily edited (smart
                                            router + provenance)
  src/orchestrator/disciplineLayer.js     — post-execution gates
  src/orchestrator/heartbeatMode.js       — gated liveness path
  src/orchestrator/outcomeTracker.js      — settled-PnL writer
  src/orchestrator/unifiedMarketData.js   — DO NOT REFACTOR;
                                            operator preserved Nansen
                                            logic explicitly
  src/dex/walletRouter.js                 — smart router pickSource
  src/dex/merchantMoe.js                  — LB v2.2 swap path
  src/strategies/candleSources.js         — multi-source candles
  src/strategies/priceSources.js          — multi-source prices
  src/strategies/rangingGrid.js           — grid signal engine
  src/replay/captureManifest.js           — manifest hash binding
  src/ipfs/storage.js                     — Pinata + agent-card pin
  contracts/TuringVaultDecisionLog.sol
  contracts/TuringVaultReputationRegistry.sol
  contracts/TuringVaultValidationRegistry.sol
  frontend/app/page.tsx                   — homepage; recent edits:
                                            DAO subtitle + useMemo
  frontend/app/api/health/route.ts        — freshness probe
  frontend/app/api/decisions/route.ts     — provenance + offset
                                            lookup
  frontend/app/lib/live-status.shared.js  — LIVE/IDLE/STALE/OFFLINE
                                            threshold logic
  frontend/app/replay/[id]/page.tsx       — public verification page

Tier 4 — open specs (triage these as part of section 9 below):
  .kiro/specs/rwa-allocation-active/requirements.md
  .kiro/specs/rwa-allocation-active/tasks.md
  .kiro/specs/design-enhancement/tasks.md
  .kiro/specs/system-audit-pre-submission/tasks.md

RUN THESE COMMANDS — verify state against my claims

  npx jest --silent
    Expected: 256/256 passing, 17 suites.
  npx eslint src/ --max-warnings 50
    Expected: 0 errors, 47 warnings (all pre-existing).
  cd frontend && npm run lint
    Expected: 0 errors, 15 warnings (was 17 pre audit-22 useMemo).
  cd frontend && npx tsc --noEmit
    Expected: clean.
  cd frontend && npx next build
    Expected: clean, 24 routes.
  forge test --no-match-path "test/foundry/integration/**" -vv
    Expected: 29 tests passing across 3 files.

Any divergence is auto-P0.

Live-surface probing (curl is fine):

  /api/health    -> JSON with lastCycleTimestamp, lastCycleAge,
                    cyclesSucceeded24h, cyclesFailed24h, mode,
                    parseSuccessRate24h. Verify lastCycleAge
                    band (< 90 min for any "live" claim to hold).
  /api/decisions -> recent cycles array; latest 10 should show
                    EXECUTED_SWAP for cycles 149+ with at least
                    one txHash; provenance fields populated.
  /api/performance -> nav, settledCount, winRate, cumulativePnlBps,
                    lastSettlementAt, dataScope=agent-lifetime.
  Sourcify status for all six contracts via
    https://sourcify.dev/server/check-by-addresses?chainIds=5000&addresses=0x6f86…
    (and so on for the other 5).
  DecisionLog event scan — confirm cycles ≥ 149 carry the new
    combinedAnchor in DecisionLog.txHash, not legacy
    keccak256(ipfsCid).

CLAIMS-GRID CROSS-CHECK (binding output)

The README has a 10-row claim grid (Judge's Verification Path).
For EACH row, produce a verdict:
  • Code path that backs it (file + symbol).
  • Live artefact that proves it (URL, TX, contract address).
  • Failure-mode for a judge in <60 seconds.
  • Proposed fortification (link to redundant artefact, fallback
    URL, etc.).
A claim with no concrete code path or no live artefact is a P0
honesty-rule finding.

WHAT WE NEED FROM YOU

A prioritised, hackathon-rubric-driven recommendation set. Sections:

1. RUBRIC GAP ANALYSIS
   For each scoring axis — AI x RWA depth, technical completeness,
   Mantle integration, compliance — and for the 40% Real-World
   Validity bucket (asset category, target users, complete UX),
   score where TuringVault sits **after the audit-22 corrections**
   (1-10) and where the maximum-realistic-by-deadline score is
   given the hard taboos. Note: the "no actual yield" gap has a
   hard taboo on external lending; if you score AI x RWA Depth
   below 9, the only way up is through native-yield surfacing
   (mETH staking yield is in the wallet today and accrues
   passively; the dashboard does not yet feature it as a yield
   source) or through a DAO-treasury-credible angle that does not
   require a new counterparty contract.

2. DIFFERENTIATION MOVES (top of "must-do" list)
   3-5 product moves that meaningfully separate TuringVault from
   every other entry in the AI x RWA Track AND from cross-track
   competitors like AgentBank V3. For each:
   • Effort estimate in solo-dev hours.
   • Impact on rubric (which axes does it lift, by how much).
   • Risk profile (what could go wrong before deadline).
   • Verification path — how a judge confirms it from a public URL
     in <60 seconds.
   • Whether it requires a new contract (we strongly prefer "no").
   • If the move involves any external on-chain integration, fill
     the Risk panel from
     `.kiro/steering/external-integration-due-diligence.md`. Skip
     the move if the verdict is anything other than SAFE.

3. NATIVE-YIELD SURFACING (replaces the previous "Aave integration"
   recommendation)
   The portfolio holds mETH already. mETH is Mantle's liquid
   staked ETH; supply on Mantle accrues yield without any new
   contract call. Deep-research mETH's yield accrual mechanism
   (rebase vs accrual, how restaked rewards land) and propose
   the cleanest way to surface it as a *yield path* on the
   homepage and `/api/performance`, with explicit honesty-rule
   compliance:
   • What is the data source for the rate?
   • What is the "this wallet's accrued yield since first
     received" number, and where does it live on disk / on-chain?
   • How does the dashboard label the rate so a judge cannot
     confuse it with a TuringVault-promised return?
   • What are the failure modes (rate goes negative? upstream
     mETH depeg? mETH operator misbehaviour?) and how do we
     surface them honestly?
   This is the highest-leverage replacement for the Aave taboo.

4. STABILISATION / RELIABILITY
   Failure modes most likely to derail a judge's demo session in
   the final 17 days. Mantlescan 502s mitigated already; what
   else? What single endpoint should be on a public uptime monitor
   and surfaced as a status badge in the README?

5. NARRATIVE / PITCH
   Re-read the post-audit-22 README and both agent-cards. Identify
   three narrative weaknesses or under-claims now that the DAO
   Treasury framing is in place. For each, propose exact
   replacement copy. Honesty rules apply.

6. RWA-SPECIFIC DEPTH (no new external integrations)
   Within the hard-taboo constraints, where can we deepen the RWA
   story in 1-2 days of solo work? Candidates:
   • Surface mETH staking yield as a yield source (Section 3
     above; cross-link).
   • Better "asset category" framing for the 40% Real-World
     Validity score.
   • DAO-treasury-credible features that do not require a new
     counterparty contract (e.g. read-only proof export for
     treasury audit, integration-receipt format, OpenAPI doc on
     `/api/decisions`, etc.).

7. ERC-8004 ANGLE
   We are likely the only live ERC-8004 implementation on Mantle.
   Search for: (a) other ERC-8004 implementations across DeFi,
   (b) any Mantle Foundation public statements positioning ERC-8004
   as a track priority, (c) any judge-facing ERC-8004 verifier
   tooling that exists. If we are the only live implementation,
   propose how to make that explicit and verifiable in the README
   without violating §1 honesty.

8. COMPETITIVE RECHECK (light, not heavy)
   Look up the AI x RWA Track DoraHacks listings. Identify the
   top 5 entries. For each, identify:
   • Live agent on a public schedule (yes/no).
   • ERC-8004 (yes/no).
   • Reproducible-AI / proof-of-reasoning primitive (yes/no).
   • Working RWA execution path (not mock).
   • Dashboard survives Mantlescan 502 (yes/no).
   Where are they ahead of us; where are we ahead.

9. CODE-LEVEL INVESTIGATION (only possible with repo access)
   • Orphaned files / dead code under src/ (reachability from
     `node scripts/run-cycle.js` + cron entry).
   • TODO / FIXME in critical path. Top 5 by importance.
   • Guard rails on self-evolving prompts (FORMAT_GUARD_SUFFIX,
     validator immutability, EVOLVED_PROMPTS_ENABLED default off).
     If any can be bypassed, that is auto-P0.
   • Prompt-injection paths added since audit 12.
   • Race conditions in outcomes.json writer + cron overlap.
   • Secret leakage scan over src/data/ + replay-manifests/.
   • Frontend trust boundary on every /api route.

10. SPECS TRIAGE
    For each open spec, classify KEEP / ARCHIVE / DELETE with
    reasoning + the single highest-leverage next task for KEEPs.

11. THINGS YOU SAW THAT WORRY YOU
    Anything off our radar.

OUTPUT FORMAT

Markdown. Use the section headings above. End with a single
triaged recommendation table:

  | Priority | Move | Hours | Rubric lift | Verification path | New code? | Honesty risk |

Sort by Priority/Hours ratio descending.

For "New code?" mark Y/N. For Y, give the file path you would
add or modify. For "Honesty risk" mark how a recommendation
could violate the workspace honesty rules if executed sloppily,
and how to avoid that.

If a move involves any external on-chain integration, the row
must also include a "Risk panel verdict" cell next to the move
name with one of: SAFE, CAUTIOUS, AVOID. The full Risk panel
goes inline in section 2 or 3 of the body, not in the table.

Cap output at ~5000 words. Cite sources (file:line for code
claims, full URL with date for external claims, contract address
+ event signature for on-chain claims).

DO NOT touch the repo while researching. Read-only mode for this
run. After we triage your output we will pick what to implement.
```

---

## After running: triage rules (binding)

When Gemini's output lands:

1. **Calibration check first.** Before reading recommendations,
   scan for: any item from "WHAT IS ALREADY SHIPPED" (instant
   reject of the entire output as not-listening); any external
   integration without a Risk panel (instant reject of that row);
   any "force more trades through" framing (instant AVOID).

2. **Verify each numeric claim against the live surface.** No
   claim survives without me re-checking the source.

3. **Bucket each surviving recommendation.**
   - P0 = ≤4h AND lifts a rubric axis we are weak on AND has a
     clear verification path. SHIP.
   - P1 = ≤8h AND lifts narrative/UX clarity. SHIP after P0.
   - P2 = >8h or speculative. DEFER, document under "considered,
     deferred".
   - SKIP = breaks honesty rules, requires contract redeploy,
     duplicates already-shipped work, or hits a hard taboo.

4. **Append every shipped item to `.kiro/SUBMISSION-CHANGELOG.md`**
   with the standard "FOR PITCH" tag if pitch-relevant.

5. **Save Gemini's raw response** to
   `.kiro/audits/raw/23-deep-research-v2/gemini-<timestamp>.md`.

## Notes for self

- Don't run the prompt against a non-deep-research model.
- If Gemini surfaces a P0 that requires a contract redeploy or
  any taboo'd integration, reject on the spot.
- Highest expected payoff from this run: the **mETH native-yield
  surfacing path** (replaces the rejected Aave recommendation
  with a pitch-credible move that ships in ~1h, not 10).
- Second-highest payoff: the **rubric gap analysis**. After the
  audit-22 corrections we lifted Real-World Validity 6 → 8 with
  the DAO Treasury framing; v2 should re-score everything from
  the new baseline.
