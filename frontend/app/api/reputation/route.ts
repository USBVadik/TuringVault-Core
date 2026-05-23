import { NextResponse } from 'next/server';
import { createPublicClient, http, parseAbi } from 'viem';
import { mantle } from 'viem/chains';

const REPUTATION = '0xC78119F3274B05046Ac7c38a14298a6cbD946e1a' as const;

const abi = parseAbi([
  'function getReputation(uint256 agentId) view returns (int256 cumulativeScore, uint256 totalFeedback, uint256 positiveCount, uint256 negativeCount, uint256 winRate)',
  'function getFeedbackCount(uint256 agentId) view returns (uint256)',
]);

export async function GET() {
  try {
    const client = createPublicClient({ chain: mantle, transport: http('https://rpc.mantle.xyz') });

    const rep = await client.readContract({
      address: REPUTATION,
      abi,
      functionName: 'getReputation',
      args: [BigInt(0)],
    });

    return NextResponse.json({
      cumulativeScore: Number(rep[0]),
      totalFeedback: Number(rep[1]),
      positiveCount: Number(rep[2]),
      negativeCount: Number(rep[3]),
      winRate: (Number(rep[4]) / 100).toFixed(1),
      // Normalized score (0-100 scale, starting from 50)
      normalizedScore: Math.min(100, Math.max(0, 50 + Number(rep[0]))),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
