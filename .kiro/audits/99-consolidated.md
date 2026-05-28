# Consolidated Audit Findings + Remediation Plan

**Compiled at:** 2026-06-14  
**Updated:** 2026-06-14 (post-fix re-probe)  
**Re-audit pass:** 2026-05-28 (operator-supervised, partial — see appendix)  
**Source reports:** 00-inventory, 02-api-endpoints, 03-cron-and-actions, 04-on-chain (REGEN 2026-05-28), 05-state-files, 06-pipeline-data-flow, 08-documents-and-claims, 09-cron-vercel-bridge, 10-vercel-runtime, 11-secrets-and-supply (REGEN 2026-05-28), 12-threat-model, 13-design-ux  
**Reports still missing:** 01-ui-pages, 07-external-apis (deferred to post-submission backlog — see M-1)  
**Day-of-investigation report:** 2026-05-28-trading-unblock.md (live evidence, TX hashes, full timeline)

---

## Severity Distribution

| Severity | Count | Description |
|----------|-------|-------------|
| **P0** | 15 | User-visible truth violation OR money/security risk |
| **P1** | 20 | Reliability problem; should fix pre-submission |
| **P2** | 17 | Code quality / refactor / polish |
| **P3** | 2 | Cosmetic / nice-to-have |
| **Total** | **54** | |

```
P0  ████████████████  15
P1  ████████████████████  20
P2  █████████████████  17
P3  ██  2
```

---

## All Findings (sorted by severity, then surface)

### P0 — Critical (must fix or wont-fix with reason before submission)

| # | ID | Surface | Expected | Actual | Root Cause | Suggested Fix | Status |
|---|-----|---------|----------|--------|------------|---------------|--------|
| 1 | api-1 | `/api/evolution` | 200 with evolution snapshot | 500: viem `tokenURI(uint256)` reverted on Identity contract for tokenId=1 | Token #1 doesn't exist or unset | Fetch tokenId=0 or read `totalAgents()` first, or guard with try/catch | fixed |
| 2 | cron-1 | agent-cycle.yml | Hourly fire reliable | 37% slot success rate in 24h window | GH Actions delays/skips schedules under platform load | Reword README to "best-effort hourly" AND/OR add external trigger (Vercel cron, CF Worker) | wont-fix-pre-submission |
| 3 | bridge-1 | `/api/decisions` | GitHub fallback when fs unavailable | Returns empty array silently — no fallback | Missing fetchFromGitHub pattern | Add fetchFromGitHub fallback (same as /api/health) | fixed |
| 4 | bridge-2 | `/api/discipline` | GitHub fallback when fs unavailable | Returns null silently | Missing fetchFromGitHub pattern | Add fetchFromGitHub fallback | fixed |
| 5 | bridge-3 | `/api/performance` | GitHub fallback when fs unavailable | Returns null silently | Missing fetchFromGitHub pattern | Add fetchFromGitHub fallback | fixed |
| 6 | P0-1 | README + pitch-deck + agent-card | Consistent rejection rate | README "57%", agent-card "61.5%", pitch deck "65%" — three different numbers | Stale documents; no single source of truth | Harmonize from agent-card (61.5%) across all docs | fixed |
| 7 | P0-2 | README + pitch-deck + agent-card | Consistent RWA NAV allocation | README "55%+", agent-card 55, pitch deck "74% NAV" — 19pp gap | Pitch deck not updated after portfolio change | Pick source of truth and sync all docs | fixed |
| 8 | P0-3 | README + pitch-deck | Consistent decision count | README "104+", pitch deck "102+" | Pitch deck stale | Update pitch deck to match current count | fixed |
| 9 | P0-4 | pitch-deck slide 5 | Honest Sourcify status | "All contracts verified" pill badge drops Router caveat | Copy oversight | Change to "4/5 Sourcify-verified" or add "(Router pending)" | fixed |
| 10 | P0-5 | README + agent-card | Consistent confidence gate | README says "< 65%" skip; code uses 0.6 (60%) | Documentation drift from code | Fix README to say 60% or update code to 65% | fixed |
| 11 | P0-6 | README + agent-card | Consistent R:R ratio | README "R:R ≥ 2:1"; validator prompt uses "R:R ≥ 1.5:1" | Documentation drift | Document actual enforced ratio consistently | fixed |
| 12 | design-P0-1 | /backtest, /discipline, /social | Entry animations present | Zero motion — jarring contrast with animated homepage | Pages built without animation framework integration | Add `anim-fade-up` + stagger delays to sub-page wrappers | fixed |
| 13 | design-P0-2 | /backtest equity curve | Interactive chart | SVG has no hover tooltips, crosshair, or data inspection | Built as static SVG path only | Add hover tooltip showing price + PnL per point | wont-fix-pre-submission |
| 14 | design-P0-3 | /backtest, /discipline, /social, /challenge | Mobile responsive | Only homepage defines @media (max-width: 768px) | Sub-pages built without mobile breakpoints | Add responsive rules (stack grids to 1-col) | fixed |
| 15 | cron-4 | health.lastCycleAge | < 65 min | 6406 sec = 106 min when probed | Direct consequence of cron-1 | Resolve cron-1 | wont-fix-pre-submission |

