# Audit 34 - UI Pages

Generated: 2026-05-31
Primary evidence: `raw/_fetch-summary.md`, `raw/ui/`, `raw/design/screens/`, `raw/design/dom-measurements-summary.md`

## Probe Summary

| Page | HTTP | Cache | Flags | Notes |
| --- | ---: | --- | --- | --- |
| `/` | 200 | HIT | none | live page served, 63 KB HTML |
| `/backtest` | 200 | PRERENDER | none | static/prerendered |
| `/challenge` | 200 | PRERENDER | none | static/prerendered |
| `/discipline` | 200 | PRERENDER | none | static/prerendered shell |
| `/proof-explorer` | 200 | HIT | `old-proof-copy` | visible stale Sourcify/proof copy detected |
| `/social` | 200 | PRERENDER | none | static/prerendered |
| `/replay` | 200 | STALE | none | cached stale response accepted |

## Key Findings

| ID | Severity | Surface | Finding | Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| A34-UI-01 | P0 | `/proof-explorer` | The page still contains old proof copy while current contract truth is 5/6 Sourcify-verified current contracts. This is user-visible trust copy. | `raw/_fetch-summary.md`, `raw/design/dom-measurements-summary.md` | open |
| A34-UI-02 | P1 | `/` | Mobile overflow detected. | `raw/design/dom-measurements-summary.md` | open |
| A34-UI-03 | P1 | `/discipline` | Mobile overflow detected. | `raw/design/dom-measurements-summary.md` | open |
| A34-UI-04 | P2 | `/`, `/proof-explorer`, `/social` | Several tap targets measure below comfortable mobile target size. | `raw/design/dom-measurements-summary.md` | open |

## Per-page Notes

| Page | Verbatim/visible claim checked | Backing reality |
| --- | --- | --- |
| `/` | "Proof-of-Reasoning" | API/proof path is live, but latest replay manifest coverage lags current proposal count. |
| `/backtest` | "Outcome Score" | `/api/performance` returned NAV 135.38 and +1757 bps. |
| `/challenge` | "Adversarial Challenge" | `/api/challenge` returned 200 with challenge payload. |
| `/discipline` | "Discipline Layer" | `/api/discipline` returned 200 and recent data. |
| `/proof-explorer` | old Sourcify/proof copy | Contradicts current 5/6 current contract truth and should be refreshed. |
| `/social` | "Elfa REST v2" | `/api/elfa-snapshot` returned 200. |
| `/replay` | replay listing | Page returned 200, but individual replay detail was not probed. |

## Not Checked

- `/replay/[id]` detail page, because Audit 34 did not bind a representative ID to the UI probe.
- Full text extraction per page beyond the stale proof-copy scanner.
