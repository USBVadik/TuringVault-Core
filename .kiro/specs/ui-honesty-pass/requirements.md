# UI Honesty Pass — Requirements

## Background

The TuringVault frontend currently presents data that is either fabricated, mis-scoped, or unverifiable. Examples confirmed in audit:

- `RiskMascot` is hardcoded to `varLevel={95}` and never reflects real state.
- `/api/performance` returns hardcoded `sharpe: 1.2`, `winRate: 58`, `maxDrawdown: 2.1` whenever `totalReturn > 0`, with `initialNav` calculated as `5 * mntPrice` (mock).
- `data/performance.json` contains a phantom NAV jump from $3.05 → $42.84 between consecutive snapshots, producing `Sharpe: 30.92`, `totalReturn: 1154.13%`.
- Hero copy says "Multi-model adversarial consensus with on-chain proof of every reasoning step" and stats are scoped to the lifetime of agentId=0 across all wallets, yet appear as if they belong to the connected wallet.
- `Vault Funding` panel reads `Agent Wallet 0xDC78…fb5a` (an EOA) but is labeled `Vault Balance` and shows `Total Deployed: N× Decisions` (decisions are not deployed capital).
- `Agent-Managed · Autonomous` is shown alongside a static `Supervised · VaR 95 bps` mascot — no continuous cron exists, last `data/loop_progress.json` timestamp is 2026-05-20 (~6 days stale).
- `EVOLUTION_STEPS` timeline shows `txHash: '0x2a4f...2a4f'`, `'0xf3e7...f3e7'`, `'0x01e9...deploy'` — fabricated hashes; in code `multiAgent.js` explicitly bypasses evolved prompts (`activeAnalystPrompt = ANALYST_SYSTEM_PROMPT` with comment "evolved prompts cause format issues").
- `AI Reasoning` panel labelled `LIVE` rotates through 12 hardcoded `REASONING_LINES` strings unrelated to recent decisions.
- `/api/reputation` returns `winRate` derived from `approved/total` (an approval rate, not a win rate), but the home page labels it `Win Rate`.

This is the largest dispatch-of-disqualification risk on the project. The hackathon's defining features (per public communications) are on-chain benchmarking, ERC-8004 identity, and **radical transparency**. A judge who detects mismatched UI claims has grounds to disqualify under misrepresentation.

This spec covers a one-pass cleanup that brings every numeric, every badge, and every "live" indicator into alignment with verifiable backend reality. No new features. No vault contract work. No agent logic changes. UI + API responses only.

## Scope

### In scope
- `frontend/app/page.tsx` (main dashboard)
- `frontend/app/api/performance/route.ts`
- `frontend/app/api/reputation/route.ts`
- `frontend/app/api/decisions/route.ts`
- `frontend/app/api/strategy/route.ts`
- New endpoint: `frontend/app/api/health/route.ts`
- `frontend/app/components/RiskMascot` extracted from `page.tsx`
- One-time cleanup of `data/performance.json` (drop phantom snapshots, recompute metrics, or delete file and start fresh)
- Replacing `EVOLUTION_STEPS` constant with either real on-chain version data or removal of the panel until prompt-evolution is re-enabled

### Out of scope
- Backend orchestrator (`src/orchestrator/*`)
- Smart contracts
- New vault contract / shares pattern (separate spec `shares-vault-contract`)
- Agent reasoning quality fixes (separate spec `agent-reasoning-quality`)
- Cron scheduling (separate spec `continuous-cron-and-health`)
- /challenge page rebuild (separate spec `human-vs-ai-challenge-v2`)
- Discipline Layer UI (separate spec `discipline-layer-ui`)

## Stakeholders

- **Primary user — hackathon judge**: opens the dashboard, expects numbers to match what is verifiable on-chain. Will likely click through to Mantle explorer to spot-check.
- **Secondary user — depositor / curious developer**: connects wallet, expects scoped data ("my balance", "my deposits") not aggregate.
- **Operator — solo dev (USBVadik)**: needs to know at a glance whether the agent is running.

## Glossary

