# TuringVault DoraHacks Final Copy

Observed snapshot: 2026-06-11 06:02 UTC.
Refresh before final paste from:
- https://frontend-seven-beta-46.vercel.app/api/health
- https://frontend-seven-beta-46.vercel.app/api/performance
- https://frontend-seven-beta-46.vercel.app/api/proof-explorer
- Demo video: https://youtu.be/AnLbnbW36ys

---

## Short Description

Accountable AI RWA portfolio application on Mantle. TuringVault combines 3-model adversarial consensus, ERC-8004-style identity/reputation, Discipline Layer proof checks, and on-chain Proof-of-Reasoning anchors before capital moves.

---

## Long Description

TuringVault is an AI-powered RWA portfolio application and verification layer on Mantle. The project is not just another autonomous trading bot. It is a verification system for the moment an AI agent wants to allocate real capital.

DAO treasuries and on-chain funds should not have to choose between slow human committees and black-box AI. TuringVault gives them an agent whose market thesis, validator challenge, risk gate, execution status, and post-execution proof trail are all public, replayable, and anchored on Mantle.

The core idea is Proof-of-Reasoning:

- Full reasoning is pinned off-chain and captured in replay manifests.
- A cryptographic anchor is written on Mantle.
- Each proposal is challenged by an independent validator model before execution.
- Every accepted or rejected proposal updates public identity, validation, and reputation surfaces.
- Post-execution Discipline Layer checks verify whether a claimed transaction actually landed, whether price data was fresh, and whether the action matched the declared regime.

This makes refusal a first-class product outcome. A blocked unsafe proposal is not a failed demo. It is the exact behavior a DAO treasury wants from an accountable AI allocator.

Commercially, TuringVault is a verification and decision-governance rail for treasury teams that want AI allocation without losing auditability. The wedge is white-label infrastructure for Mantle yield and RWA portfolios: hosted agent operations, on-chain attestation, replay dashboards, and audit exports around capital the operator controls.

---

## Why This Fits AI & RWA Path B

TuringVault's product layer is accountability infrastructure, but its updated AI & RWA track fit is **Path B: RWA Application**. It does not issue a new tokenized asset; it manages existing Mantle-native RWA/yield rails and makes every AI allocation proposal challengeable, replayable, and anchored on-chain.

The Mantle Turing Test brief asks for on-chain benchmarking of AI, agent identity/reputation, and radical transparency. TuringVault ships all three as one live system:

1. On-chain benchmarking of AI
   Every autonomous cycle writes proposal, validation, decision, and reputation data to Mantle Mainnet. The 2026-06-11 06:02 UTC snapshot shows 453 DecisionLog rows and 454 ValidationRegistry proposals.

2. ERC-8004-style agent identity and reputation
   The agent has a non-transferable identity NFT, active ValidationRegistry writes, active ReputationRegistry feedback, and a DecisionLog. Five production contracts are Sourcify perfect-match verified on Mantle Mainnet.

3. Radical transparency
   Judges can open the live dashboard, Proof Explorer, Replay, Discipline Layer, GitHub Actions cron, and Mantlescan contracts without asking the team for private logs. The reasoning is not hidden behind a hosted backend claim.

---

## Live Snapshot

Observed from live APIs and Mantle Mainnet on 2026-06-11 06:02 UTC:

```text
DecisionLog rows                 453
ValidationRegistry proposals     454
Approved proposals               331
Rejected proposals               123  (27.1% rejected before execution)
Settled outcomes                 358
Win rate                         53.1%
Decision-Quality Score        +5083 bps
realizedTradingPnlBps            null
Methodology                      outcome score from settled decisions, not realized wallet PnL
Cron health, 24h                 23 ran / 0 failed
Last cycle age                   about 37 min in the observed snapshot
Parse success, 24h               100%
NAV                           $139.89 operator-funded demo capital
Gas runway                       low, about 11.6 days in the observed snapshot
```

Denominator note: DecisionLog rows and ValidationRegistry proposals are different contract surfaces. During a fresh cycle, the two counters can differ by one. The Proof Explorer now labels that difference explicitly.

---

## RWA Asset Stack

Active now:

- mETH: Mantle-native ETH liquid staking token, used as the risk-on yield leg.
- USDT0: Treasury-collateralised omnichain Tether, used as the stable RWA allocation target on Mantle.
- USDT: stable risk-off floor.
- MNT / WMNT: Mantle-native liquidity and gas-adjacent execution inventory.

Paper-ready / gated:

- USDY: Ondo tokenized Treasury module exists in the repo, but the Mantle route is gated until usable pool depth returns. We label it paper-ready instead of pretending it is live execution.

First verifiable RWA swap:
https://mantlescan.xyz/tx/0x0af23364c7651b053d33b0f7ed3eb8b30107b5dc489e96a7ad8ac90cad3e09de

Latest risk-on heartbeat proof:
https://mantlescan.xyz/tx/0xd736dbf6d268112ddbca8fae0067cd3605e8ad70b10d3f5eeeaeda1a91d82602
https://mantlescan.xyz/tx/0xe12b24a14057ad7071b4ab8bf406f7219b88f3f2289145c7669b7e6525776a3e

## Compliance Awareness

TuringVault is scoped as an operator-funded demo and verification layer, not a public investment product. It accepts no public deposits, promises no yield, labels USDY as gated/paper-ready, and keeps `realizedTradingPnlBps` null. Before any public vault, the next milestone is policy enforcement: allowlists, KYC/AML, jurisdiction-aware eligibility, and human/governance approval for regulated asset access.

---

## Judge Verification Path

Open these in order:

1. Live dashboard
   https://frontend-seven-beta-46.vercel.app

2. Proof Explorer
   https://frontend-seven-beta-46.vercel.app/proof-explorer

3. Replay verification
   https://frontend-seven-beta-46.vercel.app/replay

4. Discipline Layer
   https://frontend-seven-beta-46.vercel.app/discipline

5. Challenge Arena
   https://frontend-seven-beta-46.vercel.app/challenge

6. Public cron
   https://github.com/USBVadik/TuringVault-Core/actions/workflows/agent-cycle.yml

7. DecisionLog
   https://explorer.mantle.xyz/address/0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5

8. ValidationRegistry
   https://explorer.mantle.xyz/address/0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6

9. ReputationRegistry
   https://explorer.mantle.xyz/address/0xC78119F3274B05046Ac7c38a14298a6cbD946e1a

10. Identity NFT
    https://explorer.mantle.xyz/address/0x6f862802e0d5463DF18d267e422347BeCacc28bD

---

## What We Do Not Claim

- We do not claim realized wallet PnL. The performance number is a Decision-Quality / Outcome Score from settled decisions.
- We do not claim public user deposits. The current NAV is operator-funded demo capital.
- We do not claim every cron cycle is a swap. Most cycles are holds, rejections, or safety blocks, and the UI labels cycles separately from executed transactions.
- We do not claim perpetual liveness. GitHub Actions cron is a best-effort public schedule; `/api/health.lastCycleAge` is the source of truth.
- We do not claim live USDY execution. USDY is paper-ready and gated until Mantle liquidity is usable.
- We do not put full reasoning text on-chain. Full reasoning is pinned off-chain; Mantle stores the cryptographic anchor.

---

## Why This Can Win

Most AI trading demos try to impress judges with a performance chart. TuringVault's stronger claim is different: it makes AI economic behavior auditable.

The valuable primitive is not "the model bought the right token once." It is a repeatable process where a DAO can answer:

- What did the agent see?
- What did it propose?
- Who challenged it?
- Why was it accepted or rejected?
- Did the transaction actually happen?
- Can the reasoning be replayed later?
- Did the decision improve or damage the agent's reputation?

That is the missing infrastructure layer for AI-managed RWA portfolios.

TuringVault turns AI allocation from a black-box output into a public, challengeable, reputation-bearing process on Mantle.

---

## Competitive Position

The closest projects prove that judges care about transparency and risk controls: transparent agent logs, visible losses, and smart-contract guardrails all matter. TuringVault's difference is that those ideas are joined into one pre-execution verification stack.

Before capital moves, the proposal is challenged by a separate validator model, risk-gated, logged, anchored, and then checked again by the Discipline Layer. That makes the moat less about "our model is smarter" and more about "the process is inspectable even when the model is wrong."

For judge questions, use `docs/judge-q-and-a-final.md`.
