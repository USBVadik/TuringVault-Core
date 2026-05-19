# TuringVault — AI-Managed RWA Router on Mantle

<p align="center">
  <strong>Autonomous AI agent that makes verifiable, on-chain investment decisions for Real World Assets</strong>
</p>

<p align="center">
  <a href="https://frontend-seven-beta-46.vercel.app">Live Demo</a> •
  <a href="https://explorer.sepolia.mantle.xyz/address/0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5">On-Chain Decisions</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#getting-started">Getting Started</a>
</p>

---

## 🧠 What is TuringVault?

TuringVault is an **autonomous AI investment agent** that:

1. **Observes** real-time market data (ETH price, yields, sentiment, smart money flows)
2. **Reasons** using Claude Sonnet 4.6 (Anthropic) about optimal asset allocation
3. **Proves** its reasoning on-chain — every decision is permanently recorded with full rationale
4. **Executes** swaps between mETH and mUSD on Mantle via Merchant Moe DEX

Unlike traditional trading bots, TuringVault creates an **immutable audit trail of AI reasoning** — making it the first system where you can verify *why* an AI made each financial decision, not just *what* it did.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    TURINGVAULT SYSTEM                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │ Market   │───▶│  AI Engine   │───▶│  Zod Validator   │  │
│  │ Data     │    │ Claude 4.6   │    │  (Schema Guard)  │  │
│  └──────────┘    └──────────────┘    └────────┬─────────┘  │
│       │                                        │            │
│  ┌────┴─────┐                          ┌──────┴────────┐   │
│  │CoinGecko │                          │  Valid JSON    │   │
│  │DeFiLlama │                          │  Decision      │   │
│  │Fear&Greed│                          └──────┬────────┘   │
│  └──────────┘                                 │            │
│                                               ▼            │
│  ┌─────────────────── MANTLE NETWORK ──────────────────┐   │
│  │                                                      │   │
│  │  ┌────────────────┐  ┌──────────────────────────┐   │   │
│  │  │ Identity       │  │ DecisionLog              │   │   │
│  │  │ (ERC-8004 NFT) │  │ (Proof of Reasoning)     │   │   │
│  │  │ Token #0       │  │ • action: swap/hold      │   │   │
│  │  └────────────────┘  │ • confidence: 0-10000    │   │   │
│  │                       │ • reasoning: full text   │   │   │
│  │  ┌────────────────┐  │ • timestamp              │   │   │
│  │  │ Router         │  └──────────────────────────┘   │   │
│  │  │ (Swap Engine)  │                                  │   │
│  │  │ mETH ↔ mUSD   │                                  │   │
│  │  └────────────────┘                                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  FRONTEND (Next.js + RainbowKit)                             │
│  • Connect Wallet (Bybit, MetaMask, Rabby)                   │
│  • Deposit/Withdraw MNT                                      │
│  • Live AI decisions feed                                    │
│  • Market data dashboard                                     │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔑 Key Innovation: Proof of Reasoning

Traditional AI systems are black boxes. TuringVault introduces **Proof of Reasoning** — every AI decision includes:

| Field | Description | Example |
|-------|-------------|---------|
| `action` | What the AI decided | `"swap"` |
| `targetAsset` | Where to allocate | `"mETH"` |
| `confidence` | How certain (basis points) | `9100` (91%) |
| `reasoningHash` | Full reasoning text | `"Bullish sentiment, smart money $1.8M inflow..."` |
| `timestamp` | When decided | Block timestamp |
| `txHash` | Execution proof | Transaction hash |

This is permanently stored on Mantle — anyone can audit the AI's decision-making process retroactively.

---

## 📦 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Smart Contracts | Solidity 0.8.28 (Cancun) | On-chain logic |
| Framework | Hardhat 2.22 | Development & testing |
| Standards | ERC-8004, ERC-721 | AI agent identity |
| AI Model | Claude Sonnet 4.6 (AWS Bedrock) | Decision engine |
| Validation | Zod | Schema enforcement |
| Data | CoinGecko, DeFiLlama, Fear&Greed | Market feeds |
| Frontend | Next.js 15, RainbowKit, wagmi v2 | Web3 dApp |
| Network | Mantle Sepolia / Mainnet | Deployment target |
| Assets | mETH, mUSD | RWA exposure |

---

## 🚀 Getting Started

### Prerequisites

- Node.js v22+
- npm 10+
- An AWS account with Bedrock access (Claude Sonnet 4.6)

### Installation

```bash
git clone https://github.com/USBVadik/TuringVault-Core.git
cd TuringVault-Core
npm install
```

### Configuration

```bash
cp .env.example .env
# Edit .env with your keys:
# PRIVATE_KEY=your_wallet_private_key
# AWS_ACCESS_KEY_ID=your_aws_key
# AWS_SECRET_ACCESS_KEY=your_aws_secret
# AWS_REGION=us-east-1
```

### Compile & Test

```bash
npx hardhat compile
npx hardhat test
```

### Run AI Orchestrator

```bash
# Single cycle (test)
node src/orchestrator/fullLoop.js

# Continuous operation (every 60s)
node src/orchestrator/main.js
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

---

## 📋 Deployed Contracts (Mantle Sepolia)

| Contract | Address | Verified |
|----------|---------|----------|
| TuringVaultIdentity | `0x582E6a649B99784829193E14bB7Af8c4A482E165` | ✅ Sourcify |
| TuringVaultDecisionLog | `0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5` | ✅ Sourcify |
| TuringVaultRouter | `0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001` | ✅ Sourcify |

---

## 🧪 Test Results

```
TuringVaultIdentity:    10/10 tests passing
TuringVaultDecisionLog: 10/10 tests passing  
TuringVaultRouter:      11/11 tests passing
Integration (Live AI):   3/3  scenarios passing
─────────────────────────────────────────────
Total:                  34/34 ✅
```

---

## 🎯 Hackathon Track

**AI & RWA Track — Path B: AI-Driven RWA Application**

- **Asset Category**: Mantle liquid staking (mETH) and stablecoins (mUSD)
- **AI Role**: Autonomous portfolio rebalancing with full on-chain reasoning
- **Mantle Value**: Native integration with Mantle ecosystem assets, contributing to TVL and DeFi activity

---

## 📄 License

MIT

---

<p align="center">
  Built for <strong>Mantle Turing Test Hackathon 2026</strong>
</p>