- **Aggregate stat**: a number computed across all wallets / all sessions of agentId=0 (e.g., `totalProposals`, `totalApproved` from ValidationRegistry). These are public, lifetime metrics.
- **Wallet-scoped stat**: a number derived from the connected wallet's address (e.g., this user's USDY balance, this user's decision history if they ever deposit). Currently no per-user state exists; must be either explicitly empty or hidden when no wallet is connected.
- **Live**: data with confirmed freshness < 5 minutes from a verifiable source (on-chain read, IPFS pin, signed health check).
- **Cached**: data derived from a backend file or API snapshot older than 5 minutes — must be labelled with sync timestamp.
- **Demo / Simulated**: hardcoded or mocked data for illustration — must be labelled and visually distinct.

## Functional Requirements

### R1 — RiskMascot reflects real state

**As a** judge,
**I want** the bottom-right mascot to reflect actual agent state,
**so that** the indicator means something.

**Acceptance**
1. WHEN the dashboard loads, THE RiskMascot SHALL fetch from `/api/health` (new endpoint).
2. WHEN `/api/health` reports `lastCycleAge < 600 seconds` AND no errors in last 3 cycles, THE mascot SHALL show 🟢 `Active · last cycle <Xs ago>`.
3. WHEN `lastCycleAge >= 600 seconds AND < 3600 seconds`, THE mascot SHALL show 🟡 `Idle · last cycle <Xm ago>`.
4. WHEN `lastCycleAge >= 3600 seconds` OR endpoint unreachable, THE mascot SHALL show 🔴 `Offline · last cycle <Xh ago>` or `Offline · no recent data`.
5. THE mascot SHALL NOT display VaR figures unless those VaR figures originate from a real per-cycle calculation tied to the most recent decision.
6. WHEN the connected wallet is the agent's wallet OR a wallet with deposits in the eventual vault contract, additional context (e.g., "VaR for last cycle: N bps") MAY be shown — but only when that VaR is computed from `data/loop_progress.json` results within freshness window.

### R2 — `/api/health` endpoint

**As a** frontend,
**I want** a single endpoint reporting agent liveness,
**so that** mascots and badges can be wired uniformly.

**Acceptance**
1. THE endpoint SHALL be `GET /api/health` returning JSON.
2. THE response SHALL include:
   - `lastCycleTimestamp` (ISO 8601) — read from `data/loop_progress.json` mtime, or from the latest `recordedAt` in `src/data/outcomes.json`, whichever is newer.
   - `lastCycleAge` (seconds since now).
   - `cyclesSucceeded24h` (int) — count of decisions recorded in last 24h.
   - `cyclesFailed24h` (int) — best-effort, may be 0 if not tracked.
   - `mode` (string: `manual` | `cron-github-actions` | `cron-vps` | `unknown`) — read from env var `AGENT_RUN_MODE`, fallback `unknown`.
   - `chainBlockHeight` (number) — Mantle latest block, freshness sanity.
3. WHEN any underlying read fails, THE endpoint SHALL return HTTP 200 with `{ status: 'degraded', error: '<short>', lastCycleAge: null }` rather than 500. Frontend treats `lastCycleAge: null` as "Offline".
4. THE endpoint SHALL NOT echo secrets, private keys, or any `.env` values.

### R3 — `/api/performance` returns honest numbers or none

**As a** judge,
**I want** the Agent Performance section to show numbers I can verify,
**so that** I trust the project.

**Acceptance**
1. THE endpoint SHALL NOT return hardcoded fallback values for `sharpe`, `winRate`, `maxDrawdown`, `recoveryHours`, `hoursTracked` when those metrics cannot be derived from real data.
2. THE endpoint SHALL compute the following from `src/data/outcomes.json` `settled[]` array:
   - `settledCount` — `settled.length`.
   - `goodCallCount` — outcomes where `outcome === 'GOOD_CALL'`.
   - `correctBlockCount` — outcomes where `outcome === 'CORRECT_BLOCK'`.
   - `badCallCount` — outcomes where `outcome === 'BAD_CALL'`.
   - `missedAlphaCount` — outcomes where `outcome === 'MISSED_ALPHA'`.
   - `cumulativePnlBps` — `sum(outcomes[].pnlBps)`.
   - `winRate` — `(goodCallCount + correctBlockCount) / settledCount`, expressed as percentage with 1 decimal.
3. THE endpoint SHALL return `nav`, `mnt`, `meth` from real on-chain reads (existing logic OK), but SHALL drop `initialNav = 5 * mntPrice` mock — only return `totalReturn` if there is a real `initialNavRecorded` value stored separately (e.g., `data/initial_nav.json` written once at agent launch). If no such record exists, omit `totalReturn` from response.
4. THE endpoint SHALL include a `dataScope: 'agent-lifetime'` field clarifying that all metrics are aggregate across the agent's lifetime, not per-user.
5. THE endpoint SHALL include a `lastSettlementAt` (ISO 8601) field — `outcomes.settled[last].settledAt`.

