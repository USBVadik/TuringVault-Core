# Post-Submission Backlog — Requirements

Generated from system audit (2026-06-14). Contains all P1+ open findings and wont-fix P0s deferred past the hackathon deadline.

---

## 1. API Performance

Improve response times and data correctness for slow or stale API routes.

### Acceptance Criteria
- 1.1 `/api/agent-card` responds in < 1s under normal conditions (currently 4550ms due to uncached IPFS round-trips). [api-2]
- 1.2 `/api/strategy` responds in < 500ms (currently 2113ms; recomputes NAV every call). [api-3]
- 1.3 `/api/elfa-snapshot` gracefully handles `sentiment: null` in UI consumers. [api-4]
- 1.4 `/api/strategy` `rwaAllocation.lastRebalanceAt` reflects the latest RWA swap timestamp from outcomes.json. [api-5]
- 1.5 `/api/reputation` `normalizedScore` honestly reflects winRate instead of hard-coded 100. [api-6]
- 1.6 `/api/reasoning` returns fresh data (not stale by > 1 cycle interval). [api-7]
- 1.7 winRate is consistent between `/api/performance` and `/api/reputation` (single calculation method). [api-8]
- 1.8 All API routes return appropriate Cache-Control headers. [api-9]
- 1.9 `check-secrets.sh` regex does not false-positive on TX hashes. [api-10]

---

## 2. Cron / Reliability

Address cron scheduling reliability and cycle timing.

### Acceptance Criteria
- 2.1 Agent cycle fires reliably (> 90% slot success) or documentation accurately reflects "best-effort hourly". [cron-1, cron-4]
- 2.2 Per-stage timing is logged in `last-cycle-summary` to detect latency spikes (340s observed in run 15). [cron-3]

---

## 3. Pipeline / Data

Fix data-flow issues in the decision pipeline and IPFS proofs.

### Acceptance Criteria
- 3.1 Validator model produces genuine disagreement signals (currently `disagreementSignal=false` for all recent outcomes). [pipe-1]
- 3.2 `trajectories.json` is confirmed active or deprecated explicitly. [SF-01]
- 3.3 `grid_*.json` files are confirmed inactive-by-design or re-enabled. [SF-02]
- 3.4 Validator reasoning varies meaningfully across HOLD decisions. [pipe-2]
- 3.5 IPFS `dataSources` array includes "Elfa Social". [pipe-3]
- 3.6 README architecture diagram accurately names signal sources (Hyperliquid labeling). [pipe-4]
- 3.7 `raw_model_outputs/` directory purpose and retention is documented. [pipe-5]

---

## 4. Documents / Claims

Tighten absolute language and back up numeric claims with artifacts.

### Acceptance Criteria
- 4.1 Gas cost claim ("$0.004 per tx") is backed by an actual TX receipt artifact. [P1-1]
- 4.2 "36 analytics tools" claim is verified against nansenMCP.js or softened. [P1-2]
- 4.3 Unit test count in pitch deck matches current `npm test` output. [P1-3]
- 4.4 External claims (e.g. "$1.1M Merchant Moe pool") carry "as of [date]" qualifiers. [P1-4]
- 4.5 Spec count / acceptance criteria count is verified or softened. [P1-5]

---

## 5. Vercel / Infrastructure

Ensure correct Vercel route configuration and environment documentation.

### Acceptance Criteria
- 5.1 All API routes that must not be cached declare `export const dynamic = "force-dynamic"`. [vercel-1]
- 5.2 `/api/proof-explorer` caching decision (s-maxage=30) is documented. [vercel-2]
- 5.3 Vercel vs GitHub Actions env var difference is documented as intentional. [bridge-7]

---

## 6. Security

Harden prompt injection surface, CI gates, and HTTP headers.

### Acceptance Criteria
- 6.1 All external data interpolated into LLM prompts passes through `stripControlChars()` sanitizer. [threat-1]
- 6.2 State-file writes are gated via CODEOWNERS + CI path-based rules. [threat-2]
- 6.3 Security headers (CSP, X-Frame-Options, X-Content-Type-Options) are configured in next.config.js. [threat-3]
- 6.4 Multisig/timelock roadmap for contract admin is documented. [threat-4]
- 6.5 Price oracle cross-validation strategy is documented (currently single CoinGecko source). [threat-5]
- 6.6 Branch protection with required reviews is enabled on main. [threat-6]
- 6.7 GitHub fallback added for `position_state` reads in `/api/strategy`. [bridge-4]
- 6.8 GitHub fallback added for `/api/reasoning` (progress/evolution/intents). [bridge-5]
- 6.9 GitHub fallback added for `/api/agent-card`. [bridge-6]

---

## 7. Design / UX

Address design system gaps and interactive features deferred from P0.

### Acceptance Criteria
- 7.1 `/backtest` equity curve has interactive hover tooltips showing price + PnL per data point. [design-P0-2]
- 7.2 Formal 4px/8px spacing scale tokens are defined and applied across all pages. [design-P2-1]
- 7.3 Text opacity consolidated to 3 levels (primary/secondary/muted). [design-P2-2]
- 7.4 Page transitions (framer-motion or Next.js layout animations) added on navigation. [design-P2-3]
