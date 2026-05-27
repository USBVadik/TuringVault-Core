# Audit: Surface Inventory

**Run at:** 2026-05-27 22:00 UTC
**Auditor:** Kiro (Claude Opus 4.7)
**Method environment:** local macOS shell, fetching against
production Vercel deployment
`https://frontend-seven-beta-46.vercel.app` and Mantle Mainnet RPC.

## Scope

Master list of every observable surface that contributes to a judge's
experience. Each surface is owned by exactly one downstream audit
report (01–13).

## UI pages

| Path | Source | Expected freshness | Owner audit |
|------|--------|--------------------|-------------|
| `/` | `frontend/app/page.tsx` | live (every render) | 01 |
| `/backtest` | `frontend/app/backtest/page.tsx` | hourly | 01 |
| `/challenge` | `frontend/app/challenge/page.tsx` | on-demand | 01 |
| `/discipline` | `frontend/app/discipline/page.tsx` | hourly | 01 |
| `/proof-explorer` | `frontend/app/proof-explorer/page.tsx` | live | 01 |
| `/social` | `frontend/app/social/page.tsx` | per-request | 01 |

## API routes

| Path | Source | Expected freshness | Owner audit |
|------|--------|--------------------|-------------|
| `/api/health` | `frontend/app/api/health/route.ts` | live | 02 |
| `/api/decisions` | `frontend/app/api/decisions/route.ts` | hourly | 02 |
| `/api/strategy` | `frontend/app/api/strategy/route.ts` | live | 02 |
| `/api/discipline` | `frontend/app/api/discipline/route.ts` | hourly | 02 |
| `/api/elfa-snapshot` | `frontend/app/api/elfa-snapshot/route.ts` | per-request | 02 |
| `/api/backtest` | `frontend/app/api/backtest/route.ts` | hourly | 02 |
| `/api/agent-card` | `frontend/app/api/agent-card/route.ts` | static | 02 |
| `/api/market` | `frontend/app/api/market/route.ts` | per-request | 02 |
| `/api/performance` | `frontend/app/api/performance/route.ts` | live | 02 |
| `/api/proof-explorer` | `frontend/app/api/proof-explorer/route.ts` | live | 02 |
| `/api/reasoning` | `frontend/app/api/reasoning/route.ts` | live | 02 |
| `/api/reputation` | `frontend/app/api/reputation/route.ts` | live | 02 |
| `/api/evolution` | `frontend/app/api/evolution/route.ts` | live | 02 |
| `/api/challenge` | `frontend/app/api/challenge/route.ts` | per-request | 02 |

## GitHub Actions workflows

| Name | Source | Expected cadence | Owner audit |
|------|--------|------------------|-------------|
| `agent-cycle.yml` | `.github/workflows/agent-cycle.yml` | hourly at :17 | 03 |
| `ci.yml` | `.github/workflows/ci.yml` | on push / PR | 03 |

## Deployed contracts (Mantle Mainnet, chainId 5000)

| Name | Address | Owner audit |
|------|---------|-------------|
| TuringVaultIdentity | `0x6f862802e0d5463DF18d267e422347BeCacc28bD` | 04 |
| TuringVaultDecisionLog | `0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5` | 04 |
| TuringVaultValidationRegistry | `0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6` | 04 |
| TuringVaultRouter | `0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001` | 04 |
| ReputationRegistry | `0xC78119F3274B05046Ac7c38a14298a6cbD946e1a` | 04 |
| TuringVaultValidation | `0x0aeEd88959fCFC665284225dB93DED3e8A3Ff705` | 04 |

Agent EOA: `0xDC783CDBfA993f3FC299460627b204E83bf4fb5a`

## State files (committed by the cron)

| Path | Writer | Expected cadence | Owner audit |
|------|--------|------------------|-------------|
| `data/last-cycle-summary.json` | `scripts/run-cycle.js` | hourly | 05 |
| `data/cycle-history.json` | `scripts/run-cycle.js` | hourly | 05 |
| `data/discipline-history.json` | `src/orchestrator/disciplineHistory.js` | hourly | 05 |
| `data/intent_queue.json` | `src/orchestrator/integratedOrchestrator.js` | per cycle | 05 |
| `data/challenge-budget.json` | `src/orchestrator/challengeBudget.js` | per challenge invocation | 05 |
| `src/data/outcomes.json` | `src/orchestrator/outcomeTracker.js` | per cycle (atomic write) | 05 |
| `src/data/parse_metrics.json` | `src/orchestrator/parseMetrics.js` | per cycle | 05 |
| `src/data/threshold_state.json` | thresholds module | per cycle | 05 |
| `src/data/position_state.json` | `src/strategies/positionState.js` | event-driven | 05 |
| `src/data/trajectories.json` | `src/orchestrator/trajectoryLogger.js` | per cycle | 05 |
| `src/data/grid_bot_state.json` | legacy grid bot (paused) | static | 05 (low pri) |
| `src/data/grid_config.json` | legacy grid bot | static | 05 (low pri) |
| `src/data/grid_param_history.json` | legacy grid bot | static | 05 (low pri) |
| `src/data/grid_trades.json` | legacy grid bot (paused 2026-05-23) | static | 05 (low pri) |

