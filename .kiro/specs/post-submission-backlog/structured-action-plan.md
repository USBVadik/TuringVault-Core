# Structured Action Plan — TuringVault Post-Submission Backlog

**Generated:** 2026-05-28  
**Sources:** Audit reports 05, 06, 08, 09, 10, 12, 13 + consolidated 99 + backlog specs  
**Total items:** 54 (15 P0, 20 P1, 17 P2, 2 P3)  
**P0 status:** All fixed or wont-fix-pre-submission. This plan covers remaining open P1/P2/P3 items.

---

## Frontend

| ID | Sev | Action | File(s) | Est. Time |
|----|-----|--------|---------|-----------|
| FE-01 | P0 | Add interactive hover tooltips to `/backtest` equity curve SVG (show price + PnL per point) | `frontend/app/backtest/page.tsx` | 45 min |
| FE-02 | P1 | Verify all UI consumers of `/api/elfa-snapshot` handle `sentiment: null` gracefully (no crash/blank) | `frontend/app/social/page.tsx`, components consuming elfa data | 20 min |
| FE-03 | P1 | Add skeleton shimmer to `/social` loading state (currently shows "loading…" text) | `frontend/app/social/page.tsx` | 15 min |
| FE-04 | P1 | Make decision log table columns proportional (`grid-template-columns: auto 1fr auto auto 2fr`) | `frontend/app/page.tsx` (decision table section) | 15 min |
| FE-05 | P1 | Add illustrated empty state to `/challenge` (shield icon + subtitle when no attack selected) | `frontend/app/challenge/page.tsx` | 20 min |
| FE-06 | P2 | Define and apply formal 4px/8px spacing scale tokens in CSS vars | `frontend/app/globals.css` | 30 min |
| FE-07 | P2 | Consolidate text opacity to 3 levels (primary 0.95 / secondary 0.6 / muted 0.3) — remove 0.2, 0.25, 0.4 variants | All page.tsx + globals.css | 20 min |
| FE-08 | P2 | Add page transitions via framer-motion or Next.js layout animations | `frontend/app/layout.tsx`, new transition wrapper | 60 min |
| FE-09 | P2 | Standardize max-width to `max-w-[1200px]` across all pages (currently varies: 5xl, 4xl, 1100px) | All sub-page `page.tsx` files | 10 min |
| FE-10 | P2 | Add `stat-card-interactive` hover to `/backtest` StatCards and `/discipline` Tiles | `frontend/app/backtest/page.tsx`, `frontend/app/discipline/page.tsx` | 10 min |
| FE-11 | P2 | Wrap partner bar in horizontal scroll on mobile instead of wrap | `frontend/app/page.tsx` (partner section) | 15 min |

---

## Backend-Pipeline

