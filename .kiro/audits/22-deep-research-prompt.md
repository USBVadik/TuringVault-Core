# Audit 22 — Deep Research Prompt for External Gemini Pro 3.x

**Date**: 2026-05-29
**Author**: Solo dev USBVadik via Kiro
**Purpose**: Single-shot deep-research prompt to feed an external
Gemini Pro 3.x (or equivalent reasoning model) deep-research run.
The goal is **not** another generic audit — it is a focused search
for the specific moves that take TuringVault from "good submission"
to "1st place in AI x RWA Track $25k", over the next ~17 days, given
the constraints listed below.

---

## How to use this file

1. Open <https://gemini.google.com> (or any deep-research-capable
   reasoning model with web access).
2. Start a Deep Research session.
3. Copy the entire block under "PROMPT — paste below this line"
   into the input. Run.
4. Save Gemini's response into `.kiro/audits/raw/22-deep-research/`
   for the audit trail.
5. Convert findings into a triaged P0/P1/P2 list and append to
   `.kiro/SUBMISSION-CHANGELOG.md`.

The prompt is in English because deep-research models cite Mantle,
Ondo, ERC-8004 and DoraHacks sources better in English, and the
output is meant for verification against English-language artefacts.

---

## PROMPT — paste below this line

```
ROLE
You are a senior strategic auditor with direct read access to
this repository AND web/deep-research access. You specialise in
DeFi-AI agent hackathons, RWA tokenisation, agent identity
standards (ERC-8004), and on-chain accountability primitives.
Your output will drive the final 17-day push of a solo-developer
hackathon submission. Be ruthlessly specific, verifiable, and
prioritised. Every recommendation must be testable against either
a code path in this repo or a public artefact (TX, IPFS CID,
contract event).

You have two superpowers a normal deep-research run does not:
1. You can read every file in this repo. Use that to verify each
   claim in the README against actual code, not just descriptions.
2. You can run shell commands (jest, foundry, eslint, scripts/*).
   Use that to confirm the test/lint state I describe matches
   reality, and to find regressions.

If a discrepancy exists between this prompt and what the repo
actually contains, the repo wins. Flag the discrepancy explicitly.

CONTEXT — what we are building

Project: TuringVault — autonomous AI x RWA portfolio agent on
Mantle Mainnet (chain 5000).

Hackathon: Mantle Turing Test 2026, Phase 2 "AI Awakening".
Submission: https://dorahacks.io/buidl/43986
Deadline: 2026-06-15 18:59 UTC. Today is 2026-05-29. Solo
developer (USBVadik). Time budget is the binding constraint;
~17 calendar days remain, of which ~10 effective coding days
(deduct for video re-record, submission text polish, sleep).

Primary target: AI x RWA Track 1st prize ($25k). Sponsored
exclusively by Mantle. This is what we optimise for, not Grand
Champion. Scoring rubric: 60% general (AI x RWA depth, technical
completeness, Mantle integration, compliance) + 40% Real-World
Validity (clear asset category, well-defined target users,
complete UX).

Secondary target: 20-Project Deployment Award (guaranteed-grade,
first-come-first-served checkboxes — keep eligible).

The three defining features the Mantle brief calls out:
1. On-chain benchmarking of AI (every decision recorded on Mantle).
2. ERC-8004 agent identity standard.
3. Radical transparency (live observable agents).

Strategic wedge we are leaning on: "First AI agent on Mantle that
proves every RWA allocation decision survived adversarial challenge
BEFORE execution. Not a black-box trading bot — an accountable RWA
portfolio agent (mETH staking yield + USDY US Treasuries +
risk-gated rebalancing) with on-chain proof for every allocation."

LIVE SYSTEM SURFACES — verify against these, do not trust me

Frontend (Vercel): https://frontend-seven-beta-46.vercel.app
Replay page (per cycle): https://frontend-seven-beta-46.vercel.app/replay
Proof Explorer: https://frontend-seven-beta-46.vercel.app/proof-explorer
Discipline Layer: https://frontend-seven-beta-46.vercel.app/discipline
Adversarial Challenge arena: https://frontend-seven-beta-46.vercel.app/challenge
Backtest equity curve: https://frontend-seven-beta-46.vercel.app/backtest
Health endpoint (freshness probe): https://frontend-seven-beta-46.vercel.app/api/health

Repo: https://github.com/USBVadik/TuringVault-Core (public)
GitHub Actions cron: https://github.com/USBVadik/TuringVault-Core/actions/workflows/agent-cycle.yml
Daily replay validator: https://github.com/USBVadik/TuringVault-Core/actions/workflows/replay-validator.yml
Replay manifests directory:
https://github.com/USBVadik/TuringVault-Core/tree/main/.kiro/audits/raw/replay-manifests

Mantle Mainnet contracts (all 6/6 Sourcify-verified status `perfect`,
checked 2026-05-29). The first three are the canonical ERC-8004
three-registry stack:
  Identity:           0x6f862802e0d5463DF18d267e422347BeCacc28bD
  ReputationRegistry: 0xC78119F3274B05046Ac7c38a14298a6cbD946e1a
  ValidationRegistry: 0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6
  ValidationHelper:   0x0aeEd88959fCFC665284225dB93DED3e8A3Ff705
  DecisionLog:        0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5
  Router:             0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001

Live counters at time of writing (verify on-chain):
  ValidationRegistry.totalProposals() ≈ 155+
  Real DEX execution TXs in cycles 149, 150, 153, 154, 155 on
  Merchant Moe LB v2.2 (USDT0 ↔ USDT ↔ WMNT ↔ mETH router path,
  smart wallet router auto-wraps native MNT to WMNT when needed).

Stack:
  AI: Z.ai GLM-5 (analyst, AWS Bedrock) → Anthropic Claude
      Sonnet 4.6 (validator, Bedrock) → Google Gemini 3.5 Flash
      (arbiter, Vertex AI). Two-of-three consensus required.
  Data: CoinGecko, Nansen MCP (paid tier, 9 named tools used
        per cycle), DeFiLlama, Hyperliquid, Elfa V2 social,
        Byreal funding/OI. Multi-source price + candle fallback
        chains (CoinGecko → Binance/Bybit → Hyperliquid → disk
        snapshot) with per-cycle provenance tagging.
  Storage: IPFS via Pinata for full reasoning chains, anchor
           bytes32 written to DecisionLog.txHash and
           ReputationRegistry.reasoningHash:
           combinedAnchor = keccak256(utf8(ipfsCid) ‖ manifestHash)
  Execution: Merchant Moe Liquidity Book v2.2.
  RWA: USDT0 active, USDY paper-ready (Mantle pool dry).
  Cron: GitHub Actions twice/hour at :17 :47 UTC, best-effort.
  Tests: 256/256 jest passing, 29 Foundry property/fuzz tests
         (~11k randomized invocations).

WHAT IS ALREADY SHIPPED — do NOT re-recommend these

The previous external Gemini Pro 3.1 audit closed every P0/P1
item. Treat these as done; do not propose them again:

- P0 Heartbeat Mode (gated, alternating, capped, never aggregated
  with alpha) — first heartbeat TX in cycle 146.
- P0 Multi-source candle + price feeds with disk-snapshot
  fallback (closes 16-cycle BLOCKED_BY_REGIME diagnosed as
  CoinGecko 429 from shared GH Actions IP).
- P0 Smart wallet router with auto MNT→WMNT wrap + mETH fallback.
- P0 On-chain anchor of replay manifest hash (combinedAnchor in
  DecisionLog.txHash + ReputationRegistry.reasoningHash, no
  contract redeploy).
- P1 /replay/<cycle-id> server-rendered public verification page
  with binding panel + live on-chain anchor verification.
- P1 Daily CI replay validator (random-cycle anchor recompute,
  no secrets needed for the load-bearing on-chain check).
- P1 Live status badge gated by /api/health (LIVE → IDLE → STALE
  → OFFLINE thresholds, mode label per workspace honesty rule §2).
- P1 Provenance pill on dashboard rows when fallback feed fired.
- P2 SWR caching + snapshot fallback for upstream 502s, explorer
  fallback links.
- ERC-8004 three-registry implementation, all six contracts
  Sourcify `perfect`, all three registries actively written
  every cycle.
- Foundry property/fuzz tests for the three ERC-8004 registries
  including formal AND-of-four-gates proof.
- Snyk SAST + SCA clean.
- Nansen API key rotated to paid tier (smart_traders_*,
  token_dex_trades, address_portfolio all 200; Smart Money
  Holdings block now in analyst prompt).

WORKSPACE HONESTY RULES (binding)

A workspace steering rule (`.kiro/steering/no-lying-about-state.md`)
governs every UI claim:
1. Live data must be scope-labelled (Your session / Historical /
   Cached).
2. No "Autonomous · 24/7" copy unless cron is observably alive.
3. No phantom PnL — all displayed PnL must reduce to on-chain
   settled outcomes.
4. Animation is allowed; fake liveness is not.
5. Every integration claim must point to a verifiable artefact
   (TX, IPFS CID, contract event), or be labelled "Demo /
   Simulated / Paper-ready".

Any recommendation that requires us to break these rules is
out of scope. Recommendations should explicitly state how the
new claim will be made verifiable.

KNOWN COMPETITORS (verify against DoraHacks listings)

- AgentBank V3 (track: Agentic Wallets & Economy, $8.5k 1st):
  138+ mainnet TXs, 40+ contracts, Phala Intel SGX TEE
  attestation, multi-LLM ensemble, ERC-4626 vault, Telegram
  Mini App. Different track from us. Their TEE narrative is
  the closest competitor to our Reproducible AI / on-chain
  anchor narrative — please look up their current submission
  state and identify what they have that we don't, and what
  we have that they don't.

- Other AI x RWA Track entries on
  https://dorahacks.io/hackathon/turing-test-2026/buidl —
  please enumerate the top 10–15, identify which have:
  • A live on-chain agent (not just a contract) that runs
    on a public schedule.
  • An ERC-8004 implementation (Identity + Reputation +
    Validation, all written each cycle).
  • A reproducible-AI / proof-of-reasoning primitive.
  • A working RWA execution path (not just a frontend mock).
  • A dashboard that survives a Mantlescan 502.
  Identify exactly which differentiators each rival project
  is leaning on, and where they are weaker than us.

CONSTRAINTS — what we will NOT do

- No contract redeploy. Sourcify `perfect` status across 6/6 is
  load-bearing and breaks deployer history. Anything new must
  fit existing storage slots or be a new (additional) contract.
- No Phala TEE / hardware attestation. Our Reproducible AI
  narrative is hardware-vendor-free on purpose.
- No multi-DEX aggregator (Odos / 1inch). Previous audit
  explicitly DEFER'd this. Merchant Moe is enough for the
  RWA narrative.
- No new chain (cross-chain, LayerZero) — out of AI x RWA scope.
- No ERC-4626 vault — we use EOA + custodial pattern; vault
  contract is roadmap-only.
- No ve-tokenomics, no token launch, no Telegram Mini App.
- No re-implementation of any feature already shipped (see
  "WHAT IS ALREADY SHIPPED" above).
- We will not break the workspace honesty rules — every new
  claim needs a verifiable artefact, or is labelled demo.

PRE-FLIGHT — READ THESE FIRST (before forming any opinion)

You MUST read these files before writing the report. They are
the single sources of truth for what is shipped vs what is
described.

Tier 1 — read in full:
  .kiro/SUBMISSION-CHANGELOG.md           — running log of every
                                            shipped change with
                                            FOR PITCH tags
  .kiro/steering/no-lying-about-state.md  — binding honesty rules
  .kiro/steering/hackathon-context.md     — track strategy & deadline
  .kiro/steering/audit-style.md           — how to audit live system
  README.md                               — public claims grid
  agent-card-v2.json                      — ERC-8004 metadata
                                            (NOTE: stats block is
                                            stale, dated 2026-05-26)

Tier 2 — read the most recent ten audits:
  .kiro/audits/12-snyk-security-scan.md
  .kiro/audits/13-competitive-and-claims-recheck.md
  .kiro/audits/14-erc8004-coverage-and-claims-fix.md
  .kiro/audits/15-foundry-fuzz-coverage.md
  .kiro/audits/16-reproducible-ai-capture.md
  .kiro/audits/17-heartbeat-mode.md
  .kiro/audits/18-onchain-anchor-replay-manifest.md
  .kiro/audits/19-blind-grid-rate-limit.md
  .kiro/audits/20-blind-prices-second-layer.md
  .kiro/audits/21-smart-wallet-router.md

Tier 3 — read these code paths to ground every recommendation:
  src/orchestrator/multiAgent.js          — three-model consensus
  src/orchestrator/multiAgentLoop.js      — main cycle, recently
                                            heavily edited (smart
                                            router + provenance)
  src/orchestrator/disciplineLayer.js     — post-execution gates
  src/orchestrator/heartbeatMode.js       — gated liveness path
  src/orchestrator/outcomeTracker.js      — settled-PnL writer
  src/orchestrator/unifiedMarketData.js   — DO NOT REFACTOR — operator
                                            explicitly preserved
                                            Nansen logic here
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
  frontend/app/api/health/route.ts        — freshness probe
  frontend/app/api/decisions/route.ts     — provenance + offset lookup
  frontend/app/lib/live-status.shared.js  — LIVE/IDLE/STALE/OFFLINE
                                            threshold logic
  frontend/app/replay/[id]/page.tsx       — public verification page

Tier 4 — open specs (triage these as part of section 9 below):
  .kiro/specs/rwa-allocation-active/requirements.md
  .kiro/specs/rwa-allocation-active/tasks.md
  .kiro/specs/design-enhancement/tasks.md
  .kiro/specs/system-audit-pre-submission/tasks.md

RUN THESE COMMANDS — verify state against my claims

Before forming the report, run and report exit codes + summary:

  npx jest --silent
    Expected: 256/256 passing, 17 suites.
  npx eslint src/ --max-warnings 50
    Expected: 0 errors, 47 warnings (all pre-existing).
  cd frontend && npm run lint
    Expected: 0 errors, 17 warnings.
  cd frontend && npx tsc --noEmit
    Expected: clean.
  cd frontend && npx next build
    Expected: clean, 24 routes.
  forge test --no-match-path "test/foundry/integration/**" -vv
    Expected: 29 tests passing across 3 files; 11 of them are fuzz
    tests with default 1024 runs locally.

If any of these diverge from the expected state, that is a P0
finding regardless of any other recommendation.

Also verify live surfaces from your environment (curl is fine):

  https://frontend-seven-beta-46.vercel.app/api/health
    -> JSON with lastCycleAge, mode, parseSuccessRate24h.
       lastCycleAge < 90 minutes => LIVE/IDLE/STALE band acceptable.
  https://frontend-seven-beta-46.vercel.app/api/decisions
    -> recent cycles array; check that latest row has txHash,
       reasoningCid, and (if a fallback feed fired) priceSource +
       candleSource fields populated.
  https://frontend-seven-beta-46.vercel.app/api/performance
    -> realised PnL block; check it is grounded in outcomes, not
       phantom NAV.
  Mantlescan or explorer.mantle.xyz for contract events on
    DecisionLog (0x7bCd...fbB5) and ValidationRegistry
    (0x6841...63b6) — confirm cycles ≥ 149 carry the new
    combinedAnchor (audit 18) in DecisionLog.txHash, NOT the
    legacy keccak256(ipfsCid) value.
  Sourcify status for all six contract addresses listed above.

CLAIMS-GRID CROSS-CHECK (binding output)

The README has a 10-row claim grid (Judge's Verification Path).
For EACH row, produce a verdict:
  • Code path that backs it (file + symbol).
  • Live artefact that proves it (URL, TX, contract address).
  • Failure-mode for a judge in <60 seconds (what could break,
    e.g. Mantlescan 502, Pinata gateway down, cron skipped).
  • Proposed fortification (link to redundant artefact, fallback
    URL, etc.).
A claim with no concrete code path or no live artefact is a
P0 honesty-rule finding. Flag it.

WHAT WE NEED FROM YOU

A prioritised, hackathon-rubric-driven recommendation set with
the following structure. Skip generic advice; we need concrete,
implementable moves.

1. RUBRIC GAP ANALYSIS
   For each of the four scoring axes — AI x RWA depth, technical
   completeness, Mantle integration, compliance/regulatory
   awareness — and for the 40% Real-World Validity bucket
   (asset category, target users, complete UX), score where
   TuringVault currently sits (1–10) and where the maximum-
   realistic-by-deadline score is. Identify the single biggest
   gap on each axis.

2. DIFFERENTIATION MOVES (top of "must-do" list)
   What 3–5 product moves would meaningfully separate
   TuringVault from every other entry in the AI x RWA track
   AND from cross-track competitors like AgentBank V3?
   For each move:
   • Effort estimate in solo-dev hours.
   • Impact on rubric (which axes does it lift, by how much).
   • Risk profile (what could go wrong before deadline).
   • Verification path — how does a judge confirm it from a
     public URL or on-chain artefact in <60 seconds.
   • Whether it requires a new contract (we strongly prefer
     "no").

3. STABILISATION / RELIABILITY
   What failure modes are most likely to derail a judge's
   demo session in the final 17 days? Candidates we are aware
   of: Mantlescan 502s (mitigated by SWR + explorer fallback
   links — already shipped), Vercel cold-start, GitHub Actions
   schedule slips, Bedrock rate limits, Pinata pin failures.
   What other failure modes should we add monitoring for?
   What single endpoint should be on a public uptime monitor
   (e.g. UptimeRobot) and surfaced as a status badge in the
   README?

4. NARRATIVE / PITCH
   Re-read the README at
   https://raw.githubusercontent.com/USBVadik/TuringVault-Core/main/README.md
   and the agent card at
   https://raw.githubusercontent.com/USBVadik/TuringVault-Core/main/agent-card-v2.json
   (note: agent-card-v2.json carries an outdated 2026-05-26
   snapshot; we know we need to refresh it). Identify three
   narrative weaknesses or under-claims. For each, propose
   the exact replacement copy. Keep it grounded in the
   honesty rules — every claim must point to an artefact.

5. RWA-SPECIFIC DEPTH
   The track is AI x RWA, not generic DeFi. Where can we
   meaningfully deepen the RWA story in 1–2 days of work?
   Candidates we are open to:
   • USDY pool reactivation (currently dry on Mantle — is
     there a partner inquiry path? What is the MM
     bootstrapping minimum?).
   • Adding a second tokenized-Treasury asset that IS live on
     Mantle (research: which products are actually executable
     on-chain right now — Ondo, Backed, Maple, Ondo Vault, etc.).
   • A clearer "asset category" framing for the rubric's 40%
     Real-World Validity score (the rubric explicitly weights
     this).
   • Better target-user definition — who is the end user for
     a TuringVault portfolio? DAO treasury? On-chain fund?
     Retail saver? Pick one and surface it on the homepage.

6. ERC-8004 ANGLE
   ERC-8004 is one of the three defining features in the
   Mantle brief. We have the canonical three-registry stack
   actively written each cycle. Search for: (a) other
   ERC-8004 implementations across DeFi (likely sparse —
   the EIP is recent), (b) any Mantle Foundation
   public statements positioning ERC-8004 as a track
   priority, (c) whether any judge-facing ERC-8004 verifier
   tooling exists that we could integrate (status dashboard,
   schema validator, identity resolver). If we are the only
   live implementation, name that explicitly.

7. SHIP-OR-SKIP FOR EACH UNCLAIMED ITEM
   For each of the following potential moves, give a clear
   SHIP / DEFER / SKIP verdict with one-sentence justification
   tied to the deadline budget:
   • Submission text refresh on DoraHacks (Buidl description).
   • Pitch deck slide refresh.
   • Demo video re-record.
   • Live realised-PnL refresh on /backtest (already shipped
     surface, but data may be stale — verify).
   • README claim-grid number drift fix (147+ → 155+).
   • Agent-card snapshot refresh on IPFS + on-chain
     tokenURI (Identity NFT).
   • Public uptime monitor + README status badge.
   • One-page "How to verify TuringVault in 60 seconds"
     explainer for judges.
   • Ondo / partner outreach for USDY pool depth (low
     probability but high asymmetric upside).
   • Anything else you find from the live system probe.

8. CODE-LEVEL INVESTIGATION (only possible with repo access)
   Use your repo read access to find issues a deep-research-only
   model cannot:
   • Orphaned files / dead code under src/. Run a quick reachability
     analysis from `node scripts/run-cycle.js` and the cron entry
     point. Anything in src/ that is not transitively reachable
     and not under tests/ should be flagged for deletion (reduces
     audit surface for judges, demonstrates project hygiene).
   • TODO / FIXME / XXX comments in src/ and frontend/. List the
     top 10 by importance — anything in critical path (multiAgent,
     execution engine, walletRouter, outcomeTracker, disciplineLayer)
     is automatically P1. Quote the comment + file:line.
   • Guard rails on self-evolving prompts. Read `src/evolution/`
     and `src/orchestrator/multiAgent.js` and confirm the
     `FORMAT_GUARD_SUFFIX` is actually appended, the validator
     prompt is genuinely operator-only, the IPFS pin happens
     before mutation, and `EVOLVED_PROMPTS_ENABLED` defaults off.
     If any of these can be bypassed, that is P0.
   • Prompt-injection paths. Trace every external string that
     reaches an LLM prompt: Nansen `top_buying[].symbol`, Elfa
     mentions, CoinGecko ids, news headlines if any. Confirm
     each is sanitised at unlimited recursion depth (audit
     61abaae). Find any new path added since.
   • Race conditions. Two specifically:
       (a) cron writes outcomes.json while frontend reads it
           via /api/decisions. Is the writer atomic (tmpfile +
           rename), or does a partial write surface a corrupt
           JSON to a judge?
       (b) Two cron runs overlapping (e.g. :17 slot delayed past
           :47). Is there a lock file, or could two runs
           double-submit a proposal with the same nonce and
           waste gas?
   • Secret leakage. Grep all .json under src/data/ and
     .kiro/audits/raw/replay-manifests/ for anything shaped like
     an AWS key, GCP key, Pinata JWT, Nansen key, RPC URL with
     ?apiKey=. Manifests get committed publicly — anything that
     leaks here goes straight to GitHub.
   • Frontend trust boundary. Does any /api route in
     frontend/app/api accept user input that could trigger an
     unauthenticated on-chain TX or unbounded outbound fetch?

9. SPECS TRIAGE
   The following specs are open in the operator's editor and may
   be partially abandoned mid-implementation:
     .kiro/specs/rwa-allocation-active/
     .kiro/specs/design-enhancement/
     .kiro/specs/system-audit-pre-submission/
   For each, read requirements.md + tasks.md, cross-reference
   tasks against actual git log + code, and classify:
     KEEP    — actively shaping work, tasks still meaningful.
     ARCHIVE — completed, move to .kiro/specs/_archive/.
     DELETE  — superseded or abandoned, prune to reduce noise.
   For KEEPs, identify the single highest-leverage next task and
   say what completing it would lift on the rubric.

10. THINGS YOU SAW THAT WORRY YOU
    List anything you noticed while probing the live system or
    code that is not on our radar. Be ruthless. Examples of the
    kind of finding worth raising:
    • a log line that prints a private value;
    • an exception swallowed silently in a critical path;
    • a unit test that passes by mocking the very thing it claims
      to test;
    • a contract event that nothing reads;
    • a frontend component that hard-codes a value the API
      returns honestly elsewhere;
    • a staleness indicator (a timestamp on the homepage hero,
      a version label, a "last update" claim) that doesn't bind
      to a freshness check.

OUTPUT FORMAT

Markdown. Use the section headings above. Inside each, use
short paragraphs and bullet lists with hours estimates and
verification paths. End with a single triaged recommendation
table:

  | Priority | Move | Hours | Rubric lift | Verification path | New code? | Honesty risk |

Sort by Priority/Hours ratio descending — what to ship first.

For "New code?" mark Y/N. For Y, give the file path you would
add or modify. For "Honesty risk" mark how a recommendation
could end up violating the workspace honesty rules if executed
sloppily, and how to avoid that.

Cap output at ~5000 words. Cite sources (file:line for code
claims, full URL for external claims, contract address + event
signature for on-chain claims).

DO NOT touch the repo while researching. Read-only mode for
this run. After we triage your output we will pick what to
implement. Implementation belongs to the operator's main agent,
not this audit pass.
```

