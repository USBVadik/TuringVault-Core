/**
 * /replay — Reproducible AI manifest index.
 *
 * Lists the most recent committed cycle manifests as ProofCards.
 * Each card shows verdict (from decisionTier), agent consensus,
 * a reasoning excerpt parsed from the analyst capture, and the
 * on-chain anchor (Mantle DecisionLog tx + IPFS CID).
 *
 * Audit reference: .kiro/audits/18-onchain-anchor-replay-manifest.md
 */
import Link from "next/link";
import * as fs from "fs";
import * as path from "path";
import { LiveStatusBadge } from "../components/LiveStatusBadge";
import { ProofCard, type Verdict } from "../components/ProofCard";

interface ManifestSummary {
  cycleId: number;
  decisionTier: string | null;
  cycleEndedAt: string | null;
  hasOnChainAnchor: boolean;
  reasoningExcerpt: string | null;
  txHash: string | null;
  ipfsCid: string | null;
  analystModel: string | null;
  validatorModel: string | null;
}

/**
 * Map cycle decisionTier → ProofCard verdict.
 * EXECUTED_SWAP and approved consensus → validated.
 * BLOCKED / VAR_GATE_REJECTED → challenged.
 * Anything else (including HOLD/IDLE) → pending.
 */
function tierToVerdict(tier: string | null): Verdict {
  if (!tier) return "pending";
  const t = tier.toUpperCase();
  if (t.includes("EXECUTED") || t.includes("APPROVED")) return "validated";
  if (t.includes("BLOCKED") || t.includes("REJECTED")) return "challenged";
  return "pending";
}

/**
 * Parse the analyst's raw JSON-in-markdown response and pull a readable
 * one-sentence excerpt. Falls back to a short slice of validator reasoning.
 * No throw — always returns a string or null.
 */
function extractExcerpt(
  captures: Array<Record<string, unknown>> | undefined
): string | null {
  if (!Array.isArray(captures)) return null;
  const analyst = captures.find((c) => c.role === "analyst");
  const validator = captures.find((c) => c.role === "validator");

  // Try analyst first — usually has the proposal rationale.
  const analystRaw = (analyst?.rawText as string | undefined) ?? "";
  const analystMatch = analystRaw.match(/"reasoning"\s*:\s*"([^"]+)"/);
  if (analystMatch?.[1]) return analystMatch[1];

  // Fall back to validator reasoning.
  const validatorRaw = (validator?.rawText as string | undefined) ?? "";
  const validatorMatch = validatorRaw.match(/"reasoning"\s*:\s*"([^"]+)"/);
  if (validatorMatch?.[1]) return validatorMatch[1];

  return null;
}

function modelLabel(modelId: string | null): string {
  if (!modelId) return "Unknown";
  if (modelId.includes("glm")) return "GLM-5 Analyst";
  if (modelId.includes("claude")) return "Claude 4.6 Validator";
  if (modelId.includes("gemini")) return "Gemini Arbiter";
  return modelId;
}

async function loadIndex(): Promise<ManifestSummary[]> {
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
        const captures = Array.isArray(m.captures) ? m.captures : [];
        out.push({
          cycleId: Number(m.decisionId ?? -1),
          decisionTier: m.decisionTier ?? null,
          cycleEndedAt: m.cycleEndedAt ?? null,
          hasOnChainAnchor: Boolean(
            m.onChain?.combinedAnchor && m.onChain?.manifestHash
          ),
          reasoningExcerpt: extractExcerpt(captures),
          txHash: m.onChain?.decisionLogTxHash ?? null,
          ipfsCid: m.onChain?.ipfsCid ?? null,
          analystModel:
            captures.find((c: { role: string }) => c.role === "analyst")
              ?.modelId ?? null,
          validatorModel:
            captures.find((c: { role: string }) => c.role === "validator")
              ?.modelId ?? null,
        });
      } catch {
        /* skip */
      }
    }
  }
  if (out.length > 0) {
    return out.sort((a, b) => b.cycleId - a.cycleId).slice(0, 12);
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
      .slice(0, 12);
    const summaries = await Promise.all(
      recent.map(async (e) => {
        try {
          const r = await fetch(e.download_url, { next: { revalidate: 300 } });
          if (!r.ok) return null;
          const m = await r.json();
          const captures = Array.isArray(m.captures) ? m.captures : [];
          return {
            cycleId: Number(m.decisionId ?? -1),
            decisionTier: m.decisionTier ?? null,
            cycleEndedAt: m.cycleEndedAt ?? null,
            hasOnChainAnchor: Boolean(
              m.onChain?.combinedAnchor && m.onChain?.manifestHash
            ),
            reasoningExcerpt: extractExcerpt(captures),
            txHash: m.onChain?.decisionLogTxHash ?? null,
            ipfsCid: m.onChain?.ipfsCid ?? null,
            analystModel:
              captures.find((c: { role: string }) => c.role === "analyst")
                ?.modelId ?? null,
            validatorModel:
              captures.find((c: { role: string }) => c.role === "validator")
                ?.modelId ?? null,
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
      <div className="mx-auto max-w-6xl">
        <div className="text-xs uppercase tracking-wider text-white/40">
          Reproducible AI · Replay Manifests
        </div>
        <div className="mt-1 mb-2">
          <LiveStatusBadge variant="compact" />
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
          a card to see the prompts side by side and the binding
          self-check.
        </p>

        {summaries.length === 0 ? (
          <div className="mt-8 p-6 rounded-lg border border-white/10 bg-white/[0.02] text-white/50 font-mono text-sm">
            No manifests indexed yet — try direct deep-link{" "}
            <code className="text-cyan-400">/replay/&lt;id&gt;</code>.
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            {summaries.map((s) => {
              const verdict = tierToVerdict(s.decisionTier);
              const consensus = [
                s.analystModel
                  ? {
                      label: modelLabel(s.analystModel),
                      dotClass: "bg-purple-400",
                    }
                  : null,
                s.validatorModel
                  ? {
                      label: modelLabel(s.validatorModel),
                      dotClass: "bg-cyan-400",
                    }
                  : null,
              ].filter((x): x is { label: string; dotClass: string } => !!x);

              return (
                <Link
                  key={s.cycleId}
                  href={`/replay/${s.cycleId}`}
                  className="block transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <ProofCard
                    decisionId={String(s.cycleId).padStart(4, "0")}
                    verdict={verdict}
                    title={
                      s.decisionTier
                        ? s.decisionTier
                            .replace(/_/g, " ")
                            .toLowerCase()
                            .replace(/^./, (c) => c.toUpperCase())
                        : `Cycle #${s.cycleId}`
                    }
                    reasoning={
                      s.reasoningExcerpt ??
                      "Reasoning chain available in manifest detail. Click to view full prompts and raw LLM responses for every agent in this cycle."
                    }
                    consensus={consensus}
                    txHash={s.txHash ?? "0x" + "0".repeat(64)}
                    reasoningCid={s.ipfsCid ?? "—"}
                  />
                </Link>
              );
            })}
          </div>
        )}

        <div className="mt-8 text-[11px] font-mono text-white/40">
          Index capped at 12 most-recent cycles. All manifests live in
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
