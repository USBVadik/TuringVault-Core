# TuringVault 🏦🧠

**Autonomous AI RWA Portfolio Manager · Mantle Turing Test 2026 · AI x RWA Track Path A (Infrastructure)**

> _"When an AI agent executes a trade, you see the transaction. You don't see the reasoning. TuringVault changes that."_

We ship the **three defining features** the Mantle hackathon brief calls out — on-chain benchmarking of AI, ERC-8004 agent identity reference implementation, and radical transparency — end-to-end on Mantle Mainnet, with scheduled autonomous cycles judges can drop into at any time.

---

## ⚖️ Judge's Verification Path (60-second proof check)

Every claim below points to an artefact you can open without our help.

| #   | Claim                                                              | Open this                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Live multi-agent decisions on Mantle Mainnet**                   | [DecisionLog contract](https://explorer.mantle.xyz/address/0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5) — scroll the events tab; every cycle writes a hashed reasoning anchor                         |
| 2   | **ERC-8004 three-registry implementation** (Identity + Reputation + Validation) | [Identity NFT](https://explorer.mantle.xyz/address/0x6f862802e0d5463DF18d267e422347BeCacc28bD) · [ReputationRegistry](https://explorer.mantle.xyz/address/0xC78119F3274B05046Ac7c38a14298a6cbD946e1a) · [ValidationRegistry](https://explorer.mantle.xyz/address/0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6) — all three contracts deployed, Sourcify-verified, **and actively written every cycle** (`tokenURI` auto-refresh, `submitFeedback` per cycle, `submitProposal`+`submitValidation` per decision) |
| 3   | **Adversarial validation gate working** (rejects unsafe proposals) | [ValidationRegistry](https://explorer.mantle.xyz/address/0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6) — totalRejected / totalApproved are public on-chain counters                                    |
| 4   | **Real RWA execution** — first tokenized-Treasury swap             | [TX 0x0af2336…3e09de](https://mantlescan.xyz/tx/0x0af23364c7651b053d33b0f7ed3eb8b30107b5dc489e96a7ad8ac90cad3e09de) on Merchant Moe LB v2.2                                                          |
| 5   | **Autonomous cron is observable** (not a screenshot)               | [Agent Cycle workflow runs](https://github.com/USBVadik/TuringVault-Core/actions/workflows/agent-cycle.yml) — public GitHub Actions log, every scheduled run, every step                              |
| 6   | **Reproducible AI** — replay any past decision against the original LLM provider, anchor sealed on-chain | [`/replay`](https://frontend-seven-beta-46.vercel.app/replay) — public verification page; click any cycle to see prompts + raw responses side-by-side with the cryptographic anchor verified live against Mantle Mainnet. `combinedAnchor = keccak256(utf8(ipfsCid) ‖ manifestHash)` is written to `DecisionLog.txHash` + `ReputationRegistry.reasoningHash` each cycle so the manifest cannot be edited after the fact without breaking the binding. A daily [Replay Validator CI job](https://github.com/USBVadik/TuringVault-Core/actions/workflows/replay-validator.yml) picks a random cycle and asserts the binding still holds on-chain — green badge = system is honest. Optional local round-trip: `npm run replay <cycle-id>`. See [audit 18](.kiro/audits/18-onchain-anchor-replay-manifest.md). |
| 7   | **Live social signal from Elfa V2** as 5th structured input        | [`/api/elfa-snapshot`](https://frontend-seven-beta-46.vercel.app/api/elfa-snapshot?symbol=ETH) (raw JSON) · [/social drill-down](https://frontend-seven-beta-46.vercel.app/social) (multi-ticker UI) |
| 8   | **Discipline Layer** post-execution proof verification             | [/discipline page](https://frontend-seven-beta-46.vercel.app/discipline) — 3-gate history (TX proof · price freshness · regime drift)                                                                |
| 9   | **Adversarial challenge arena** (probe the agent yourself)         | [/challenge page](https://frontend-seven-beta-46.vercel.app/challenge) — inject 4 attack vectors, watch the same multi-agent pipeline reason through them                                            |
| 10  | **Live realized PnL graph from settled outcomes** (no simulation, no backtest) | [/backtest page](https://frontend-seven-beta-46.vercel.app/backtest) — equity curve built cycle-by-cycle from on-chain settled PnL; cumulative bps + trade-level table |

> Honesty rule: every numeric stat in the dashboard traces to a contract read or a settled outcome. The workspace enforces this as a steering rule in [`.kiro/steering/no-lying-about-state.md`](.kiro/steering/no-lying-about-state.md).

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

**Stats (snapshot 2026-05-29 — refreshable on dashboard `/api/health`; ValidationRegistry counts on Mantlescan are the on-chain ground truth):**

- **147+ scheduled-cron autonomous decisions** logged to Mantle Mainnet with full reasoning (live count: [`ValidationRegistry.totalProposals()`](https://explorer.mantle.xyz/address/0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6))
- **44% rejection rate on-chain** (65 rejected / 147 total) — adversarial Validator + confidence gates blocking unsafe proposals; the gate split is intentionally sensitive in ranging markets
- **82 approved, 65 rejected** at the contract level — proposals reaching consensus go on-chain; off-chain block reasons (regime, low confidence) shown in tier breakdown on `/proof-explorer`
- **Real DEX execution path verified end-to-end** on Merchant Moe LB v2.2 — first RWA swap [`0x0af2336…`](https://mantlescan.xyz/tx/0x0af23364c7651b053d33b0f7ed3eb8b30107b5dc489e96a7ad8ac90cad3e09de); first autonomous-cron swap [`0x313c0fc…`](https://mantlescan.xyz/tx/0x313c0fc20541a7662ecfe2f9f5966c7f5e57a06495b6aae9ee30ade140b57c96) (cycle 123, 2026-05-28); first heartbeat-mode liveness swap (`HEARTBEAT_SWAP` tier) cycle 146, 2026-05-29 — see [`heartbeatMode.js`](src/orchestrator/heartbeatMode.js) and [audit 17](.kiro/audits/17-heartbeat-mode.md)
- Scheduled cron via GitHub Actions (public log linked below); adaptive regime detection on each tick. Schedule is best-effort hourly — GH Actions skips slots under platform load; the `/api/health` `lastCycleAge` field always reflects ground truth.
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
┌────────────────────────────────────────────────────────────────────┐
│                       TURINGVAULT SYSTEM                           │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│    DATA LAYER                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │CoinGecko │ │Nansen MCP│ │Byreal¹   │ │DeFiLlama │ │Elfa REST │  │
│  │Price/Vol │ │SmartMoney│ │Funding/OI│ │Mantle TVL│ │Mindshare │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │
│       └───────────┴────────────┼────────────┴────────────┘         │
│                                ▼                                   │
│    SIGNAL ENGINE (Regime Detection)                                │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ RANGING    │ TREND_UP   │ TREND_DOWN  │  HOLD   │ CRISIS   │    │
│  └────────────────────────────┬───────────────────────────────┘    │
│                               ▼                                    │
│  TRIPLE-AGENT CONSENSUS                                            │
│  ┌────────────────┐    ┌────────────────┐    ┌─────────────────┐   │
│  │   ANALYST 🧠   │ →  │  VALIDATOR 🛡   │ →  │   ARBITER ⚖️    │   │
│  │   GLM-5        │    │  Claude 4.6    │    │  Gemini 3.5     │   │
│  │   Seeks alpha  │    │  Default REJECT│    │  Tiebreaker     │   │
│  │                │    │  R:R ≥ 1.5:1   │    │  on disagreement│   │
│  └───────┬────────┘    └───────┬────────┘    └───────┬─────────┘   │
│          └────────────────┬────┴─────────────────────┘             │
│                           ▼   2-of-3 consensus required            │
│  ON-CHAIN VERIFICATION (Mantle Mainnet, 4 TXs per cycle)           │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ submitProposal → validateProposal → logDecision            │    │
│  │ → submitFeedback (reputation)                              │    │
│  │ + IPFS pin of full reasoning chain (hash anchored)         │    │
│  └────────────────────────────┬───────────────────────────────┘    │
│                               ▼  if consensus reached              │
│  EXECUTION + DISCIPLINE LAYER (Synrail-inspired)                   │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ RWA Allocator (Path A LLM-driven · Path B idle-parking)    │    │
│  │ → Merchant Moe LB v2.2 swap                                │    │
│  │ → Discipline Layer 3-gate verification:                    │    │
│  │     ✓ tx_proof  ✓ price_freshness  ✓ regime_drift          │    │
│  │ → Outcome scheduled for settlement vs price 4h later       │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
              ↑
  Scheduled GitHub Actions cron — public verifiable workflow log
```

> ¹ Byreal aggregates perps data from Hyperliquid and other venues. No direct Hyperliquid integration exists.

---

## Consensus Design: Dual-Gate Protection

Execution requires passing **two independent gates**:

1. **Confidence threshold** — the Analyst must report ≥ 60% confidence in its own proposal (elevated to 85% after 3 consecutive losses, see `BASE_CONFIDENCE_THRESHOLD` / `ELEVATED_CONFIDENCE_THRESHOLD` in `src/config/constants.js`). Low-confidence proposals are blocked before the Validator even evaluates them.
2. **Adversarial Validator** — an independent model with a default-REJECT posture, requiring explicit evidence of R:R ≥ 1.5:1 and regime alignment to approve. If it rejects, the Arbiter (Gemini 3.5 Flash) casts the tiebreaker vote (2-of-3 required).

In practice, the majority of rejections (~75%) are caused by Gate 1: the Analyst proposes HOLD with moderate confidence during sideways markets, and the confidence threshold blocks execution. Gate 2 (Validator) flags risk issues in its reasoning even when it approves structurally safe HOLD proposals. This is by design: the validator's adversarial scrutiny matters most for high-risk directional trades, where it acts as the final safety floor.

The on-chain `totalRejected` counter on ValidationRegistry reflects proposals blocked by **either** gate. Today's snapshot is **65 rejected / 147 total = 44%**, demonstrating the system's capital-preservation bias. The ratio drifts cycle-to-cycle as market conditions change; the **live ratio** is always the on-chain value (`totalRejected() / totalProposals()` on `0x6841…63b6`), not this README.

---

## Smart Contracts (Mantle Mainnet, chain 5000)

Six contracts deployed on Mantle Mainnet, **all six Sourcify-verified**
(checked 2026-05-29 via `sourcify.dev/server/check-by-addresses`,
status `perfect` for every entry). Together they form a complete
**ERC-8004 three-registry implementation** (Identity + Reputation +
Validation) plus the application-specific DecisionLog and Router.

| Role | Contract | Address |
| --- | --- | --- |
| **ERC-8004 Identity Registry** | TuringVaultIdentity | [`0x6f86…28bD`](https://explorer.mantle.xyz/address/0x6f862802e0d5463DF18d267e422347BeCacc28bD) |
| **ERC-8004 Reputation Registry** | TuringVaultReputationRegistry | [`0xC781…6e1a`](https://explorer.mantle.xyz/address/0xC78119F3274B05046Ac7c38a14298a6cbD946e1a) |
| **ERC-8004 Validation Registry** | TuringVaultValidationRegistry | [`0x6841…63b6`](https://explorer.mantle.xyz/address/0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6) |
| Pre-action Validation helper | TuringVaultValidation | [`0x0aeE…f705`](https://explorer.mantle.xyz/address/0x0aeEd88959fCFC665284225dB93DED3e8A3Ff705) |
| Immutable decision history | TuringVaultDecisionLog | [`0x7bCd…fbB5`](https://explorer.mantle.xyz/address/0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5) |
| Trade execution & routing | TuringVaultRouter | [`0x8187…7001`](https://explorer.mantle.xyz/address/0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001) |

All three ERC-8004 registries are **actively written** every cycle —
not vestigial:
- Identity stores the agent NFT with auto-refreshed `tokenURI` pointing at the latest agent-card on IPFS
- Reputation receives `submitFeedback` per cycle (proposal scoring) and `recordPnL` at settlement
- Validation receives `submitProposal` + `submitValidation` for every multi-agent decision


---

## Strategy: Adaptive Grid Trading

### Why Grid + AI?

Traditional grid bots are dumb — fixed parameters, no regime awareness. Pure AI agents hallucinate and overtrade. TuringVault combines both:

- **AI detects the regime** (ranging/trending/crisis)
- **Grid bot executes** only in favorable conditions
- **AI validates** every proposed trade before execution
- **On-chain proof** ensures accountability

### Safety Mechanisms

| Guard              | Trigger                  | Action                     |
| ------------------ | ------------------------ | -------------------------- |
| Regime Filter      | Trending market detected | HOLD (no trades)           |
| Validator Veto     | Risk > threshold         | REJECT (logged on-chain)   |
| Confidence Gate    | Score < 60%              | Skip execution             |
| Channel Too Narrow | < 0.7% width             | HOLD (slippage protection) |
| Crisis Mode        | ATR spike                | Flight to USDY safety      |
| Trailing Stops     | Active position          | Adaptive R:R ≥ 1.5:1       |

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

**Paper-ready target:** USDY (Ondo Finance tokenized US Treasuries —
~3.55% APY on Mantle, $29.5M TVL per AprScope on 2026-05-23). Mantle
pool depth is currently zero, so the swap path throws
`RWA_POOL_INACTIVE` until reactivated. Module is shipped, gated off.

Per-swap and per-day caps are operator-tunable via GitHub Actions
secrets without redeploy. See
[`.kiro/runbooks/rwa-operations.md`](.kiro/runbooks/rwa-operations.md).

### Self-Evolving AI (with Guard Rails)

The ANALYST prompt evolves based on performance, gated by safeguards:

- Minimum 20 settled trades before any mutation
- Validator prompt is **not subject to auto-evolution** (operator-only changes) — only Analyst evolves
- Every prompt version pinned to IPFS for auditability
- An immutable `FORMAT_GUARD_SUFFIX` is appended to every loaded
  evolved prompt so format drift can't break the JSON output contract
  (see `src/orchestrator/multiAgent.js`)
- Default-off behind `EVOLVED_PROMPTS_ENABLED=true` env flag while
  smoke tests confirm parse stability cycle-over-cycle (≥ 95% target;
  current measurements at 100% over the rolling 24h window — see
  `/api/health.parseSuccessRate24h` for the live value, refreshed each
  cycle from `src/data/parse_metrics.json`)
  `npm run smoke:reasoning`)
- AI prompt v3.0.0 currently pinned to IPFS; pre-evolution baseline
  is v2.1.1. Evolution logic is implemented end-to-end (mutation
  after N BAD_CALL events, validator prompt is immutable as the
  safety floor) but **default-off** in production until a longer
  smoke-window confirms cycle-over-cycle parse stability above 95%.

---

## Ecosystem Integration

### Partners & Integrations

Every entry below points to a verifiable code path or on-chain artefact. Removed
from earlier drafts: Tencent Cloud KMS, Elfa (now reinstated with real code),
OpenCheck, Surf, Orbit AI, Minds, Mirana — all had zero implementation behind
them per `.kiro/steering/no-lying-about-state.md`.

| Partner            | Integration                                                                    | Code path / artefact                                                                                                                                                               | Status                      |
| ------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| **Mantle Network** | Mainnet deployment (chain 5000), gas-paid in MNT, RPC via `rpc.mantle.xyz`     | [`frontend/app/providers.tsx`](frontend/app/providers.tsx) + 5 deployed contracts                                                                                                  | ✅ Live                     |
| **Z.ai**           | GLM-5 analyst model via AWS Bedrock (`zai.glm-5`)                              | [`src/orchestrator/multiAgent.js`](src/orchestrator/multiAgent.js) — `MODELS.analyst`                                                                                              | ✅ Live                     |
| **Anthropic**      | Claude Sonnet 4.6 validator via AWS Bedrock                                    | [`src/orchestrator/multiAgent.js`](src/orchestrator/multiAgent.js) — `MODELS.validator`                                                                                            | ✅ Live                     |
| **Google**         | Gemini 3.5 Flash arbiter via Vertex AI                                         | [`src/orchestrator/geminiArbiter.js`](src/orchestrator/geminiArbiter.js)                                                                                                           | ✅ Live                     |
| **Nansen**         | Smart-money intelligence via JSON-RPC 2.0 MCP client (we wire 9 named tools used per cycle: smart-money balances, smart-money perp trades, token top-holders, token DEX trades, general search, wallet PnL, address portfolio, token god-mode, growth chain rank) | [`src/mcp/nansenMCP.js`](src/mcp/nansenMCP.js) — used in `unifiedMarketData.js` every cycle                                                                                        | ✅ Live                     |
| **Elfa**           | Social intelligence — mindshare, smart-account ratio, attention surge          | [`src/data/elfa.js`](src/data/elfa.js) — wired into `signalEngine.js` as 5th signal + `/api/elfa-snapshot` (V2 paths: `/v2/data/top-mentions`, `/v2/aggregations/trending-tokens`) | ✅ Live (free tier, 60 RPM) |
| **Merchant Moe**   | DEX execution via Liquidity Book v2.2 router                                   | [`src/dex/merchantMoe.js`](src/dex/merchantMoe.js) — first RWA swap [`0x0af2336…`](https://mantlescan.xyz/tx/0x0af23364c7651b053d33b0f7ed3eb8b30107b5dc489e96a7ad8ac90cad3e09de)   | ✅ Live                     |
| **Ondo Finance**   | USDY tokenized Treasuries metadata (paper-ready; pool currently dry on Mantle) | [`src/rwa/usdyModule.js`](src/rwa/usdyModule.js) — guarded behind `RWA_POOL_INACTIVE`                                                                                              | 🟡 Paper-ready              |
| **Bybit**          | Wallet connector — primary recommended in RainbowKit `connectorsForWallets`    | [`frontend/app/providers.tsx`](frontend/app/providers.tsx) — `bybitWallet` from `@rainbow-me/rainbowkit/wallets`                                                                   | ✅ Live                     |
| **Pinata**         | IPFS pinning for Proof-of-Reasoning blobs and agent card auto-refresh          | [`src/ipfs/storage.js`](src/ipfs/storage.js)                                                                                                                                       | ✅ Live                     |

### Why Mantle?

- **~$0.006 gas per attestation tx** (cycle 123 verified sample, 8 TXs incl. 3 swaps = 0.077 MNT @ \$0.62/MNT ≈ \$0.048 per full cycle — block-by-block breakdown in [`.kiro/audits/raw/gas-samples/cycle-123.json`](.kiro/audits/raw/gas-samples/cycle-123.json), regenerable via `node scripts/audit/gas-cost-sample.js`) — enables logging every completed cycle's decision on-chain (cost-prohibitive on L1)
- **mETH native yield** — real staking returns as trading asset
- **EVM compatible** — standard Solidity, standard tooling
- **Growing AI ecosystem** — aligned with Mantle's AI agent vision

---

## Tech Stack

| Layer      | Technology                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| AI Models  | Z.ai GLM-5 Analyst (via AWS Bedrock) + Anthropic Claude Sonnet 4.6 Validator (via AWS Bedrock) + Google Gemini 3.5 Flash Arbiter (via Vertex AI) |
| Blockchain | Mantle L2 Mainnet (chain 5000)                                                                                                                   |
| DEX        | Merchant Moe Liquidity Book v2.2                                                                                                                 |
| Data       | CoinGecko, Nansen MCP, Byreal (aggregates Hyperliquid funding/OI), DeFiLlama, Elfa REST v2                                                       |
| Storage    | IPFS (Pinata) for Proof-of-Reasoning blobs                                                                                                       |
| Frontend   | Next.js 16 + Tailwind + Framer Motion + RainbowKit (Bybit Wallet primary)                                                                        |
| RWA        | Ondo Finance USDY metadata (paper-ready) + USDT0 LayerZero (active)                                                                              |
| Infra      | GitHub Actions cron (best-effort hourly), Vercel (frontend), Pinata (IPFS pinning)                                                              |

---

## Running the Agent

### Production: GitHub Actions cron (best-effort hourly)

Production runs are driven by [`.github/workflows/agent-cycle.yml`](.github/workflows/agent-cycle.yml),
which fires twice an hour at `:17` and `:47` UTC (best-effort — GH Actions
schedules under platform load; see audit notes). Each run:

1. Executes one `runMultiAgentCycle()` against live market data.
2. Writes a `data/last-cycle-summary.json` record.
3. Commits state files (outcomes, parse metrics, threshold state, …)
   back to `main`.
4. Vercel auto-deploys the front-end on the resulting push, so the
   mascot turns 🟢 within ~2 minutes.

Cadence is best-effort hourly, not sub-minute — the mascot's threshold is
calibrated for that, and `/api/health.lastCycleAge` always reflects ground
truth (slots can be skipped by GitHub Actions under platform load; see
`.kiro/audits/2026-05-28-pipeline-and-bridge-recheck.md` for the
known-skipped-slot rate). Operator runbook with the secrets list, manual
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
├── contracts/              # Solidity (6 contracts deployed, 4/5 Sourcify-verified; Router pending)
├── frontend/               # Next.js dashboard + proof explorer
├── sdk/                    # TuringVault SDK for external integration
├── test/                   # Contract + integration tests
└── docs/                   # Architecture, submission, vision docs
```

---

## Roadmap

- [x] Multi-agent consensus (GLM-5 + Claude Sonnet 4.6 + Gemini 3.5 arbiter)
- [x] On-chain decision logging (147+ decisions, growing every `:17`/`:47` UTC)
- [x] Adversarial validation (~44% on-chain rejection rate; live count via ValidationRegistry)
- [x] Self-evolving AI prompts (v3.0.0 pinned to IPFS, default-off behind env flag while smoke tests confirm parse stability)
- [x] Grid bot with regime detection (RANGING/TREND_UP/TREND_DOWN/CRISIS)
- [x] Live dashboard + proof explorer
- [x] ERC-8004 AI agent identity on-chain
- [x] IPFS reasoning storage with on-chain anchoring
- [x] [Discipline Layer](docs/discipline-layer.md) — post-execution proof verification (live; surfaced on dashboard)
- [x] RWA allocation active (USDT0 Treasury-collateralised, first swap on Mantlescan)
- [x] Adversarial Challenge page (preview-rules mode live; LIVE multi-agent mode in v3 spec)
- [x] Elfa social intelligence integrated as 5th structured signal (mindshare, smart-account mentions, entity-graph sentiment)
- [ ] HSM-backed signing (investigated Tencent Cloud KMS — `ListAlgorithms` API confirmed secp256k1 not available on international tier, only NIST P-256 ECC; stub remains at `src/kms/tencentKMS.js` with `simulate: true`)
- [ ] Cross-agent reputation marketplace
- [ ] Multi-vault strategy templates
- [ ] Governance: token-holder veto on prompt mutations
- [ ] Agent-to-agent trust scoring (ERC-8004 identity graph)

---

## License

MIT

---

_Built for the Mantle Turing Test Hackathon 2026 🏆_