### P1 — Reliability (should fix pre-submission if time allows)

| # | ID | Surface | Expected | Actual | Root Cause | Suggested Fix | Status |
|---|-----|---------|----------|--------|------------|---------------|--------|
| 16 | api-2 | `/api/agent-card` | < 1s typical | 4550 ms | Round-trips IPFS gateway every render, no caching | Cache resolved tokenURI content for 60s | open |
| 17 | api-3 | `/api/strategy` | < 500 ms | 2113 ms | Recomputes NAV from on-chain + CoinGecko every call | Add 30s in-memory cache or revalidate=30 | open |
| 18 | api-4 | `/api/elfa-snapshot` | Useful sentiment field | `sentiment: null` always (V2 stripped raw text) | Elfa V2 design; not a bug | Verify UI handles null gracefully | open |
| 19 | api-5 | `/api/strategy` | rwaAllocation.lastRebalanceAt fresh | `lastRebalanceAt: null` despite RWA swap executed | Reader doesn't pick up latest RWA timestamp from outcomes.json | Fix computation in strategy route | open |
| 20 | api-6 | `/api/reputation` | normalizedScore reflects winRate | `winRate: "40.9", normalizedScore: 100` (hard-coded ceiling) | Normalizer caps at 100 regardless | Recompute normalized or expose both values honestly | open |
| 21 | api-7 | `/api/reasoning` | Fresh timestamp | Matches cycle ~2h ago — stale | Consequence of cron lag (cron-1) | Resolved by fixing cron schedule | open |
| 22 | api-8 | `/api/performance` vs `/api/reputation` | Consistent winRate | 45.1% vs 40.9% — different denominators | Two routes use different calculation methods | Pick one method; document difference | open |
| 23 | cron-3 | agent-cycle.yml run 15 | 60–100s duration | 340s | Possibly Bedrock latency spike or RPC retry | Add per-stage timing to last-cycle-summary | open |
| 24 | pipe-1 | outcomes.json → disagreementSignal | Validator rejects some proposals | `disagreementSignal=false` for ALL 20 most recent settled outcomes | Validator model structurally approves — never rejects | Lower validator approval threshold OR reframe docs as "advisory validator" | open |
| 25 | bridge-4 | `/api/strategy` (position_state) | GitHub fallback for all fs reads | Only outcomes.json has fallback; position_state does not | Incomplete fallback implementation | Add raw.githubusercontent fallback | open |
| 26 | bridge-5 | `/api/reasoning` | GitHub fallback | Returns empty objects when files missing | Missing fetchFromGitHub pattern | Add fetchFromGitHub for progress/evolution/intents | open |
| 27 | bridge-6 | `/api/agent-card` | GitHub fallback | Returns null if agent-card.json missing from fs | Missing fetchFromGitHub pattern | Add fetchFromGitHub fallback | open |
| 28 | threat-1 | Prompt construction | Token symbols sanitized before LLM injection | Raw interpolation of external data into prompts | No input sanitization layer | Add `stripControlChars(str)` wrapper on all external data | open |
| 29 | threat-2 | CI workflow | State-file writes gated to cron-only | No CI gate; any PR can modify outcomes.json | Missing CODEOWNERS + path-based CI rules | Add CODEOWNERS + CI step checking git diff authors | open |
| 30 | threat-3 | Live deployment | CSP + X-Frame-Options + X-Content-Type-Options present | Only HSTS present | No `headers` config in next.config.js | Add security headers in next.config.js | open |
| 31 | P1-1 | README + pitch-deck | Gas cost claim backed by artifact | "$0.004 per tx" / "~0.005 MNT per TX" — no TX receipt evidence | Never computed from actuals | Add gas-cost sample to audit artifacts | open |
| 32 | P1-2 | README | Nansen tool count verified | "36 analytics tools" — uncounted | Marketing copy, not verified | Count tools in nansenMCP.js or remove number | open |
| 33 | P1-3 | pitch-deck | Unit test count current | "156/156 unit tests" — may be stale | Static slide, not auto-refreshed | Run npm test and update count | open |
| 34 | P1-4 | pitch-deck | External claims time-bounded | "$1.1M Merchant Moe pool" — no date qualifier | Time-sensitive external data | Add "as of [date]" qualifier | open |
| 35 | P1-5 | pitch-deck | Spec count verified | "8 specs, >500 acceptance criteria" — uncounted | Marketing approximation | Count or soften claim | open |

