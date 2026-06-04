# TuringVault — Proof-of-Reasoning for AI RWA Allocation on Mantle

**Mantle Turing Test 2026 · AI x RWA Track**

> _A world where no AI agent allocates RWA capital without surviving adversarial multi-agent challenge first — and where black-box trading bots are as unacceptable as unsigned transactions. Proof-of-Reasoning becomes the default, not the feature._

---

## 🎯 The 60-Second Pitch

When an autonomous AI agent allocates RWA capital, there is no audit trail for its reasoning. A DAO treasury delegating to an agent has to choose between trusting a black box or skipping AI entirely. RWA assets demand accountability — that is what makes them RWA in the first place.

**TuringVault is the first AI agent on Mantle that proves every RWA allocation survived adversarial multi-model challenge AND replay-verifiable cryptographic capture BEFORE execution.**

Not a black-box trading bot — an accountable RWA portfolio manager (mETH staking yield + USDT0 Treasury-collateralised allocation + risk-gated rebalancing) where every alpha-seeking decision is sealed on-chain by a `bytes32` anchor that any judge can recompute and verify in 60 seconds.

---

## 🏛️ Target Users — Built for DAO Treasuries

DAO treasuries rebalancing into RWA need **audit-proof decisions for governance review**, not "trust me bro" PnL screenshots.

- DeFi-native funds with RWA allocation mandates → on-chain evidence the AI didn't drift off-thesis
- Compliance-conscious operators → every allocation has IPFS-pinned reasoning AND on-chain hash anchor
- Solo treasury operators afraid of black-box delegation → can replay any past decision against the original LLM provider

**Why now:** April 2026 KelpDAO/Aave bridge cascade left $200M+ bad debt across L2 lending markets. DAOs are pulling stablecoins out of opaque yield wrappers. The market wants accountability primitives, not new wrappers.

---

## ⚖️ Judge's 60-Second Verification Path

