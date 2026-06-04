const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const PUBLIC_DOCS = [
  "README.md",
  "docs/dorahacks-submission-v2.md",
  "docs/DORAHACKS_SUBMISSION.md",
  "docs/SUBMISSION.md",
];

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

describe("public metric copy honesty", () => {
  test.each(PUBLIC_DOCS)("%s does not label outcome score as realised wallet PnL", (file) => {
    const text = read(file);

    expect(text).not.toMatch(/live reali[sz]ed pnl/i);
    expect(text).not.toMatch(/reali[sz]ed pnl\s+\+\d+/i);
    expect(text).not.toMatch(/equity curve built cycle-by-cycle from on-chain settled PnL/i);
  });

  test.each(PUBLIC_DOCS)("%s discloses outcome-score methodology when performance is mentioned", (file) => {
    const text = read(file);

    if (/outcome score|decision-quality|cumulativePnlBps|performance/i.test(text)) {
      expect(text).toMatch(
        /not (?:reali[sz]ed )?wallet PnL|realizedTradingPnlBps[`'"\s\w/.:()-]*null/i
      );
    }
  });

  test.each(PUBLIC_DOCS)("%s does not carry stale May validation counters", (file) => {
    const text = read(file);

    expect(text).not.toMatch(/158\+|158 total/i);
    expect(text).not.toMatch(/167\+|167 on-chain|65\s*\/\s*167/i);
    expect(text).not.toMatch(/104\+ decisions|102\+ on-chain|64\/104/i);
    expect(text).not.toMatch(/38\.9%/i);
    expect(text).not.toMatch(/65 rejected\s*\/\s*158 total\s*=\s*41%/i);
    expect(text).not.toMatch(/96\.4% uptime|27\/28/i);
  });
});
