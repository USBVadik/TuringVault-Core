# TuringVault — Analyst Deep Research Brief
**Version:** 1.0 | **Date:** May 2026 | **Classification:** Internal / Strategy

---

## CONTEXT

TuringVault is an autonomous AI trading agent deployed on **Mantle Network (Mainnet, ChainID 5000)**.
It manages a small live portfolio (~5 MNT) and has executed real on-chain swaps.
The agent uses multi-model adversarial consensus (two LLMs must agree before any trade executes),
with every reasoning step hashed to IPFS and anchored on-chain via 5 smart contracts.

**Current core problem:** The agent defaults to HOLD in ~90% of cycles.
This is technically correct given current market signals, but it defeats the purpose of an
autonomous yield-optimization system. We need strategies that generate alpha even in
sideways/low-conviction markets — not just binary "swap mETH ↔ mUSD" decisions.

---

## SECTION 1 — CURRENT CAPABILITIES

### 1.1 AI Architecture

| Component | Implementation | Status |
|-----------|---------------|--------|
| ANALYST Agent | Claude Sonnet 4.6 (AWS Bedrock) | Live |
| VALIDATOR Agent | Claude Sonnet 4.6 (AWS Bedrock, separate system prompt) | Live |
| Consensus mechanism | Both must agree (approved=true) before execution | Live |
| Prompt Evolution | IPFS-stored prompts, self-rewrite on poor performance | Live (4 iterations) |
| On-chain identity | ERC-8004 soulbound NFT with tokenURI → IPFS agent card | Live |

**Original design intent:** GLM-5 (745B MoE, Zhipu AI) as ANALYST, Claude as VALIDATOR.
Currently both are Claude due to GLM-5 integration complexity. GLM-5 was chosen for its
claimed superiority in quantitative reasoning. This is a pending upgrade.

### 1.2 Decision Pipeline (full cycle)

```
MarketData → SignalEngine → ANALYST (Claude) → proposal JSON
                                    ↓
                          VALIDATOR (Claude) → approved/rejected
                                    ↓
                          VaR Gate → autonomous/supervised/blocked
                                    ↓
                          Merchant Moe DEX → swap execution
                                    ↓
                          IPFS → reasoning hash
                                    ↓
                          Mantle chain → DecisionLog + ReputationRegistry
                                    ↓
                          OutcomeTracker (4h settle) → PnL → prompt evolution
```

### 1.3 Execution Infrastructure

**DEX:** Merchant Moe Liquidity Book v2.2 (Mantle Mainnet)
- Router: `0x013e138EF6008ae5FDFDE29700e3f2Bc61d21E3a`
- Supported pairs: mETH/WMNT, WMNT/USDT, USDY/USDT, mUSD/USDT, WMNT/mUSD
- Max swap size: $100 USD (hackathon safety limit)
- Max daily swaps: 10

**Current tradeable assets:**
- `mETH` — Mantle staked ETH (liquid staking token), yield-bearing
- `mUSD` — Mantle stablecoin
- `USDY` — Ondo Finance tokenized US Treasuries (~5.25% APY, rebasing)
- `WMNT` — Wrapped Mantle native token
- `USDT` (USDT0) — stablecoin

**KMS signing:** Tencent Cloud KMS (secp256k1 hardware key) for transaction signing.
The AI never touches the private key — it generates "intents", KMS signs them.

### 1.4 Smart Contracts (Mantle Mainnet)

| Contract | Address | Function |
|----------|---------|----------|
| TuringVaultIdentity (ERC-8004) | `0x6f862802e0d5463DF18d267e422347BeCacc28bD` | Agent NFT, IPFS prompt storage |
| TuringVaultDecisionLog | `0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5` | Immutable decision history |
| ValidationRegistry | `0x0aeEd88959fCFC665284225dB93DED3e8A3Ff705` | Multi-agent consensus proofs |
| ReputationRegistry | `0xC78119F3274B05046Ac7c38a14298a6cbD946e1a` | On-chain PnL & reputation score |
| TuringVaultRouter | `0x8187...7001` | Execution routing |

### 1.5 VaR Gate (Risk Control)

```
VaR < 50 bps   → AI executes autonomously
50 < VaR < 150 → AI proposes, human reviews (intent queue)
VaR > 300 bps  → BLOCKED — no execution regardless of AI decision
```