### R4 — Agent Performance section labels and scope

**As a** depositor,
**I want** to know whether the displayed PnL/win-rate belongs to me or to the agent overall,
**so that** I have correct expectations after depositing.

**Acceptance**
1. THE Agent Performance section SHALL display the heading `Agent Performance · Lifetime aggregate (agentId=0)` instead of plain `Agent Performance`.
2. EACH metric tile SHALL include the badge `Lifetime` next to its label.
3. WHEN the connected wallet has deposits in the vault contract (out of scope for this spec, but interface stays ready), the section SHALL show a second sub-section `Your Session` with wallet-scoped numbers; until then, this sub-section SHALL be hidden, NOT show zeros.
4. THE `Win Rate` tile SHALL be sourced from `goodCallCount + correctBlockCount` over `settledCount`, NOT from `approved/total`. The `/api/reputation` `winRate` field — which is actually approval rate — SHALL be relabeled `Approval Rate` everywhere it's displayed, OR replaced by the corrected win rate.
5. THE `Cumulative PnL` tile SHALL display `cumulativePnlBps` from `/api/performance` formatted as `+N bps` or `-N bps`, NOT the contract reputation score `cumulativeScore = approved*100 - rejected*50`. Reputation score is a separate concept, displayed separately as `Reputation Score`.
6. THE `Settled Outcomes` tile SHALL display `settledCount` from `/api/performance`, NOT `totalProposals` from `/api/reputation`. These differ: `totalProposals` includes pending and rejected; `settledCount` is only resolved outcomes.
7. THE summary footer line currently reading `Circuit Breaker: ACTIVE · Kill Switch: -5% NAV triggers full stop · VaR Gate: 150 bps max` SHALL only show those guards that are actually wired in production code. Each item SHALL include a tooltip linking to the source file (e.g., `agentCron.js` for circuit breaker, `multiAgent.js` for VaR gate). Items not wired are removed.

### R5 — Vault Funding panel relabeled

**As a** depositor inspecting where capital lives,
**I want** the funding panel to accurately describe the agent's wallet vs a vault contract,
**so that** I'm not misled.

**Acceptance**
1. THE panel heading SHALL change from `Vault Funding` to `Agent Wallet · Operator Account`.
2. THE row currently labelled `Vault Balance` SHALL be relabeled `Agent EOA Balance`.
3. THE row currently labelled `Total Deployed: N× Decisions` SHALL be removed. Decision count is shown elsewhere (Hero `On-Chain Proofs`).
4. A new info row SHALL show `Custody Model: Agent EOA (custodial demo) · Vault contract pattern coming` with a link to issue/spec.
5. THE bottom CTA `Agent-Managed · Autonomous · Deposits governed by on-chain validation` SHALL be replaced with `Demo capital · No public deposits open · Vault contract in development`.
6. WHEN the vault contract spec ships and the vault is deployed (later spec), this panel transforms into a real Vault TVL panel. Until then, it stays an honest "this is the agent's hot wallet" panel.

### R6 — AI Reasoning ticker labeled as example

**As a** judge,
**I want** to know when text is illustrative vs real,
**so that** I'm not misled.

**Acceptance**
1. THE `AI Reasoning` panel header SHALL change `LIVE` indicator to `Example reasoning steps · static`.
2. THE panel SHALL include a clear caption: `These are example reasoning lines. Real per-cycle reasoning is on the Proof Explorer page, linked by IPFS CID.`
3. The panel SHALL include a link to `/proof-explorer` to view the latest real decision's reasoning.
4. (Optional, deferred) Future iteration replaces this static ticker with the latest decision's actual reasoning text from `outcomes.json` or IPFS — but that is not in scope for this spec; minimal change here is honest labelling.

### R7 — Live Agent Pipeline scoped correctly

**As a** judge,
**I want** the `Live Agent Pipeline` block to reflect what is actually live vs cached,
**so that** I trust other live indicators.

