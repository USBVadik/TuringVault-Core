/**
 * Security regression: the replay-manifest filename must never traverse
 * out of MANIFEST_DIR, regardless of what decisionId is passed
 * (path traversal, CWE-23 — flagged by Snyk on writeManifest()).
 */
const path = require("path");
const {
  safeCycleFilename,
  _MANIFEST_DIR,
} = require("../../src/replay/captureManifest");

describe("captureManifest path-traversal hardening", () => {
  test("non-negative integer id -> zero-padded cycle filename", () => {
    expect(safeCycleFilename(42)).toBe("cycle-0042.json");
    expect(safeCycleFilename(818)).toBe("cycle-0818.json");
    expect(safeCycleFilename(0)).toBe("cycle-0000.json");
  });

  test("null/undefined id -> safe placeholder, never empty", () => {
    expect(safeCycleFilename(undefined)).toBe("cycle-000x.json");
    expect(safeCycleFilename(null)).toBe("cycle-000x.json");
  });

  test("malicious ids are stripped to digits and never escape MANIFEST_DIR", () => {
    const evilInputs = [
      "../../../etc/passwd",
      "5/../../x",
      "..%2f..%2fetc",
      "0; rm -rf /",
      "abc",
      "../",
      "/absolute/path",
      "..\\..\\windows",
    ];
    for (const evil of evilInputs) {
      const fname = safeCycleFilename(evil);
      // bare filename only — no separators, no traversal sequences
      expect(fname).toMatch(/^cycle-[0-9x]+\.json$/);
      expect(fname).not.toContain("/");
      expect(fname).not.toContain("\\");
      expect(fname).not.toContain("..");
      // resolved path stays inside MANIFEST_DIR
      const resolved = path.join(_MANIFEST_DIR, fname);
      expect(
        resolved === _MANIFEST_DIR ||
          resolved.startsWith(_MANIFEST_DIR + path.sep)
      ).toBe(true);
    }
  });
});
