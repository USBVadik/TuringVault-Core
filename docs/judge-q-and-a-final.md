# TuringVault Judge Q&A

Use this after the demo video or during live judging. The goal is to answer hard questions before they become objections.

Observed snapshot for numeric examples: 2026-06-04 17:05 UTC. Refresh final numbers from `/api/health`, `/api/performance`, and `/api/proof-explorer` before pasting externally.

---

## Is this live, or is it a scripted demo?

It is a live Mantle Mainnet demo with public GitHub Actions automation. The current capital is operator-funded demo capital, not public user deposits. The honest test is whether the agent keeps writing proposals, validations, decisions, feedback, replay manifests, and Discipline Layer results that judges can inspect.

The GitHub Actions schedule is best-effort. If GitHub skips a slot, `/api/health.lastCycleAge` shows that truth instead of hiding it.

## Is the performance number realized wallet PnL?

No. The dashboard labels it as Decision-Quality / Outcome Score from settled decisions. It measures whether decisions and blocks were directionally correct after settlement windows. Realized wallet PnL is intentionally not claimed; `/api/performance.realizedTradingPnlBps` is `null`.

That distinction helps the project. TuringVault is being submitted as infrastructure for accountable AI allocation, not as a promise that a small demo wallet generated a specific profit.

## Why should blocked trades count?

For treasury software, a correct refusal is a product outcome. If the agent proposes a weak trade and the validator or regime gate blocks it, the system preserved capital and left a public reason trail. That is different from a bot that simply does nothing.

The Proof Explorer separates executed swaps, holds, validator blocks, regime blocks, low-confidence blocks, parse failures, and portfolio blocks so judges can see the difference.

## What is the main trust boundary today?

The current orchestrator is centralized Node.js running under GitHub Actions and application secrets. That means the system is not fully trustless today.

What is already public after each cycle:

- contract writes on Mantle,
- IPFS content addressing,
- replay manifest hashes,
- public cron logs,
- Discipline Layer verification rows.

Once a cycle is anchored, changing the reasoning would break the manifest/hash binding. The roadmap is to reduce the pre-anchor trust boundary with stronger key custody, external witnesses, or TEE/decentralized execution, but the submission should not pretend that is already solved.

## Why not switch to a vault contract or decentralized runner before the deadline?

Because the current demo is already live and inspectable. Replacing custody or automation days before judging would add execution risk and might destroy the evidence trail. The right move is to keep the EOA demo honest, label it clearly, and show the vault-contract pattern as the next production step.

## Why use GitHub Actions cron?

It gives judges a public automation log without asking them to trust a private server. It is not a perfect daemon. The site is explicit about freshness, failed runs, skipped slots, and gas runway.

## What makes this RWA, not just AI trading?

The active allocation rail includes USDT0 as the stable Treasury-collateralised allocation target and mETH as the Mantle-native yield/risk leg. USDY support is implemented as a module, but live swaps are gated until Mantle liquidity is usable again.

The RWA angle is not only the token list. It is the governance need: treasuries need to know why an AI allocator moved capital, why it refused to move capital, and whether the post-execution proof matched the original claim.

## Why Mantle?

Mantle is where the asset stack, execution venue, and AI-agent track line up: mETH, USDT0, Merchant Moe LB v2.2, Mantle Mainnet contract anchoring, and the ERC-8004 agent identity direction. The project is built around those rails rather than treating Mantle as a generic deployment target.

## How is this different from other transparent agent or arbitrage projects?

Many projects show logs, PnL, or contract-level risk controls. TuringVault's difference is pre-execution Proof-of-Reasoning:

- the analyst proposes,
- the validator challenges,
- the deterministic gates can veto,
- the decision is anchored,
- execution is checked afterward,
- the agent reputation changes.

The moat is the verification process, not a claim that one model is always right.

## What should judges inspect first?

1. `/proof-explorer` for registry counters, denominator notes, and historic cases.
2. `/replay/265` for an executed swap with reasoning and proof.
3. `/replay/266` for a blocked proposal that later settled as a correct block.
4. `/discipline` for TX proof, price freshness, and regime drift.
5. GitHub Actions `agent-cycle.yml` for public automation history.

## What is the business model?

White-label verification and decision-governance rails for DAO treasuries, on-chain funds, and operators allocating into Mantle yield/RWA assets.

The buyer is not paying for a black-box trading signal. They are paying for hosted agent operations, on-chain attestation, replay dashboards, and audit evidence around an allocation policy they can govern.

## What should not be claimed?

- Do not claim realized wallet PnL.
- Do not claim public deposits.
- Do not claim perpetual liveness.
- Do not claim every cycle is a trade.
- Do not claim live USDY execution.
- Do not claim complete trustlessness.
- Do not claim full reasoning text is stored on-chain.
