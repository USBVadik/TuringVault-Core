#!/usr/bin/env node
/**
 * Independent verification probe for the DoraHacks submission text.
 *
 * Uses Tier 1b (browser-headers fetch) per
 * .kiro/steering/web-fetch-resilience.md — DoraHacks AWS WAF blocks
 * Tier 0 with HTTP 405 + x-amzn-waf-action: captcha. Browser headers
 * are sufficient.
 *
 * Asserts the live page contains the markers we shipped in
 * docs/dorahacks-submission-v2.md so the operator can confirm at a
 * glance that the edit landed and is rendering correctly.
 */

const SUBMISSION_URL = "https://dorahacks.io/buidl/43986";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

// Markers from docs/dorahacks-submission-v2.md that uniquely identify
// the new submission text. If any of these are missing, the page is
// either still on the old version (cache) or the edit didn't fully
// land.
const REQUIRED_MARKERS = [
  // New section headings
  ["60-Second Pitch", "Section heading"],
  ["Judge's 60-Second Verification Path", "Verification Path table"],
  ["Reproducible AI", "RA differentiator"],
  ["combinedAnchor", "Cryptographic anchor formula"],
  ["mETH LST", "Native yield surface"],
  ["DAO Treasuries", "Target user framing"],
  ["4-Gate AND", "Consensus design refinement"],

  // Fresh numbers
  ["167", "Decision count"],
  ["38.9%", "Block rate"],
  ["1757", "Cumulative PnL bps"],
  ["46.3%", "Win rate"],
  ["96.4%", "Cron uptime"],

  // Honest qualifiers
  ["best-effort hourly", "Honest cron framing"],
  ["5 of 6 contracts Sourcify-verified", "Honest Sourcify count"],
  ["projected/day", "Honest yield labelling"],

  // External wedge
  ["No hardware vendor", "TEE-free differentiator"],

  // Audit folder pitch
  ["audit folder is part of the submission", "Engineering culture wedge"],
];

// Markers that should NOT be present (legacy claims we corrected)
const FORBIDDEN_MARKERS = [
  ["102 on-chain decisions logged", "Stale decision count"],
  ["65%+ rejection rate", "Stale block rate"],
  ["6/6 Sourcify-verified perfect", "Inflated Sourcify count"],
  ["5.25% APY", "Stale USDY APY"],
];

async function main() {
  console.log(`Probing ${SUBMISSION_URL}...`);
  const start = Date.now();
  const res = await fetch(SUBMISSION_URL, { headers: BROWSER_HEADERS });
  const body = await res.text();
  const elapsed = Date.now() - start;
  console.log(`HTTP ${res.status} · ${body.length} bytes · ${elapsed}ms`);
  console.log("");

  if (!res.ok) {
    console.error("Non-OK status. Tier 1b failed; escalate to Tier 2 (Exa).");
    process.exit(2);
  }

  let allRequiredFound = true;
  console.log("=== Required markers ===");
  for (const [marker, label] of REQUIRED_MARKERS) {
    const found = body.includes(marker);
    if (!found) allRequiredFound = false;
    console.log(`${found ? "✅" : "❌"}  ${label.padEnd(35)} "${marker}"`);
  }

  let anyForbiddenFound = false;
  console.log("");
  console.log("=== Forbidden (legacy) markers — should be absent ===");
  for (const [marker, label] of FORBIDDEN_MARKERS) {
    const found = body.includes(marker);
    if (found) anyForbiddenFound = true;
    console.log(`${found ? "❌ STILL PRESENT" : "✅ absent"}  ${label.padEnd(35)} "${marker}"`);
  }

  console.log("");
  if (allRequiredFound && !anyForbiddenFound) {
    console.log("✅ Submission text matches docs/dorahacks-submission-v2.md.");
    process.exit(0);
  } else {
    console.log(
      `❌ Drift detected. allRequiredFound=${allRequiredFound} anyForbiddenFound=${anyForbiddenFound}`
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("fatal:", err.message);
  process.exit(99);
});
