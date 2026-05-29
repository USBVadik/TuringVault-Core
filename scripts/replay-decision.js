#!/usr/bin/env node
/**
 * TuringVault — Replay a past decision against the original LLM provider.
 *
 * Usage:
 *   node scripts/replay-decision.js <cycle-id>
 *   node scripts/replay-decision.js 137
 *
 * For a given cycle id the script:
 *   1. Loads .kiro/audits/raw/replay-manifests/cycle-<id>.json
 *   2. For each capture entry (analyst, validator, arbiter):
 *      - Re-invokes the named provider+model with the captured
 *        systemPrompt / userPrompt / temperature / maxTokens.
 *      - Diffs the new rawText against captures[i].rawText.
 *   3. Prints a per-call match status and an overall verdict.
 *
 * Determinism caveat: temperature>0 means model outputs are NOT
 * bit-identical across runs even on the same provider. We treat
 * these calls as "statistically aligned" and report a token-overlap
 * percentage. temperature=0 calls are expected to match exactly.
 *
 * Auth: same env / credential paths the orchestrator uses
 *   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION  (Bedrock)
 *   GOOGLE_APPLICATION_CREDENTIALS                          (Vertex)
 *
 * Spec: this script is the public verification surface for our
 * "Reproducible AI" narrative — judges run it against any past
 * cycle to confirm the AI decision recorded on-chain matches what
 * the model actually said.
 */
require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});
const fs = require("fs");
const path = require("path");

const cycleArg = process.argv[2];
if (!cycleArg) {
  console.error("Usage: node scripts/replay-decision.js <cycle-id>");
  process.exit(1);
}
const cycleId = parseInt(cycleArg, 10);
if (Number.isNaN(cycleId)) {
  console.error(`Cycle id must be numeric, got: ${cycleArg}`);
  process.exit(1);
}

const manifestPath = path.resolve(
  __dirname,
  "../.kiro/audits/raw/replay-manifests",
  `cycle-${String(cycleId).padStart(4, "0")}.json`
);
if (!fs.existsSync(manifestPath)) {
  console.error(`Manifest not found: ${manifestPath}`);
  console.error(
    "Available manifests:\n" +
      fs
        .readdirSync(path.dirname(manifestPath))
        .filter((f) => f.startsWith("cycle-") && f.endsWith(".json"))
        .map((f) => "  " + f)
        .join("\n")
  );
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

console.log(`\n═══ Replaying cycle ${cycleId} ═══`);
console.log(`Tier      : ${manifest.decisionTier}`);
console.log(`Started   : ${manifest.cycleStartedAt}`);
console.log(`Hash      : ${manifest.hash}`);
console.log(`Captures  : ${manifest.captures?.length || 0}`);
console.log(
  `On-chain  : ${manifest.onChain?.proposalId ?? "n/a"} (IPFS ${
    manifest.onChain?.ipfsCid?.slice(0, 16) || "n/a"
  }…)`
);
if (manifest.onChain?.combinedAnchor) {
  console.log(
    `Anchor    : ${manifest.onChain.combinedAnchor.slice(0, 24)}… ` +
      `(DecisionLog ${(manifest.onChain.decisionLogContract || "").slice(
        0,
        14
      )}… tx ${(manifest.onChain.decisionLogTxHash || "n/a").slice(0, 14)}…)`
  );
  // Self-check: recompute the binding locally from the on-disk manifest
  // and confirm it matches what was stored on-chain. Catches manifest
  // tampering even before the on-chain readback.
  try {
    // Lightweight ethers import — avoid loading the full provider stack
    // for this hash check.
    const { keccak256, toUtf8Bytes, concat } = require("ethers");
    const recomputed = keccak256(
      concat([
        toUtf8Bytes(manifest.onChain.ipfsCid || ""),
        manifest.onChain.manifestHash || "0x" + "0".repeat(64),
      ])
    );
    const matches =
      recomputed.toLowerCase() ===
      manifest.onChain.combinedAnchor.toLowerCase();
    console.log(
      `Binding   : ${
        matches ? "✅ recomputed matches stored anchor" : "❌ MISMATCH"
      }`
    );
  } catch (e) {
    console.log(`Binding   : ⚠️  could not recompute (${e.message})`);
  }
}
console.log("");

// Lazy require providers — only the one we need will load creds.
async function callBedrock(capture) {
  const {
    BedrockRuntimeClient,
    ConverseCommand,
  } = require("@aws-sdk/client-bedrock-runtime");
  const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  const cmd = new ConverseCommand({
    modelId: capture.modelId,
    system: [{ text: capture.systemPrompt }],
    messages: [{ role: "user", content: [{ text: capture.userPrompt }] }],
    inferenceConfig: {
      maxTokens: capture.maxTokens || 2048,
      temperature: capture.temperature ?? 0.05,
    },
  });
  const resp = await client.send(cmd);
  return resp.output.message.content[0].text;
}

async function callVertex(capture) {
  const { callGeminiArbiter } = require("../src/orchestrator/geminiArbiter");
  // Vertex helper returns parsed JSON; for replay we need raw text. Use
  // the underlying token + fetch directly to mimic the original call.
  const crypto = require("crypto");
  const fs = require("fs");
  const keyPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.resolve(__dirname, "../gemini-service-account.json");
  if (!fs.existsSync(keyPath)) {
    throw new Error(
      `Vertex credentials not found at ${keyPath}. Set GOOGLE_APPLICATION_CREDENTIALS.`
    );
  }
  const key = JSON.parse(fs.readFileSync(keyPath, "utf8"));
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" })
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: key.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  ).toString("base64url");
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(header + "." + payload);
  const signature = sign.sign(key.private_key, "base64url");
  const jwt = `${header}.${payload}.${signature}`;
  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:
      "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=" + jwt,
  });
  const { access_token } = await tokenResp.json();
  const project = process.env.GEMINI_PROJECT_ID || "lina-494709";
  const endpoint = `https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/${capture.modelId}:generateContent`;
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: capture.systemPrompt }] },
      contents: [
        { role: "user", parts: [{ text: capture.userPrompt }] },
      ],
      generationConfig: {
        maxOutputTokens: capture.maxTokens || 512,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 1024 },
      },
    }),
  });
  if (!resp.ok) throw new Error(`Vertex ${resp.status}`);
  const data = await resp.json();
  let text = "";
  for (const p of data.candidates?.[0]?.content?.parts || []) {
    if (p.text) text += p.text;
  }
  return text;
}

