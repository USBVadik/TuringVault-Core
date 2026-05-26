/**
 * GET /api/agent-card
 *
 * Surfaces the on-disk agent-card.json so the frontend can render hero
 * badges (model lineup, prompt version) from a single source of truth
 * instead of hardcoded strings.
 *
 * Real shape of assets/agent-card.json:
 *   {
 *     "name": "...",
 *     "description": "...",
 *     "models": {
 *       "analyst":  { provider, model, role },
 *       "validator":{ provider, model, role },
 *       "arbiter":  { provider, model, role }
 *     },
 *     "systemPrompt": { version, lastUpdated, ... },
 *     "contracts": { ... },
 *     "stats": { ... }   // may drift vs on-chain — frontend should NOT
 *                       //  use this for live counts, only for narrative copy
 *   }
 *
 * Spec: .kiro/specs/ui-honesty-pass/{requirements,design,tasks}.md (T4)
 */

import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE: HeadersInit = { 'Cache-Control': 'no-store, max-age=0' };

type ModelEntry = {
  provider?: string;
  model?: string;
  role?: string;
};

type AgentCardRaw = {
  name?: string;
  description?: string;
  models?: {
    analyst?: ModelEntry;
    validator?: ModelEntry;
    arbiter?: ModelEntry;
  };
  systemPrompt?: {
    version?: string;
    lastUpdated?: string;
  };
  capabilities?: string[];
  contracts?: Record<string, string>;
  stats?: Record<string, unknown>;
};

type AgentCardResponse = {
  status: 'ok' | 'degraded' | 'missing';
  name: string | null;
  models: {
    analyst: { provider: string | null; model: string | null } | null;
    validator: { provider: string | null; model: string | null } | null;
    arbiter: { provider: string | null; model: string | null } | null;
  };
  systemPromptVersion: string | null;
  systemPromptLastUpdated: string | null;
  contracts: Record<string, string> | null;
  /**
   * Card-author-declared stats. Frontend MUST NOT use these as live counts —
   * use /api/decisions / /api/reputation for on-chain numbers.
   */
  cardStats: Record<string, unknown> | null;
  cardStatsScope: 'card-author-declared';
  error?: string;
};

function projectAgentCardPath(): string {
  // In `next dev` cwd is `frontend/`; the asset lives one level up.
  return path.resolve(process.cwd(), '..', 'assets', 'agent-card.json');
}

function compactModel(entry: ModelEntry | undefined) {
  if (!entry) return null;
  return {
    provider: entry.provider ?? null,
    model: entry.model ?? null,
  };
}

export async function GET(): Promise<NextResponse> {
  const filePath = projectAgentCardPath();

  let raw: AgentCardRaw | null = null;
  let error: string | undefined;
  let status: AgentCardResponse['status'] = 'ok';

  try {
    if (!fs.existsSync(filePath)) {
      status = 'missing';
      error = 'agent-card.json not found in deployment';
    } else {
      const text = fs.readFileSync(filePath, 'utf-8');
      raw = JSON.parse(text) as AgentCardRaw;
    }
  } catch (err: unknown) {
    status = 'degraded';
    error = err instanceof Error ? err.message.slice(0, 120) : 'parse error';
    raw = null;
  }

  const body: AgentCardResponse = {
    status,
    name: raw?.name ?? null,
    models: {
      analyst: compactModel(raw?.models?.analyst),
      validator: compactModel(raw?.models?.validator),
      arbiter: compactModel(raw?.models?.arbiter),
    },
    systemPromptVersion: raw?.systemPrompt?.version ?? null,
    systemPromptLastUpdated: raw?.systemPrompt?.lastUpdated ?? null,
    contracts: raw?.contracts ?? null,
    cardStats: raw?.stats ?? null,
    cardStatsScope: 'card-author-declared',
    ...(error ? { error } : {}),
  };

  return NextResponse.json(body, { headers: NO_STORE });
}
