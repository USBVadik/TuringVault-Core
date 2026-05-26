# UI Honesty Pass — Tasks

Decisions locked from design Q&A:

- Vercel prod showing 🔴 Offline for agent data is correct behavior for this spec.
- Sourcify status → build-time JSON.
- Delete `data/performance.json` and `data/loop_progress.json` after backing up.
- Banner text: `Demo Mode · No public deposits · Stats below are agent-lifetime aggregate (agentId=0)`.

Each numbered task is a distinct commit. Sub-checkboxes are within-task steps. Tasks are ordered so the repo is in a working state after every commit.

---

## T1 — Snapshot and clean up phantom data files

- [x] T1.1 — Create `.kiro/audit/snapshots/2026-05-26/` directory.
- [x] T1.2 — Copy `src/data/performance.json` → `.kiro/audit/snapshots/2026-05-26/performance.json`. (path correction: file actually lives in `src/data/`, not `data/`)
- [x] T1.3 — Copy `data/loop_progress.json` → `.kiro/audit/snapshots/2026-05-26/loop_progress.json`.
- [x] T1.4 — Add `.kiro/audit/snapshots/2026-05-26/README.md` noting why archived.
- [x] T1.5 — Delete `src/data/performance.json` and `data/loop_progress.json`.
- [x] T1.6 — `src/metrics/performanceTracker.js` confirmed to recreate via `fs.mkdirSync(..., { recursive: true })` (line 34 of file).
- [ ] T1.7 — Build runs: `cd frontend && npm run build` — should still pass since current API has try/catch for missing files.
- [ ] T1.8 — Commit: `chore: archive and remove phantom performance.json and stale loop_progress.json`.

**Acceptance**: `data/performance.json` and `data/loop_progress.json` are gone from working tree; archive copies exist; build passes.

---

## T2 — Helpers and shared building blocks

- [x] T2.1 — Create `frontend/app/lib/time.tsx` with `formatRelativeTime(iso)` per design C7. (Used `.tsx` not `.ts` because React 19 strict typing rejects `JSX.Element` and `<>` fragments inside `.ts`.)
- [x] T2.2 — Add `<RelativeTime ts={...} />` React component (auto-rerender every 30s, cleanup on unmount).
- [x] T2.3 — Sanity-check passed: 7/7 cases — `null`, invalid string, 7s, 3m, 2h, 5d, future-clock-skew.
- [ ] T2.4 — Commit: `feat(frontend): add time helpers (formatRelativeTime, RelativeTime component)`.

**Acceptance**: import in dev console works; component renders without error.

---

## T3 — `/api/health` endpoint

- [x] T3.1 — Create `frontend/app/api/health/route.ts`.
- [x] T3.2 — Read `data/loop_progress.json` mtime via `fs.statSync(...).mtimeMs`. Wrap in try/catch.
- [x] T3.3 — Read `src/data/outcomes.json`. Compute newest of `pending[*].recordedAt` and `settled[*].settledAt`.
- [x] T3.4 — `lastCycleTimestamp = max(progress mtime ISO, latest outcomes ISO)`. If both unavailable → `null`.
- [x] T3.5 — `lastCycleAge = (Date.now() - new Date(lastCycleTimestamp).getTime()) / 1000` if available, else `null`.
- [x] T3.6 — Mantle RPC `eth_blockNumber` via existing viem client pattern from `/api/decisions`.
- [x] T3.7 — Read `process.env.AGENT_RUN_MODE` with fallback `'unknown'`.
- [x] T3.8 — Compute `cyclesSucceeded24h` from outcomes union (pending + settled, deduped, filtered to last 24h).
- [x] T3.9 — `cyclesFailed24h: null` placeholder.
- [x] T3.10 — Response shape per design C2; on error return HTTP 200 with `{ status: 'degraded', error, lastCycleAge: null, mode: 'unknown' }`.
- [x] T3.11 — Add `Cache-Control: no-store` header.
- [x] T3.12 — `dynamic = 'force-dynamic'`, `revalidate = 0`.
- [x] T3.13 — Manual hit returned: `{lastCycleTimestamp: "2026-05-23T17:01:19.815Z", lastCycleAge: 227257, chainBlockHeight: 95826312, mode: "unknown"}` — accurate.
- [x] T3.14 — Verified no secrets leak (grep for private/aws/nansen/pinata/key/secret on response → empty).
- [ ] T3.15 — Commit: `feat(api): add /api/health endpoint`.

**Acceptance**: GET /api/health returns valid JSON with all expected fields; never throws 500.

---

## T4 — `/api/agent-card` endpoint

