import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";
import { fulfilledValue } from "./proof-data-resilience.shared.js";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const outcomeMatch = require("./decision-outcome-match.shared.js") as {
  buildOutcomeIndexes: (rows?: OutcomeIndexRow[]) => OutcomeIndexes;
  selectOutcomeRow: (input: {
    decisionLogId: number;
    decisionLogTxHash?: string | null;
    fallbackDecisionTier?: string | null;
    byDecisionId: Map<number, OutcomeIndexRow>;
    byDecisionLogTxHash: Map<string, OutcomeIndexRow>;
  }) => OutcomeIndexRow | null;
};
const { buildOutcomeIndexes, selectOutcomeRow } = outcomeMatch;

const RPC_URL = "https://rpc.mantle.xyz";

const CONTRACTS = {
  DECISION_LOG: "0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5",
  VALIDATION_REGISTRY: "0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6",
  IDENTITY: "0x6f862802e0d5463DF18d267e422347BeCacc28bD",
  REPUTATION: "0xC78119F3274B05046Ac7c38a14298a6cbD946e1a",
};

const DECISION_LOG_ABI = [
  "function totalDecisions() view returns (uint256)",
  "function getRecentDecisions(uint256 count) view returns (tuple(uint256 timestamp, string action, string targetAsset, uint256 amountIn, uint256 amountOut, uint256 confidence, string reasoningHash, bytes32 txHash)[])",
  "function successfulSwaps() view returns (uint256)",
];

const VALIDATION_REGISTRY_ABI = [
  "function totalProposals() view returns (uint256)",
  "function totalApproved() view returns (uint256)",
  "function totalRejected() view returns (uint256)",
  "function getConsensusRate() view returns (uint256 approved, uint256 rejected, uint256 total)",
  "function getRecentProposals(uint256 count) view returns (tuple(uint256 timestamp, string action, string targetAsset, uint256 amountIn, uint256 confidence, string reasoning, uint256 validatorConfidence, string validatorReasoning, uint256 riskScore, uint8 status, uint256 validatedAt, bytes32 executionTxHash)[])",
];

const IDENTITY_ABI = [
  "function tokenURI(uint256 tokenId) view returns (string)",
];

type OutcomeRow = {
  decisionId?: number;
  decisionTier?: string;
  _displayTier?: string;
  displayTier?: string;
  executedOnChain?: boolean;
  decisionLogTxHash?: string | null;
};

type OutcomeIndexRow = {
  decisionId: number;
  decisionLogTxHash?: string | null;
  displayTier: string | null;
  decisionTier: string | null;
  executedOnChain: boolean;
};

type OutcomeIndexes = {
  byDecisionId: Map<number, OutcomeIndexRow>;
  byDecisionLogTxHash: Map<string, OutcomeIndexRow>;
};

function extractDecisionTier(reasoningHash: string | null | undefined) {
  const match = String(reasoningHash || "").match(/^\[([A-Z0-9_]+)\]/);
  return match?.[1] || null;
}

