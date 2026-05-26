#!/usr/bin/env bash
#
# Re-verify Sourcify status for the contracts listed in
# frontend/app/data/contracts.json.
#
# Run this anytime a contract is redeployed (which we explicitly do not
# plan to do during the hackathon) or whenever you suspect Sourcify
# state has changed.
#
# Output: human-readable diff vs. the snapshot stored in contracts.json.
#
# Usage:
#   bash scripts/check-sourcify.sh

set -euo pipefail

CONTRACTS_JSON="frontend/app/data/contracts.json"
TMP=$(mktemp)

if [[ ! -f "$CONTRACTS_JSON" ]]; then
  echo "✗ $CONTRACTS_JSON not found. Run from repo root." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "✗ jq not installed. brew install jq" >&2
  exit 1
fi

echo "Checking Sourcify status for contracts in $CONTRACTS_JSON ..."
echo

mismatches=0
total=0

while IFS= read -r row; do
  addr=$(echo "$row" | jq -r '.address')
  expected=$(echo "$row" | jq -r '.sourcify')
  name=$(echo "$row" | jq -r '.name')

  total=$((total + 1))

  http=$(curl -sL "https://sourcify.dev/server/files/any/5000/${addr}" \
    -o "$TMP" -w "%{http_code}")

  if [[ "$http" == "200" ]]; then
    actual=$(jq -r '.status // "unknown"' < "$TMP")
  elif [[ "$http" == "404" ]]; then
    actual="none"
  else
    actual="error_http_${http}"
  fi

  if [[ "$actual" == "$expected" ]]; then
    printf "  ✓ %-50s %s (matches: %s)\n" "$name" "$addr" "$actual"
  else
    printf "  ✗ %-50s %s expected=%s actual=%s\n" "$name" "$addr" "$expected" "$actual"
    mismatches=$((mismatches + 1))
  fi
done < <(jq -c '.[]' "$CONTRACTS_JSON")

rm -f "$TMP"

echo
if [[ $mismatches -eq 0 ]]; then
  echo "All $total contracts match snapshot. Sourcify state unchanged."
  exit 0
else
  echo "$mismatches/$total contracts drifted from snapshot."
  echo "Update frontend/app/data/contracts.json if the new state is intentional."
  exit 1
fi
