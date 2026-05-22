import { NextResponse } from 'next/server';
import { createPublicClient, http, parseAbi } from 'viem';
import { mantle } from 'viem/chains';

const DECISION_LOG = '0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5' as const;
const VALIDATION_REGISTRY = '0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6' as const;

const abi = parseAbi([
  'function totalDecisions() view returns (uint256)',
  'function successfulSwaps() view returns (uint256)',
  'function totalPnLBasisPoints() view returns (uint256)',
  'function getDecision(uint256 id) view returns ((uint256 timestamp, string action, string targetAsset, uint256 amountIn, uint256 amountOut, uint256 confidence, string reasoningHash, bytes32 txHash))',
]);

const validationAbi = parseAbi([
  'function totalProposals() view returns (uint256)',
  'function totalApproved() view returns (uint256)',
  'function totalRejected() view returns (uint256)',
]);

export async function GET() {
  try {
    const client = createPublicClient({ chain: mantle, transport: http('https://rpc.mantle.xyz') });

    const [totalDecisions, successfulSwaps, totalPnL, totalProposals, totalApproved, totalRejected] = await Promise.all([
      client.readContract({ address: DECISION_LOG, abi, functionName: 'totalDecisions' }),
      client.readContract({ address: DECISION_LOG, abi, functionName: 'successfulSwaps' }),
      client.readContract({ address: DECISION_LOG, abi, functionName: 'totalPnLBasisPoints' }),
      client.readContract({ address: VALIDATION_REGISTRY, abi: validationAbi, functionName: 'totalProposals' }),
      client.readContract({ address: VALIDATION_REGISTRY, abi: validationAbi, functionName: 'totalApproved' }),
      client.readContract({ address: VALIDATION_REGISTRY, abi: validationAbi, functionName: 'totalRejected' }),
    ]);

    // Fetch last 10 decisions individually (getRecentDecisions tuple[] has decode issues)
    const total = Number(totalDecisions);
    const count = Math.min(10, total);
    const start = total - count;
    
    const decisions = [];
    for (let i = start; i < total; i++) {
      try {
        const d: any = await client.readContract({
          address: DECISION_LOG, abi, functionName: 'getDecision', args: [BigInt(i)],
        });
        // viem returns struct as object or tuple depending on ABI definition
        decisions.push({
          id: i,
          timestamp: Number(d.timestamp ?? d[0]),
          action: String(d.action ?? d[1]),
          targetAsset: String(d.targetAsset ?? d[2]),
          amountIn: String(d.amountIn ?? d[3]),
          amountOut: String(d.amountOut ?? d[4]),
          confidence: Number(d.confidence ?? d[5]),
          reasoningHash: String(d.reasoningHash ?? d[6]),
          txHash: String(d.txHash ?? d[7]),
        });
      } catch (e: any) {
        // Log first error for debugging
        if (decisions.length === 0 && i === start) {
          console.error('getDecision error:', e.message?.slice(0, 200));
        }
      }
    }

    return NextResponse.json({
      totalDecisions: total,
      successfulSwaps: Number(successfulSwaps),
      totalPnLBasisPoints: Number(totalPnL),
      totalProposals: Number(totalProposals),
      totalApproved: Number(totalApproved),
      totalRejected: Number(totalRejected),
      safetyRate: Number(totalProposals) > 0 ? Math.round(Number(totalRejected) / Number(totalProposals) * 100) : 0,
      decisions: decisions.reverse(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
