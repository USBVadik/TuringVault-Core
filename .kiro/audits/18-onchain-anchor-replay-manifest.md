# Audit 18 — On-Chain Anchor for Replay Manifest

**Date**: 2026-05-29
**Trigger**: External Gemini Pro 3.1 audit P0 — close the
"Reproducible AI" loop with cryptographic seal so a manifest can no
longer be retroactively tampered with after the cycle commits.
**Predecessor**: Audit 16 (Reproducible AI Capture) shipped the
manifest writer and replay tooling but only anchored the manifest
*implicitly* via the git commit hash + IPFS CID. This audit adds an
*explicit* on-chain bytes32 binding.

---

## What this audit ships

A single `bytes32` value — `combinedAnchor` — written to the existing
`TuringVaultDecisionLog.txHash` slot every cycle. No contract redeploy.

```
combinedAnchor = keccak256( utf8(ipfsCid) ‖ bytes32(manifestHash) )
```

Where:

- `ipfsCid` is the Pinata-pinned Proof-of-Reasoning CID (already
  written each cycle by `src/ipfs/storage.js`).
- `manifestHash` is the SHA-256 over the canonical capture array
  computed by `captureManifest.manifestHash(captures)`.
- `‖` is byte concatenation (`ethers.concat([toUtf8Bytes(cid), mh])`).

The same `combinedAnchor` is also written into
`ReputationRegistry.submitFeedback(reasoningHash bytes32)` for every
cycle, so the binding is present in both registries.

A verifier reproduces the binding client-side from the manifest on
disk and matches it against `decisions[id].txHash`. If anyone (us
included) edited the manifest after the cycle committed, the
recomputed anchor diverges from the one already on-chain and the
tampering is detectable.

---

## Why no contract redeploy

The deployed `TuringVaultDecisionLog` contract has a `bytes32 txHash`
field that — historically — stored `keccak256(ipfsCid)`. Audit 16
documented the IPFS-implicit binding; this audit replaces that single
hash with the joint `combinedAnchor` over IPFS+manifest. We:

- Do **not** redeploy any contract (Sourcify-verified `perfect`
  status preserved across all 6/6 contracts).
- Do **not** break read-side consumers — the field is still a
  `bytes32`; the frontend's `decisions[]` tuple read continues to
  work; the only thing that changes is the *meaning* of the value
  stored there (now bound to two artefacts instead of one).
- Do not break `LiveTerminal` / `proof-explorer` rendering — the
  field was never a real Mantle TX hash anyway (executions land in
  `directionalSwap.legs[].txHash`).

The risk is purely cosmetic: a UI surface that interprets the bytes32
as a Mantle TX hash and tries to link to `mantlescan.xyz/tx/<hash>`
will land on a 404. Searching the codebase confirms no such surface
exists today (links go via `directionalSwap.legs[].txHash`).

---

## Why the change to `manifestHash` was load-bearing

Implementing the anchor surfaced a pre-existing bug in
`captureManifest.manifestHash`. The old line was:

```js
JSON.stringify(captures, Object.keys(captures).sort());
```

`JSON.stringify(value, replacer)` treats an array replacer as a
**property whitelist**. For an Array argument, `Object.keys(arr)`
returns string indices `["0","1","2",...]`, not real keys. So the
replacer filtered out every actual capture field and every input
collapsed to the same `[{}]` string and the same SHA-256 — which
silently degraded the on-disk `hash` field to a constant.

Fixed in this audit by replacing it with a recursive canonical JSON
that:

1. Preserves array order.
2. Sorts object keys alphabetically at every nesting level.
3. Serialises primitives via `JSON.stringify`.

A new regression test
(`manifestHash distinguishes different capture sets`) pins the fix.

This is critical for the on-chain anchor: if the hash didn't actually
discriminate between captures, the anchor wouldn't either, and the
binding would prove nothing.

---

## Files changed