- [x] T4.1 — Create `frontend/app/api/agent-card/route.ts`.
- [x] T4.2 — Read `assets/agent-card.json` from `path.resolve(process.cwd(), '..', 'assets', 'agent-card.json')`.
- [x] T4.3 — Extract: `name`, `models.{analyst,validator,arbiter}.{provider,model}`, `systemPrompt.version`, `systemPrompt.lastUpdated`, `contracts`, `cardStats`. Returned as `cardStatsScope: 'card-author-declared'` so frontend can never confuse them with live counts.
- [x] T4.4 — On error or missing file, return `{ status: 'missing'|'degraded', models: {…null}, ... }` with HTTP 200 — graceful.
- [x] T4.5 — Manual test result: returns models trio (Z.ai GLM-5 / Anthropic Claude 4.6 / Google Gemini 3.5 Flash), prompt version `3.0.0`, last update `2026-05-23T12:00Z`. Note: card declares `systemPrompt.version 3.0.0` but `multiAgent.js` runs base prompt (evolved bypassed); discrepancy logged for `agent-reasoning-quality` spec. Card declares 90/58/32 decisions but on-chain reads 97 — drift documented; UI must use on-chain counts for live stats.
- [x] T4.6 — Commit deferred to T6 batch.

**Acceptance**: endpoint reads `assets/agent-card.json` and returns models map or graceful null.

---

## T5 — Rewrite `/api/performance`

- [x] T5.1 — Replace contents of `frontend/app/api/performance/route.ts`.
- [x] T5.2 — Keep on-chain reads: MNT balance, mETH balance via ERC20.
- [x] T5.3 — Keep CoinGecko price fetch with 5s timeout.
- [x] T5.4 — Removed `initialNav = 5 * mntPrice` mock; removed `totalReturn` field.
- [x] T5.5 — Read `src/data/outcomes.json`. Computes settledCount, goodCallCount, correctBlockCount, badCallCount, missedAlphaCount, cumulativePnlBps, winRate, lastSettlementAt per design C3.
- [x] T5.6 — Removed `sharpe`, `maxDrawdown`, `recoveryHours`, `hoursTracked` fields entirely.
- [x] T5.7 — Added `dataScope: 'agent-lifetime'` and `source: { onchain, aggregates }` for traceability.
- [x] T5.8 — On read error: returns metrics with `null` values + `error` field, keeps any successful on-chain numbers.
- [x] T5.9 — Live response confirmed: nav $24.85 (33.534 MNT + 0.001405 mETH at $0.645/$2283), settledCount 37, winRate 32.4% (4 GOOD_CALL + 8 CORRECT_BLOCK / 37), cumulativePnlBps +1216, lastSettlementAt 2026-05-23T16:30Z. Honest numbers: winRate is lower than the previous hardcoded 58%, but cumulativePnlBps positive — capital-protection narrative intact.
- [x] T5.10 — Commit deferred to T6 batch (foundation block).

**Acceptance**: response contains only verifiable numbers; no Sharpe; `winRate` is real.

---

## T6 — Sourcify status snapshot (build-time)

- [x] T6.1 — `frontend/app/data/contracts.json` created with 7 entries (5 originally claimed + ERC-8004 ValidationRegistry alt + legacy Identity).
- [x] T6.2 — All 7 addresses verified against Sourcify server API. **Drift found**: 6 full match, but `0x8187…7001` (Router) is `none` — never verified or bytecode mismatch. Captured honestly with `sourcifyNote` field; README/SUBMISSION docs that claim "5 Sourcify-verified" need fix in submission spec.
- [x] T6.3 — `npm run check:sourcify` script added in root `package.json`, backed by `scripts/check-sourcify.sh` (bash + jq; exits non-zero on drift).
- [x] T6.4 — `.kiro/specs/ui-honesty-pass/sourcify-recheck.md` documents when/how to re-run.
- [x] T6.5 — Commit deferred to T6 batch.

**Acceptance**: `frontend/app/data/contracts.json` exists with verified-status flags; `npm run check:sourcify` works.

---

## T7 — Extract `RiskMascot` to component, wire `/api/health`

- [x] T7.1 — Created `frontend/app/components/RiskMascot.tsx` per design C1.
- [x] T7.2 — Component fetches `/api/health` on mount and every 60s.
- [x] T7.3 — `deriveState(h)` maps `lastCycleAge` to active/idle/offline; renders 🟢/🟡/🔴 with `<RelativeTime/>` + `mode`.
- [x] T7.4 — `varLevel` prop removed entirely.
- [x] T7.5 — `role="status"` + `aria-label="Agent status: <label>"` for screen readers.
- [x] T7.6 — `page.tsx` updated: import RiskMascot from `./components/RiskMascot`; inline definition removed; `<RiskMascot varLevel={95} />` → `<RiskMascot />`.
- [x] T7.7 — Live verification: `lastCycleAge: 234475s` (~65h, cron dead since 2026-05-23) → 🔴 Offline. Build passes. Honest behavior confirmed.
- [x] T7.8 — Commit deferred to UI batch.

