# Audit 34 - Documents and Claims

Generated: 2026-05-31
Primary evidence: `raw/docs-claims.md`

## Spot-check Results

| Claim | Source | Live artifact | Verdict |
| --- | --- | --- | --- |
| 158 scheduled decisions | README snapshot | live decisions total 203 | stale but labelled snapshot |
| 41% rejection rate | README snapshot | live 70/203 = 34.5% | stale but labelled snapshot |
| +1757 bps realised PnL | README | live `/api/performance` +1757 bps | matches |
| cron status live-only | README | health 21 success / 0 fail / lastCycleAge 4673 | honest |
| local `assets/agent-card.json` total 158 | asset snapshot | live `/api/agent-card` total 203 | stale local snapshot |
| Sourcify 5/6 current truth | README/contracts/API | current chain probe 5/6 perfect | matches API truth |

## Findings

| ID | Severity | Surface | Finding | Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| A34-DOC-01 | P1 | `assets/agent-card.json` | Local agent-card snapshot is stale at 158 decisions while live card reports 203. If the static asset is shipped or submitted, it should be refreshed. | `raw/docs-claims.md` | open |
| A34-DOC-02 | P2 | README stats | README snapshot stats are stale but labelled as a snapshot. Keep them time-bounded or replace with live-generated badges. | `raw/docs-claims.md` | open |
| A34-DOC-03 | P0 | `/proof-explorer` copy | Live UI stale proof copy is not merely a docs issue; it is user-visible. Tracked as A34-UI-01/A34-CHAIN-01. | `01-ui-pages.md`, `04-on-chain.md` | open |

## Not Checked

- The old R9 requirement of 30+ extracted claims was not fully repeated.
- Pitch deck claims were not re-extracted in this pass.