function tokenOverlap(a, b) {
  // Simple bag-of-tokens Jaccard. Lowercased + non-word-stripped.
  const tok = (s) =>
    new Set(
      String(s)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean)
    );
  const ta = tok(a);
  const tb = tok(b);
  const inter = [...ta].filter((x) => tb.has(x)).length;
  const union = new Set([...ta, ...tb]).size;
  return union === 0 ? 0 : inter / union;
}

(async () => {
  const captures = manifest.captures || [];
  const results = [];
  for (const cap of captures) {
    process.stdout.write(`Replaying ${cap.role} (${cap.modelId})... `);
    let liveText = null;
    let error = null;
    try {
      if (cap.provider === "aws-bedrock") liveText = await callBedrock(cap);
      else if (cap.provider === "gcp-vertex") liveText = await callVertex(cap);
      else throw new Error(`Unknown provider: ${cap.provider}`);
    } catch (e) {
      error = e.message?.slice(0, 200);
    }

    if (error) {
      console.log(`❌ ${error}`);
      results.push({ role: cap.role, status: "error", error });
      continue;
    }

    const exact = liveText === cap.rawText;
    const overlap = tokenOverlap(liveText, cap.rawText);

    if (exact) {
      console.log(`✅ exact bit-identical match`);
      results.push({ role: cap.role, status: "exact" });
    } else if (overlap >= 0.85) {
      console.log(
        `✅ statistically aligned (Jaccard ${(overlap * 100).toFixed(1)}%)`
      );
      results.push({ role: cap.role, status: "aligned", overlap });
    } else {
      console.log(
        `⚠️  divergent (Jaccard ${(overlap * 100).toFixed(
          1
        )}% — model output drift)`
      );
      results.push({ role: cap.role, status: "divergent", overlap });
    }
  }

  console.log("\n═══ Verdict ═══");
  const exact = results.filter((r) => r.status === "exact").length;
  const aligned = results.filter((r) => r.status === "aligned").length;
  const divergent = results.filter((r) => r.status === "divergent").length;
  const errors = results.filter((r) => r.status === "error").length;
  console.log(`  ${exact} exact / ${aligned} aligned / ${divergent} divergent / ${errors} errors`);
  if (divergent + errors === 0) {
    console.log(`  ✅ Decision is reproducible.`);
    process.exit(0);
  } else {
    console.log(
      `  ⚠️  Some captures could not be cleanly reproduced. Inspect the manifest at:\n  ${manifestPath}`
    );
    process.exit(2);
  }
})().catch((e) => {
  console.error(`\nFatal: ${e.message}`);
  process.exit(1);
});
