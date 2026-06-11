# TuringVault — Hackathon Submission Guide

> Current source of truth for the Mantle Turing Test 2026 DoraHacks submission.

Last aligned with the updated judging spreadsheet: 2026-06-11.

## Primary Positioning

TuringVault should be submitted as:

**AI & RWA Track — Path B: RWA Application**

This is intentional. TuringVault does not issue a new tokenized real-world asset. It uses AI to manage, verify, and audit allocation across existing Mantle-native RWA/yield rails:

- USDT0 as the live Treasury-collateralised stable allocation rail.
- mETH as the Mantle-native liquid-staking yield/risk leg.
- MNT / WMNT as native execution inventory.
- USDY as an implemented but gated Ondo tokenized-Treasury module, disabled until usable Mantle liquidity returns.

The product layer is accountability infrastructure, but the track fit is Path B because the user-facing outcome is an end-to-end RWA portfolio application for DAO treasuries, on-chain funds, and compliance-conscious operators.

## Scorecard Alignment

| Rubric item | How TuringVault maps |
| --- | --- |
| Technical depth | Multi-model AI cycle, deterministic portfolio/risk guards, Merchant Moe execution, IPFS proof storage, Mantle registry writes, replay verifier, Discipline Layer |
| Mantle ecosystem fit | Mantle Mainnet contracts, low-cost per-cycle proof anchoring, MNT/WMNT inventory, mETH yield/risk leg, USDT0 allocation rail, Merchant Moe LB v2.2 execution |
| Business potential | Treasury/fund operator workflow for accountable AI allocation, audit exports, hosted agent operations, proof dashboards |
| Innovation | Treats blocked trades and post-execution proof as first-class outputs instead of hiding them behind a chatbot or opaque bot log |
| UX | Public dashboard, Proof Explorer, Replay, Discipline Layer, and Challenge Arena turn a complex AI agent into inspectable judge flows |
| AI x RWA integration depth | AI proposes allocation, validator challenges the thesis, deterministic guards enforce risk/compliance boundaries, and outputs are auditable |
| Compliance awareness | Operator-funded demo only; no public deposits, no yield promise, no live USDY claim, and a roadmap for allowlists/KYC/AML/jurisdiction policy before any public vault |

## Compliance Posture

This section should stay visible in the DoraHacks copy and, where possible, in the live demo narrative.

TuringVault is scoped as an operator-funded demo and verification layer, not a public investment product.

- No public deposits are accepted.
- No yield or profit is promised.
- Current capital is controlled by an operator EOA for hackathon demonstration.
- USDT0 is described as a stable RWA allocation rail, not a yield product.
- USDY is implemented but gated until Mantle liquidity is usable.
- Before any public vault, the next milestone is policy enforcement: allowlists, KYC/AML checks, jurisdiction-aware eligibility, and human/governance approval for regulated asset access.

The AI can assist allocation, proof generation, and compliance-review workflows, but it does not bypass legal constraints.

## Required Links

- GitHub: https://github.com/USBVadik/TuringVault-Core
- Frontend: https://frontend-seven-beta-46.vercel.app
- Demo video: https://youtu.be/AnLbnbW36ys
- DecisionLog: https://explorer.mantle.xyz/address/0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5
- ValidationRegistry: https://explorer.mantle.xyz/address/0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6
- ReputationRegistry: https://explorer.mantle.xyz/address/0xC78119F3274B05046Ac7c38a14298a6cbD946e1a
- Identity NFT: https://explorer.mantle.xyz/address/0x6f862802e0d5463DF18d267e422347BeCacc28bD
- Final DoraHacks copy: `docs/dorahacks-final-polished.md`

## 20 Project Deployment Award Checklist

| Requirement | TuringVault status |
| --- | --- |
| Smart contract deployed on Mantle Mainnet or Testnet | Six contracts deployed on Mantle Mainnet |
| Contract verified on Mantle Explorer | Five production contracts Sourcify `perfect`; Router is deployed but labelled as source-drifted legacy helper |
| At least one AI-powered function callable/on-chain recorded | Every agent cycle writes proposal, validation, decision, and reputation evidence to Mantle; `/challenge` can submit adversarial validation proposals |
| Public frontend demo | https://frontend-seven-beta-46.vercel.app |
| Deployment address included in submission | DecisionLog, ValidationRegistry, ReputationRegistry, Identity NFT links above |
| Demo video at least 2 min | https://youtu.be/AnLbnbW36ys |
| Open-source repo with setup, architecture, deployed addresses | GitHub README + `docs/ARCHITECTURE.md` |

## What Not To Claim

- Do not claim Path A asset tokenization infrastructure as the primary AI & RWA path.
- Do not claim public deposits.
- Do not claim live USDY execution.
- Do not claim USDT0 yield.
- Do not present heartbeat swaps as realized trading PnL.
- Do not present outcome-score bps as realized wallet PnL.

## Current Long-Form Copy

Use `docs/dorahacks-final-polished.md` as the main paste source for DoraHacks. This file is the lightweight internal guide that keeps the positioning consistent across README, live demo, and final submission text.