---

## After running: triage rules

When Gemini's output lands:

1. Cross-check every claim against the live surfaces ourselves
   (Mantlescan, /api/health, Sourcify). Steering rule §6 — "no
   external claim survives un-verified".
2. Bucket each recommendation:
   - P0 = ships in ≤4h AND lifts a rubric axis we know we are
     weak on AND has a clear verification path. SHIP.
   - P1 = ≤8h AND lifts narrative/UX clarity. SHIP if budget
     allows after P0.
   - P2 = >8h or speculative ROI. DEFER, document in this audit
     under "considered, deferred".
   - SKIP = breaks honesty rules, requires contract redeploy,
     duplicates already-shipped work, or out of AI x RWA scope.
3. Append every shipped item to `.kiro/SUBMISSION-CHANGELOG.md`
   with the standard "FOR PITCH" tag if pitch-relevant.
4. Save Gemini's raw response to
   `.kiro/audits/raw/22-deep-research/gemini-<timestamp>.md`.

## Notes for self

- Don't run the prompt against a non-deep-research model — we
  need web access for the competitor enumeration step.
- If Gemini surfaces a P0 that requires a contract redeploy,
  reject it on the spot. Sourcify `perfect` × 6 is too valuable.
- Treat the rubric-gap-analysis section as the single most
  valuable output. Even if we ship nothing else, knowing where
  the rubric thinks we are weak is the highest-leverage thing
  to learn this week.


