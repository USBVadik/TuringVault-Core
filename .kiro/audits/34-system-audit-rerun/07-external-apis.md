# Audit 34 - External APIs

Generated: 2026-05-31
Primary evidence: `raw/external/probe-external.md`

## Probe Results

| Service | HTTP | Classification |
| --- | ---: | --- |
| Mantle RPC simple GET | 404 | inconclusive; JSON-RPC should be POSTed |
| Pinata gateway sample | 301 | reachable redirect |
| Pinata API auth test | 401 | reachable; auth expected |
| CoinGecko ping | 200 | reachable |
| Elfa V2 ping | 200 | reachable |
| Mantlescan block lookup | 200 | reachable |
| Sourcify contract file | 200 | reachable |

## Failure-mode Notes

| Dependency | Expected behavior if down | Audit 34 confidence |
| --- | --- | --- |
| Mantle RPC | blocking for on-chain reads/writes | chain-probe succeeded through JSON-RPC elsewhere |
| CoinGecko | degrading/blocking depending route | ping reachable |
| Elfa | degrading social signal | ping reachable |
| Pinata gateway | proof display degradation | sample redirected, sampled proof CIDs fetched separately |
| Pinata API | pinning/auth path blocking for proof writes | auth not checked without token |
| Mantlescan | explorer metadata degradation | public endpoint reachable |
| Sourcify | proof verification display degradation | reachable |
| Bedrock | blocking/degrading for LLM cycle | not probed |
| Vertex/Gemini | arbiter fallback degraded | not probed |
| Nansen/Smart Money | signal quality degradation | not probed |

## Findings

| ID | Severity | Surface | Finding | Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| A34-EXT-01 | P2 | `probe-external.sh` | Mantle RPC probe uses a simple GET, which returns 404 and is not a valid JSON-RPC health check. Use POST `eth_blockNumber`. | `raw/external/probe-external.md` | open |
| A34-EXT-02 | P2 | LLM providers | Bedrock and Vertex were not probed because SDK credentials are required. This is a manual gap, not evidence of failure. | `raw/external/probe-external.md` | open |
| A34-EXT-03 | P2 | Nansen/smart-money feed | User-facing architecture mentions smart-money/Nansen context, but Audit 34 did not independently probe that provider path. | this report | open |

## Not Checked

- Provider latency.
- Authenticated Pinata pin list/JWT expiry.
- Bedrock and Vertex model invocation health.
- Nansen data freshness and fallback behavior.
