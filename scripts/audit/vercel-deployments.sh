#!/bin/bash
# List the last N Vercel deployments + state per commit.
# Requires VERCEL_TOKEN env. Uses the public deployments API.
set -euo pipefail

LIMIT="${1:-10}"

if [ -z "${VERCEL_TOKEN:-}" ]; then
  if [ -f .env ]; then
    # shellcheck disable=SC1091
    set +u
    set -a; source .env; set +a
    set -u
  fi
fi

if [ -z "${VERCEL_TOKEN:-}" ]; then
  echo "VERCEL_TOKEN not set — cannot probe deployments."
  echo ""
  echo "## Vercel deployments — UNAVAILABLE FROM THIS ENVIRONMENT"
  exit 0
fi

# We need projectId / teamId. Best-effort: list all deployments visible
# to the token and filter to the project name.
PROJECT_NAME="${VERCEL_PROJECT:-frontend-seven-beta-46}"

URL="https://api.vercel.com/v6/deployments?limit=$LIMIT&projectId=$PROJECT_NAME"

echo "## Vercel deployments — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""
echo "Project: $PROJECT_NAME"
echo "API: $URL"
echo ""
echo "| State | Commit | Created | Build duration (s) | URL |"
echo "|-------|--------|---------|--------------------|-----|"

curl -s -H "Authorization: Bearer $VERCEL_TOKEN" "$URL" | python3 -c '
import json, sys, datetime as dt

try:
    data = json.load(sys.stdin)
except Exception as e:
    print(f"| ERROR | parse | {e} | - | - |")
    sys.exit(0)

deployments = data.get("deployments") or []
if not deployments:
    err = data.get("error", {}).get("message") if isinstance(data.get("error"), dict) else None
    if err:
        print(f"| ERROR | api | {err} | - | - |")
    else:
        print("| (no deployments returned) | | | | |")
    sys.exit(0)

for d in deployments:
    state = d.get("state") or d.get("readyState") or "?"
    commit = (d.get("meta") or {}).get("githubCommitSha", "")[:7]
    created_ms = d.get("created")
    if created_ms:
        created = dt.datetime.utcfromtimestamp(created_ms/1000).isoformat() + "Z"
    else:
        created = ""
    build_ms = d.get("buildingAt") or 0
    ready_ms = d.get("ready") or 0
    duration = int((ready_ms - build_ms) / 1000) if (build_ms and ready_ms) else ""
    url = d.get("url") or ""
    print(f"| {state} | {commit} | {created} | {duration} | {url} |")
'
