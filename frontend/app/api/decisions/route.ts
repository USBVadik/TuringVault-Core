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
// Audit Section 3 weakness #3 — was 0, every request hits Mantle RPC.
// Now 60s ISR with s-maxage=60, stale-while-revalidate=600 below so
// a Mantlescan-side or Cloudflare 502 doesn't break /proof-explorer.
export const revalidate = 60;

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
async function loadOutcomesIndex(): Promise<Map<
  number,
  {
    rwaIntent: { source?: string; executed?: boolean } | null;
    executedOnChain: boolean;
    displayTier: string | null;
    decisionTier: string | null;
    // Audit 19/20 provenance — surfaced on /api/decisions so the
    // dashboard can render a "fed by Binance fallback" pill.
    priceSource: string | null;
    priceFromSnapshot: boolean;
    priceSnapshotAgeSec: number | null;
    candleSource: string | null;
    candleFromSnapshot: boolean;
    candleSnapshotAgeSec: number | null;
  }
>> {
  const out = new Map<
    number,
    {
      rwaIntent: { source?: string; executed?: boolean } | null;
      executedOnChain: boolean;
      displayTier: string | null;
      decisionTier: string | null;
      priceSource: string | null;
      priceFromSnapshot: boolean;
      priceSnapshotAgeSec: number | null;
      candleSource: string | null;
      candleFromSnapshot: boolean;
      candleSnapshotAgeSec: number | null;
    }
  >();
  try {
    const p = path.resolve(process.cwd(), "..", "src", "data", "outcomes.json");
    let db: {
      pending?: Array<{
        decisionId?: number;
        rwaIntent?: { source?: string; executed?: boolean };
        decisionTier?: string;
        _displayTier?: string;
        executedOnChain?: boolean;
        txHash?: string | null;
        directionalSwap?: { executed?: boolean; legs?: Array<{ txHash?: string }> };
        priceSource?: string | null;
        priceFromSnapshot?: boolean;
        priceSnapshotAgeSec?: number | null;
        candleSource?: string | null;
        candleFromSnapshot?: boolean;
        candleSnapshotAgeSec?: number | null;
      }>;
      settled?: Array<{
        decisionId?: number;
        rwaIntent?: { source?: string; executed?: boolean };
        decisionTier?: string;
        _displayTier?: string;
        executedOnChain?: boolean;
        txHash?: string | null;
        directionalSwap?: { executed?: boolean; legs?: Array<{ txHash?: string }> };
        priceSource?: string | null;
        priceFromSnapshot?: boolean;
        priceSnapshotAgeSec?: number | null;
        candleSource?: string | null;
        candleFromSnapshot?: boolean;
        candleSnapshotAgeSec?: number | null;
      }>;
    } | null = null;
    if (fs.existsSync(p)) {
      db = JSON.parse(fs.readFileSync(p, "utf-8"));
    } else {
      db = await fetchFromGitHub("src/data/outcomes.json");
    }
    if (!db) return out;
    const all = [...(db.pending ?? []), ...(db.settled ?? [])];
    for (const e of all) {
      if (typeof e?.decisionId !== "number") continue;
      const fallbackExecuted =
        Boolean(e.txHash) ||
        e.rwaIntent?.executed === true ||
        e.directionalSwap?.executed === true ||
        (Array.isArray(e.directionalSwap?.legs) &&
          e.directionalSwap!.legs!.some((l) => Boolean(l?.txHash)));
      const executedOnChain =
        typeof e.executedOnChain === "boolean"
          ? e.executedOnChain
          : fallbackExecuted;
      const tier = e.decisionTier ?? null;
      const displayTier =
        e._displayTier ??
        (tier === "EXECUTED_SWAP" && !executedOnChain
          ? "INTENT_SWAP_NO_EXEC"
          : tier);
      out.set(e.decisionId, {
        rwaIntent: e.rwaIntent ?? null,
        executedOnChain,
        displayTier,
        decisionTier: tier,
        priceSource: e.priceSource ?? null,
        priceFromSnapshot: e.priceFromSnapshot === true,
        priceSnapshotAgeSec: e.priceSnapshotAgeSec ?? null,
        candleSource: e.candleSource ?? null,
        candleFromSnapshot: e.candleFromSnapshot === true,
        candleSnapshotAgeSec: e.candleSnapshotAgeSec ?? null,
      });
    }
  } catch {
    /* best-effort */
  }
  return out;
}

async function fetchFromGitHub(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const url = `https://raw.githubusercontent.com/USBVadik/TuringVault-Core/main/${filePath}`;
    const res = await fetch(url, { next: { revalidate: 30 } });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
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

    const outcomesIndex = await loadOutcomesIndex();

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
        // ValidationRegistry.totalProposals drifted +1 ahead of
        // DecisionLog.totalDecisions historically (one early cycle
        // wrote a proposal but not a DecisionLog entry). The
        // outcomes ledger is keyed by `decisionId` from the
        // ValidationRegistry side (i.e. proposalId = manifest
        // cycle id). On-chain events here are keyed by
        // DecisionLog row index = proposalId - 1. Probe both
        // candidates: prefer the +1 match (which corresponds to
        // the same cycle) and fall back to exact id for legacy
        // rows that pre-date the drift.
        // Audit ref: .kiro/audits/19, /api/replay/[id]/route.ts
        // uses the same offset-tolerant lookup.
        const outcomeRow =
          outcomesIndex.get(id + 1) || outcomesIndex.get(id);
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
          // Honesty surface (workspace rule no-lying-about-state §4).
          // executedOnChain reflects whether this decision actually
          // produced any DEX TX (via rwaResult.txHash, directionalSwap
          // legs, or row.txHash in outcomes.json). displayTier is the
          // tier the UI should render — equal to decisionTier in the
          // happy path, but rewritten to INTENT_SWAP_NO_EXEC when the
          // classifier said EXECUTED_SWAP without a tx hash to back it.
          executedOnChain: outcomeRow?.executedOnChain ?? false,
          displayTier:
            outcomeRow?.displayTier ?? outcomeRow?.decisionTier ?? null,
          // Audit 19/20: which upstream feed served this cycle's
          // prices and candles. Surfaced so a judge can see "Cycle
          // 149 was fed by Binance fallback" when relevant — making
          // the multi-source resilience visible. null on cycles
          // before the audit-19/20 instrumentation landed.
          priceSource: outcomeRow?.priceSource ?? null,
          priceFromSnapshot: outcomeRow?.priceFromSnapshot ?? false,
          priceSnapshotAgeSec: outcomeRow?.priceSnapshotAgeSec ?? null,
          candleSource: outcomeRow?.candleSource ?? null,
          candleFromSnapshot: outcomeRow?.candleFromSnapshot ?? false,
          candleSnapshotAgeSec: outcomeRow?.candleSnapshotAgeSec ?? null,
        };
      })
    );

    decisions.reverse(); // newest first

    return NextResponse.json(
      {
        total,
        totalDecisions: total,
        totalProposals: total,
        totalApproved: Number(totalApproved),
        totalRejected: Number(totalRejected),
        decisions,
        contract: DECISION_LOG_ADDR,
        chain: "Mantle Mainnet (5000)",
        dataScope: "agent-lifetime",
      },
      {
        // SWR: edge keeps the last successful payload for 60s and
        // serves it stale up to 10min while it re-fetches behind
        // the scenes. Section 3 weakness #3 (Mantlescan/Cloudflare
        // 502 → judge sees broken page).
        headers: {
          "Cache-Control":
            "public, s-maxage=60, stale-while-revalidate=600",
          "X-Cache-Mode": "swr",
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
