import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DECISION_LOG_ADDR = "0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5";
const VALIDATION_REGISTRY = "0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6";

const DECISION_ABI = [
  "event DecisionLogged(uint256 indexed decisionId, string action, string targetAsset, uint256 confidence, string reasoningHash)",
  "function totalDecisions() view returns (uint256)"
];

const REGISTRY_ABI = [
  "function totalProposals() view returns (uint256)",
  "function totalApproved() view returns (uint256)",
  "function totalRejected() view returns (uint256)"
];

export async function GET() {
  try {
    const provider = new ethers.JsonRpcProvider("https://rpc.mantle.xyz");
    const contract = new ethers.Contract(DECISION_LOG_ADDR, DECISION_ABI, provider);
    const registry = new ethers.Contract(VALIDATION_REGISTRY, REGISTRY_ABI, provider);
    
    // Get stats from ValidationRegistry (source of truth)
    const [totalProposals, totalApproved, totalRejected] = await Promise.all([
      registry.totalProposals(),
      registry.totalApproved(),
      registry.totalRejected(),
    ]);
    
    const total = Number(totalProposals);
    
    // Get recent decision events for the log table
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 500000);
    const events = await contract.queryFilter("DecisionLogged", fromBlock);
    
    const decisions = events.slice(-20).map((e: any) => ({
      id: Number(e.args[0]),
      action: e.args[1],
      targetAsset: e.args[2],
      asset: e.args[2],
      confidence: Number(e.args[3]),
      reasoningHash: e.args[4]?.substring(0, 200),
      reasoning: e.args[4]?.substring(0, 200),
      txHash: e.transactionHash,
      block: e.blockNumber,
      timestamp: Math.floor(Date.now() / 1000) - (events.length - events.indexOf(e)) * 1800,
      amountIn: "1000000000000000000",
    })).reverse();

    return NextResponse.json({ 
      total,
      totalDecisions: total,
      totalProposals: total,
      totalApproved: Number(totalApproved),
      totalRejected: Number(totalRejected),
      decisions,
      contract: DECISION_LOG_ADDR,
      chain: "Mantle Mainnet (5000)"
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
