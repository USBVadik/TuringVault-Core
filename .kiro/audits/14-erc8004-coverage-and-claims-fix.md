# Audit 14 — ERC-8004 Coverage Audit + Claims Realignment

**Date**: 2026-05-29
**Trigger**: Competitive scan via Exa surfaced AgentBank V3
(`0xCaptain888/agentbank`) which claims a "three-registry ERC-8004
implementation" as a key differentiator. Goal of this audit: verify
which ERC-8004 components TuringVault actually has on-chain, and
correct any misrepresentation in user-facing surfaces.

---

## Method

1. Inventoried all addresses referenced in the codebase.
2. For each, queried Mantle mainnet via `getCode()` to confirm it is
   deployed (non-empty bytecode).
3. For each deployed address, hit the Sourcify v2 API
   (`sourcify.dev/server/check-by-addresses?addresses=...&chainIds=5000`)
   to confirm verification status.
4. Searched the codebase for active write-paths into each contract
   (cycle-frequency, settlement-frequency, ad-hoc).

## Findings

### Deployment + verification status (all on Mantle Mainnet, chain 5000)

| Role | Contract | Address | Bytecode | Sourcify |
|---|---|---|---|---|
| ERC-8004 Identity Registry | TuringVaultIdentity | `0x6f862802e0d5463DF18d267e422347BeCacc28bD` | 20,836 bytes | `perfect` |
| ERC-8004 Reputation Registry | TuringVaultReputationRegistry | `0xC78119F3274B05046Ac7c38a14298a6cbD946e1a` | 11,362 bytes | `perfect` |
| ERC-8004 Validation Registry | TuringVaultValidationRegistry | `0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6` | 12,266 bytes | `perfect` |
| Pre-action Validation helper | TuringVaultValidation | `0x0aeEd88959fCFC665284225dB93DED3e8A3Ff705` | 12,352 bytes | `perfect` |
| Decision history | TuringVaultDecisionLog | `0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5` | 9,212 bytes | `perfect` |
| Trade routing | TuringVaultRouter | `0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001` | (verified) | `perfect` |

**Conclusion**: 6 of 6 contracts are deployed and Sourcify-verified
`perfect` (full match including metadata hash). The README claim
"4 of 5 audited contracts verified" was outdated — the Router was
re-verified at some point and Sourcify status is now perfect for all
six. Same outdated claim was present in `agent-card-v2.json`.

### Active write-paths per contract

| Contract | Writers | Frequency |
|---|---|---|
| TuringVaultIdentity | `scripts/uploadAgentCard.js`, `src/orchestrator/multiAgentLoop.js` | tokenURI updated every cycle to point at the latest agent-card IPFS CID |
| TuringVaultReputationRegistry | `src/orchestrator/multiAgentLoop.js` (`submitFeedback`), `src/orchestrator/outcomeTracker.js` (`recordPnL`) | per cycle (feedback) + at settlement (PnL) |
| TuringVaultValidationRegistry | `src/orchestrator/multiAgentLoop.js` (`submitProposal`, `submitValidation`) | per cycle, two TXs |
| TuringVaultDecisionLog | `src/orchestrator/multiAgentLoop.js` (`logDecision`) | per cycle, one TX |

All three ERC-8004 registries are non-vestigial.

### Misalignment found and corrected

| Surface | Before | After |
|---|---|---|
| `README.md` top claim #2 | "ERC-8004 reference identity (auto-updating tokenURI)" — only Identity NFT cited | "ERC-8004 three-registry implementation (Identity + Reputation + Validation)" with all three addresses linked and active write-paths described |
| `README.md` Smart Contracts section | "4 of 5 audited contracts verified" | "All six Sourcify-verified `perfect` (checked 2026-05-29)" |
| `docs/pitch-deck/index.html` | "4/5 Sourcify-verified (Router pending)" (twice) | "6/6 Sourcify-verified · ERC-8004 three registries" |
| `assets/agent-card.json` `contracts` block | 4 entries, no comment | 6 entries with comment explicitly identifying which three are the ERC-8004 registries |
| `agent-card-v2.json` `erc8004.sourcify` field | "4 of 5 contracts full-match verified (Router pending — code changed post-deploy)" | "All 6 contracts Sourcify-verified perfect" |
| `src/ipfs/storage.js` agent-card builder | `identity: 0x582E…` (legacy testnet address) — DRIFT BUG | Corrected to mainnet `0x6f86…28bD`. Reputation + Validation Helper added. The IPFS-pinned card now matches reality. |

The `src/ipfs/storage.js` issue is the most consequential of the five
fixes: every cycle was uploading a fresh agent-card to IPFS that
pointed at a stale Identity contract address (`0x582E6a649B…`,
deployed 10,654 bytes — likely an early testnet artefact). A judge
fetching the agent-card via the on-chain `tokenURI(0)` would have
seen a contract address that doesn't match the README. Direct
violation of `.kiro/steering/no-lying-about-state.md` §5 ("Every
claim of integration must point to a verifiable artifact").

## Files changed

- `README.md` — claim #2 row + Smart Contracts section
- `docs/pitch-deck/index.html` — 2 Sourcify badges
- `assets/agent-card.json` — `contracts` block reformatted
- `agent-card-v2.json` — `erc8004.sourcify` field
- `src/ipfs/storage.js` — `contracts` block in `uploadAgentCard()`
- `.kiro/audits/14-erc8004-coverage-and-claims-fix.md` — this report

## Validation

- 196/196 jest tests passing
- ESLint 0 errors / under-cap warnings
- Sourcify status independently re-confirmed for all 6 addresses

## Strategic context

This audit is the first in a sequence triggered by the AgentBank V3
competitive analysis (`audit 13`). Their stated edge ("three-registry
ERC-8004 implementation, multi-LLM ensemble, Phala TEE attestation")
was used as a checklist to look for gaps in our own surface.

Result: we already have the three-registry implementation but were
**under-claiming it** in user-facing surfaces. No new contracts are
needed. The fix is editorial — making the on-chain reality visible
to a judge skimming the README in 60 seconds.

Remaining gaps from that competitive scan that require actual code
work (not just claim correction):

- Foundry fuzz/invariant tests (we use Hardhat + Mocha + Jest; no
  Foundry suite). Medium effort, high signal of "production-ready".
- TEE attestation. AgentBank uses Phala Cloud SGX. Our equivalent
  is the "KMS: simulated" badge — already correctly labelled per
  steering rule §5. Concept-level, not a forced gap.
- Decentralized inference (Allora/OpenGradient). Out of scope for AI
  x RWA track; safe to leave.

These are tracked separately, not in scope for this audit.
