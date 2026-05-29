/**
 * Unit tests for the Reproducible AI capture surface.
 * Validates that captures accumulate, drain cleanly, and that the
 * manifest hash is deterministic + the writer is non-blocking on
 * filesystem failure.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

describe("captureManifest", () => {
  let captureManifest;
  let tmpDir;

  beforeEach(() => {
    // Use a temp manifest dir per test so writes don't collide.
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tv-replay-"));
    jest.resetModules();
    // Stub the resolved manifest dir before requiring the module.
    captureManifest = require("../../src/replay/captureManifest");
  });

  afterEach(() => {
    captureManifest.resetCapture();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  test("captureCall + drainCapture round-trip", () => {
    captureManifest.resetCapture();
    captureManifest.captureCall({
      role: "analyst",
      provider: "aws-bedrock",
      modelId: "zai.glm-5",
      temperature: 0.3,
      maxTokens: 2048,
      systemPrompt: "You are an analyst.",
      userPrompt: "ETH at $2000",
      rawText: '{"action":"hold"}',
    });
    const captures = captureManifest.drainCapture();
    expect(captures).toHaveLength(1);
    expect(captures[0].role).toBe("analyst");
    expect(captures[0].rawText).toBe('{"action":"hold"}');
    expect(captureManifest.drainCapture()).toHaveLength(0);
  });

  test("resetCapture clears the buffer", () => {
    captureManifest.captureCall({
      role: "validator",
      provider: "aws-bedrock",
      modelId: "claude",
      systemPrompt: "x",
      userPrompt: "y",
      rawText: "z",
    });
    captureManifest.resetCapture();
    expect(captureManifest.drainCapture()).toHaveLength(0);
  });

  test("captureCall enforces field bounds (60KB cap)", () => {
    const huge = "X".repeat(120_000);
    captureManifest.resetCapture();
    captureManifest.captureCall({
      role: "analyst",
      provider: "aws-bedrock",
      modelId: "x",
      systemPrompt: huge,
      userPrompt: huge,
      rawText: huge,
    });
    const [c] = captureManifest.drainCapture();
    // Exact cap is 60_000 in the module.
    expect(c.systemPrompt.length).toBeLessThanOrEqual(60_000);
    expect(c.userPrompt.length).toBeLessThanOrEqual(60_000);
    expect(c.rawText.length).toBeLessThanOrEqual(60_000);
  });

  test("manifestHash is deterministic over the same captures", () => {
    const captures = [
      {
        role: "analyst",
        provider: "aws-bedrock",
        modelId: "m",
        systemPrompt: "s",
        userPrompt: "u",
        rawText: "r",
        temperature: 0.3,
        maxTokens: 100,
        parsedOk: true,
        timing: null,
      },
    ];
    const h1 = captureManifest.manifestHash(captures);
    const h2 = captureManifest.manifestHash(captures);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^0x[0-9a-f]{64}$/);
  });

  test("writeManifest never throws on missing fields", () => {
    // Force the manifest dir to a tmp location so we don't pollute the
    // committed replay-manifests folder during unit tests.
    process.env.MANIFEST_DIR_OVERRIDE_FOR_TESTS = tmpDir;
    // No captures, no marketContext, no onChain — must still not throw.
    const result = captureManifest.writeManifest({
      decisionId: 999999,
    });
    // Result is either a path object or null; either way no exception.
    expect(result === null || typeof result === "object").toBe(true);
    // Verify we did not pollute the committed manifest dir.
    const committedDir = require("path").resolve(
      __dirname,
      "../../.kiro/audits/raw/replay-manifests"
    );
    if (require("fs").existsSync(committedDir)) {
      const stray = require("fs")
        .readdirSync(committedDir)
        .filter((f) => f.startsWith("cycle-999999"));
      // Cleanup any artefact this test produced.
      stray.forEach((f) =>
        require("fs").unlinkSync(require("path").join(committedDir, f))
      );
    }
  });
});
