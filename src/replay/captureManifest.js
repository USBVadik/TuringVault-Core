/**
 * TuringVault — Reproducible AI Capture Manifest
 *
 * Each multi-agent cycle captures a "replay manifest" — the exact
 * inputs and raw outputs of every LLM call. The manifest is written
 * to .kiro/audits/raw/replay-manifests/cycle-<id>.json and committed
 * with the cycle's normal cron commit. Any third party can clone the
 * repo, re-run the same provider with the same prompt + temperature,
 * and verify that the parsed output matches what we anchored on-chain.
 *
 * This is our answer to "verifiable AI" — instead of trusting a
 * hardware vendor's TEE attestation, anyone can reproduce the
 * inference and check that the output is bit-identical (or
 * statistically aligned for non-zero temperature models).
 *
 * Module is intentionally module-level state. multiAgent.js calls
 * resetCapture() at the top of getMultiAgentDecision(), then
 * captureCall() inside each callAgent / callValidatorWithRetry /
 * callGeminiArbiter, then drainCapture() at the end to retrieve the
 * full set. multiAgentLoop.js then writes it to disk via
 * writeManifest().
 *
 * Spec: .kiro/specs/reproducible-ai (planned post-submission to
 * formalise the data shape; for now this single file is the source
 * of truth).
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const MANIFEST_DIR = path.resolve(
  __dirname,
  "../../.kiro/audits/raw/replay-manifests"
);

// Module-level capture buffer. Cleared by resetCapture() at the start
// of every cycle. Populated by callAgent() each time it talks to a
// model. Drained by writeManifest() at the end of the cycle.
let _buffer = [];

function resetCapture() {
  _buffer = [];
}

/**
 * Record one model call.
 *
 * @param {object} entry
 *   role          — 'analyst' | 'validator' | 'validator-retry' | 'arbiter'
 *   provider      — 'aws-bedrock' | 'gcp-vertex'
 *   modelId       — exact model identifier string passed to the SDK
 *   temperature   — number used for inferenceConfig
 *   maxTokens     — number used for inferenceConfig
 *   systemPrompt  — string, exactly what was sent
 *   userPrompt    — string, exactly what was sent
 *   rawText       — string, raw response text from the model (before parsing)
 *   parsedOk      — boolean, whether the parser succeeded
 *   timing        — { startMs, endMs } around the SDK call
 */
function captureCall(entry) {
  // Defensive copy + guards: never let buffer accumulate non-strings,
  // and keep payload bounded so a runaway response can't bloat the
  // manifest beyond reason.
  const MAX_FIELD = 60_000; // ~60 KB per field cap (well below Pinata + git friendly)
  const safe = {
    role: String(entry.role || "unknown"),
    provider: String(entry.provider || "unknown"),
    modelId: String(entry.modelId || "unknown"),
    temperature:
      typeof entry.temperature === "number" ? entry.temperature : null,
    maxTokens: typeof entry.maxTokens === "number" ? entry.maxTokens : null,
    systemPrompt: String(entry.systemPrompt || "").slice(0, MAX_FIELD),
    userPrompt: String(entry.userPrompt || "").slice(0, MAX_FIELD),
    rawText: String(entry.rawText || "").slice(0, MAX_FIELD),
    parsedOk: entry.parsedOk !== false,
    timing: entry.timing || null,
  };
  _buffer.push(safe);
}

function drainCapture() {
  const out = _buffer;
  _buffer = [];
  return out;
}

/**
 * Return a shallow copy of the current capture buffer WITHOUT clearing
 * it. Used by multiAgentLoop.js to compute the manifestHash mid-cycle
 * (so it can be anchored on-chain) while leaving the buffer in place
 * for the end-of-cycle drainCapture() that writes the manifest file.
 *
 * Pure read; does not mutate state.
 */
function peekCapture() {
  return _buffer.slice();
}

