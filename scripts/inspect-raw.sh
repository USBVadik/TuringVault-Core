#!/usr/bin/env bash
# Grep across raw model output logs for diagnosis.
#
# Usage:
#   npm run inspect:raw -- "confidence: 25"
#   npm run inspect:raw -- "REJECT"
#
# Useful patterns:
#   "confidence: \d+"       -- count percent-format outputs
#   "I cannot|I refuse"      -- guardrail-triggered refusals
#   "RANGING regime"         -- look at validator reasoning history
#
# Spec: .kiro/specs/agent-reasoning-quality/{requirements,design,tasks}.md (T13)

set -euo pipefail

RAW_DIR="src/data/raw_model_outputs"
PATTERN="${1:-}"

if [[ -z "${PATTERN}" ]]; then
  echo "Usage: npm run inspect:raw -- <pattern>"
  echo
  echo "Examples:"
  echo "  npm run inspect:raw -- 'confidence: 25'"
  echo "  npm run inspect:raw -- 'REJECT'"
  exit 1
fi

if [[ ! -d "${RAW_DIR}" ]]; then
  echo "No raw outputs directory yet (${RAW_DIR}). Run a cycle first."
  exit 0
fi

# Use null-glob to handle empty dir gracefully.
shopt -s nullglob
files=("${RAW_DIR}"/*.txt)
if [[ ${#files[@]} -eq 0 ]]; then
  echo "No raw output files yet. Run a cycle first."
  exit 0
fi

# Count matching files first.
match_count=$(grep -lE "${PATTERN}" "${files[@]}" 2>/dev/null | wc -l | tr -d ' ')
total=${#files[@]}
echo "Files matching: ${match_count}/${total}"
echo

# Show up to first 20 hits with file:line context.
grep -nE "${PATTERN}" "${files[@]}" 2>/dev/null | head -20 || true
