# TuringVault — Technical Architecture Deep Dive

## System Overview

TuringVault implements a **Trustless Cognitive Trading Loop** — a closed-cycle autonomous system where every AI decision is:
1. Informed by institutional-grade data (Nansen MCP + 4 additional sources)
2. Debated by independent AI agents (Analyst vs Validator)
3. Executed deterministically (Byreal Perps CLI)
4. Signed securely (Tencent Cloud KMS HSM)
5. Attested immutably (ERC-8004 on Mantle Mainnet)

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
│   │   multiAgent.js — Dual Agent Consensus Engine                    │  │
│   │                                                                  │  │
│   │   ┌────────────────┐         ┌────────────────────┐             │  │
│   │   │  ANALYST AGENT │         │  VALIDATOR AGENT    │             │  │
│   │   │                │         │                    │             │  │
│   │   │ Model: Claude  │         │ Model: Claude      │             │  │
│   │   │ Sonnet 4.6     │         │ Sonnet 4.6         │             │  │
│   │   │                │         │                    │             │  │
│   │   │ Input:         │         │ Input:             │             │  │
│   │   │ - Market data  │ ──────▶ │ - Analyst proposal │             │  │
│   │   │ - Risk params  │         │ - Original data    │             │  │
│   │   │ - Strategy     │         │ - Risk mandate     │             │  │
│   │   │                │         │                    │             │  │
│   │   │ Output:        │         │ Output:            │             │  │
│   │   │ - action       │         │ - approved (bool)  │             │  │
│   │   │ - confidence   │         │ - confidence       │             │  │
│   │   │ - reasoning    │         │ - riskScore        │             │  │
│   │   │ - targetAsset  │         │ - challenges       │             │  │
│   │   └────────────────┘         └────────────────────┘             │  │
│   │                                                                  │  │
│   │   Consensus Check (Zod-validated):                               │  │
│   │   - analyst.confidence >= 0.75                                   │  │
│   │   - validator.confidence >= 0.70                                 │  │
│   │   - validator.riskScore <= 65                                    │  │
│   │   - validator.approved === true                                  │  │
│   │                                                                  │  │
│   │   Result: { consensus: true/false, action, analyst, validator }  │  │
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
│  - Dual-agent adversarial consensus         │
│  - System prompts with hard risk limits     │
│  - Zod schema validation (no raw LLM out)   │
│                                             │
│  Layer 2: Code-Level                        │
│  - maxLeverage cap (5x)                     │
│  - maxPositionSize cap (0.1 BTC)            │
│  - maxDrawdown stop (10%)                   │
│  - Confidence threshold (80% for execution) │
│                                             │
│  Layer 3: Cryptographic                     │
│  - Tencent KMS HSM (keys never exported)    │
│  - EIP-1559 transaction signing             │
│  - All ops require valid signature           │
│                                             │
│  Layer 4: On-Chain                          │
│  - Smart contract access controls           │
│  - Immutable audit trail                    │
│  - Public verifiability                     │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Contracts | Solidity 0.8.28, Hardhat 2, OpenZeppelin v5.1 | Battle-tested, EVM cancun |
| AI Core | Claude Sonnet 4.6 (AWS Bedrock) | Best reasoning for finance |
| Validation | Zod schemas | Type-safe LLM output parsing |
| Execution | Byreal Perps CLI v0.3.7 | Institutional-grade, AI-native |
| Key Mgmt | Tencent Cloud KMS | HSM-backed, zero-exposure |
| Analytics | Nansen MCP (24 tools) | Smart Money intelligence |
| Frontend | Next.js 15, RainbowKit, wagmi v2 | Modern Web3 UX |
| Wallet | Bybit Wallet + WalletConnect | Hackathon sponsor integration |

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
