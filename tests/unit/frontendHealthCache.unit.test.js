const fs = require("fs");
const path = require("path");

describe("frontend /api/health cache policy", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const source = fs.readFileSync(
    path.join(repoRoot, "frontend/app/api/health/route.ts"),
    "utf8"
  );

  test("uses short SWR instead of forcing every health request through Fluid CPU", () => {
    expect(source).not.toContain('export const fetchCache = "force-no-store";');
    expect(source).not.toContain("export const revalidate = 0;");
    expect(source).toContain("export const revalidate = 30;");
    expect(source).toContain('"Cache-Control": "public, s-maxage=120, stale-while-revalidate=300"');
    expect(source).toContain('"X-Cache-Mode": "swr"');
  });

  test("does not bust GitHub raw CDN cache for every dashboard liveness poll", () => {
    expect(source).not.toMatch(/\?t=\$\{Date\.now\(\)\}/);
    expect(source).not.toContain("cache: \"no-store\"");
    expect(source).toContain("next: { revalidate: 30 }");
  });
});

describe("frontend /api/health warm-function reuse", () => {
  const {
    cloneHealthWithFreshAge,
  } = require("../../frontend/app/api/health/health-cache.shared.js");

  test("recomputes lastCycleAge when reusing a cached health payload", () => {
    const nowMs = Date.parse("2026-06-14T12:05:00.000Z");
    const cached = {
      status: "ok",
      lastCycleTimestamp: "2026-06-14T12:00:00.000Z",
      lastCycleAge: 1,
      cyclesSucceeded24h: 20,
      cyclesFailed24h: 0,
      mode: "cron-github-actions",
      chainBlockHeight: 123,
      dataScope: "agent-lifetime",
      gasRunway: null,
    };

    expect(cloneHealthWithFreshAge(cached, nowMs)).toMatchObject({
      lastCycleTimestamp: "2026-06-14T12:00:00.000Z",
      lastCycleAge: 300,
      cyclesSucceeded24h: 20,
      mode: "cron-github-actions",
    });
  });
});

describe("frontend polling budget", () => {
  test("expensive live dashboard routes are not polled every 30 seconds", () => {
    const repoRoot = path.resolve(__dirname, "../..");
    const home = fs.readFileSync(
      path.join(repoRoot, "frontend/app/page.tsx"),
      "utf8"
    );
    const terminal = fs.readFileSync(
      path.join(repoRoot, "frontend/app/components/LiveTerminal.tsx"),
      "utf8"
    );
    const badge = fs.readFileSync(
      path.join(repoRoot, "frontend/app/components/LiveStatusBadge.tsx"),
      "utf8"
    );

    expect(home).not.toContain("setInterval(fetchChainData, 30000)");
    expect(home).not.toContain("setInterval(fetchMarket, 30000)");
    expect(terminal).not.toContain("setInterval(fetchAll, 30_000)");
    expect(badge).not.toContain("setInterval(poll, 30_000)");
  });

  test("dashboard live widgets do not force cache bypass on health or decisions", () => {
    const repoRoot = path.resolve(__dirname, "../..");
    const files = [
      "frontend/app/page.tsx",
      "frontend/app/components/LiveTerminal.tsx",
      "frontend/app/components/LiveStatusBadge.tsx",
      "frontend/app/components/RiskMascot.tsx",
    ];

    for (const file of files) {
      const source = fs.readFileSync(path.join(repoRoot, file), "utf8");
      expect(source).not.toContain('cache: "no-store"');
      expect(source).not.toContain("cache: 'no-store'");
    }
  });

  test("dashboard polling skips network work while the tab is hidden", () => {
    const { shouldRunDashboardPoll } = require("../../frontend/app/lib/polling.shared.js");

    expect(shouldRunDashboardPoll({ visibilityState: "hidden" })).toBe(false);
    expect(shouldRunDashboardPoll({ visibilityState: "visible" })).toBe(true);
    expect(shouldRunDashboardPoll(undefined)).toBe(true);
  });
});
