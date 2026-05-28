/**
 * GET /api/agent-card
 *
 * Returns the LIVE Agent Card metadata as currently advertised by the
 * ERC-8004 Identity NFT on Mantle Mainnet.
 *
 * Resolution order (live → snapshot fallback):
 *   1. Read tokenURI(0) from TuringVaultIdentity (the cron updates it every
 *      cycle to point at a freshly-pinned IPFS blob).
 *   2. Fetch the JSON from `https://gateway.pinata.cloud/ipfs/<cid>`.
 *      Strip the `ipfs://` prefix the contract returns.
 *   3. If either step fails, fall back to the in-repo snapshot
 *      (`assets/agent-card.json`) so the dashboard never breaks.
 *
 * `source` field on the response says which path produced the data:
 *   - `on-chain-tokenURI` — happy path; fully live, IPFS cid included
 *   - `repo-snapshot`     — degraded; honestly labelled
 *   - `none`              — both paths failed; minimal degraded body
 *
 * No claim about `cardStats` is treated as live — frontend uses
 * `/api/decisions` and `/api/strategy` for current numbers. The card
 * surfaces narrative copy + model lineup + prompt version metadata.
 *
 * Spec: ui-honesty-pass T4 (extended after the cron began auto-updating
 * tokenURI per cycle).
 */

import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { createPublicClient, http } from "viem";
import { mantle } from "viem/chains";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CACHE_HEADERS: HeadersInit = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
};

// ── In-memory cache (60s TTL) ──────────────────────────────────
let cachedResponse: { body: AgentCardResponse; ts: number } | null = null;
const CACHE_TTL_MS = 60_000;

const IDENTITY_ADDR = "0x6f862802e0d5463DF18d267e422347BeCacc28bD" as const;
const AGENT_TOKEN_ID = BigInt(0);

// Fetch budget — Vercel function runs on a tight clock.
const ON_CHAIN_TIMEOUT_MS = 4000;
const IPFS_FETCH_TIMEOUT_MS = 4000;

type ModelEntry = { provider?: string; model?: string; role?: string };

type AgentCardRaw = {
  name?: string;
  description?: string;
  models?:
    | { analyst?: ModelEntry; validator?: ModelEntry; arbiter?: ModelEntry }
    | ModelEntry[];
  systemPrompt?: { version?: string; lastUpdated?: string };
  capabilities?: string[];
  contracts?: Record<string, string>;
  stats?: Record<string, unknown>;
  [key: string]: unknown;
};

type AgentCardResponse = {
  status: "ok" | "degraded";
  source: "on-chain-tokenURI" | "repo-snapshot" | "none";
  ipfsCid: string | null;
  tokenURI: string | null;
  fetchedAt: string;
  fetchedFromGateway: string | null;
  name: string | null;
  description: string | null;
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
   * the live numbers live behind /api/decisions / /api/strategy.
   */
  cardStats: Record<string, unknown> | null;
  cardStatsScope: "card-author-declared";
  error?: string;
};

function projectAgentCardPath(): string {
  // In `next dev` cwd is `frontend/`; the asset lives one level up.
  return path.resolve(process.cwd(), "..", "assets", "agent-card.json");
}

function compactModel(entry: ModelEntry | undefined) {
  if (!entry) return null;
  return {
    provider: entry.provider ?? null,
    model: entry.model ?? null,
  };
}

/** Normalise the `models` field — schema allows either an object or an array. */
function normaliseModels(raw: AgentCardRaw["models"]) {
  // Object shape: { analyst, validator, arbiter }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return {
      analyst: compactModel(raw.analyst),
      validator: compactModel(raw.validator),
      arbiter: compactModel(raw.arbiter),
    };
  }
  // Array shape: [{ role: 'analyst', ... }, ...]
  if (Array.isArray(raw)) {
    const byRole: Record<string, ModelEntry> = {};
    for (const m of raw) {
      const role = (m.role ?? "").toLowerCase();
      if (role) byRole[role] = m;
    }
    return {
      analyst: compactModel(byRole.analyst),
      validator: compactModel(byRole.validator),
      arbiter: compactModel(byRole.arbiter),
    };
  }
  return { analyst: null, validator: null, arbiter: null };
}

async function readLocalCard(): Promise<AgentCardRaw | null> {
  try {
    const filePath = projectAgentCardPath();
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as AgentCardRaw;
  } catch {
    return null;
  }
}