### P2 — Code Quality / Polish (backlog)

| # | ID | Surface | Expected | Actual | Root Cause | Suggested Fix | Status |
|---|-----|---------|----------|--------|------------|---------------|--------|
| 36 | api-9 | All API routes | Cache-Control validated | Not validated in initial run | Probe gap | Add HEAD probes in re-audit | open |
| 37 | api-10 | check-secrets.sh | Clean pattern match | False positive on TX hashes matching `0x[a-f0-9]{64}` | Over-broad regex | Tighten regex to exclude txHash contexts | open |
| 38 | SF-01 | `src/data/trajectories.json` | Updated each cycle | mtime 17.5h old; not updated by recent cycles | Writer may be disabled in recent refactors | Verify trajectoryRecorder wiring; if deprecated, document as legacy | open |
| 39 | SF-02 | `src/data/grid_*.json` (4 files) | Updated when grid bot acts | All 4 files stale (17.5h) — grid bot appears inactive | Grid bot paused/disabled | Confirm intentionally inactive; mark as "inactive subsystem" | open |
| 40 | pipe-2 | outcomes.json #108–111 | Unique reasoning per cycle | Validator reasoning near-identical for HOLD decisions | LLM produces structurally similar text for same action + conditions | Expected behavior; weakens "unique per cycle" claim but not incorrect | open |
| 41 | pipe-3 | IPFS pin dataSources | All signals listed in proof artifact | Elfa missing from `dataSources` hardcoded array | Static list not updated when Elfa added | Add "Elfa Social" to dataSources in src/ipfs/storage.js | open |
| 42 | pipe-4 | README architecture | Listed signals match code | "Hyperliquid" listed but no direct integration exists | Labeling issue; "Byreal Perps" may aggregate Hyperliquid data | Rename in architecture diagram or add footnote | open |
| 43 | pipe-5 | raw_model_outputs/ | Files exist per decision | Only files from 2026-05-26 testing; none for recent decisions | Raw capture disabled or ephemeral in CI | Document that IPFS pins are the canonical reasoning record | open |
| 44 | bridge-7 | Vercel env vars | Feature flags in both environments | Only 2 env vars on Vercel vs 13 on GH Actions | Frontend reads state files, not secrets directly | Acceptable; document that frontend doesn't need most secrets | open |
| 45 | vercel-1 | 5 API routes | `force-dynamic` declared | Missing declaration on /api/backtest, /api/elfa-snapshot, /api/evolution, /api/market, /api/reasoning | Routes added without standard header | Add `export const dynamic = "force-dynamic"` to each | open |
| 46 | vercel-2 | `/api/proof-explorer` | Explicit dynamic or documented caching | Sets s-maxage=30 without route-level dynamic export | Intentional design for expensive on-chain reads | Document caching decision | open |
| 47 | threat-4 | Agent EOA | Multisig/timelock for contract admin | Single EOA owns all contracts | Hackathon expediency | Accepted risk; document multisig roadmap | open |
| 48 | threat-5 | Market data | Cross-validated price from 2+ oracles | Single CoinGecko source | Design simplicity | Low priority — discipline freshness gate limits exposure | open |
| 49 | threat-6 | Branch protection | Protected main with required reviews | No branch protection; direct push | Solo-dev hackathon workflow | Add post-submission | open |
| 50 | design-P2-1 | All pages | Formal 4px/8px spacing scale | No spacing scale; gap/padding varies arbitrarily | No design system tokens for spacing | Define and apply spacing scale tokens | open |
| 51 | design-P2-2 | All pages | 3 text opacity levels | 6+ alpha variants of white text | Organic growth without consolidation | Consolidate to primary/secondary/muted | open |
| 52 | design-P2-3 | All pages | Page transitions on navigation | Hard cut between pages | No shared layout animation configured | Add Next.js layout transitions or framer-motion | open |

