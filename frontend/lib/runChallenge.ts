/**
 * Backend bridge for the /api/challenge route.
 *
 * Re-exports `runChallenge` from the orchestrator so the Next.js route can
 * import it via the `@/lib/runChallenge` alias without reaching across the
 * monorepo with a relative path that breaks Vercel's bundler.
 *
 * The orchestrator and its dependencies (multiAgent, unifiedMarketData,
 * signalEngine, decisionTier, ipfs/storage, attackVectors) get bundled
 * with the Vercel Lambda. Cold-start cost: ~1s extra. Bundle size: ~3-4MB
 * with Bedrock SDK, comfortably under Vercel's 50MB limit.
 *
 * Spec: human-vs-ai-challenge-v2 T7 / design §C5.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const orchestrator = require('../../src/orchestrator/runChallenge');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const budget = require('../../src/orchestrator/challengeBudget');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { KNOWN_ATTACKS: KA } = require('../../src/orchestrator/attackVectors');

export type ChallengeAgent = {
  model: string;
  action?: string | null;
  targetAsset?: string | null;
  approved?: boolean | null;
  vote?: string | null;
  confidence: number | null;
  reasoning: string | null;
  riskFactors?: string[];
  flaggedIssues?: string[];
  recommendation?: string | null;
  riskScore?: number | null;
};

export type ChallengeResponse = {
  mode: 'LIVE_MULTI_AGENT' | 'DETERMINISTIC_RULES';
  challenge: {
    type: string;
    params: Record<string, unknown>;
    injected?: { type: string; params: object; appliedAt: string; originalEthPrice: number };
  };
  agents: {
    analyst: ChallengeAgent;
    validator: ChallengeAgent;
    arbiter: ChallengeAgent | null;
  };
  pipelinePath: 'analyst-validator' | 'analyst-validator-arbiter';
  consensus: boolean;
  decisionTier: string;
  disagreementSignal: boolean;
  disagreementSummary: string | null;
  verdict: { blocked: boolean; label: string };
  ipfsCid: string | null;
  onChain:
    | { anchored: true; txHash: string; blockNumber: number; mantlescan: string }
    | { skipped: true; reason: string; error?: string };
  timing_ms: { decision: number; total: number };
};

export const KNOWN_ATTACKS: string[] = KA;

export async function runChallenge(opts: {
  type: string;
  params?: Record<string, unknown>;
  anchorOnChain?: boolean;
}): Promise<ChallengeResponse> {
  return orchestrator.runChallenge(opts);
}

export const challengeBudget = {
  read: () => budget.readBudget(),
  status: (cap?: number) => budget.status(cap ?? 100),
  increment: (entry: object, cap?: number) => budget.increment(entry, cap ?? 100),
};
