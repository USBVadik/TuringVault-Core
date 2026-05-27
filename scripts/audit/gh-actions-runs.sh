#!/bin/bash
# Print last N runs of a workflow as a Markdown table.
# No auth needed for public repos. Doesn't echo secrets.
set -euo pipefail

WORKFLOW="${1:-agent-cycle.yml}"
LIMIT="${2:-20}"
REPO="${REPO:-USBVadik/TuringVault-Core}"

URL="https://api.github.com/repos/$REPO/actions/workflows/$WORKFLOW/runs?per_page=$LIMIT"

echo "## Workflow: \`$WORKFLOW\` (last $LIMIT runs)"
echo ""
echo "Source: $URL"
echo ""
echo "| # | Started | Lag (min) | Trigger | Status | Conclusion | Duration (s) |"
echo "|---|---------|-----------|---------|--------|------------|--------------|"

curl -s "$URL" | python3 -c '
import json, sys, datetime as dt

data = json.load(sys.stdin)
runs = data.get("workflow_runs", [])

for r in runs:
    started = r.get("run_started_at") or r.get("created_at") or ""
    updated = r.get("updated_at") or ""
    event = r.get("event") or ""
    status = r.get("status") or ""
    conclusion = r.get("conclusion") or ""
    number = r.get("run_number") or "?"

    # Compute lag from nearest hour for schedule events.
    if event == "schedule" and started:
        try:
            t = dt.datetime.fromisoformat(started.replace("Z", "+00:00"))
            target_minute = 17  # current cron schedule
            target = t.replace(minute=target_minute, second=0, microsecond=0)
            if t.minute < target_minute:
                target = target - dt.timedelta(hours=1)
            lag_seconds = (t - target).total_seconds()
            lag_min = int(round(lag_seconds / 60))
        except Exception:
            lag_min = "?"
    else:
        lag_min = "n/a"

    # Duration
    duration = ""
    if started and updated:
        try:
            a = dt.datetime.fromisoformat(started.replace("Z", "+00:00"))
            b = dt.datetime.fromisoformat(updated.replace("Z", "+00:00"))
            duration = int((b - a).total_seconds())
        except Exception:
            pass

    print(f"| {number} | {started} | {lag_min} | {event} | {status} | {conclusion} | {duration} |")
'
