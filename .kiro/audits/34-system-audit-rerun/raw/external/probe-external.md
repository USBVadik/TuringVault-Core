## External API probe — 2026-05-31T20:56:21Z

| Service              | Endpoint                                           | HTTP |
|----------------------|----------------------------------------------------|------|
| Mantle RPC           | https://rpc.mantle.xyz                             | 404 |
| Pinata gateway       | https://gateway.pinata.cloud/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG | 301 |
| Pinata API           | https://api.pinata.cloud/data/testAuthentication   | 401 |
| CoinGecko            | https://api.coingecko.com/api/v3/ping              | 200 |
| Elfa V2              | https://api.elfa.ai/v2/ping                        | 200 |
| Mantlescan           | https://api.mantlescan.xyz/api?module=block&action=getblocknobytime&timestamp=1716800000&closest=before | 200 |
| Sourcify             | https://sourcify.dev/server/files/any/5000/0x6f862802e0d5463DF18d267e422347BeCacc28bD | 200 |

Notes:
- Pinata API expects auth; 401 = reachable, 5xx = down.
- Elfa /ping is public; 200 = reachable.
- AWS Bedrock + Vertex AI not probed here (require SDK auth).
