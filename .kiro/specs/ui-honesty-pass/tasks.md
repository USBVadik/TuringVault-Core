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

- [ ] T7.1 — Create `frontend/app/components/RiskMascot.tsx` per design C1.
- [ ] T7.2 — Component fetches `/api/health` on mount and every 60s.
- [ ] T7.3 — Component derives state via `deriveState(h)` and renders `🟢 Active`, `🟡 Idle`, `🔴 Offline` with `<RelativeTime/>`.
- [ ] T7.4 — Strip out `varLevel` prop entirely (no VaR display this iteration).
- [ ] T7.5 — `aria-label="Agent status"` on the wrapper.
- [ ] T7.6 — In `frontend/app/page.tsx`: remove inline `RiskMascot` definition; import from new file; replace `<RiskMascot varLevel={95} />` with `<RiskMascot />`.
- [ ] T7.7 — Manual test: temporarily rename `data/loop_progress.json.bak` (well, file is now deleted, but mock the failure path); verify mascot shows 🔴 Offline.
- [ ] T7.8 — Commit: `refactor(frontend): extract RiskMascot, wire to /api/health`.

**Acceptance**: mascot reflects real liveness; no hardcoded `varLevel={95}`.

---

## T8 — Demo Mode banner

- [ ] T8.1 — In `page.tsx`, immediately under `<header>` block, insert the banner div per design C5.
- [ ] T8.2 — Banner text: `Demo Mode · No public deposits · Stats below are agent-lifetime aggregate (agentId=0)`.
- [ ] T8.3 — Styling: subtle yellow tone, full width, 1-2 lines max, not dismissible v1.
- [ ] T8.4 — `aria-live="polite"`.
- [ ] T8.5 — Commit: `feat(frontend): add Demo Mode banner under header`.

**Acceptance**: banner renders on every page load; visible above hero.

---

## T9 — Hero changes (R8)

- [ ] T9.1 — In `page.tsx`, replace the hardcoded badge text `'ERC-8004 Identity · GLM-5 × Claude 4.6 × Gemini 3.5 · Mantle Mainnet'` with dynamic text from `/api/agent-card`.
- [ ] T9.2 — Add a `useEffect` to fetch `/api/agent-card` once, store in `agentCardData`.
- [ ] T9.3 — Compose the badge: `ERC-8004 Identity · ${analyst} → ${validator} → ${arbiter} · Mantle Mainnet`. Fallback (when null): `ERC-8004 Identity · Multi-model adversarial consensus · Mantle Mainnet`.
- [ ] T9.4 — Replace hero descriptive line. Old: `... blocked — market confirmed every call.` New: `... reasoning step. {x}/{y} proposals blocked by validator before execution.`
- [ ] T9.5 — Add tooltips (via `title` attr or simple `<span title>`) to the 3 hero stat tiles per R8.3.
- [ ] T9.6 — Commit: `feat(frontend): hero copy and badges sourced from agent-card.json`.

**Acceptance**: page reads agent-card; if missing, falls back gracefully.

---

## T10 — Agent Performance section rewrite (R4)

- [ ] T10.1 — In `page.tsx`, change section heading to `Agent Performance · Lifetime aggregate (agentId=0)`.
- [ ] T10.2 — Update tile sources per design C5 table:
  - Reputation Score → `/api/reputation.normalizedScore`
  - Win Rate → `/api/performance.winRate` formatted to 1 decimal `%` (label changed from current — was actually approval rate)
  - Settled Outcomes → `/api/performance.settledCount`
  - Cumulative PnL → `/api/performance.cumulativePnlBps` formatted as `+1216 bps` / `-23 bps`
  - W/L Ratio → `${goodCallCount} / ${badCallCount}` (sourced from `/api/performance`)
- [ ] T10.3 — Add `Lifetime` micro-badge above each tile value.
- [ ] T10.4 — Replace footer line. Old: `Circuit Breaker · Kill Switch · VaR Gate · profitable decisions verified`. New: `Validator gate: configurable · Cron status: <Mode/> · Source` (only items truly wired).
- [ ] T10.5 — Verify in `agentCron.js` that `MAX_CONSECUTIVE_ERRORS` (3) and `MAX_DAILY_CYCLES` (288) are real; mention them in tooltip if shown.
- [ ] T10.6 — Drop the `Kill Switch: -5% NAV` claim — not implemented.
- [ ] T10.7 — Render `—` if any number is null.
- [ ] T10.8 — Commit: `feat(frontend): rewrite Agent Performance to use real winRate from outcomes`.

**Acceptance**: every tile traceable to a real source; no hardcoded numbers; W/L is actually wins/losses, not approvals/rejections.

---

## T11 — Vault Funding panel relabel (R5)

