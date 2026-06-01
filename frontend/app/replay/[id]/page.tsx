/**
 * /replay/<cycleId>
 *
 * Server-rendered Reproducible AI verification page. A judge clicks
 * a cycle id and sees:
 *
 *   1. The cryptographic binding: combinedAnchor recomputed from the
 *      on-disk manifest, side-by-side with the bytes32 already on
 *      Mantle Mainnet. Big green ✅ if they match.
 *   2. The exact prompt + raw LLM response for analyst, validator,
 *      and arbiter — pulled from the public git history.
 *   3. Direct links to Mantlescan + the manifest on GitHub for
 *      independent verification.
 *
 * No AWS / GCP credentials required. The Reproducible AI claim is
 * sealed by the on-chain anchor, not by re-invoking the providers.
 *
 * Audit reference: .kiro/audits/18-onchain-anchor-replay-manifest.md
 */
import Link from "next/link";
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { LiveStatusBadge } from "../../components/LiveStatusBadge";
import { explorerUrl } from "../../lib/explorer";
import styles from "../replay.module.css";

interface CaptureEntry {
  role: string;
  provider: string;
  modelId: string;
  temperature: number | null;
  maxTokens: number | null;
  systemPrompt: string;
  userPrompt: string;
  rawText: string;
  parsedOk: boolean;
  timing: { startMs?: number; endMs?: number } | null;
}

interface ManifestOnChain {
  ipfsCid?: string | null;
  proposalId?: number | null;
  manifestHash?: string | null;
  combinedAnchor?: string | null;
  decisionLogTxHash?: string | null;
  decisionLogContract?: string | null;
  chainId?: number | null;
}

interface Manifest {
  schemaVersion: string;
  decisionId: number;
  cycleStartedAt: string | null;
  cycleEndedAt: string | null;
  decisionTier: string | null;
  marketContext: Record<string, unknown> | null;
  onChain: ManifestOnChain | null;
  captures: CaptureEntry[];
  hash: string;
}

const DECISION_LOG_ADDR = "0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5";

