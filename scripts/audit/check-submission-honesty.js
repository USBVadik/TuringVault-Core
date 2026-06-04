#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

const FILES = [
  "README.md",
  "docs/DORAHACKS_SUBMISSION.md",
  "docs/SUBMISSION.md",
  "docs/dorahacks-submission-v2.md",
  "docs/submission-final-copy.md",
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
