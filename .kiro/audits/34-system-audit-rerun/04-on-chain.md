# Audit 34 - On-chain

Generated: 2026-05-31
Primary evidence: `raw/onchain/chain-probe.md`, `raw/onchain/sourcify-and-counts.md`, `raw/onchain/verify-anchor-cycle-201.md`, `raw/onchain/verify-anchor-cycle-202.md`

## Chain Probe

| Metric | Value |
| --- | --- |
| RPC | `https://rpc.mantle.xyz` |
| Block height at probe | `96065334` |
| Agent EOA | `0xDC783CDBfA993f3FC299460627b204E83bf4fb5a` |
| Native MNT balance | `19.248346822674237969` |
| EOA nonce | `1178` |

## Contract Bytecode and Sourcify

| Contract | Bytecode | Sourcify |
| --- | ---: | --- |
| TuringVaultIdentity | present | perfect |
| TuringVaultDecisionLog | present | perfect |
| TuringVaultValidationRegistry | present | perfect |
| TuringVaultRouter | present | false |
| ReputationRegistry | present | perfect |
| TuringVaultValidation | present | perfect |

The current truth is six deployed current contracts, five `perfect` on Sourcify, with Router unverified.

## Proposal and Outcome Counts

| Source | Count |
| --- | ---: |
| ValidationRegistry total proposals | 203 |
| ValidationRegistry approved | 133 |
| ValidationRegistry rejected | 70 |
| `src/data/outcomes.json` pending | 63 |
| `src/data/outcomes.json` settled | 67 |
| `src/data/outcomes.json` total rows | 130 |
| Count drift: on-chain proposals minus outcome rows | 73 |

This may be a semantics mismatch rather than data loss: `outcomes.json` appears to track outcome settlement rows, not every on-chain proposal. It still fails the old R5 acceptance check unless the report explicitly documents that distinction.

## Anchor Verification

| Cycle | Result | Evidence |
| ---: | --- | --- |
| 201 | PASS | recomputed manifest hash and combined anchor match stored and on-chain bytes |
| 202 | FAIL | local replay manifest `cycle-0202.json` not found |

Latest replay manifest tail ends at `cycle-0201.json`.

## Findings

| ID | Severity | Surface | Finding | Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| A34-CHAIN-01 | P0 | Proof Explorer / UI copy | Live UI still exposes old proof/Sourcify copy while chain evidence is 5/6 current contracts, Router unverified. | `raw/_fetch-summary.md`, `raw/onchain/sourcify-and-counts.md` | open |
| A34-CHAIN-02 | P1 | Replay manifests | Latest expected cycle 202 manifest is absent while cycle 201 verifies. This creates a proof coverage lag or ID-mapping gap. | `raw/onchain/verify-anchor-cycle-202.md`, `raw/onchain/replay-manifest-tail.txt` | open |
| A34-CHAIN-03 | P1 | Outcomes vs on-chain registry | On-chain proposals (203) exceed outcome rows (130) by 73. This needs a documented retention/semantics explanation or reconciliation. | `raw/onchain/sourcify-and-counts.md` | open |
| A34-CHAIN-04 | P2 | Router verification | Router has deployed bytecode but Sourcify status is false. Current docs mostly say 5/6; any "all verified" copy must stay blocked. | `raw/onchain/sourcify-and-counts.md` | open |

## Not Checked

- Last 20 EOA transactions were not classified because vanilla JSON-RPC does not expose account-history enumeration; Mantlescan API history is needed.
- Contract-level security was not re-reviewed here; this is a deployment/proof audit.
