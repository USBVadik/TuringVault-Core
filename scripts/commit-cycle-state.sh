#!/usr/bin/env bash
set -euo pipefail

# Remove the ephemeral key file BEFORE staging anything so it can never
# end up in a commit even if the path were tracked.
rm -f ./gemini-service-account.json

git config user.name "TuringVault Cron"
git config user.email "cron@turingvault.ai"

# Stage only state files the cycle is allowed to publish. Some files are
# optional and may not exist on every run.
for f in \
  src/data/outcomes.json \
  src/data/parse_metrics.json \
  src/data/threshold_state.json \
  src/data/position_state.json \
  src/data/grid_bot_state.json \
  src/data/grid_param_history.json \
  src/data/meth_rate_history.json \
  data/loop_progress.json \
  data/last-cycle-summary.json \
  data/cycle-history.json \
  data/cycle-failures.json \
  data/discipline-history.json \
  data/challenge-budget.json
do
  [ -f "$f" ] && git add "$f"
done

# Reproducible AI replay manifests — one per cycle. These are committed
# every cycle so public git history carries the prompt+response trail.
if compgen -G ".kiro/audits/raw/replay-manifests/cycle-*.json" > /dev/null; then
  git add .kiro/audits/raw/replay-manifests/cycle-*.json
fi

git status --short

if git diff --cached --quiet; then
  echo "No state changes to commit."
  exit 0
fi

if [ -f data/last-cycle-summary.json ]; then
  DECISION_ID=$(jq -r '.decisionId // "?"' data/last-cycle-summary.json)
  TIER=$(jq -r '.decisionTier // "UNKNOWN"' data/last-cycle-summary.json)
  TIMESTAMP=$(jq -r '.cycleEndedAt // "?"' data/last-cycle-summary.json)
else
  DECISION_ID="?"
  TIER="UNKNOWN"
  TIMESTAMP=$(date -u +%FT%TZ)
fi

git commit -m "chore(cron): cycle ${DECISION_ID} ${TIMESTAMP} ${TIER}"

# If origin/main advanced after cycle generation, do not rebase generated
# JSON state. The next schedule/watchdog trigger regenerates from fresher main.
if ! git push origin main; then
  echo "::warning::origin/main advanced after cycle generation. Skipping stale cycle commit instead of rebasing generated JSON state."
  echo "Skipping stale cycle commit; the next scheduled or watchdog trigger will regenerate from the latest main."
  exit 0
fi
