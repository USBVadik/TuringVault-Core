#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

const FILES = [
  "README.md",
  "assets/agent-card.json",
  "docs/DORAHACKS_SUBMISSION.md",
  "docs/SUBMISSION.md",
  "docs/dorahacks-submission-v2.md",
  "docs/dorahacks-final-polished.md",
  "docs/submission-final-copy.md",
  "docs/MASTER_SPEC.md",
];

const RULES = [
  {
    name: "Do not label outcome score as live realized PnL",
    pattern: /\blive\s+reali[sz]ed\s+pnl\b/i,
  },
  {
    name: "Do not attach a numeric gain directly to realized PnL",
    pattern: /\breali[sz]ed\s+(?:wallet\s+)?pnl\s*(?:[:=]|\+|\$|\d)/i,
  },
  {
    name: "Do not claim zero/no trust assumptions",
    pattern: /\b(?:zero|no)\s+trust\s+assumptions?\b/i,
  },
  {
    name: "Do not claim complete reasoning is stored on-chain",
    pattern: /\bcomplete\s+reasoning(?:\s+chain)?\s+(?:is\s+)?stored\s+on[-\s]?chain\b/i,
  },
  {
    name: "Do not claim perpetual liveness",
    pattern: /\balways[-\s]?on\b/i,
  },
  {
    name: "Do not reintroduce stale 287 proposal denominator",
    pattern: /\b76\s*(?:of|\/)\s*287\b/i,
  },
  {
    name: "Do not reintroduce stale approved count",
    pattern: /\b211\s+approved\b/i,
  },
  {
    name: "Do not reintroduce stale NAV snapshot",
    pattern: /\$151\.12\b/i,
  },
  {
    name: "Do not imply TX Proof 100% without denominator",
    pattern: /\bTX\s+Proof\s+100%\b/i,
  },
  {
    name: "Do not call cron cycles successful trades",
    pattern: /\bsuccessful\s+(?:trades|swaps)\b/i,
  },
  {
    name: "Do not position the project as Path A primary",
    pattern: /^(?!.*\bDo not claim\b).*\bPath\s+A\b.*\b(?:PRIMARY|primary|Infrastructure|infrastructure|over\s+Path\s+B|asset\s+tokenization)\b/i,
  },
  {
    name: "Do not use stale AI x RWA Path A track label",
    pattern: /\bAI\s*x?\s*&?\s*RWA\s+Track\s+[—-]\s+Path\s+A\b/i,
  },
  {
    name: "Do not leave demo video as a pending submission item",
    pattern: /(?:\[ \]|□)\s+.*demo\s+video|demo\s+video:\s+add\s+the\s+final/i,
  },
  {
    name: "Do not expose internal Path A/Path B allocator route names in public Agent Card",
    pattern: /RWA allocator\s+\(Path\s+A\s+LLM-driven\s+OR\s+Path\s+B\s+deterministic/i,
  },
  {
    name: "Do not claim 100% consensus rate in public Agent Card stats",
    pattern: /"consensusRate"\s*:\s*"100%/i,
  },
  {
    name: "Do not reintroduce stale May Agent Card snapshot",
    pattern: /2026-05-29T19:42:00\.000Z/i,
  },
];

const failures = [];

for (const relativePath of FILES) {
  const absolutePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push({ relativePath, lineNumber: 0, rule: "Missing checked file", line: "" });
    continue;
  }

  const lines = fs.readFileSync(absolutePath, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
        failures.push({
          relativePath,
          lineNumber: index + 1,
          rule: rule.name,
          line: line.trim(),
        });
      }
    }
  });
}

if (failures.length) {
  console.error("Submission honesty audit failed:");
  for (const failure of failures) {
    console.error(
      `- ${failure.relativePath}:${failure.lineNumber} — ${failure.rule}` +
        (failure.line ? `\n  ${failure.line}` : "")
    );
  }
  process.exit(1);
}

console.log(`Submission honesty audit passed (${FILES.length} files, ${RULES.length} rules).`);