async function loadManifest(cycleId: number): Promise<Manifest | null> {
  const fname = `cycle-${String(cycleId).padStart(4, "0")}.json`;
  const localPath = path.resolve(
    process.cwd(),
    "../.kiro/audits/raw/replay-manifests",
    fname
  );
  if (fs.existsSync(localPath)) {
    return JSON.parse(fs.readFileSync(localPath, "utf8"));
  }
  try {
    const url = `https://raw.githubusercontent.com/USBVadik/TuringVault-Core/main/.kiro/audits/raw/replay-manifests/${fname}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (res.ok) return await res.json();
  } catch {
    /* fall through */
  }
  return null;
}

async function loadOnChainAnchor(
  cycleId: number,
  expectedAnchor?: string
): Promise<{ txHash: string; resolvedIndex: number } | null> {
  try {
    const provider = new ethers.JsonRpcProvider("https://rpc.mantle.xyz");
    const dl = new ethers.Contract(
      DECISION_LOG_ADDR,
      [
        "function totalDecisions() view returns (uint256)",
        "function getDecision(uint256 id) view returns (tuple(uint256 timestamp,string action,string targetAsset,uint256 amountIn,uint256 amountOut,uint256 confidence,string reasoningHash,bytes32 txHash))",
      ],
      provider
    );
    const total = Number(await dl.totalDecisions());
    if (total === 0) return null;
    // ValidationRegistry.totalProposals drifted +1 ahead of
    // DecisionLog.totalDecisions historically (one early cycle wrote
    // a proposal but not a DecisionLog entry). Probe a small window
    // and prefer the row whose bytes32 matches the expected anchor.
    const candidates = [cycleId, cycleId - 1, cycleId - 2].filter(
      (i) => i >= 0 && i < total
    );
    for (const idx of candidates) {
      try {
        const d = await dl.getDecision(BigInt(idx));
        const txHash = String(d[7]);
        if (
          !expectedAnchor ||
          txHash.toLowerCase() === expectedAnchor.toLowerCase()
        ) {
          return { txHash, resolvedIndex: idx };
        }
      } catch {
        /* invalid index, try next */
      }
    }
    if (candidates.length === 0) return null;
    try {
      const idx = candidates[0];
      const d = await dl.getDecision(BigInt(idx));
      return { txHash: String(d[7]), resolvedIndex: idx };
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

function recomputeAnchor(
  ipfsCid: string,
  manifestHash: string
): string {
  return ethers.keccak256(
    ethers.concat([ethers.toUtf8Bytes(ipfsCid), manifestHash])
  );
}

function shortHash(s: string | null | undefined, head = 12, tail = 8): string {
  if (!s) return "—";
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export const revalidate = 300;

export default async function ReplayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cycleId = parseInt(id, 10);
  if (Number.isNaN(cycleId) || cycleId < 0) {
    return (
      <div className={styles.emptyState}>
        Cycle id must be a non-negative integer. Try{" "}
        <Link className="underline" href="/replay">
          /replay
        </Link>{" "}
        for the index.
      </div>
    );
  }

  const [manifest, onChainResult] = await Promise.all([
    loadManifest(cycleId),
    // Pre-compute expected anchor from manifest fields so we can
    // search the contract candidate window for the matching row.
    (async () => {
      const m = await loadManifest(cycleId);
      if (!m) return null;
      const expected =
        m.onChain?.combinedAnchor ||
        (m.onChain?.ipfsCid && m.onChain?.manifestHash
          ? recomputeAnchor(m.onChain.ipfsCid, m.onChain.manifestHash)
          : undefined);
      return loadOnChainAnchor(cycleId, expected);
    })(),
  ]);
  const onChainAnchor = onChainResult?.txHash ?? null;
  const onChainIndex = onChainResult?.resolvedIndex ?? null;

  if (!manifest) {
    return (
      <div className={styles.emptyState}>
        <p className="text-red-400">
          Manifest for cycle {cycleId} not found.
        </p>
        <p className="mt-3 text-white/60">
          Manifests live at{" "}
          <code className="text-cyan-400">
            .kiro/audits/raw/replay-manifests/cycle-{String(cycleId).padStart(
              4,
              "0"
            )}
            .json
          </code>{" "}
          and are committed to git every cycle.
        </p>
        <Link className="mt-6 inline-block underline" href="/replay">
          ← back to index
        </Link>
      </div>
    );
  }

  // Server-side binding self-check.
  const ipfsCid = manifest.onChain?.ipfsCid ?? "";
  const manifestHash = manifest.onChain?.manifestHash ?? "";
  const storedAnchor = manifest.onChain?.combinedAnchor ?? "";
  const recomputed =
    ipfsCid && manifestHash ? recomputeAnchor(ipfsCid, manifestHash) : "";
  const onChainBytes32 = onChainAnchor ?? "";

  const recomputeMatchesStored =
    Boolean(recomputed && storedAnchor) &&
    recomputed.toLowerCase() === storedAnchor.toLowerCase();
  const storedMatchesOnChain =
    Boolean(storedAnchor && onChainBytes32) &&
    storedAnchor.toLowerCase() === onChainBytes32.toLowerCase();
  const fullChainOfTrust =
    Boolean(recomputed && onChainBytes32) &&
    recomputed.toLowerCase() === onChainBytes32.toLowerCase();

  const isLegacy = !manifest.onChain?.combinedAnchor;

  return (
    <div className={styles.page}>
      <div className={styles.detailShell}>
        {/* Header */}
        <div className={styles.detailHeader}>
          <div>
            <Link
              href="/replay"
              className={styles.backLink}
            >
              ← Replay Manifests
            </Link>
            <h1 className={styles.detailTitle}>
              Cycle{" "}
              <span className={styles.cycleAccent}>
                #{String(cycleId).padStart(4, "0")}
              </span>
            </h1>
            <p className={styles.detailSubcopy}>
              Tier:{" "}
              <span className="text-amber-300">
                {manifest.decisionTier || "—"}
              </span>{" "}
              · Captured{" "}
              {manifest.cycleEndedAt
                ? new Date(manifest.cycleEndedAt).toISOString()
                : "—"}
            </p>
            <div className="mt-3">
              <LiveStatusBadge variant="compact" />
            </div>
          </div>
          {/* Verdict badge */}
          <div className={styles.verdictCard}>
            <div>
              <div className={styles.verdictLabel}>Binding verdict</div>
              {isLegacy ? (
                <p className={`${styles.verdictValue} ${styles.verdictLegacy}`}>
                  Legacy manifest
                </p>
              ) : fullChainOfTrust ? (
                <p className={`${styles.verdictValue} ${styles.verdictOk}`}>
                  Cryptographic binding verified
                </p>
              ) : (
                <p className={`${styles.verdictValue} ${styles.verdictFail}`}>
                  Binding mismatch
                </p>
              )}
            </div>
            <div className={styles.verdictMeta}>
              {isLegacy
                ? "Pre audit-18: on-chain row carries keccak256(ipfsCid) only."
                : fullChainOfTrust
                ? "Manifest hash, IPFS CID, and DecisionLog bytes32 all match."
                : "Stored anchor and chain data diverge. Investigate before trusting this cycle."}
            </div>
          </div>
        </div>

        {/* Binding panel */}
        <div className={styles.panel}>
          <div className={styles.panelTitle}>
            Reproducible AI · cryptographic binding
          </div>
          <div className={styles.fieldGrid}>
            <Field
              label="ipfsCid (proof-of-reasoning)"
              value={ipfsCid}
              link={
                ipfsCid
                  ? `https://green-linear-jay-761.mypinata.cloud/ipfs/${ipfsCid}`
                  : undefined
              }
            />
            <Field
              label="manifestHash (this file)"
              value={shortHash(manifestHash, 18, 6)}
              fullValue={manifestHash}
            />
            <Field
              label="recomputed combinedAnchor"
              value={shortHash(recomputed, 18, 6)}
              fullValue={recomputed}
            />
            <Field
              label="combinedAnchor in manifest"
              value={shortHash(storedAnchor, 18, 6)}
              fullValue={storedAnchor}
              status={
                isLegacy
                  ? null
                  : recomputeMatchesStored
                  ? "ok"
                  : "fail"
              }
            />
            <Field
              label="on-chain bytes32 (DecisionLog)"
              value={shortHash(onChainBytes32, 18, 6)}
              fullValue={onChainBytes32}
              status={
                isLegacy ? null : storedMatchesOnChain ? "ok" : "fail"
              }
              link={`${explorerUrl("address", DECISION_LOG_ADDR)}#readContract`}
            />
            <Field
              label="DecisionLog tx (audit log)"
              value={shortHash(manifest.onChain?.decisionLogTxHash, 18, 6)}
              fullValue={manifest.onChain?.decisionLogTxHash || ""}
              link={
                manifest.onChain?.decisionLogTxHash
                  ? explorerUrl("tx", manifest.onChain.decisionLogTxHash)
                  : undefined
              }
            />
          </div>
          {/* Section 3 weakness #3 mitigation — give the judge an
              alternate explorer to click if Mantlescan returns 502. */}
          {!isLegacy && manifest.onChain?.decisionLogTxHash && (
            <div className={styles.subNote}>
              Mantlescan flaky?{" "}
              <a
                href={`https://explorer.mantle.xyz/tx/${manifest.onChain.decisionLogTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                title="explorer.mantle.xyz — official Mantle explorer (use as fallback when Mantlescan returns 502)"
              >
                Open same tx on explorer.mantle.xyz mirror →
              </a>
            </div>
          )}
          {onChainIndex !== null && onChainIndex !== cycleId && (
            <div className={styles.subNote}>
              Note: manifest decisionId={cycleId} resolves to
              DecisionLog index {onChainIndex} on-chain
              (ValidationRegistry.totalProposals drifted +
              {cycleId - onChainIndex} ahead of
              DecisionLog.totalDecisions historically).
            </div>
          )}
          {!isLegacy && (
            <div className={styles.formulaBox}>
              Verifier formula:{" "}
              <span>
                keccak256(utf8(ipfsCid) ‖ manifestHash) === DecisionLog.txHash
              </span>
              <br />
              The same value is also present in
              ReputationRegistry.submitFeedback.reasoningHash for cycle{" "}
              {cycleId}.
            </div>
          )}
        </div>

        {/* Captures */}
        <div className={styles.capturesSection}>
          <div className={styles.sectionHeader}>
            <div>
              <p>LLM call captures</p>
              <span>Prompts and raw model responses</span>
            </div>
          </div>
          {manifest.captures.map((cap, i) => (
            <CaptureCard key={i} cap={cap} />
          ))}
        </div>

        {/* Footer / how to verify locally */}
        <div className={styles.verifyBox}>
          <div className={styles.panelTitle}>
            Independent verification
          </div>
          <ol>
            <li>
              Pull the manifest:{" "}
              <a
                href={`https://github.com/USBVadik/TuringVault-Core/blob/main/.kiro/audits/raw/replay-manifests/cycle-${String(
                  cycleId
                ).padStart(4, "0")}.json`}
                target="_blank"
                rel="noreferrer"
              >
                cycle-{String(cycleId).padStart(4, "0")}.json
              </a>
            </li>
            <li>
              Recompute{" "}
              <span className="text-cyan-400">
                keccak256(utf8(ipfsCid) ‖ manifestHash)
              </span>{" "}
              and compare against on-chain{" "}
              <a
                href={`https://mantlescan.xyz/address/${DECISION_LOG_ADDR}#readContract`}
                target="_blank"
                rel="noreferrer"
              >
                DecisionLog.getDecision({cycleId}).txHash
              </a>
              .
            </li>
            <li>
              Optional: round-trip the LLM call. Clone the repo, set
              your AWS / GCP credentials, run{" "}
              <code>
                npm run replay {cycleId}
              </code>
              .
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  fullValue,
  link,
  status,
}: {
  label: string;
  value: string;
  fullValue?: string;
  link?: string;
  status?: "ok" | "fail" | null;
}) {
  return (
    <div className={styles.fieldCard}>
      <div className={styles.fieldLabel}>{label}</div>
      <div className={styles.fieldValue}>
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            title={fullValue || value}
          >
            {value || "—"}
          </a>
        ) : (
          <span title={fullValue || value}>{value || "—"}</span>
        )}
        {status === "ok" && <span className={styles.fieldOk}>OK</span>}
        {status === "fail" && <span className={styles.fieldFail}>FAIL</span>}
      </div>
    </div>
  );
}

