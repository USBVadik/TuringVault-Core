#!/bin/bash
# Fetch every public UI page + API route into .kiro/audits/raw/
# Idempotent: re-running overwrites with the latest snapshot.
set -euo pipefail

BASE="${BASE:-https://frontend-seven-beta-46.vercel.app}"
RAW_DIR=".kiro/audits/raw"
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)

mkdir -p "$RAW_DIR/ui" "$RAW_DIR/api"

UI_PAGES=(
  "/"
  "/backtest"
  "/challenge"
  "/discipline"
  "/proof-explorer"
  "/social"
)

API_ROUTES=(
  "/api/health"
  "/api/decisions"
  "/api/strategy"
  "/api/discipline"
  "/api/elfa-snapshot"
  "/api/backtest"
  "/api/agent-card"
  "/api/market"
  "/api/performance"
  "/api/proof-explorer"
  "/api/reasoning"
  "/api/reputation"
  "/api/evolution"
  "/api/challenge"
)

echo "# Fetch run $TS" > "$RAW_DIR/_fetch-summary.md"
echo "" >> "$RAW_DIR/_fetch-summary.md"
echo "| Surface | HTTP | Bytes | Latency (ms) |" >> "$RAW_DIR/_fetch-summary.md"
echo "|---------|------|-------|--------------|" >> "$RAW_DIR/_fetch-summary.md"

for path in "${UI_PAGES[@]}"; do
  name=$(echo "$path" | sed 's|/|_|g; s|^_|root|; s|^$|root|')
  [ "$name" = "_" ] && name=root
  url="$BASE$path"
  # Use -w for status + bytes + time, -o for body, --max-time to bound
  result=$(curl -s -L -o "$RAW_DIR/ui/${name}.html" \
    -w "%{http_code}|%{size_download}|%{time_total}" \
    --max-time 30 "$url" 2>/dev/null || echo "ERR|0|0")
  http=$(echo "$result" | cut -d'|' -f1)
  bytes=$(echo "$result" | cut -d'|' -f2)
  latency=$(echo "$result" | cut -d'|' -f3 | awk '{printf "%d", $1*1000}')
  echo "| \`$path\` | $http | $bytes | $latency |" >> "$RAW_DIR/_fetch-summary.md"
done

for path in "${API_ROUTES[@]}"; do
  name=$(echo "$path" | sed 's|/api/||; s|/|_|g')
  url="$BASE$path"
  result=$(curl -s -L -o "$RAW_DIR/api/${name}.json" \
    -w "%{http_code}|%{size_download}|%{time_total}" \
    --max-time 30 "$url" 2>/dev/null || echo "ERR|0|0")
  http=$(echo "$result" | cut -d'|' -f1)
  bytes=$(echo "$result" | cut -d'|' -f2)
  latency=$(echo "$result" | cut -d'|' -f3 | awk '{printf "%d", $1*1000}')
  echo "| \`$path\` | $http | $bytes | $latency |" >> "$RAW_DIR/_fetch-summary.md"
done

echo ""
echo "Wrote: $RAW_DIR/_fetch-summary.md"
cat "$RAW_DIR/_fetch-summary.md"
