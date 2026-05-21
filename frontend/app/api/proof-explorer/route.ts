import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

const RPC_URL = 'https://rpc.mantle.xyz';

const CONTRACTS = {
  DECISION_LOG: '0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5',
  VALIDATION: '0x0aeEd88959fCFC665284225dB93DED3e8A3Ff705',
  IDENTITY: '0x6f862802e0d5463DF18d267e422347BeCacc28bD',
};

const DECISION_LOG_ABI = [
  'function totalDecisions() view returns (uint256)',
  'function getRecentDecisions(uint256 count) view returns (tuple(uint256 timestamp, string action, string targetAsset, uint256 amountIn, uint256 amountOut, uint256 confidence, string reasoningHash, bytes32 txHash)[])',
  'function successfulSwaps() view returns (uint256)',
];

const VALIDATION_ABI = [
  'function getSummary(uint256 agentId) view returns (uint256 totalRequests, uint256 totalResponses, uint256 approved, uint256 rejected, uint256 avgScore)',
];

const IDENTITY_ABI = [
  'function tokenURI(uint256 tokenId) view returns (string)',
];

export async function GET() {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    const decisionLog = new ethers.Contract(CONTRACTS.DECISION_LOG, DECISION_LOG_ABI, provider);
    const validation = new ethers.Contract(CONTRACTS.VALIDATION, VALIDATION_ABI, provider);
    const identity = new ethers.Contract(CONTRACTS.IDENTITY, IDENTITY_ABI, provider);

    // Fetch all data in parallel
    const [totalDecisions, recentDecisions, tokenURI, validationSummary] = await Promise.all([
      decisionLog.totalDecisions(),
      decisionLog.getRecentDecisions(20),
      identity.tokenURI(0),
      validation.getSummary(0).catch(() => null),
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

    // Fetch Agent Card from IPFS
    let agentCard = null;
    if (tokenURI) {
      const cid = tokenURI.replace('ipfs://', '');
      try {
        const ipfsRes = await fetch(`https://ipfs.io/ipfs/${cid}`, { 
          signal: AbortSignal.timeout(5000) 
        });
        if (ipfsRes.ok) {
          agentCard = await ipfsRes.json();
        }
      } catch {
        // IPFS timeout is OK — we still have on-chain data
      }
    }

    // Parse validation summary
    let validationData = null;
    if (validationSummary) {
      validationData = {
        totalRequests: Number(validationSummary[0]),
        totalResponses: Number(validationSummary[1]),
        approved: Number(validationSummary[2]),
        rejected: Number(validationSummary[3]),
        avgScore: Number(validationSummary[4]),
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
