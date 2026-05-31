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
