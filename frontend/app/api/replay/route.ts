/**
 * /api/replay
 *
 * Index endpoint — returns the list of cycle ids that have a replay
 * manifest committed in the public repo. Used by the /replay landing
 * page to render a directory of available cycles.
 *
 * Audit reference: .kiro/audits/18-onchain-anchor-replay-manifest.md
 */
import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

export const dynamic = "force-dynamic";
export const revalidate = 60;

interface ManifestSummary {
  cycleId: number;
  decisionTier: string | null;
  cycleEndedAt: string | null;
  hasOnChainAnchor: boolean;
}

async function listLocalManifests(): Promise<ManifestSummary[]> {
  const dir = path.resolve(
    process.cwd(),
    "../.kiro/audits/raw/replay-manifests"
  );
  if (!fs.existsSync(dir)) return [];
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("cycle-") && f.endsWith(".json"));
  const out: ManifestSummary[] = [];
  for (const f of files) {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      out.push({
        cycleId: Number(m.decisionId ?? -1),
        decisionTier: m.decisionTier ?? null,
        cycleEndedAt: m.cycleEndedAt ?? null,
        hasOnChainAnchor: Boolean(
          m.onChain?.combinedAnchor && m.onChain?.manifestHash
        ),
      });
    } catch {
      /* skip malformed */
    }
  }
  return out;
}

async function listGithubManifests(): Promise<ManifestSummary[]> {
  // GitHub Contents API — public, no token required for public repos.
  // Fetches the directory listing once and probes the most recent
  // 30 manifests in parallel for their tier + anchor metadata.
  try {
    const dirRes = await fetch(
      "https://api.github.com/repos/USBVadik/TuringVault-Core/contents/.kiro/audits/raw/replay-manifests",
      {
        headers: { Accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!dirRes.ok) return [];
    const entries = (await dirRes.json()) as Array<{
      name: string;
      download_url: string;
    }>;
    const recent = entries
      .filter((e) => e.name.startsWith("cycle-") && e.name.endsWith(".json"))
      .sort((a, b) => b.name.localeCompare(a.name))
      .slice(0, 30);
    const summaries = await Promise.all(
      recent.map(async (e) => {
        try {
          const r = await fetch(e.download_url, {
            signal: AbortSignal.timeout(3000),
          });
          if (!r.ok) return null;
          const m = await r.json();
          return {
            cycleId: Number(m.decisionId ?? -1),
            decisionTier: m.decisionTier ?? null,
            cycleEndedAt: m.cycleEndedAt ?? null,
            hasOnChainAnchor: Boolean(
              m.onChain?.combinedAnchor && m.onChain?.manifestHash
            ),
          } as ManifestSummary;
        } catch {
          return null;
        }
      })
    );
    return summaries.filter((s): s is ManifestSummary => s !== null);
  } catch {
    return [];
  }
}

export async function GET() {
  let summaries = await listLocalManifests();
  if (summaries.length === 0) summaries = await listGithubManifests();

  // Newest first.
  summaries.sort((a, b) => b.cycleId - a.cycleId);
  // Cap at 30 for index UX; a judge can deep-link any other id directly.
  summaries = summaries.slice(0, 30);

  return NextResponse.json(
    {
      total: summaries.length,
      manifests: summaries,
      source: "git-public",
      note:
        "Each manifest carries the exact prompts and raw LLM responses for " +
        "one cycle. Visit /replay/<cycleId> for the full side-by-side view " +
        "with the on-chain anchor verified.",
    },
    {
      headers: {
        "Cache-Control":
          "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
