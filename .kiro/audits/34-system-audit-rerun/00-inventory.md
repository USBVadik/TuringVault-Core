# Audit 34 - Surface Inventory

Generated: 2026-05-31
Scope source: `.kiro/specs/system-audit-pre-submission/tasks.md`
Raw artifacts: `raw/`

## UI Pages

| Page | Route | Source | Live probe | Expected freshness |
| --- | --- | --- | --- | --- |
| Home | `/` | `frontend/app/page.tsx` | 200 | live-ish, cached |
| Backtest | `/backtest` | `frontend/app/backtest/page.tsx` | 200 | static/API-backed |
| Challenge | `/challenge` | `frontend/app/challenge/page.tsx` | 200 | static/API-backed |
| Discipline | `/discipline` | `frontend/app/discipline/page.tsx` | 200 | API-backed |
| Proof Explorer | `/proof-explorer` | `frontend/app/proof-explorer/page.tsx` | 200 | API/on-chain backed |
| Replay | `/replay` | `frontend/app/replay/page.tsx` | 200 | API-backed |
| Replay detail | `/replay/[id]` | `frontend/app/replay/[id]/page.tsx` | not probed | dynamic |
| Social | `/social` | `frontend/app/social/page.tsx` | 200 | API-backed |

## API Routes

| Route | Source | Live probe |
| --- | --- | --- |
| `/api/agent-card` | `frontend/app/api/agent-card/route.ts` | 200 |
| `/api/backtest` | `frontend/app/api/backtest/route.ts` | 200 |
| `/api/challenge` | `frontend/app/api/challenge/route.ts` | 200 |
| `/api/cron/trigger-cycle` | `frontend/app/api/cron/trigger-cycle/route.ts` | 500 |
| `/api/decisions` | `frontend/app/api/decisions/route.ts` | 200 |
| `/api/discipline` | `frontend/app/api/discipline/route.ts` | 200 |
| `/api/elfa-snapshot` | `frontend/app/api/elfa-snapshot/route.ts` | 200 |
| `/api/evolution` | `frontend/app/api/evolution/route.ts` | 200 |
| `/api/health` | `frontend/app/api/health/route.ts` | 200 |
| `/api/market` | `frontend/app/api/market/route.ts` | 200 |
| `/api/performance` | `frontend/app/api/performance/route.ts` | 200 |
| `/api/proof-explorer` | `frontend/app/api/proof-explorer/route.ts` | 200 |
| `/api/reasoning` | `frontend/app/api/reasoning/route.ts` | 200 |
| `/api/replay` | `frontend/app/api/replay/route.ts` | not probed |
| `/api/replay/[id]` | `frontend/app/api/replay/[id]/route.ts` | not probed |
| `/api/reputation` | `frontend/app/api/reputation/route.ts` | 200 |
| `/api/strategy` | `frontend/app/api/strategy/route.ts` | 200 |
| `/api/yield-meth` | `frontend/app/api/yield-meth/route.ts` | 200 |

## Workflows

| Workflow | Source | Purpose | Fresh probe |
| --- | --- | --- | --- |
| Agent cycle | `.github/workflows/agent-cycle.yml` | scheduled trading/reasoning cycle | last 20 scheduled runs succeeded |
| CI | `.github/workflows/ci.yml` | tests/build checks | last 5 push runs succeeded |
| Replay validator | `.github/workflows/replay-validator.yml` | replay/proof validation | inventoried, not deep-probed |

## Contracts

Source: `deployments.json`, Mantle chain id 5000.

| Contract | Address | Purpose |
| --- | --- | --- |
| TuringVaultIdentity | `0x6f862802e0d5463DF18d267e422347BeCacc28bD` | ERC-8004 identity NFT |
| TuringVaultDecisionLog | `0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5` | append-only decision log |
| TuringVaultValidationRegistry | `0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6` | consensus validation scores |
| TuringVaultRouter | `0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001` | trade routing |
| ReputationRegistry | `0xC78119F3274B05046Ac7c38a14298a6cbD946e1a` | agent reputation |
| TuringVaultValidation | `0x0aeEd88959fCFC665284225dB93DED3e8A3Ff705` | ERC-8004 pre-action validation |

## State Files

High-traffic state files are in `data/` and `src/data/`; see `05-state-files.md` and `raw/state/state-files.md`.

Key live files:

- `data/cycle-history.json`
- `data/discipline-history.json`
- `data/last-cycle-summary.json`
- `src/data/outcomes.json`
- `src/data/parse_metrics.json`
- `src/data/threshold_state.json`
- `src/data/position_state.json`

Potentially stale or inactive files:

- `data/intent_queue.json`
- `src/data/grid_bot_state.json`
- `src/data/grid_config.json`
- `src/data/grid_param_history.json`
- `src/data/grid_trades.json`
- `src/data/trajectories.json`

## External Dependencies

| Dependency | Purpose | Probe status |
| --- | --- | --- |
| Mantle RPC | chain reads/writes | JSON-RPC code/balance probe works; simple GET returns 404 |
| Pinata gateway | IPFS proof reads | reachable, 301 on sample public CID |
| Pinata API | pin/auth health | reachable, 401 without auth |
| CoinGecko | market price data | 200 |
| Elfa V2 | social signal | 200 |
| Mantlescan | explorer/tx metadata | 200 |
| Sourcify | contract verification | 200 |
| AWS Bedrock | analyst/validator model path | not probed, SDK auth required |
| Vertex/Gemini | arbiter model path | not probed, SDK auth required |
| Nansen/Smart Money flow | market context | not independently probed in Audit 34 |

## Inventory Gaps

- `/replay/[id]` and `/api/replay/[id]` need representative IDs for full probing.
- Vercel deployment metadata could not be enumerated because the audit script queried a project name as `projectId`.
- GitHub/Vercel secret parity cannot be verified without operator-provided secret name lists.
