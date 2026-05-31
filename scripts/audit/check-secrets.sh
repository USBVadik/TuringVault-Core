#!/bin/bash
# Grep a directory for secret patterns. Exits non-zero on any hit.
# Used both for response captures (R3) and for source code (R12).
set -euo pipefail

DIR="${1:-.kiro/audits/raw}"

# Pattern set: AWS, env-style private keys, JWTs, generic API keys.
# We use grep -E with carefully bounded regex. Generic 32-byte hex strings
# are reported separately below because public transaction hashes have the
# same shape and should not make the named-secret scan fail.
NAMED_PATTERNS=(
  'AKIA[0-9A-Z]{16}'                       # AWS Access Key
  'aws_secret_access_key.{0,3}=.{0,3}[A-Za-z0-9/+=]{40}'  # AWS Secret
  '"private_key":\s*"-----BEGIN'           # PEM block in JSON
  'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}'  # JWT
  'PINATA_(API_KEY|SECRET|JWT)\s*='        # Pinata env literal
  'NANSEN_API_KEY\s*='
  'PRIVATE_KEY\s*='
)

found=0
for p in "${NAMED_PATTERNS[@]}"; do
  if hits=$(grep -rEHn --include='*' "$p" "$DIR" 2>/dev/null); then
    if [ -n "$hits" ]; then
      echo "## Named secret pattern: \`$p\`"
      echo ""
      echo "$hits" | head -50
      echo ""
      found=1
    fi
  fi
done

tx_hits="$(grep -rEHn --include='*' '0x[a-fA-F0-9]{64}' "$DIR" 2>/dev/null || true)"
if [ -n "$tx_hits" ]; then
  echo "## Transaction-hash-shaped strings: \`0x[a-fA-F0-9]{64}\`"
  echo ""
  echo "$tx_hits" | head -50
  echo ""
fi

if [ "$found" = "0" ]; then
  echo "No named secret patterns found in $DIR"
  exit 0
else
  echo "FOUND named secret-shaped strings — review above"
  exit 1
fi
