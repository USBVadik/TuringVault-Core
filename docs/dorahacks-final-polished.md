# TuringVault DoraHacks Final Submission Copy

Observed live snapshot: 2026-06-11 07:09 UTC.

Refresh before final paste:
- Health: https://frontend-seven-beta-46.vercel.app/api/health
- Performance: https://frontend-seven-beta-46.vercel.app/api/performance
- Proof Explorer: https://frontend-seven-beta-46.vercel.app/api/proof-explorer

Demo video: https://youtu.be/AnLbnbW36ys

---

## Short Description

Accountable AI RWA portfolio application on Mantle. TuringVault combines multi-model consensus, ERC-8004-style identity/reputation, Proof-of-Reasoning anchors, and post-execution Discipline checks before AI-managed capital is trusted.

---

## Main Description

TuringVault is a proof-locked AI portfolio agent for Mantle-native RWA and yield allocation.

Most AI trading demos ask judges to trust the model after the fact. TuringVault is built around the opposite idea: before an AI agent can move capital, its reasoning, vetoes, execution status, and outcomes should be visible, replayable, and reputation-bearing.

The project is not just an autonomous trading bot. It is a verification layer for AI-managed capital.

### The Problem

DAO treasuries and on-chain funds face an uncomfortable tradeoff.

Human committees are slow, miss market windows, and cannot operate continuously. Autonomous agents can react quickly, but most of them are black boxes. After a bad allocation, an operator often cannot tell whether the loss came from normal market risk, stale data, weak reasoning, poor inventory state, or an AI hallucination.

That is especially dangerous for RWA allocation. RWA capital is supposed to be governance-grade, auditable, and explainable. A black-box agent managing that capital is the wrong primitive.

### The Product

TuringVault turns every AI portfolio decision into an auditable workflow:

1. The agent receives market, yield, technical, smart-money, and social context.
2. A primary analyst model proposes an action.
3. An independent validator challenges the thesis, risk/reward, regime fit, and portfolio state.
4. Deterministic safety gates can block the action before capital moves.
5. The reasoning chain is pinned off-chain and cryptographically anchored on Mantle.
6. Executed swaps are checked by the Discipline Layer for transaction proof, price freshness, and regime drift.
7. Settled outcomes update the agent's reputation and decision-quality history.

This makes refusal a first-class product outcome. A blocked trade is not hidden as a success, and an intent-only swap is not presented as execution. The UI separates executed swaps, blocked decisions, no-swap holds, and intent-without-execution states.

That distinction is the core of the project: AI-managed capital should be allowed to act, but first it has to prove why.

### Why This Fits The Mantle Turing Test

TuringVault's product layer is accountability infrastructure, but its AI & RWA track fit is **Path B: RWA Application** because it manages existing RWA/yield assets instead of issuing a new tokenized asset.

The Mantle Turing Test brief emphasizes three primitives: on-chain benchmarking of AI, agent identity/reputation, and radical transparency. TuringVault ships those as one live system.

**1. On-chain benchmarking of AI**

Each autonomous cycle produces public decision evidence. Proposal, validation, final decision tier, execution status, and settled outcome are exposed through the dashboard, Proof Explorer, Replay, Discipline Layer, APIs, and contract surfaces. The agent is not evaluated by a screenshot. It has a growing decision trail.

**2. Agent identity and reputation**

TuringVault includes ERC-8004-style identity, validation, reputation, and decision logging contracts on Mantle. Five production contracts are Sourcify perfect-match verified. The agent's identity, validation history, and reputation surfaces are not decorative metadata; they are connected to the live cycle pipeline.

**3. Radical transparency**

Judges can inspect the live dashboard, raw replay pages, the public GitHub Actions cron, contract events, and the proof explorer without asking the team for private logs. The reasoning itself is pinned off-chain, while Mantle stores tamper-evident anchors and registry state.

### Track Fit Under The Updated Scorecard

The strongest fit is **AI & RWA Track — Path B: RWA Application**.

TuringVault does not pretend to issue a new real-world asset token. Instead, it uses AI to manage and verify allocation across existing Mantle-native RWA/yield rails: USDT0 as the stable RWA allocation rail, mETH as the Mantle-native liquid-staking yield/risk leg, MNT/WMNT as native execution inventory, and a gated USDY module for when Mantle liquidity is usable.

That maps directly to the Path B prompt: a clearly defined asset set, a real user category, and an end-to-end experience from AI allocation intent to on-chain position and public proof.

The target users are DAO treasuries, on-chain funds, and compliance-conscious operators that want AI allocation without losing governance-grade evidence.

### Live Snapshot