### P3 — Cosmetic

| # | ID | Surface | Expected | Actual | Root Cause | Suggested Fix | Status |
|---|-----|---------|----------|--------|------------|---------------|--------|
| 53 | api-11 | `/api/discipline` | tx_proof rollup works | Works correctly after commit `0e307e4` fix | Already fixed | None needed | fixed |
| 54 | SF-03 | `data/challenge-budget.json` | Daily reset | `date` field shows yesterday (no challenges today) | Budget resets lazily on first use per day | No action needed — correct behavior | fixed |

---

## P2 — Absolute Language Requiring Tightening (from 08-documents-and-claims)

| # | Claim | Document | Suggested Rewrite |
|---|-------|----------|-------------------|
| A | "EVERY decision on-chain (impossible on L1)" | README | "every completed cycle's decision" + "cost-prohibitive on L1" |
| B | "Validator prompt is IMMUTABLE" | README | "not subject to auto-evolution (operator-only changes)" |
| C | "100%" parse success (×3 docs) | README, pitch-deck, agent-card | "100% over measured 24h window (N=X cycles)" |
| D | "Autonomous" / "every allocation" | README, pitch-deck | "Hourly autonomous cycle" / "every proposed allocation" |
| E | "consensusRate: 100%" | agent-card | "100% of cycles reached a consensus outcome (including REJECT)" |
| F | "all contracts verified" (pitch deck) | pitch-deck | "4/5 contracts Sourcify-verified (Router pending)" |

---

## Not Checked (aggregated from all reports)

### From 00-inventory
| Item | Reason |
|------|--------|
| Lighthouse / axe scores | Playwright not installed |
| Bundle sizes | Requires `next build` output dump |

### From 02-api-endpoints
| Item | Reason |
|------|--------|
| Cache-Control headers per route (HEAD probes) | Deferred to re-audit |
| Response schema diff vs frontend types | Needs walking each consuming component |
| 5xx behavior under sustained load | Out of scope for hackathon |

### From 03-cron-and-actions
| Item | Reason |
|------|--------|
| ci.yml run history | Deferred — operator-visible |
| Per-step timing breakdown | Requires modifying run-cycle.js |
| Secret list via GH API | `gh` CLI not installed |

### From 05-state-files
| Item | Reason |
|------|--------|
| `raw_model_outputs/` directory deep-dive | Not a JSON state file; per-decision subdirectories |
| API route parse-error handling | Covered by R3 audit |
| cross-validation cycle-history vs outcomes count | Different retention policies — not a discrepancy |

