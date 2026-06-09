# TuringVault DoraHacks Polished Submission

Observed live snapshot: 2026-06-09 19:04 UTC. Refresh before final paste from:
- https://frontend-seven-beta-46.vercel.app/api/health
- https://frontend-seven-beta-46.vercel.app/api/performance
- https://frontend-seven-beta-46.vercel.app/api/proof-explorer

Demo video: https://youtu.be/AnLbnbW36ys

---

## Short Description

Accountable AI RWA portfolio infrastructure on Mantle. TuringVault combines multi-model consensus, ERC-8004-style identity/reputation, Proof-of-Reasoning anchors, and post-execution Discipline checks before AI-managed capital is trusted.

---

## Main Description

TuringVault is a proof-locked AI portfolio agent for Mantle-native RWA and yield allocation.

Most AI trading demos ask judges to trust the model after the fact. TuringVault is built around the opposite idea: before an AI agent can manage capital, its reasoning, vetoes, execution status, and outcomes should be visible, replayable, and reputation-bearing.

The project is not just an autonomous trading bot. It is a verification layer for AI-managed capital.

### Problem

DAO treasuries and on-chain funds face an uncomfortable tradeoff:

- human committees are slow and miss market windows;
- autonomous agents can react quickly, but are usually black boxes;
- after a bad trade, operators often cannot tell whether the loss came from normal market risk, stale data, weak reasoning, or an AI hallucination.

That is unacceptable for treasury-grade RWA allocation.

### Solution

TuringVault turns each AI portfolio decision into an auditable workflow:

1. The agent receives market, yield, technical, smart-money, and social context.
2. A primary analyst model proposes an action.
3. An independent validator challenges the thesis, risk/reward, regime fit, and portfolio state.
4. Safety gates can block the action before capital moves.
5. The reasoning chain is pinned off-chain and cryptographically anchored on Mantle.
6. Executed swaps are checked by the Discipline Layer for transaction proof, price freshness, and regime drift.
7. Settled outcomes update the agent's reputation and decision-quality history.

The important product behavior is not "the AI always trades." It is that every trade, refusal, and intent-only decision is labelled honestly.

### What Is Live

The current public system is running on Mantle Mainnet with operator-funded demo capital.

Observed on 2026-06-09 at 19:04 UTC:

- 418 DecisionLog rows
- 419 ValidationRegistry proposals
- 298 approved proposals
- 121 rejected proposals, a 28.9% pre-execution rejection rate
- 326 settled outcomes
- 54.6% settled win rate
- +5135 bps lifetime Decision-Quality / Outcome Score
- `realizedTradingPnlBps: null` by design, because this is an outcome score, not a wallet-PnL claim
- 25 successful / 0 failed cron cycles in the trailing 24h API snapshot
- 100% parse success in the trailing 24h API snapshot

The RWA lane uses USDT0 as the Treasury-collateralised stable allocation rail and mETH as Mantle's native LST risk-on yield leg. MNT / WMNT are used for Mantle-native execution inventory. USDY support is implemented but gated until Mantle liquidity is usable again, so we label it paper-ready instead of pretending it is live execution.

### Why It Fits AI x RWA Path A

TuringVault should be judged as infrastructure.

It directly addresses the three primitives the Mantle Turing Test brief highlights:

**On-chain benchmarking of AI.** Decisions, validations, blocked actions, and settled outcomes are exposed through public dashboards, contracts, and API surfaces. The agent is not evaluated by a screenshot; it has a growing decision trail.

**Agent identity and reputation.** TuringVault includes ERC-8004-style identity, validation, reputation, and decision logging contracts on Mantle. Five production contracts are Sourcify perfect-match verified.

**Radical transparency.** Judges can inspect the live dashboard, Proof Explorer, Replay, Discipline Layer, public GitHub Actions cron, and Mantle contracts without asking for private logs.

### Why This Matters

The winning primitive is not "an AI bought the right asset once."

The deeper unlock is a standard way for AI agents to become accountable economic actors:

- What did the agent see?
- What did it propose?
- Who challenged it?
- Why was it accepted or rejected?
- Did the transaction actually happen?
- Can the reasoning be replayed later?
- Did the decision improve or damage the agent's reputation?

TuringVault makes those questions answerable on Mantle.

### Verification Path For Judges

1. Demo video: https://youtu.be/AnLbnbW36ys
2. Live dashboard: https://frontend-seven-beta-46.vercel.app
3. Proof Explorer: https://frontend-seven-beta-46.vercel.app/proof-explorer
4. Replay: https://frontend-seven-beta-46.vercel.app/replay
5. Discipline Layer: https://frontend-seven-beta-46.vercel.app/discipline
6. Challenge Arena: https://frontend-seven-beta-46.vercel.app/challenge
7. Public cron: https://github.com/USBVadik/TuringVault-Core/actions/workflows/agent-cycle.yml
8. DecisionLog: https://explorer.mantle.xyz/address/0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5
9. ValidationRegistry: https://explorer.mantle.xyz/address/0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6
10. ReputationRegistry: https://explorer.mantle.xyz/address/0xC78119F3274B05046Ac7c38a14298a6cbD946e1a
11. Identity NFT: https://explorer.mantle.xyz/address/0x6f862802e0d5463DF18d267e422347BeCacc28bD

### What We Do Not Claim

- We do not claim realized wallet PnL. The performance metric is a Decision-Quality / Outcome Score from settled outcomes.
- We do not claim every cycle is a swap. Swaps are a subset of cycles.
- We do not claim public deposits. Current capital is operator-funded demo capital.
- We do not claim perpetual liveness. GitHub Actions cron is best-effort; `/api/health.lastCycleAge` is the source of truth.
- We do not claim live USDY execution. USDY is implemented but gated until usable Mantle liquidity returns.

TuringVault's core claim is stronger and narrower: AI-managed capital should be challengeable, replayable, and accountable before it scales.
