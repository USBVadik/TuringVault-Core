---
inclusion: always
---

# TuringVault — Hackathon Context (always-loaded)

This is a hackathon submission. Always optimize against the rubric, not abstract code quality.

## Event
- **Hackathon:** Mantle Turing Test 2026 (Phase 2 "AI Awakening"), $100k prize pool
- **Submission:** https://dorahacks.io/buidl/43986
- **Deadline:** 2026-06-15 18:59 UTC (hard freeze)
- **Solo developer:** USBVadik. Time budget is the binding constraint.

## Targets (in this order)
1. **AI x RWA Track 1st Prize** — sponsored exclusively by Mantle. **Primary target.**
   - Scoring: 60% general (AI x RWA depth, technical completeness, Mantle integration, compliance) + 40% Real-World Validity (clear asset category, well-defined target users, complete UX).
2. **20 Project Deployment Award** — pursue as guaranteed-grade if first-come-first-served checkboxes all met.
3. Grand Champion — outside shot, do not optimize for it at the expense of #1.

## Three Defining Features judges look for
1. On-chain benchmarking of AI (every decision recorded on Mantle).
2. ERC-8004 agent identity standard.
3. Radical transparency (live observable agents).

## Strategic wedge for AI x RWA
"First AI agent on Mantle that proves every RWA allocation decision survived adversarial challenge BEFORE execution. Not a black-box trading bot — an accountable RWA portfolio agent (mETH staking yield + USDY US Treasuries + risk-gated rebalancing) with on-chain proof for every allocation."

Reposition language from "AI trader" → "AI RWA portfolio manager" everywhere user-facing.

## Live state to remember
- Frontend: https://frontend-seven-beta-46.vercel.app
- 5 Mantle Mainnet (chain 5000) contracts, Sourcify-verified — **never redeploy unless absolutely necessary** (loses decision history, breaks Sourcify links).
- Stack: GLM-5 Analyst → Claude 4.6 Validator → Gemini 3.5 Flash Arbiter, IPFS via Pinata, ERC-8004 identity, Discipline Layer post-execution gate.
- Ondo USDY + mETH on Mantle, Merchant Moe DEX, Bybit RainbowKit.

## Things to preserve untouched (working strengths)
- Multi-agent consensus pipeline (`src/orchestrator/multiAgent.js`).
- IPFS reasoning storage + on-chain anchoring (`src/ipfs/storage.js`).
- ERC-8004 contracts.
- Discipline Layer (`src/orchestrator/disciplineLayer.js`, `docs/discipline-layer.md`).
- Self-evolving prompts with guard rails.

## Working rules
- Specs-first for any non-trivial change: `.kiro/specs/<feature>/{requirements.md,design.md,tasks.md}` before code.
- Do not add features that don't move toward the AI x RWA Track or Deployment Award.
- Honest reporting: if something is alpha/hardcoded/mocked, label it as such — never disguise it.
- Submission text on DoraHacks gets edited last, after product changes are real.
- Demo video re-record happens after P0 fixes, not before.
