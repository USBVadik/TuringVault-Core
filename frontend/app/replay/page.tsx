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
import { LiveStatusBadge } from "../components/LiveStatusBadge";
import styles from "./replay.module.css";

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
  const anchoredCount = summaries.filter((s) => s.hasOnChainAnchor).length;
  const blockedCount = summaries.filter((s) =>
    s.decisionTier?.startsWith("BLOCKED")
  ).length;
  const executedCount = summaries.filter((s) =>
    s.decisionTier?.includes("EXECUTED")
  ).length;
  const latest = summaries[0] ?? null;

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}>
              <span>Reproducible AI</span>
              <span>Replay manifests</span>
              <LiveStatusBadge variant="compact" />
            </div>
            <h1>Replay every agent decision, byte-for-byte.</h1>
            <p>
              Every multi-agent cycle commits the exact prompts, raw LLM
              responses, validation output, and on-chain anchor. Pick a cycle,
              then verify the reasoning trail without trusting the UI.
            </p>
            <div className={styles.formulaStrip}>
              <span>Verifier formula</span>
              <code>keccak256(utf8(ipfsCid) ‖ manifestHash)</code>
              <span>DecisionLog.txHash</span>
            </div>
          </div>

          <div className={styles.heroStats} aria-label="Replay manifest stats">
            <StatCard label="Indexed cycles" value={String(summaries.length)} />
            <StatCard label="On-chain anchors" value={String(anchoredCount)} />
            <StatCard label="Blocked cycles" value={String(blockedCount)} />
            <StatCard
              label="Latest cycle"
              value={latest ? `#${String(latest.cycleId).padStart(4, "0")}` : "—"}
            />
          </div>
        </section>

        <section className={styles.listSection}>
          <div className={styles.sectionHeader}>
            <div>
              <p>Manifest index</p>
              <span>Most recent committed cycles</span>
            </div>
            <div className={styles.indexMeta}>
              <span>{executedCount} executed</span>
              <span>{blockedCount} blocked</span>
            </div>
          </div>

          <div className={styles.manifestList}>
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
              className={styles.manifestRow}
            >
              <div className={styles.rowMain}>
                <span className={styles.cycleId}>
                  #{String(s.cycleId).padStart(4, "0")}
                </span>
                <span className={`${styles.tierPill} ${tierClass(s.decisionTier)}`}>
                  {s.decisionTier || "—"}
                </span>
                <span className={styles.timestamp}>
                  {s.cycleEndedAt
                    ? new Date(s.cycleEndedAt).toISOString()
                    : "—"}
                </span>
              </div>
              <div className={styles.rowStatus}>
                {s.hasOnChainAnchor ? (
                  <span className={styles.anchorOk}>ON-CHAIN ANCHOR</span>
                ) : (
                  <span className={styles.anchorLegacy}>LEGACY</span>
                )}
                <span className={styles.rowArrow}>→</span>
              </div>
            </Link>
          ))}
          </div>
        </section>

        <div className={styles.footerNote}>
          <span>Index capped at 30 most-recent cycles.</span>
          <a
            href="https://github.com/USBVadik/TuringVault-Core/tree/main/.kiro/audits/raw/replay-manifests"
            target="_blank"
            rel="noreferrer"
          >
            View raw manifests on GitHub →
          </a>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.statCard}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function tierClass(tier: string | null) {
  if (!tier) return styles.tierNeutral;
  if (tier.includes("EXECUTED")) return styles.tierExecuted;
  if (tier.includes("VALIDATOR")) return styles.tierValidator;
  if (tier.includes("PARSE")) return styles.tierParse;
  if (tier.includes("PORTFOLIO")) return styles.tierPortfolio;
  if (tier.includes("REGIME")) return styles.tierRegime;
  if (tier.startsWith("BLOCKED")) return styles.tierBlocked;
  return styles.tierNeutral;
}
