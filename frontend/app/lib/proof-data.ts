import { ethers } from "ethers";

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

  const [
    totalDecisions,
    recentDecisions,
    tokenURI,
    consensusRate,
    recentProposals,
  ] = await Promise.all([
    decisionLog.totalDecisions(),
    decisionLog.getRecentDecisions(20),
    identity.tokenURI(0),
    validationRegistry.getConsensusRate().catch(() => null),
    validationRegistry.getRecentProposals(20).catch(() => []),
  ]);

  // Parse proposals
  const proposals = (recentProposals as ethers.Result[]).map(
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
  const decisions = (recentDecisions as ethers.Result[]).map(
    (d: ethers.Result) => {
      const ts = Number(d[0]);
      const matchingProposal = proposals.find(
        (p) => Math.abs(p.timestamp - ts) < 60
      );

      return {
        timestamp: ts,
        action: d[1],
        targetAsset: d[2],
        amountIn: d[3].toString(),
        amountOut: d[4].toString(),
        confidence: Number(d[5]),
        reasoningHash: d[6],
        txHash: d[7],
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
    totalDecisions: Number(totalDecisions),
    decisions: decisions.reverse(),
    validation: validationData,
    agentCard,
    tokenURI,
  };
}
