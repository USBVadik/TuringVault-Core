#!/bin/bash
set -euo pipefail
cd /root/turingvault
if [[ "${LEGACY_GRID_BOT_EXECUTION_ENABLED:-false}" != "true" ]]; then
  echo "LEGACY_GRID_BOT_DISABLED: remove this cron; multiAgentLoop is the sole production executor." >&2
  exit 78
fi
node src/strategies/liveGridBot.js cycle 2>&1
