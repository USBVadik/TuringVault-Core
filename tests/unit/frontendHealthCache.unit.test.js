const fs = require("fs");
const path = require("path");

describe("frontend /api/health cache policy", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const source = fs.readFileSync(
    path.join(repoRoot, "frontend/app/api/health/route.ts"),
    "utf8"
  );

  test("does not allow Vercel edge cache to serve stale liveness", () => {
    expect(source).toContain('export const fetchCache = "force-no-store";');
    expect(source).toContain("export const revalidate = 0;");
    expect(source).toContain('"Cache-Control": "no-store, max-age=0, must-revalidate"');
    expect(source).not.toMatch(/s-maxage|stale-while-revalidate/);
  });

  test("bypasses GitHub raw CDN cache for live agent files", () => {
    expect(source).toContain("cache: \"no-store\"");
    expect(source).toContain("Date.now()");
    expect(source).toMatch(/\?t=\$\{Date\.now\(\)\}/);
    expect(source).not.toContain("next: { revalidate: 30 }");
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
});
