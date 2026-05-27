# Requirements Document

## Introduction

The Discipline Layer (`src/orchestrator/disciplineLayer.js`, inspired
by Synrail) runs on every multi-agent cycle and verifies execution
claims through three gates:

1. **TX Proof** — does the claimed swap exist on chain, signed by our
   wallet, with N confirmations and `status==1`?
2. **Price Freshness** — was the price data used in the decision
   < 60 s old at decision time?
3. **Strategy Drift** — does the action match the declared regime?
   (e.g. swapping during CRISIS = drift)

When any gate fails, the verifier returns `status: 'BLOCKED'` with a
`blockReason` and `repairStep` so the operator can correct the loop.

**The problem:** all of this is only visible in the cron's stdout log.
A judge opening the dashboard sees zero evidence the layer exists,
and `outcomes.json` only persists the rolled-up `status` string
(`ACCEPTED` / `BLOCKED` / `SKIPPED`) — the per-check breakdown is lost
the moment the cycle ends.

This spec brings the Discipline Layer to the surface:

- Persist the full per-cycle gate breakdown to a new
  `data/discipline-history.json` (rolling last 100 cycles)
- Expose `/api/discipline` returning the latest cycle's checks and the
  rolling history
- Add a strip on the landing page: "Last cycle Discipline gates
  ✓ tx_proof · ✓ price_freshness · ✓ drift_detection"
- Optional `/discipline` page with the full history table and
  per-cycle drill-down

This is one of the **three defining features** the AI x RWA Track
rubric explicitly rewards (radical transparency / live observable
agents). Discipline Layer is the strongest unique narrative we have
that judges currently can't see.

## Glossary

- **Cycle** — one invocation of `runMultiAgentCycle`. Each cycle runs
  the discipline verifier exactly once (or zero times for fully
  rejected proposals before execution).
- **Gate** — one of the three checks: `tx_proof`, `price_freshness`,
  `drift_detection`.
- **Status per check** — `PASS | FAIL | WARN | SKIP | ERROR`.
- **Cycle verdict** — rolled-up `ACCEPTED | BLOCKED | SKIPPED` based
  on whether any gate `FAIL`ed.

## Requirements

### Requirement 1: Persist per-cycle Discipline result

**User Story:** As a judge, I want to see every gate's pass/fail
status for every cycle, not just the rolled-up verdict.

#### Acceptance Criteria

1. THE multi-agent cycle SHALL persist the **full** Discipline result
   object (including `checks[]` array and any `blockReason` /
   `repairStep`) to `outcomes.json` under a new key
   `disciplineDetail`. The existing flat `disciplineStatus` field
   stays for backwards-compat.

2. THE cycle SHALL also append a compact entry to
   `data/discipline-history.json` per cycle: `{ at, decisionId,
verdict, checks: [{ name, status }], blockReason | null }`.

3. THE history file SHALL keep at most the last 100 entries (rolling)
   to prevent unbounded growth.

4. WHEN the verifier crashes (RPC outage, etc.), the cycle SHALL
   record `{ verdict: 'ERROR', error: '<short>' }` in history rather
   than skipping the entry — judges should see degraded states too.

### Requirement 2: `/api/discipline` endpoint

**User Story:** As a frontend developer, I want a single endpoint that
gives me everything the Discipline strip and page need.

#### Acceptance Criteria

1. `GET /api/discipline` SHALL return:

   - `latest` — last cycle's full Discipline detail
   - `history` — last 30 entries (compact)
   - `summary` — aggregate over last 100: `{ acceptedCount,
blockedCount, skippedCount, errorCount, gatePassRates: { tx_proof,
price_freshness, drift_detection } }`

2. WHEN any source file is missing (fresh deployment), the endpoint
   SHALL return defaults (empty arrays, null `latest`) and HTTP 200.

3. NO secret-bearing fields shall leak (cross-checked via grep
   before commit).

### Requirement 3: Landing-page Discipline strip

**User Story:** As a judge skimming the dashboard, I want to see at
a glance that post-execution verification is alive.

#### Acceptance Criteria

1. THE strategy/strip section of `frontend/app/page.tsx` SHALL render
   a new row: `Discipline Layer · last cycle: ✓ tx_proof · ✓
price_freshness · ✓ drift_detection` (icons + tooltips).

2. WHEN the latest cycle has any FAIL, the strip SHALL render the
   failed gate in red and surface the `blockReason` in a tooltip.

3. WHEN no Discipline data exists yet (fresh deploy), the row SHALL
   render `not yet recorded` muted, no error.

4. THE row SHALL include a "View history" link to `/discipline`.

### Requirement 4: `/discipline` page

**User Story:** As a judge clicking through, I want to see the rolling
history of all Discipline checks.

#### Acceptance Criteria

1. THE page SHALL render a table of the last 30 cycles with columns:
   `cycle id · time · verdict · tx_proof · freshness · drift ·
block reason (if any)`.

2. AT the top of the page, render the `summary` block from the API:
   counts + gate pass rates as percentages.

3. CLICKING a row SHALL expand a drill-down with the full
   `disciplineDetail` (checks array verbatim, blockReason, repairStep).

4. THE page SHALL show "first cycle ran <relative time> ago" footer
   for chronological context.

5. NO copy on the page SHALL describe gates as "always passing" or
   "running 24/7" — verdict reflects reality.

### Requirement 5: Honest empty states

**User Story:** As a judge, I want the dashboard to clearly indicate
when there's no data yet rather than fabricating.

#### Acceptance Criteria

1. WHEN `discipline-history.json` is empty, the strip on the home
   page renders `Discipline Layer · awaiting first cycle` muted, no
   green checkmarks.

2. WHEN the most recent entry is > 6 hours old, the strip renders
   yellow `Last check stale (Xh ago)` instead of green.

3. WHEN the latest cycle's `verdict === 'ERROR'`, the strip renders
   yellow with the error message in tooltip.

## Non-Functional Requirements

### NFR1: Repo size discipline

`discipline-history.json` is rolling 100 entries × ~600 B each =
60 KB. Tiny. Cron commit-back picks it up like any other state file.

### NFR2: No new on-chain TXs

This spec changes ZERO smart-contract code. All persistence is
off-chain JSON.

### NFR3: Backward compatibility

The existing `disciplineStatus` flat string in `outcomes.json` stays
untouched. Adding `disciplineDetail` next to it is purely additive.

### NFR4: One-cycle latency

The strip on the home page reads `data/discipline-history.json`,
which is committed by the cron. Front-end sees a new cycle's data
~60-90 s after the cron pushes (Vercel rebuild). Acceptable.

## Success Criteria

This spec is done WHEN:

1. `data/discipline-history.json` is committed by the cron and
   contains at least 3 entries
2. `/api/discipline` returns valid `latest` + `history` + `summary`
3. The landing-page strip renders the gate icons (or honest empty
   state) on the live dashboard
4. The `/discipline` page renders the full table + summary
5. Honesty checklist passes (no fabricated checks, empty states are
   honest)
6. README has a one-paragraph "Discipline Layer dashboard" subsection
   linking to `/discipline`

## Out of scope

- On-chain Discipline gate recording (a separate `DisciplineRegistry`
  contract) — interesting but premature
- Per-check timing telemetry — out of scope, console log already has it
- Repair-step automation (e.g., automatic re-fetch on stale price) —
  the existing `repairStep` field is human-readable guidance; spec
  doesn't change that
- Discipline Layer applied to non-cycle paths (e.g., the /challenge
  page) — challenges don't execute swaps so there's nothing to verify
