# TuringVault — Project Vision & Concept Deep Dive

## Table of Contents
1. [The Problem We're Solving](#1-the-problem-were-solving)
2. [The Core Insight](#2-the-core-insight)
3. [What is Proof-of-Reasoning?](#3-what-is-proof-of-reasoning)
4. [Technical Architecture](#4-technical-architecture)
5. [The Multi-Agent Design](#5-the-multi-agent-design)
6. [Why Mantle?](#6-why-mantle)
7. [Partner Ecosystem Integration](#7-partner-ecosystem-integration)
8. [What We've Built](#8-what-weve-built)
9. [Roadmap & What's Next](#9-roadmap--whats-next)
10. [Why This Wins](#10-why-this-wins)

---

## 1. The Problem We're Solving

The DeFi ecosystem is rapidly moving toward AI-powered investment agents. These agents monitor markets, analyze data, and execute trades autonomously. But there's a fundamental trust crisis brewing:

**When an AI agent executes a trade on-chain, you see the transaction. You don't see the reasoning.**

This creates cascading problems:

### For Users
- You deposit funds into an AI-managed vault
- The AI loses money
- You have no way to audit whether the loss was due to a market downturn (acceptable) or an AI hallucination (catastrophic, preventable)
- You can't hold the agent accountable because there's no record of its "thinking"

### For the Broader Ecosystem
- AI agents are black boxes — institutional players won't trust them with serious capital
- No reputation system exists for AI agents — a consistently good agent and a consistently bad one look identical on-chain
- Multi-agent systems (which are the future) require trust between agents — impossible without verifiable track records

### The LLM Hallucination Problem
Large Language Models hallucinate. An AI agent could convince itself of a bullish signal that doesn't exist in the data, execute a trade, lose money, and leave zero trace of the flawed reasoning. Without on-chain reasoning records, this vulnerability is systemic.

**TuringVault is the answer to all of these problems.**

---

## 2. The Core Insight

The Turing Test (which this hackathon is named after) asks: can you tell if you're talking to a human or machine?

TuringVault flips this into a DeFi question: **can you verify that an AI agent reasoned correctly before trusting it with your money?**

Our answer: **Yes — if you put the reasoning on-chain.**

The key insight is that blockchain's immutability makes it the perfect medium for AI accountability. A transaction on Mantle is permanent. So if we store not just the action but the complete reasoning chain — market data observed, conclusions drawn, risks identified, confidence level — we've created an auditable, unforgeable proof that the AI did its job correctly.

We call this **Proof-of-Reasoning (PoR)**.

---

## 3. What is Proof-of-Reasoning?

Proof-of-Reasoning is a new primitive for AI agent accountability in Web3. It works like this:

### Traditional DeFi Bot
```
Market Data → Bot → TX (swap 1 ETH for USDC)
```
You see: one transaction. No reasoning. No accountability.

### TuringVault with Proof-of-Reasoning
```
Market Data → Analyst Agent → Proposal (with full reasoning)
                                     ↓
                            Validator Agent → Consensus Score
                                     ↓
                            ValidationRegistry.submitProposal()  ← PERMANENT ON-CHAIN
                            ValidationRegistry.validateProposal() ← PERMANENT ON-CHAIN
                            DecisionLog.logDecision()             ← PERMANENT ON-CHAIN
                                     ↓
                              Execute (or block)
```

What's stored on-chain:
- The proposed action (`swap mUSD`, `swap mETH`, `hold`)
- The target asset and allocation percentage
- The Analyst's confidence score (basis points)
- A hash of the Analyst's complete reasoning text
- The Validator's independent confidence score
- The Validator's risk score (0-100)
- Whether consensus was reached
- The final execution tx hash (when executed)

This creates an immutable timeline of every decision the AI made, why it made it, and whether a second AI agreed with the logic.

---

## 4. Technical Architecture

### Smart Contract Layer

#### TuringVaultIdentity.sol
An ERC-721 NFT contract inspired by the emerging ERC-8004 standard for AI agent identity. Each AI agent in TuringVault is represented as an NFT on Mantle Mainnet, giving it:
- A permanent on-chain identity
- A metadata URI (IPFS) describing its capabilities, model, and version
- A verifiable reputation that accumulates over time

Current deployed agent identity: Token #0, representing our Claude Sonnet 4.6 multi-agent system.

#### TuringVaultDecisionLog.sol
An append-only ledger of every AI decision. Once logged, decisions cannot be modified or deleted. Each entry records:
- Action type (swap/hold)
- Target asset
- Amount in/out
- Confidence (basis points, 0-10000)
- Reasoning text hash
- Execution tx hash
- Block timestamp

This contract is the core of Proof-of-Reasoning — the permanent, public, auditable record.

#### TuringVaultRouter.sol
Handles asset routing between mETH (yield-bearing liquid staked ETH on Mantle) and mUSD (Mantle stablecoin). Designed to interface with Merchant Moe's Liquidity Book pools. The owner (AI agent orchestrator wallet) can trigger rebalancing based on the consensus decisions.

#### TuringVaultValidationRegistry.sol
The most innovative contract in the system. This is where multi-agent consensus happens on-chain:

```solidity
struct Proposal {
    string action;
    string targetAsset;
    uint256 amountIn;
    uint256 confidence;         // Analyst confidence in bps
    string reasoning;           // Analyst's reasoning
    uint256 validatorConfidence; // Validator confidence in bps
    uint256 riskScore;          // Validator risk assessment (0-10000 bps)
    string validatorReasoning;
    Status status;              // Pending → Approved/Rejected
    bytes32 executionTxHash;
    uint256 timestamp;
}
```

Consensus requirements (configurable):
- Analyst confidence ≥ 8500 bps (85%) — or 7500 bps with current settings
- Validator confidence ≥ 7000 bps (70%)
- Risk score ≤ 6500 bps (65/100)
- Validator explicitly approves

### AI Engine Layer

#### Claude Sonnet 4.6 via AWS Bedrock
Both agents use Claude Sonnet 4.6 accessed through AWS Bedrock's Converse API. This provides:
- Reliable JSON output (critical for Zod validation)
- Cross-region inference (us.anthropic.claude-sonnet-4-6)
- Production-grade API with SLA

#### Zod Validation Pipeline
All AI outputs are validated against strict Zod schemas before being accepted:

```javascript
// Analyst must output exactly this structure
const AnalystSchema = z.object({
  action: z.enum(["swap", "hold"]),
  direction: z.enum(["risk_on", "risk_off", "neutral"]),
  targetAsset: z.enum(["mETH", "mUSD"]),
  allocationPct: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(50),
  riskFactors: z.array(z.string()),
  expectedYield: z.number()
});
```

If the AI outputs malformed JSON or fails schema validation, the system automatically falls back to "hold" — never executing a trade based on corrupted reasoning.

---

## 5. The Multi-Agent Design

This is the architectural innovation that separates TuringVault from all other hackathon DeFi projects.

### Why Two Agents?

A single AI agent, no matter how capable, is vulnerable to:
- **Overconfidence** — claiming 95% certainty when the data is ambiguous
- **Confirmation bias** — finding evidence that supports its prior conclusion
- **Hallucination** — generating plausible-sounding but false market data interpretations
- **Anchoring** — being influenced by the format of the question more than the content

The solution from traditional finance: **independent review**. Every major trading desk has a Risk Manager who is specifically tasked with finding flaws in the Trader's reasoning.

TuringVault implements this with two AI agents that have **fundamentally different system prompts and objectives:**

### Analyst Agent System Prompt (simplified)
```
You are the ANALYST AGENT. Your job is to find the best trade opportunity.
Analyze market data. Be decisive. Propose a specific action with confidence.
```

### Validator Agent System Prompt (simplified)
```
You are the VALIDATOR AGENT. Your job is to find flaws in the Analyst's proposal.
Be skeptical. List every risk you can identify. Score risk 0-100.
Approve only if the reasoning is numerically sound and risks are acceptable.
```

### Real Example from Live System (May 20, 2026)

**Market Context:**
- ETH: $2,133
- Fear&Greed: 27 (Fear)
- mETH Yield: 0.34% APY
- Nansen Smart Money: bullish ($134k inflow)

**Analyst proposes:**
```json
{
  "action": "swap",
  "targetAsset": "mUSD",
  "confidence": 0.87,
  "reasoning": "mETH yield (0.34%) is 416bps BELOW risk-free rate (4.5%), 
  making mETH a negative carry position. Fear&Greed at 27 confirms bearish 
  regime. Despite Nansen smart money showing bullish flows, the yield 
  fundamentals override sentiment — hold stability in mUSD until yield 
  spread normalizes."
}
```

**Validator responds:**
```json
{
  "approved": true,
  "validatorConfidence": 0.81,
  "riskScore": 28,
  "reasoning": "Analyst's yield spread calculation is numerically verified: 
  0.34% - 4.5% = -4.16% (negative carry confirmed). Fear&Greed 27 aligns. 
  Correctly identified Nansen signal as contradicting but overridden by 
  fundamentals — this is sound risk management.",
  "flaggedIssues": [
    "NANSEN DIVERGENCE: Smart money buying while fundamentals are bearish — 
    possible early accumulation signal for next 7d",
    "mUSD DEPEG RISK: Not assessed — minor tail risk in extreme scenarios"
  ]
}
```

**Consensus: REACHED** — both agents agree on risk-off posture.

This exchange is permanently recorded on Mantle Mainnet. Anyone can audit it.

---

## 6. Why Mantle?

Mantle is not just a deployment target — it's central to the thesis.

### Native Assets Make the Strategy Real
- **mETH** (0xcDA86A272531e8640cD7F1a92c01839911B90bb0): Mantle's liquid staking token. Holding mETH means you're earning yield on staked ETH. Our AI compares this yield against risk-free rates to make rebalancing decisions.
- **mUSD**: Mantle's native stablecoin. The AI rotates into mUSD during bear markets — capital preservation in Mantle's native stable.

The mETH/mUSD pair is not arbitrary — it's the most natural "risk-on / risk-off" pair on Mantle, backed by real yield mechanics.

### Low Gas = Frequent On-Chain Reasoning
Recording every AI decision on Ethereum would be prohibitively expensive. Mantle's low gas costs make it economically viable to store the reasoning of every single decision — even at 5-minute intervals. Our orchestrator has been running continuously with total gas cost under 1 MNT.

### Merchant Moe Integration
Merchant Moe's Liquidity Book is Mantle's primary DEX. Its bin-based architecture is ideal for precise routing between mETH and mUSD. Our Router contract is designed to interface with Merchant Moe for actual swap execution (currently in development).

### ERC-8004 Alignment
The ERC-8004 standard being explored in the Mantle ecosystem is designed for AI agent identity. TuringVault's Identity contract is the first practical implementation of this concept — giving AI agents on-chain presence and reputation.

---

## 7. Partner Ecosystem Integration

### Mantle Network
- **What we use:** RPC, native assets (mETH, mUSD), block explorer, Sourcify verification
- **Why it matters:** All 4 contracts live on Mantle Mainnet. The orchestrator submits transactions to Mantle every 5 minutes. Every decision record costs ~0.001 MNT in gas.

### Bybit Wallet
- **What we use:** RainbowKit wallet connector, WalletConnect v2
- **Why it matters:** Bybit is a key co-sponsor. We've specifically configured our frontend to support Bybit Wallet as a primary connection method. Users can connect with Bybit Wallet to view live agent decisions and interact with the protocol.

### Nansen
- **What we use:** Smart Money Netflow API (`/api/v1/smart-money/netflow`)
- **Why it matters:** Nansen's smart money data is one of four signals feeding our Analyst Agent. When institutional wallets are accumulating (positive 24h netflow), the Analyst weighs this against Fear&Greed and yield data. This is exactly what a sophisticated human trader would do.
- **Integration detail:** Cached every 15 minutes to preserve API credits. When Nansen sentiment disagrees with Fear&Greed, the system signals "neutral" — forcing more conservative decisions.

### AWS Bedrock / Anthropic Claude
- **What we use:** Bedrock Converse API, Claude Sonnet 4.6 (`us.anthropic.claude-sonnet-4-6`)
- **Why it matters:** Both AI agents run on Claude via Bedrock. The cross-region inference profile provides low latency and high reliability.

---

## 8. What We've Built

### Completed (as of May 20, 2026)

**Smart Contracts (46/46 tests passing):**
- 4 production contracts deployed and Sourcify-verified on Mantle Mainnet
- 4 contracts deployed and verified on Mantle Sepolia
- ERC-721 agent identity with IPFS metadata
- Immutable decision log
- Multi-agent consensus registry with configurable thresholds
- Mock contracts for testing (MockERC20, MockLBRouter)

**AI Orchestrator:**
- Dual-agent pipeline (Analyst + Validator) — both running Claude Sonnet 4.6 via AWS Bedrock
- Zod schema validation for both agents (AnalystSchema + ValidatorSchema)
- Defensive fallback to "hold" on any validation failure
- Real market data from CoinGecko, DeFiLlama, Fear&Greed, Nansen
- Continuous orchestrator running every 5 minutes
- Full on-chain recording of every cycle (3 transactions per cycle)

**Live Metrics (Mantle Mainnet, May 20 2026):**
- 20+ decision cycles recorded on-chain
- 5+ approved consensus decisions
- Agent NFT minted (Token #0)
- All cycles running automatically since deployment

**Frontend:**
- Next.js 15 + TypeScript + Tailwind CSS
- RainbowKit with Bybit Wallet support
- Mantle Mainnet configured as default chain
- Live at https://frontend-seven-beta-46.vercel.app
- Market data API route (Next.js API routes)

**Developer Experience:**
- Full test suite (46 unit tests)
- Gas reporting in test output
- Environment-based configuration
- Comprehensive documentation

---

## 9. Roadmap & What's Next

We have 26 days until the June 15 deadline. Here's our plan:

### Week 1 (May 20-27): UI Glass Mode
The most impactful remaining feature is making the AI "thinking" visible to non-technical judges and users.

- **Agent Activity Feed:** Live stream of decisions from on-chain events
- **Reasoning Visualization:** Show the Analyst's reasoning in plain English (not raw JSON)
- **Validator Report Card:** Display flagged issues with severity levels
- **Consensus Meter:** Visual indicator of confidence levels and risk scores
- **Historical Chart:** Decision history with market context overlaid

### Week 2 (May 27 - June 3): Real Execution
Connect the AI decisions to actual swaps:

- **Merchant Moe Real Integration:** Replace mock router with live LB Router
- **USDY Oracle:** Real risk-free rate from USDY yield data
- **Slippage Calculator:** Pre-flight check on Merchant Moe pool depth
- **Execution Pipeline:** When consensus reached → submit swap → record tx hash back to DecisionLog

### Week 3 (June 3-10): Data & Intelligence
Deepen the data sources and AI quality:

- **Nansen Portfolio Endpoint:** Track what specific smart money wallets hold
- **DeFiLlama Protocol Revenue:** Add Mantle protocol health metrics
- **Multi-model Voting:** Add a second model (e.g., Gemini) for tie-breaking
- **Agent Reputation Score:** Calculate accuracy rate over historical decisions
- **Elfa AI Social Sentiment:** Add crypto Twitter sentiment as additional signal

### Week 4 (June 10-15): Polish & Submit
- **Mobile Responsive Design**
- **Video Demo** (2+ minutes showing full cycle live)
- **DoraHacks Submission** with all required materials
- **Stress Test:** Run orchestrator continuously, ensure stability
- **Final README** polish

---

## 10. Why This Wins

### Against the Judging Criteria

**Technical Depth (30%)**
We have more technical layers than any typical hackathon submission:
1. 4 smart contracts (not 1 or 2)
2. 46 unit tests
3. Dual-AI agent architecture
4. Zod validation pipeline
5. Multi-source market data aggregation
6. On-chain consensus with configurable thresholds
7. AWS Bedrock production AI infrastructure

**Innovation (25%)**
Proof-of-Reasoning is genuinely new. No project in the current DeFi landscape records AI agent reasoning on-chain as a first-class primitive. This is infrastructure for the next generation of AI-DeFi — not another yield optimizer.

**Ecosystem Contribution (25%)**
- Mantle Mainnet (not just testnet)
- mETH/mUSD (native Mantle assets)
- Bybit Wallet support
- Nansen smart money data
- ERC-8004 identity standard implementation

**Product Completeness (20%)**
- Live public frontend
- Working orchestrator with real decisions accumulating
- Wallet connect functional
- All contracts verified and readable on-chain

### The Narrative That Resonates

*"We're not building a better trading bot. We're building the accountability layer that makes AI agents trustworthy. When an AI agent on Mantle makes a decision, TuringVault ensures that decision is recorded, verified by a second agent, and permanently auditable. This is how DeFi gets comfortable with AI autonomy."*

This narrative directly answers the hackathon's theme (Turing Test) — we're not asking "can AI pass as human?" We're asking "can AI prove it reasoned correctly?" The answer is yes, if you put the proof on-chain.

---

*Last updated: May 20, 2026*  
*TuringVault — Mantle Turing Test Hackathon 2026*
