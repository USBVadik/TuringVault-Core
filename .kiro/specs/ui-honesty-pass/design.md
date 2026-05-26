# UI Honesty Pass — Design

## Decisions taken (closes open questions from requirements.md)

| Q | Decision | Rationale |
|---|---|---|
| Q1 EVOLUTION_STEPS | **Hide** the timeline; replace with one-line note + link to source. | The current panel shows fabricated `txHash` strings. Real prompt evolution is bypassed in `multiAgent.js`. Faking on-chain history violates `no-lying-about-state`. Re-enable only after `agent-reasoning-quality` spec restores prompt evolution and writes real IPFS CIDs. |
| Q2 performance.json | **Delete** the file; recompute everything from `outcomes.json`. | The file contains a phantom $3 → $42 NAV jump and produces `Sharpe: 30.92`. Cleaner to drop and let `continuous-cron-and-health` spec rebuild a real performance tracker afterwards. |
| Q3 Demo Mode banner | **Yes**, single discreet line under header. | Sets honest expectations before the user reads any number. Closes a blast radius if a depositor lands on the page. |
| Q4 Hero badge models | **Verify against `agent-card.json`** in this spec, lock the text accordingly. | Cheap (one read), avoids drift. If the card is itself wrong, file as a follow-up; do not propagate to UI. |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                   FRONTEND (Next.js 15 app router)                  │
│                                                                      │
│   page.tsx ──┬─ /api/decisions ───── ValidationRegistry RPC          │
│              │                       (live, on-chain)                │
│              ├─ /api/reputation ──── ReputationRegistry RPC          │
│              │                       (live, on-chain)                │
│              ├─ /api/performance ─── computed from outcomes.json     │
│              │                       (cached, file-derived)          │
│              ├─ /api/strategy ────── outcomes + position_state.json  │
│              │                       (cached, file-derived)          │
│              ├─ /api/health ────────  loop_progress.json mtime +     │
│              │   (NEW)                outcomes.json freshness +      │
│              │                       Mantle latest block             │
│              └─ /api/agent-card ────  agent-card.json (NEW)          │
│                  (NEW)                read-only, drives hero badges  │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│            BACKEND DATA SOURCES (read-only for this spec)            │
│                                                                      │
│   src/data/outcomes.json     — settled[] with pnlBps, outcome       │
│   src/data/position_state.json — current position                    │
│   data/loop_progress.json    — mtime = last cycle freshness          │
│   assets/agent-card.json     — agent identity / model declaration    │
│   Mantle RPC (https://rpc.mantle.xyz) — block height, contract reads │
└─────────────────────────────────────────────────────────────────────┘
```

The whole spec is a series of **small replacements** in the frontend layer plus two new tiny `/api/*` endpoints. No backend orchestrator changes. No contract calls beyond what already exists.

## Component-by-component design

### C1 — `RiskMascot` (R1)

**Status before**: hardcoded `varLevel={95}` in `page.tsx`, always 🟡 Supervised.
**Status after**: standalone component in `frontend/app/components/RiskMascot.tsx`, polls `/api/health` every 60 s.

```tsx
// frontend/app/components/RiskMascot.tsx
type Health = {
  lastCycleAge: number | null;   // seconds, null = unreachable
  mode: 'manual' | 'cron-github-actions' | 'cron-vps' | 'unknown';
};

function deriveState(h: Health | null) {
  if (!h || h.lastCycleAge === null) return 'offline';
  if (h.lastCycleAge < 600) return 'active';      // <10m
  if (h.lastCycleAge < 3600) return 'idle';       // <1h
  return 'offline';                                // >=1h
}

const DISPLAY = {
  active:  { emoji: '🟢', label: 'Active',   tone: 'green'  },
  idle:    { emoji: '🟡', label: 'Idle',     tone: 'yellow' },
  offline: { emoji: '🔴', label: 'Offline',  tone: 'red'    },
};
```

- No VaR figure unless `health.lastVarBps != null` (R1.5). For now, no `lastVarBps` field is exported by `/api/health` — VaR display is **deferred** to `continuous-cron-and-health` spec.
- The component renders `<freshness>` like `last cycle 7m ago`. Use the `formatRelativeTime` helper from C7.
- Removes the `varLevel` prop entirely.

### C2 — `/api/health` (R2)

**New file**: `frontend/app/api/health/route.ts`.

Reads (in order, all best-effort):
1. `data/loop_progress.json` mtime → `lastWriteFromProgress`.
2. `src/data/outcomes.json` → newest of `pending[*].recordedAt` and `settled[*].settledAt` → `lastWriteFromOutcomes`.
3. `lastCycleTimestamp = max(lastWriteFromProgress, lastWriteFromOutcomes)` (whichever is newer).
4. Mantle RPC `eth_blockNumber` → `chainBlockHeight`.
5. ENV `AGENT_RUN_MODE` (default `unknown`).

Counts `cyclesSucceeded24h` by filtering `outcomes.settled` and `outcomes.pending` for `recordedAt > now - 24h` (union, deduped by id). `cyclesFailed24h` is **not** computed in this spec — return `null` (the field exists for forward-compat).

Response shape:

```json
{
  "status": "ok",
  "lastCycleTimestamp": "2026-05-23T17:01:19.815Z",
  "lastCycleAge": 7421,
  "cyclesSucceeded24h": 12,
  "cyclesFailed24h": null,
  "mode": "manual",
  "chainBlockHeight": 95657123,
  "dataScope": "agent-lifetime"
}
```

On error: HTTP 200 with `{ status: 'degraded', error: '<msg>', lastCycleAge: null, mode: 'unknown' }`.

Cache: `dynamic = 'force-dynamic'`, `revalidate = 0`. Response includes `Cache-Control: no-store` header.

Security: never read `.env`. Never log `process.env.PRIVATE_KEY`. Use `path.resolve(process.cwd(), '../...')` carefully — Vercel serverless puts cwd at the function root, so paths must resolve from `frontend/.next/...` upwards. Concretely the existing `/api/strategy/route.ts` does:
```ts
const statePath = path.resolve(process.cwd(), '../src/data/position_state.json');
```
Apply the same pattern. If file unreachable in production (Vercel doesn't bundle backend `data/`), endpoint returns `lastCycleAge: null`, the mascot shows 🔴 Offline. That is *correct* behavior — it tells the truth about prod.

### C3 — `/api/performance` rewrite (R3, R10)

**Replaces existing route entirely.** The new logic:

1. On-chain reads (kept):
   - Wallet `0xDC78…fb5a` MNT balance
   - mETH balance via ERC20 `balanceOf`
   - CoinGecko prices for `mantle` and `mantle-staked-ether`
   - NAV = `mnt * mntPrice + meth * ethPrice`

2. From `outcomes.json` settled[]:
   ```ts
   const settled = data.settled ?? [];
   const settledCount = settled.length;
   const goodCallCount    = settled.filter(o => o.outcome === 'GOOD_CALL').length;
   const correctBlockCount= settled.filter(o => o.outcome === 'CORRECT_BLOCK').length;
   const badCallCount     = settled.filter(o => o.outcome === 'BAD_CALL').length;
   const missedAlphaCount = settled.filter(o => o.outcome === 'MISSED_ALPHA').length;
   const cumulativePnlBps = settled.reduce((a, o) => a + (o.pnlBps ?? 0), 0);
   const winRate = settledCount === 0 ? null
     : ((goodCallCount + correctBlockCount) / settledCount) * 100;
   ```

3. **Drop**: `sharpe`, `maxDrawdown`, `recoveryHours`, `hoursTracked`, `totalReturn`. Do not return them. The home page must remove the corresponding tiles.

4. Response shape:

```json
{
  "nav": 13.42,
  "mnt": 17.4,
  "meth": "0.000823",
  "mntPrice": 0.72,
  "ethPrice": 2057.82,
  "settledCount": 36,
  "winRate": 47.2,
  "goodCallCount": 5,
  "correctBlockCount": 12,
  "badCallCount": 6,
  "missedAlphaCount": 11,
  "cumulativePnlBps": 1216,
  "lastSettlementAt": "2026-05-23T16:30:06.995Z",
  "dataScope": "agent-lifetime"
}
```

Error: HTTP 200 `{ error, nav: null, settledCount: null, ... }`. Frontend renders `—` for any null.

**File deletion**: `data/performance.json` is removed in this commit. The codepath `src/metrics/performanceTracker.js` writes to it; that won't break — the writer creates the dir/file as needed (`fs.mkdirSync(..., { recursive: true })` already in code). New file will be regenerated by orchestrator going forward, but we don't read it in `/api/performance` anymore.

### C4 — `/api/agent-card` (new, supports R8)

**New file**: `frontend/app/api/agent-card/route.ts`.

Reads `assets/agent-card.json` from disk. Returns the relevant fields:

```json
{
  "version": "2.1.1",
  "models": {
    "analyst":  "z.ai GLM-5",
    "validator":"Anthropic Claude 4.6",
    "arbiter":  "Google Gemini 3.5 Flash"
  },
  "ipfsCid": "Qm...",
  "stats": { ... }
}
```

Frontend uses `models.analyst/validator/arbiter` to compose the hero badge instead of hardcoded `'GLM-5 × Claude 4.6 × Gemini 3.5'`. If the file is missing or fields are absent, badge falls back to a generic `'Multi-model adversarial consensus'` (no fake specifics).

If the agent-card states a model that doesn't match what's actually wired in `multiAgent.js`, that's a separate problem solved in spec `agent-reasoning-quality` — this spec only ensures UI mirrors the card, not the reality of the card. (We document the gap explicitly in the FAQ section of the dashboard.)

### C5 — `page.tsx` changes (rest of R3–R12)

Concrete edits to `frontend/app/page.tsx`:

#### Hero (R8)

Replace:
```tsx
<span ...>ERC-8004 Identity · GLM-5 × Claude 4.6 × Gemini 3.5 · Mantle Mainnet</span>
```
With dynamic text from `/api/agent-card`:
```tsx
<span ...>ERC-8004 Identity · {models.analyst} → {models.validator} → {models.arbiter} · Mantle Mainnet</span>
```

Replace hero descriptive line:
```tsx
"Multi-model adversarial consensus with on-chain proof of every reasoning step.
{x}/{y} dangerous trades blocked — market confirmed every call."
```
With:
```tsx
"Multi-model adversarial consensus with on-chain proof of every reasoning step.
{x}/{y} proposals blocked by validator before execution."
```

Hero stats stay 3-tile; add `aria-label` and tooltip text per R8.3.

#### Demo Mode banner (Q3)

New element directly under `<header>`:
```tsx
<div className="text-center text-[10px] text-yellow-400/70 bg-yellow-400/[0.04] border-y border-yellow-400/10 py-2">
  Demo Mode · No public deposits open · Vault contract pattern in development.
  Lifetime stats below are aggregate across the agent's history (agentId=0).
</div>
```
Persistent (not dismissible for v1; can be later).

#### Agent Performance section (R4)

Heading:
```tsx
<h2>Agent Performance · Lifetime aggregate (agentId=0)</h2>
```

5 tiles, sourced from `/api/performance`:

| Tile | Source | Format | Tooltip |
|---|---|---|---|
| Reputation Score | `/api/reputation.normalizedScore` | int 0-100 | `On-chain reputation NFT score` |
| Win Rate | `/api/performance.winRate` | `47.2%` | `(Good Call + Correct Block) / Settled` |
| Settled Outcomes | `/api/performance.settledCount` | int | `Resolved decisions in outcomes.json` |
| Cumulative PnL | `/api/performance.cumulativePnlBps` | `+1216 bps` | `Sum of pnlBps across settled` |
| W/L Ratio | `goodCallCount / badCallCount` | `5 / 6` | `Good Calls / Bad Calls` |

Each tile has `Lifetime` micro-badge above its value.

Footer line — replace current with:
```tsx
<span>Validator gate: configurable in src/config/constants.js</span>
<span>·</span>
<span>Cron status: <Mode/></span>  // pulled from /api/health.mode
<span>·</span>
<a href="https://github.com/USBVadik/TuringVault-Core/blob/main/src/orchestrator/multiAgent.js#L...">Source</a>
```

Drop the kill-switch line (`-5% NAV triggers full stop`) — that guard is not implemented in code; verify in `agentCron.js` (only `MAX_CONSECUTIVE_ERRORS` and `MAX_DAILY_CYCLES` exist). If any guard is real, keep with link.

#### Vault Funding panel (R5)

Replace heading `Vault Funding` → `Agent Wallet · Operator Account`.

Body:
- Row `Agent EOA Balance`: `{vaultData?.mnt} MNT` + `{vaultData?.meth} mETH`.
- Row `Custody Model: Agent EOA (custodial demo)`.
- Row `Vault Contract: planned`. Link to spec `shares-vault-contract`.
- Active Strategy block stays (regime, channel, position, R:R, VaR gate) — already sourced from `/api/strategy`, that endpoint reads `position_state.json` honestly. Add `Cached · last update <Xs ago>` label.

Bottom CTA replaced with:
```tsx
<div className="text-center text-[9px] text-white/30">
  Demo capital · {vaultData ? `~$${vaultData.nav.toFixed(2)}` : '—'} · Vault contract pattern in development
</div>
```

#### AI Reasoning ticker (R6)

Header:
```tsx
<span>AI Reasoning</span>
<span className="ml-auto text-yellow-400/40">Example reasoning steps · static</span>
```

Below the ticker, add caption:
```tsx
<p className="text-[10px] text-white/30 mt-2">
  Example pipeline lines. Real per-cycle reasoning is on the
  <a href="/proof-explorer">Proof Explorer</a>, IPFS-pinned per decision.
</p>
```

The animated ticker stays (visual interest), but no longer claims `LIVE`.

#### Live Agent Pipeline (R7)

Caption changes from `Real execution data from Mantle Mainnet` to:
```tsx
<span>
  Mantle Mainnet · last cycle <RelativeTime ts={health?.lastCycleTimestamp}/>
</span>
```

When `health.lastCycleAge > 600s`, show banner above terminal:
```tsx
<div className="bg-yellow-400/[0.04] border border-yellow-400/20 px-3 py-2 mb-3 text-xs">
  ⚠ Agent idle for <RelativeTime ago/>. Last cycle: <ts/>. Cron mode: <mode/>.
</div>
```

#### Evolution Timeline (R9 / Q1)

Remove `EVOLUTION_STEPS` constant. Replace whole section content:

```tsx
<section className="glass-card p-8 mb-8">
  <div className="flex items-center gap-3 mb-2">
    <GitBranch className="w-4 h-4 text-purple-400" />
    <span className="...">On-Chain Prompt Evolution</span>
    <span className="ml-auto ...">Module exists · currently disabled in production</span>
  </div>
  <p className="text-xs text-white/35 mb-4">
    The agent's prompt-evolution module (<code>src/evolution/promptEvolution.js</code>)
    can mutate the analyst system prompt based on settlement outcomes and pin each version
    to IPFS. It is currently disabled at runtime to stabilize JSON output formatting
    (see <code>multiAgent.js</code>). The pinned base prompt is v2.1.1.
  </p>
  <a href="https://github.com/USBVadik/TuringVault-Core/blob/main/src/evolution/promptEvolution.js"
     className="text-xs text-purple-400/70">View source</a>
</section>
```

#### Footer / Contracts (R12)

Each contract link includes:
- Name + role tag
- Truncated address
- Sourcify badge: `✓ verified` if reachable

For Sourcify check, two options:
- **(a)** Server-side `/api/sourcify-status` that pings `https://repo.sourcify.dev/contracts/full_match/5000/<addr>/` for each. Cache response 1h.
- **(b)** Build-time generated JSON listing verified status, no runtime check.

Choose **(b)**: simpler, zero runtime dependency. We build a static `frontend/app/data/contracts.json`:

```json
[
  { "name": "TuringVaultIdentity", "role": "ERC-8004 Identity Registry",
    "address": "0x6f86...", "sourcify": true },
  { "name": "TuringVaultDecisionLog", "role": "Decision Log",
    "address": "0x7bCd...", "sourcify": true },
  { "name": "TuringVaultRouter", "role": "Router (deployed; not yet wired into agent execution)",
    "address": "0x8187...", "sourcify": true },
  { "name": "TuringVaultValidationRegistry", "role": "Multi-Agent Validation Registry",
    "address": "0x6841...", "sourcify": true },
  { "name": "TuringVaultIdentity (alt)", "role": "...",
    "address": "0x582E...", "sourcify": true },
  { "name": "ReputationRegistry", "role": "ERC-8004 Reputation Registry",
    "address": "0xC781...", "sourcify": true }
]
```

Verified once during this spec implementation by running `curl -sI` against each. Stored in repo. Re-checked manually only if any contract redeploys (which we explicitly do NOT plan).

### C6 — `EVOLUTION_STEPS` removal

Just delete the constant from `page.tsx`. No further references after C5 changes.

### C7 — Helpers

New file `frontend/app/lib/time.ts`:

```ts
export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ts = new Date(iso).getTime();
  if (isNaN(ts)) return '—';
  const ageMs = Date.now() - ts;
  if (ageMs < 0) return 'just now';
  const s = Math.round(ageMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
```

`<RelativeTime ts ago>` component re-renders every 30s while mounted.

## Data flow examples

### Example 1 — judge opens dashboard, cron is dead

1. Page mounts. `/api/health` → `{ lastCycleAge: 86400, mode: 'manual' }`.
2. RiskMascot → 🔴 Offline.
3. Hero stats from `/api/decisions` still load (those are on-chain forever).
4. Live Agent Pipeline shows banner `⚠ Agent idle for 24h. Last cycle: 2026-05-25T...`.
5. Performance section shows lifetime aggregate (always available).
6. Demo Mode banner under header is constant.

Result: judge sees the project is well-engineered but currently idle. No false claims. This is honest and acceptable.

### Example 2 — judge opens during active showcase cycles

1. `/api/health` → `lastCycleAge: 23s`.
2. RiskMascot 🟢 Active · last cycle 23s ago.
3. New Decision toast fires when `totalDecisions` increments.
4. Live Agent Pipeline shows fresh data.
5. Same lifetime aggregate stats below.

### Example 3 — Vercel can't read backend `data/` files

1. `/api/health` returns `lastCycleAge: null`.
2. RiskMascot 🔴 Offline.
3. `/api/strategy` returns its degraded response (already handles missing file).
4. Hero stats and `/api/reputation` still work (on-chain).

This is the realistic Vercel deployment case — the frontend repo doesn't ship with backend `src/data/*.json`. Means: in production, only on-chain numbers are live; everything else is "Offline". Spec `continuous-cron-and-health` solves this by either (a) shipping a small public JSON to Vercel via build hook, or (b) writing a public read-only S3 bucket the API reads. Out of scope here.

## Files touched

```
NEW:
  frontend/app/api/health/route.ts
  frontend/app/api/agent-card/route.ts
  frontend/app/components/RiskMascot.tsx
  frontend/app/lib/time.ts
  frontend/app/data/contracts.json

MODIFIED:
  frontend/app/page.tsx
    - extract RiskMascot to its own file (was inline)
    - replace hero descriptive line
    - replace agent-card hero badge with dynamic text
    - delete EVOLUTION_STEPS constant + section content
    - replace Vault Funding panel content
    - relabel AI Reasoning panel
    - relabel Live Agent Pipeline caption
    - replace Agent Performance tiles content (winRate source)
    - replace footer contracts list rendering
    - add Demo Mode banner
  frontend/app/api/performance/route.ts
    - rewrite per C3
  frontend/app/api/strategy/route.ts
    - add `dataScope` and `cached` freshness label

DELETED:
  data/performance.json
  data/loop_progress.json   (regenerated by orchestrator next run)

UNCHANGED (verified safe):
  frontend/app/api/decisions/route.ts
  frontend/app/api/reputation/route.ts (label change is in page.tsx, not endpoint)
  frontend/app/api/challenge/route.ts  (separate spec)
  frontend/app/api/market/route.ts
  src/orchestrator/*  (no backend changes)
  contracts/*  (no contract changes)
```

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Vercel build fails because `path.resolve('../src/data/...')` doesn't resolve in the bundled function. | Already ack'd: endpoint returns degraded gracefully. RiskMascot 🔴 Offline is the correct UX for the prod limitation; honest, not broken. |
| Agent card on disk has stale model names. | C4 reads card raw; gap with code-reality is documented. Out-of-scope to fix here. Hero text reflects card; if card is wrong, fix card via `agent-reasoning-quality` spec. |
| Removing tiles weakens "credibility" of the dashboard. | Replacement tiles are still 5; numbers are real. Loss of `Sharpe: 30.92` is *the point* — that figure was a liability. |
| Sourcify might be temporarily down when judges check. | Build-time `contracts.json` decouples our display from Sourcify uptime. We still link to Sourcify for direct verification. |
| Demo Mode banner could be perceived as weakness. | Pair with the strong frame: *consensus pipeline + ERC-8004 + Discipline Layer*. Banner says "no public deposits", not "no live agent". |

## Test plan

Manual on local + Vercel preview:

1. `npm run build` in `frontend/` — must pass.
2. `npm run lint` — no new warnings.
3. Local dev: `npm run dev`, page loads with all 5 endpoints reachable. Mascot shows correct state based on `data/loop_progress.json` mtime.
4. Local dev: `rm data/loop_progress.json && rm src/data/outcomes.json` (temporarily), reload — mascot shows 🔴 Offline. Restore files afterwards.
5. Local dev: connect a wallet, verify `Demo Mode` banner stays present (no per-user numbers shown).
6. Vercel preview: confirm endpoints behave per Example 3.
7. Spot-check each contract row in footer — click links, verify Sourcify URL loads.
8. Open Mantle explorer for `0x6f86…28bD` (Identity); confirm tokenURI fetch in browser works (not strictly required, but good).

No automated tests added in this spec — frontend test infra doesn't exist yet, adding that is its own scope. Per `hackathon-context.md` rule, we don't add tests not strictly necessary.

## Out of scope confirmation

This spec does **not**:
- Re-enable prompt evolution (handled by `agent-reasoning-quality`).
- Add the vault contract or change custody model (handled by `shares-vault-contract`).
- Set up continuous cron / public health monitor (handled by `continuous-cron-and-health`).
- Wire VaR per-decision (handled by `continuous-cron-and-health`).
- Rebuild `/challenge` interactivity (handled by `human-vs-ai-challenge-v2`).
- Add Discipline Layer UI (handled by `discipline-layer-ui`).

It is intentionally narrow: the smallest credible step that makes the dashboard non-falsifiable.
