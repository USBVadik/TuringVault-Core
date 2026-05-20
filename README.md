# TuringVault

> **Autonomous Multi-Agent AI System for Verifiable On-Chain Investment Decisions on Mantle Network**

[![Mantle Mainnet](https://img.shields.io/badge/Mantle-Mainnet-00D395)](https://explorer.mantle.xyz)
[![Verified](https://img.shields.io/badge/Contracts-Verified-brightgreen)](https://repo.sourcify.dev)
[![Tests](https://img.shields.io/badge/Tests-46%2F46-brightgreen)](#testing)
[![AI](https://img.shields.io/badge/AI-Claude%20Sonnet%204.6-blue)](#ai-engine)
[![Frontend](https://img.shields.io/badge/Frontend-Live-success)](https://frontend-seven-beta-46.vercel.app)

**Live Demo:** https://frontend-seven-beta-46.vercel.app  
**GitHub:** https://github.com/USBVadik/TuringVault-Core  
**Track:** AI & RWA (Primary) + Alpha & Data (Secondary)  
**Hackathon:** Mantle Turing Test 2026 — $120k prize pool

---

## The Problem

AI agents are increasingly making financial decisions — but there's no standard for **proving they reasoned correctly**. When a DeFi bot executes a swap, you see the transaction but not the thinking. You can't audit it, dispute it, or build reputation on top of it.

This creates three critical issues:
1. **No accountability** — AI can hallucinate and still execute trades
2. **No reputation** — agents have no verifiable track record
3. **No trust infrastructure** — you can't build multi-agent systems without consensus

---

## The Solution: Proof-of-Reasoning

TuringVault introduces **Proof-of-Reasoning (PoR)** — a new paradigm where AI agent reasoning is permanently recorded on-chain, creating a cryptographically verifiable audit trail of every decision.

Two independent AI agents (Analyst + Validator) must reach consensus before any action is recorded. The Validator independently cross-checks the Analyst's logic — catching hallucinations, overconfidence, and missed risks. The result: a **trustless, anti-hallucination investment system** where every decision is transparent, auditable, and immutable.

```
Market Data → [ANALYST AGENT] → Proposal → [VALIDATOR AGENT] → Consensus → On-Chain
                  Claude AI                      Claude AI           ↕
              Zod Validation               Risk Scoring (0-100)   Mantle Mainnet
```

---

## Architecture

### Smart Contracts (Mantle Mainnet — Chain 5000)

| Contract | Address | Description |
|----------|---------|-------------|
| TuringVaultIdentity | `0x582E6a649B99784829193E14bB7Af8c4A482E165` | ERC-721 AI Agent Identity (ERC-8004 inspired) |
| TuringVaultDecisionLog | `0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5` | Immutable on-chain decision log with reasoning |
| TuringVaultRouter | `0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001` | Asset routing between mETH ↔ mUSD |
| TuringVaultValidationRegistry | `0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6` | Multi-agent consensus registry |

All contracts verified on Sourcify (chain 5003 Sepolia + chain 5000 Mainnet).

Also deployed on **Mantle Sepolia** (chain 5003) for testing.

### AI Multi-Agent Pipeline

```
┌─────────────────────────────────────────────────────┐
│                    MARKET DATA LAYER                 │
│  CoinGecko (ETH price) + DeFiLlama (TVL/yields)     │
│  + Fear&Greed Index + Nansen Smart Money Netflows    │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              ANALYST AGENT (Claude Sonnet 4.6)       │
│  System: Risk-on/risk-off specialist                 │
│  Output: action, targetAsset, confidence, reasoning  │
│  Schema: AnalystSchema (Zod validation)              │
└──────────────────────┬──────────────────────────────┘
                       │ Proposal
┌──────────────────────▼──────────────────────────────┐
│             VALIDATOR AGENT (Claude Sonnet 4.6)      │
│  System: Independent risk manager                    │
│  Input: Market data + Analyst's complete proposal    │
│  Output: approved/rejected, riskScore, flaggedIssues │
│  Schema: ValidatorSchema (Zod validation)            │
└──────────────────────┬──────────────────────────────┘
                       │ Consensus Check
┌──────────────────────▼──────────────────────────────┐
│                  CONSENSUS ENGINE                    │
│  Analyst confidence ≥ 75%                           │
│  Validator confidence ≥ 70%                          │
│  Risk score ≤ 65/100                                 │
│  Validator approved = true                           │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              ON-CHAIN RECORDING (Mantle)             │
│  ValidationRegistry.submitProposal()                 │
│  ValidationRegistry.validateProposal()               │
│  DecisionLog.logDecision()                           │
└─────────────────────────────────────────────────────┘
```

### Frontend

- **Framework:** Next.js 15 + TypeScript + Tailwind CSS
- **Web3:** RainbowKit + wagmi v2 + viem
- **Wallet Support:** MetaMask, Bybit Wallet, WalletConnect (Project ID: 4bbc4a3e)
- **Live:** https://frontend-seven-beta-46.vercel.app

---

## Partner Integrations

### Mantle Network (Primary)
- All 4 contracts deployed and verified on **Mantle Mainnet** (chain 5000)
- Also on Mantle Sepolia (chain 5003) for testing
- Native assets used: **mETH** (0xcDA86A272531e8640cD7F1a92c01839911B90bb0) and **mUSD**
- AI agent makes risk-adjusted decisions between mETH (yield-bearing) and mUSD (stable)

### Bybit Wallet (Sponsor)
- RainbowKit configured to support Bybit Wallet connector
- WalletConnect v2 integration (Project ID: 4bbc4a3e3e36d2e28cf769726eb36313)
- Mantle network auto-detected on connect

### Nansen (Sponsor)
- Smart Money Netflow API integrated (`/api/v1/smart-money/netflow`)
- Real-time institutional flow data feeds into Analyst Agent's context
- 15-minute cache to preserve API credits
- Influences combined sentiment signal alongside Fear&Greed index

### Merchant Moe
- Router contract references Merchant Moe LB (Liquidity Book) architecture
- Swap routing logic designed for Merchant Moe bin-based liquidity pools
- Interface: `IMerchantMoeLBRouter` (mock for testnet, real integration in roadmap)

### AWS Bedrock (Infrastructure)
- Claude Sonnet 4.6 accessed via AWS Bedrock Converse API
- Region: us-east-1, Model: `us.anthropic.claude-sonnet-4-6`
- Both Analyst and Validator agents run on Bedrock

---

## Market Data Sources

| Source | Data | Update Frequency |
|--------|------|-----------------|
| CoinGecko | ETH price, 24h change, volume | Every cycle |
| DeFiLlama | Mantle TVL, mETH yield (APY) | Every cycle |
| Alternative.me | Fear & Greed Index (0-100) | Every cycle |
| Nansen | Smart Money netflows, top buying/selling | Every 15 min (cached) |

**Combined Sentiment Logic:**
- Fear&Greed ≥ 50 AND Nansen bullish → `bullish`
- Fear&Greed < 50 AND Nansen bearish → `bearish`
- Disagreement between sources → `neutral` (conservative)

---

## Quick Start

### Prerequisites
- Node.js 18+
- npm 9+

### Installation

```bash
git clone https://github.com/USBVadik/TuringVault-Core.git
cd TuringVault-Core
npm install
```

### Configuration

```bash
cp .env.example .env
# Fill in:
# MANTLE_RPC_URL=https://rpc.mantle.xyz
# MANTLE_SEPOLIA_RPC_URL=https://rpc.sepolia.mantle.xyz
# PRIVATE_KEY=your_private_key
# AWS_ACCESS_KEY_ID=your_aws_key
# AWS_SECRET_ACCESS_KEY=your_aws_secret
# AWS_REGION=us-east-1
# NANSEN_API_KEY=your_nansen_key
```

### Run Tests

```bash
npx hardhat test
# 46/46 tests passing
```

### Run Multi-Agent Orchestrator (single cycle)

```bash
node src/orchestrator/multiAgentLoop.js
```

### Run Continuous Orchestrator (every 5 min)

```bash
node src/orchestrator/mainMultiAgent.js
```

### Run Frontend

```bash
cd frontend
npm install
npm run dev
# http://localhost:3000
```

---

## Testing

```
46 tests passing across 4 contract suites:

TuringVaultIdentity          (8 tests)  ✅
TuringVaultDecisionLog       (10 tests) ✅
TuringVaultRouter            (13 tests) ✅
TuringVaultValidationRegistry(15 tests) ✅
```

### AI Integration Tests

```bash
# Mock tests (no API needed)
node src/orchestrator/test.integration.js

# Live Claude tests (requires AWS Bedrock)
node src/orchestrator/test.live.js

# Multi-agent consensus test
node src/orchestrator/test.multiAgent.js
```

---

## Key Concepts

### ERC-8004 Inspired Identity
Each AI agent in TuringVault has an on-chain identity NFT (ERC-721) that accumulates reputation through recorded decisions. The `TuringVaultIdentity` contract provides:
- Unique agent identity with metadata (model name, version, capabilities)
- URI-based agent profile (IPFS-hosted)
- Owner-controlled identity management

### Proof-of-Reasoning
Unlike traditional DeFi bots that only log transactions, TuringVault logs the **complete reasoning chain**:
1. What market data was observed
2. What the Analyst agent concluded and why
3. What the Validator agent flagged as risks
4. Whether consensus was reached and at what confidence level
5. The final action executed (or blocked)

Every decision is permanently on-chain and publicly auditable.

### Anti-Hallucination Architecture
The dual-agent design specifically targets LLM hallucination:
- Analyst and Validator run with **different system prompts** (different "personalities")
- Validator sees the Analyst's full reasoning and must independently verify each claim against market data
- If Analyst claims "yield spread is 330bps" but data shows differently, Validator flags it
- Consensus fails if either agent's output fails Zod schema validation

---

## Roadmap

### Phase 1 — Foundation ✅ COMPLETE
- [x] Hardhat environment (Solidity 0.8.28, EVM Cancun)
- [x] TuringVaultIdentity.sol
- [x] TuringVaultDecisionLog.sol
- [x] TuringVaultRouter.sol
- [x] Deploy to Mantle Sepolia
- [x] AI Orchestrator (Claude via AWS Bedrock)
- [x] Zod validation pipeline

### Phase 2 — Integration ✅ COMPLETE
- [x] Full loop: Market data → AI → On-chain
- [x] Real market feeds (CoinGecko, DeFiLlama, Fear&Greed)
- [x] Nansen Smart Money integration
- [x] Multi-agent consensus (Analyst + Validator)
- [x] TuringVaultValidationRegistry.sol
- [x] Frontend dApp (Next.js + RainbowKit)
- [x] Deploy to Mantle MAINNET (all 4 contracts, verified)
- [x] Continuous orchestrator (every 5 min)

### Phase 3 — Polish ← CURRENT
- [ ] UI "Glass Mode" — real-time agent thinking visualization
- [ ] Human-readable reasoning display (not raw JSON)
- [ ] Live decision feed from on-chain events
- [ ] mETH ↔ mUSD real swap via Merchant Moe
- [ ] USDY oracle for risk-free rate comparison
- [ ] Mobile responsive polish

### Phase 4 — Advanced
- [ ] Nansen portfolio endpoint (track smart money positions)
- [ ] Multi-model voting (Claude + Gemini consensus)
- [ ] Agent reputation scoring (track historical accuracy)
- [ ] Mainnet token balances & real execution
- [ ] Video demo (2+ min)
- [ ] DoraHacks submission

---

## Project Structure

```
TuringVault-Core/
├── contracts/
│   ├── TuringVaultIdentity.sol          # AI Agent NFT identity
│   ├── TuringVaultDecisionLog.sol       # Immutable decision log
│   ├── TuringVaultRouter.sol            # Asset routing
│   ├── TuringVaultValidationRegistry.sol# Multi-agent consensus
│   ├── interfaces/
│   │   └── IMerchantMoeLBRouter.sol     # Merchant Moe interface
│   └── mocks/
│       ├── MockERC20.sol
│       └── MockLBRouter.sol
├── scripts/
│   ├── deploy.js                        # Sepolia deploy
│   ├── deployMainnet2.js                # Mainnet deploy
│   └── deployRegistry.js               # Registry deploy
├── src/orchestrator/
│   ├── config.js                        # Configuration
│   ├── marketData.js                    # Data feeds (CoinGecko/DeFiLlama/Nansen)
│   ├── aiEngine.js                      # Single-agent Claude engine
│   ├── multiAgent.js                    # Dual-agent consensus engine
│   ├── multiAgentLoop.js                # Full cycle: data→AI→on-chain
│   ├── mainMultiAgent.js                # Cron orchestrator (every 5 min)
│   └── validator.js                     # Zod schemas
├── test/
│   ├── TuringVaultIdentity.test.js
│   ├── TuringVaultDecisionLog.test.js
│   ├── TuringVaultRouter.test.js
│   └── TuringVaultValidationRegistry.test.js
├── frontend/
│   └── app/
│       ├── providers.tsx                # RainbowKit + wagmi config
│       ├── layout.tsx                   # Dark theme layout
│       ├── page.tsx                     # Main dApp UI
│       └── api/market/route.ts          # Market data API route
└── docs/
    └── PROJECT_VISION.md                # Deep dive concept doc
```

---

## Why TuringVault Wins

| Judging Criteria | Our Approach | Score Potential |
|-----------------|--------------|-----------------|
| Technical Depth (30%) | Multi-agent AI, 4 verified contracts, 46 tests, Zod validation, on-chain consensus | High |
| Innovation (25%) | First Proof-of-Reasoning system on Mantle — new paradigm for AI agent accountability | Very High |
| Ecosystem Contribution (25%) | Mantle Mainnet, mETH/mUSD, Merchant Moe, Bybit Wallet, Nansen | High |
| Product Completeness (20%) | Live Vercel frontend, working orchestrator, wallet connect | Medium-High |

**The unique insight:** Every other hackathon DeFi bot executes trades and logs transactions. TuringVault is the first to log **why** the AI made the decision — permanently, verifiably, on-chain. This is the infrastructure layer for trustworthy AI agents in Web3.

---

## License

MIT
