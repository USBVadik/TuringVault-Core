#!/bin/bash
# Diff GH Actions secret names vs Vercel project env names.
# NEVER echoes values, only names.
# Requires: gh CLI authenticated, vercel CLI authenticated, OR pre-built lists.
set -euo pipefail

GH_LIST="${GH_LIST:-/tmp/gh-secrets.txt}"
VC_LIST="${VC_LIST:-/tmp/vercel-env.txt}"

if ! [ -f "$GH_LIST" ] || ! [ -f "$VC_LIST" ]; then
  cat <<EOF
This script needs both:
  $GH_LIST  — one secret name per line (from \`gh secret list\`)
  $VC_LIST  — one env var name per line (from \`vercel env ls\`)

Build them with these commands (operator side):
  gh secret list --json name -q '.[].name' > $GH_LIST
  vercel env ls > $VC_LIST   # then sed to extract names only

This audit run will produce a manual-input section instead.
EOF
  echo ""
  echo "## Env drift — MANUAL INPUT REQUIRED"
  echo ""
  echo "Operator: provide both lists, then re-run."
  exit 0
fi

echo "## Env drift — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""
echo "| Name | GH Actions | Vercel | Note |"
echo "|------|------------|--------|------|"

ALL=$(cat "$GH_LIST" "$VC_LIST" | sort -u)
for n in $ALL; do
  in_gh="-"
  in_vc="-"
  grep -qx "$n" "$GH_LIST" 2>/dev/null && in_gh="✓"
  grep -qx "$n" "$VC_LIST" 2>/dev/null && in_vc="✓"
  note=""
  if [ "$in_gh" = "✓" ] && [ "$in_vc" = "-" ]; then note="missing-on-vercel"; fi
  if [ "$in_gh" = "-" ] && [ "$in_vc" = "✓" ]; then note="missing-on-github"; fi
  printf "| %-30s | %-10s | %-6s | %s |\n" "$n" "$in_gh" "$in_vc" "$note"
done
