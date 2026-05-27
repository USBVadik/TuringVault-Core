/**
 * GET /api/decisions
 *
 * Returns:
 *   - total counts from ValidationRegistry (proposals/approved/rejected)
 *   - last N decisions from DecisionLog with REAL on-chain fields
 *     (timestamp, amountIn, amountOut) — previously the route fabricated
 *     timestamps as `now - i*1800` and amountIn as `1e18` for every entry
 *     which produced the misleading "1.000 MNT" column.
 *
 * Spec: .kiro/specs/ui-honesty-pass (no-lying-about-state rule)
 */

import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { ethers } from "ethers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DECISION_LOG_ADDR = "0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5";
const VALIDATION_REGISTRY = "0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6";

const DECISION_ABI = [
  "event DecisionLogged(uint256 indexed decisionId, string action, string targetAsset, uint256 confidence, string reasoningHash)",
  "function totalDecisions() view returns (uint256)",
  // Decisions array exposes a public auto-getter; tuple ordering matches the struct.
  "function decisions(uint256) view returns (uint256 timestamp, string action, string targetAsset, uint256 amountIn, uint256 amountOut, uint256 confidence, string reasoningHash, bytes32 txHash)",
];

const REGISTRY_ABI = [
  "function totalProposals() view returns (uint256)",
  "function totalApproved() view returns (uint256)",
  "function totalRejected() view returns (uint256)",
];

const RECENT_LIMIT = 20;

type AssetClass =
  | "rwa-treasury"
  | "eth-staking"
  | "stable"
  | "native"
  | "unknown";

/**
 * Classify a decision row by asset class so the frontend can colour /
 * filter RWA swaps separately from mETH/mUSD trades.
 *
 * Spec: rwa-allocation-active R5, design §C8.
 */
function classifyAsset(
  targetAsset: string | null,
  rwaIntent: { source?: string } | null
): AssetClass {
  if (rwaIntent?.source) return "rwa-treasury";
  const t = (targetAsset || "").toLowerCase();
  if (t === "meth" || t === "eth") return "eth-staking";
  if (t === "usdt0") return "rwa-treasury";
  if (t === "usdt" || t === "musd" || t === "usd" || t === "usdy")
    return "stable";
  if (t === "mnt" || t === "wmnt") return "native";
  return "unknown";
}

/**
 * Read outcomes.json once and index by decisionId so we can look up
 * each event's matching rwaIntent in O(1).
 */
function loadOutcomesIndex(): Map<
  number,
  { rwaIntent: { source?: string; executed?: boolean } | null }
> {
  const out = new Map<
    number,
    { rwaIntent: { source?: string; executed?: boolean } | null }
  >();
  try {
    const p = path.resolve(process.cwd(), "..", "src", "data", "outcomes.json");
    if (!fs.existsSync(p)) return out;
    const db = JSON.parse(fs.readFileSync(p, "utf-8"));
    const all = [...(db.pending ?? []), ...(db.settled ?? [])];
    for (const e of all) {
      if (typeof e?.decisionId === "number") {
        out.set(e.decisionId, { rwaIntent: e.rwaIntent ?? null });
      }
    }
  } catch {
    /* best-effort */
  }
  return out;
}

export async function GET() {
  try {
    const provider = new ethers.JsonRpcProvider("https://rpc.mantle.xyz");
    const contract = new ethers.Contract(
      DECISION_LOG_ADDR,
      DECISION_ABI,
      provider
    );
    const registry = new ethers.Contract(
      VALIDATION_REGISTRY,
      REGISTRY_ABI,
      provider
    );

    const [totalProposals, totalApproved, totalRejected] = await Promise.all([
      registry.totalProposals(),
      registry.totalApproved(),
      registry.totalRejected(),
    ]);

    const total = Number(totalProposals);

    // Pull recent DecisionLogged events so we can attach the tx hash + block.
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 500_000);
    const events = await contract.queryFilter("DecisionLogged", fromBlock);
    const recentEvents = events.slice(-RECENT_LIMIT);

    const outcomesIndex = loadOutcomesIndex();

    // For each event, also fetch the on-chain Decision struct so we get
    // the real timestamp + amounts. This is N reads (≤ 20 in practice)
    // — acceptable for the dashboard surface; we could shave with multicall later.
    const decisions = await Promise.all(
      recentEvents.map(async (e) => {
        const args = (e as ethers.EventLog).args;
        const id = Number(args[0]);
        let onchain: {
          timestamp: number;
          amountIn: string;
          amountOut: string;
        } | null = null;
        try {
          const d = await contract.decisions(id);
          onchain = {
            timestamp: Number(d[0]),
            amountIn: d[3].toString(),
            amountOut: d[4].toString(),
          };
        } catch {
          onchain = null;
        }
        const targetAsset = args[2] as string;
        const outcomeRow = outcomesIndex.get(id);
        const rwaIntent = outcomeRow?.rwaIntent ?? null;
        return {
          id,
          action: args[1],
          targetAsset,
          asset: targetAsset,
          assetClass: classifyAsset(targetAsset, rwaIntent),
          confidence: Number(args[3]),
          reasoningHash: (args[4] as string)?.substring(0, 200),
          reasoning: (args[4] as string)?.substring(0, 200),
          txHash: e.transactionHash,
          block: e.blockNumber,
          // Real on-chain values when struct read succeeded; null otherwise
          // (frontend renders '—' for null).
          timestamp: onchain?.timestamp ?? null,
          amountIn: onchain?.amountIn ?? null,
          amountOut: onchain?.amountOut ?? null,
          // RWA-specific surface (rwa-allocation-active R5).
          rwaIntent:
            rwaIntent && rwaIntent.executed
              ? { source: rwaIntent.source ?? null, executed: true }
              : null,
        };
      })
    );

    decisions.reverse(); // newest first

    return NextResponse.json({
      total,
      totalDecisions: total,
      totalProposals: total,
      totalApproved: Number(totalApproved),
      totalRejected: Number(totalRejected),
      decisions,
      contract: DECISION_LOG_ADDR,
      chain: "Mantle Mainnet (5000)",
      dataScope: "agent-lifetime",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