function CaptureCard({ cap }: { cap: CaptureEntry }) {
  return (
    <div className={styles.captureCard}>
      <div className={styles.captureHeader}>
        <div>
          <span className={styles.captureRole}>
            {cap.role.toUpperCase()}
          </span>
          <span className={`ml-3 ${styles.captureModel}`}>
            {cap.provider} · {cap.modelId}
          </span>
        </div>
        <div className={styles.captureMeta}>
          temp={cap.temperature ?? "n/a"} · maxTok={cap.maxTokens ?? "n/a"} ·
          parsed={cap.parsedOk ? "OK" : "FAIL"}
        </div>
      </div>

      <div className={styles.promptGrid}>
        <PromptBlock label="systemPrompt" body={cap.systemPrompt} />
        <PromptBlock label="userPrompt" body={cap.userPrompt} />
      </div>

      <div className={styles.rawBlock}>
        <div className={styles.blockLabel}>rawText (model response)</div>
        <pre>{cap.rawText || "(empty)"}</pre>
      </div>
    </div>
  );
}

function PromptBlock({ label, body }: { label: string; body: string }) {
  return (
    <div className={styles.promptBlock}>
      <div className={styles.blockLabel}>{label}</div>
      <pre>{body || "(empty)"}</pre>
    </div>
  );
}