| ID | Sev | Action | File(s) | Est. Time |
|----|-----|--------|---------|-----------|
| BE-01 | P1 | Add 60s in-memory cache for IPFS tokenURI content in `/api/agent-card` (currently 4550ms) | `frontend/app/api/agent-card/route.ts` | 30 min |
| BE-02 | P1 | Add 30s in-memory cache (or `revalidate=30`) for NAV computation in `/api/strategy` (currently 2113ms) | `frontend/app/api/strategy/route.ts` | 30 min |
| BE-03 | P1 | Fix `rwaAllocation.lastRebalanceAt` to read latest RWA timestamp from outcomes.json | `frontend/app/api/strategy/route.ts` | 20 min |
| BE-04 | P1 | Recompute `normalizedScore` in `/api/reputation` to reflect actual winRate (currently hard-coded 100) | `frontend/app/api/reputation/route.ts` | 20 min |
| BE-05 | P1 | Unify winRate calculation between `/api/performance` (45.1%) and `/api/reputation` (40.9%) — single method | `frontend/app/api/performance/route.ts`, `frontend/app/api/reputation/route.ts` | 30 min |
| BE-06 | P1 | Lower validator approval threshold OR reframe docs as "advisory validator" (never rejects in 20 cycles) | `src/orchestrator/multiAgent.js` or documentation | 45 min |
| BE-07 | P1 | Add GitHub fallback for `position_state.json` reads in `/api/strategy` | `frontend/app/api/strategy/route.ts` | 20 min |
| BE-08 | P1 | Add GitHub fallback for `/api/reasoning` (progress/evolution/intents files) | `frontend/app/api/reasoning/route.ts` | 30 min |
| BE-09 | P1 | Add GitHub fallback for `/api/agent-card` (currently returns null if file missing) | `frontend/app/api/agent-card/route.ts` | 20 min |
| BE-10 | P2 | Add "Elfa Social" to `dataSources` array in IPFS pin metadata | `src/ipfs/storage.js` | 5 min |
| BE-11 | P2 | Confirm `trajectories.json` is actively written or deprecate with docs (17.5h stale) | `src/orchestrator/run-cycle.js`, `src/data/trajectories.json` | 20 min |
| BE-12 | P2 | Confirm `grid_*.json` inactive-by-design; document subsystem status | `src/data/grid_*.json`, README or docs | 10 min |
| BE-13 | P2 | Investigate validator reasoning homogeneity for HOLD decisions (near-identical text) | `src/orchestrator/multiAgent.js` (validator prompt) | 30 min |
| BE-14 | P2 | Document `raw_model_outputs/` purpose and retention policy | `docs/` or README | 10 min |
| BE-15 | P2 | Validate and set appropriate Cache-Control headers on all API routes | All `frontend/app/api/*/route.ts` | 20 min |
| BE-16 | P2 | Tighten `check-secrets.sh` regex to exclude TX hash false positives (`0x[a-f0-9]{64}`) | `scripts/check-secrets.sh` | 10 min |

---

## Cron-Infrastructure

| ID | Sev | Action | File(s) | Est. Time |
|----|-----|--------|---------|-----------|
| CI-01 | P1 | Add external cron trigger (Vercel cron or CF Worker) for reliable hourly cycle (GH Actions at 37% success) | New: `vercel.json` cron config or CF Worker script | 60 min |
| CI-02 | P1 | Add per-stage timing instrumentation to `last-cycle-summary` (detected 340s spike) | `src/orchestrator/run-cycle.js`, `data/last-cycle-summary.json` schema | 30 min |
| CI-03 | P2 | Add `export const dynamic = "force-dynamic"` to 5 missing API routes | `frontend/app/api/backtest/route.ts`, `elfa-snapshot/route.ts`, `evolution/route.ts`, `market/route.ts`, `reasoning/route.ts` | 10 min |
| CI-04 | P2 | Document `/api/proof-explorer` s-maxage=30 caching rationale | `frontend/app/api/proof-explorer/route.ts` (comment) or docs | 5 min |
| CI-05 | P2 | Document Vercel vs GH Actions env var difference as intentional (2 vs 13) | `docs/` or `.kiro/specs/` | 10 min |

---

## On-Chain

| ID | Sev | Action | File(s) | Est. Time |
|----|-----|--------|---------|-----------|
| OC-01 | P1 | Generate gas-cost artifact from actual TX receipts backing "$0.004/tx" claim | New: `artifacts/gas-cost-analysis.json` or `docs/gas-cost-evidence.md` | 30 min |
| OC-02 | P2 | Document multisig/timelock migration roadmap for contract admin EOA (single point of failure) | `docs/security-roadmap.md` | 20 min |
| OC-03 | P2 | Document price oracle cross-validation strategy (currently single CoinGecko source) | `docs/security-roadmap.md` or `docs/oracle-strategy.md` | 15 min |

---

## Documents-Copy

