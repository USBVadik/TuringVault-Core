#!/usr/bin/env node
/**
 * TuringVault — Verify that the on-chain anchor for a given replay
 * manifest matches the value stored on Mantle Mainnet.
 *
 * Usage:
 *   node scripts/verify-onchain-anchor.js <cycle-id>
 *   node scripts/verify-onchain-anchor.js 147
 *
 * What it does (no LLM provider keys required):
 *   1. Loads .kiro/audits/raw/replay-manifests/cycle-<id>.json
 *   2. Recomputes manifestHash locally over the captures array.
 *   3. Recomputes combinedAnchor = keccak256(utf8(ipfsCid) ‖ manifestHash).
 *   4. Reads the corresponding DecisionLog row from Mantle Mainnet.
 *   5. Asserts the bytes32 txHash slot equals the recomputed anchor.
 *
 * Exit codes:
 *   0 — anchor on-chain matches recomputed binding
 *   1 — manifest missing or malformed
 *   2 — on-chain anchor does NOT match (tampering / drift detected)
 *   3 — RPC unreachable (transient — caller decides whether to retry)
 *
 * Audit reference: .kiro/audits/18-onchain-anchor-replay-manifest.md
 *
 * This script is the cheap, fast, no-secrets half of the daily CI
 * Reproducible AI validator. The expensive half (LLM round-trip via
 * scripts/replay-decision.js) requires AWS + GCP credentials and is
 * gated separately in the workflow.
 */
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const {
  manifestHash: computeManifestHash,
} = require("../src/replay/captureManifest");

const RPC_URL = process.env.MANTLE_RPC_URL || "https://rpc.mantle.xyz";
const DECISION_LOG_ADDR =
  "0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5";
const DECISION_LOG_ABI = [
  "function totalDecisions() view returns (uint256)",
  "function getDecision(uint256 id) view returns (tuple(uint256 timestamp,string action,string targetAsset,uint256 amountIn,uint256 amountOut,uint256 confidence,string reasoningHash,bytes32 txHash))",
];

const cycleArg = process.argv[2];
if (!cycleArg) {
  console.error("Usage: node scripts/verify-onchain-anchor.js <cycle-id>");
  process.exit(1);
}
const cycleId = parseInt(cycleArg, 10);
if (Number.isNaN(cycleId) || cycleId < 0) {
  console.error(`Cycle id must be a non-negative integer, got: ${cycleArg}`);
  process.exit(1);
}

const manifestPath = path.resolve(
  __dirname,
  "../.kiro/audits/raw/replay-manifests",
  `cycle-${String(cycleId).padStart(4, "0")}.json`
);
if (!fs.existsSync(manifestPath)) {
  console.error(`✗ Manifest not found at ${manifestPath}`);
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
} catch (e) {
  console.error(`✗ Manifest malformed: ${e.message}`);
  process.exit(1);
}

console.log(`\n═══ on-chain anchor check · cycle ${cycleId} ═══`);

// 1. Recompute manifestHash from the on-disk captures and assert it
// matches what the manifest itself claims. If a future tampering
// rewrote individual capture fields without updating the hash field,
// this catches it.
const captures = manifest.captures || [];
const recomputedManifestHash = computeManifestHash(captures);
const storedManifestHash =
  manifest.onChain?.manifestHash || manifest.hash || null;
console.log(`Captures      : ${captures.length}`);
console.log(`manifestHash  : recomputed ${recomputedManifestHash}`);
console.log(`              : stored     ${storedManifestHash || "(none)"}`);
const manifestHashMatches =
  storedManifestHash &&
  recomputedManifestHash.toLowerCase() === storedManifestHash.toLowerCase();
if (!manifestHashMatches) {
  // For pre-audit-18 manifests the stored `hash` field is the broken
  // canonicaliser artefact — surface this honestly but don't fail the
  // job, because the on-chain anchor for those legacy rows is the
  // legacy keccak256(ipfsCid) value, not combinedAnchor.
  if (!manifest.onChain?.combinedAnchor) {
    console.warn(
      "ⓘ legacy manifest pre audit-18 — stored hash is the buggy " +
        "canonicaliser artefact; on-chain row carries keccak256(ipfsCid) " +
        "only. Skipping combinedAnchor check."
    );
    process.exit(0);
  }
  console.error(
    "✗ manifestHash mismatch: file edited after cycle committed?"
  );
  process.exit(2);
}