async function readTokenURI(): Promise<string | null> {
  try {
    const client = createPublicClient({
      chain: mantle,
      transport: http("https://rpc.mantle.xyz"),
    });
    const uri = (await Promise.race([
      client.readContract({
        address: IDENTITY_ADDR,
        abi: [
          {
            name: "tokenURI",
            type: "function",
            stateMutability: "view",
            inputs: [{ name: "tokenId", type: "uint256" }],
            outputs: [{ name: "", type: "string" }],
          },
        ],
        functionName: "tokenURI",
        args: [AGENT_TOKEN_ID],
      }),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("rpc-timeout")), ON_CHAIN_TIMEOUT_MS)
      ),
    ])) as string;
    return typeof uri === "string" && uri.length > 0 ? uri : null;
  } catch {
    return null;
  }
}

function uriToCid(uri: string): string | null {
  // Accept ipfs://<cid>/maybe-path  or  raw <cid>  or  https://gateway/ipfs/<cid>
  if (!uri) return null;
  if (uri.startsWith("ipfs://"))
    return uri.slice("ipfs://".length).split("/")[0];
  const gw = uri.match(/\/ipfs\/([^/?#]+)/);
  if (gw) return gw[1];
  // Fallback: assume raw CID
  if (/^[a-zA-Z0-9]{40,}$/.test(uri)) return uri;
  return null;
}

async function fetchFromIpfs(cid: string): Promise<{
  data: AgentCardRaw | null;
  gateway: string | null;
}> {
  // Pinata public gateway is our primary; ipfs.io is a fallback.
  const gateways = [
    `https://gateway.pinata.cloud/ipfs/${cid}`,
    `https://ipfs.io/ipfs/${cid}`,
  ];
  for (const gw of gateways) {
    try {
      const res = await fetch(gw, {
        signal: AbortSignal.timeout(IPFS_FETCH_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as AgentCardRaw;
      if (data && typeof data === "object") return { data, gateway: gw };
    } catch {
      /* try next gateway */
    }
  }
  return { data: null, gateway: null };
}

function buildBody(args: {
  raw: AgentCardRaw | null;
  status: AgentCardResponse["status"];
  source: AgentCardResponse["source"];
  ipfsCid: string | null;
  tokenURI: string | null;
  gateway: string | null;
  error?: string;
}): AgentCardResponse {
  const { raw } = args;
  return {
    status: args.status,
    source: args.source,
    ipfsCid: args.ipfsCid,
    tokenURI: args.tokenURI,
    fetchedAt: new Date().toISOString(),
    fetchedFromGateway: args.gateway,
    name: raw?.name ?? null,
    description: typeof raw?.description === "string" ? raw.description : null,
    models: normaliseModels(raw?.models),
    systemPromptVersion: raw?.systemPrompt?.version ?? null,
    systemPromptLastUpdated: raw?.systemPrompt?.lastUpdated ?? null,
    contracts: raw?.contracts ?? null,
    cardStats: (raw?.stats as Record<string, unknown>) ?? null,
    cardStatsScope: "card-author-declared",
    ...(args.error ? { error: args.error } : {}),
  };
}

export async function GET(): Promise<NextResponse> {
  // ── 0. Return cached if fresh ─────────────────────────────────
  if (cachedResponse && Date.now() - cachedResponse.ts < CACHE_TTL_MS) {
    return NextResponse.json(cachedResponse.body, { headers: CACHE_HEADERS });
  }

  // ── 1. Try the live on-chain → IPFS path ──────────────────────
  const tokenURI = await readTokenURI();
  if (tokenURI) {
    const cid = uriToCid(tokenURI);
    if (cid) {
      const { data, gateway } = await fetchFromIpfs(cid);
      if (data) {
        const body = buildBody({
          raw: data,
          status: "ok",
          source: "on-chain-tokenURI",
          ipfsCid: cid,
          tokenURI,
          gateway,
        });
        cachedResponse = { body, ts: Date.now() };
        return NextResponse.json(body, { headers: CACHE_HEADERS });
      }
      // tokenURI valid but IPFS unreachable — fall through to snapshot
    }
  }

  // ── 2. Fallback: in-repo snapshot ─────────────────────────────
  const local = await readLocalCard();
  if (local) {
    const body = buildBody({
      raw: local,
      status: "degraded",
      source: "repo-snapshot",
      ipfsCid: null,
      tokenURI: tokenURI ?? null,
      gateway: null,
      error:
        tokenURI == null
          ? "tokenURI unreadable; using repo snapshot"
          : "IPFS gateway unreachable; using repo snapshot",
    });
    cachedResponse = { body, ts: Date.now() };
    return NextResponse.json(body, { headers: CACHE_HEADERS });
  }

  // ── 3. Both paths failed — minimal honest degraded body ───────
  const body = buildBody({
    raw: null,
    status: "degraded",
    source: "none",
    ipfsCid: null,
    tokenURI: tokenURI ?? null,
    gateway: null,
    error: "agent card unreachable from both on-chain and snapshot",
  });
  // Don't cache failures
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