| ID | Sev | Action | File(s) | Est. Time |
|----|-----|--------|---------|-----------|
| DC-01 | P1 | Count tools in `nansenMCP.js` and update or soften "36 analytics tools" claim | `src/mcp/nansenMCP.js`, `README.md`, `docs/pitch-deck/index.html` | 15 min |
| DC-02 | P1 | Run `npm test`, update pitch deck unit test count (currently "156/156") | `docs/pitch-deck/index.html` | 10 min |
| DC-03 | P1 | Add "as of [date]" qualifiers to external DeFi claims ("$1.1M Merchant Moe pool") | `docs/pitch-deck/index.html` | 10 min |
| DC-04 | P1 | Verify spec count / acceptance criteria count or soften "8 specs, >500 acceptance criteria" | `docs/pitch-deck/index.html` | 15 min |
| DC-05 | P2 | Tighten "EVERY decision on-chain" → "every completed cycle's decision" + "cost-prohibitive on L1" | `README.md` | 5 min |
| DC-06 | P2 | Tighten "Validator prompt is IMMUTABLE" → "not subject to auto-evolution (operator-only changes)" | `README.md` | 5 min |
| DC-07 | P2 | Qualify "100%" parse success → "100% over measured 24h window (N=X cycles)" | `README.md`, `agent-card-v2.json`, `docs/pitch-deck/index.html` | 10 min |
| DC-08 | P2 | Tighten "Autonomous" / "every allocation" → "Hourly autonomous cycle" / "every proposed allocation" | `README.md`, `docs/pitch-deck/index.html` | 10 min |
| DC-09 | P2 | Qualify "consensusRate: 100%" → "100% of cycles reached a consensus outcome (including REJECT)" | `agent-card-v2.json` | 5 min |
| DC-10 | P2 | Fix or annotate "Hyperliquid" in README architecture diagram (not directly integrated) | `README.md` | 5 min |

---

## Design-UX

| ID | Sev | Action | File(s) | Est. Time |
|----|-----|--------|---------|-----------|
| DX-01 | P1 | Standardize max-width inconsistency across sub-pages (1200px vs 5xl vs 4xl vs 1100px) | All sub-page `page.tsx` | 10 min |
| DX-02 | P2 | Add skeleton shimmer to `/social` loading state | `frontend/app/social/page.tsx` | 15 min |
| DX-03 | P2 | Add illustrated empty state to `/challenge` when no attack vector selected | `frontend/app/challenge/page.tsx` | 20 min |
| DX-04 | P2 | Make decision log table columns content-proportional instead of equal grid-cols-5 | `frontend/app/page.tsx` | 15 min |

---

## Security

| ID | Sev | Action | File(s) | Est. Time |
|----|-----|--------|---------|-----------|
| SE-01 | P1 | Implement `stripControlChars()` sanitizer for all external data before LLM prompt injection | New: `src/utils/sanitize.js`; apply in `src/orchestrator/multiAgent.js`, `src/data/unifiedMarketData.js` | 45 min |
| SE-02 | P1 | Add CODEOWNERS + CI path-based gate for state-file writes (any PR can edit outcomes.json) | New: `CODEOWNERS`, update `.github/workflows/ci.yml` | 30 min |
| SE-03 | P1 | Add CSP, X-Frame-Options, X-Content-Type-Options headers in next.config.js | `frontend/next.config.js` | 20 min |
| SE-04 | P2 | Enable branch protection with required reviews on main | GitHub repo settings (manual) | 10 min |
| SE-05 | P2 | npm audit runs with `|| true` — does not block merge. Make it a real gate. | `.github/workflows/ci.yml` | 10 min |

---

## Priority Summary

| Priority | Count | Est. Total Time |
|----------|-------|-----------------|
| P0 (open) | 1 | 45 min |
| P1 | 20 | ~9.5 hours |
| P2 | 28 | ~7.5 hours |
| P3 | 0 | — |
| **Total** | **49** | **~17.5 hours** |

### Critical Path (P0 + top P1 for judges)

1. **SE-01** — Prompt injection sanitizer (P1, 45 min) — security narrative
2. **SE-03** — Security headers (P1, 20 min) — visible in any probe
3. **BE-01/02** — API caching for agent-card + strategy (P1, 60 min) — UX speed
4. **BE-06** — Validator reframing (P1, 45 min) — "adversarial" narrative integrity
5. **CI-01** — External cron trigger (P1, 60 min) — "autonomous" claim
6. **DC-01/02/03/04** — Pitch deck claims tightening (P1, 50 min) — judge credibility
7. **OC-01** — Gas cost evidence (P1, 30 min) — backs "$0.004" claim

**Minimum viable sprint: ~5.5 hours** for highest-impact P1 fixes.
