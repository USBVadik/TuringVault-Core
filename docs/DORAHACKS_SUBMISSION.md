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

Proof-of-Reasoning AI · RWA Portfolio Infrastructure on Mantle

## Tracks to claim (in order of priority)

1. **AI x RWA Track — Path A (Infrastructure)** ← PRIMARY
2. **20 Project Deployment Award** ← eligibility checked, see below
3. **Best UI/UX Award** ← opt-in, honesty-first dashboard
4. _(Grand Champion — mention as bonus, do not over-pitch)_

---

## Long description (paste into the main project description field)

TuringVault is an **AI-powered RWA portfolio management infrastructure layer on Mantle**. We do not pitch yet another autonomous trading bot — we ship the verification machinery that lets DAO treasuries, DeFi-native funds, and compliance-conscious operators trust an AI agent with real capital.

### Three defining features — end-to-end, all live

The Mantle Turing Test 2026 brief calls out three defining features. We built the entire stack around them.

**1 · On-chain benchmarking of AI.** Every cycle writes 4 attestation TXs to Mantle Mainnet (`submitProposal` → `validateProposal` → `logDecision` → `submitFeedback`). The 2026-06-04 16:15 UTC snapshot shows 288 DecisionLog rows and 289 ValidationRegistry proposals logged to date, with full reasoning pinned off-chain and cryptographically anchored on Mantle. The best-effort cron is a public GitHub Actions workflow log — judges can inspect any past or current run.

**2 · ERC-8004 agent identity reference implementation.** Non-transferable Identity NFT (`0x6f86…28bD`), ValidationRegistry, ReputationRegistry, DecisionLog — all Sourcify-verified on Mantle Mainnet. `tokenURI(0)` returns a live IPFS CID that auto-refreshes per cycle. Drop-in compatible with the upcoming Mantle-issued Agent Identity standard; we are positioned to interop or migrate the moment that ships.

**3 · Radical transparency.** Public hourly cron. IPFS-pinned reasoning blobs. Live mascot reflecting actual cycle freshness. `/challenge` arena where anyone can inject four canonical attack vectors and watch the real multi-agent pipeline reason through them. `/discipline` page surfacing the post-execution proof history. The honesty rule is enforced as a workspace steering doc (`.kiro/steering/no-lying-about-state.md`); every numeric stat must trace to a contract read or settled outcome.

### Why Path A (Infrastructure), not Path B (Application)

The features above are _verification infrastructure_, not user-facing UX. Path A scoring (40%): "completeness of asset tokenization flow + innovation of technical approach". TuringVault is one of the rare submissions that ships every component end-to-end.

### Architecture

A single hourly cron drives the cycle:

1. Aggregate 5 structured market signals — funding rate (Hyperliquid), smart-money flow (Nansen MCP, JSON-RPC 2.0), yield spread (mETH vs USDY), liquidation map, **Elfa social attention** (mindshare + smart-account repost ratio via REST v2).
2. Run validator-gated adversarial consensus: **Z.ai GLM-5 Analyst** (proposes) → **Anthropic Claude Sonnet 4.6 Validator** (default REJECT, R/R ≥ 1.5:1 to approve, hard veto final) → **Google Gemini 3.5 Flash Arbiter** (soft confidence-dispute tiebreaker).
3. Pin full reasoning chain to IPFS via Pinata. Anchor hash on Mantle.
4. Run RWA Allocator — Path A (LLM-driven `rwa_allocate` / `rwa_exit`) or Path B (deterministic 24h FLAT idle-parking).
5. Execute via Merchant Moe Liquidity Book v2.2 (binStep=1) on the USDT/USDT0 pool.
6. Run **Synrail-inspired Discipline Layer** — 3-gate post-execution verification: TX proof + price freshness + regime drift. Failure blocks outcome settlement.
7. Schedule outcome for settlement against price 4h later → updates ReputationRegistry.

### Mantle-native asset stack

- **mETH** — Mantle's own LST, used as the risk-on real-yield leg.
- **USDT0** — LayerZero-bridged Tether (Treasury-collateralised, 1:1 USD peg). Around 46% of NAV in the 2026-06-04 16:15 UTC snapshot. First RWA swap on-chain: TX `0x0af2336…3e09de`.
- **USDY** — Ondo tokenized Treasuries metadata module ships in repo (`src/rwa/usdyModule.js`). Mantle pool depth currently zero, so the swap path throws `RWA_POOL_INACTIVE` until reactivated. We label it as `paper-ready` honestly rather than pretending it's live.

### What's currently live

| Component                | State | Verifiable artefact                                                            |
| ------------------------ | ----- | ------------------------------------------------------------------------------ |
| Multi-agent consensus    | LIVE  | 288 DecisionLog rows in the 2026-06-04 16:15 UTC snapshot, public cron log     |
| ERC-8004 contracts       | LIVE  | 5 Sourcify-verified contracts on Mantle                                        |
| Discipline Layer         | LIVE  | `/discipline` page, 3 gates fire each cycle                                    |
| RWA execution to USDT0   | LIVE  | TX `0x0af2336…` on Mantlescan                                                  |
| Hourly cron              | LIVE  | GitHub Actions workflow, public log                                            |
| Elfa social attention    | LIVE  | `/api/elfa-snapshot` returns real V2 data                                      |
| Bybit Wallet integration | LIVE  | RainbowKit `connectorsForWallets` config                                       |
| Self-evolving prompts    | GATED | Implemented; default-off behind env flag while parse-rate smoke confirms ≥ 95% |
| USDY allocation          | PAPER | Module ships; pool dry on Mantle                                               |

### Why we will keep our claims after the submission deadline

- All five smart contracts are Sourcify-verified and **never going to be redeployed** (we'd lose the on-chain decision history). The hash anchors are immutable.
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
| Pitch deck (PDF)        | `docs/pitch-deck/turingvault-pitch.pdf` (in repo)                                            |
| Demo video              | TBD — re-recording with Screen Studio at high quality                                        |

## Stack tags

`Mantle` `AI Agents` `RWA` `ERC-8004` `Adversarial Consensus` `IPFS` `Proof-of-Reasoning` `Solidity` `Next.js` `RainbowKit` `Bybit Wallet` `Merchant Moe` `Nansen MCP` `Elfa` `Pinata` `AWS Bedrock` `Google Vertex AI`

## Team

USBVadik — solo developer.

- ex-Synrail (autonomous-agent verification framework, also OSS at [github.com/USBVadik/synrail](https://github.com/USBVadik/synrail))
- Twitter / X: [@a_seven_life](https://x.com/a_seven_life)
- Email: vadik@nexus-shell.ai
