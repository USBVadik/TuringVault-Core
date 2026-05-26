# Implementation Plan: Discipline Layer UI

## Overview

Surface the Discipline Layer's per-cycle verification on the dashboard.
Spec: `requirements.md` — 5 requirements, all behind one cron commit-back.

## Tasks

- [ ] 1. Persist full Discipline detail per cycle
    - Refs: R1
    - Files:
        - `src/orchestrator/multiAgentLoop.js` (MODIFY) — capture
          `proofResult` in full, pass to outcomeTracker
        - `src/orchestrator/outcomeTracker.js` (MODIFY) — accept new
          `disciplineDetail` field in record() options
        - `src/orchestrator/disciplineHistory.js` (NEW) — `read()`,
          `append(entry)`, rolling 100, `summary()`
        - `data/discipline-history.json` (NEW placeholder, empty array)
    - Acceptance:
        - `outcomes.json` rows gain optional `disciplineDetail` object
        - `discipline-history.json` rolls last 100 entries with
          `{ at, decisionId, verdict, checks: [{ name, status }],
          blockReason }`
        - `summary()` returns `{ acceptedCount, blockedCount,
          skippedCount, errorCount, gatePassRates }` over last 100

- [ ] 2. Add `/api/discipline` endpoint
    - Refs: R2
    - File: `frontend/app/api/discipline/route.ts` (NEW)
    - Body: read `discipline-history.json` + summary, return
      `{ latest, history, summary }`. Default safe empties on missing
      file. HTTP 200 always.
    - Acceptance:
        - Returns 200 even when source file missing
        - No secret leaks (grep check on route)
        - `npx next build` clean

- [ ] 3. Landing-page Discipline strip
    - Refs: R3, R5
    - File: `frontend/app/page.tsx` (MODIFY)
    - Changes:
        - `useEffect` fetches `/api/discipline`
        - New row in strategy section: gate icons + tooltips
        - Honest empty state ("awaiting first cycle")
        - Stale state when latest > 6 h old
    - Acceptance:
        - Visual matches honest empty / fresh / stale states per R5
        - When all gates PASS, row shows green
        - When any FAIL, row shows red gate name + blockReason in tooltip

- [ ] 4. `/discipline` page (full history)
    - Refs: R4
    - File: `frontend/app/discipline/page.tsx` (NEW)
    - Body:
        - Top card: summary (counts + gate pass rates)
        - Table: last 30 cycles, columns per R4.1
        - Click row → drill-down with full disciplineDetail
        - Footer: "first cycle ran X ago"
    - Acceptance:
        - All states render (no data, all-pass, mixed, blocked)
        - No "always passing" or "24/7" copy

- [ ] 5. README link
    - Refs: Success Criteria #6
    - File: `README.md` (MODIFY)
    - Add 1-paragraph "Discipline Layer dashboard" subsection under
      Discipline Layer section, link to `/discipline` on live demo.

- [ ] 6. Verify on prod
    - Refs: Success Criteria #1-#4
    - Action (operator-side):
        - Wait for next cron cycle (≤ 60 min)
        - Verify `data/discipline-history.json` populated
        - Open `/discipline` on live, verify renders
        - Open `/`, verify strip renders gate icons

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": [1],
      "rationale": "Foundation: cron must persist new data before any UI can render it. Touches multiAgentLoop, outcomeTracker, new disciplineHistory module, placeholder data file."
    },
    {
      "wave": 2,
      "tasks": [2],
      "rationale": "API endpoint reads what task 1 writes. Independent of UI."
    },
    {
      "wave": 3,
      "tasks": [3, 4],
      "rationale": "Landing strip and /discipline page both consume task 2's API. Can land in parallel — they don't share files."
    },
    {
      "wave": 4,
      "tasks": [5],
      "rationale": "README link goes last so the linked page already exists."
    },
    {
      "wave": 5,
      "tasks": [6],
      "rationale": "Live verification — needs the cron to run at least once after deploy."
    }
  ]
}
```

## Notes

### Out of scope
- On-chain Discipline registry contract
- Repair-step automation
- Discipline gates on /challenge results

### Cost
Zero new on-chain TXs. Per-cycle JSON commit grows by ~600 bytes.