## External APIs

| Service | URL | Used by | Owner audit |
|---------|-----|---------|-------------|
| Mantle RPC | `https://rpc.mantle.xyz` | cron + frontend | 07 |
| Pinata IPFS | `https://api.pinata.cloud`, `https://gateway.pinata.cloud` | cron pin + frontend reads | 07 |
| AWS Bedrock | `bedrock-runtime.us-east-1` | Analyst (GLM via Bedrock proxy) | 07 |
| Vertex AI | `aiplatform.googleapis.com` | Arbiter (Gemini 3.5) | 07 |
| Anthropic API | `api.anthropic.com` | Validator (Claude 4.6) | 07 |
| CoinGecko | `api.coingecko.com` | price oracle | 07 |
| Elfa V2 | `api.elfa.ai` | social signals | 07 |
| Nansen | `api.nansen.ai` | smart-money signals | 07 |
| Mantlescan | `api.mantlescan.xyz` | TX classification (read-only) | 07 |
| Sourcify | `sourcify.dev` | contract verification | 07 |

## Documents

| Path | Type | Owner audit |
|------|------|-------------|
| `README.md` | claims + setup | 08 |
| `docs/pitch-deck/index.html` | submission deck | 08 |
| `docs/pitch-deck/turingvault-pitch.pdf` | exported deck | 08 |
| `assets/agent-card.json` | ERC-8004 agent card | 08 |
| `agent-card-v2.json` | ERC-8004 agent card v2 | 08 |
| `SUBMISSION.md` | DoraHacks submission text | 08 (if present) |
| `docs/discipline-layer.md` | feature doc | 08 |

## Cron-Vercel bridge surfaces

| Surface | Owner audit |
|---------|-------------|
| GH Actions repo secrets (names only) | 09 |
| Vercel project env vars (names only) | 09 |
| Filesystem fallback paths in API routes | 09 |
| Vercel "Ignored Build Step" config | 09 |

## Vercel runtime

| Surface | Owner audit |
|---------|-------------|
| Last 10 deployments (state, duration) | 10 |
| Function build logs (errors) | 10 |
| Function runtime errors (5xx in /api/health, /api/strategy) | 10 |
| Cache-Control headers | 10 |
| Bundle analysis | 10 |

## Secrets + supply chain

| Surface | Owner audit |
|---------|-------------|
| `git log --all -p` content | 11 |
| `.gitignore` rules | 11 |
| `npm audit` (root + frontend) | 11 |
| `process.env.<SECRET>` access pattern in code | 11 |
| Pinata JWT expiry | 11 |

## Threat model actors

| Actor | Owner audit |
|-------|-------------|
| Anonymous web visitor | 12 |
| Hostile GitHub PR contributor | 12 |
| Compromised Vercel env | 12 |
| Compromised GH Actions runner | 12 |
| Compromised agent EOA private key | 12 |
| Hostile Elfa/Nansen payload | 12 |
| Hostile CoinGecko price feed | 12 |

## Design + UX

| Surface | Owner audit |
|---------|-------------|
| Typography system | 13 |
| Color tokens | 13 |
| Spacing/grid | 13 |
| Hierarchy + focus per page | 13 |
| Microinteractions inventory | 13 |
| Motion/animation inventory | 13 |
| Hero/wow audit | 13 |
| Information design (stat cards) | 13 |
| Lighthouse + axe-core scores | 13 |
| Side-by-side vs Linear/Vercel/Mercury | 13 |

## Orphaned claims

Surfaces mentioned in README that were NOT found in code or live URL.

| Claim source | Surface | Issue |
|--------------|---------|-------|
| README "agent EOA last 24h on Mantlescan" | Mantlescan filter URL | format depends on explorer; not deep-linked |
| README "discipline-layer.md" | local doc | exists, OK |
| README `/api/elfa-snapshot?symbol=ETH` | needs query param to be useful | flagged for 02 |

No orphaned claims found that are P0 (every page mentioned has a
source file or generated HTML).

## Not checked

| Surface | Reason |
|---------|--------|
| Lighthouse / axe scores | Playwright not installed in this session; deferred to first re-audit |
| Vercel deployments | needs `VERCEL_TOKEN` from Vercel CLI env, will probe in 10 |
| GH secrets list | needs `gh` CLI which is not installed; will list in 09 from workflow file |
| Bundle sizes | needs `next build` output dump, deferred to 10 |
