/**
 * /replay — Reproducible AI manifest index.
 *
 * Lists the most recent committed cycle manifests with a quick
 * indication of whether they carry the audit-18 on-chain anchor.
 * Each row links to /replay/<id> for the full side-by-side proof.
 *
 * Audit reference: .kiro/audits/18-onchain-anchor-replay-manifest.md
 */
import Link from "next/link";
import * as fs from "fs";
import * as path from "path";

interface ManifestSummary {
  cycleId: number;
  decisionTier: string | null;
  cycleEndedAt: string | null;
  hasOnChainAnchor: boolean;
}

async function loadIndex(): Promise<ManifestSummary[]> {
  // Local first.
  const dir = path.resolve(
    process.cwd(),
    "../.kiro/audits/raw/replay-manifests"
  );
  const out: ManifestSummary[] = [];
  if (fs.existsSync(dir)) {
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith("cycle-") && f.endsWith(".json"));
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
        /* skip */
      }
    }
  }
  if (out.length > 0) {
    return out.sort((a, b) => b.cycleId - a.cycleId).slice(0, 30);
  }
  // GitHub fallback for Vercel serverless.
  try {
    const dirRes = await fetch(
      "https://api.github.com/repos/USBVadik/TuringVault-Core/contents/.kiro/audits/raw/replay-manifests",
      {
        headers: { Accept: "application/vnd.github+json" },
        next: { revalidate: 60 },
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
            next: { revalidate: 300 },
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

export const revalidate = 60;

export default async function ReplayIndexPage() {
  const summaries = await loadIndex();

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white px-6 py-10 md:px-12">
      <div className="mx-auto max-w-4xl">
        <div className="text-xs uppercase tracking-wider text-white/40">
          Reproducible AI · Replay Manifests
        </div>
        <h1 className="mt-2 text-3xl font-bold font-mono">
          Verify any past decision
        </h1>
        <p className="mt-3 text-white/70 max-w-2xl">
          Every multi-agent cycle commits a manifest with the exact
          prompts and raw LLM responses for analyst, validator, and
          arbiter. Each manifest is anchored on Mantle Mainnet via{" "}
          <code className="text-cyan-400">
            keccak256(utf8(ipfsCid) ‖ manifestHash)
          </code>{" "}
          stored in{" "}
          <code className="text-cyan-400">DecisionLog.txHash</code>. Click
          a cycle to see the prompts side by side and the binding
          self-check.
        </p>

        <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.02] divide-y divide-white/5">
          {summaries.length === 0 && (
            <div className="p-6 text-white/50 font-mono text-sm">
              No manifests indexed yet — try direct deep-link{" "}
              <code className="text-cyan-400">/replay/&lt;id&gt;</code>.
            </div>
          )}
          {summaries.map((s) => (
            <Link
              key={s.cycleId}
              href={`/replay/${s.cycleId}`}
              className="flex items-center justify-between p-4 hover:bg-white/[0.04] transition-colors"
            >
              <div className="flex items-baseline gap-4 font-mono text-sm">
                <span className="text-cyan-400">
                  #{String(s.cycleId).padStart(4, "0")}
                </span>
                <span className="text-amber-300 text-xs">
                  {s.decisionTier || "—"}
                </span>
                <span className="text-white/40 text-xs">
                  {s.cycleEndedAt
                    ? new Date(s.cycleEndedAt).toISOString()
                    : "—"}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                {s.hasOnChainAnchor ? (
                  <span className="text-emerald-400">⚓ on-chain anchor</span>
                ) : (
                  <span className="text-yellow-400/80">legacy</span>
                )}
                <span className="text-white/30">→</span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 text-[11px] font-mono text-white/40">
          Index capped at 30 most-recent cycles. All manifests live in
          the public repo at{" "}
          <a
            className="underline hover:text-cyan-400"
            href="https://github.com/USBVadik/TuringVault-Core/tree/main/.kiro/audits/raw/replay-manifests"
            target="_blank"
            rel="noreferrer"
          >
            .kiro/audits/raw/replay-manifests/
          </a>
          .
        </div>
      </div>
    </div>
  );
}
