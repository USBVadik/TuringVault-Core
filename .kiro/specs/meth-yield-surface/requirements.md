# mETH Native Yield Surface — Requirements

**Spec for**: AI x RWA Track ($25k, Mantle Turing Test 2026).
**Goal**: Surface the passive yield TuringVault already earns on its
mETH balance as a separate yield stream from active agent trading
PnL. Closes the "no actual yield" rubric gap on AI x RWA Depth
without taking on counterparty risk through any new lending
integration.

## Why this is the right move

Audit 22 first deep-research run identified "no actual yield" as
the single biggest AI x RWA Depth gap. The naive fix (Aave V3 supply)
is now under hard taboo (audit 22 CORRECTION + steering rule
`external-integration-due-diligence.md`) because of Aave's recent
incident history.

mETH (Mantle Liquid Staked Ether) is value-accumulating: the wallet
balance stays constant while the redemption rate per mETH grows as
ETH staking rewards land. The agent already holds mETH (~0.006 mETH
≈ $13 at time of writing) — surfacing this on the dashboard adds a
second, **honestly-labelled** yield engine without any new on-chain
integration, no signing key risk, no counterparty contract.

Risk panel — mETH on Mantle (read-only surface):
  Incident history (90d):    NO — LayerZero + Mantle confirmed
                             rsETH/KelpDAO incident was isolated to
                             rsETH; mETH unaffected.
  Active bad debt:           NO (mETH is a token, not a market)
  Oracle integrity (90d):    OK — exchange-rate oracle updates
                             every 8h, no public misconfigurations
  Cross-chain exposure:      NONE for our reading (rate sourced
                             from L1 Staking contract via public
                             read endpoints + DefiLlama API)
  Active governance crisis:  NO
  Recovery status:           none-needed
  Net verdict:               SAFE
  Last checked:              2026-05-29

## R1 — Honesty-first labelling (binding)

The dashboard MUST distinguish three things in copy and visually:

R1.1 **"Active Trading PnL"** — sum of `pnlBps` across settled
outcomes (already shown).

R1.2 **"Passive Protocol Yield (mETH LST)"** — `current mETH
balance × (current redemption rate − reference redemption rate)`,
labelled with the data source (Mantle mETH Staking contract on
Ethereum L1, exchange-rate oracle, last-update timestamp).

R1.3 **"Combined Returns"** — only shown if R1.1 and R1.2 are
visually separable in the same view. Cumulative; no obfuscation
of the split.

Workspace honesty rule §3 ("no phantom PnL") applies: under no
circumstance is the mETH yield labelled as agent-generated alpha.
The pitch line must be: *"the agent picked the right RWA-shaped
asset to hold and proved that allocation on-chain; the asset
itself accrues native yield."*

## R2 — Reference rate must be honest about its provenance

We do NOT backfill yield from before this feature ships. The
reference rate is captured at the moment the surface goes live
("Yield since dashboard launch"), and that moment is rendered as
an ISO timestamp in the UI. Captures from the upstream rate feed
are stored to disk per cycle.

Backfill option (deferred): once we have per-cycle rate snapshots,
we could attribute mETH yield to historical settled outcomes that
held mETH, but the backfill must be transparent — every backfilled
period flagged "calculated retrospectively" until the dashboard
captures rate at decision time live.

## R3 — Data source resilience (steering rule §1, no fake liveness)

R3.1 Primary data source: DefiLlama yield API
(`https://yields.llama.fi/pools` filtered by `project=mantle-meth`
or equivalent). DefiLlama is widely-cited, public, no API key,
ticked every minute, and explicitly attributed in our copy.

R3.2 Secondary: Mantle's own meth.mantle.xyz public stats endpoint
(`https://meth.mantle.xyz/api/...`) if DefiLlama returns an empty
or stale entry.

