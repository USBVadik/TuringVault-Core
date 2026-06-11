# DoraHacks Submission Copy — TuringVault

> Ready-to-paste text for the DoraHacks submission form at
> https://dorahacks.io/buidl/43986. Edit on DoraHacks last, after product
> changes are real (per `.kiro/steering/hackathon-context.md`).

---

## Short description (≤ 256 chars)

```
Accountable AI RWA portfolio manager on Mantle. 3-model adversarial consensus + ERC-8004 reference identity + Discipline Layer post-execution proof. Every allocation survives challenge before execution; every decision anchored on-chain.
```

(Char count: ~252.)

---

## Project name

TuringVault

## Tagline

Proof-of-Reasoning AI · RWA Portfolio Application on Mantle

## Tracks to claim (in order of priority)

1. **AI & RWA Track — Path B (RWA Application)** ← PRIMARY
2. **20 Project Deployment Award** ← eligibility checked, see below
3. **Best UI/UX Award** ← opt-in, honesty-first dashboard
4. _(Grand Champion — mention as bonus, do not over-pitch)_

---

## Long description (paste into the main project description field)

TuringVault is an **AI-powered RWA portfolio application and verification layer on Mantle**. We do not pitch yet another autonomous trading bot — we ship the workflow that lets DAO treasuries, DeFi-native funds, and compliance-conscious operators inspect every AI allocation before trusting it with real capital.

### Three defining features — end-to-end, all live

The Mantle Turing Test 2026 brief calls out three defining features. We built the entire stack around them.

**1 · On-chain benchmarking of AI.** Every cycle writes attestation data to Mantle Mainnet (`submitProposal` → `validateProposal` → `logDecision` → `submitFeedback`). The 2026-06-11 17:03 UTC snapshot shows 463 ValidationRegistry proposals / public decision rows exposed through the public API, with full reasoning pinned off-chain and cryptographically anchored on Mantle. The best-effort cron is a public GitHub Actions workflow log; judges can inspect run history and use `/api/health` for current freshness.

**2 · ERC-8004 agent identity reference implementation.** Non-transferable Identity NFT (`0x6f86…28bD`), ValidationRegistry, ReputationRegistry, DecisionLog — all Sourcify-verified on Mantle Mainnet. `tokenURI(0)` exposes the agent's IPFS identity card; during Pinata quota guard mode the public `/api/agent-card` hides stale card counters and points judges to live `/api/decisions` / `/api/performance` stats. Drop-in compatible with the upcoming Mantle-issued Agent Identity standard; we are positioned to interop or migrate the moment that ships.

**3 · Radical transparency.** Public hourly cron. IPFS-pinned reasoning blobs. Live mascot reflecting actual cycle freshness. `/challenge` arena where anyone can inject four canonical attack vectors and watch the real multi-agent pipeline reason through them. `/discipline` page surfacing the post-execution proof history. The honesty rule is enforced as a workspace steering doc (`.kiro/steering/no-lying-about-state.md`); every numeric stat must trace to a contract read or settled outcome.

### Why AI & RWA Path B (Application)

The updated scorecard separates RWA Infrastructure from RWA Application. TuringVault does not issue a new tokenized asset; it uses AI to manage and verify allocation across existing Mantle-native RWA/yield rails. That makes it a Path B application with infrastructure-grade proof surfaces: a defined asset set, clear treasury/fund operators as users, and an end-to-end flow from AI allocation intent to on-chain position and public proof.

### Commercial path

The first customer is not a retail trader. It is a DAO treasury, on-chain fund, or compliance-conscious operator that wants AI allocation but still needs governance-grade evidence. The commercial product is a white-label application layer for Mantle yield/RWA portfolios: hosted agent ops, on-chain attestation, replay dashboards, and audit exports around an allocator the customer already controls.

### Architecture

A single hourly cron drives the cycle:

1. Aggregate structured market signals — funding rate (Hyperliquid), smart-money flow (Nansen MCP, JSON-RPC 2.0), mETH yield context, stable/RWA allocation context, liquidation map, and **Elfa social attention** (mindshare + smart-account repost ratio via REST v2).
2. Run validator-gated adversarial consensus: **Z.ai GLM-5 Analyst** (proposes) → **Anthropic Claude Sonnet 4.6 Validator** (default REJECT, R/R ≥ 1.5:1 to approve, hard veto final) → **Google Gemini 3.5 Flash Arbiter** (soft confidence-dispute tiebreaker).
3. Pin full reasoning chain to IPFS via Pinata. Anchor hash on Mantle.
4. Run the RWA Allocator — LLM-reviewed allocation/exit route plus a bounded heartbeat route for liveness and inventory hygiene.
5. Execute via Merchant Moe Liquidity Book v2.2 (binStep=1) on the USDT/USDT0 pool.
6. Run **Synrail-inspired Discipline Layer** — 3-gate post-execution verification: TX proof + price freshness + regime drift. Failure blocks outcome settlement.
7. Schedule outcome for settlement against price 4h later → updates ReputationRegistry.

### Mantle-native asset stack

- **mETH** — Mantle's own LST, used as the risk-on real-yield leg.
- **USDT0** — LayerZero-bridged Tether (Treasury-collateralised, 1:1 USD peg). It is the stable RWA allocation rail in the live system. First RWA swap on-chain: TX `0x0af2336…3e09de`.
- **USDY** — Ondo tokenized Treasuries metadata module ships in repo (`src/rwa/usdyModule.js`). Mantle pool depth currently zero, so the swap path throws `RWA_POOL_INACTIVE` until reactivated. We label it as `paper-ready` honestly rather than pretending it's live.