**Acceptance**
1. THE caption currently reading `Real execution data from Mantle Mainnet` SHALL include freshness: `Mantle Mainnet · last update <Xs ago>` based on the latest decision timestamp.
2. WHEN `lastCycleAge > 600 seconds`, THE block SHALL show a banner: `⚠ Agent idle for <Xm>. Last cycle: <timestamp>. Cron status: <mode>.`
3. THE `LiveTerminal` component SHALL retain its current data source (decisions stream) but SHALL receive freshness state from `/api/health` and surface it.

### R8 — Hero stats and copy

**As a** judge,
**I want** the hero numbers and language to match the rubric,
**so that** AI x RWA narrative is unambiguous.

**Acceptance**
1. THE hero subheading currently reading `The AI that proves why it didn't trade` SHALL be retained — it accurately matches the high rejection rate.
2. THE hero descriptive line currently reading `Multi-model adversarial consensus with on-chain proof of every reasoning step. N/M dangerous trades blocked — market confirmed every call.` SHALL be edited to remove `market confirmed every call` (unverifiable claim). Replacement: `... reasoning step. N/M proposals blocked by validator before execution.`
3. THE three hero tiles SHALL be:
   - `On-Chain Proofs` — `totalProposals` from ValidationRegistry. Tooltip: `Proposals submitted by Analyst, recorded on Mantle Mainnet`.
   - `Trades Blocked` — `totalRejected` from ValidationRegistry. Tooltip: `Proposals rejected by Validator before any swap executed`.
   - `Safety Rate` — `totalRejected / totalProposals` as %. Tooltip: `Percentage of proposals blocked by adversarial validation`.
4. THE hero badges currently reading `ERC-8004 Identity · GLM-5 × Claude 4.6 × Gemini 3.5 · Mantle Mainnet` SHALL stay if and only if `agent-card.json` and on-chain agent NFT URI confirm GLM-5 + Claude + Gemini as the active models. (Spec `agent-reasoning-quality` will fix the agent-card content; this spec verifies the badge text matches whatever the agent-card states.)

### R9 — Evolution Timeline section

**As a** judge,
**I want** evolution claims to be backed by IPFS CIDs and on-chain artifacts,
**so that** "self-evolving prompts" is more than a story.

**Acceptance**
1. THE `EVOLUTION_STEPS` constant with fake `txHash: '0x2a4f...2a4f'` etc. SHALL be removed from the page.
2. EITHER:
   - **(a) preserve panel with real data**: each step links to a real artifact — IPFS CID for the prompt version, optionally on-chain agent NFT `tokenURI` update tx. If no real artifacts exist, this option is unavailable.
   - **(b) hide panel until prompt evolution is re-enabled**: replace with a single line `Prompt evolution module exists in code (src/evolution/promptEvolution.js) but is currently disabled in production. v2.1.1 is pinned. See SPEC.md.`
3. The panel header SHALL include `· Currently disabled in production` if option (b).

### R10 — `data/performance.json` cleanup

**As a** developer,
**I want** the persistent performance file to not contain phantom data,
**so that** `/api/performance` and any tooling read it without producing nonsense.

**Acceptance**
1. The file SHALL be either:
   - **(a) deleted** so `/api/performance` falls back gracefully to "no NAV history yet" — preferred if metrics derived purely from `outcomes.json` per R3, OR
   - **(b) regenerated** with only the snapshots that don't include the $3 → $42 jump (drop snapshots 8–20 from current file; or drop all and start fresh).
2. WHEN the file is empty / missing, `/api/performance` SHALL return only chain-derived `nav` and `outcomes`-derived metrics, omitting `sharpe`, `maxDrawdown`, `recoveryHours` entirely (these require sufficient history and a working performance tracker).

### R11 — Notification toast

**As a** judge,
**I want** the "New Decision" toast to fire only when there really is a new decision,
**so that** absence of toast = absence of activity (honest signal).

**Acceptance**
1. THE existing toast logic (compares `data.totalDecisions > prevTotalRef.current`) SHALL be retained as-is — it's correct.
2. THE polling interval (`30000ms`) SHALL be retained.
3. NO additional fake toasts SHALL be triggered. (Confirming current code is honest.)

### R12 — Footer / Contracts section

**As a** judge,
**I want** to verify each contract address links to a real verified contract,
**so that** ERC-8004 claim is provable.