R3.3 Tertiary: direct read from L1 Ethereum mainnet via public
RPC (cloudflare-eth.com or eth.llamarpc.com) calling the
canonical mETH Staking contract on L1 (Mantle published address).
This is cold-fallback only — we do not want to add an L1 RPC as
a hot path dependency.

R3.4 Persistent disk snapshot: `src/data/meth_rate_history.json`
holding the last N successful captures with timestamps and source
provenance. If all three live sources fail, we serve the most
recent snapshot with a `cached:` provenance label and show its
age explicitly (steering rule §1).

R3.5 The `/api/yield-meth` endpoint and homepage card must label
provenance per render: `via:defillama`, `via:meth.mantle.xyz`,
`via:l1-rpc`, or `cached:<source> · age <N>m`. No silent fallback.

## R4 — Failure modes surfaced

R4.1 If mETH redemption rate goes negative (catastrophic depeg),
the dashboard surfaces a red "mETH peg drift" pill on the homepage
performance card. The pill links to a brief explainer.

R4.2 If all three live sources fail and the disk snapshot is
older than 24h, the yield row renders with the value greyed out
and labelled `Stale · last sync <ISO ts>`.

## R5 — Data flows

R5.1 Cron loop captures the redemption rate at cycle close,
appends to `src/data/meth_rate_history.json`. This is added to the
existing per-cycle write block in `multiAgentLoop.js` after the
outcome record but before commit.

R5.2 `/api/yield-meth` API route reads disk + on-demand live
fetch, returns:
  - `currentRate` (mETH→ETH, 18 decimals as bigint string)
  - `referenceRate` (rate at surface launch, ditto)
  - `mETHBalance` (wallet's current mETH balance)
  - `passiveYieldEthAtomic` (current mETH balance × Δ rate)
  - `passiveYieldUsd` (USD value at current ETH price)
  - `apyAnnualizedPct` (most recent published mETH APY from feed)
  - `source` (provenance label)
  - `lastSync` (ISO ts)
  - `degraded` (boolean, true when serving snapshot or stale)

R5.3 Homepage performance card adds a row labelled
"Passive Protocol Yield (mETH LST)" with value, APY, source pill,
and tooltip with full attribution. It is visually separated from
"Active Trading PnL".

R5.4 `/backtest` page equity curve adds an optional second line
"Passive Yield Curve" derived from per-cycle rate snapshots in
`meth_rate_history.json`. Toggleable. Not enabled by default until
we have ≥30 captures (one cycle's worth).

## R6 — No regressions

R6.1 Existing `/api/performance` continues to return the
`cumulativePnlBps` field unchanged (still strictly active trading,
not combined). Add a NEW field `passiveYield` block with the
same schema as R5.2.

R6.2 Existing homepage stats grid retains "Win Rate", "Settled
Outcomes", "Cumulative PnL" exactly as today. The mETH yield row
is additive.

R6.3 No existing tests break. Add new unit tests for the rate
fetch chain and the disk snapshot resilience path.

## R7 — Out of scope (now)

R7.1 USDY yield surface (USDY pool dry on Mantle; module is
paper-ready, not live).
R7.2 Any external lending integration (hard taboo per
`.kiro/steering/external-integration-due-diligence.md`).
R7.3 cmETH (restaked variant) — possibly relevant later, but
dashboard surfaces only what the agent actually holds.
R7.4 Backfill of historical mETH yield to settled outcomes —
deferred until the rate-history dataset has ≥7 days of captures.

## Acceptance criteria

A1 Homepage performance section visibly separates active trading
PnL from passive mETH yield, both labelled with sources.

A2 `/api/yield-meth` returns valid JSON with provenance for every
request, including under simulated upstream failure (test).

A3 No claim anywhere conflates the two yield streams; pitch deck
+ README updated with the dual-engine framing.

A4 jest test suite passes (unit tests for rate sources +
honesty-rule guards).

A5 frontend lint/build clean.

A6 README claim grid updated with a new claim row pointing at
the live yield surface.
