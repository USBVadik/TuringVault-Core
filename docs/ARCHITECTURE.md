# TuringVault — Technical Architecture Deep Dive

## System Overview

TuringVault implements a **Trustless Cognitive Trading Loop** — a closed-cycle autonomous system where every AI decision is:

1. Informed by institutional-grade data (Nansen MCP + Hyperliquid + CoinGecko + DeFiLlama + Fear&Greed)
2. Debated by three independent AI agents (Analyst → Validator → Arbiter on disagreement)
3. Executed deterministically (Merchant Moe LB v2.2 + RWA allocator)
4. Verified post-execution (Synrail-inspired Discipline Layer: tx_proof + price_freshness + drift_detection)
5. Attested immutably (ERC-8004 on Mantle Mainnet, 4 TXs per cycle)

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                        DATA ACQUISITION LAYER                           │
│                                                                         │
│   ┌─────────────┐  ┌─────────────┐  ┌───────────┐  ┌───────────────┐  │
│   │  CoinGecko  │  │  DeFiLlama  │  │ Fear&Greed│  │   Nansen MCP  │  │
│   │  (Prices)   │  │   (TVL)     │  │ (Sentiment│  │ (Smart Money) │  │
│   └──────┬──────┘  └──────┬──────┘  └─────┬─────┘  └───────┬───────┘  │
│          │                │               │                  │          │
│   ┌──────┴────────────────┴───────────────┴──────────────────┴───────┐  │
│   │                                                                   │  │
│   │              unifiedMarketData.js (aggregator)                     │  │
│   │                                                                   │  │
│   │   + Byreal Perps Signals (RSI, funding, OI)                      │  │
│   │   + Cache layer (5min prices, 15min Nansen)                      │  │
│   │   → Outputs: promptContext (string) + raw data (object)          │  │
│   │                                                                   │  │
│   └───────────────────────────┬───────────────────────────────────────┘  │
│                               │                                         │
├───────────────────────────────┼─────────────────────────────────────────┤
│                               ▼                                         │
│                     COGNITIVE SYNTHESIS LAYER                            │
│                                                                         │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                                                                  │  │
│   │   multiAgent.js — Triple-Agent Consensus Engine                  │  │
│   │                                                                  │  │
│   │   ┌────────────────┐    ┌────────────────┐    ┌─────────────┐   │  │
│   │   │  ANALYST       │ →  │  VALIDATOR     │ →  │  ARBITER    │   │  │
│   │   │  Z.ai GLM-5    │    │  Claude 4.6    │    │  Gemini 3.5 │   │  │
│   │   │  via Bedrock   │    │  via Bedrock   │    │  via Vertex │   │  │
│   │   │                │    │                │    │             │   │  │
│   │   │ Input:         │    │ Input:         │    │ Input:      │   │  │
│   │   │ - Market data  │    │ - Analyst      │    │ - Analyst + │   │  │
│   │   │ - Risk params  │    │   proposal     │    │   Validator │   │  │
│   │   │ - Strategy     │    │ - Original     │    │   tied      │   │  │
│   │   │                │    │   data         │    │             │   │  │
│   │   │ Output:        │    │ Output:        │    │ Output:     │   │  │
│   │   │ - action       │    │ - approved     │    │ - vote      │   │  │
│   │   │ - confidence   │    │ - confidence   │    │ - confidence│   │  │
│   │   │ - reasoning    │    │ - riskScore    │    │ - reasoning │   │  │
│   │   │ - targetAsset  │    │ - challenges   │    │             │   │  │
│   │   └────────────────┘    └────────────────┘    └─────────────┘   │  │
│   │                                                                  │  │
│   │   Consensus Check (Zod-validated):                               │  │
│   │   - 2-of-3 must agree to execute                                 │  │
│   │   - Validator defaults to REJECT (burden of proof on Analyst)    │  │
│   │   - Arbiter only fires when Analyst and Validator disagree       │  │
│   │   - R/R ≥ 1.5:1 mandatory, regime alignment required             │  │
│   │                                                                  │  │
│   │   Result: { consensus, action, analyst, validator, arbiter? }    │  │
│   │                                                                  │  │
│   └──────────────────────────────┬───────────────────────────────────┘  │
│                                  │                                      │
├──────────────────────────────────┼──────────────────────────────────────┤
│                                  ▼                                      │
│                     EXECUTION LAYER                                      │
│                                                                         │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                                                                  │  │
│   │  executionEngine.js — Byreal Perps CLI Wrapper                   │  │
│   │                                                                  │  │
│   │  Decision → Asset Resolution → Size Calculation → CLI Command    │  │
│   │                                                                  │  │
│   │  Commands:                                                       │  │
│   │  - byreal-perps-cli order market buy/sell <size> <coin>          │  │
│   │  - byreal-perps-cli position leverage <coin> <x>                 │  │
│   │  - byreal-perps-cli position close-market <coin>                 │  │
│   │  - byreal-perps-cli signal scan (market intelligence)            │  │
│   │                                                                  │  │
│   │  Risk Guardrails (code-level, not prompt-level):                 │  │
│   │  - maxLeverage: 5x                                               │  │
│   │  - maxPositionSize: 0.1 BTC equivalent                          │  │
│   │  - maxDrawdown: 10%                                              │  │
│   │  - Minimum confidence threshold: 80%                             │  │
│   │                                                                  │  │
│   └──────────────────────────────┬───────────────────────────────────┘  │
│                                  │                                      │
│   ┌──────────────────────────────┼───────────────────────────────────┐  │
│   │                              ▼                                    │  │
│   │  tencentKMS.js — Hardware Security Module Signing                │  │
│   │                                                                  │  │
│   │  Flow: unsigned TX → Tencent KMS API → HSM signs → (v,r,s)      │  │
│   │  API: POST https://kms.tencentcloudapi.com (AsymmetricSign)      │  │
│   │  Algo: ECDSA secp256k1 (EVM-compatible)                         │  │
│   │  Fallback: local ethers.Wallet (dev mode)                        │  │
│   │                                                                  │  │
│   └──────────────────────────────┬───────────────────────────────────┘  │
│                                  │                                      │
├──────────────────────────────────┼──────────────────────────────────────┤
│                                  ▼                                      │
│                     ATTESTATION LAYER (MANTLE MAINNET)                   │
│                                                                         │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                                                                  │  │
│   │  ERC-8004 Trustless Agents Standard                              │  │
│   │                                                                  │  │
│   │  TX 1: ValidationRegistry.submitProposal()                       │  │
│   │         → Records analyst decision + confidence on-chain         │  │
│   │                                                                  │  │
│   │  TX 2: ValidationRegistry.validateProposal()                     │  │
│   │         → Records validator assessment + risk score              │  │
│   │                                                                  │  │
│   │  TX 3: DecisionLog.logDecision()                                 │  │
│   │         → Full reasoning chain: action, asset, confidence,       │  │
│   │           rationale, execution hash                              │  │
│   │                                                                  │  │
│   │  Result: Any address can call:                                   │  │
│   │  - registry.proposals(id) → see what AI proposed                 │  │
│   │  - registry.validations(id) → see how validator assessed it      │  │
│   │  - decisionLog.getDecision(id) → full reasoning + outcome        │  │
│   │  - identity.ownerOf(tokenId) → who controls this agent           │  │
│   │                                                                  │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Smart Contract Architecture

### TuringVaultIdentity (ERC-721)

- Agent NFT — makes the AI publicly discoverable
- TokenURI → IPFS metadata (model, capabilities, constraints)
- CAIP-10 cross-chain identifier support

### TuringVaultDecisionLog

- Append-only decision history
- Fields: action, asset, amounts, confidence, reasoning, executionTxHash
- Queryable by decision ID or time range

### TuringVaultRouter

- Strategy routing logic
- Maps agent intents to protocol interactions
- Manages approved protocol list

### TuringVaultValidationRegistry

- Multi-agent consensus on-chain
- submitProposal() → analyst records proposal
- validateProposal() → validator records assessment
- Public getters for full audit trail
- Stats tracking: approved/rejected counts

---

## Security Model

```
┌─────────────────────────────────────────────┐
│           SECURITY LAYERS                    │
├─────────────────────────────────────────────┤
│                                             │
│  Layer 1: AI-Level                          │
│  - Triple-agent adversarial consensus       │
│  - Validator defaults to REJECT             │
│  - Arbiter breaks ties on disagreement      │
│  - System prompts with hard risk limits     │
│  - Zod schema validation (no raw LLM out)   │
│                                             │
│  Layer 2: Code-Level                        │
│  - R/R ≥ 1.5:1 mandatory to approve         │
│  - Min confidence threshold (0.6 base,      │
│    0.7 elevated after consecutive losses)   │
│  - RWA per-cycle cap ($5) and per-day cap   │
│    ($25) enforced before any swap broadcast │
│  - 1% max price impact, 0.5% slippage       │
│                                             │
│  Layer 3: Post-Execution (Synrail-inspired) │
│  - Discipline Layer 3 gates per cycle:      │
│    tx_proof · price_freshness · drift       │
│  - Outcome blocked if any gate FAILs        │
│                                             │
│  Layer 4: On-Chain                          │
│  - Smart contract access controls           │
│  - 4 attestation TXs per cycle              │
│  - Immutable audit trail (Mantle Mainnet)   │
│  - Public verifiability via Mantlescan      │
│                                             │
│  Layer 5 (roadmap): Hardware-backed signing │
│  - Vault contract pattern + KMS HSM         │
│  - Currently: ethers.Wallet on cron runner  │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer      | Technology                                                                        | Rationale                                   |
| ---------- | --------------------------------------------------------------------------------- | ------------------------------------------- |
| Contracts  | Solidity 0.8.28, Hardhat 2, OpenZeppelin v5.1                                     | Battle-tested, EVM cancun                   |
| AI Core    | Z.ai GLM-5 (Analyst) + Claude Sonnet 4.6 (Validator) + Gemini 3.5 Flash (Arbiter) | Three-model adversarial consensus           |
| Inference  | AWS Bedrock + Google Vertex AI                                                    | Provider diversity, hackathon sponsor stack |
| Validation | Zod schemas                                                                       | Type-safe LLM output parsing                |
| Execution  | Merchant Moe LB v2.2 (concentrated liquidity)                                     | On-chain DEX, RWA allocator routes here     |
| Key Mgmt   | ethers.Wallet on cron (vault contract + HSM signing — roadmap)                    | Honest about current state                  |
| Analytics  | Nansen MCP, Hyperliquid funding, DeFiLlama                                        | Smart Money + derivatives + TVL             |
| Frontend   | Next.js 16, RainbowKit, wagmi, viem                                               | Modern Web3 UX on Vercel                    |
| Cron       | GitHub Actions hourly schedule                                                    | Public verifiable workflow log              |

---

## Configuration

```env
# AI Cognitive Core
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1

# Blockchain
MANTLE_RPC_URL=https://rpc.mantle.xyz
PRIVATE_KEY=...  # Dev fallback (use KMS in production)

# Nansen MCP Intelligence
NANSEN_API_KEY=nsn_...

# Tencent Cloud KMS (Production)
TENCENT_KMS_KEY_ID=...
TENCENT_SECRET_ID=...
TENCENT_SECRET_KEY=...

# Byreal Perps
# (uses system CLI — no env needed)
```

---

## Performance Metrics

- **Decision Cycle**: ~30 seconds (data fetch + 2 LLM calls + 3 on-chain TXs)
- **On-Chain Cost**: ~0.01 MNT per cycle (3 transactions)
- **Consensus Rate**: ~35% approval (conservative by design)
- **Data Freshness**: 5min price cache, 15min Nansen cache
- **Uptime**: Orchestrator runs every 5 minutes continuously