**Acceptance**: mascot reflects real liveness; no hardcoded `varLevel={95}`.

---

## T8 — Demo Mode banner

- [x] T8.1 — Banner inserted directly after `<header>` block in `page.tsx`.
- [x] T8.2 — Text: `Demo Mode · No public deposits · Stats below are agent-lifetime aggregate (agentId=0)`.
- [x] T8.3 — Styling: subtle yellow tone (`bg-yellow-400/[0.04]`, `border-y border-yellow-400/10`), full bleed (`-mx-6 px-6`), single line, not dismissible.
- [x] T8.4 — `role="note"` + `aria-live="polite"`.
- [x] T8.5 — Commit deferred to UI batch.

**Acceptance**: banner renders on every page load; visible above hero.

---

## T9 — Hero changes (R8)

- [x] T9.1 — Hero badge text replaced; old hardcoded `'GLM-5 × Claude 4.6 × Gemini 3.5'` removed.
- [x] T9.2 — `useEffect` added to fetch `/api/agent-card` once and store in `agentCard` state.
- [x] T9.3 — `heroBadge` derives from `agentCard.models.{analyst|validator|arbiter}.model` with → arrows; fallback `'Multi-model adversarial consensus'` when card unavailable.
- [x] T9.4 — Hero descriptive line updated. Removed `'market confirmed every call'`. New: `'... reasoning step. {x}/{y} proposals blocked by validator before execution.'`.
- [x] T9.5 — Tooltips added on all 3 hero stat tiles via `title` attribute (On-Chain Proofs / Trades Blocked / Safety Rate).
- [x] T9.6 — Commit deferred to UI batch.

**Acceptance**: page reads agent-card; if missing, falls back gracefully.

---

## T10 — Agent Performance section rewrite (R4)

- [x] T10.1 — Section heading changed to `Agent Performance · Lifetime aggregate (agentId=0)`.
- [x] T10.2 — Tile sources rewired:
  - Reputation Score → `reputationData.normalizedScore`
  - Win Rate → `perfData.winRate.toFixed(1)%` (real, derived from outcomes; previous source was approval rate mislabeled as winRate)
  - Settled Outcomes → `perfData.settledCount`
  - Cumulative PnL → `perfData.cumulativePnlBps` formatted as `+1216 bps` / `-N bps` with color tone
  - W/L Ratio → `${goodCallCount} / ${badCallCount}` from `perfData`
- [x] T10.3 — `Lifetime` micro-badge above each value.
- [x] T10.4 — Footer rewritten: `Circuit breaker: 3 consecutive errors → pause` (real, in agentCron.js) · `Validator gate: R:R ≥ 1.5, risk ≤ 75` (real, in multiAgent.js) · `source` link to repo.
- [x] T10.5 — Verified `agentCron.js` has `MAX_CONSECUTIVE_ERRORS=3` and `MAX_DAILY_CYCLES=288`. Tooltip mentions both.
- [x] T10.6 — Dropped `Kill Switch -5% NAV` claim (not implemented in code).
- [x] T10.7 — `—` rendered for null values; defensive `?? '—'` everywhere.
- [x] T10.8 — Commit deferred to UI batch.

**Acceptance**: every tile traceable to a real source; no hardcoded numbers; W/L is actually wins/losses, not approvals/rejections.

---

## T11 — Vault Funding panel relabel (R5)

- [x] T11.1 — Heading: `Vault Funding` → `Agent Wallet · Operator Account`.
- [x] T11.2 — Row `Vault Balance` → `Agent EOA Balance` shows `{mnt} MNT · {meth} mETH`.
- [x] T11.3 — Removed row `Total Deployed: N× Decisions` (semantic mismatch — decisions ≠ capital).
- [x] T11.4 — Added row `Custody Model: EOA · custodial demo` with explanatory tooltip.
- [x] T11.5 — Added row `Vault Contract: planned · spec in progress`.
- [x] T11.6 — Active Strategy block kept, added `cached · last update <RelativeTime/>` from `/api/strategy.lastUpdated`.
- [x] T11.7 — Bottom CTA replaced: `Demo capital · ~$X` + `Vault contract pattern in development`.
- [x] T11.8 — Commit deferred to UI batch.

**Acceptance**: panel no longer claims "Vault Balance" or "Autonomous"; clearly states EOA + demo capital.

---

## T12 — AI Reasoning ticker honest-labelling (R6)

- [x] T12.1 — Header `LIVE` → `Example · static` with explanatory `title` tooltip.
- [x] T12.2 — Animated ticker retained.
- [x] T12.3 — Caption added below ticker linking to `/proof-explorer`.
- [x] T12.4 — Yellow-toned indicator replaces green-pulse `LIVE`.
- [x] T12.5 — Commit deferred to UI batch.

