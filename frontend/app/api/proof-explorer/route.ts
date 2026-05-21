import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

const RPC_URL = 'https://rpc.mantle.xyz';

const CONTRACTS = {
  DECISION_LOG: '0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5',
  VALIDATION_REGISTRY: '0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6',
  IDENTITY: '0x6f862802e0d5463DF18d267e422347BeCacc28bD',
  REPUTATION: '0xC78119F3274B05046Ac7c38a14298a6cbD946e1a',
};

const DECISION_LOG_ABI = [
  'function totalDecisions() view returns (uint256)',
  'function getRecentDecisions(uint256 count) view returns (tuple(uint256 timestamp, string action, string targetAsset, uint256 amountIn, uint256 amountOut, uint256 confidence, string reasoningHash, bytes32 txHash)[])',
  'function successfulSwaps() view returns (uint256)',
];

const VALIDATION_REGISTRY_ABI = [
  'function totalProposals() view returns (uint256)',
  'function totalApproved() view returns (uint256)',
  'function totalRejected() view returns (uint256)',
  'function getConsensusRate() view returns (uint256 approved, uint256 rejected, uint256 total)',
];

const IDENTITY_ABI = [
  'function tokenURI(uint256 tokenId) view returns (string)',
];

export async function GET() {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    const decisionLog = new ethers.Contract(CONTRACTS.DECISION_LOG, DECISION_LOG_ABI, provider);
    const validationRegistry = new ethers.Contract(CONTRACTS.VALIDATION_REGISTRY, VALIDATION_REGISTRY_ABI, provider);
    const identity = new ethers.Contract(CONTRACTS.IDENTITY, IDENTITY_ABI, provider);

    // Fetch all data in parallel
    const [totalDecisions, recentDecisions, tokenURI, consensusRate] = await Promise.all([
      decisionLog.totalDecisions(),
      decisionLog.getRecentDecisions(20),
      identity.tokenURI(0),
      validationRegistry.getConsensusRate().catch(() => null),
    ]);

    // Parse decisions
    const decisions = recentDecisions.map((d: ethers.Result) => ({
      timestamp: Number(d[0]),
      action: d[1],
      targetAsset: d[2],
      amountIn: d[3].toString(),
      amountOut: d[4].toString(),
      confidence: Number(d[5]),
      reasoningHash: d[6],
      txHash: d[7],
    }));

    // Fetch Agent Card from IPFS (skip in dev for speed)
    let agentCard = null;
    if (tokenURI) {
      const cid = tokenURI.replace('ipfs://', '');
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const ipfsRes = await fetch(`https://ipfs.io/ipfs/${cid}`, { 
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (ipfsRes.ok) {
          agentCard = await ipfsRes.json();
        }
      } catch {
        // IPFS timeout is OK — we still have on-chain data
      }
    }

    // Parse validation consensus from registry
    let validationData = null;
    if (consensusRate) {
      validationData = {
        totalApproved: Number(consensusRate[0]),
        totalRejected: Number(consensusRate[1]),
        totalProposals: Number(consensusRate[2]),
        consensusRate: Number(consensusRate[2]) > 0 
          ? Math.round((Number(consensusRate[0]) / Number(consensusRate[2])) * 100) 
          : 0,
      };
    }

    return NextResponse.json({
      totalDecisions: Number(totalDecisions),
      decisions: decisions.reverse(), // newest first
      validation: validationData,
      agentCard,
      tokenURI,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Proof Explorer API error:', message);
    return NextResponse.json(
      { error: 'Failed to fetch on-chain data', details: message },
      { status: 500 }
    );
  }
}