VaR is computed from: action type (swap +30 bps), position size, market volatility, confidence delta.
Confidence threshold for execution: 0.60 minimum.

---

## SECTION 2 — CURRENT SIGNAL SOURCES

### 2.1 Live Data Feeds

| Source | Data | Endpoint | Status | Notes |
|--------|------|---------|--------|-------|
| CoinGecko | ETH price, 24h change, volume | Free API | Live | Rate limited |
| DeFiLlama | mETH yield, Mantle TVL, protocol TVL | Free API | Live | mETH yield currently 0.34% |
| Fear & Greed Index | Crypto sentiment 0-100 | alternative.me | Live | Currently ~28 (Fear) |
| Nansen API | Smart money netflow 24h (Ethereum) | REST API, 100 credits | Live | $63K total flow (tiny) |
| Byreal | Perp signals: funding rate, RSI, OI by coin | CLI binary | Partial | ETH not always in top signals |
| Hyperliquid | ETH perpetual funding rate (8h) | Public REST | Live (new) | ETH +1.37% annualized |

### 2.2 Signal Engine Output

Each signal cycle produces a structured object:

```
regime:       TRENDING_UP | TREND_DOWN | RANGING | CRISIS | CONTRARIAN_LONG
consensus:    BULLISH | BEARISH | NEUTRAL
fundingRate:  annualized % (ETH perps)
onChainFlow:  net USD flow 24h from smart money wallets
yieldSpread:  mETH APY − USDY APY (currently −4.16%)
liquidationMap: estimated liq clusters above/below price
```

### 2.3 Current Signal State (as of May 22, 2026)

```
ETH price:      $2,129
mETH yield:     0.34% APY  ← DeFiLlama live data
USDY yield:     4.5% APY   ← hardcoded estimate
Yield spread:   −4.16%     → BEARISH (hold stables)
ETH funding:    +1.37% ann → NEUTRAL
Smart money:    +$63K 24h  → NEUTRAL (tiny)
Fear & Greed:   28/100     → Fear (slightly bearish)
Mantle TVL:     ~$217M
Regime:         RANGING
```

**Why agent HOLDs:** yield spread is deeply negative (mETH pays 4x less than risk-free USDY),
funding is neutral, smart money flow is negligible. Economically, HOLD in stables is correct.
The problem is this is not a strategy — it's paralysis.

---

## SECTION 3 — AVAILABLE BUT UNDERUTILIZED RESOURCES

### 3.1 Nansen MCP Server (36 tools, 100 credits)

We have access to Nansen's full MCP endpoint (`https://mcp.nansen.ai/ra/mcp`).
Currently only using `general_search` (free). Available tools include:

| Tool | Cost | What it gives |
|------|------|---------------|
| `smart_traders_and_funds_token_balances` | 5cr | What smart money wallets hold right now |
| `smart_traders_and_funds_perp_trades` | 5cr | What smart money is doing on Hyperliquid perps |
| `token_current_top_holders` | 5cr | Top holders of any ERC-20 |
| `token_dex_trades` | 5cr | Recent DEX activity for any token |
| `token_god_mode` | 5cr | Full token analysis |
| `wallet_pnl_summary` | 5cr | PnL of any wallet |
| `address_portfolio` | 5cr | Full DeFi positions of any wallet |
| `growth_chain_rank` | 5cr | Chain-level growth metrics |
| `general_search` | free | Entity/token search |

**Note:** 100 credits = 20 paid tool calls. Use sparingly, cache aggressively (15 min TTL).

### 3.2 Byreal Perps CLI

We have the Byreal binary installed that provides:
- Signal scan across all liquid perps (BTC, ETH, SOL, etc.)
- Per-coin: funding rate, RSI, OI, 24h change, score
- Categories: conservative / moderate / aggressive

**Problem:** ETH is not always in Byreal's top signals (it filters by score threshold).
We now have Hyperliquid as fallback. Byreal provides BTC, SOL, and altcoin signals
that we're currently ignoring entirely.

### 3.3 Merchant Moe Liquidity Pools

Beyond simple mETH↔mUSD swaps, Merchant Moe has:
- WMNT/USDT pool
- mETH/WMNT pool
- Liquidity provision (LP) positions — not currently used
- Concentrated liquidity bins — we could be an LP not just a swapper

### 3.4 USDY (Ondo Finance RWA)

