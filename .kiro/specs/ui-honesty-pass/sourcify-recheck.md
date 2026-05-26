# Sourcify recheck — when and how

## When

Re-run the Sourcify status check whenever:

1. **A contract is redeployed** (intentional or accidental). The new bytecode invalidates the previous match.
2. **Sourcify itself shows downtime** that resolves later — the snapshot may need to be re-taken if state changed during the outage.
3. **Before final submission to DoraHacks** — sanity check that nothing drifted in the days/weeks since the last snapshot.

We explicitly do **not** redeploy contracts during the hackathon. Existing 5+ deployments preserve the on-chain decision history that backs the project narrative.

## How

```bash
bash scripts/check-sourcify.sh
```

Reads `frontend/app/data/contracts.json`, queries the Sourcify server API for each address on Mantle (chain 5000), prints `✓` for matches and `✗` for drift.

Exits non-zero if any contract drifts. Update `contracts.json` with the new state if the drift is intentional.

## Current snapshot baseline (2026-05-26)

- 6 contracts: full_match on Sourcify.
- 1 contract (TuringVaultRouter `0x8187…7001`): **none** — bytecode not matched.

The Router unverified status is acknowledged here and will be addressed in a later spec (likely `agent-reasoning-quality` or `submission-rewrite`). For now the dashboard footer shows this contract honestly as "Router (deployed; not yet wired into agent execution path)" with no Sourcify badge.

## Rationale

Sourcify lookups at runtime introduce:
- Latency on every dashboard render
- A failure mode (Sourcify down → "verified" badge disappears for live users)
- A trust shift from the build to a third-party API

Build-time snapshot avoids all three: deterministic, fast, and the dashboard shows what we attested to during release.
