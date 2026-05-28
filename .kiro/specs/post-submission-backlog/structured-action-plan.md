# Structured Action Plan — TuringVault Post-Submission Backlog

**Generated:** 2026-05-28  
**Updated:** 2026-05-28 (comprehensive rebuild from ALL audit + design-playbook sources)  
**Sources:** Audit reports 00, 02, 03, 05, 06, 08, 09, 10, 12, 13, 99-consolidated + backlog specs + docs/design-playbook.md  
**Total items:** 62  
**P0 disposition:** All P0s fixed or wont-fix-pre-submission per 99-consolidated. This plan covers remaining open items.

---

## Frontend

| ID | Sev | Action | File(s) | Est. Time |
|----|-----|--------|---------|-----------|
| FE-01 | P0 | Add interactive hover tooltips to `/backtest` equity curve SVG (show price + PnL per point on hover) | `frontend/app/backtest/page.tsx` | 45 min |
| FE-02 | P1 | Verify all UI consumers of `/api/elfa-snapshot` handle `sentiment: null` gracefully — no crash or blank render | `frontend/app/social/page.tsx`, consuming components | 20 min |
| FE-03 | P1 | Add skeleton shimmer to `/social` loading state (currently shows "loading…" text only) | `frontend/app/social/page.tsx` | 15 min |
| FE-04 | P1 | Make decision log table columns proportional (`grid-template-columns: auto 1fr auto auto 2fr`) instead of equal `grid-cols-5` | `frontend/app/page.tsx` (decision table section) | 15 min |
| FE-05 | P1 | Add illustrated empty state to `/challenge` (shield icon + subtitle when no attack selected) | `frontend/app/challenge/page.tsx` | 20 min |
| FE-06 | P1 | Standardize max-width to `max-w-[1200px]` across all pages (currently varies: 5xl=1024, 4xl=896, 1100px) | All sub-page `page.tsx` files | 10 min |
| FE-07 | P2 | Define and apply formal 4px/8px spacing scale as CSS custom properties per design-playbook §3 | `frontend/app/globals.css` | 30 min |
| FE-08 | P2 | Consolidate text opacity to 3 levels only (primary 0.95 / secondary 0.6 / muted 0.3) — remove 0.2, 0.25, 0.4, 0.20 variants | All page.tsx + `frontend/app/globals.css` | 25 min |
| FE-09 | P2 | Add page transitions via framer-motion or Next.js layout animations | `frontend/app/layout.tsx`, new transition wrapper component | 60 min |
| FE-10 | P2 | Add `stat-card-interactive` hover to `/backtest` StatCards and `/discipline` Tiles | `frontend/app/backtest/page.tsx`, `frontend/app/discipline/page.tsx` | 10 min |
| FE-11 | P2 | Wrap partner bar in horizontal scroll on mobile instead of wrapping to multi-row | `frontend/app/page.tsx` (partner section) | 15 min |
| FE-12 | P2 | Add `prefers-reduced-motion` media query disabling all animations (accessibility gap from design-playbook §4) | `frontend/app/globals.css` | 10 min |
| FE-13 | P2 | Add skip-to-content link for keyboard navigation (accessibility gap from design-playbook §6) | `frontend/app/layout.tsx` | 10 min |
| FE-14 | P2 | Fix color contrast on `text-white/30` against `#030308` — fails WCAG AA. Increase to `text-white/40` minimum | `frontend/app/globals.css`, Tailwind usages | 15 min |
| FE-15 | P2 | Add accessible alternative text to SVG equity curve chart (accessibility gap from design-playbook §6) | `frontend/app/backtest/page.tsx` | 10 min |
| FE-16 | P2 | Add `role="button"` + keyboard handlers to interactive table rows (accessibility gap from design-playbook §6) | `frontend/app/discipline/page.tsx`, decision table | 20 min |
| FE-17 | P2 | Define formal error state for inputs (red border + error message) per design-playbook §5 gap | `frontend/app/globals.css`, `frontend/app/challenge/page.tsx` | 15 min |

---

## Backend-Pipeline

