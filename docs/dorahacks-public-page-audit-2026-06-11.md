# DoraHacks Public Page Audit — 2026-06-11

Rendered target: https://dorahacks.io/buidl/43986

This is the final pre-screening checklist for the public DoraHacks page. The repo docs are aligned with the updated Mantle scorecard, but the public page still needs one manual Details-field update inside DoraHacks.

## What Already Passes

- Public page loads and exposes the project title.
- GitHub link is visible: https://github.com/USBVadik/TuringVault-Core
- Demo video is visible: https://youtu.be/AnLbnbW36ys
- Live app is visible: https://frontend-seven-beta-46.vercel.app
- The project already explains Proof-of-Reasoning, Mantle contracts, public cron, replay, and Discipline Layer.

## Must Fix Manually On DoraHacks

Replace the old Details text before final submission review.

Observed stale public text:

```text
TuringVault should be judged as infrastructure.
```

Why this matters: the updated AI & RWA rubric scores TuringVault more cleanly as **AI & RWA Track — Path B: RWA Application**. The project has infrastructure-grade proof surfaces, but the primary track fit is an application that manages and verifies allocation across existing Mantle-native RWA/yield rails.

The public Details field should explicitly include:

- `AI & RWA Track — Path B: RWA Application`
- `Compliance Awareness`
- `No public deposits`
- `No yield or profit promise`
- `Operator-funded demo capital`
- `20 Project Deployment Award Checklist`
- Live app, GitHub, YouTube, and Mantle contract links

## Paste-Ready Field Values

### Short Description

```text
Accountable AI RWA portfolio application on Mantle. TuringVault combines multi-model consensus, ERC-8004-style identity/reputation, Proof-of-Reasoning anchors, and post-execution Discipline checks before AI-managed capital is trusted.
```

### Track And Awards

```text
Primary track: AI & RWA Track — Path B: RWA Application.
Secondary awards: 20 Project Deployment Award, Best UI/UX.
```

### Required Details Replacement

Use `docs/dorahacks-final-polished.md` as the source of truth for the Details field.

At minimum, the DoraHacks Details field must contain these sections:

```text
Why This Fits The Mantle Turing Test
Track Fit Under The Updated Scorecard
Live Snapshot
RWA And Mantle Asset Stack
Compliance Awareness
20 Project Deployment Award Checklist
Judge Verification Path
What We Do Not Claim
```

## Current Live Snapshot For Manual Refresh

Observed via public APIs on 2026-06-11 at 07:09 UTC:

| Metric | Observed Value | Source |
| --- | ---: | --- |
| ValidationRegistry proposals / decision records | 455 | `/api/decisions` |
| Approved validator outcomes | 332 | `/api/decisions` |
| Rejected validator outcomes | 123 | `/api/decisions` |
| Rejection rate | 27.0% | 123 / 455 |
| Settled outcomes | 358 | `/api/performance` |
| Settled win rate | 53.1% | `/api/performance` |
| Decision-quality score | +5083 bps | `/api/performance`; not wallet PnL |
| Realized wallet PnL claim | null | `/api/performance.realizedTradingPnlBps` |
| Cron health, trailing 24h | 22 succeeded / 0 failed | `/api/health` |
| Parse success, trailing 24h | 100% | `/api/health` |
| Operator-funded NAV | about $139.88 | `/api/performance` |
| Gas runway | about 11.5 days | `/api/health.gasRunway` |

Do not paste these numbers if they are older than the final edit session. Refresh:

- https://frontend-seven-beta-46.vercel.app/api/health
- https://frontend-seven-beta-46.vercel.app/api/performance
- https://frontend-seven-beta-46.vercel.app/api/decisions

## Final Public Page QA

After saving DoraHacks, render the public page again and verify these exact searches:

- `TuringVault should be judged as infrastructure` is absent.
- `AI & RWA Track — Path B: RWA Application` is present.
- `Compliance Awareness` is present.
- `No public deposits` is present.
- `20 Project Deployment Award Checklist` is present.
- GitHub, live app, and demo video links are present.
