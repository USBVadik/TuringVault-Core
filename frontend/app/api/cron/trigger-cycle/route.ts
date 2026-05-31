/**
 * Vercel Cron → GitHub Actions workflow_dispatch bridge.
 *
 * Vercel cron is a once-daily fallback on Hobby deployments. GitHub Actions is
 * the primary twice-hourly scheduler; this bridge only dispatches the
 * agent-cycle workflow when /api/health says the last cycle is stale.
 *
 * Protected by CRON_SECRET (Vercel cron auth) to prevent abuse.
 *
 * Spec: post-submission-backlog CI-01.
 */

import { NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const cronPolicy = require("./cronTriggerPolicy.js") as {
  shouldDispatchAgentCycle: (health?: unknown) => {
    dispatch: boolean;
    reason: string;
    lastCycleAge?: number;
    staleAfterSec: number;
  };
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const GITHUB_TOKEN = process.env.GH_DISPATCH_TOKEN; // Fine-grained PAT with actions:write
const REPO = "USBVadik/TuringVault-Core";
const WORKFLOW_ID = "agent-cycle.yml";
const { shouldDispatchAgentCycle } = cronPolicy;

async function fetchHealthSnapshot(request: Request) {
  const origin = new URL(request.url).origin;
  try {
    const res = await fetch(`${origin}/api/health`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  // Vercel cron sends Authorization header with CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured", triggered: false },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const health = await fetchHealthSnapshot(request);
  const policy = shouldDispatchAgentCycle(health);
  if (!policy.dispatch) {
    return NextResponse.json({
      triggered: false,
      skipped: true,
      source: "vercel-cron",
      ...policy,
    });
  }

  if (!GITHUB_TOKEN) {
    return NextResponse.json(
      { error: "GH_DISPATCH_TOKEN not configured", triggered: false },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW_ID}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ ref: "main" }),
      }
    );

    if (res.status === 204) {
      return NextResponse.json({
        triggered: true,
        at: new Date().toISOString(),
        source: "vercel-cron",
        ...policy,
      });
    }

    const body = await res.text();
    return NextResponse.json(
      { triggered: false, status: res.status, body },
      { status: 502 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { triggered: false, error: e.message },
      { status: 500 }
    );
  }
}
