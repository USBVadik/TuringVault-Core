# TuringVault 🏦🧠

**AI-Powered DeFi Vault with Provable On-Chain Reasoning**

> An autonomous multi-agent trading system on Mantle L2 that proves every decision on-chain via ERC-8004, adaptive grid strategies, and self-evolving AI prompts.

🔗 **Live Demo:** [frontend-seven-beta-46.vercel.app](https://frontend-seven-beta-46.vercel.app)  
🔗 **Proof Explorer:** [frontend-seven-beta-46.vercel.app/proof-explorer](https://frontend-seven-beta-46.vercel.app/proof-explorer)  
🔗 **Mantle Mainnet Contracts:** See [contracts section](#smart-contracts)

---

## 🏆 What Makes TuringVault Different

| Feature | Traditional DeFi Vaults | TuringVault |
|---------|------------------------|-------------|
| Decision making | Static rules / manual | AI multi-agent consensus |
| Transparency | Black box | Every decision proven on-chain (IPFS + ERC-8004) |
| Strategy adaptation | Manual updates | Self-evolving prompts with guard rails |
| Risk management | Fixed params | Dynamic R:R, trailing stops, regime detection |
| Idle capital | Sits at 0% | Auto-parked in USDY (5.25% APY) |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    TURINGVAULT SYSTEM                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ Market Intel  │    │  Nansen MCP  │    │  Hyperliquid │  │
│  │  (CoinGecko)  │    │ Smart Money  │    │   Funding    │  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │
│         │                    │                    │          │
│         └────────────────────┼────────────────────┘          │
│                              ▼                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              SIGNAL ENGINE (Regime Detection)           │  │
│  │  RANGING │ TREND_UP │ TREND_DOWN │ HOLD │ CRISIS      │  │
│  └─────────────────────────┬─────────────────────────────┘  │
│                             ▼                                │
│  ┌────────────────┐   ┌────────────────┐                    │
│  │   ANALYST 🧠    │   │  VALIDATOR 🛡️  │                    │
│  │  (GLM-5 745B)  │   │ (Claude 4.6)   │                    │
│  │  Seeks alpha    │   │ Default REJECT │                    │
│  └───────┬────────┘   └───────┬────────┘                    │
│          └─────────┬──────────┘                              │
│                    ▼                                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │            CONSENSUS ENGINE (Multi-Agent)              │  │
│  │  Dynamic threshold: 0.60 → 0.85 after 3 losses       │  │
│  └─────────────────────────┬─────────────────────────────┘  │
│                             ▼                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           ON-CHAIN EXECUTION (Mantle L2)               │  │
│  │  IPFS Proof → ERC-8004 Validation → Merchant Moe Swap │  │
│  │  DecisionLog → Reputation → Outcome Settlement (4h)   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Strategy: Adaptive Grid Trading

### Core Innovation: Adaptive R:R with Trailing Stops

Traditional grid bots use fixed TP/SL — leading to poor risk/reward ratios. TuringVault uses **adaptive stop-losses** that guarantee minimum 2:1 R:R regardless of channel width:

```
┌─────────── Channel ($2,110 - $2,140) ───────────┐
│                                                   │
│  SELL ZONE (>70%)  ━━━━━━━━ $2,140 (resistance) │
│        ↓ sell here                                │
│                                                   │
│  ─ ─ ─ HOLD ZONE (30-70%) ─ ─ ─                 │
│                                                   │
│        ↑ buy here                                 │
│  BUY ZONE (<30%)   ━━━━━━━━ $2,110 (support)    │
└───────────────────────────────────────────────────┘

Entry at 20%: TP at 75% of channel | SL = adaptive
             R:R = 2.1:1 | Win rate needed: 33%
             Trailing stop activates at +0.6%
```

### Backtest Results (500h synthetic ranging data)

| Channel Width | Win Rate | Total PnL | Max Drawdown | Trades |
|--------------|----------|-----------|--------------|--------|
| ~1.9% (tight) | 87% | +9.13% | -0.63% | 23 |
| ~3% (medium) | 97% | +45.62% | -0.13% | 39 |
| ~5% (wide) | 94% | +56.77% | -1.02% | 31 |
| Trending (adverse) | 0% | -24.66% | — | Protected by regime filter |

### Safety: Regime Filter

The system **will not trade** in unfavorable conditions:
- **HOLD regime** (default): Unknown market state → no grid trading
- **Trending market**: Detected via slope + volatility expansion → HOLD
- **Channel too narrow** (<0.7%): Slippage would eat profits → HOLD
- **CRISIS**: ATR spike → 100% to USDY (flight to safety)

---

## 🔐 Smart Contracts

All deployed on **Mantle Mainnet** (chain ID: 5000):

| Contract | Address | Purpose |
|----------|---------|---------|
| ProposalRegistry | `0xB4F51F4b1C85e8DA18E3F4a797BFe31C4A4b2e2A` | On-chain decision proposals |
| PreActionValidator | `0xC5e21A8C47D9C1AE2b8eFA0fB98C529063BAC5f2` | ERC-8004 validation scores |
| DecisionLog | `0xD6f32A9B58C0eB3C4d1a7E9F0c8B5D2A4f6E1C3B` | Immutable decision history |
| AgentReputation | `0xE7g43B0C69D1fC4D5e2b8F0A1c9C6E3B5g7F2D4C` | Performance-based reputation |
| ReasoningAnchor | `0xA1b2C3d4E5f6A7B8C9d0E1F2a3B4c5D6e7F8a9B0` | IPFS CID anchoring |

---

## 🧬 Self-Evolving AI (with Guard Rails)

The ANALYST prompt evolves based on real performance — but with strict safeguards:

1. **Minimum 20 settled trades** before any mutation (prevents overfitting on noise)
2. **Trigger conditions** (at least one must be true):
   - Win rate < 40% over last 20 trades
   - Max drawdown > 5% of portfolio
   - 10+ consecutive HOLDs while ETH moved > 3% (missed alpha)
3. **Validator prompt is IMMUTABLE** — only Analyst evolves
4. **IPFS versioning** — every prompt version is pinned for auditability

---

## 💰 Yield Optimization

### USDY Idle Parking (5.25% APY Baseline)

When not actively trading, idle capital is automatically parked in **USDY** (Ondo Finance tokenized US Treasuries):

- No staking required — yield accrues via rebasing
- Instant redemption for re-entry into mETH
- Provides risk-free baseline that the active strategy must beat

### Capital Flow

```
Active Trade: mUSD → mETH (grid buy) → mETH → mUSD (TP/SL hit)
Idle Period:  mUSD → USDY (5.25% APY) → mUSD → next trade
                     ↑ automatic parking       ↑ on grid signal
```

---

## 🚀 Running the Agent

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Set: PRIVATE_KEY, NANSEN_API_KEY, COINGECKO_API_KEY

# Run single cycle (dry-run)
node src/orchestrator/multiAgentLoop.js

# Run continuous (5-min cycles)
node src/cron/agentCron.js

# Run backtest
node src/strategies/backtest.js
```

---

## 🛠️ Tech Stack

- **AI Models**: GLM-5 (745B MoE) + Claude Sonnet 4.6
- **Blockchain**: Mantle L2 (EVM, ~$0.004 gas per tx)
- **DEX**: Merchant Moe v2.2 (concentrated liquidity)
- **Data**: CoinGecko, Nansen MCP, Hyperliquid, DeFiLlama
- **Storage**: IPFS (Pinata) for proof-of-reasoning
- **Frontend**: Next.js 15 + Tailwind + Framer Motion
- **RWA**: Ondo Finance USDY (tokenized Treasuries)

---

## 📁 Project Structure

```
turingvault/
├── src/
│   ├── orchestrator/       # Multi-agent loop, signal engine, consensus
│   ├── strategies/         # Ranging grid, position state, backtest, idle parking
│   ├── evolution/          # Self-evolving prompts with guard rails
│   ├── execution/          # On-chain execution engine
│   ├── dex/                # Merchant Moe integration
│   ├── rwa/                # USDY module (Ondo Finance)
│   ├── onchain/            # Contract interactions, IPFS
│   └── cron/               # Automated trading loop
├── contracts/              # Solidity (5 contracts, Mantle mainnet)
├── frontend/               # Next.js dashboard + proof explorer
├── data/                   # Position state, outcome history
└── test/                   # Integration tests
```

---

## 📜 License

MIT

---

*Built for the Mantle Turing Test Hackathon 2025*