| ID | Sev | Action | File(s) | Est. Time |
|----|-----|--------|---------|-----------|
| BE-01 | P1 | Add 60s in-memory cache for IPFS tokenURI content in `/api/agent-card` (currently 4550ms) | `frontend/app/api/agent-card/route.ts` | 30 min |
| BE-02 | P1 | Add 30s in-memory cache (or `revalidate=30`) for NAV computation in `/api/strategy` (currently 2113ms) | `frontend/app/api/strategy/route.ts` | 30 min |
| BE-03 | P1 | Fix `rwaAllocation.lastRebalanceAt` to read latest RWA swap timestamp from outcomes.json (currently always null) | `frontend/app/api/strategy/route.ts` | 20 min |
| BE-04 | P1 | Recompute `normalizedScore` in `/api/reputation` to reflect actual winRate (currently hard-coded 100 despite 40.9% win rate) | `frontend/app/api/reputation/route.ts` | 20 min |
| BE-05 | P1 | Unify winRate calculation between `/api/performance` (45.1%) and `/api/reputation` (40.9%) — use single method, document denominators | `frontend/app/api/performance/route.ts`, `frontend/app/api/reputation/route.ts` | 30 min |
| BE-06 | P1 | Lower validator approval threshold OR reframe docs as "advisory validator" (validator has never rejected in 20+ cycles — `disagreementSignal=false` always) | `src/orchestrator/multiAgent.js` or documentation | 45 min |
| BE-07 | P1 | Add GitHub raw fallback for `position_state.json` reads in `/api/strategy` (only outcomes.json has fallback) | `frontend/app/api/strategy/route.ts` | 20 min |
| BE-08 | P1 | Add GitHub raw fallback for `/api/reasoning` (progress/evolution/intents files — currently returns empty objects) | `frontend/app/api/reasoning/route.ts` | 30 min |
| BE-09 | P1 | Add GitHub raw fallback for `/api/agent-card` (currently returns null if file missing from fs) | `frontend/app/api/agent-card/route.ts` | 20 min |
| BE-10 | P1 | Fix `/api/agent-card` honesty: `sourcify` field says "all four contracts" — count is wrong (4 of 5 match, or 4 of 6 total). Fix wording. | `agent-card-v2.json`, `assets/agent-card.json` | 10 min |
| BE-11 | P1 | Fix `/api/agent-card` `consensusRate: "100%"` — meaningless metric (validator always responds). Reword to "validation coverage" or remove | `agent-card-v2.json` | 10 min |
| BE-12 | P2 | Add "Elfa Social" to `dataSources` array in IPFS pin metadata (present in pipeline but missing from proof artifact) | `src/ipfs/storage.js` | 5 min |
| BE-13 | P2 | Confirm `trajectories.json` is actively written or deprecate with docs (17.5h stale, no entries from recent cycles) | `src/orchestrator/run-cycle.js`, `src/data/trajectories.json` | 20 min |
| BE-14 | P2 | Confirm `grid_*.json` inactive-by-design; document subsystem status as "paused since 2026-05-23" | `src/data/grid_*.json`, README or docs | 10 min |
| BE-15 | P2 | Investigate validator reasoning homogeneity for HOLD decisions (near-identical text across cycles #108-111) | `src/orchestrator/multiAgent.js` (validator prompt) | 30 min |
| BE-16 | P2 | Document `raw_model_outputs/` purpose and retention policy (only testing-phase files from 2026-05-26 exist) | `docs/` or README | 10 min |
| BE-17 | P2 | Validate and set appropriate Cache-Control headers on all 14 API routes | All `frontend/app/api/*/route.ts` | 20 min |
| BE-18 | P2 | Tighten `check-secrets.sh` regex to exclude TX hash false positives (`0x[a-f0-9]{64}` matching txHash contexts) | `scripts/check-secrets.sh` | 10 min |
| BE-19 | P2 | Fix `/api/agent-card` hard-coded claims: `avgVaR: "~100 bps"` and `gasEfficiency: "~0.005 MNT per TX"` — either compute or label as illustrative | `agent-card-v2.json` | 10 min |

---

## Cron-Infrastructure

| ID | Sev | Action | File(s) | Est. Time |
|----|-----|--------|---------|-----------|
| CI-01 | P1 | Add external cron trigger (Vercel cron or CF Worker) for reliable hourly cycle — GH Actions fires only 37% of slots | New: `vercel.json` cron config or CF Worker script + GH API `workflow_dispatch` | 60 min |
| CI-02 | P1 | Add per-stage timing instrumentation to `last-cycle-summary` (detected 340s spike in run 15, no breakdown available) | `src/orchestrator/run-cycle.js`, `data/last-cycle-summary.json` schema | 30 min |
| CI-03 | P2 | Add `export const dynamic = "force-dynamic"` to 5 missing API routes (backtest, elfa-snapshot, evolution, market, reasoning) | `frontend/app/api/{backtest,elfa-snapshot,evolution,market,reasoning}/route.ts` | 10 min |
| CI-04 | P2 | Document `/api/proof-explorer` s-maxage=30 caching as intentional design decision (expensive on-chain reads) | `frontend/app/api/proof-explorer/route.ts` (code comment) or docs | 5 min |
| CI-05 | P2 | Document Vercel vs GH Actions env var difference as intentional (2 vars vs 13 — frontend reads state files not secrets) | `docs/infrastructure.md` or `.kiro/specs/` | 10 min |

---

## On-Chain

| ID | Sev | Action | File(s) | Est. Time |
|----|-----|--------|---------|-----------|
| OC-01 | P1 | Generate gas-cost artifact from actual TX receipts to back "$0.004/tx" / "~0.005 MNT per TX" claim | New: `artifacts/gas-cost-analysis.json` or `docs/gas-cost-evidence.md` | 30 min |
| OC-02 | P2 | Document multisig/timelock migration roadmap for contract admin EOA (single EOA owns all 6 contracts, ~$30 at risk) | `docs/security-roadmap.md` | 20 min |
| OC-03 | P2 | Document price oracle cross-validation strategy (currently single CoinGecko source — discipline freshness gate limits but doesn't eliminate risk) | `docs/security-roadmap.md` or `docs/oracle-strategy.md` | 15 min |

---

## Documents-Copy

| ID | Sev | Action | File(s) | Est. Time |
|----|-----|--------|---------|-----------|
| DC-01 | P1 | Count tools in `nansenMCP.js` and update or soften "36 analytics tools" claim across all docs | `src/mcp/nansenMCP.js`, `README.md`, `docs/pitch-deck/index.html` | 15 min |
| DC-02 | P1 | Run `npm test`, update pitch deck unit test count (currently claims "156/156" — may be stale) | `docs/pitch-deck/index.html` | 10 min |
| DC-03 | P1 | Add "as of [date]" qualifiers to external DeFi claims ("$1.1M Merchant Moe pool" TVL is time-sensitive) | `docs/pitch-deck/index.html` | 10 min |
| DC-04 | P1 | Verify spec count / acceptance criteria count or soften "8 specs, >500 acceptance criteria" claim | `docs/pitch-deck/index.html` | 15 min |
| DC-05 | P1 | Refresh agent-card snapshot (stale since 2026-05-26 — 15+ days). Verify auto-update in cron works | `agent-card-v2.json`, `scripts/run-cycle.js` | 15 min |
| DC-06 | P2 | Tighten "EVERY decision on-chain (impossible on L1)" → "every completed cycle's decision" + "cost-prohibitive on L1" | `README.md` | 5 min |
| DC-07 | P2 | Tighten "Validator prompt is IMMUTABLE" → "not subject to auto-evolution (operator-only changes)" | `README.md` | 5 min |
| DC-08 | P2 | Qualify "100%" parse success → "100% over measured 24h window (N=X cycles)" in README, pitch-deck, agent-card | `README.md`, `agent-card-v2.json`, `docs/pitch-deck/index.html` | 10 min |
| DC-09 | P2 | Tighten "Autonomous" / "every allocation" → "Hourly autonomous cycle" / "every proposed allocation" | `README.md`, `docs/pitch-deck/index.html` | 10 min |
| DC-10 | P2 | Qualify "consensusRate: 100%" → "100% of cycles reached a consensus outcome (including REJECT)" | `agent-card-v2.json` | 5 min |
| DC-11 | P2 | Fix or annotate "Hyperliquid" in README architecture diagram — no direct integration exists, Byreal aggregates it | `README.md` | 5 min |
| DC-12 | P2 | Fix README contract count: "5 verified contracts" vs deployments.json listing 6 (includes TuringVaultValidation). Clarify. | `README.md` | 5 min |

---

## Design-UX

| ID | Sev | Action | File(s) | Est. Time |
|----|-----|--------|---------|-----------|
| DX-01 | P2 | Add responsive `@media` breakpoints to sub-pages: sm (640px) 1-col, md (768px) 2-col per design-playbook §7 | All sub-page `page.tsx` (already done for homepage) | 30 min |
| DX-02 | P2 | Implement `prefers-reduced-motion` media query globally per design-playbook §4 recommendation | `frontend/app/globals.css` | 10 min |
| DX-03 | P2 | Add layout constraint tokens `--max-w-page: 1200px`, `--nav-height: 56px` as CSS vars per design-playbook §3 | `frontend/app/globals.css` | 5 min |
| DX-04 | P3 | Run Lighthouse + axe-core audit when Playwright becomes available; capture scores | Scripts + CI integration | 30 min |

---

## Security

| ID | Sev | Action | File(s) | Est. Time |
|----|-----|--------|---------|-----------|
| SE-01 | P1 | Implement `stripControlChars()` sanitizer for all external data before LLM prompt injection (token symbols, Nansen MCP text flow in unsanitized) | New: `src/utils/sanitize.js`; apply in `src/orchestrator/multiAgent.js` L619, `src/data/unifiedMarketData.js` L173-176 | 45 min |
| SE-02 | P1 | Add CODEOWNERS + CI path-based gate for state-file writes (any PR can currently modify outcomes.json — no gate) | New: `CODEOWNERS`; update `.github/workflows/ci.yml` with `git diff --name-only` check | 30 min |
| SE-03 | P1 | Add CSP, X-Frame-Options, X-Content-Type-Options headers in next.config.js (only HSTS present currently) | `frontend/next.config.js` | 20 min |
| SE-04 | P2 | Enable branch protection with required reviews on main (currently no protection — direct push allowed) | GitHub repo settings (manual) | 10 min |
| SE-05 | P2 | Fix `npm audit` in CI — currently runs with `|| true` so it never blocks merge on vulnerabilities | `.github/workflows/ci.yml` | 10 min |
| SE-06 | P2 | Verify PRIVATE_KEY is NOT in Vercel env vars (if compromised Vercel = full EOA compromise) | Vercel project settings (manual check) | 5 min |

---

## Priority Summary

| Priority | Count | Est. Total Time |
|----------|-------|-----------------|
| P0 (open) | 1 | 45 min |
| P1 | 25 | ~11 hours |
| P2 | 33 | ~9 hours |
| P3 | 1 | 30 min |
| **Total** | **62** | **~20.5 hours** |

---

## Critical Path (highest-impact items for judges)

If time is limited, execute in this order:

| # | ID | Why | Time |
|---|-----|-----|------|
| 1 | SE-01 | Prompt injection sanitizer — security narrative credibility | 45 min |
| 2 | SE-03 | Security headers — visible in any probe by judge | 20 min |
| 3 | BE-01 + BE-02 | API caching for agent-card + strategy — UX speed from 4.5s → <1s | 60 min |
| 4 | BE-06 | Validator reframing — "adversarial" narrative integrity | 45 min |
| 5 | CI-01 | External cron trigger — backs "autonomous" claim | 60 min |
| 6 | DC-01–05 | Pitch deck claims verification/tightening — judge credibility | 65 min |
| 7 | OC-01 | Gas cost evidence artifact — backs "$0.004" claim | 30 min |
| 8 | BE-10 + BE-11 | Agent-card honesty fixes (sourcify count + consensus wording) | 20 min |
| 9 | SE-02 | CODEOWNERS + CI gate — prevents stat inflation via PR | 30 min |
| 10 | FE-01 | Backtest chart interactivity — "Complete UX" rubric criterion | 45 min |

**Minimum viable sprint: ~7 hours** for the 10 highest-impact fixes.
