#!/usr/bin/env node
/**
 * Tiered web-fetch helper — Tier 0 (curl) → Tier 1 (web_fetch via
 * Node fetch with browser-like headers) → Tier 2 (Exa hint).
 *
 * Spec: .kiro/steering/web-fetch-resilience.md
 *
 * Usage:
 *   node scripts/audit/fetch-with-fallback.js <url> [--phrase=<text>] [--max=<chars>]
 *
 * Behaviour:
 *   - Tier 0 — direct fetch with default User-Agent. Fast, free,
 *     dies first on aggressive WAFs. Detects:
 *       HTTP 405 + x-amzn-waf-action: captcha
 *       HTTP 403 + Cloudflare challenge HTML
 *       Body containing "Just a moment", "Checking your browser",
 *       "captcha", "<title>Attention Required"
 *   - Tier 1 — fetch with realistic browser headers (User-Agent,
 *     Accept, Accept-Language). Handles light anti-bot. Same
 *     detection.
 *   - Tier 2 — out of scope for this CLI helper because it requires
 *     the Exa MCP tool which is only available to the agent context,
 *     not raw Node. We instead PRINT a clear instruction telling the
 *     operator (or the agent reading this output) to escalate via
 *     `kiroPowers.use` with toolName "web_fetch_exa".
 *
 * The helper is intentionally read-able as documentation. The
 * detection list is the authoritative version of the failure tells.
 */

const KNOWN_BLOCK_HEADERS = [
  ["x-amzn-waf-action", /captcha/i],
];

const KNOWN_BLOCK_BODY_PATTERNS = [
  /just a moment/i,
  /checking your browser/i,
  /<title>\s*attention required/i,
  /cf_clearance/i,
  /captcha required/i,
  /error\s*1020/i,
  /<title>\s*captcha/i,
];

const BLOCK_STATUSES = new Set([403, 405, 429, 503]);

function isBlocked(status, headers, body) {
  if (BLOCK_STATUSES.has(status)) return { blocked: true, why: `HTTP ${status}` };
  for (const [name, pat] of KNOWN_BLOCK_HEADERS) {
    const v = headers.get?.(name) || headers[name];
    if (v && pat.test(String(v))) {
      return { blocked: true, why: `header ${name}: ${v}` };
    }
  }
  const sample = (body || "").slice(0, 4000);
  for (const pat of KNOWN_BLOCK_BODY_PATTERNS) {
    if (pat.test(sample)) {
      return { blocked: true, why: `body pattern ${pat}` };
    }
  }
  return { blocked: false };
}

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
};

async function tier0(url) {
  const start = Date.now();
  try {
    const res = await fetch(url);
    const body = await res.text();
    const block = isBlocked(res.status, res.headers, body);
    return {
      tier: 0,
      ok: res.ok && !block.blocked,
      status: res.status,
      blocked: block.blocked,
      blockReason: block.why,
      body,
      ms: Date.now() - start,
    };
  } catch (err) {
    return {
      tier: 0,
      ok: false,
      status: null,
      blocked: false,
      error: err.message,
      ms: Date.now() - start,
    };
  }
}

async function tier1(url) {
  const start = Date.now();
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS });
    const body = await res.text();
    const block = isBlocked(res.status, res.headers, body);
    return {
      tier: 1,
      ok: res.ok && !block.blocked,
      status: res.status,
      blocked: block.blocked,
      blockReason: block.why,
      body,
      ms: Date.now() - start,
    };
  } catch (err) {
    return {
      tier: 1,
      ok: false,
      status: null,
      blocked: false,
      error: err.message,
      ms: Date.now() - start,
    };
  }
}

function printTier2Hint(url, phrase) {
  console.log("");
  console.log("=== TIER 2 — Escalate via Exa ===");
  console.log("");
  console.log("This CLI cannot call MCP tools directly. Run from the");
  console.log("agent context the equivalent of:");
  console.log("");
  console.log("  kiroPowers.use({");
  console.log('    powerName: "exa",');
  console.log('    serverName: "exa",');
  console.log('    toolName: "web_fetch_exa",');
  console.log("    arguments: {");
  console.log(`      urls: [${JSON.stringify(url)}],`);
  console.log("      maxCharacters: 8000");
  console.log("    }");
  console.log("  });");
  if (phrase) {
    console.log("");
    console.log(`After fetching, grep for "${phrase}" in the markdown output.`);
  }
  console.log("");
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help")) {
    console.log("Usage: node fetch-with-fallback.js <url> [--phrase=<text>] [--max=<chars>]");
    process.exit(0);
  }
  const url = args.find((a) => !a.startsWith("--"));
  if (!url) {
    console.error("Missing URL argument.");
    process.exit(1);
  }
  const phraseArg = args.find((a) => a.startsWith("--phrase="));
  const phrase = phraseArg ? phraseArg.slice("--phrase=".length) : null;
  const maxArg = args.find((a) => a.startsWith("--max="));
  const maxChars = maxArg ? Number(maxArg.slice("--max=".length)) : 4000;

  console.log(`Tiered fetch: ${url}`);
  console.log("");

  // Tier 0
  const r0 = await tier0(url);
  console.log(
    `Tier 0 (curl-equivalent):  status=${r0.status}  ${r0.ok ? "OK" : r0.blocked ? `BLOCKED (${r0.blockReason})` : `FAIL (${r0.error || "unknown"})`}  ${r0.ms}ms`
  );
  if (r0.ok) {
    return printSuccess(r0, phrase, maxChars);
  }

  // Tier 1
  const r1 = await tier1(url);
  console.log(
    `Tier 1 (browser headers):  status=${r1.status}  ${r1.ok ? "OK" : r1.blocked ? `BLOCKED (${r1.blockReason})` : `FAIL (${r1.error || "unknown"})`}  ${r1.ms}ms`
  );
  if (r1.ok) {
    return printSuccess(r1, phrase, maxChars);
  }

  // Tier 2 — out of scope for this CLI; print escalation hint.
  printTier2Hint(url, phrase);
  console.log("ALL_LOCAL_TIERS_FAILED");
  console.log(`Tier 0: ${r0.blocked ? r0.blockReason : r0.error || `HTTP ${r0.status}`}`);
  console.log(`Tier 1: ${r1.blocked ? r1.blockReason : r1.error || `HTTP ${r1.status}`}`);
  process.exit(2);
}

function printSuccess(result, phrase, maxChars) {
  console.log(`✅ Tier ${result.tier} succeeded.`);
  console.log("");
  if (phrase) {
    const found = (result.body || "").includes(phrase);
    console.log(`Phrase "${phrase}" present: ${found ? "YES" : "no"}`);
    console.log("");
  }
  const out = (result.body || "").slice(0, maxChars);
  console.log(out);
  if ((result.body || "").length > maxChars) {
    console.log(`\n[truncated to ${maxChars} chars; full body ${result.body.length} chars]`);
  }
}

main().catch((err) => {
  console.error("fatal:", err.message);
  process.exit(99);
});
