# Post-Submission Backlog — Tasks

Flat task list generated from system audit (2026-06-14). Each task references its audit finding ID for traceability.

---

## API Performance

- [ ] 1. Add 60s in-memory cache for IPFS tokenURI content in `/api/agent-card` → Ref: **api-2**
- [ ] 2. Add 30s in-memory cache (or `revalidate=30`) for NAV computation in `/api/strategy` → Ref: **api-3**
- [ ] 3. Verify all UI consumers of `/api/elfa-snapshot` handle `sentiment: null` gracefully → Ref: **api-4**
- [ ] 4. Fix `rwaAllocation.lastRebalanceAt` computation to read latest RWA timestamp from outcomes.json → Ref: **api-5**
- [ ] 5. Recompute `normalizedScore` in `/api/reputation` to reflect actual winRate → Ref: **api-6**
- [ ] 6. Ensure `/api/reasoning` freshness is tied to latest cycle (stale when cron lags) → Ref: **api-7**
- [ ] 7. Unify winRate calculation between `/api/performance` and `/api/reputation` → Ref: **api-8**
- [ ] 8. Validate and set appropriate Cache-Control headers on all API routes → Ref: **api-9**
- [ ] 9. Tighten `check-secrets.sh` regex to exclude TX hash false positives → Ref: **api-10**

## Cron / Reliability

- [ ] 10. Add external cron trigger (Vercel cron or CF Worker) for reliable hourly cycle → Ref: **cron-1**, **cron-4**
- [ ] 11. Add per-stage timing instrumentation to `last-cycle-summary` → Ref: **cron-3**

## Pipeline / Data

- [ ] 12. Lower validator approval threshold or reframe docs as "advisory validator" → Ref: **pipe-1**
- [ ] 13. Confirm `trajectories.json` is actively written or deprecate with docs → Ref: **SF-01**
- [ ] 14. Confirm `grid_*.json` inactive-by-design; document subsystem status → Ref: **SF-02**
- [ ] 15. Investigate validator reasoning homogeneity for HOLD decisions → Ref: **pipe-2**
- [ ] 16. Add "Elfa Social" to `dataSources` array in `src/ipfs/storage.js` → Ref: **pipe-3**
- [ ] 17. Fix or annotate "Hyperliquid" in README architecture diagram → Ref: **pipe-4**
- [ ] 18. Document `raw_model_outputs/` purpose and retention policy → Ref: **pipe-5**

## Documents / Claims

- [ ] 19. Generate gas-cost artifact from actual TX receipts for "$0.004/tx" claim → Ref: **P1-1**
- [ ] 20. Count tools in `nansenMCP.js` and update or soften "36 analytics tools" claim → Ref: **P1-2**
- [ ] 21. Run `npm test`, update pitch deck unit test count → Ref: **P1-3**
- [ ] 22. Add "as of [date]" qualifiers to external DeFi claims (Merchant Moe pool) → Ref: **P1-4**
- [ ] 23. Verify spec count / acceptance criteria count or soften claim → Ref: **P1-5**

## Vercel / Infrastructure

- [ ] 24. Add `export const dynamic = "force-dynamic"` to 5 missing API routes → Ref: **vercel-1**
- [ ] 25. Document `/api/proof-explorer` s-maxage=30 caching rationale → Ref: **vercel-2**
- [ ] 26. Document Vercel vs GH Actions env var difference as intentional → Ref: **bridge-7**

## Security

- [ ] 27. Implement `stripControlChars()` sanitizer for all external data before LLM prompt injection → Ref: **threat-1**
- [ ] 28. Add CODEOWNERS + CI path-based gate for state-file writes → Ref: **threat-2**
- [ ] 29. Add CSP, X-Frame-Options, X-Content-Type-Options headers in next.config.js → Ref: **threat-3**
- [ ] 30. Document multisig/timelock migration roadmap for contract admin EOA → Ref: **threat-4**
- [ ] 31. Document price oracle cross-validation strategy (CoinGecko single-source risk) → Ref: **threat-5**
- [ ] 32. Enable branch protection with required reviews on main → Ref: **threat-6**
- [ ] 33. Add GitHub fallback for `position_state` reads in `/api/strategy` → Ref: **bridge-4**
- [ ] 34. Add GitHub fallback for `/api/reasoning` (progress/evolution/intents) → Ref: **bridge-5**
- [ ] 35. Add GitHub fallback for `/api/agent-card` → Ref: **bridge-6**

## Design / UX

- [ ] 36. Add interactive hover tooltips to `/backtest` equity curve SVG → Ref: **design-P0-2**
- [ ] 37. Define and apply formal 4px/8px spacing scale tokens → Ref: **design-P2-1**
- [ ] 38. Consolidate text opacity to 3 levels (primary/secondary/muted) → Ref: **design-P2-2**
- [ ] 39. Add page transitions via framer-motion or Next.js layout animations → Ref: **design-P2-3**
