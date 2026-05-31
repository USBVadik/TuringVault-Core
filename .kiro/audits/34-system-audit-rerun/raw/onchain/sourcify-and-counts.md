# Sourcify and count probe

timestamp: 2026-05-31T20:57:47.477Z
sourcify_status: HTTP 200

| Contract | Address | Bytecode source | Sourcify status |
| --- | --- | --- | --- |
| TuringVaultIdentity | `0x6f862802e0d5463DF18d267e422347BeCacc28bD` | deployments.json | perfect |
| TuringVaultDecisionLog | `0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5` | deployments.json | perfect |
| TuringVaultValidationRegistry | `0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6` | deployments.json | perfect |
| TuringVaultRouter | `0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001` | deployments.json | false |
| ReputationRegistry | `0xC78119F3274B05046Ac7c38a14298a6cbD946e1a` | deployments.json | perfect |
| TuringVaultValidation | `0x0aeEd88959fCFC665284225dB93DED3e8A3Ff705` | deployments.json | perfect |

## Frontend contracts.json summary

| Name | Address | Sourcify field | Role |
| --- | --- | --- | --- |
| TuringVaultIdentity | `0x6f862802e0d5463DF18d267e422347BeCacc28bD` | full | ERC-8004 Identity Registry · Agent NFT (mainnet) |
| TuringVaultDecisionLog | `0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5` | full | Decision Log · Append-only reasoning record |
| TuringVaultValidationRegistry | `0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6` | full | Multi-Agent Validation Registry · Analyst↔Validator consensus |
| ReputationRegistry | `0xC78119F3274B05046Ac7c38a14298a6cbD946e1a` | full | ERC-8004 Reputation Registry · On-chain agent reputation |
| ValidationRegistry (ERC-8004 trustless agents) | `0x0aeEd88959fCFC665284225dB93DED3e8A3Ff705` | full | ERC-8004 Validation Registry · External validators |
| TuringVaultIdentity (legacy) | `0x582E6a649B99784829193E14bB7Af8c4A482E165` | full | Legacy Identity (superseded by 0x6f86…28bD) |
| TuringVaultRouter | `0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001` | none | Router (deployed; not yet wired into agent execution path) |

ValidationRegistry totals: {"totalProposals":203,"totalApproved":133,"totalRejected":70}
src/data/outcomes.json rows: pending=63, settled=67, total=130
Drift (on-chain totalProposals - outcomes rows): 73
