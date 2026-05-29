/**
 * /api/replay/[id]
 *
 * Reproducible AI verification endpoint. Returns the full replay
 * manifest for one cycle, augmented with the on-chain anchor read
 * directly from the Mantle Mainnet DecisionLog contract, plus a
 * server-side binding self-check.
 *
 * The endpoint deliberately does NOT re-invoke Bedrock/Vertex —
 * doing so would require burning our own AWS bill on every page
 * view. Instead it returns the captured prompts and raw responses
 * from the manifest committed to git, alongside the cryptographic
 * anchor that proves the manifest hasn't been edited since the
 * cycle hit Mantle. A judge can verify by recomputing client-side
 * (the page does this in the client component) or pulling
 * `npm run replay <id>` locally if they want to round-trip the
 * provider too.
 *
 * Audit reference: .kiro/audits/18-onchain-anchor-replay-manifest.md
 */
import { NextResponse } from "next/server";
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

export const dynamic = "force-dynamic";
// Cache for 60s on the edge; Vercel ISR revalidate after 5m. Manifests
// are immutable per cycle so caching is safe — we only ever invalidate
// when a new cycle commits.
export const revalidate = 300;

const RPC_URL = "https://rpc.mantle.xyz";
const DECISION_LOG_ADDR = "0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5";
const DECISION_LOG_ABI = [
  "function totalDecisions() view returns (uint256)",
  "function getDecision(uint256 id) view returns (tuple(uint256 timestamp,string action,string targetAsset,uint256 amountIn,uint256 amountOut,uint256 confidence,string reasoningHash,bytes32 txHash))",
];

interface CaptureEntry {
  role: string;
  provider: string;
  modelId: string;
  temperature: number | null;
  maxTokens: number | null;
  systemPrompt: string;
  userPrompt: string;
  rawText: string;
  parsedOk: boolean;
  timing: { startMs: number; endMs: number } | null;
}

interface Manifest {
  schemaVersion: string;
  decisionId: number;
  cycleStartedAt: string | null;
  cycleEndedAt: string | null;
  decisionTier: string | null;
  marketContext: Record<string, unknown> | null;
  onChain: {
    ipfsCid?: string | null;
    proposalId?: number | null;
    manifestHash?: string | null;
    combinedAnchor?: string | null;
    decisionLogTxHash?: string | null;
    decisionLogContract?: string | null;
    chainId?: number | null;
  } | null;
  captures: CaptureEntry[];
  hash: string;
  replayHowTo?: string[];
}

async function readManifest(cycleId: number): Promise<Manifest | null> {
  const fname = `cycle-${String(cycleId).padStart(4, "0")}.json`;
  // Local path: works in dev and in the bundled-monorepo case where
  // the frontend is colocated with the repo.
  const localPath = path.resolve(
    process.cwd(),
    "../.kiro/audits/raw/replay-manifests",
    fname
  );
  if (fs.existsSync(localPath)) {
    return JSON.parse(fs.readFileSync(localPath, "utf8"));
  }
  // Vercel serverless fallback — pull from public GitHub raw.
  try {
    const url = `https://raw.githubusercontent.com/USBVadik/TuringVault-Core/main/.kiro/audits/raw/replay-manifests/${fname}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) return await res.json();
  } catch {
    /* fall through */
  }
  return null;
}

async function readOnChainAnchor(
  decisionId: number
): Promise<{
  txHash: string;
  reasoning: string;
  action: string;
  targetAsset: string;
  confidence: number;
  timestamp: number;
} | null> {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const dl = new ethers.Contract(
      DECISION_LOG_ADDR,
      DECISION_LOG_ABI,
      provider
    );
    const total = await dl.totalDecisions();
    if (decisionId >= Number(total)) return null;
    const d = await dl.getDecision(BigInt(decisionId));
    return {
      timestamp: Number(d[0]),
      action: String(d[1]),
      targetAsset: String(d[2]),
      confidence: Number(d[5]),
      reasoning: String(d[6]),
      txHash: String(d[7]), // bytes32 — our combinedAnchor
    };
  } catch {
    return null;
  }
}

function recomputeAnchor(ipfsCid: string, manifestHash: string): string {
  return ethers.keccak256(
    ethers.concat([ethers.toUtf8Bytes(ipfsCid), manifestHash])
  );
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const cycleId = parseInt(id, 10);
  if (Number.isNaN(cycleId) || cycleId < 0) {
    return NextResponse.json(
      { error: "cycle id must be a non-negative integer" },
      { status: 400 }
    );
  }

  const manifest = await readManifest(cycleId);
  if (!manifest) {
    return NextResponse.json(
      {
        error: "manifest-not-found",
        cycleId,
        hint:
          "manifests live under .kiro/audits/raw/replay-manifests/cycle-NNNN.json — check the latest committed cycle id",
      },
      { status: 404 }
    );
  }

  const onChain = await readOnChainAnchor(cycleId);

  // Server-side binding self-check. We deliberately do this here
  // (not just in the client) so the API consumer gets a
  // pre-validated answer.
  let binding: {
    expected: string | null;
    onChain: string | null;
    matches: boolean;
    note: string;
  } = {
    expected: null,
    onChain: null,
    matches: false,
    note: "no-onchain-data",
  };
  if (
    manifest.onChain?.ipfsCid &&
    manifest.onChain?.manifestHash &&
    onChain?.txHash
  ) {
    const expected = recomputeAnchor(
      manifest.onChain.ipfsCid,
      manifest.onChain.manifestHash
    );
    binding = {
      expected,
      onChain: onChain.txHash,
      matches: expected.toLowerCase() === onChain.txHash.toLowerCase(),
      note:
        expected.toLowerCase() === onChain.txHash.toLowerCase()
          ? "ok"
          : "mismatch",
    };
  } else if (
    !manifest.onChain?.combinedAnchor &&
    !manifest.onChain?.manifestHash
  ) {
    // Pre-audit-18 manifests lack the combinedAnchor + manifestHash
    // fields; their on-chain row carries the legacy keccak256(ipfsCid)
    // value. Surface this honestly rather than reporting mismatch.
    binding.note = "legacy-manifest-pre-audit-18";
  }

  return NextResponse.json(
    {
      cycleId,
      manifest,
      onChain,
      binding,
      verifyHowTo: {
        local:
          "git clone the repo, then `node scripts/replay-decision.js " +
          cycleId +
          "` re-invokes Bedrock + Vertex with the captured prompts.",
        clientSide:
          "recompute keccak256(utf8(ipfsCid) || manifestHash) and match against onChain.txHash. Done automatically by /replay/" +
          cycleId +
          ".",
        explorer:
          "https://mantlescan.xyz/address/" +
          DECISION_LOG_ADDR +
          "#readContract — call getDecision(" +
          cycleId +
          ") and read the txHash field.",
      },
    },
    {
      headers: {
        "Cache-Control":
          "public, s-maxage=300, stale-while-revalidate=86400",
      },
    }
  );
}
