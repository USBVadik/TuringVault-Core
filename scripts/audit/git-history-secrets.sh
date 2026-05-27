#!/bin/bash
# Gitleaks-style scan over the full git log.
# Patterns are conservative; tune false positives in the OUTPUT, don't widen here.
set -euo pipefail

PATTERNS=(
  'AKIA[0-9A-Z]{16}'
  'aws_secret_access_key.{0,3}=.{0,3}[A-Za-z0-9/+=]{40}'
  '"private_key":\s*"-----BEGIN'
  'eyJhbGciOiJIUzI1NiIs[A-Za-z0-9_-]{50,}'  # JWT prefix tightened
  'pinata_api_key.{0,5}[A-Za-z0-9]{20,}'
  'PRIVATE_KEY\s*=\s*[a-f0-9]{64}'  # raw EVM key in code
)

found=0
for p in "${PATTERNS[@]}"; do
  echo "## Pattern: \`$p\`"
  if hits=$(git log --all -p -G "$p" --no-color 2>/dev/null | grep -E "^\+.*$p" | head -50); then
    if [ -n "$hits" ]; then
      echo ""
      echo "\`\`\`"
      echo "$hits"
      echo "\`\`\`"
      found=1
    else
      echo "_no hits_"
    fi
  fi
  echo ""
done

if [ "$found" = "0" ]; then
  echo "Clean: no secret patterns detected in git history."
else
  echo "REVIEW the hits above — many may be test fixtures or dummy keys."
fi