The current public system is running on Mantle Mainnet with operator-funded demo capital.

Observed on 2026-06-11 at 07:09 UTC:

| Metric | Observed Value | Source |
| --- | ---: | --- |
| ValidationRegistry proposals / decision records | 455 | `/api/decisions` |
| Approved proposals | 332 | ValidationRegistry |
| Rejected proposals | 123 | ValidationRegistry |
| Pre-execution rejection rate | 27.0% | 123 / 455 |
| Settled outcomes | 358 | `/api/performance` |
| Settled win rate | 53.1% | `/api/performance` |
| Lifetime Decision-Quality Score | +5083 bps | settled outcomes, not wallet PnL |
| Realized wallet PnL claim | null | intentionally not claimed |
| Cron health, trailing 24h | 22 succeeded / 0 failed | `/api/health` |
| Parse success, trailing 24h | 100% | `/api/health` |
| Operator-funded NAV | about $139.88 | `/api/performance` |
| Gas runway | about 11.5 days | `/api/health.gasRunway` |

Latest risk-on proof: cycle 453 (`HEARTBEAT_SWAP`) executed USDT0 → USDT → WMNT with two Mantle transactions:

- https://mantlescan.xyz/tx/0xd736dbf6d268112ddbca8fae0067cd3605e8ad70b10d3f5eeeaeda1a91d82602
- https://mantlescan.xyz/tx/0xe12b24a14057ad7071b4ab8bf406f7219b88f3f2289145c7669b7e6525776a3e

This is labelled as heartbeat/liveness execution and is not blended into realized PnL.

Denominator note: DecisionLog rows and ValidationRegistry proposals are different contract surfaces. During a fresh cycle they can differ by one. The UI labels this instead of pretending all counters share one denominator.

### RWA And Mantle Asset Stack

TuringVault is built around Mantle-native allocation rather than generic off-chain portfolio simulation.

| Asset | Role | Status |
| --- | --- | --- |
| USDT0 | Treasury-collateralised stable allocation rail | Live |
| mETH | Mantle-native ETH liquid staking token, risk-on yield leg | Live |
| USDT | Stable risk-off floor | Live |
| MNT / WMNT | Mantle-native execution inventory and gas-adjacent liquidity | Live |
| USDY | Ondo tokenized Treasury module | Implemented, gated until usable Mantle liquidity returns |

We do not claim that USDT0 itself pays yield. It is treated as the stable RWA allocation rail. The yield-bearing risk leg is mETH, Mantle's own LST. USDY support exists in the codebase, but live execution is gated until pool depth is usable; the UI and copy label this as paper-ready, not active execution.

First verifiable RWA swap:
https://mantlescan.xyz/tx/0x0af23364c7651b053d33b0f7ed3eb8b30107b5dc489e96a7ad8ac90cad3e09de

### Compliance Awareness

TuringVault is intentionally scoped as an operator-funded demo and verification layer, not a public investment product.

- No public deposits are accepted.
- No yield or profit is promised.
- Current capital is controlled by an operator EOA for hackathon demonstration.
- USDT0 is described as a stable RWA allocation rail, not a yield product.
- USDY is implemented but gated until Mantle liquidity is usable.
- Before any public vault, the next milestone is policy enforcement: allowlists, KYC/AML checks, jurisdiction-aware eligibility, and human/governance approval for regulated asset access.

The AI can assist allocation, proof generation, and compliance-review workflows, but it does not bypass legal constraints.

### 20 Project Deployment Award Checklist

| Requirement | TuringVault status |
| --- | --- |
| Smart contract deployed on Mantle Mainnet or Testnet | Six contracts deployed on Mantle Mainnet |
| Contract verified on Mantle Explorer | Five production contracts Sourcify `perfect`; Router is deployed but labelled as source-drifted legacy helper |
| At least one AI-powered function callable/on-chain recorded | Every agent cycle writes proposal, validation, decision, and reputation evidence to Mantle; `/challenge` can submit adversarial validation proposals |
| Public frontend demo | https://frontend-seven-beta-46.vercel.app |
| Deployment address included in submission | DecisionLog, ValidationRegistry, ReputationRegistry, Identity NFT links below |
| Demo video at least 2 min | https://youtu.be/AnLbnbW36ys |
| Open-source repo with setup, architecture, deployed addresses | GitHub README + `docs/ARCHITECTURE.md` |

### Architecture

The live cycle is intentionally simple to audit:

1. **Trigger**: public GitHub Actions cron, best-effort schedule.
2. **Data ingest**: market prices, technical context, smart-money/sentiment inputs, yield context, and fallback provenance.
3. **Signal engine**: regime and grid context for mETH, MNT/WMNT, and stable inventory.
4. **Multi-model reasoning**: analyst proposes, validator challenges, arbiter resolves soft disagreements.
5. **Portfolio guard**: deterministic inventory rules block repeated risk-off or unsafe scale-ins.
6. **On-chain attestation**: proposal, validation, decision, and reputation evidence is written to Mantle surfaces.
7. **DEX execution**: only approved executable swaps can route through Merchant Moe / wallet router logic.
8. **Discipline Layer**: post-execution checks verify transaction proof, price freshness, and regime drift.
9. **Outcome settlement**: the decision is scored later against market movement and fed into reputation.

The important design choice is that the LLM is not the only safety layer. The system combines model judgement with deterministic guards and post-execution proof.

### Proof Surfaces

TuringVault exposes several independent ways to verify what the agent did.

| Surface | What A Judge Can Verify |
| --- | --- |
| Live dashboard | Current liveness, wallet exposure, latest decision tier, market regime |
| Proof Explorer | Recorded decisions, blocked reasons, executed swaps, intent-no-exec labels |
| Replay | Raw reasoning path and structured response for prior cycles |
| Discipline Layer | Whether swaps have transaction proof, fresh prices, and regime alignment |
| Challenge Arena | Adversarial prompts run through the same reasoning pipeline |
| GitHub Actions | Public cron history and cycle runs |
| Mantle contracts | DecisionLog, ValidationRegistry, ReputationRegistry, Identity NFT |
| APIs | `/api/health`, `/api/performance`, `/api/proof-explorer` |

### Why This Can Win

Most AI trading submissions try to impress with a chart. TuringVault's stronger claim is different: it makes AI economic behavior inspectable.

The valuable primitive is not "the model bought the right asset once." It is a repeatable process where a DAO can ask:

- What did the agent see?
- What did it propose?
- Who challenged it?
- Why was it accepted or rejected?
- Did a transaction actually happen?
- Can the reasoning be replayed later?
- Did the decision improve or damage the agent's reputation?

That is the missing infrastructure layer for AI-managed RWA portfolios. It is also a better long-term wedge than a black-box bot with a temporary performance chart.

### Judge Verification Path

Open these in order:

1. Demo video: https://youtu.be/AnLbnbW36ys
2. Live dashboard: https://frontend-seven-beta-46.vercel.app
3. Proof Explorer: https://frontend-seven-beta-46.vercel.app/proof-explorer
4. Replay: https://frontend-seven-beta-46.vercel.app/replay
5. Discipline Layer: https://frontend-seven-beta-46.vercel.app/discipline
6. Challenge Arena: https://frontend-seven-beta-46.vercel.app/challenge
7. Public cron: https://github.com/USBVadik/TuringVault-Core/actions/workflows/agent-cycle.yml
8. DecisionLog: https://explorer.mantle.xyz/address/0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5
9. ValidationRegistry: https://explorer.mantle.xyz/address/0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6
10. ReputationRegistry: https://explorer.mantle.xyz/address/0xC78119F3274B05046Ac7c38a14298a6cbD946e1a
11. Identity NFT: https://explorer.mantle.xyz/address/0x6f862802e0d5463DF18d267e422347BeCacc28bD

### What We Do Not Claim

The project is intentionally explicit about its limits:

- We do not claim realized wallet PnL. The performance metric is a Decision-Quality / Outcome Score from settled outcomes.
- We do not claim every cycle is a swap. Swaps are a subset of cycles.
- We do not claim public deposits. Current capital is operator-funded demo capital.
- We do not claim perpetual liveness. GitHub Actions cron is best-effort; `/api/health.lastCycleAge` is the source of truth.
- We do not claim live USDY execution. USDY is implemented but gated until usable Mantle liquidity returns.
- We do not claim full reasoning text is stored directly on-chain. Reasoning is pinned off-chain; Mantle stores cryptographic anchors and registry state.

TuringVault's core claim is narrower and stronger: AI-managed capital should be challengeable, replayable, and accountable before it scales.

---

## Link Fields

- GitHub: https://github.com/USBVadik/TuringVault-Core
- Demo video: https://youtu.be/AnLbnbW36ys
- Live app: https://frontend-seven-beta-46.vercel.app
- Proof Explorer: https://frontend-seven-beta-46.vercel.app/proof-explorer
- Replay: https://frontend-seven-beta-46.vercel.app/replay
- Discipline: https://frontend-seven-beta-46.vercel.app/discipline
- Challenge: https://frontend-seven-beta-46.vercel.app/challenge
