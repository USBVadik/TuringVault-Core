import { ProofExplorerClient } from './client';

const CONTRACTS = {
  DECISION_LOG: '0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5',
  VALIDATION: '0x0aeEd88959fCFC665284225dB93DED3e8A3Ff705',
  IDENTITY: '0x6f862802e0d5463DF18d267e422347BeCacc28bD',
  REPUTATION: '0xC78119F3274B05046Ac7c38a14298a6cbD946e1a',
};

async function fetchProofData() {
  // Use internal API route (server-side fetch)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/proof-explorer`, { 
    cache: 'no-store' 
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function ProofExplorerPage() {
  const data = await fetchProofData();
  
  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <p className="text-red-400 font-mono text-sm">Failed to load on-chain data. Try refreshing.</p>
      </div>
    );
  }

  return (
    <ProofExplorerClient 
      decisions={data.decisions || []}
      validation={data.validation}
      totalDecisions={data.totalDecisions || 0}
      agentCard={data.agentCard}
      contracts={CONTRACTS}
    />
  );
}