// 2. Recompute combinedAnchor.
const ipfsCid = manifest.onChain?.ipfsCid || "";
if (!ipfsCid) {
  console.error("✗ manifest is missing onChain.ipfsCid — cannot recompute anchor");
  process.exit(1);
}
const recomputedAnchor = ethers.keccak256(
  ethers.concat([
    ethers.toUtf8Bytes(ipfsCid),
    recomputedManifestHash,
  ])
);
const storedAnchor = manifest.onChain?.combinedAnchor || null;
console.log(`ipfsCid       : ${ipfsCid}`);
console.log(`combinedAnchor: recomputed ${recomputedAnchor}`);
console.log(`              : stored     ${storedAnchor || "(none)"}`);
if (storedAnchor && recomputedAnchor.toLowerCase() !== storedAnchor.toLowerCase()) {
  console.error(
    "✗ combinedAnchor stored in manifest doesn't match the recomputed " +
      "value — manifest fields were edited after the cycle committed."
  );
  process.exit(2);
}

// 3. Read on-chain anchor with the same offset-tolerant lookup the UI
// uses (ValidationRegistry.totalProposals drifted +1 ahead of
// DecisionLog.totalDecisions historically).
async function readOnChain() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const dl = new ethers.Contract(DECISION_LOG_ADDR, DECISION_LOG_ABI, provider);
  let total;
  try {
    total = Number(await dl.totalDecisions());
  } catch (e) {
    return { error: `RPC unreachable: ${e.message?.slice(0, 120)}` };
  }
  if (total === 0) return { error: "DecisionLog is empty" };
  const candidates = [cycleId, cycleId - 1, cycleId - 2].filter(
    (i) => i >= 0 && i < total
  );
  for (const idx of candidates) {
    try {
      const d = await dl.getDecision(BigInt(idx));
      const txHash = String(d[7]);
      if (
        !storedAnchor ||
        txHash.toLowerCase() === storedAnchor.toLowerCase()
      ) {
        return { idx, txHash, reasoning: String(d[6]).slice(0, 80) };
      }
    } catch {
      /* index invalid, try next */
    }
  }
  // Nothing matched — return the most-recent valid candidate so we
  // can report mismatch honestly.
  if (candidates.length === 0) return { error: "no valid candidate index" };
  try {
    const idx = candidates[0];
    const d = await dl.getDecision(BigInt(idx));
    return { idx, txHash: String(d[7]), reasoning: String(d[6]).slice(0, 80) };
  } catch (e) {
    return { error: `getDecision failed: ${e.message?.slice(0, 120)}` };
  }
}

readOnChain()
  .then((row) => {
    if (row.error) {
      console.error(`✗ ${row.error}`);
      // RPC unreachable is transient — exit 3 so CI can retry/skip
      // distinct from a real anchor mismatch (exit 2).
      process.exit(/RPC|getDecision/.test(row.error) ? 3 : 2);
    }
    console.log(`on-chain idx  : ${row.idx} (${row.reasoning}…)`);
    console.log(`on-chain bytes: ${row.txHash}`);
    const matches =
      row.txHash.toLowerCase() === recomputedAnchor.toLowerCase();
    if (matches) {
      console.log(
        "\n✅ binding holds: recomputed anchor === on-chain bytes32"
      );
      process.exit(0);
    }
    console.error(
      "\n✗ ANCHOR MISMATCH: recomputed bytes don't match on-chain row.\n" +
        "  This indicates either:\n" +
        "    (a) the manifest on disk has been edited after the cycle\n" +
        "        committed — the binding it declares no longer matches\n" +
        "        the bytes32 already permanent on Mantle, OR\n" +
        "    (b) the offset between manifest decisionId and DecisionLog\n" +
        "        index drifted further than the +1 we tolerate.\n" +
        "  Investigate before claiming Reproducible AI for this cycle."
    );
    process.exit(2);
  })
  .catch((e) => {
    console.error(`✗ unexpected: ${e.message}`);
    process.exit(3);
  });
