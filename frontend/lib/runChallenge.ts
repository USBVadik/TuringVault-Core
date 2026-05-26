/**
 * Backend shim for the /api/challenge route.
 *
 * Re-exports the JS orchestrator from `src/orchestrator/runChallenge.js`
 * so the Next.js function can import it without TypeScript declaration
 * gymnastics. Webpack bundles the backend module into the function.
 *
 * This shim is the only place where the frontend bundle reaches outside
 * the `frontend/` directory; keeping it tiny + isolated makes the cost
 * obvious if Vercel cold-start latency ever creeps up.
 *
 * Spec: human-vs-ai-challenge-v2 design §C5, T7.
 */

// Path traversal: from frontend/lib up to repo root, then into src/.
// Webpack resolves this at build time and bundles the dep tree.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const backend = require('../../src/orchestrator/runChallenge');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const budget = require('../../src/orchestrator/challengeBudget');

type ChallengeAgentTrace = {
  model: string;
  confidence: number | null;
  reasoning: string | null;
  timing_ms: number | null;
  // role-specific fields are present on validator/analyst/arbiter
  // but typed loosely here to keep the shim minimal.
  [key: string]: unknown;
};

export type ChallengeResponse = {
  mode: 'LIVE_MULTI_AGENT' | 'DETERMINISTIC_RULES';
  challenge: {
    type: string;
    params: Record<string, unknown>;
    injected: {
      type: string;
      params: Record<string, unknown>;
      appliedAt: string;
      originalEthPrice: number | null;
    };
  };
  agents: {
    analyst: ChallengeAgentTrace;
    validator: ChallengeAgentTrace;
    arbiter: ChallengeAgentTrace | null;
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
  budget?: { used: number; cap: number; remaining: number; resetAt: string };
};

export async function runChallenge(args: {
  type: string;
  params?: Record<string, unknown>;
  anchorOnChain?: boolean;
}): Promise<ChallengeResponse> {
  return backend.runChallenge(args);
}

export const challengeBudget = {
  read: budget.read,
  increment: budget.increment,
  BudgetExhaustedError: budget.BudgetExhaustedError,
};

export const ATTACK_TYPES: readonly string[] = backend.ATTACK_TYPES
  ?? ['flash_crash', 'pump_signal', 'oracle_conflict', 'sybil_consensus'];