---

## After running: Gemini's response (received 2026-05-29 ~19:30 UTC)

### What Gemini got right

- **Aave V3 Mantle integration** for idle USDT0 yield. Verified
  external sources: Aave V3 launched on Mantle Mainnet 11 Feb 2026,
  $1B+ TVL by Mar 2026, 4.17% supply yield on USDT0, supply cap
  $550M (Aave Risk Stewards 2026-04-15). This is a real wedge into
  the AI x RWA Track — closes the "no actual yield" gap.
  **Decision**: deferred to next session (operator wants the smart
  router test window to stabilise without introducing a second
  on-chain integration mid-test).

- **DAO Treasury target-user framing** for the 40% Real-World
  Validity rubric. **Shipped**:
  - Homepage hero subtitle replaced.
  - README "Who this is for" section added.
  - Both agent-cards now describe target user explicitly.

- **Number drift refresh** (147+ → 158+, 44% → 41%, agent-card
  snapshot 2026-05-26 → 2026-05-29 19:42 UTC, 4/5 Sourcify-verified
  → 6/6 Sourcify-verified `perfect`). **Shipped**:
  - `README.md` (claim grid, body, roadmap, project-structure).
  - `docs/pitch-deck/index.html` (4 stale numbers + Sourcify pill +
    operator footer).
  - `assets/agent-card.json` (full stats refresh + DAO description).
  - `agent-card-v2.json` (full stats refresh + DAO description).