USDY is a rebasing token representing tokenized US Treasuries on Mantle.
Currently sits at ~4.5–5.25% APY passively. We have the module built but
the agent doesn't actively route capital into USDY when mETH yield is poor.
The RWA allocation is hardcoded to 10–50% range without dynamic optimization.

### 3.5 On-Chain Prompt Evolution

When ReputationRegistry score drops below −50, the agent triggers a self-reflection cycle:
1. Reads its own decision history from Mantle chain
2. Uses Claude to rewrite its own system prompt
3. Validates with second Claude call
4. Uploads new prompt to IPFS
5. Updates tokenURI on-chain

This loop currently runs but has only 4 iterations and limited real PnL data to work with.

### 3.6 OutcomeTracker (4-hour settlement)

After each trade, the system records:
- Price at decision time
- 4 hours later: fetches current price
- Classifies outcome: CORRECT_BLOCK / MISSED_ALPHA / GOOD_CALL / BAD_CALL
- Records PnL on-chain via `ReputationRegistry.recordPnL()`

Score deltas:
- CORRECT_BLOCK (held, price fell): +40
- GOOD_CALL (traded, price moved right): +60
- MISSED_ALPHA (held, price rose): −20
- BAD_CALL (traded, price moved wrong): −80

---

## SECTION 4 — THEORETICAL UPGRADES (NOT YET IMPLEMENTED)

### 4.1 Additional Data Sources

| Source | Data | Integration effort | Value |
|--------|------|--------------------|-------|
| Mantle on-chain DEX volume | Real swap volume on Merchant Moe | Medium | High — detect accumulation |
| mETH/USDY LP fee APY | Actual fee income from LP provision | Low (DeFiLlama) | High |
| Coinglass | Open interest, liquidations, long/short ratio | Free REST | High |
| Hyperliquid order book | Depth, bid-ask spread, whale orders | Free REST | High |
| Mantle bridge inflows | ETH bridged to Mantle in 24h | Medium (RPC) | Medium |
| Twitter/X sentiment | Crypto Twitter sentiment on ETH, MNT | Medium (API) | Medium |
| On-chain whale tracker | Large wallet movements on Mantle | Medium | High |
| Polymarket | Prediction market probabilities on macro | Low (REST) | Medium |
| DeFiLlama borrow rates | Compound/Aave borrow rates vs yield | Low (REST) | High |

### 4.2 Alternative Strategies

Currently the agent only does: **hold mETH** (risk-on) vs **hold mUSD/USDY** (risk-off).
This is a binary bet on ETH direction. Alternatives:

1. **Yield farming rotation** — automatically move between best-yielding pools on Mantle
2. **LP provision** — provide liquidity on Merchant Moe LB, earn fees + incentives
3. **Funding rate arbitrage** — hold mETH spot while shorting ETH perps on Hyperliquid when funding is positive (delta-neutral yield)
4. **Cross-chain arbitrage** — price differences between Mantle and Ethereum for mETH
5. **RWA yield ladder** — USDY (4.5%) vs mETH staking vs LP fees, dynamically rotate
6. **Volatility trading** — in RANGING regime, provide liquidity instead of swapping
7. **MEV-aware execution** — batch swaps, use limit orders instead of market swaps

### 4.3 AI Architecture Improvements

| Upgrade | Description | Effort |
|---------|-------------|--------|
| GLM-5 as ANALYST | Original design — GLM-5 is better at quant reasoning per benchmarks | Medium |
| 3-agent model | Add MACRO agent (reads rates, DXY, BTC dominance) as pre-filter | Medium |
| Confidence calibration | Track predicted vs actual confidence, penalize overconfidence | Low |
| Multi-timeframe | 1h, 4h, 24h signal windows with different weights | Medium |
| Ensemble voting | 3 independent decisions, majority wins | Low |
| RAG on history | Agent reads its own past decisions as context before deciding | Medium |

### 4.4 Risk Model Improvements

Current VaR model is rudimentary (flat +30 bps for any swap).
Real risk factors we're missing:
- Slippage cost model (based on pool depth and trade size)
- Correlation risk (mETH/ETH ≈ 1.0, no diversification in risk-on mode)
- Drawdown circuit breaker (stop trading after X% portfolio loss)
- Gas cost efficiency (small trades on Mantle cost ~$0.001, negligible but trackable)

---

## SECTION 5 — KEY STRUCTURAL PROBLEMS

