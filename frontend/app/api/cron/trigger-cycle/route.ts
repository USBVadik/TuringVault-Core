/**
 * Vercel Cron → GitHub Actions workflow_dispatch bridge.
 *
 * Vercel cron fires reliably every hour (unlike GH Actions which skips ~63%
 * of scheduled slots). This endpoint dispatches the agent-cycle workflow
 * via GitHub API, providing near-100% hourly coverage.
 *
 * Protected by CRON_SECRET (Vercel cron auth) to prevent abuse.
 *
 * Spec: post-submission-backlog CI-01.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const GITHUB_TOKEN = process.env.GH_DISPATCH_TOKEN; // Fine-grained PAT with actions:write
const REPO = "USBVadik/TuringVault-Core";
const WORKFLOW_ID = "agent-cycle.yml";

export async function GET(request: Request) {
  // Vercel cron sends Authorization header with CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
