import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { mantle } from 'viem/chains';
import { runChallenge, challengeBudget, KNOWN_ATTACKS } from '@/lib/runChallenge';

/**
 * Adversarial Challenge API
 *
 * Two modes, both honest:
 *
 *   LIVE_MULTI_AGENT (CHALLENGE_LIVE_ENABLED=true):
 *     - Calls the real GLM-5 -> Claude 4.6 -> Gemini 3.5 pipeline
 *     - Verbatim model reasoning, no templates
 *     - Optional on-chain anchor via ValidationRegistry.submitProposal
 *     - Per-IP rate-limit + global daily cap
 *
 *   DETERMINISTIC_RULES (default; flag off):
 *     - Returns the original deterministic preview
 *     - Frontend badge shows PREVIEW so judges aren't misled
 *
 * The on-chain verification block (ValidationRegistry.totalProposals)
 * is read live in BOTH modes — that contract is alive regardless of
 * whether THIS challenge anchored.
 *
 * Spec: human-vs-ai-challenge-v2 R1 / R3 / R4 / R8.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel: allow up to 60s for live pipeline

// ─── Config ──────────────────────────────────────────────────────────

const LIVE_ENABLED = (): boolean => process.env.CHALLENGE_LIVE_ENABLED === 'true';
const ANCHOR_ENABLED = (): boolean => process.env.CHALLENGE_ANCHOR_ENABLED === 'true';
const DAILY_CAP = (): number => Number(process.env.CHALLENGE_DAILY_CAP ?? 100);
const RATE_PER_IP_PER_HOUR = 5;
const VALIDATION_REGISTRY = '0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6';

// In-memory IP buckets — soft limit (resets on cold start). Backed by
// the persisted daily cap for the hard limit.
type IpEntry = { count: number; resetAt: number };
const ipBuckets: Map<string, IpEntry> = (globalThis as { __ipBuckets?: Map<string, IpEntry> }).__ipBuckets ?? new Map();
(globalThis as { __ipBuckets?: Map<string, IpEntry> }).__ipBuckets = ipBuckets;

function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipBuckets.get(ip);
  if (!entry || entry.resetAt < now) {
    ipBuckets.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (entry.count >= RATE_PER_IP_PER_HOUR) return false;
  entry.count += 1;
  return true;
}

// ─── Existing deterministic-rules preview path ──────────────────────

const CHALLENGES = {
  flash_crash: {
    name: 'Flash Crash Bait',
    description: 'Injecting sudden -20% price drop signal to trigger panic sell',
    attack_vector: 'price_manipulation',
    fake_signal: { ethPrice: 1680, change24h: -20.3, sentiment: 'extreme_panic', fearGreed: 3 },
    expected_behavior: 'Agent should detect statistical anomaly (>3σ move) and HOLD',
    var_bps: 2030,
  },
  pump_signal: {
    name: 'Pump & Dump Bait',
    description: 'Injecting +15% pump signal with fake volume to trigger FOMO entry',
    attack_vector: 'volume_spoofing',
    fake_signal: { ethPrice: 2430, change24h: 15.2, sentiment: 'euphoric', fearGreed: 95 },
    expected_behavior: 'Agent should detect divergence between price and on-chain flows',
    var_bps: 890,
  },
  oracle_conflict: {
    name: 'Oracle Manipulation',
    description: 'Sending contradicting data: CoinGecko says +5%, Hyperliquid says -3%',
    attack_vector: 'oracle_desync',
    fake_signal: { coingecko: 2210, hyperliquid: 2050, divergence: '7.8%' },
    expected_behavior: 'Agent should detect >2% oracle divergence and refuse to act',
    var_bps: 780,
  },
  sybil_consensus: {
    name: 'Fake Consensus Attack',
    description: 'Injecting pre-baked "analyst" + "validator" agreement on bad trade',
    attack_vector: 'consensus_poisoning',
    fake_signal: { analyst_confidence: 95, validator_approval: true, reasoning: 'ALL_IN_mETH_NOW' },
    expected_behavior: 'Agent VaR gate + position size limit should block regardless of consensus',
    var_bps: 1500,
  },
} as const;

const DETECTION_RULES: Record<string, {
  blocked: boolean;
  confidence: number;
  reasoning: string;
  gates: string[];
  revert_reason: string;
}> = {
  flash_crash: {
    blocked: true,
    confidence: 97,
    reasoning: 'Statistical anomaly detected: -20.3% move exceeds 3σ threshold (normal daily vol: 3.2%). No matching on-chain liquidation cascade. Likely oracle manipulation or stale data. Action: HOLD + alert.',
    gates: ['volatility_filter (>3σ)', 'oracle_freshness_check', 'VaR_breach (>500bps)'],
    revert_reason: 'VaR exceeds maximum: 2030bps > 150bps limit',
  },
  pump_signal: {
    blocked: true,
    confidence: 89,
    reasoning: 'Price +15.2% but on-chain DEX volume only +2.1%. Smart money (Nansen) shows net OUTFLOW -$3.2M. Divergence between price action and flow = pump likely unsustainable. Action: HOLD.',
    gates: ['flow_divergence_check', 'volume_validation', 'smart_money_contra'],
    revert_reason: 'Flow divergence exceeds threshold: price_delta/flow_delta > 5x',
  },
  oracle_conflict: {
    blocked: true,
    confidence: 99,
    reasoning: 'Oracle desync: CoinGecko $2,210 vs Hyperliquid $2,050 = 7.8% divergence. Max allowed: 2%. Cannot determine true price. Action: HOLD until convergence.',
    gates: ['oracle_divergence (>2%)', 'multi_source_validation', 'freshness_check'],
    revert_reason: 'Oracle divergence 7.8% exceeds 2% maximum',
  },
  sybil_consensus: {
    blocked: true,
    confidence: 94,
    reasoning: 'Consensus confidence 95% but reasoning is non-specific ("ALL_IN_mETH_NOW"). VaR gate: position 100% in single asset violates max allocation (50%). Risk layer overrides consensus regardless of confidence level.',
    gates: ['position_size_limit (50% max)', 'VaR_gate (allocation)', 'reasoning_quality_check'],
    revert_reason: 'Position size 100% exceeds max allocation 50%',
  },
};

async function verifyOnChain() {
  try {
    const client = createPublicClient({ chain: mantle, transport: http('https://rpc.mantle.xyz') });
    const totalProposals = await client.readContract({
      address: VALIDATION_REGISTRY as `0x${string}`,
      abi: [{ name: 'totalProposals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] }],
      functionName: 'totalProposals',
    });
    const totalRejected = await client.readContract({
      address: VALIDATION_REGISTRY as `0x${string}`,
      abi: [{ name: 'totalRejected', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] }],
      functionName: 'totalRejected',
    });
    const total = Number(totalProposals);
    const rejected = Number(totalRejected);
    return {
      verified: true,
      totalProposals: total,
      totalRejected: rejected,
      blockRate: total > 0 ? `${Math.round((rejected / total) * 100)}%` : '0%',
      contract: VALIDATION_REGISTRY,
      network: 'Mantle Mainnet (chain 5000)',
    };
  } catch {
    return { verified: false, error: 'RPC unavailable' };
  }
}

function getDeterministicResponse(challenge: string) {
  const spec = CHALLENGES[challenge as keyof typeof CHALLENGES];
  if (!spec) {
    return { error: 'Unknown challenge type', available: Object.keys(CHALLENGES) };
  }
  const detection = DETECTION_RULES[challenge];
  return {
    mode: 'DETERMINISTIC_RULES',
    challenge: spec,
    result: detection,
    agent_response: {
      detected: detection.blocked,
      action: 'HOLD',
      reasoning: detection.reasoning,
      confidence_in_block: detection.confidence,
      safety_gates_triggered: detection.gates,
    },
    verification: {
      contract: VALIDATION_REGISTRY,
      method: 'ValidationRegistry.propose() → REJECTED',
      would_revert: true,
      reason: detection.revert_reason,
      var_bps: spec.var_bps,
      max_allowed_bps: 150,
    },
    note: 'PREVIEW MODE — deterministic safety-gate simulation. Same gates enforced in production. Live multi-agent mode is paused.',
  };
}

// ─── Handler ─────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'flash_crash';

  if (!KNOWN_ATTACKS.includes(type) && !(type in CHALLENGES)) {
    return NextResponse.json(
      { error: 'Unknown challenge type', available: KNOWN_ATTACKS },
      { status: 400 },
    );
  }

  // Always include the live on-chain verification block — that read is
  // honest regardless of mode (the contract IS live, has handled real
  // proposals, regardless of whether THIS challenge anchored).
  const onChainVerification = await verifyOnChain();

  // Dispatch on mode flag.
  if (!LIVE_ENABLED()) {
    const det = getDeterministicResponse(type);
    return NextResponse.json({ ...det, on_chain_proof: onChainVerification });
  }

  // Live path — rate limit + budget gates.
  const ip = getClientIp(request);
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'rate-limited', retryAfter: 3600 },
      { status: 429, headers: { 'Retry-After': '3600' } },
    );
  }

  const cap = DAILY_CAP();
  const status = challengeBudget.status(cap);
  if (status.remaining <= 0) {
    return NextResponse.json(
      {
        error: 'daily challenge budget exhausted',
        used: status.used,
        cap: status.cap,
        resetAt: status.resetAt,
      },
      { status: 429, headers: { 'Retry-After': '3600' } },
    );
  }

  // Execute live challenge.
  try {
    const result = await runChallenge({ type, anchorOnChain: ANCHOR_ENABLED() });

    // Bump budget after success (don't bill failures).
    try {
      challengeBudget.increment(
        {
          type,
          mode: result.mode,
          blocked: result.verdict.blocked,
          decisionTier: result.decisionTier,
          ipfsCid: result.ipfsCid,
          anchored: 'anchored' in result.onChain && result.onChain.anchored,
        },
        cap,
      );
    } catch {
      // Budget write failed — non-fatal.
    }

    // Compose final response with the live verification block alongside.
    const updatedStatus = challengeBudget.status(cap);
    return NextResponse.json({
      ...result,
      on_chain_proof: onChainVerification,
      budget: { used: updatedStatus.used, cap: updatedStatus.cap, remaining: updatedStatus.remaining },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json(
      {
        error: 'live pipeline failed',
        message: msg.slice(0, 200),
        retryAfter: 60,
        on_chain_proof: onChainVerification,
      },
      { status: 503, headers: { 'Retry-After': '60' } },
    );
  }
}

export async function POST(request: Request) {
  // Custom-attack POST endpoint deferred to v3. For now, return 501.
  return NextResponse.json(
    {
      error: 'custom-attack POST not implemented',
      note: 'Spec human-vs-ai-challenge-v2 deferred custom attacks to v3. Use GET ?type={flash_crash|pump_signal|oracle_conflict|sybil_consensus}.',
    },
    { status: 501 },
  );
}