**Acceptance**
1. EACH contract row SHALL display its name, address (truncated), and a link to Mantle Explorer.
2. EACH row SHALL include a Sourcify badge `✓ verified on Sourcify` only if Sourcify reports verified at link `https://repo.sourcify.dev/contracts/full_match/5000/<address>/`.
3. EACH row SHALL include the contract's role tag: `ERC-8004 Identity Registry`, `ERC-8004 Reputation Registry`, `Multi-Agent Validation Registry`, `Decision Log`, `Router (legacy, not yet vault-enabled)`.
4. THE Router row SHALL state `(deployed but not yet wired into agent execution path)` to honestly reflect that swaps still go EOA→Odos.

### R13 — Build hygiene

**As a** developer,
**I want** the changes to not introduce regressions,
**so that** the existing CI pipeline stays green.

**Acceptance**
1. `npm run build` (in `frontend/`) SHALL succeed.
2. `npm run lint` SHALL succeed with no new warnings beyond pre-existing baseline.
3. No new dependencies SHALL be added.
4. No hardcoded API base URLs (relative paths only).
5. All `useEffect` polling intervals SHALL be cleared on component unmount (already done; verify intact).

## Non-Functional Requirements

### NFR1 — Honesty by construction

EVERY numeric stat displayed on the dashboard SHALL be traceable, in the source, to one of:
- An on-chain `view` call result.
- An aggregate computed deterministically from `src/data/outcomes.json`.
- The connected wallet's balance / position state.

Hardcoded constants SHALL NOT be displayed as live data. Animation strings SHALL be visually distinct from real data and labelled.

### NFR2 — Graceful degradation

WHEN any backend endpoint fails or returns null, the UI SHALL display a clear placeholder (`—` or `Loading...` or `Stale · last sync …`), not a fallback hardcoded number masquerading as live.

### NFR3 — Time format consistency

ALL relative timestamps (`<Xs ago>`, `<Xm ago>`, `<Xh ago>`) SHALL use a single helper function with consistent rounding and unit selection.

### NFR4 — A11y minimum

Tooltips and freshness labels SHALL be readable by screen readers (use `aria-label` on icon-only state indicators).

### NFR5 — No telemetry leak

NEW endpoints SHALL NOT include any wallet private keys, AWS keys, IPFS JWTs, or contract owner addresses in responses.

## Success Criteria

This spec is considered done WHEN:

1. A judge can open the dashboard, click any number, and trace it to either an on-chain transaction, an `outcomes.json` entry, or a "demo / example" label.
2. The bottom-right mascot turns red within 11 minutes of the cron stopping.
3. A reviewer running `git grep -i 'TODO\|FIXME\|hardcoded'` in `frontend/app/page.tsx` finds zero new occurrences.
4. The `no-lying-about-state.md` steering checklist (every item) passes.
5. `npm run build && npm run lint` are green.

## Open Questions

1. Should `EVOLUTION_STEPS` panel be hidden entirely (option 9.2.b) or preserved with real on-chain version history fetched from agent NFT URI updates? — recommendation: hide for now (option b); re-enable when `agent-reasoning-quality` spec re-enables evolved prompts.
2. Should `data/performance.json` be deleted (R10.a) or regenerated (R10.b)? — recommendation: delete; let it accumulate fresh once the cron is continuous (after `continuous-cron-and-health` spec).
3. Should we add a global banner `Demo Mode · No public deposits` until the vault contract ships? — recommendation: yes, single line under the header, dismissible, neutral styling.
4. Confirm `agent-card.json` model list before R8.4 hard-locks badge text. — handle in this spec or in `agent-reasoning-quality`?

## Dependencies

- None on contracts (no deploy needed).
- None on backend orchestrator changes.
- Soft dependency: `continuous-cron-and-health` spec ships `/api/health` proper (this spec ships a minimal version reading `loop_progress.json` mtime + `outcomes.json`; later spec replaces with proper monitoring).

## Risks

- **R-A**: Removing `Total Deployed` and other catchy hero stats could weaken hero impact. Mitigation: replace with `Safety Rate` already proposed; that's the AI x RWA differentiator anyway.
- **R-B**: Honest "Agent EOA · custodial demo" label might be read as "this is unsafe" by judges. Mitigation: pair with explicit roadmap link to vault contract spec; show Discipline Layer post-execution gate as compensating control.
- **R-C**: Hiding EVOLUTION_STEPS removes an "innovation" claim. Mitigation: keep paragraph noting the module exists with link to source, just don't show fabricated TX hashes.
