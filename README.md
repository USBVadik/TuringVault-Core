# TuringVault 🏦🧠

**Autonomous AI Agents with Provable On-Chain Reasoning — Built on Mantle**

> _"When an AI agent executes a trade, you see the transaction. You don't see the reasoning. TuringVault changes that."_

---

## The Problem

AI trading agents are black boxes. They manage capital, execute trades, lose money — and leave **zero trace** of their decision-making process. You can't tell if a loss was due to market conditions (acceptable) or an AI hallucination (catastrophic).

**No accountability. No auditability. No trust.**

TuringVault introduces **Proof-of-Reasoning (PoR)** — a new primitive where every AI decision is recorded on-chain with its complete reasoning chain, verified by adversarial multi-agent consensus, and scored by an immutable reputation system.

---

## Live System (Running Now)

🔗 **Dashboard:** [frontend-seven-beta-46.vercel.app](https://frontend-seven-beta-46.vercel.app)  
🔗 **Proof Explorer:** [frontend-seven-beta-46.vercel.app/proof-explorer](https://frontend-seven-beta-46.vercel.app/proof-explorer)  
🔗 **DecisionLog on Explorer:** [explorer.mantle.xyz/address/0x7bCd...cfbB5](https://explorer.mantle.xyz/address/0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5)  
🔗 **ValidationRegistry:** [explorer.mantle.xyz/address/0x6841...63b6](https://explorer.mantle.xyz/address/0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6)

**Stats (live, on-chain — verified via contract calls):**
- **104+ autonomous decisions** logged to Mantle Mainnet with full reasoning
- **61% rejection rate** — Validator blocks ~2 out of 3 proposals (capital protection)
- **40 approved, 64 rejected** — adversarial consensus working as designed
- **55%+ of agent NAV in tokenized Treasuries** (USDT0 LayerZero) — first RWA swap [`0x0af2336…`](https://mantlescan.xyz/tx/0x0af23364c7651b053d33b0f7ed3eb8b30107b5dc489e96a7ad8ac90cad3e09de)
- Hourly cycle via GitHub Actions cron (public log linked below); adaptive regime detection on each tick
- Zero catastrophic losses — demo capital, custodial EOA, vault contract pattern in development

---

## Innovation: Proof-of-Reasoning

No other DeFi project puts AI reasoning on-chain as a first-class primitive.

```
Traditional AI Agent:          TuringVault:
                               
User → Deposit → ???           User → Deposit → AI Reasons → 
     → Profit/Loss                  → Proof stored on IPFS
     → No explanation               → Hash anchored on Mantle
                                    → Multi-agent validation
                                    → On-chain reputation score
                                    → Full audit trail forever
```

Every decision creates an immutable record: what data the AI observed, what conclusions it drew, what risks it identified, and why it acted. Stored on IPFS, anchored on Mantle, scored by reputation.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      TURINGVAULT SYSTEM                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  DATA LAYER                                                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐ │
│  │ CoinGecko  │  │ Nansen MCP │  │ Hyperliquid│  │ Tencent   │ │
│  │ Price/Vol  │  │ Smart Money│  │  Funding   │  │ Cloud AI  │ │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬─────┘ │
│        └────────────────┼───────────────┼───────────────┘        │
│                         ▼                                         │
│  SIGNAL ENGINE (Regime Detection)                                 │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │ RANGING │ TREND_UP │ TREND_DOWN │ HOLD │ CRISIS           │   │
│  └────────────────────────────┬──────────────────────────────┘   │
│                               ▼                                   │
│  MULTI-AGENT CONSENSUS                                            │
│  ┌────────────────┐     ┌────────────────┐                       │
│  │   ANALYST 🧠   │     │  VALIDATOR 🛡️  │                       │
│  │  GLM-5 (745B)  │     │  Claude 4.6    │                       │
│  │  Seeks alpha   │     │  Default REJECT│                       │
│  └───────┬────────┘     └───────┬────────┘                       │
│          └─────────┬────────────┘                                 │
│                    ▼                                               │
│  ON-CHAIN VERIFICATION (Mantle Mainnet)                           │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │ IPFS Proof → ERC-8004 Identity → ValidationRegistry       │   │
│  │ → DecisionLog → ReputationRegistry → Outcome Settlement   │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Smart Contracts (Mantle Mainnet, chain 5000)

All contracts verified on Sourcify:

| Contract | Address | Purpose |
|----------|---------|---------|
| TuringVaultIdentity | [`0x6f862802e0d5463DF18d267e422347BeCacc28bD`](https://explorer.mantle.xyz/address/0x6f862802e0d5463DF18d267e422347BeCacc28bD) | ERC-8004 AI agent identity |
| TuringVaultDecisionLog | [`0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5`](https://explorer.mantle.xyz/address/0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5) | Immutable decision history |
| TuringVaultRouter | [`0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001`](https://explorer.mantle.xyz/address/0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001) | Trade execution & routing |
| TuringVaultValidationRegistry | [`0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6`](https://explorer.mantle.xyz/address/0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6) | Multi-agent validation scores |
| ReputationRegistry | [`0xC78119F3274B05046Ac7c38a14298a6cbD946e1a`](https://explorer.mantle.xyz/address/0xC78119F3274B05046Ac7c38a14298a6cbD946e1a) | On-chain AI reputation |

---

## Strategy: Adaptive Grid Trading

### Why Grid + AI?

Traditional grid bots are dumb — fixed parameters, no regime awareness. Pure AI agents hallucinate and overtrade. TuringVault combines both:

- **AI detects the regime** (ranging/trending/crisis)
- **Grid bot executes** only in favorable conditions
- **AI validates** every proposed trade before execution
- **On-chain proof** ensures accountability

### Safety Mechanisms

| Guard | Trigger | Action |
|-------|---------|--------|
| Regime Filter | Trending market detected | HOLD (no trades) |
| Validator Veto | Risk > threshold | REJECT (logged on-chain) |
| Confidence Gate | Score < 65% | Skip execution |
| Channel Too Narrow | < 0.7% width | HOLD (slippage protection) |
| Crisis Mode | ATR spike | Flight to USDY safety |
| Trailing Stops | Active position | Adaptive R:R ≥ 2:1 |

### Discipline Layer (Post-Execution Verification)

Inspired by [Synrail](https://github.com/USBVadik/synrail) — a generalized discipline framework for autonomous agents. After every swap execution, a three-gate verification runs:

1. **Proof Gate** — TX exists on-chain, sender matches vault wallet, confirmed ≥ 2 blocks
2. **Freshness Gate** — Price data used was < 60s old at decision time (rejects stale/cached)
3. **Drift Detection** — Flags when action pattern diverges from declared market regime

If any gate fails → outcome settlement is blocked, bounded repair step triggered. This prevents "false-green" scenarios where the agent claims success without verifiable proof.

See [`docs/discipline-layer.md`](./docs/discipline-layer.md) for full architecture.

**Live dashboard:** [/discipline](https://frontend-seven-beta-46.vercel.app/discipline) — full per-cycle gate history, aggregate pass rates, click-to-expand drill-down. The strip on the home page shows the latest cycle's gate statuses at a glance.

### Adversarial Challenge

A live `/challenge` page lets anyone inject 4 canonical attack vectors
(flash crash, pump signal, oracle manipulation, sybil consensus) into the
**real** multi-agent pipeline and watch the agents reason. Each result
includes verbatim reasoning from GLM-5, Claude Sonnet 4.6, and (on
disagreement) Gemini 3.5 — the same code path that drives production.

Live mode is gated by `CHALLENGE_LIVE_ENABLED=true` (Vercel env var). When
off, the page returns a deterministic preview and the banner clearly
labels it `PREVIEW`. With anchor enabled, each challenge submits one
`ValidationRegistry.submitProposal` TX with a `[CHALLENGE-*]` action prefix,
so a judge's session leaves an on-chain trail.

Operator runbook: [`.kiro/runbooks/challenge-operations.md`](.kiro/runbooks/challenge-operations.md).
Live page: <https://frontend-seven-beta-46.vercel.app/challenge>

### RWA Execution: USDT0 + USDY
The agent allocates to **on-chain Treasury-collateralised stablecoins**
through two paths, both routed through Merchant Moe Liquidity Book:

- **Path A — LLM-driven.** Analyst's action vocabulary includes
  `rwa_allocate` and `rwa_exit`. When consensus reaches with one of
  these (validator + arbiter agree), the orchestrator builds a swap
  intent and executes against the USDT/USDT0 pool (binStep=1).
- **Path B — deterministic idle-parking.** When the agent has been
  FLAT for ≥ 24 h and regime is not `TREND_UP`, a small fraction (20%
  default) of idle stables auto-routes to USDT0. Cooldown 6 h between
  events.

**Active target:** USDT0 (LayerZero omnichain Tether,
Treasury-collateralised, 1:1 USD peg). USDT0 itself is not
yield-bearing — the dashboard never claims an APY on it.

**Paper-ready target:** USDY (Ondo Finance tokenized Treasuries, 5.25%
APY). Mantle pool depth is currently zero, so the swap path throws
`RWA_POOL_INACTIVE` until reactivated. Module is shipped, gated off.

Per-swap and per-day caps are operator-tunable via GitHub Actions
secrets without redeploy. See
[`.kiro/runbooks/rwa-operations.md`](.kiro/runbooks/rwa-operations.md).

### Self-Evolving AI (with Guard Rails)
The ANALYST prompt evolves based on performance, gated by safeguards:
- Minimum 20 settled trades before any mutation
- Validator prompt is **IMMUTABLE** — only Analyst evolves
- Every prompt version pinned to IPFS for auditability
- An immutable `FORMAT_GUARD_SUFFIX` is appended to every loaded
  evolved prompt so format drift can't break the JSON output contract
  (see `src/orchestrator/multiAgent.js`)
- Default-off behind `EVOLVED_PROMPTS_ENABLED=true` env flag while
  smoke tests confirm parse stability cycle-over-cycle (≥ 95% target;
  current measurements at 100% on representative sampling — see
  `npm run smoke:reasoning`)
- AI prompt v3.0.0 currently pinned to IPFS; pre-evolution baseline
  is v2.1.1. Evolution logic is implemented end-to-end (mutation
  after N BAD_CALL events, validator prompt is immutable as the
  safety floor) but **default-off** in production until a longer
  smoke-window confirms cycle-over-cycle parse stability above 95%.

---

## Ecosystem Integration

### Hackathon Sponsors & Partners

| Partner | Integration | Status |
|---------|-------------|--------|
| **Mantle Network** | Mainnet deployment, mETH/mUSD native assets, gas-efficient L2 | ✅ Live |
| **Nansen** | MCP (Model Context Protocol) for smart money flow signals | ✅ Live |
| **Tencent Cloud** | AI model hosting infrastructure, high-availability inference | ✅ Live |
| **Merchant Moe** | DEX routing for on-chain swaps | ✅ Live |
| **Ondo Finance** | USDY idle parking (5.25% APY baseline) | ✅ Live |
| **Elfa** | Social sentiment analysis for market signals | 🔄 Integrated |
| **OpenCheck** | On-chain verification & contract audit tooling | 🔄 Integrated |
| **Bybit Wallet** | Frontend wallet connection & UX | ✅ Live |

### Why Mantle?

- **$0.004 gas per tx** — enables logging EVERY decision on-chain (impossible on L1)
- **mETH native yield** — real staking returns as trading asset
- **EVM compatible** — standard Solidity, standard tooling
- **Growing AI ecosystem** — aligned with Mantle's AI agent vision

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| AI Models | GLM-5 (745B MoE) Analyst + Claude Sonnet 4.6 Validator |
| Blockchain | Mantle L2 Mainnet (chain 5000) |
| DEX | Merchant Moe v2.2 / Odos aggregator |
| Data | CoinGecko, Nansen MCP, Hyperliquid, DeFiLlama, Elfa |
| Storage | IPFS (Pinata) for Proof-of-Reasoning blobs |
| Frontend | Next.js 15 + Tailwind + Framer Motion |
| RWA | Ondo Finance USDY (tokenized Treasuries) |
| Infra | Tencent Cloud (inference), Vercel (frontend) |

---

## Running the Agent

### Production: GitHub Actions cron (hourly)

Production runs are driven by [`.github/workflows/agent-cycle.yml`](.github/workflows/agent-cycle.yml),
which fires every hour at `:00` UTC. Each run:

1. Executes one `runMultiAgentCycle()` against live market data.
2. Writes a `data/last-cycle-summary.json` record.
3. Commits state files (outcomes, parse metrics, threshold state, …)
   back to `main`.
4. Vercel auto-deploys the front-end on the resulting push, so the
   mascot turns 🟢 within ~2 minutes.

Cadence is hourly, not sub-minute — the mascot's threshold is
calibrated for that. Operator runbook with the secrets list, manual
trigger, pause/resume, and cost monitoring is at
[`.kiro/runbooks/cron-operations.md`](.kiro/runbooks/cron-operations.md).

Public log: <https://github.com/USBVadik/TuringVault-Core/actions/workflows/agent-cycle.yml>

### Local development

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Set: PRIVATE_KEY, NANSEN_API_KEY, AWS_*, PINATA_*, GOOGLE_APPLICATION_CREDENTIALS

# Single cycle (one-shot, no loop)
node scripts/run-cycle.js

# Smoke 5 cycles in dry-run mode (no on-chain TX, hits Bedrock)
npm run smoke:reasoning

# Grid bot (production, 5-min cycles)
node src/strategies/runGridCycle.sh

# Continuous local orchestrator (only while terminal stays open)
node src/cron/agentCron.js

# Backtest
node src/strategies/backtest.js
```

---

## Project Structure

```
turingvault/
├── src/
│   ├── orchestrator/       # Multi-agent loop, signal engine, consensus
│   ├── strategies/         # Ranging grid, position state, backtest
│   ├── evolution/          # Self-evolving prompts with guard rails
│   ├── execution/          # On-chain execution engine
│   ├── dex/                # Merchant Moe + Odos integration
│   ├── rwa/                # USDY module (Ondo Finance)
│   ├── onchain/            # Contract interactions, IPFS
│   ├── mcp/                # Nansen MCP client
│   └── cron/               # Automated trading loop
├── contracts/              # Solidity (5 contracts, verified on Sourcify)
├── frontend/               # Next.js dashboard + proof explorer
├── sdk/                    # TuringVault SDK for external integration
├── test/                   # Contract + integration tests
└── docs/                   # Architecture, submission, vision docs
```

---

## Roadmap

- [x] Multi-agent consensus (GLM-5 + Claude Sonnet 4.6 + Gemini 3.5 arbiter)
- [x] On-chain decision logging (104+ decisions, growing)
- [x] Adversarial validation (61% rejection rate)
- [x] Self-evolving AI prompts (v3.0.0 pinned to IPFS, default-off behind env flag while smoke tests confirm parse stability)
- [x] Grid bot with regime detection (RANGING/TREND_UP/TREND_DOWN/CRISIS)
- [x] Live dashboard + proof explorer
- [x] ERC-8004 AI agent identity on-chain
- [x] IPFS reasoning storage with on-chain anchoring
- [x] [Discipline Layer](docs/discipline-layer.md) — post-execution proof verification (live; surfaced on dashboard)
- [x] RWA allocation active (USDT0 Treasury-collateralised, first swap on Mantlescan)
- [x] Adversarial Challenge page (preview-rules mode live; LIVE multi-agent mode in v3 spec)
- [ ] Cross-agent reputation marketplace
- [ ] Multi-vault strategy templates
- [ ] Governance: token-holder veto on prompt mutations
- [ ] Agent-to-agent trust scoring (ERC-8004 identity graph)

---

## License

MIT

---

*Built for the Mantle Turing Test Hackathon 2026 🏆*