### From 06-pipeline-data-flow
| Item | Reason |
|------|--------|
| Full IPFS content integrity (keccak hash vs on-chain) | Contract stores reasoning directly; CID is content-addressed |
| Pinata pin persistence guarantee | Both CIDs returned 200 at audit time; cannot predict future expiry |
| Elfa signal freshness at decision time | Cache wrapper without explicit TTL verification |
| Raw model output completeness for all 119 proposals | Only testing-phase files exist |

### From 08-documents-and-claims
| Item | Reason |
|------|--------|
| Live on-chain event count vs claimed 104 | Cannot query Mantle RPC from environment |
| Actual current RWA NAV % | Requires wallet balance query |
| Pinata pin list for prompt versions | Requires PINATA_JWT |
| Nansen MCP tool count | Would require reading full nansenMCP.js |
| Unit test count (156) | Requires npm test run |
| Merchant Moe pool TVL | External DEX state, time-varying |

### From 09-cron-vercel-bridge
| Item | Reason |
|------|--------|
| Vercel build logs for cron deploys | No API access without team-level auth |
| GH Actions secret list via API | `gh` CLI not available |
| Vercel deploy hooks / webhook config | Not exposed via public API |
| Historical cron commits older than last 10 deploys | Older history not fetched |

### From 10-vercel-runtime
| Item | Reason |
|------|--------|
| Vercel function runtime logs (error grep) | Requires log drain or `vercel logs` CLI |
| `/api/challenge` latency probe | Requires POST + LLM call (cost) |
| Build logs for ERROR deployments | No ERROR states found |
| Full bundle size analysis (webpack stats) | Requires `next build --profile` |

### From 12-threat-model
| Item | Reason |
|------|--------|
| Smart contract exploit paths (reentrancy, overflow) | Covered by docs/security-review |
| Vercel env variable listing (actual presence) | Requires Vercel API token |
| Live token balances held by Router | Requires multicall or Mantlescan scan |
| Rate limiting on API routes | No auth = no rate-limit concern |
| DNS/domain hijacking risk | Out of scope |

### From 13-design-ux
| Item | Reason |
|------|--------|
| Actual screenshots at 4 viewport widths | Playwright not installed |
| Lighthouse scores (Performance, Accessibility, SEO) | No Lighthouse CLI available |
| axe-core automated accessibility scan | No standalone runner configured |
| Mobile viewport rendering | Cannot render at mobile widths |
| Cross-browser rendering | No BrowserStack available |

### Reports not produced (files don't exist on disk)
| Report | Covers | Reason |
|--------|--------|--------|
| 01-ui-pages.md | R2: per-page UI audit with metrics tracing | Task marked complete but file not on disk |
| 04-on-chain.md | R5: contract bytecode, Sourcify check, TX classification | Task marked complete but file not on disk |
| 07-external-apis.md | R8: Pinata, Bedrock, Vertex, Mantle RPC, CoinGecko, Elfa, Nansen probes | Task marked complete but file not on disk |
| 11-secrets-and-supply.md | R12: git history secret scan, npm audit, JWT expiry | Task marked complete but file not on disk |

---

## P0 Disposition Summary

Every P0 must have `status=fixed` or `status=wont-fix-pre-submission` before audit close-out.

**Post-fix re-probe:** 2026-05-28 — all `status=fixed` findings re-verified on live deployment.  
**Rollbacks:** None required — all fixes confirmed working.

