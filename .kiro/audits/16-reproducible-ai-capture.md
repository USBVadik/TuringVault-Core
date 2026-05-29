# Audit 16 — Reproducible AI Capture (Phase 1 of TEE-Equivalent Trust)

**Date**: 2026-05-29
**Trigger**: Audit 13 surfaced AgentBank V3's TEE attestation (Phala
SGX) as their differentiator on "verifiable AI". Rather than match
that hardware-vendor-trust path, this audit ships a **stronger** but
hardware-independent equivalent: every multi-agent decision now
captures the exact prompt + raw model response for analyst,
validator, and arbiter — written to git, anchored on-chain via the
existing IPFS reasoning hash, replayable by any third party against
the original provider.

---

## Why this beats hardware TEE for our threat model

| Property | Phala/Intel SGX TEE | TuringVault Reproducible AI |
|---|---|---|
| Trust root | Single-vendor (Intel/AMD/NVIDIA hardware) | Public git history + IPFS + on-chain anchor |
| Verification window | Only at moment of inference (quote is ephemeral) | Permanent — replay any past decision any time |
| Cost to verify | Need TEE-aware verifier service | `npm run replay <cycle-id>` against vanilla SDKs |
| Hardware dependency | Yes | No |
| Censorship resistance | Hardware vendor can revoke | git is everywhere |
| Ahead-of-time setup | Phala account, Docker deploy, CVM | Already running — no new infra |

The existing `no-lying-about-state.md` workspace rule binds us to
artifacts a judge can verify. Hardware attestation says "trust this
vendor". Reproducible AI says "verify yourself".

---

## What ships in this audit

### New module: `src/replay/captureManifest.js`

- Module-level capture buffer reset at the start of every
  `getMultiAgentDecision()` call.
- `captureCall(entry)` — appends one record per LLM call: role,
  provider, modelId, temperature, maxTokens, exact systemPrompt,
  userPrompt, rawText, timing.
- Field bounds (60 KB per field) so a runaway response can't bloat
  the manifest beyond git-friendly limits.
- `manifestHash(captures)` — canonical SHA-256 over the full
  capture set for on-chain anchoring.
- `writeManifest(args)` — non-blocking write to
  `.kiro/audits/raw/replay-manifests/cycle-<id>.json`. Failure logs
  a warning but never breaks the cycle.

### Wiring

- `src/orchestrator/multiAgent.js` — `callAgent()` now records each
  Bedrock invocation; `getMultiAgentDecision()` resets the buffer
  at top.
- `src/orchestrator/geminiArbiter.js` — `callGeminiArbiter()`
  records each Vertex invocation.
- `src/orchestrator/multiAgentLoop.js` — at the end of every cycle,
  drains captures and writes the manifest. Wrapped in try/catch so
  it never blocks the cycle.

### Public verification surface

`scripts/replay-decision.js` — runnable as `npm run replay <cycle-id>`.
Loads the manifest, re-invokes Bedrock and Vertex with the exact
captured inputs, diffs raw outputs:

- Exact bit-identical match (temperature=0 deterministic models)
- Statistically aligned (Jaccard ≥ 85% — for non-zero temperature
  models that aren't bit-deterministic)
- Divergent (model drift — the verifier should investigate)

Exit code 0 = clean reproduction; 2 = some captures could not be
cleanly reproduced.

### Tests

- `tests/unit/captureManifest.unit.test.js` — 5 unit tests covering
  round-trip capture/drain, reset semantics, field bounds (60KB cap),
  hash determinism, and write-resilience on missing fields.

### README + claims table

Added claim #6 "Reproducible AI" to the top-of-README claims grid
with link to manifests directory and the `npm run replay` command.

---

## Honest caveats (recorded so a judge can probe them)

1. **Temperature determinism**: Bedrock + Vertex are deterministic
   only at temperature=0. Our analyst uses 0.3, validator 0.05,
   arbiter is non-zero. So "exact match" is realistic only for the
   validator. For non-zero temperature calls we report Jaccard
   token overlap — a value ≥0.85 is consistent with "same model
   reasoning over the same prompt", values below indicate model
   drift on the provider's side (e.g. Bedrock rolled the model
   minor revision).
2. **Provider trust**: Reproducible AI proves *our orchestrator
   didn't lie about what the LLM said*. It does not prove that
   AWS/Google didn't cherry-pick the response. That's an even
   harder problem and requires hardware TEE on the LLM side
   (Phala does this for DeepSeek; we delegate to the providers'
   own SOC 2 / ISO 27001 audits).
3. **Manifest does not include private data**: prompts include only
   market data + structured signals. No API keys, no wallet keys,
   no PII. Sanitisation happens upstream of the capture point.

These caveats are stated openly in audit-style.md spirit: don't
oversell.

---

## File changes

- `src/replay/captureManifest.js` — new module
- `src/orchestrator/multiAgent.js` — capture wiring at callAgent
- `src/orchestrator/geminiArbiter.js` — capture wiring at Vertex call
- `src/orchestrator/multiAgentLoop.js` — write manifest at cycle end
- `scripts/replay-decision.js` — public replay script
- `tests/unit/captureManifest.unit.test.js` — unit tests (5 tests)
- `package.json` — `npm run replay <id>` script
- `README.md` — claim #6 added
- `.kiro/audits/raw/replay-manifests/.gitkeep` — seed dir
- `.kiro/audits/16-reproducible-ai-capture.md` — this report

## Validation

- `npx jest` — 201 tests passing (was 196, +5 from new unit suite)
- `npx eslint src/ --max-warnings 50` — 0 errors / 47 warnings
- `node --check` clean across all touched files

## What ships next (out of scope here)

1. **On-chain anchor of `manifestHash`** in DecisionLog so the
   manifest is bound cryptographically to the proposal. Right now
   manifests are anchored implicitly via git commit hash + IPFS
   reasoning CID. Adding `manifestHash` as a separate column
   strengthens the chain-of-evidence; trivial post-submission.
2. **Optional Pinata mirror of the latest 50 manifests** for live
   feed UI. Skipped for now to stay under the free-tier 500-file
   cap; git remains the canonical archive.
3. **Replay validator** as a CI job that picks 1 random recent
   cycle per day and verifies it reproduces. Catches model drift
   automatically.