function deriveDisplayTier(input: {
  decisionTier?: string | null;
  displayTier?: string | null;
  executedOnChain?: boolean;
}) {
  const explicit = input.displayTier || null;
  const tier = explicit || input.decisionTier || null;
  if (tier === "EXECUTED_SWAP" && input.executedOnChain === false) {
    return "INTENT_SWAP_NO_EXEC";
  }
  return tier;
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function fetchJsonFromGitHub<T>(filePath: string): Promise<T | null> {
  try {
    const url = `https://raw.githubusercontent.com/USBVadik/TuringVault-Core/main/${filePath}`;
    const res = await fetch(url, { next: { revalidate: 30 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function loadOutcomesIndex() {
  const rows: OutcomeIndexRow[] = [];

  try {
    const localPath = path.resolve(
      process.cwd(),
      "..",
      "src",
      "data",
      "outcomes.json"
    );
    const db = fs.existsSync(localPath)
      ? (JSON.parse(fs.readFileSync(localPath, "utf8")) as {
          pending?: OutcomeRow[];
          settled?: OutcomeRow[];
        })
      : await fetchJsonFromGitHub<{
          pending?: OutcomeRow[];
          settled?: OutcomeRow[];
        }>("src/data/outcomes.json");

    for (const row of [...(db?.pending ?? []), ...(db?.settled ?? [])]) {
      if (typeof row?.decisionId !== "number") continue;
      const executedOnChain = row.executedOnChain === true;
      const decisionTier = row.decisionTier ?? null;
      rows.push({
        decisionId: row.decisionId,
        decisionLogTxHash: row.decisionLogTxHash ?? null,
        displayTier: deriveDisplayTier({
          decisionTier,
          displayTier: row._displayTier ?? row.displayTier ?? null,
          executedOnChain,
        }),
        decisionTier,
        executedOnChain,
      });
    }
  } catch {
    /* best-effort enrichment only */
  }

  return buildOutcomeIndexes(rows);
}

export async function fetchProofDataDirect() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  const decisionLog = new ethers.Contract(
    CONTRACTS.DECISION_LOG,
    DECISION_LOG_ABI,
    provider
  );
  const validationRegistry = new ethers.Contract(
    CONTRACTS.VALIDATION_REGISTRY,
    VALIDATION_REGISTRY_ABI,
    provider
  );
  const identity = new ethers.Contract(
    CONTRACTS.IDENTITY,
    IDENTITY_ABI,
    provider
  );

  const readResults = await Promise.allSettled([
    decisionLog.totalDecisions(),
    decisionLog.getRecentDecisions(20),
    identity.tokenURI(0),
    validationRegistry.getConsensusRate().catch(() => null),
    validationRegistry.getRecentProposals(20).catch(() => []),
    loadOutcomesIndex(),
  ]);

  const totalDecisionsRaw = fulfilledValue(readResults[0], null) as unknown;
  const recentDecisionsRaw = fulfilledValue(readResults[1], []) as unknown;
  const tokenURI = fulfilledValue(readResults[2], null) as unknown;
  const consensusRate = fulfilledValue(
    readResults[3] as PromiseSettledResult<ethers.Result | null> | undefined,
    null
  ) as ethers.Result | null;
  const recentProposals = fulfilledValue(readResults[4], []) as unknown;
  const outcomesIndex = fulfilledValue(
    readResults[5] as
      | PromiseSettledResult<Awaited<ReturnType<typeof loadOutcomesIndex>>>
      | undefined,
    buildOutcomeIndexes()
  );

  // Parse proposals
  const recentProposalRows = Array.isArray(recentProposals)
    ? (recentProposals as ethers.Result[])
    : [];
  const proposals = recentProposalRows.map(
    (p: ethers.Result) => ({
      timestamp: Number(p[0]),
      action: p[1],
      targetAsset: p[2],
      confidence: Number(p[4]),
      reasoning: p[5],
      validatorReasoning: p[7],
      riskScore: Number(p[8]),
      status: ["Pending", "Approved", "Rejected", "Expired"][Number(p[9])],
    })
  );

  // Parse decisions
  const recentDecisionRows = Array.isArray(recentDecisionsRaw)
    ? (recentDecisionsRaw as ethers.Result[])
    : [];
  const totalDecisionCount =
    toFiniteNumber(totalDecisionsRaw) ??
    toFiniteNumber(consensusRate?.[2]) ??
    recentDecisionRows.length;
  const startId = Math.max(0, totalDecisionCount - recentDecisionRows.length);
  const decisions = recentDecisionRows.map(
    (d: ethers.Result, index: number) => {
      const ts = Number(d[0]);
      const decisionLogId = startId + index;
      const matchingProposal = proposals.find(
        (p) => Math.abs(p.timestamp - ts) < 60
      );
      const reasoningHash = d[6];
      const fallbackDecisionTier = extractDecisionTier(reasoningHash);
      const outcomeRow = selectOutcomeRow({
        decisionLogId,
        decisionLogTxHash: d[7],
        fallbackDecisionTier,
        ...outcomesIndex,
      });

      return {
        id: decisionLogId,
        timestamp: ts,
        action: d[1],
        targetAsset: d[2],
        amountIn: d[3].toString(),
        amountOut: d[4].toString(),
        confidence: Number(d[5]),
        reasoningHash,
        txHash: d[7],
        displayTier:
          outcomeRow?.displayTier ??
          deriveDisplayTier({
            decisionTier: outcomeRow?.decisionTier ?? fallbackDecisionTier,
            executedOnChain: outcomeRow?.executedOnChain,
          }),
        executedOnChain: outcomeRow?.executedOnChain ?? false,
        status:
          matchingProposal?.status ||
          (d[1] === "hold" ? "Approved" : "Rejected"),
        riskScore: matchingProposal?.riskScore || 0,
        validatorReasoning: matchingProposal?.validatorReasoning || "",
      };
    }
  );

  // Agent Card from IPFS
  let agentCard = null;
  if (tokenURI) {
    const cid = (tokenURI as string).replace("ipfs://", "");
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const ipfsRes = await fetch(`https://ipfs.io/ipfs/${cid}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (ipfsRes.ok) agentCard = await ipfsRes.json();
    } catch {}
  }

  // Validation consensus
  let validationData = null;
  if (consensusRate) {
    validationData = {
      totalApproved: Number(consensusRate[0]),
      totalRejected: Number(consensusRate[1]),
      totalProposals: Number(consensusRate[2]),
      consensusRate:
        Number(consensusRate[2]) > 0
          ? Math.round(
              (Number(consensusRate[0]) / Number(consensusRate[2])) * 100
            )
          : 0,
    };
  }

  return {
    totalDecisions: totalDecisionCount,
    decisions: decisions.reverse(),
    validation: validationData,
    agentCard,
    tokenURI,
  };
}
