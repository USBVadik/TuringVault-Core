# TuringVault

> **Hardware-Secured AI Vault with Decentralized Verification of Intent — Multi-Agent Proof-of-Reasoning on Mantle**

[![Mantle Mainnet](https://img.shields.io/badge/Mantle-Mainnet_Live-00D395)](https://explorer.mantle.xyz/address/0x6f862802e0d5463DF18d267e422347BeCacc28bD)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-Trustless_Agents-blue)](https://eips.ethereum.org/EIPS/eip-8004)
[![Tests](https://img.shields.io/badge/tests-103_passing-brightgreen)]()
[![On-Chain](https://img.shields.io/badge/decisions-60%2B_on--chain-purple)]()
[![Evolution](https://img.shields.io/badge/self--evolving-4_iterations-orange)]()

---

## The Problem

AI agents managing capital are **opaque black boxes**. Users cannot verify:
- *Why* a trade was made
- *What data* informed the decision
- Whether the AI is hallucinating or actually reasoning
- If risk parameters are being respected

This creates an impossible trust dilemma: you can't distinguish a competent agent from a random number generator without **verifiable proof of cognition**.

## The Solution: Proof-of-Reasoning (PoR)

TuringVault is NOT a trading bot. It's a **cryptographically-verified AI cognition framework** where:

1. **Dual-model consensus** — Two independent LLMs (GLM-5 Analyst + Claude 4.6 Validator) must agree before any action
2. **Immutable reasoning chain** — Every decision, with full context, recorded on Mantle
3. **Pre-Action Checks** — On-chain validation gates prevent execution without consensus
4. **Hardware-secured signing** — AI generates "intents", never touches private keys (KMS pipeline)
5. **Self-evolution** — Agent reads its own on-chain performance and rewrites its system prompt via IPFS

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                      TRUSTLESS COGNITIVE TRADING LOOP                             │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐ │
│  │   CONTEXT    │   │  COGNITIVE   │   │  EXECUTION   │   │   ATTESTATION    │ │
│  │ ACQUISITION  │──▶│  SYNTHESIS   │──▶│    ENGINE     │──▶│   (ON-CHAIN)     │ │
│  └──────────────┘   └──────────────┘   └──────────────┘   └──────────────────┘ │
│        │                    │                   │                    │            │
│  ┌─────┴──────┐     ┌─────┴──────┐     ┌─────┴──────┐     ┌──────┴─────────┐  │
│  │ Nansen MCP │     │ Analyst    │     │ Byreal     │     │ ERC-8004       │  │
│  │ CoinGecko  │     │ (GLM-5)   │     │ Perps CLI  │     │ Identity       │  │
│  │ DeFiLlama  │     │     ↓      │     │ Merchant   │     │ Validation     │  │
│  │ Merchant   │     │ Validator  │     │ Moe LB v2  │     │ Reputation     │  │
│  │ Moe Bins   │     │ (Claude)   │     │ Tencent    │     │ Decision Log   │  │
│  │ Fear&Greed │     │     ↓      │     │ KMS HSM    │     │ Router         │  │
│  │ USDY Yield │     │ Consensus  │     │ Sign+Send  │     │ IPFS Pinata    │  │
│  └────────────┘     └────────────┘     └────────────┘     └────────────────┘  │
│                                                                                  │
│                           ┌──────────────────────┐                               │
│                           │  SELF-EVOLUTION LOOP │                               │
│                           │  Read perf → Reflect │                               │
│                           │  → Validate → IPFS   │                               │
│                           │  → setAgentURI() TX  │                               │
│                           └──────────────────────┘                               │
│                                                                                  │
│  Chain: Mantle Mainnet (5000)  │  AI: Z.ai GLM-5 + Claude Sonnet 4.6 (Bedrock) │
│  VaR Gate: <50 autonomous │ 50-150 supervised │ >300 blocked                    │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Innovation: On-Chain Prompt Evolution

TuringVault is a **self-improving cybernetic organism on the blockchain**:

1. Agent makes 20+ trading decisions → recorded on Mantle
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
| **TuringVaultRouter** | [`0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001`](https://explorer.mantle.xyz/address/0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001) | ✅ Sourcify |

**Agent Identity:** Token #0 | **On-Chain Decisions:** 60+ | **Gas Used:** ~1 MNT total

---

## Partner Integrations

| Partner | Integration | Module |
|---------|------------|--------|
| **Z.ai** | GLM-5 via AWS Bedrock | Primary analyst model — aggressive alpha identification |
| **Tencent Cloud** | KMS HSM signing pipeline | DER ASN.1 parse → EIP-2 canonicalize → EIP-155 replay protection |
| **Nansen** | MCP Protocol (24 tools) | Smart Money tracking, token analysis, wallet profiling (`src/mcp/nansenMCP.js`) |
| **Byreal** | Perps CLI + RealClaw | Institutional execution layer — CLMM liquidity + perpetuals (`src/execution/executionEngine.js`) |
| **Merchant Moe** | LB Router v2.1 | On-chain DEX quotes — real swap simulation with bin-step pricing |
| **Mantle** | ERC-8004 + mETH/USDY | 5 verified contracts, 60+ on-chain decisions, native DeFi |
| **Bybit** | Wallet Integration | End-user access via Bybit Web3 Wallet (RainbowKit connector) |
| **Ondo Finance** | USDY (RWA) | Tokenized US T-Bills — adaptive 10-50% yield allocation |

## Technical Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **AI Models** | Z.ai GLM-5 + Claude Sonnet 4.6 (AWS Bedrock) | Dual-model consensus — analyst proposes, validator checks |
| **Smart Contracts** | Solidity 0.8.28, OpenZeppelin v5, Hardhat | ERC-8004 Identity + Decision + Reputation + Validation |
| **DEX Integration** | Merchant Moe LB Router v2.1 | Real on-chain swap quotes (1 MNT ≈ $0.62 verified live) |
| **RWA Module** | USDY (Ondo Finance, 26M supply on Mantle) | Adaptive 10-50% allocation, 5.25% APY from US T-Bills |
| **Key Security** | Tencent KMS pipeline (DER parse, EIP-2, EIP-155) | AI generates intents → Pre-Action Check → KMS signs |
| **Smart Money** | Nansen MCP (24 tools) | Institutional flow detection, token scoring, wallet profiling |
| **Execution** | Byreal Perps CLI | Deterministic trade execution — CLMM + perpetual futures |
| **Storage** | IPFS (Pinata) | Agent Card, reasoning hashes, prompt evolution history |
| **Frontend** | Next.js + Tailwind + RainbowKit + wagmi | Glass Mode dark dashboard, Bybit Wallet support |
| **Chain** | Mantle Mainnet (ID: 5000) | Low gas (~$0.01/TX), EVM compatible, mETH/USDY yield |

---

## Multi-Agent Consensus

```
┌─────────────────────────────────────────────────┐
│  Market Data (5 sources) → unified context      │
│                    ↓                            │
│  ┌─────────────────────────────────────────┐   │
│  │ ANALYST (GLM-5)                         │   │
│  │ - Aggressive alpha seeker               │   │
│  │ - Output: action, asset, confidence,    │   │
│  │           reasoning (Zod-validated)      │   │
│  └─────────────────────────────────────────┘   │
│                    ↓                            │
│  ┌─────────────────────────────────────────┐   │
│  │ VALIDATOR (Claude Sonnet 4.6)           │   │
│  │ - Conservative risk manager             │   │
│  │ - Independent review (not rubber-stamp) │   │
│  │ - Output: risk score, approve/reject    │   │
│  └─────────────────────────────────────────┘   │
│                    ↓                            │
│  Consensus: both ≥60% confidence + risk ≤65    │
│  → Pre-Action Check on-chain                   │
│  → VaR gate (autonomous / supervised / blocked)│
│  → Execute or queue for human approval         │
└─────────────────────────────────────────────────┘
```

---

## Project Structure

```
turingvault/
├── contracts/                         # Solidity (5 contracts)
│   ├── TuringVaultIdentity.sol           # ERC-8004 Agent Identity (ERC-721 + metadata + EIP-712)
│   ├── TuringVaultDecisionLog.sol        # Immutable decision history
│   ├── TuringVaultRouter.sol             # Strategy routing + execution
│   ├── TuringVaultReputationRegistry.sol # Reputation scores + PnL tracking
│   └── TuringVaultValidation.sol         # Pre-Action Checks (request→response→approve)
├── src/
│   ├── orchestrator/                  # AI Cognitive Core
│   │   ├── multiAgent.js                # Dual-model engine (GLM-5 + Claude)
│   │   ├── multiAgentLoop.js            # Full cycle: data → AI → on-chain
│   │   ├── integratedOrchestrator.js    # v2: VaR + intent queue + all modules
│   │   └── unifiedMarketData.js         # 5-source market aggregator
│   ├── dex/                           # DEX Integration
│   │   └── merchantMoe.js               # Merchant Moe LB v2.1 (real quotes)
│   ├── rwa/                           # Real World Assets
│   │   └── usdyModule.js                # USDY allocation (Ondo Finance)
│   ├── kms/                           # Key Management
│   │   └── tencentKMS.js                # DER parse, EIP-2, recovery ID, EIP-155
│   ├── evolution/                     # Self-Evolution
│   │   └── promptEvolution.js            # On-chain performance → IPFS prompt update
│   └── ipfs/                          # Decentralized Storage
│       └── storage.js                    # Pinata upload + deterministic fallback
├── frontend/                          # Next.js 15 + Glass Mode UI
├── test/                              # 103 tests (Hardhat + Jest)
├── scripts/                           # Deploy, verify, upload scripts
└── assets/                            # Agent Card JSON
```

---

## Quick Start

```bash
git clone https://github.com/USBVadik/TuringVault-Core.git
cd turingvault && npm install

# Configure
cp .env.example .env
# Required: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, PRIVATE_KEY, PINATA_JWT

# Run tests
npx hardhat test          # 91 contract tests
npx jest --no-coverage    # 12 orchestrator tests

# Run full cycle (dry-run)
node src/orchestrator/integratedOrchestrator.js paper

# Run prompt evolution
node src/evolution/promptEvolution.js --force

# Frontend
cd frontend && npm install && npm run dev
```

---

## Hackathon Tracks

### 🏆 Agentic Wallets & Economy (Primary)
- Full ERC-8004 implementation (5 contracts, all verified on Sourcify)
- Agent Identity as NFT with evolving IPFS metadata
- Tencent Cloud KMS pipeline — AI never touches keys, hardware-secured signing
- Pre-Action Checks as on-chain governance gates

### 🤖 AI & RWA Track
- USDY (Ondo Finance) adaptive allocation module
- Real yield from US T-Bills (5.25% APY)
- Risk-adjusted allocation (10-50% based on market regime)
- Merchant Moe DEX integration for USDY/USDT swaps on Mantle

### 📊 AI Trading & Strategy
- Byreal Perps CLI for institutional-grade execution
- Dual-model consensus prevents impulsive trades
- VaR-based autonomy (Human vs AI mode)
- Real on-chain DEX quotes (Merchant Moe LB v2.1)

### 🔍 AI Alpha & Data
- Nansen MCP Protocol integration (24 tools — token analysis, smart money, wallet profiling)
- 5-source market data aggregation (CoinGecko, DeFiLlama, Fear&Greed, Merchant Moe, USDY)
- Z.ai GLM-5 for market pattern recognition

---

## On-Chain Proof

Every claim is verifiable:

| Claim | Proof |
|-------|-------|
| 60+ AI decisions | [`DecisionLog.totalDecisions()`](https://explorer.mantle.xyz/address/0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5#readContract) |
| Agent registered | [`Identity.tokenURI(0)`](https://explorer.mantle.xyz/address/0x6f862802e0d5463DF18d267e422347BeCacc28bD#readContract) → IPFS |
| Prompt evolution | tokenURI changed 4× (each TX on explorer) |
| Pre-Action checks | [`Validation` events](https://explorer.mantle.xyz/address/0x0aeEd88959fCFC665284225dB93DED3e8A3Ff705) |
| Multi-agent consensus | Every TX has both analyst + validator reasoning hashes |

---

## Why TuringVault

| | Other AI Agents | TuringVault |
|---|---|---|
| **Reasoning** | Hidden / prompt-injected | On-chain, IPFS-pinned, auditable |
| **Consensus** | Single model | Dual-model adversarial (propose + challenge) |
| **Key Security** | Plaintext in .env | KMS HSM pipeline (DER + EIP-2 + EIP-155) |
| **Self-Improvement** | Manual prompt tweaking | Autonomous evolution with safety validator |
| **Trust** | "Trust me bro" | Cryptographic attestation (ERC-8004) |
| **Autonomy** | Binary (on/off) | Continuous (VaR-based sliding scale) |

---

## License

MIT

---

*Built for Mantle Turing Test Hackathon 2026 — proving AI cognition can be made trustless through radical on-chain transparency.*
