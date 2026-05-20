# TuringVault

> **Trustless Cognitive Trading Loop — Multi-Agent AI with Verifiable On-Chain Reasoning on Mantle**

[![Mantle Mainnet](https://img.shields.io/badge/Mantle-Mainnet-00D395)](https://mantlescan.xyz)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-Trustless_Agents-blue)](https://eips.ethereum.org/EIPS/eip-8004)
[![Tests](https://img.shields.io/badge/tests-46%2F46_passing-brightgreen)]()
[![Live](https://img.shields.io/badge/frontend-live-purple)](https://frontend-seven-beta-46.vercel.app)

---

## The Problem

AI trading agents are **black boxes**. Users delegate capital to systems they cannot audit — there's no way to verify *why* a trade was made, *what data* informed the decision, or whether the AI is hallucinating. This creates an impossible trust problem: if you can't verify the reasoning, you can't distinguish a genius trader from a random number generator.

## The Solution: Proof-of-Reasoning

TuringVault introduces **Proof-of-Reasoning (PoR)** — a cryptographic attestation framework where every AI decision is:

1. **Made transparently** — dual-agent consensus (Analyst + Validator)
2. **Recorded immutably** — full reasoning chain on Mantle blockchain
3. **Auditable by anyone** — ERC-8004 Identity + Validation + Reputation registries
4. **Executed deterministically** — Byreal CLI for institutional-grade trade execution
5. **Informed by real data** — Nansen MCP Smart Money intelligence + multi-source aggregation

---

## Architecture: Trustless Cognitive Trading Loop

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    TRUSTLESS COGNITIVE TRADING LOOP                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌────────────┐│
│  │ CONTEXT      │   │ COGNITIVE    │   │ EXECUTION    │   │ ATTESTATION││
│  │ ACQUISITION  │──▶│ SYNTHESIS    │──▶│ ENGINE       │──▶│ (ON-CHAIN) ││
│  └──────────────┘   └──────────────┘   └──────────────┘   └────────────┘│
│        │                  │                  │                │         │
│  ┌─────┴─────┐      ┌─────┴─────┐      ┌─────┴─────┐    ┌─────┴─────┐   │
│  │ Nansen MCP│      │ Analyst   │      │ Byreal    │    │ ERC-8004  │   │
│  │ CoinGecko │      │ Agent     │      │ Perps CLI │    │ Identity  │   │
│  │ DeFiLlama │      │    ↓      │      │ Tencent   │    │ Validation│   │
│  │ Byreal    │      │ Validator │      │ KMS HSM   │    │ Reputation│   │
│  │ Signals   │      │ Agent     │      │ Sign+Send │    │ Decision  │   │
│  │ Fear&Greed│      │    ↓      │      └───────────┘    │ Log       │   │
│  └───────────┘      │ Consensus │                       └───────────┘   │
│                     └───────────┘                                       │
│                                                                         │
│  Chain: Mantle Mainnet (5000)  │  AI: Claude Sonnet 4.6 + Z.ai GLM-4.7  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Partner Integrations

| Partner | Integration | Purpose |
|---------|------------|---------|
| **Nansen** | MCP Protocol (24 tools) | Smart Money tracking, token analysis, wallet profiling |
| **Byreal** | Perps CLI + RealClaw | Deterministic execution — CLMM liquidity + perpetual futures |
| **Tencent Cloud** | KMS HSM | Institutional key management — private keys never leave hardware |
| **AWS Bedrock** | Claude Sonnet 4.6 | Cognitive core — multi-agent reasoning + decision synthesis |
| **Z.ai** | GLM-4.7 (planned) | Secondary model for multi-model voting consensus |
| **Mantle** | ERC-8004 + DeFi | On-chain attestation, mETH/mUSD/USDY yield strategies |
| **Bybit** | Wallet Integration | End-user access via Bybit Web3 Wallet |

---

## Data Sources (Live)

```
=== MARKET INTELLIGENCE ===

[PRICE DATA]        CoinGecko → ETH, MNT real-time
[TVL]               DeFiLlama → Mantle ecosystem health
[SENTIMENT]         Fear & Greed Index → market psychology
[SMART MONEY]       Nansen MCP → institutional flows, 53M+ labeled addresses
[TRADING SIGNALS]   Byreal Perps → RSI, funding rates, open interest
```

---

## Multi-Agent Consensus System

TuringVault does NOT rely on a single AI making decisions. Instead:

### Agent 1: Analyst
- Receives full market context (5 data sources)
- Proposes action with confidence score + reasoning
- Constrained by hard-coded risk parameters

### Agent 2: Validator  
- Independently reviews the Analyst's proposal
- Challenges assumptions, identifies risks
- Assigns validation confidence + risk score

### Consensus Engine (Zod-validated)
- Both agents must agree (analyst ≥75%, validator ≥70%)
- Risk score must be below threshold (≤65)
- Failed consensus → HOLD (conservative default)
- Result recorded on-chain regardless of outcome

---

## Deployed Contracts — Mantle Mainnet

| Contract | Address | Verified |
|----------|---------|----------|
| TuringVaultIdentity (ERC-721) | `0x582E6a649B99784829193E14bB7Af8c4A482E165` | ✅ Sourcify |
| TuringVaultDecisionLog | `0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5` | ✅ Sourcify |
| TuringVaultRouter | `0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001` | ✅ Sourcify |
| ValidationRegistry | `0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6` | ✅ Sourcify |

Agent Identity NFT: Token #0 (Claude Sonnet 4.6 Multi-Agent)

---

## Project Structure

```
turingvault/
├── contracts/                    # Solidity — ERC-8004 + DeFi integration
│   ├── TuringVaultIdentity.sol       # ERC-721 Agent Identity Registry
│   ├── TuringVaultDecisionLog.sol    # Immutable decision history
│   ├── TuringVaultRouter.sol         # Strategy routing + execution
│   └── TuringVaultValidationRegistry.sol  # Multi-agent consensus on-chain
├── src/
│   ├── orchestrator/             # AI Cognitive Core
│   │   ├── multiAgent.js            # Analyst + Validator dual-agent engine
│   │   ├── multiAgentLoop.js        # Full cycle: data → AI → on-chain
│   │   ├── unifiedMarketData.js     # 5-source market intelligence aggregator
│   │   └── mainMultiAgent.js        # Production cron orchestrator
│   ├── execution/                # Trade Execution Layer
│   │   ├── executionEngine.js        # Byreal Perps CLI wrapper
│   │   └── tencentKMS.js            # Tencent Cloud KMS signing interface
│   └── mcp/                      # Protocol Integrations
│       └── nansenMCP.js              # Nansen MCP client (24 tools)
├── frontend/                     # Next.js 15 + RainbowKit + Bybit Wallet
├── test/                         # 46 tests (Hardhat + Chai)
├── docs/                         # Architecture, Vision, Submission docs
│   ├── PROJECT_VISION.md
│   ├── ARCHITECTURE.md
│   └── SUBMISSION.md
└── scripts/                      # Deploy + verify scripts
```

---

## Quick Start

```bash
# Clone
git clone https://github.com/USBVadik/TuringVault-Core.git
cd turingvault

# Install
npm install
npm install -g @byreal-io/byreal-perps-cli

# Configure
cp .env.example .env
# Add: AWS keys, NANSEN_API_KEY, PRIVATE_KEY

# Test
npx hardhat test  # 46/46 passing

# Run orchestrator (dry-run)
node src/orchestrator/multiAgentLoop.js

# Run with live execution
DRY_RUN=false node src/orchestrator/mainMultiAgent.js
```

---

## ERC-8004 Implementation

TuringVault implements the full ERC-8004 (Trustless Agents) standard:

1. **Identity Registry** — Agent registered as ERC-721 NFT with IPFS metadata
2. **Validation Registry** — Every consensus result cryptographically attested on-chain
3. **Reputation Registry** — Historical accuracy tracked (approved/rejected ratio)
4. **Decision Log** — Full reasoning chain (action, asset, confidence, rationale)

This makes TuringVault the first verifiable AI trading agent where any smart contract or auditor can programmatically verify the reasoning behind every trade.

---

## Hackathon Tracks

### AI Trading & Strategy
- Byreal Perps CLI for institutional execution
- Multi-agent consensus prevents impulsive trades
- Risk guardrails enforced at code level (not prompt level)

### AI Alpha & Data  
- Nansen MCP (24 tools) for Smart Money intelligence
- 5-source market data aggregation
- Real-time signal processing from Byreal

### Agentic Wallets & Economy
- Full ERC-8004 implementation (Identity + Validation + Reputation)
- Tencent Cloud KMS for institutional key security
- Agent autonomy with verifiable constraints

---

## Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1: Foundation | ✅ Done | Contracts, tests, Sepolia deploy |
| Phase 2: Intelligence | ✅ Done | Multi-agent consensus, market data |
| Phase 3: Execution | 🔄 Current | Byreal integration, Nansen MCP, KMS |
| Phase 4: Polish | 📋 Planned | Glass UI, video demo, DoraHacks submit |

---

## Why TuringVault Wins

| Criteria (30%) | Our Approach |
|----------------|--------------|
| **Technical Depth** | 5 partner integrations, dual-agent AI, ERC-8004, institutional KMS |
| **Innovation** (25%) | First Proof-of-Reasoning system — verifiable AI cognition on-chain |
| **Ecosystem** (25%) | Mainnet deploy, mETH strategies, Nansen+Byreal+Tencent integration |
| **Completeness** (20%) | 46 tests, live frontend, running orchestrator, full documentation |

---

## License

MIT

---

*Built for Mantle Turing Test 2026 — proving AI can be trusted through radical transparency.*
