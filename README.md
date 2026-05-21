# TuringVault

> **The Proof-of-Reasoning Layer for Autonomous Capital Agents on Mantle**
>
> Every AI capital decision is validated before execution, anchored on-chain, and tied to an evolving ERC-8004 reputation identity.

[![Mantle Mainnet](https://img.shields.io/badge/Mantle-Mainnet_Live-00D395)](https://explorer.mantle.xyz/address/0x6f862802e0d5463DF18d267e422347BeCacc28bD)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-Agent_Identity-blue)](https://eips.ethereum.org/EIPS/eip-8004)
[![Tests](https://img.shields.io/badge/tests-110_passing-brightgreen)]()
[![Safety](https://img.shields.io/badge/risk_firewall-31%2F36_blocked-red)]()
[![Evolution](https://img.shields.io/badge/self--evolving-4_iterations-orange)]()

---

## The Problem

AI agents are moving capital on-chain — but **nobody can audit why**.

- No verifiable trail of reasoning
- No way to prove the model actually analyzed data vs. hallucinated
- No on-chain gate between "AI wants to trade" and "trade happens"
- No reputation: a new agent and a battle-tested one look identical

**Result:** Users must blindly trust opaque black boxes with their capital.

## The Solution: Verifiable Decision Provenance

TuringVault is **not a trading bot**. It's a trust infrastructure layer that ensures:

1. **Dual-model consensus** — Two independent LLMs (Z.ai GLM-5 + Claude 4.6) must agree before any action
2. **On-chain decision provenance** — Every proposal, validation, and outcome recorded on Mantle with full context
3. **Pre-Action Validation Gates** — Smart contract checks prevent execution without verified consensus
4. **Hardware-secured signing** — AI generates intents, never touches keys (Tencent KMS HSM pipeline)
5. **Self-evolution with safety** — Agent reads its own performance, evolves its prompt, validator prevents degeneration

---

## On-Chain Safety Proof

TuringVault's risk firewall is working as designed:

| Metric | Value | Meaning |
|--------|-------|---------| 
| **Total Proposals** | 36 | Analyst proposed 36 market actions |
| **Blocked by Validator** | 31 | Risk firewall rejected 31 unsafe/low-confidence proposals |
| **Approved Executions** | 5 | Only 5 actions met all safety thresholds |
| **Real Swaps** | 2 | USDT0→mETH, USDT0→WMNT via Merchant Moe Router |
| **Consensus Rate** | 100% | Every decision went through full dual-model pipeline |
| **VaR Gate Active** | ✅ | Autonomous / Supervised / Blocked tiers enforced |

> **31/36 blocked is not failure — it's proof the safety layer works.** The agent calculated slippage risk on thin Mantle DEX pools and refused to execute — protecting capital in a Fear=29 market. A risk firewall that blocks nothing is security theater.

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                    PROOF-OF-REASONING PIPELINE                                 │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────┐   ┌─────────────┐   ┌──────────────┐   ┌──────────────────┐│
│  │   CONTEXT    │   │  COGNITIVE  │   │   SAFETY     │   │   ATTESTATION    ││
│  │ ACQUISITION  │──▶│  SYNTHESIS  │──▶│    GATES     │──▶│   (ON-CHAIN)     ││
│  └──────────────┘   └─────────────┘   └──────────────┘   └──────────────────┘│
│        │                  │                  │                   │            │
│  ┌─────┴──────┐     ┌─────┴──────┐     ┌─────┴──────┐     ┌──────┴─────────┐ │
│  │ Nansen MCP │     │ Analyst    │     │ VaR Gate   │     │ ERC-8004       │ │
│  │ CoinGecko  │     │ (GLM-5)    │     │ Pre-Action │     │ Identity       │ │
│  │ DeFiLlama  │     │     ↓      │     │ Check      │     │ Validation     │ │
│  │ Merchant   │     │ Validator  │     │ KMS Sign   │     │ Reputation     │ │
│  │ Moe Bins   │     │ (Claude)   │     │ or BLOCK   │     │ Decision Log   │ │
│  │ Fear&Greed │     │     ↓      │     │            │     │ IPFS Pinata    │ │
│  │ USDY Yield │     │ Consensus  │     │            │     │                │ │
│  └────────────┘     └────────────┘     └────────────┘     └────────────────┘ │
│                                                                               │
│                           ┌──────────────────────┐                            │
│                           │  SELF-EVOLUTION LOOP │                            │
│                           │  Read perf → Reflect │                            │
│                           │  → Validate → IPFS   │                            │
│                           │  → setAgentURI() TX  │                            │
│                           └──────────────────────┘                            │
│                                                                               │
│  Chain: Mantle Mainnet (5000)  │  AI: Z.ai GLM-5 + Claude Sonnet 4.6 (Bedrock)│
│  VaR Gate: <50 autonomous │ 50-150 supervised │ >300 blocked                  │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Innovation: On-Chain Prompt Evolution

TuringVault agents **improve themselves** — with safety constraints:

1. Agent makes 20 trading decisions → all recorded on Mantle
2. Evolution module reads performance from `ReputationRegistry`
3. GLM-5 performs **self-reflection** — analyzes its own error patterns
4. Claude 4.6 **validates** the proposed evolution (prevents degeneration)
5. New Agent Card uploaded to **IPFS** (Pinata)
6. `setAgentURI()` called on-chain → **tokenURI points to evolved prompt**
7. Next cycle loads prompt from IPFS — the agent has literally rewritten itself

**4 evolution iterations completed**, each producing a more conservative, data-driven agent.  
Every evolution is verifiable: `tokenURI → IPFS CID → full prompt + parameters`.

---

## Human vs AI Mode (VaR-Based Autonomy)

```
VaR < 50 bps  → AUTONOMOUS: AI executes without human intervention
VaR 50-150    → SUPERVISED: AI proposes, human approves via intent queue
VaR > 300     → BLOCKED: Too risky, no action taken
```

The Value-at-Risk threshold dynamically determines how much autonomy the AI has.  
Low volatility + high confidence = full autonomy. Market stress = human oversight.

---

## Deployed Contracts — Mantle Mainnet

| Contract | Address | Verified |
|----------|---------|----------|
| **TuringVaultIdentity** (ERC-8004) | [`0x6f862802e0d5463DF18d267e422347BeCacc28bD`](https://explorer.mantle.xyz/address/0x6f862802e0d5463DF18d267e422347BeCacc28bD) | ✅ Sourcify |
| **TuringVaultDecisionLog** | [`0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5`](https://explorer.mantle.xyz/address/0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5) | ✅ Sourcify |
| **TuringVaultReputationRegistry** | [`0xC78119F3274B05046Ac7c38a14298a6cbD946e1a`](https://explorer.mantle.xyz/address/0xC78119F3274B05046Ac7c38a14298a6cbD946e1a) | ✅ Sourcify |
| **TuringVaultValidation** (Pre-Action) | [`0x0aeEd88959fCFC665284225dB93DED3e8A3Ff705`](https://explorer.mantle.xyz/address/0x0aeEd88959fCFC665284225dB93DED3e8A3Ff705) | ✅ Sourcify |
| **TuringVaultRouter** | [`0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001`](https://explorer.mantle.xyz/address/0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001) | ⏳ Pending |

**Agent Identity:** Token #0 | **Decisions On-Chain:** 20 | **Safety Blocks:** 19/20 | **Gas Used:** ~1 MNT total

---

## Partner Integrations

| Partner | Integration | Role in Pipeline |
|---------|------------|-----------------|
| **Z.ai** | GLM-5 via AWS Bedrock | Primary analyst — aggressive alpha identification |
| **Tencent Cloud** | KMS HSM signing | Hardware key security — DER parse → EIP-2 → EIP-155 |
| **Nansen** | MCP Protocol (24 tools) | Smart Money tracking, token scoring, wallet profiling |
| **Byreal** | Perps CLI + RealClaw | Institutional execution — CLMM + perpetual futures |
| **Merchant Moe** | LB Router v2.1 | On-chain DEX quotes with bin-step pricing |
| **Mantle** | ERC-8004 + native DeFi | Chain infrastructure, 5 deployed contracts (4 Sourcify-verified) |
| **Bybit** | Web3 Wallet | End-user access via RainbowKit connector |
| **Ondo Finance** | USDY (RWA) | Tokenized US T-Bills, adaptive yield allocation |

---

## Technical Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **AI Models** | Z.ai GLM-5 + Claude Sonnet 4.6 (AWS Bedrock) | Dual-model consensus — analyst proposes, validator checks |
| **Smart Contracts** | Solidity 0.8.28, OpenZeppelin v5, Hardhat | ERC-8004 Identity + Decision + Reputation + Validation |
| **DEX** | Merchant Moe LB Router v2.1 | Real on-chain swap quotes |
| **RWA** | USDY (Ondo Finance) | Adaptive 10-50% allocation, 5.25% APY |
| **Key Security** | Tencent KMS (DER, EIP-2, EIP-155) | AI generates intents → Pre-Action Check → KMS signs |
| **Smart Money** | Nansen MCP (24 tools) | Institutional flow detection |
| **Execution** | Byreal Perps CLI | Deterministic trade execution |
| **Storage** | IPFS (Pinata) | Agent Card, reasoning proofs, evolution history |
| **Frontend** | Next.js 15 + Tailwind + RainbowKit + wagmi | Proof Explorer dashboard |
| **Chain** | Mantle Mainnet (ID: 5000) | Low gas (~$0.01/TX), EVM compatible |

---

## On-Chain Proof

Every claim is verifiable:

| Claim | Proof |
|-------|-------|
| 20 AI decisions validated | [`DecisionLog.totalDecisions()`](https://explorer.mantle.xyz/address/0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5#readContract) |
| 19/20 proposals blocked by safety | [`ValidationRegistry` events](https://explorer.mantle.xyz/address/0x0aeEd88959fCFC665284225dB93DED3e8A3Ff705) |
| Agent registered (ERC-8004) | [`Identity.tokenURI(0)`](https://ipfs.io/ipfs/QmUc6Qo4yoH2SboEesPeKuojs93MaJNxFjw9mDRTZp4axw) → IPFS Agent Card |
| Prompt evolution (4 iterations) | tokenURI changed 4× (each TX on explorer) |
| Dual-model consensus | Every TX has both analyst + validator reasoning hashes |

---

## Agent Trust SDK (for Ecosystem)

Build your own PoR-enabled agent on TuringVault in 3 lines:

```javascript
const { TuringVaultSDK } = require("@turingvault/sdk");

const sdk = new TuringVaultSDK({ privateKey: process.env.PRIVATE_KEY });

// Full PoR flow: propose → validate → record → pin to IPFS
const result = await sdk.createValidatedDecision({
  analyst: { model: "glm-5", action: "swap", confidence: 0.85, reasoning: "ETH oversold" },
  validator: { model: "claude-4.6", riskScore: 35, approved: true, reasoning: "Risk acceptable" },
  targetAsset: "WETH",
});
// → { proposalId, decisionId, txHash, ipfsCid, approved }

// Read-only (no key needed)
const stats = await new TuringVaultSDK().getConsensusRate();
// → { approved: 1, rejected: 19, total: 20 }
```

See [`sdk/README.md`](./sdk/README.md) for full documentation.

---

## Quick Start

```bash
git clone https://github.com/USBVadik/TuringVault-Core.git
cd turingvault && npm install

# Configure
cp .env.example .env
# Required: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, PRIVATE_KEY, PINATA_JWT

# Run tests (110 total)
npm test                  # All tests (hardhat + jest)
npm run test:contracts    # 91 contract tests
npm run test:unit         # 19 orchestrator tests

# Run full cycle (dry-run)
node src/orchestrator/integratedOrchestrator.js paper

# Run prompt evolution
node src/evolution/promptEvolution.js --force

# Frontend (Proof Explorer)
cd frontend && npm install && npm run dev
```

---

## Hackathon Tracks

### 🏆 AI Trading & Strategy (Primary)
- Dual-model consensus prevents impulsive trades
- VaR-based autonomy (Human vs AI mode)
- Real on-chain DEX swaps via Merchant Moe LB v2.1 (2 executed)
- Byreal Perps CLI for institutional hedging execution
- Risk firewall proof: 31/36 unsafe proposals blocked in live Fear=29 market

### 🤖 Agentic Wallets & Economy
- Full ERC-8004 implementation (5 contracts, 4 verified on Sourcify)
- Agent Identity as NFT with evolving IPFS metadata
- Tencent Cloud KMS pipeline — hardware-secured signing
- Pre-Action Checks as on-chain governance gates
- Agent Trust SDK for ecosystem builders

---

## 🌐 Ecosystem & Sponsor Technology

| Sponsor | Integration | Details |
|---------|-------------|---------|
| **Z.ai (GLM-5)** | Analyst Agent | 745B-parameter model for long-horizon portfolio reasoning. Chosen over GPT-4 for superior agentic planning capabilities |
| **Nansen MCP** | On-chain Intelligence | Real-time smart money flows across 25+ chains via Model Context Protocol. Powers the Context Acquisition layer |
| **Mantle Network** | Execution & Settlement | All 5 ERC-8004 contracts deployed on mainnet. Low gas enables per-decision on-chain logging ($0.001/tx) |
| **Byreal Perps** | Hedging Layer | Hyperliquid perpetual futures via CLI. Agent can open protective shorts when DEX slippage is too high |
| **Merchant Moe** | DEX Execution | Liquidity Book v2.1 swaps (USDT0→mETH, USDT0→WMNT). Bin-level liquidity checks prevent slippage losses |
| **Pinata/IPFS** | Reasoning Storage | Every decision's full reasoning chain pinned to IPFS before on-chain hash recording |

### Why ERC-8004 over Custom Reputation?

Many competitors (NoBanks, Mensa) use bespoke reputation contracts. TuringVault implements [ERC-8004 (Trustless Agents)](https://eips.ethereum.org/EIPS/eip-8004) — the emerging standard for on-chain agent identity:

- **Identity Registry** → Agent exists as verifiable NFT (not just an EOA)
- **Validation Registry** → Pre-action checks enforced by authorized validators
- **Reputation Registry** → Performance history portable across protocols
- **EIP-7702 compatible** → Gas sponsorship for reputation updates = zero-cost UX for monitoring
- **Composable** → Any protocol can query agent trust score without custom integrations

---

## Why TuringVault

| | Other AI Agents | TuringVault |
|---|---|---|
| **Reasoning** | Hidden / prompt-injected | On-chain, IPFS-pinned, auditable |
| **Consensus** | Single model | Dual-model adversarial (propose + challenge) |
| **Key Security** | Plaintext in .env | KMS HSM pipeline (DER + EIP-2 + EIP-155) |
| **Self-Improvement** | Manual prompt tweaking | Autonomous evolution with safety validator |
| **Trust** | "Trust me bro" | Verifiable decision provenance (ERC-8004) |
| **Autonomy** | Binary (on/off) | Continuous (VaR-based sliding scale) |
| **Safety** | Hope it works | Risk firewall with on-chain proof (31/36 blocked) |

---

## License

MIT

---

*Built for Mantle Turing Test Hackathon 2026 — proving that AI capital agents can be made trustworthy through radical on-chain transparency and verifiable decision provenance.*
