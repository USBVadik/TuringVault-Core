# Risk-on Grid Execution Design

Date: 2026-06-01

## Goal

Make the live agent capable of small risk-on grid entries when the wallet is stable-heavy and price is near the lower band, while preserving validator/arbiter safety gates and Mantle asset correctness.

## Root Causes

1. Valid analyst HOLD output with `expectedYield: null` can fail Zod validation because the schema only accepts strings.
2. The LLM currently decides whether a grid opportunity exists. In fearful/ranging markets it often converts lower-band setups into HOLD, so no risk-on proposal reaches execution.
3. The live ledger does not clearly show the deterministic grid candidate that was considered before the final no-trade decision.

## Design

Add a pure `gridTradeCandidate` module that converts structured grid signals plus portfolio posture into a concrete candidate:

- `BUY_mETH` on the ETH grid -> risk-on `mETH`
- `BUY_mETH` on the MNT grid -> risk-on `MNT`/`WMNT`
- lower-band stable-heavy re-entry -> small risk-on candidate if there is no confirmed down-breakout
- `SELL_mETH` remains risk-off and is still blocked by portfolio guard when redundant

The candidate is injected into the LLM prompt and, when the analyst abstains while the deterministic candidate is actionable, promoted into the analyst proposal for validator review. This keeps Claude/Gemini as the safety layer, but removes the "no proposal ever reaches review" failure mode.

## Execution Safety

- Candidate sizes are small: default 10-15% allocation, still capped by `RWA_MAX_PER_CYCLE_USD`.
- Portfolio guard must still allow risk-on only when stable inventory exists and risk share is below the ceiling.
- Mantle execution targets remain `mETH`, `MNT`, or `WMNT`; `ETH` is only a market/reference asset.

## Telemetry

Persist `gridTradeCandidate` into outcomes so the morning audit can distinguish:

- no candidate
- candidate rejected by analyst
- candidate promoted to validator
- validator/portfolio/router/execution block

## Tests

- `expectedYield: null` is accepted and does not create parse failure.
- stable-heavy FLAT lower-band setup emits a risk-on mETH candidate.
- confirmed downward EXIT_RANGING does not emit risk-on.
- portfolio guard still allows risk-on from stable-heavy inventory.
