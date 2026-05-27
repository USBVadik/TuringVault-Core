import { ProofExplorerClient } from "./client";
import { fetchProofDataDirect } from "../lib/proof-data";

const CONTRACTS = {
  DECISION_LOG: "0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5",
  VALIDATION_REGISTRY: "0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6",
  IDENTITY: "0x6f862802e0d5463DF18d267e422347BeCacc28bD",
  REPUTATION: "0xC78119F3274B05046Ac7c38a14298a6cbD946e1a",
};

// Blocked would-have-lost cases with real on-chain data
const BLOCKED_CASES = [
  {
    id: 12,
    title: "Panic Swap Blocked",
    intent: "Swap ETH → mUSD during extreme fear",
    validatorReason:
      "Surface-level fear metrics don't justify exit when fundamentals intact",
    varScore: 228,
    riskScore: 67,
    txHash:
      "0x22273b79a8f73998576f7e76c3699e70024bcbeb048d70e49d7fd19ca2693001",
    marketAfter: "+1.2%",
    savedEstimate: "~$25 per $2,000",
    timestamp: 1747751496,
  },
  {
    id: 10,
    title: "Low Volume Fear Blocked",
    intent: 'Exit position on "weak conviction" signal',
    validatorReason:
      "Low mETH volume ≠ weak market. Swap locks agent out of recovery",
    varScore: 193,
    riskScore: 67,
    txHash:
      "0x4843e59763f262973b1c10129c63543ab475f0b0f0fb7fdf5bba4bf14ffb9ef1",
    marketAfter: "+1.2%",
    savedEstimate: "~$25 per $2,000",
    timestamp: 1747750604,
  },
  {
    id: 11,
    title: "Crowded Long Narrative Blocked",
    intent: 'Unwind position on "crowded longs" thesis',
    validatorReason:
      "1.4% funding is not historically extreme — unwinding risk overstated",
    varScore: 228,
    riskScore: 58,
    txHash:
      "0x01ac8df0ff7470bb0b16ebfb9b0bf361e8c6aa80671a63df35e07d9e0c69157a",
    marketAfter: "+1.2%",
    savedEstimate: "~$25 per $2,000",
    timestamp: 1747751192,
  },
];

async function fetchProofData() {
  try {
    return await fetchProofDataDirect();
  } catch {
    return null;
  }
}

export default async function ProofExplorerPage() {
  const data = await fetchProofData();

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <p className="text-red-400 font-mono text-sm">
          Failed to load on-chain data. Try refreshing.
        </p>
      </div>
    );
  }

  return (
    <ProofExplorerClient
      decisions={data.decisions || []}
      validation={
        data.validation || {
          totalApproved: 0,
          totalRejected: 0,
          totalProposals: 0,
          consensusRate: 0,
        }
      }
      totalDecisions={data.totalDecisions || 0}
      agentCard={data.agentCard}
      contracts={CONTRACTS}
      blockedCases={BLOCKED_CASES}
    />
  );
}
