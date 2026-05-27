---
inclusion: always
---

# Rule: Never Lie About State on the UI

This project promotes "Proof of Reasoning" and "radical transparency" as defining features. If a judge catches the UI reporting state that doesn't match reality, the narrative collapses and the submission risks disqualification for misrepresentation.

## Hard rules

1. **No live-presented data may belong to a different scope than what the user sees.**
   If the dashboard reads from contract aggregates, label scope explicitly:

   - User-deposited session: `Your session` / `This wallet`.
   - Aggregate of all wallets: `Historical · all sessions`.
   - Backend file/snapshot: `Cached · last sync at <timestamp>`.

2. **No "Autonomous · Running 24/7" copy unless the cron is actually running and observable.**
   If autonomy is currently a manual/triggered cycle, the badge must read `Manual run` or `Showcase mode · last cycle <timestamp>`. Never both "Autonomous" and "Supervised" on the same screen.

3. **No phantom PnL.** Cumulative PnL, win rate, and Sharpe shown on the home page must be sourced from on-chain reality (contract events / settled outcomes / verified balance deltas) — not from `performance.json` snapshots that include funding top-ups, mock initial NAV, or simulated history. If the metric cannot be derived from on-chain state, it should be either:

   - Not displayed, or
   - Flagged with `Demo · simulated` and tooltip explaining what's mocked.

4. **Animation is allowed; fake liveness is not.**
   The reasoning ticker on the homepage may animate placeholder lines, but it must be clearly visually distinct from actual recent decisions, or labeled `Example reasoning steps`.

5. **Every claim of integration must point to a verifiable artifact.**
   If the README/agent-card claims "Tencent Cloud KMS HSM signing", but the code path uses `simulate: true`, the UI must say `KMS: simulated`. Same for "Nansen MCP", "Discipline Layer active", "Self-evolving prompts" — link to the artifact (TX, IPFS CID, contract event) or label as concept.

## Practical checklist before merging UI changes

- [ ] Every numeric stat has a documented data source (function name + contract or file).
- [ ] Every "live" badge has a freshness check; if data is older than X minutes it shows `Stale · last update <ts>`.
- [ ] Every `Autonomous` claim is gated by a backend health-check endpoint that confirms the cron is alive within the last cycle interval.
- [ ] No copy says "running 24/7" anywhere unless we have a 24/7 health monitor backing it.
- [ ] Wallet stats are scoped to either the connected wallet (user) or the agent's vault address (clearly labeled).

## When uncertain

Default to honesty. "Demo cycle" is a fine label and does not weaken the AI x RWA narrative — adversarial-validation, on-chain proof, and ERC-8004 identity are the wins, not "always on". Misrepresentation is the only thing that can lose the prize.
