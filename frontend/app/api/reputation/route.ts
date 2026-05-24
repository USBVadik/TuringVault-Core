import { NextResponse } from 'next/server';
import { createPublicClient, http, parseAbi } from 'viem';
import { mantle } from 'viem/chains';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const REPUTATION = '0xC78119F3274B05046Ac7c38a14298a6cbD946e1a' as const;
const VALIDATION_REGISTRY = '0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6' as const;

const reputationAbi = parseAbi([
  'function getReputation(uint256 agentId) view returns (int256 cumulativeScore, uint256 totalFeedback, uint256 positiveCount, uint256 negativeCount, uint256 winRate)',
]);

const validationAbi = parseAbi([
  'function totalProposals() view returns (uint256)',
  'function totalApproved() view returns (uint256)',
  'function totalRejected() view returns (uint256)',
]);

export async function GET() {
  const client = createPublicClient({ chain: mantle, transport: http('https://rpc.mantle.xyz') });

  // Try ReputationRegistry first
  try {
    const rep = await client.readContract({
      address: REPUTATION,
      abi: reputationAbi,
      functionName: 'getReputation',
      args: [BigInt(0)],
    });

    return NextResponse.json({
      cumulativeScore: Number(rep[0]),
      totalFeedback: Number(rep[1]),
      positiveCount: Number(rep[2]),
      negativeCount: Number(rep[3]),
      winRate: (Number(rep[4]) / 100).toFixed(1),
      normalizedScore: Math.min(100, Math.max(0, 50 + Number(rep[0]))),
      source: 'reputation_registry',
    });
  } catch {
    // Fallback: derive from ValidationRegistry on-chain data
    try {
      const [totalProposals, totalApproved, totalRejected] = await Promise.all([
        client.readContract({ address: VALIDATION_REGISTRY, abi: validationAbi, functionName: 'totalProposals' }),
        client.readContract({ address: VALIDATION_REGISTRY, abi: validationAbi, functionName: 'totalApproved' }),
        client.readContract({ address: VALIDATION_REGISTRY, abi: validationAbi, functionName: 'totalRejected' }),
      ]);

      const total = Number(totalProposals);
      const approved = Number(totalApproved);
      const rejected = Number(totalRejected);
      const approvalRate = total > 0 ? ((approved / total) * 100).toFixed(1) : '0';

      return NextResponse.json({
        cumulativeScore: approved * 100 - rejected * 50, // weighted scoring
        totalFeedback: total,
        positiveCount: approved,
        negativeCount: rejected,
        winRate: approvalRate,
        normalizedScore: Math.min(100, Math.max(0, 50 + approved - rejected)),
        source: 'validation_registry_fallback',
      });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }
}
