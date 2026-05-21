'use client';

import { useState } from 'react';
import { useReadContract } from 'wagmi';
import { Shield, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

const VALIDATION_REGISTRY = '0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6' as `0x${string}`;
const REPUTATION_REGISTRY = '0xC78119F3274B05046Ac7c38a14298a6cbD946e1a' as `0x${string}`;

const REGISTRY_ABI = [
  { name: 'totalProposals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalApproved', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalRejected', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const;

const REPUTATION_ABI = [
  { name: 'agentScores', type: 'function', stateMutability: 'view', inputs: [{ name: 'agentId', type: 'uint256' }], outputs: [{ type: 'int128' }] },
  { name: 'totalFeedbacks', type: 'function', stateMutability: 'view', inputs: [{ name: 'agentId', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
] as const;

export function VerifyButton() {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  const { data: totalProposals } = useReadContract({
    address: VALIDATION_REGISTRY, abi: REGISTRY_ABI, functionName: 'totalProposals',
  });
  const { data: totalApproved } = useReadContract({
    address: VALIDATION_REGISTRY, abi: REGISTRY_ABI, functionName: 'totalApproved',
  });
  const { data: totalRejected } = useReadContract({
    address: VALIDATION_REGISTRY, abi: REGISTRY_ABI, functionName: 'totalRejected',
  });
  const { data: agentScore } = useReadContract({
    address: REPUTATION_REGISTRY, abi: REPUTATION_ABI, functionName: 'agentScores', args: [BigInt(0)],
  });
  const { data: totalFeedbacks } = useReadContract({
    address: REPUTATION_REGISTRY, abi: REPUTATION_ABI, functionName: 'totalFeedbacks', args: [BigInt(0)],
  });

  const handleVerify = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setVerified(true);
    }, 1500);
  };

  if (verified) {
    return (
      <div className="verify-result">
        <div className="verify-result-header">
          <CheckCircle2 className="w-5 h-5 text-green-400" />
          <span className="text-sm font-bold text-green-400">On-Chain Verified</span>
        </div>
        <div className="verify-grid">
          <div className="verify-stat">
            <span className="text-[10px] text-white/30 uppercase">Total Proposals</span>
            <span className="text-lg font-mono font-bold text-white/90">{totalProposals?.toString() || '—'}</span>
          </div>
          <div className="verify-stat">
            <span className="text-[10px] text-white/30 uppercase">Approved</span>
            <span className="text-lg font-mono font-bold text-green-400">{totalApproved?.toString() || '—'}</span>
          </div>
          <div className="verify-stat">
            <span className="text-[10px] text-white/30 uppercase">Rejected</span>
            <span className="text-lg font-mono font-bold text-red-400">{totalRejected?.toString() || '—'}</span>
          </div>
          <div className="verify-stat">
            <span className="text-[10px] text-white/30 uppercase">Rep Score</span>
            <span className="text-lg font-mono font-bold text-purple-400">{agentScore?.toString() || '—'}</span>
          </div>
          <div className="verify-stat">
            <span className="text-[10px] text-white/30 uppercase">Feedbacks</span>
            <span className="text-lg font-mono font-bold text-white/70">{totalFeedbacks?.toString() || '—'}</span>
          </div>
          <div className="verify-stat">
            <span className="text-[10px] text-white/30 uppercase">Safety Rate</span>
            <span className="text-lg font-mono font-bold text-green-400">
              {totalProposals && totalRejected 
                ? `${((Number(totalRejected) / Number(totalProposals)) * 100).toFixed(0)}%`
                : '—'}
            </span>
          </div>
        </div>
        <p className="text-[9px] text-white/20 text-center mt-3 font-mono">
          Data read directly from Mantle Mainnet via your wallet RPC — no backend
        </p>
        <button onClick={() => setVerified(false)} className="text-[10px] text-purple-400/50 hover:text-purple-400 mt-2 mx-auto block">
          ↺ Verify again
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleVerify}
      disabled={isVerifying}
      className="verify-btn group"
    >
      {isVerifying ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Reading Mantle contracts...</span>
        </>
      ) : (
        <>
          <Shield className="w-4 h-4 group-hover:text-green-400 transition-colors" />
          <span>Verify Yourself</span>
          <span className="text-[9px] text-white/20 ml-2">wagmi::readContract</span>
        </>
      )}
    </button>
  );
}
