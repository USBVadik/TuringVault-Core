#!/bin/bash
# Probe each external dependency with a minimal request.
# No auth needed for the probes used here — we're only checking
# reachability + auth-error vs network-error.
set -euo pipefail

probe() {
  local name="$1"
  local url="$2"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "ERR")
  printf "| %-20s | %-50s | %s |\n" "$name" "$url" "$code"
}

echo "## External API probe — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""
echo "| Service              | Endpoint                                           | HTTP |"
echo "|----------------------|----------------------------------------------------|------|"

probe "Mantle RPC"     "https://rpc.mantle.xyz"
probe "Pinata gateway" "https://gateway.pinata.cloud/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"
probe "Pinata API"     "https://api.pinata.cloud/data/testAuthentication"
probe "CoinGecko"      "https://api.coingecko.com/api/v3/ping"
probe "Elfa V2"        "https://api.elfa.ai/v2/ping"
probe "Mantlescan"     "https://api.mantlescan.xyz/api?module=block&action=getblocknobytime&timestamp=1716800000&closest=before"
probe "Sourcify"       "https://sourcify.dev/server/files/any/5000/0x6f862802e0d5463DF18d267e422347BeCacc28bD"

echo ""
echo "Notes:"
echo "- Pinata API expects auth; 401 = reachable, 5xx = down."
echo "- Elfa /ping is public; 200 = reachable."
echo "- AWS Bedrock + Vertex AI not probed here (require SDK auth)."