| # | ID | Current Status | Re-probe Result |
|---|-----|----------------|-----------------|
| 1 | api-1 | fixed | ✅ HTTP 200, valid data |
| 2 | cron-1 | wont-fix-pre-submission | N/A (platform limitation) |
| 3 | bridge-1 | fixed | ✅ 121 decisions returned |
| 4 | bridge-2 | fixed | ✅ dict with 5 keys |
| 5 | bridge-3 | fixed | ✅ dict with 5 keys |
| 6 | P0-1 | fixed | ✅ All docs say 61.5% |
| 7 | P0-2 | fixed | ✅ Harmonized to 55% |
| 8 | P0-3 | fixed | ✅ All say 104+ |
| 9 | P0-4 | fixed | ✅ "4/5 Sourcify-verified" |
| 10 | P0-5 | fixed | ✅ README says "< 60%" |
| 11 | P0-6 | fixed | ✅ No "2:1" in README |
| 12 | design-P0-1 | fixed | ✅ anim-fade-up deployed |
| 13 | design-P0-2 | wont-fix-pre-submission | N/A (>30 min; backlog) |
| 14 | design-P0-3 | fixed | ✅ 768px media queries deployed |
| 15 | cron-4 | wont-fix-pre-submission | N/A (depends on cron-1) |


---

## Re-Audit Pass — 2026-05-28 (operator-supervised)

The original audit was marked **Status: SHIPPED** in `tasks.md` with all 20 task checkboxes ticked. A re-audit pass on 2026-05-28 (driven by operator catching that the agent had not actually traded for a week despite cron saying `EXECUTED_SWAP`) revealed that some of those checkboxes were optimistic.

### M-1 — Four output reports were claimed shipped but never on disk

| Task | Required output | Was on disk? | Status today |
|------|-----------------|:------------:|--------------|
| T3 (R2 UI pages) | `.kiro/audits/01-ui-pages.md` | No | **deferred** to post-submission backlog (UI pages had been informally validated via 13-design-ux.md; not a P0 gap pre-submission) |
| T6 (R5 on-chain) | `.kiro/audits/04-on-chain.md` | No | **regenerated** 2026-05-28 |
| T9 (R8 external APIs) | `.kiro/audits/07-external-apis.md` | No | **deferred** to post-submission backlog (external APIs covered partially in 06-pipeline-data-flow) |
| T13 (R12 secrets) | `.kiro/audits/11-secrets-and-supply.md` | No | **regenerated** 2026-05-28 |

The `tasks.md` Status: SHIPPED block remains unchanged for honesty: it was the operator-of-record's signoff at the time. This re-audit appendix is the truthful corrective.

### M-2 — One on-chain reality the original audit did not catch

The original audit ran ~2 weeks before the trading-unblock investigation. Between those two dates, the codebase migrated Step 4.7 to a hard-coded `mUSD ↔ mETH` directional swap that worked against zero balance, and silently advertised `EXECUTED_SWAP` for ten consecutive cycles (113-122) without ever broadcasting a DEX TX. This violates `.kiro/steering/no-lying-about-state.md` §3, §4.

Full diagnosis, fix sequence, and TX-hash evidence: see `2026-05-28-trading-unblock.md`. Fix landed in commits `0b710de`, `8e4a335`, `aa0ebce`, `0f4c4e0`, `145388a` (backfill of 24 historically-mislabelled rows in `outcomes.json`), `74de441` (outcome-persistence detector for related ledger bug O-1).

First post-fix autonomous trade: cron cycle 123, block 95926135-95926148, three real DEX TXs.

### Additional open items from the re-audit

| ID | Surface | Issue | Severity | Status |
|----|---------|-------|----------|--------|
| O-1 | `src/data/outcomes.json` | Cycle 123 wrote `last-cycle-summary.json` but `outcomeTracker.record()` did not persist a row. Trading itself unaffected; settle loop and decision feed are. | P1 | open, monitor with detector |
| O-2 | `/api/strategy` | In-memory cache holds stale `executeEnabled:false` for ~30s after cycle commits. Cosmetic. | P2 | open |
| O-3 | `last-cycle-summary.json` for cycle 123 | Carries 2 of 3 swap TX hashes (leg 1 of directional missing). Caused by ordering of fix commits; self-corrected on subsequent cycles. | P3 | resolved going forward |

### Spec correction

The original `tasks.md` `Status: SHIPPED` block says "All 20 tasks complete." That sentence is technically inaccurate — 4 produced no artifact, 1 became materially out-of-date when the codebase moved underneath it. This appendix supersedes that line. The spec is **closed for the original window**, and this re-audit pass is its honest follow-up.