### Problem 1: Binary Strategy in Non-Binary Market
The agent only chooses between two states: "buy mETH" or "hold stables."
In sideways markets (which is most of the time), neither is optimal.
LP provision, RWA laddering, and funding arb all generate yield regardless of direction.

### Problem 2: Yield Spread Makes mETH Unattractive By Design
mETH yield (0.34%) vs USDY (4.5%) = agent will almost always prefer stables.
Unless ETH pumps >4.16% to compensate for yield deficit, the rational move is USDY.
This means the agent needs to trade ETH *price action*, not just yield.

### Problem 3: Signal Sparsity in Calm Markets
Fear & Greed at 28, funding neutral, tiny Nansen flow — no strong signals.
Agent correctly identifies RANGING but has no strategy for RANGING regime
(current logic: "wait for cleaner regime"). This should be: switch to LP/yield mode.

### Problem 4: No Position Memory
Agent doesn't know what it currently holds. Every cycle it decides from scratch.
If mETH is in portfolio and ETH is sideways, agent might redundantly "swap to mETH"
when it's already there. Portfolio state tracking is missing from decision prompt.

### Problem 5: Outcome Tracker Latency
4-hour settlement means the feedback loop is very slow (6 decisions per day max).
In fast markets this is dangerously stale. In slow markets it means evolution is glacial.

---

## SECTION 6 — QUESTIONS FOR DEEP RESEARCH

These are the specific questions we need answered to build a better strategy:

### Q1 — Strategy Design
**"Given that the agent operates on Mantle Network with access to mETH (liquid staked ETH),
USDY (tokenized T-Bills ~4.5% APY), mUSD, WMNT, and Merchant Moe LB pools —
what portfolio strategy maximizes risk-adjusted returns in each of the four regimes
(TREND_UP, TREND_DOWN, RANGING, CRISIS)? Specifically: when should the agent be
an LP vs a directional trader vs a pure yield farmer?"**

### Q2 — Signal Weighting
**"Given these available signals: ETH perpetual funding rate, Nansen smart money netflow,
Fear & Greed index, mETH/USDY yield spread, ETH 24h price change, Mantle TVL change —
what is the optimal weighting for each signal in a decision function?
Which signals are leading indicators vs lagging? Which combinations have historically
predicted 4h ETH price direction with >55% accuracy?"**

### Q3 — Funding Rate Arbitrage
**"Is delta-neutral funding rate arbitrage viable at our scale ($100–$500 portfolio)?
Specifically: hold mETH spot on Mantle + short ETH-PERP on Hyperliquid.
At current ETH funding rate (+1.37% annualized), what is the net yield after:
gas costs, Hyperliquid fees, slippage, and rebalancing friction?
At what funding rate level does this become worth activating?"**

### Q4 — Merchant Moe LP Strategy
**"For Merchant Moe Liquidity Book v2.2 on Mantle:
What are the real fee APYs on mETH/WMNT and WMNT/USDT pools?
In RANGING regime, is it better to be an LP (earn fees) or hold USDY (earn risk-free yield)?
What is the optimal bin range strategy for a small LP position given typical ETH volatility?
How does IL (impermanent loss) compare to fee income historically on these pools?"**

### Q5 — Multi-Timeframe Signal Architecture
**"Our agent currently makes decisions every N minutes with 24h lookback signals.
What is the optimal decision frequency for a momentum-following strategy on ETH/Mantle?
Should we use different signal windows for different regimes
(e.g., 1h signals in TREND, 24h signals in RANGING)?
How do we prevent overtrading (signal noise) while not missing real regime changes?"**

### Q6 — Adversarial Consensus Calibration
**"Our two-agent system (ANALYST proposes, VALIDATOR approves/rejects) currently
results in VALIDATOR approving ~85% of HOLD decisions and ~70% of SWAP proposals.
What is the optimal VALIDATOR rejection rate to maximize long-term PnL?
Should the VALIDATOR have a time-varying approval threshold based on recent performance?
How do we prevent both agents from converging to the same conservative bias?"**

### Q7 — Prompt Evolution Effectiveness
**"Our agent self-rewrites its prompt after poor performance (score < −50).
Given only 4 iterations and sparse real PnL data, is this enough signal to
meaningfully improve strategy? What is the minimum number of settled outcomes
needed before prompt evolution is reliable vs noise? What architecture (RL, RLAIF,
or LLM self-reflection) is most suitable for this type of adaptation?"**

