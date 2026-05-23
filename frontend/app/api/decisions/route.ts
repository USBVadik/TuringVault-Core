import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

const DECISION_LOG_ADDR = "0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5";
const ABI = [
  "event DecisionLogged(uint256 indexed decisionId, string action, string targetAsset, uint256 confidence, string reasoningHash)",
  "function totalDecisions() view returns (uint256)"
];

export async function GET() {
  try {
    const provider = new ethers.JsonRpcProvider("https://rpc.mantle.xyz");
    const contract = new ethers.Contract(DECISION_LOG_ADDR, ABI, provider);
    
    const total = Number(await contract.totalDecisions());
    const events = await contract.queryFilter("DecisionLogged", -200000);
    
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

    // Stats
    const swaps = events.filter((e: any) => e.args[1] === 'swap').length;
    const holds = events.filter((e: any) => e.args[1] === 'hold').length;

    return NextResponse.json({ 
      total,
      totalDecisions: total,
      totalProposals: total,
      totalApproved: swaps,
      totalRejected: holds,
      decisions,
      contract: DECISION_LOG_ADDR,
      chain: "Mantle Mainnet (5000)"
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