- [ ] T11.1 — Heading: `Vault Funding` → `Agent Wallet · Operator Account`.
- [ ] T11.2 — Row `Vault Balance` → `Agent EOA Balance` (shows MNT + mETH).
- [ ] T11.3 — Remove row `Total Deployed: N× Decisions`.
- [ ] T11.4 — Add row `Custody Model: Agent EOA (custodial demo)`.
- [ ] T11.5 — Add row `Vault Contract: planned` with link `<a href="#" title="See spec shares-vault-contract">spec</a>`.
- [ ] T11.6 — Active Strategy block: keep, add `Cached · last update <RelativeTime/>` label using `lastUpdated` from `/api/strategy`.
- [ ] T11.7 — Bottom CTA: replace with `Demo capital · ~$X · Vault contract pattern in development`.
- [ ] T11.8 — Commit: `feat(frontend): rebrand Vault Funding panel as honest Agent Wallet`.

**Acceptance**: panel no longer claims "Vault Balance" or "Autonomous"; clearly states EOA + demo capital.

---

## T12 — AI Reasoning ticker honest-labelling (R6)

- [ ] T12.1 — In `page.tsx` AI Reasoning panel header: replace `LIVE` indicator with `Example reasoning steps · static`.
- [ ] T12.2 — Keep the animated `REASONING_LINES` ticker.
- [ ] T12.3 — Below the ticker, add caption: `Example pipeline lines. Real per-cycle reasoning: <a href="/proof-explorer">Proof Explorer</a> (IPFS-pinned per decision).`
- [ ] T12.4 — Remove green-pulse `LIVE` styling on this panel only (hero stays).
- [ ] T12.5 — Commit: `fix(frontend): label AI Reasoning ticker as static example`.

**Acceptance**: no "LIVE" claim on a hardcoded ticker.

---

## T13 — Live Agent Pipeline freshness label (R7)

- [ ] T13.1 — In `page.tsx`, replace caption `'Real execution data from Mantle Mainnet'` with: `Mantle Mainnet · last cycle <RelativeTime ts={health.lastCycleTimestamp}/>`.
- [ ] T13.2 — When `health.lastCycleAge > 600`, render banner above LiveTerminal: `⚠ Agent idle for <RelativeTime/>. Last cycle: <ts/>. Cron mode: <mode/>.`
- [ ] T13.3 — Wire `/api/health` data into `page.tsx` (one shared `useEffect` + state for `health`).
- [ ] T13.4 — Commit: `feat(frontend): show freshness on Live Agent Pipeline; idle banner when stale`.

**Acceptance**: caption shows real freshness; idle banner appears when cycle older than 10m.

---

## T14 — Evolution Timeline panel replacement (R9)

- [ ] T14.1 — Delete `EVOLUTION_STEPS` constant from `page.tsx`.
- [ ] T14.2 — Replace section content with the static one-paragraph note + source link per design C5.
- [ ] T14.3 — Header subtitle: `Module exists · currently disabled in production`.
- [ ] T14.4 — Commit: `fix(frontend): replace fabricated evolution timeline with disabled-module note`.

**Acceptance**: no fake `0x2a4f...2a4f` style hashes anywhere on the page.

---

## T15 — Footer / Contracts list overhaul (R12)

- [ ] T15.1 — In `page.tsx` footer: replace inline `Object.entries(CONTRACTS)` rendering with iteration over imported `frontend/app/data/contracts.json`.
- [ ] T15.2 — Each row shows: name, role tag, truncated address, Sourcify badge `✓ verified` or absent if false, link to Mantle explorer.
- [ ] T15.3 — Router row explicitly states `(deployed; not yet wired into agent execution path)`.
- [ ] T15.4 — Commit: `feat(frontend): footer contracts list with role tags + sourcify status`.

**Acceptance**: footer reflects honest contract roles; verifiable Sourcify links.

---

## T16 — `/api/strategy` minor tweak

- [ ] T16.1 — Add `dataScope: 'agent-lifetime'` field to response.
- [ ] T16.2 — Add `cached: true` flag and `lastUpdated` (already returned) used by frontend label.
- [ ] T16.3 — Commit: `chore(api): add dataScope label to /api/strategy`.

**Acceptance**: response includes scope label that frontend can render.

---

## T17 — Verification pass

- [ ] T17.1 — `cd frontend && npm run build` — must pass.
- [ ] T17.2 — `cd frontend && npm run lint` — no new warnings beyond pre-existing baseline.
- [ ] T17.3 — `npm run check:sourcify` — all entries still match (manual sanity).
- [ ] T17.4 — Open `localhost:3000`. Visually verify each section against the design checklist below.
- [ ] T17.5 — Verify `no-lying-about-state.md` checklist passes:
   - Numeric stats traceable to source ✓
   - Live badges have freshness ✓
   - Autonomous claim is gated by /api/health ✓
   - No "running 24/7" copy ✓
   - Wallet stats scope clearly labelled ✓
- [ ] T17.6 — `git grep -nE 'TODO|FIXME|hardcoded|0xdeadbeef'` in `frontend/app/page.tsx` → zero new occurrences.
- [ ] T17.7 — Vercel preview deploy: trigger via push, verify `/api/health` returns degraded gracefully and mascot shows 🔴.
- [ ] T17.8 — Commit empty if all green: `chore: ui-honesty-pass verification complete`.

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