### Q8 — USDY Allocation Optimization
**"USDY (Ondo Finance) on Mantle currently yields ~4.5% APY passively.
Our agent has a hardcoded 10–50% target allocation. What is the optimal
dynamic allocation between USDY (risk-free yield) and active trading capital,
given a Sharpe ratio optimization objective? Should we treat USDY as the
'cash' portion of the portfolio and only deploy the risk portion into active strategies?"**

### Q9 — Mantle Ecosystem Alpha
**"What Mantle-native alpha opportunities exist that a small autonomous agent could exploit?
Specifically: Mantle LSP incentives, Merchant Moe trading competitions, mETH restaking
on EigenLayer (if available on Mantle), MNT staking yields, Agora USD (agUSD) yields,
new protocol launches on Mantle. Which of these are accessible via simple ERC-20 swaps?"**

### Q10 — Benchmark and Success Metrics
**"How should we measure the performance of an autonomous yield agent?
What benchmarks are appropriate (USDY hold, BTC, ETH, 60/40)?
What Sharpe ratio, max drawdown, and annual return targets are realistic for
a fully autonomous on-chain agent with $500 AUM on a relatively low-liquidity L2?"**

---

## SECTION 7 — CURRENT PERFORMANCE DATA

**Live on-chain decisions (from DecisionLog contract):**
- Total decisions: ~10–15 recorded
- Most common action: SWAP to mETH (87% confidence, usually approved)
- Second most common: HOLD
- Real executed swaps: 2 (both USDT0 → mETH, ~2 USDT each)
- Reputation score: accumulating (exact figure on-chain)

**Known execution data:**
- TX 1: `0xe9f6fd9770a92f1f6058c96f741fd13779860d46ea182bbd3ea180c4ab2e0bc5`
  USDT0 → mETH, 2.00 USDT, received 0.000823 mETH, Block 95628368
- TX 2: `0x898489443ae470a0c31cd4a0c6d947da252433481f2c7b8fa9fb420485056347`
  Similar swap

**Current portfolio (approx):**
- ~5.09 MNT in agent wallet
- Small mETH positions from executed swaps
- No USDY position yet despite module being built

---

## SECTION 8 — TECHNICAL CONSTRAINTS

1. **Network:** Mantle Mainnet only. No Ethereum mainnet execution.
2. **Capital:** ~$5 USD equivalent (hackathon demo scale). Strategies must work at this scale.
3. **Gas:** Mantle gas is ~$0.001–0.005 per transaction. Not a constraint.
4. **DEX:** Only Merchant Moe integrated. Uniswap v3 on Mantle exists but not integrated.
5. **Latency:** Decision cycle is ~2–5 minutes. Not suitable for HFT.
6. **Perps:** Byreal/Hyperliquid integration exists but is dry-run only (no live perp execution yet).
7. **KMS:** Tencent KMS signs all transactions — adds ~200ms latency per tx.
8. **AI cost:** Claude API via AWS Bedrock, ~$0.01–0.05 per decision cycle.
9. **Nansen credits:** 100 credits remaining. Each MCP tool call = 5 credits. Budget carefully.
10. **Smart contract limits:** ValidationRegistry requires both agents to submit proposals separately on-chain.

---

## SUMMARY FOR RESEARCHER

TuringVault is a working autonomous trading agent with all infrastructure in place:
real DEX execution, multi-agent consensus, on-chain proof system, reputation tracking,
and self-evolving prompts. The core weakness is **strategy design** — the current
binary mETH/mUSD approach has no edge in sideways markets, which is most of the time.

We need research-backed answers on:
1. What strategies generate yield regardless of ETH direction (at our scale)
2. How to properly weight available signals for 4h forward returns
3. Whether funding arb + LP provision are viable at $100–500 AUM
4. How to structure the multi-agent decision architecture for better calibration
5. What Mantle-native opportunities we're missing

The output of this research will directly translate into:
- New entries in `ANALYST_SYSTEM_PROMPT` (decision framework)
- New signal sources added to `signalEngine.js`
- New execution modes beyond binary swap (LP, RWA rotation, funding arb)
- Better VaR thresholds and confidence calibration

**Time horizon:** Medium-term optimization (1–4 week deployment cycles)
**Risk tolerance:** Low-medium (capital preservation > alpha at hackathon stage)
**Primary success metric:** Outperform simple USDY hold (~4.5% APY) on risk-adjusted basis