- `src/replay/captureManifest.js`
  - Added `peekCapture()` (read buffer without clearing it; needed
    so the loop can hash mid-cycle and still drain at end of cycle).
  - Fixed `manifestHash` canonicalisation bug (recursive sorted-key
    stringify).
- `src/orchestrator/multiAgent.js`
  - Re-export `peekCapture` from `multiAgent` (orchestrator
    boundary; consumers don't touch `captureManifest` directly).
- `src/orchestrator/multiAgentLoop.js`
  - Compute `manifestHashHex` from `peekCapture()` before
    `decisionLog.logDecision`.
  - Compute `combinedAnchor = keccak256(concat([toUtf8Bytes(cid),
    manifestHashHex]))`.
  - Replace `keccak256(toUtf8Bytes(ipfsCid))` with `combinedAnchor`
    in both `decisionLog.logDecision` and
    `reputation.submitFeedback`.
  - Capture `decisionLogTxHash` from the receipt.
  - Pass `manifestHash`, `combinedAnchor`, `decisionLogTxHash` into
    `outcomeTracker.record(...)` so the UI can verify the binding.
  - Persist the same triple into the `onChain` block of the
    written manifest, so the manifest self-describes its anchor.
- `src/orchestrator/outcomeTracker.js`
  - Whitelist the three new fields (`manifestHash`,
    `combinedAnchor`, `decisionLogTxHash`) so they're stored in
    `outcomes.json` rows.
- `scripts/replay-decision.js`
  - Print the on-chain anchor + DecisionLog tx hash when present.
  - Self-check: recompute the binding from the on-disk manifest and
    confirm it matches the stored anchor (catches manifest edits
    even before reaching the chain).
- `tests/unit/captureManifest.unit.test.js`
  - +4 new tests:
    1. `peekCapture returns a copy without clearing the buffer`.
    2. `peek-then-hash matches drain-then-hash for the same cycle`.
    3. `combinedAnchor formula is deterministic and recomputable`.
    4. `manifestHash distinguishes different capture sets` (the
       regression guard for the canonicalisation bug).

---

## Validation

- `npx jest --no-coverage` → 216 / 216 passing (was 212; +4 new tests).
- `npx eslint src/ --max-warnings 50` → 0 errors / 47 warnings (same as
  audit 16; CI scope clean).
- `node --check` clean across all touched files.
- Hand-verified the formula:
  ```
  $ node -e "const{keccak256,toUtf8Bytes,concat}=require('ethers');
             const cid='QmTestCID';
             const mh='0x'+'a'.repeat(64);
             console.log(keccak256(concat([toUtf8Bytes(cid),mh])));"
  0x5c5b425a850c62df8e2934a0ded29cdc1f9c61374368bb42a4e618679b9c4e04
  ```
  Reproduces deterministically across runs.

---

## Trust model — what the anchor proves and what it doesn't

**Proves**:
- The IPFS CID *and* the replay manifest were both committed
  before the on-chain log fired. Editing either after the fact
  changes the recomputed anchor, which no longer matches the
  one already in `DecisionLog`.
- The replay manifest at this commit hash is the same one the
  cycle saw. Anyone can clone the repo, recompute the hash from
  `cycle-NNNN.json`, and check it matches.

**Does not prove**:
- That AWS Bedrock or Google Vertex returned the exact bytes the
  manifest claims they returned. We delegate that trust to the
  providers' own SOC 2 / ISO 27001 audits. (See audit 16's
  trust-model section for full caveats.)
- That the model would respond identically if invoked again, except
  at temperature=0. Audit 16 documents the determinism caveats.

---

## What's still open after this audit

- **P1** `/replay/<cycle-id>` server-side page on the frontend so a
  judge can click a button rather than running `npm run replay`
  locally. ETA ~4h.
- **P1** CI replay-validator that picks one random cycle daily and
  asserts (a) anchor recomputes correctly from the on-disk manifest,
  (b) on-chain anchor matches. Catches future drift automatically.
  ETA ~4h.
- **P2** SWR caching on frontend so 502s from Mantlescan don't
  break the proof-explorer UI.