### What's currently live

| Component                | State | Verifiable artefact                                                            |
| ------------------------ | ----- | ------------------------------------------------------------------------------ |
| Multi-agent consensus    | LIVE  | 463 public decision/proposal rows in the 2026-06-11 17:03 UTC API snapshot, public cron log |
| ERC-8004 contracts       | LIVE  | 5 Sourcify-verified contracts on Mantle                                        |
| Discipline Layer         | LIVE  | `/discipline` page, 3 gates fire each cycle                                    |
| RWA execution to USDT0   | LIVE  | TX `0x0af2336…` on Mantlescan                                                  |
| Hourly cron              | LIVE  | GitHub Actions workflow, public log                                            |
| Elfa social attention    | LIVE  | `/api/elfa-snapshot` returns real V2 data                                      |
| Bybit Wallet integration | LIVE  | RainbowKit `connectorsForWallets` config                                       |
| Self-evolving prompts    | GATED | Implemented; default-off behind env flag while parse-rate smoke confirms ≥ 95% |
| USDY allocation          | PAPER | Module ships; pool dry on Mantle                                               |

### Compliance posture

TuringVault is an operator-funded demo and verification layer, not a public investment product. It accepts no public deposits, promises no yield, labels USDY as gated/paper-ready, and keeps `realizedTradingPnlBps` null. The AI assists compliance controls through validator suitability review, deterministic portfolio/risk gates, and Discipline Layer proof checks; it does not bypass legal constraints. Before any public vault, the next milestone is policy enforcement: allowlists, KYC/AML, jurisdiction-aware eligibility, and human/governance approval for regulated asset access.

### Deployment Award checklist

| Requirement | TuringVault status |
| --- | --- |
| Smart contract deployed on Mantle | Six contracts deployed on Mantle Mainnet |
| Contract verified | Five production contracts Sourcify `perfect`; Router is deployed but labelled as source-drifted legacy helper |
| AI-powered function callable/on-chain recorded | Every agent cycle writes AI proposal, validation, decision, and reputation evidence to Mantle |
| Public frontend | https://frontend-seven-beta-46.vercel.app |
| Demo video ≥ 2 min | https://youtu.be/AnLbnbW36ys |
| Open-source repo with setup and addresses | This README + `docs/ARCHITECTURE.md` |

### Why we will keep our claims after the submission deadline

- The verified production contracts are not going to be redeployed casually; the existing addresses preserve the on-chain decision history. The hash anchors are immutable.
- The hourly cron's GitHub Actions workflow is public — anyone can fork the repo and reproduce a run.
- The honesty rule is enforced as a steering document loaded on every developer turn. Misrepresentation is the project's only way to lose.

---

## Vision (paste into the "Vision" field if present)

```
Treat AI agents as accountable economic actors with on-chain identity, reputation, and proof-of-reasoning at every step. ERC-8004 reference implementation today; the verification substrate every DAO-grade RWA portfolio manager will need tomorrow.
```

(Char count: ~256.)

---

## Key links to populate

| Field                   | Value                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| GitHub                  | https://github.com/USBVadik/TuringVault-Core                                                 |
| Live demo               | https://frontend-seven-beta-46.vercel.app                                                    |
| Mantle Mainnet explorer | https://explorer.mantle.xyz                                                                  |
| Identity NFT (ERC-8004) | https://explorer.mantle.xyz/address/0x6f862802e0d5463DF18d267e422347BeCacc28bD               |
| DecisionLog             | https://explorer.mantle.xyz/address/0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5               |
| ValidationRegistry      | https://explorer.mantle.xyz/address/0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6               |
| ReputationRegistry      | https://explorer.mantle.xyz/address/0xC78119F3274B05046Ac7c38a14298a6cbD946e1a               |
| First RWA swap TX       | https://mantlescan.xyz/tx/0x0af23364c7651b053d33b0f7ed3eb8b30107b5dc489e96a7ad8ac90cad3e09de |
| Hourly cron log         | https://github.com/USBVadik/TuringVault-Core/actions/workflows/agent-cycle.yml               |
| `/discipline` page      | https://frontend-seven-beta-46.vercel.app/discipline                                         |
| `/challenge` page       | https://frontend-seven-beta-46.vercel.app/challenge                                          |
| `/proof-explorer` page  | https://frontend-seven-beta-46.vercel.app/proof-explorer                                     |
| Elfa snapshot           | https://frontend-seven-beta-46.vercel.app/api/elfa-snapshot?symbol=ETH                       |
| Judge Q&A               | `docs/judge-q-and-a-final.md` (in repo)                                                      |
| Pitch deck (PDF)        | `docs/pitch-deck/turingvault-pitch.pdf` (in repo)                                            |
| Demo video              | https://youtu.be/AnLbnbW36ys                                                                  |

## Stack tags

`Mantle` `AI Agents` `RWA` `ERC-8004` `Adversarial Consensus` `IPFS` `Proof-of-Reasoning` `Solidity` `Next.js` `RainbowKit` `Bybit Wallet` `Merchant Moe` `Nansen MCP` `Elfa` `Pinata` `AWS Bedrock` `Google Vertex AI`

## Team

USBVadik — solo developer.

- ex-Synrail (autonomous-agent verification framework, also OSS at [github.com/USBVadik/synrail](https://github.com/USBVadik/synrail))
- Twitter / X: [@a_seven_life](https://x.com/a_seven_life)
- Email: vadik@nexus-shell.ai