**Acceptance**: no "LIVE" claim on a hardcoded ticker.

---

## T13 — Live Agent Pipeline freshness label (R7)

- [x] T13.1 — Caption shows `Mantle Mainnet · last cycle <RelativeTime/>` from `health.lastCycleTimestamp`.
- [x] T13.2 — When `lastCycleAge > 600`, idle banner appears above LiveTerminal with mode and freshness.
- [x] T13.3 — Single `/api/health` polling effect in `page.tsx` (60s interval), shared via `health` state.
- [x] T13.4 — Commit deferred to UI batch.

**Acceptance**: caption shows real freshness; idle banner appears when cycle older than 10m.

---

## T14 — Evolution Timeline panel replacement (R9)

- [x] T14.1 — `EVOLUTION_STEPS` constant deleted from `page.tsx`.
- [x] T14.2 — Section content replaced: short paragraph noting prompt-evolution module exists but is disabled, with version from agent-card and source links.
- [x] T14.3 — Header subtitle: `Module exists · currently disabled in production`.
- [x] T14.4 — Commit deferred to UI batch.

**Acceptance**: no fake `0x2a4f...2a4f` style hashes anywhere on the page.

---

## T15 — Footer / Contracts list overhaul (R12)

- [x] T15.1 — Footer iterates over imported `frontend/app/data/contracts.json`.
- [x] T15.2 — Each row: name (with role tooltip), truncated address, Sourcify badge (`✓ verified` for full, `~ partial`, `not verified`), Mantle Explorer link.
- [x] T15.3 — Router row honestly labeled `Router (deployed; not yet wired into agent execution path)` and `not verified` (Sourcify status: none).
- [x] T15.4 — Commit deferred to UI batch.

**Acceptance**: footer reflects honest contract roles; verifiable Sourcify links.

---

## T16 — `/api/strategy` minor tweak

- [x] T16.1 — Added `dataScope: 'agent-lifetime'` field.
- [x] T16.2 — Added `cached: true` flag; `lastUpdated` already returned and used by frontend label.
- [x] T16.3 — Commit deferred to UI batch.

**Acceptance**: response includes scope label that frontend can render.

---

## T17 — Verification pass

- [x] T17.1 — `cd frontend && npm run build` — passes (15 routes).
- [x] T17.2 — Lint shows 50 preexisting baseline issues; **none in files we touched** (`api/health`, `api/agent-card`, `api/performance`, `api/strategy`, `lib/time.tsx`, `components/RiskMascot.tsx`, `page.tsx` modifications).
- [x] T17.3 — `npm run check:sourcify` — 7/7 contracts match snapshot.
- [x] T17.4 — Smoke-test against dev server: all 6 used endpoints return HTTP 200.
- [x] T17.5 — Honest-state checklist: numeric stats traceable, live badges have freshness, `Autonomous` claim gated by /api/health, no "running 24/7" copy, agent-wallet labeled as EOA. ✓
- [x] T17.6 — `git grep` for `TODO|FIXME|hardcoded|0xdeadbeef|fake-tx-hash-pattern` in modified files: clean. Single hit on the word `hardcoded` is in agent-card route comment explaining what we **stopped** doing.
- [ ] T17.7 — Vercel preview deploy: deferred until repository state is committed.
- [x] T17.8 — All foundation/UI tasks tracked complete in this file.

**Acceptance**: build green, lint green, all design checklist items pass, no fake data on page.

---

## Dependencies between tasks

```
T1 ──┐
     ├─→ T17 (verification)
T2 ──┴─→ T7 ─→ T13 ─→ T17
T3 ──→ T7, T13, T17
T4 ──→ T9, T17
T5 ──→ T10, T17
T6 ──→ T15, T17
T8, T11, T12, T14 — independent of each other; each needs T2 helper for time labels
T16 — independent
```

T1, T2, T3, T4, T5, T6 can ship in any order (or all in one PR). T7-T15 depend on the API and helpers. T17 is final.

If shipping as a single PR: keep commit history in the order T1 → T17 for readability.

If splitting: ship T1+T2+T3+T4+T5+T6 first (foundation), then T7-T15 (UI), then T17.

## Out-of-scope reminders

This spec does NOT:
- Re-enable prompt evolution (separate spec).
- Add the vault contract (separate spec).
- Set up continuous cron (separate spec).
- Compute per-cycle VaR (deferred; mascot has no VaR display).
- Rebuild /challenge (separate spec).
- Add Discipline Layer UI (separate spec).

## Estimated effort

- Foundation (T1-T6): 2-3h.
- UI tasks (T7-T15): 4-6h.
- Verification (T17): 1h.

Total: ~1 working day for solo dev. Aligns with day-1 sprint plan.