- **FALLBACK_MARKET useMemo fix** in `frontend/app/page.tsx`.
  Wrapped object in `useMemo([])` and added the dep to the
  `fetchMarket` useEffect. Frontend lint went 17 → 15 warnings.

### What Gemini got wrong (rejected)

- **"CI Replay-Validator"** — already shipped (audit 18 +
  `.github/workflows/replay-validator.yml`). Gemini ignored the
  "do NOT re-recommend" pre-flight section.
- **"On-Chain Anchor of Replay Manifest Hash"** — already shipped
  (audit 18, combinedAnchor in DecisionLog.txHash + ReputationRegistry.reasoningHash).
- **"SWR KV Cache for Mantlescan"** — already shipped (SWR headers
  + module-scoped snapshot fallback, `x-vercel-cache: HIT` confirmed
  in production).
- **"Fix Grid Constraints (Force execution)"** — DANGEROUS. Would
  violate honesty rule §3 (no phantom PnL). Real root cause was
  CoinGecko 429 + WMNT depleted, both fixed in audits 19/20/21.
  Cycles 149-157 now produce real EXECUTED_SWAP TXs every cycle.
  Gemini was reading stale outcomes.json.
- **"Bot is barely trading: 4 swaps out of 145"** — stale. Latest
  9 cycles (149-157) all EXECUTED_SWAP per `/api/decisions`.
