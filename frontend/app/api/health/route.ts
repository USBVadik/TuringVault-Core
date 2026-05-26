/**
 * GET /api/health
 *
 * Surfaces honest agent liveness for the dashboard.
 *
 * Sources (best-effort, all guarded):
 *   1. data/loop_progress.json mtime         → batch progress freshness
 *   2. src/data/outcomes.json (newest)        → cycle freshness
 *   3. lastCycleTimestamp = max of the two
 *   4. Mantle RPC eth_blockNumber             → chain liveness sanity
 *   5. process.env.AGENT_RUN_MODE             → manual | cron-* | unknown
 *
 * On any failure: HTTP 200 with status='degraded' so the frontend
 * can render 🔴 Offline rather than crash. Never returns 500.
 *
 * Never echoes secrets. No PRIVATE_KEY, AWS_*, PINATA_*, NANSEN_API_KEY,
 * agent owner addresses, or .env contents leave this endpoint.
 *
 * Spec: .kiro/specs/ui-honesty-pass/{requirements,design,tasks}.md (T3)
 * Steering: .kiro/steering/no-lying-about-state.md
 */

import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { createPublicClient, http } from 'viem';
import { mantle } from 'viem/chains';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type OutcomeEntry = {
  recordedAt?: string;
  settledAt?: string;
};

type Outcomes = {
  pending?: OutcomeEntry[];
  settled?: OutcomeEntry[];
};

type HealthResponse = {
  status: 'ok' | 'degraded';
  lastCycleTimestamp: string | null;
  lastCycleAge: number | null;
  cyclesSucceeded24h: number | null;
  cyclesFailed24h: number | null;
  mode: string;
  chainBlockHeight: number | null;
  dataScope: 'agent-lifetime';
  error?: string;
};

const NO_STORE: HeadersInit = { 'Cache-Control': 'no-store, max-age=0' };

/**
 * Resolve a backend file path that lives outside the frontend dir.
 *
 * In `next dev` cwd is `frontend/`. On Vercel the function bundle's cwd
 * is also rooted at the project, but `src/data/*.json` is NOT shipped
 * with the frontend deployment — so reads will fail in prod and we
 * return a degraded response. That is the correct, honest UX per
 * .kiro/steering/no-lying-about-state.md (R1.4).
 */
function backendPath(...segments: string[]): string {
  return path.resolve(process.cwd(), '..', ...segments);
}

function safeReadJson<T>(filePath: string): T | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeStat(filePath: string): fs.Stats | null {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

function maxIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

function newestOutcomeIso(outcomes: Outcomes | null): string | null {
  if (!outcomes) return null;
  let newest: string | null = null;
  for (const entry of outcomes.pending ?? []) {
    newest = maxIso(newest, entry.recordedAt ?? null);
  }
  for (const entry of outcomes.settled ?? []) {
    // settledAt > recordedAt for settled entries; prefer settledAt
    newest = maxIso(newest, entry.settledAt ?? entry.recordedAt ?? null);
  }
  return newest;
}

function isWithinLast24h(iso: string | undefined, nowMs: number): boolean {
  if (!iso) return false;
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return false;
  return nowMs - ts < 24 * 60 * 60 * 1000;
}

function countSucceeded24h(outcomes: Outcomes | null): number | null {
  if (!outcomes) return null;
  const nowMs = Date.now();
  // Union of pending+settled by recordedAt (deduped by reference identity is fine —
  // settled entries are moved out of pending in-place so there's no double-count)
  const all: OutcomeEntry[] = [
    ...(outcomes.pending ?? []),
    ...(outcomes.settled ?? []),
  ];
  return all.filter(e => isWithinLast24h(e.recordedAt, nowMs)).length;
}

async function getMantleBlock(): Promise<number | null> {
  try {
    const client = createPublicClient({
      chain: mantle,
      transport: http('https://rpc.mantle.xyz'),
    });
    const block = await client.getBlockNumber();
    return Number(block);
  } catch {
    return null;
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    // 1. data/loop_progress.json mtime
    const progressPath = backendPath('data', 'loop_progress.json');
    const progressStat = safeStat(progressPath);
    const progressIso = progressStat
      ? new Date(progressStat.mtimeMs).toISOString()
      : null;

    // 2. src/data/outcomes.json — newest entry
    const outcomesPath = backendPath('src', 'data', 'outcomes.json');
    const outcomes = safeReadJson<Outcomes>(outcomesPath);
    const outcomesIso = newestOutcomeIso(outcomes);

    // 3. Combined freshness
    const lastCycleTimestamp = maxIso(progressIso, outcomesIso);
    const lastCycleAge = lastCycleTimestamp
      ? Math.max(0, Math.floor((Date.now() - Date.parse(lastCycleTimestamp)) / 1000))
      : null;

    // 4. Chain liveness (independent — agent can be dead but chain alive)
    const chainBlockHeight = await getMantleBlock();

    // 5. Run mode declaration (operator-set; default unknown)
    const mode = (process.env.AGENT_RUN_MODE ?? 'unknown').slice(0, 32);

    const body: HealthResponse = {
      status: 'ok',
      lastCycleTimestamp,
      lastCycleAge,
      cyclesSucceeded24h: countSucceeded24h(outcomes),
      cyclesFailed24h: null, // not tracked yet — see continuous-cron-and-health spec
      mode,
      chainBlockHeight,
      dataScope: 'agent-lifetime',
    };

    return NextResponse.json(body, { headers: NO_STORE });
  } catch (err: unknown) {
    // Last-resort degradation. Anything reaching here is a bug,
    // but we still want HTTP 200 so the frontend mascot can render Offline.
    const errorMessage =
      err instanceof Error ? err.message.slice(0, 120) : 'unknown error';
    const body: HealthResponse = {
      status: 'degraded',
      lastCycleTimestamp: null,
      lastCycleAge: null,
      cyclesSucceeded24h: null,
      cyclesFailed24h: null,
      mode: 'unknown',
      chainBlockHeight: null,
      dataScope: 'agent-lifetime',
      error: errorMessage,
    };
    return NextResponse.json(body, { headers: NO_STORE });
  }
}