| # | Claim | Open this |
|---|-------|-----------|
| 1 | **288 DecisionLog rows on Mantle Mainnet** (2026-06-04 16:15 UTC snapshot; live count grows every cycle) | [DecisionLog events](https://explorer.mantle.xyz/address/0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5) |
| 2 | **ERC-8004 three-registry implementation** (Identity + Reputation + Validation) — **actively written every cycle**, not vestigial | [Identity](https://explorer.mantle.xyz/address/0x6f862802e0d5463DF18d267e422347BeCacc28bD) · [Reputation](https://explorer.mantle.xyz/address/0xC78119F3274B05046Ac7c38a14298a6cbD946e1a) · [Validation](https://explorer.mantle.xyz/address/0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6) |
| 3 | **76 of 289 ValidationRegistry proposals rejected before execution** — adversarial validator + 4-gate AND consensus | [`totalRejected()` / `totalProposals()`](https://explorer.mantle.xyz/address/0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6) → 76 / 289 |
| 4 | **First RWA swap end-to-end** | [TX `0x0af2336…3e09de`](https://mantlescan.xyz/tx/0x0af23364c7651b053d33b0f7ed3eb8b30107b5dc489e96a7ad8ac90cad3e09de) on Merchant Moe LB v2.2 |
| 5 | **Reproducible AI** — replay any past decision · cryptographic anchor verified live against Mantle Mainnet | [`/replay`](https://frontend-seven-beta-46.vercel.app/replay) — public verification page · zero AWS/GCP keys required |
| 6 | **Daily CI Replay Validator** — random cycle re-checked autonomously | [Replay Validator workflow](https://github.com/USBVadik/TuringVault-Core/actions/workflows/replay-validator.yml) — green = system honest |
| 7 | **Lifetime Decision-Quality / Outcome Score** — `+4342 bps` across `196` settled outcomes | [`/backtest`](https://frontend-seven-beta-46.vercel.app/backtest) — outcome-score curve built from settled decision outcomes; not wallet PnL |
| 8 | **Discipline Layer** — 3-gate post-execution proof | [`/discipline`](https://frontend-seven-beta-46.vercel.app/discipline) |
| 9 | **Adversarial Challenge Arena** — probe the agent yourself | [`/challenge`](https://frontend-seven-beta-46.vercel.app/challenge) — 4 attack vectors live against the real pipeline |
| 10 | **Native staking yield surface** — mETH LST yield labelled honestly (realised vs projected) | [`/api/yield-meth`](https://frontend-seven-beta-46.vercel.app/api/yield-meth) |
| 11 | **Public cron schedule** — best-effort hourly, observable | [Agent Cycle workflow](https://github.com/USBVadik/TuringVault-Core/actions/workflows/agent-cycle.yml) |

> Honesty rule: every numeric stat traces to a contract read or a settled outcome. Enforced as a workspace steering rule in [`.kiro/steering/no-lying-about-state.md`](https://github.com/USBVadik/TuringVault-Core/blob/main/.kiro/steering/no-lying-about-state.md).

---

## 🧬 The Three Defining Features (from the Mantle brief)

### 1️⃣ On-Chain Benchmarking — every decision recorded on Mantle

Every cycle writes **4 on-chain attestations** plus 1-3 swap legs:

- `submitProposal` (analyst's allocation)
- `submitValidation` (challenger's verdict)
- `logDecision` (final decision with `combinedAnchor` bytes32)
- `submitFeedback` (reputation delta) + `recordPnL` on settlement

**288 DecisionLog rows** logged in the 2026-06-04 16:15 UTC snapshot. **76 of 289 registry proposals rejected before execution** = **26.3% rejected before execution**. _Rejection-with-proof is a first-class output, not a failure mode._

### 2️⃣ ERC-8004 Agent Identity — _actively_ written, not static metadata

Most ERC-8004 implementations on hackathons are static profile NFTs. Ours is alive:

- **`TuringVaultIdentity`** — non-transferable agent NFT; `tokenURI` auto-refreshes to the current IPFS-pinned Agent Card every cycle
- **`TuringVaultReputationRegistry`** — `submitFeedback(reasoningHash)` per cycle + `recordPnL` on settled outcomes
- **`TuringVaultValidationRegistry`** — `submitProposal` + `submitValidation` per decision
- **`TuringVaultDecisionLog`** — immutable history; carries the `combinedAnchor` bytes32 (see Reproducible AI below)

**5 of 6 contracts Sourcify-verified `perfect`** on Mantle Mainnet (the sixth, an early-iteration helper Router, has source drift post-deploy and is not on the production execution path; we explicitly do _not_ redeploy because perfect status of the verified five is load-bearing).

### 3️⃣ Radical Transparency — replay any cycle in 60 seconds, no keys required

The defining differentiator. Every multi-agent cycle writes:

```
combinedAnchor = keccak256( utf8(ipfsCid) ‖ bytes32(manifestHash) )
```

into both `DecisionLog.txHash` AND `ReputationRegistry.reasoningHash`. The manifest itself (full prompts + raw model responses for analyst, validator, arbiter) is committed to the public git repo:

🔗 [`.kiro/audits/raw/replay-manifests/cycle-NNNN.json`](https://github.com/USBVadik/TuringVault-Core/tree/main/.kiro/audits/raw/replay-manifests)

**Three independent verification paths for every cycle:**

1. **Server-rendered `/replay/<cycle-id>` page** — live anchor recomputation, side-by-side prompts vs raw model responses, Mantlescan tx link. _No AWS/GCP keys required._
2. **Daily CI Replay Validator** — picks a random recent cycle, recomputes the binding, asserts on-chain match. Green badge = system is honest.
3. **Local `npm run replay <cycle-id>`** — full Bedrock + Vertex round-trip for full sceptics.

> **Hardware-independent proof surface.** AgentBank V3's TEE narrative requires trusting Phala + Intel SGX. TuringVault uses Mantle contract writes, IPFS content addressing, replay manifests, and public cron logs. The current orchestrator is still an application-level trust boundary, but the evidence it emits is public and tamper-evident after anchoring.

---

## 💎 Asset Category — RWA Allocation on Mantle

| Asset | Type | Status | Pool / Source |
|---|---|---|---|
| **USDT0** (`0x779D…3736`) | Treasury-collateralised stablecoin (LayerZero omnichain Tether) | ✅ **Active** | Merchant Moe LB v2.2 (binStep=1) |
| **mETH** (`0xcDA8…0bb0`) | ETH liquid staking yield (Mantle native LST) | ✅ **Active · Yield surfaced honestly** | Native mETH protocol (rate via DefiLlama → meth.mantle.xyz → L1 RPC chain) |
| **USDT** (`0x201E…956aE`) | Stable risk-off floor | ✅ Active | Native bridged |
| **USDY** (Ondo Finance tokenized US Treasuries) | ~3.55% APY (live as of 2026-05-23 per AprScope) | 🟡 **Paper-ready · gated off** until Mantle pool depth recovers | Module ships; swap path throws `RWA_POOL_INACTIVE` |

**USDT0 is the live RWA target.** We never claim USDT0 itself yields — it is a Treasury-collateralised peg surfaced honestly. The yield comes from **mETH staking** (Mantle's own LST). Both yield streams labelled separately on the homepage, never visually combined.

**First RWA swap (verifiable on Mantlescan):** [`0x0af2336…3e09de`](https://mantlescan.xyz/tx/0x0af23364c7651b053d33b0f7ed3eb8b30107b5dc489e96a7ad8ac90cad3e09de) — 25 USDT0 → 25 USDT through Merchant Moe LB v2.2.

---

## 📊 Live State (observed from live API on Mantle Mainnet, chain 5000, 2026-06-04 16:15 UTC)

```
DecisionLog rows           288
Validation proposals       289
Approved                   213
Rejected                    76   (26.3% rejected before execution)
Settled outcomes           196   with grading
Decision-Quality Score +4342 bps
Methodology          Outcome score from settled decisions; not realized wallet PnL
realizedTradingPnlBps      null   intentionally, because wallet PnL is not claimed
Win rate (settled)        58.2%
Parse success (24h)        100%
Cron cycles (24h)          32 ran / 0 failed  (agent cycles, not trades)
NAV                      $151.31  operator-funded demo capital, not claimed trading profit
Holdings split           USDT0 46% · MNT/WMNT 36% · mETH 18%
```

**Wallet:** [`0xDC78…fb5a`](https://mantlescan.xyz/address/0xDC783CDBfA993f3FC299460627b204E83bf4fb5a)

| Contract | Address | Sourcify |
|---|---|---|
| `TuringVaultIdentity` (ERC-8004) | [`0x6f86…28bD`](https://repo.sourcify.dev/contracts/full_match/5000/0x6f862802e0d5463DF18d267e422347BeCacc28bD/) | ✅ perfect |
| `TuringVaultReputationRegistry` (ERC-8004) | [`0xC781…6e1a`](https://repo.sourcify.dev/contracts/full_match/5000/0xC78119F3274B05046Ac7c38a14298a6cbD946e1a/) | ✅ perfect |
| `TuringVaultValidationRegistry` (ERC-8004) | [`0x6841…63b6`](https://repo.sourcify.dev/contracts/full_match/5000/0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6/) | ✅ perfect |
| `TuringVaultValidation` (helper) | [`0x0aeE…f705`](https://repo.sourcify.dev/contracts/full_match/5000/0x0aeEd88959fCFC665284225dB93DED3e8A3Ff705/) | ✅ perfect |
| `TuringVaultDecisionLog` | [`0x7bCd…fbB5`](https://repo.sourcify.dev/contracts/full_match/5000/0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5/) | ✅ perfect |
| `TuringVaultRouter` (early-iter helper, off-path) | `0x8187…7001` | 🟡 source drifted post-deploy · documented in [audit 26](https://github.com/USBVadik/TuringVault-Core/blob/main/.kiro/audits/26-honest-sourcify-recount.md) |

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                       TURINGVAULT SYSTEM                           │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│   1. TRIGGER · GitHub Actions cron (best-effort hourly, public log)│
│                                                                    │
│   2. DATA INGEST · Multi-source with disk-snapshot fallback        │
│      ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│      │CoinGecko│→│Binance  │→│HyperLqd │→│Snapshot │ │Nansen   │   │
│      │primary  │ │+Bybit   │ │last     │ │1h cache │ │MCP paid │   │
│      └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
│      Provenance pill on every dashboard row when fallback fires.   │
│                                                                    │
│   3. SIGNAL ENGINE                                                 │
│      RANGING · TREND_UP · TREND_DOWN · CONTRARIAN_LONG · CRISIS    │
│                                                                    │
│   4. TRIPLE-AGENT CONSENSUS (4-gate AND for execution)             │
│      ┌──────────────┐  ┌──────────────┐  ┌────────────────┐        │
│      │  ANALYST 🧠   │→│  VALIDATOR 🛡  │→│   ARBITER ⚖️   │        │
│      │  GLM-5       │  │  Claude 4.6  │  │  Gemini 3.5    │        │
│      │  Bedrock     │  │  Bedrock     │  │  Vertex AI     │        │
│      │  seeks alpha │  │  default REJ │  │  tiebreaker    │        │
│      └──────────────┘  └──────────────┘  └────────────────┘        │
│        validator hard-veto + soft-dispute arbiter + 4 gates        │
│                                                                    │
│   5. ON-CHAIN ATTESTATION (4 TXs/cycle, ~$0.05/cycle gas on Mantle)│
│      submitProposal → submitValidation → logDecision               │
│      → submitFeedback                                              │
│                                                                    │
│   6. REPRODUCIBLE AI ANCHOR                                        │
│      manifestHash = SHA-256(canonical(captures))                   │
│      combinedAnchor = keccak256(utf8(ipfsCid) ‖ manifestHash)      │
│      → DecisionLog.txHash AND ReputationRegistry.reasoningHash     │
│                                                                    │
│   7. EXECUTION (only if 4-gate AND passes)                         │
│      Smart Wallet Router picks source token (audit 21):            │
│      WMNT → wrap MNT → mETH fallback (capped, gas-reserve-safe)    │
│      Swap via Merchant Moe LB v2.2                                 │
│                                                                    │
│   8. DISCIPLINE LAYER · Synrail-inspired post-execution audit      │
│      Gate 1: TX confirmed on-chain                                 │
│      Gate 2: Price data <60s old at decision time                  │
│      Gate 3: Action aligns with declared regime                    │
│      Failure → outcome blocked + bounded repair                    │
│                                                                    │
│   9. SETTLE · 4h later, score against price delta, write Reputation│
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 🛡️ Consensus Design — 4-Gate AND, not single-vote REJECT

A common misread is "the validator must vote REJECT for a proposal to be blocked." That is not how the gate works. Adversarial here means **layered scrutiny**:

| Gate | Source | Threshold |
|---|---|---|
| 1 | Validator approves the proposal | binary |
| 2 | Analyst confidence | ≥ 60% (elevated to 85% after 3 consecutive losses) |
| 3 | Validator confidence | ≥ 75% |
| 4 | Risk score | ≤ 60 |

Probed over 50 recent cycles ([`scripts/audit/probe-validator-disagreement.js`](https://github.com/USBVadik/TuringVault-Core/blob/main/scripts/audit/probe-validator-disagreement.js)):

```
Total blocking outcomes:                  47 / 50 (94%)
BLOCKED_BY_LOW_CONFIDENCE                 21 (42%)
INTENT_SWAP_NO_EXEC                       12 (24%)
BLOCKED_BY_REGIME                          8 (16%)
BLOCKED_BY_VALIDATOR                       6 (12%)
EXECUTED_SWAP                              2 (4%)
HEARTBEAT_SWAP / unknown                   1 (2%)

Validator-flagged issues populated      52% of cycles
Arbiter fired (soft disagreements)       24% of cycles
```

**94% blocking rate via combined gates.** The validator is a structural reviewer with a final hard veto; confidence + regime gates are additional rejection mechanisms, and the arbiter only resolves soft confidence disputes. This matches how real-world risk committees work: multiple independent veto sources, none of which is a single point of judgement.

---

## ⚙️ Operational Honesty Surfaces

We hold ourselves to the same accountability standard we promote. Every claim below points to a verifiable artefact OR is explicitly labelled.

| Claim | Status | Evidence |
|---|---|---|
| AI consensus pipeline | ✅ Live | 288 DecisionLog rows in the 2026-06-04 16:15 UTC snapshot; live count grows every cycle |
| ERC-8004 identity + reputation | ✅ Live · 5/6 Sourcify perfect | Active writes per cycle |
| Replay-verifiable cryptographic anchor | ✅ Live | `combinedAnchor` in `DecisionLog.txHash` since cycle 147 ([audit 18](https://github.com/USBVadik/TuringVault-Core/blob/main/.kiro/audits/18-onchain-anchor-replay-manifest.md)) |
| Daily CI Replay Validator | ✅ Live | [Public workflow](https://github.com/USBVadik/TuringVault-Core/actions/workflows/replay-validator.yml) |
| Best-effort hourly cron | ✅ Live · 32 ran / 0 failed in the observed 24h window | Honest LIVE/IDLE/STALE/OFFLINE badge gated by `lastCycleAge`; cycles are decisions, not trades |
| IPFS reasoning pins | ✅ Live | Pinata, hash-anchored on Mantle |
| Discipline Layer 3-gate audit | ✅ Live | TX/freshness/drift gates fire each cycle |
| Multi-source data resilience | ✅ Live | CoinGecko → Binance/Bybit → Hyperliquid → disk snapshot, provenance per cycle ([audits 19/20](https://github.com/USBVadik/TuringVault-Core/blob/main/.kiro/audits/19-blind-grid-rate-limit.md)) |
| Smart wallet router (auto MNT-wrap) | ✅ Live · capped per cycle | [audit 21](https://github.com/USBVadik/TuringVault-Core/blob/main/.kiro/audits/21-smart-wallet-router.md) + [audit 28 cap fix](https://github.com/USBVadik/TuringVault-Core/blob/main/.kiro/audits/28-wrap-everything-bug-fix.md) |
| Heartbeat micro-swaps | ✅ Live · gated · separate `HEARTBEAT_SWAP` tier | Never aggregates with alpha-seeking outcome score ([audit 17](https://github.com/USBVadik/TuringVault-Core/blob/main/.kiro/audits/17-heartbeat-mode.md)) |
| mETH passive yield surface | ✅ Live · "realised" vs "projected/day" labels | [`/api/yield-meth`](https://frontend-seven-beta-46.vercel.app/api/yield-meth) |
| Self-evolving prompts | 🟡 Implemented · gated off | Default-off behind `EVOLVED_PROMPTS_ENABLED` flag while smoke tests confirm parse stability |
| USDY allocation | 🟡 Paper-ready | Module ships; swap path gated until Mantle pool reactivates |
| Vault contract for public deposits | 🟠 In development | Demo capital only · custodial EOA · documented |
| TEE attestation | ❌ Out of scope | Replaced by stronger Reproducible AI narrative (no hardware vendor) |

The dashboard mascot reports `OFFLINE` when cron is paused and `IDLE` when the last cycle is over an hour old. The copy avoids perpetual-liveness claims we cannot verify.

---

## 🧪 Quality Surface

```
✅ jest:                  276 / 276 passing  (19 test suites)
✅ Foundry property tests: 29 across 3 files (11 fuzz × 1024 runs ≈ 11k random invocations)
✅ ESLint src/:           0 errors / 48 warnings
✅ TypeScript --noEmit:   clean
✅ next build:            clean · 25 routes
✅ Snyk SAST + SCA:       clean (npm overrides for ws + postcss; re-scan 0 findings)
✅ EXECUTED_SWAP CI guard: enforced on every cron commit
```

**The audit folder is part of the submission.** The repo's [`.kiro/audits/` directory](https://github.com/USBVadik/TuringVault-Core/tree/main/.kiro/audits) carries 28 audit reports including:

- The trading-unblock investigation (cycles 113-122 silent fake EXECUTED_SWAP, caught by operator + fix-with-TX-hashes trail)
- The Sourcify recount honest correction (6/6 → 5/6 after independent re-probe)
- The wrap-everything wallet-drain fix
- An external-reviewer integrity check (we documented when an external review fabricated findings)

This is engineering culture as a feature, not a bug.

---

## 💡 The Wedge — Why This Wins on the AI x RWA Track Rubric

| Rubric axis (60% general · 40% Real-World Validity) | Our position |
|---|---|
| **AI x RWA Depth** | Native mETH yield surfaced honestly (realised vs projected) + USDT0 capital preservation + ERC-8004 reputation that mutates from settled outcomes. No counterparty contract risk on yield path |
| **Technical Completeness** | 5/6 Sourcify perfect · 276 tests · Foundry fuzz · CI invariant guard · multi-source data resilience · cryptographic replay verification |
| **Mantle Integration** | Native chain 5000 · mETH (Mantle's own LST) · MerchantMoe LB v2.2 · BybitWallet primary connector · ERC-8004 alignment with Mantle's agent infrastructure vision |
| **Compliance** | EOA custodial documented · demo capital · explicit "this is not a security" framing · USDT0 framed as Treasury-collateralised, not yield-bearing |
| **Asset category** (RWV) | Tokenized US Treasury exposure (USDT0) + native ETH staking (mETH) clearly delineated |
| **Target users** (RWV) | DAO treasuries explicitly framed in homepage hero + README + agent card |
| **Complete UX** (RWV) | 25 frontend routes · live mascot · /replay public verification · /discipline · /backtest live outcome-score curve · /challenge arena · honest provenance pills |

---

## 🥊 Adversarial Challenge Arena

A live `/challenge` page lets anyone inject 4 canonical attack vectors (flash crash, pump signal, oracle manipulation, sybil consensus) into the **real** multi-agent pipeline and watch the agents reason. Each result includes verbatim reasoning from GLM-5, Claude Sonnet 4.6, and when a soft confidence dispute occurs, Gemini 3.5 — the same code path that drives production.

When `CHALLENGE_ANCHOR_ENABLED=true`, each challenge submits one `ValidationRegistry.submitProposal` TX with a `[CHALLENGE-*]` action prefix. **A judge's session leaves an on-chain trail.**

🔗 [https://frontend-seven-beta-46.vercel.app/challenge](https://frontend-seven-beta-46.vercel.app/challenge)

---

## 🛠️ Tech Stack

- **Multi-agent consensus:** Z.ai GLM-5 (Analyst, AWS Bedrock) → Anthropic Claude Sonnet 4.6 (Validator, Bedrock) → Google Gemini 3.5 Flash (Arbiter, Vertex AI)
- **Contracts:** Solidity 0.8.28, OpenZeppelin, Hardhat, deployed via Hardhat Ignition
- **Backend orchestrator:** Node.js 22, ethers v6, GitHub Actions cron
- **Frontend:** Next.js 16, Tailwind, viem, RainbowKit (Bybit Wallet primary), deployed on Vercel
- **Storage:** IPFS via Pinata for reasoning blobs, on-chain hash anchoring
- **Data sources:** CoinGecko + Binance + Bybit + Hyperliquid (multi-source fallback chain), Nansen MCP (paid tier, 9 named tools), DeFiLlama TVL, Elfa V2 social
- **DEX:** Merchant Moe Liquidity Book v2.2 (concentrated liquidity)
- **RWA:** USDT0 (LayerZero omnichain, active) + USDY (Ondo, paper-ready)
- **Tests:** 276 jest + 29 Foundry property/fuzz + Hardhat + EXECUTED_SWAP CI invariant + daily Replay Validator CI

---

## 🎬 Demo

📹 **Video walkthrough:** add the final YouTube/Loom URL here after recording. Keep [`demo/demo-FINAL.mp4`](https://github.com/USBVadik/TuringVault-Core/blob/main/demo/demo-FINAL.mp4) as a repo fallback, not the primary judge link.
🌐 **Live dashboard:** [frontend-seven-beta-46.vercel.app](https://frontend-seven-beta-46.vercel.app/)
🔗 **Replay any cycle:** [/replay](https://frontend-seven-beta-46.vercel.app/replay)
📂 **Repository:** [github.com/USBVadik/TuringVault-Core](https://github.com/USBVadik/TuringVault-Core)
⚙️ **Live cron log:** [Agent Cycle workflow](https://github.com/USBVadik/TuringVault-Core/actions/workflows/agent-cycle.yml)
🤖 **Daily Replay Validator:** [workflow](https://github.com/USBVadik/TuringVault-Core/actions/workflows/replay-validator.yml)

---

## 🎯 Key Insight

> **The most valuable thing an AI RWA portfolio manager can do is prove _why_ it didn't allocate.**

For a DAO treasury reviewing an agent's behaviour, refusal-with-cryptographic-proof is more reassuring than profitable execution without a paper trail. Every blocked allocation with on-chain reasoning is stronger evidence of intelligence than another swap. **TuringVault makes this provable, replayable, and hardware-vendor-free.**

---

## ✅ Built for Mantle Turing Test 2026 — AI x RWA Track

Every numeric claim above traces to a contract read on Mantle Mainnet, an IPFS-pinned reasoning blob, a public GitHub Actions log, or a Sourcify-verified contract. Every "live" claim is gated by a freshness check. Every integration claim points to a verifiable artefact. Where something is paper-ready, demo-only, or out of scope, it is labelled — not hidden.

**The audit folder is part of the submission.** The standard we hold our judges to is the standard we hold ourselves to.
