# Audit 34 - Design and UX

Generated: 2026-05-31
Primary evidence: `raw/design/screens/`, `raw/design/screens-manifest.json`, `raw/design/dom-measurements-summary.md`, `raw/design/lighthouse/_summary.json`

## Screenshot Coverage

Screenshots were captured for 6 pages at 1440, 768, and 375 widths:

- `/`
- `/backtest`
- `/challenge`
- `/discipline`
- `/proof-explorer`
- `/social`

`/replay` and `/replay/[id]` were not screenshoted in this pass.

## Lighthouse Summary

| Page | Performance | Accessibility | Best practices | SEO |
| --- | ---: | ---: | ---: | ---: |
| `/` | 73 | 100 | 100 | 100 |
| `/backtest` | 86 | 91 | 100 | 100 |
| `/challenge` | 92 | 92 | 100 | 100 |
| `/discipline` | 85 | 93 | 100 | 100 |
| `/proof-explorer` | 84 | 93 | 100 | 100 |
| `/social` | 87 | 100 | 100 | 100 |

## DOM Measurement Findings

| Page | Mobile overflow | Tiny targets | Old proof copy |
| --- | --- | ---: | --- |
| `/` | true | 37 | false |
| `/backtest` | false | 1 | false |
| `/challenge` | false | 1 | false |
| `/discipline` | true | 1 | false |
| `/proof-explorer` | false | 12 | true |
| `/social` | false | 8 | false |

## 8-dimension Quick Scorecard

| Page | Type | Spacing | Color | Hierarchy | Microinteractions | Motion | Hero/wow | Info design | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `/` | 3 | 3 | 3 | 3 | 2 | 3 | 3 | 3 | mobile overflow and many tiny targets |
| `/backtest` | 3 | 3 | 3 | 3 | 2 | 2 | 2 | 3 | accessible enough, compact |
| `/challenge` | 3 | 3 | 3 | 3 | 2 | 2 | 2 | 3 | solid Lighthouse |
| `/discipline` | 3 | 2 | 3 | 3 | 2 | 2 | 2 | 3 | mobile overflow |
| `/proof-explorer` | 3 | 3 | 3 | 3 | 2 | 2 | 3 | 3 | stale copy and tiny targets |
| `/social` | 3 | 3 | 3 | 3 | 2 | 2 | 2 | 3 | minor tap-target issue |

Scores are 1-5 and intentionally conservative; this rerun prioritized blockers over subjective redesign.

## Findings

| ID | Severity | Surface | Finding | Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| A34-UX-01 | P1 | `/` | Mobile overflow detected. | `raw/design/dom-measurements-summary.md` | open |
| A34-UX-02 | P1 | `/discipline` | Mobile overflow detected. | `raw/design/dom-measurements-summary.md` | open |
| A34-UX-03 | P1 | `/proof-explorer` | Stale old proof copy visible in DOM/screenshot scan. | `raw/design/dom-measurements-summary.md` | open |
| A34-UX-04 | P2 | multiple pages | Tiny tap targets remain on home/proof/social. | `raw/design/dom-measurements-summary.md` | open |
| A34-UX-05 | P2 | `/` | Lighthouse performance 73 is acceptable but lower than other pages. | `raw/design/lighthouse/_summary.json` | open |

## Not Checked

- axe-core serious/critical violation scan was not run; package was not available in the local workspace.
- 1024 px screenshots were required by the original spec but Audit 34 captured 1440/768/375.
- Reference-dashboard comparison was not rerun.
- `docs/design-playbook.md` already exists and was not regenerated.