- **"`amountIn` unused in merchantMoe.js:341"** — false positive.
  `amountIn` is a parameter actively used in `getQuote`,
  `_getMultiHopQuote`, `executeSwap` (multiple `parseFloat`,
  `getSwapOut`, `swapExactTokensForTokens` references).

### Validation after edits

- jest: 256 / 256 passing (17 suites)
- ESLint src/: 0 errors / 47 warnings
- frontend lint: 0 errors / 15 warnings (was 17)
- TypeScript: clean
- next build: clean (24 routes)
- agent-card-v2.json: JSON valid
- assets/agent-card.json: JSON valid

### Deferred / re-classified to AVOID at submission scope

- Aave V3 Mantle integration (idle USDT0 → aUSDT0 supply path) was
  initially recommended by Gemini and forwarded by me to the
  operator without due diligence. Operator pushed back: "а ааве
  после взлома уже реабилитировались?" Subsequent research
  (2026-05-29) found:

  - 2026-03-10 CAPO oracle misconfig → $26M wstETH liquidations
  - 2026-04-18 KelpDAO bridge cascade → $200-230M Aave V3 bad debt,
    $6.6B liquidity drained in 24h, **Mantle was heaviest L2
    exposure**
  - Recovery still partial as of 2026-05-13 — bad debt resolution
    ongoing, $71M ETH return tied up in litigation

  Net verdict: **AVOID at submission scope.** Recommending we wire
  our cron's signing key into a protocol still in partial recovery
  six weeks before submission deadline is the exact integration
  shape our project's narrative exists to refuse.

  Full Risk panel + replacement plan (native yield path through
  mETH staking, no counterparty contract risk) appended as
  CORRECTION section in `.kiro/SUBMISSION-CHANGELOG.md`.

- New steering rule shipped this session to prevent recurrence:
  `.kiro/steering/external-integration-due-diligence.md` — every
  external on-chain integration recommendation must include a
  filled Risk panel with cited sources, defaulting to AVOID when
  research surfaces meaningful risk.
