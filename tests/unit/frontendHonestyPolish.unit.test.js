const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "../..");

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

describe("frontend honesty + polish guardrails", () => {
  test("home and terminal liveness surfaces use the shared live-status rules", () => {
    const page = read("frontend/app/page.tsx");
    const terminal = read("frontend/app/components/LiveTerminal.tsx");

    expect(page).toMatch(/deriveLiveStatus/);
    expect(page).not.toMatch(/STALE_THRESHOLD_S/);
    expect(terminal).toMatch(/deriveLiveStatus/);
    expect(terminal).not.toMatch(/function deriveLiveState/);
    expect(terminal).not.toMatch(/lastCycleAge\s*<\s*3600/);
  });

  test("LiveStatusBadge syncs late-arriving initial health", () => {
    const badge = read("frontend/app/components/LiveStatusBadge.tsx");

    expect(badge).toMatch(
      /if\s*\(initialHealth\)\s*{\s*setHealth\(initialHealth\);/s
    );
  });

  test("home ETH price formatting is locale-stable", () => {
    const page = read("frontend/app/page.tsx");

    expect(page).not.toMatch(/ethPrice\.toLocaleString\(\)/);
    expect(page.match(/ethPrice\.toLocaleString\("en-US"/g) || []).toHaveLength(
      2
    );
  });

  test("global interaction CSS avoids transition-all and pins numeric rhythm", () => {
    const globals = read("frontend/app/globals.css");
    const proofAnimations = read("frontend/app/proof-explorer/animations.css");

    expect(globals).not.toMatch(/transition:\s*all\b/);
    expect(proofAnimations).not.toMatch(/transition:\s*all\b/);
    expect(globals).toMatch(
      /\.ops-metric-main[\s\S]*font-variant-numeric:\s*tabular-nums/
    );
    expect(globals).toMatch(
      /\.ops-split-row strong[\s\S]*font-variant-numeric:\s*tabular-nums/
    );
    expect(globals).toMatch(
      /\.signal-channel-readout strong[\s\S]*font-variant-numeric:\s*tabular-nums/
    );
  });
});