/**
 * Compute a deterministic SHA-256 over the canonical capture set.
 * The hash is what we'd anchor on-chain to bind a specific manifest
 * to a specific decision id, even before it's committed to git.
 *
 * Canonicalisation: stringify with **recursively sorted keys** per
 * object so the same logical payload always produces the same hash
 * regardless of property insertion order. The previous implementation
 * passed `Object.keys(captures).sort()` as the JSON.stringify replacer,
 * which is a property-name whitelist — for an Array that's just the
 * numeric indices, so all real keys got filtered out and every input
 * collapsed to the same hash. Audit 18 fixed this when introducing
 * the on-chain anchor that depends on a meaningful hash.
 */
function manifestHash(captures) {
  const canonical = _canonicalStringify(captures);
  return "0x" + crypto.createHash("sha256").update(canonical).digest("hex");
}

/**
 * Recursive canonical JSON: arrays preserve order, objects sort keys
 * alphabetically, primitives + null + undefined serialise as JSON.
 */
function _canonicalStringify(value) {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(_canonicalStringify).join(",") + "]";
  }
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    return (
      "{" +
      keys
        .map(
          (k) => JSON.stringify(k) + ":" + _canonicalStringify(value[k])
        )
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value);
}

/**
 * Write the manifest for a completed cycle to disk.
 *
 * @param {object} args
 *   decisionId      — number, on-chain decision id
 *   cycleStartedAt  — ISO string
 *   cycleEndedAt    — ISO string
 *   decisionTier    — string, classifier outcome
 *   captures        — array from drainCapture()
 *   marketContext   — small subset of market data the cycle saw
 *   onChain         — { txHashes: string[], ipfsCid: string|null }
 *
 * @returns {object} { path, hash, sizeBytes } — best-effort, falsy on
 *   failure (we never want manifest writes to break the cycle).
 */
function writeManifest(args) {
  try {
    if (!fs.existsSync(MANIFEST_DIR)) {
      fs.mkdirSync(MANIFEST_DIR, { recursive: true });
    }
    const captures = args.captures || [];
    const manifest = {
      schemaVersion: "1.0.0",
      decisionId: args.decisionId ?? null,
      cycleStartedAt: args.cycleStartedAt || null,
      cycleEndedAt: args.cycleEndedAt || null,
      decisionTier: args.decisionTier || null,
      marketContext: args.marketContext || null,
      onChain: args.onChain || null,
      captures,
      hash: manifestHash(captures),
      replayHowTo: [
        "1. Clone the repo at the commit that introduced this manifest.",
        "2. For each capture entry, invoke the named provider+model with " +
          "the captured systemPrompt, userPrompt, temperature, and maxTokens.",
        "3. Compare your rawText against captures[i].rawText. Identical at " +
          "temperature=0; statistically aligned otherwise (≥85% token " +
          "overlap on a stable provider).",
        "4. The manifestHash field is the canonical SHA-256 over the " +
          "captures array — useful as an on-chain anchor.",
      ],
    };
    const fname = `cycle-${String(args.decisionId ?? "x").padStart(4, "0")}.json`;
    const fpath = path.join(MANIFEST_DIR, fname);
    const json = JSON.stringify(manifest, null, 2);
    fs.writeFileSync(fpath, json);
    return {
      path: fpath,
      hash: manifest.hash,
      sizeBytes: Buffer.byteLength(json),
    };
  } catch (e) {
    // Manifest is diagnostic and proof-archival; never let it break
    // the cycle. Operators should investigate the warning, not panic.
    console.warn(
      `  [MANIFEST] Failed to write replay manifest: ${e.message?.slice(0, 200)}`
    );
    return null;
  }
}

module.exports = {
  resetCapture,
  captureCall,
  drainCapture,
  peekCapture,
  manifestHash,
  writeManifest,
  // Exposed for unit tests — no other consumer should touch.
  _MANIFEST_DIR: MANIFEST_DIR,
};
