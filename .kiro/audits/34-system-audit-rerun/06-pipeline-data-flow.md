# Audit 34 - Pipeline Data Flow

Generated: 2026-05-31
Primary evidence: `raw/pipeline-data-cards.md`, `raw/pipeline-ipfs-probes.md`, `raw/api/api_decisions.json`

## Data Cards

### Recent EXECUTED_SWAP

| Field | Value |
| --- | --- |
| decisionId | 189 |
| recordedAt | 2026-05-31T08:23:59.760Z |
| action | swap |
| targetAsset | mUSD |
| tier | EXECUTED_SWAP |
| consensus | true |
| confidence | 0.66 |
| executedOnChain | true |
| directionalSwap.executed | true |
| directionalSwap.legs | 2 |
| IPFS CID | `QmTFteahKFiY954fPGDDYCkyGKnnao9WM9RjtRbifHKSRC` |

This was a risk-off swap into mUSD, not a risk-on purchase of mETH/MNT.

### Recent BLOCKED_BY_LOW_CONFIDENCE

| Field | Value |
| --- | --- |
| decisionId | 184 |
| recordedAt | 2026-05-30T23:45:40.793Z |
| action | hold |
| targetAsset | mETH |
| tier | BLOCKED_BY_LOW_CONFIDENCE |
| consensus | false |
| confidence | 0.52 |
| arbiterVote | approve |
| IPFS CID | `QmcHLs4MPxv3Qkrg4qnCg6Nsc9u6AXYj6ej2CuWZrtMjm8` |

This is the closest captured risk-on-ish mETH target, but it was held/blocked by low confidence.

## IPFS Probe

Both sampled CIDs fetched via `ipfs.io` with HTTP 200. Payloads contained expected proof keys including market context, analyst, validator, and consensus.

## Findings

| ID | Severity | Surface | Finding | Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| A34-PIPE-01 | P1 | Live trading behavior | The most recent executed swap found by Audit 34 is still risk-off into mUSD. The sampled mETH target was blocked by confidence. This supports the user's observation that the bot is not yet buying risk assets in live execution. | `raw/pipeline-data-cards.md` | open |
| A34-PIPE-02 | P1 | Proof coverage | IPFS proof exists for sampled cycles, but latest manifest/decision counts are not fully aligned with current on-chain proposal totals. | `raw/pipeline-ipfs-probes.md`, `04-on-chain.md` | open |
| A34-PIPE-03 | P2 | Quality checks | The full old R7 five-check rubric was only partially rerun; signal freshness and validator disagreement frequency need a deeper pass. | this report | open |

## Not Checked

- Raw model outputs for decision IDs were not found/validated in this pass.
- Nansen/smart-money signal presence inside each sampled prompt was not independently proven.
- Validator disagreement across the latest 20 cycles was not recomputed in this pass.
