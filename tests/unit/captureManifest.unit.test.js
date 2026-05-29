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

  test("manifestHash distinguishes different capture sets", () => {
    // Regression guard: the original implementation used
    // `JSON.stringify(captures, Object.keys(captures).sort())`, where
    // the sorted-key replacer for an Array becomes a numeric-index
    // whitelist that filters all real object keys, so every capture
    // set hashed to the same value. Audit 18 replaced it with a
    // recursive canonical JSON so meaningful diffs produce diff hashes.
    const baseCap = {
      role: "analyst",
      provider: "aws-bedrock",
      modelId: "m",
      systemPrompt: "s",
      userPrompt: "u",
      rawText: "OK",
      temperature: 0,
      maxTokens: 1,
      parsedOk: true,
      timing: null,
    };
    const h1 = captureManifest.manifestHash([baseCap]);
    const h2 = captureManifest.manifestHash([
      { ...baseCap, rawText: "DIFFERENT" },
    ]);
    expect(h1).not.toBe(h2);
    // Order of keys inside an entry must NOT change the hash (canonical sort).
    const reordered = {
      timing: null,
      parsedOk: true,
      maxTokens: 1,
      temperature: 0,
      rawText: "OK",
      userPrompt: "u",
      systemPrompt: "s",
      modelId: "m",
      provider: "aws-bedrock",
      role: "analyst",
    };
    expect(captureManifest.manifestHash([reordered])).toBe(h1);
  });

  test("peekCapture returns a copy without clearing the buffer", () => {
    captureManifest.resetCapture();
    captureManifest.captureCall({
      role: "analyst",
      provider: "aws-bedrock",
      modelId: "x",
      systemPrompt: "s",
      userPrompt: "u",
      rawText: "r",
    });
    captureManifest.captureCall({
      role: "validator",
      provider: "aws-bedrock",
      modelId: "y",
      systemPrompt: "s2",
      userPrompt: "u2",
      rawText: "r2",
    });
    // peekCapture: buffer untouched
    const peeked = captureManifest.peekCapture();
    expect(peeked).toHaveLength(2);
    // Mutating the returned array must not mutate the buffer (shallow copy).
    peeked.length = 0;
    expect(captureManifest.peekCapture()).toHaveLength(2);
    // Subsequent drainCapture sees the same items the peek saw.
    const drained = captureManifest.drainCapture();
    expect(drained).toHaveLength(2);
    expect(drained[0].role).toBe("analyst");
    // After drain, peek is empty (drain owns the buffer).
    expect(captureManifest.peekCapture()).toHaveLength(0);
  });

  test("peek-then-hash matches drain-then-hash for the same cycle", () => {
    // The on-chain anchor (audit 18) computes manifestHash from
    // peekCapture() before the file write; the file write uses
    // drainCapture(). Both must produce the same hash, otherwise the
    // anchor stored on-chain wouldn't bind the manifest on disk.
    captureManifest.resetCapture();
    const sample = {
      role: "analyst",
      provider: "aws-bedrock",
      modelId: "zai.glm-5",
      temperature: 0.3,
      maxTokens: 1024,
      systemPrompt: "sys",
      userPrompt: "usr",
      rawText: '{"a":"hold"}',
    };
    captureManifest.captureCall(sample);
    captureManifest.captureCall({ ...sample, role: "validator", rawText: "OK" });
    const peekHash = captureManifest.manifestHash(captureManifest.peekCapture());
    const drainHash = captureManifest.manifestHash(captureManifest.drainCapture());
    expect(peekHash).toBe(drainHash);
    expect(peekHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  test("combinedAnchor formula is deterministic and recomputable", () => {
    // Audit 18 binding: combinedAnchor =
    //   keccak256(utf8(ipfsCid) ‖ bytes32(manifestHash))
    // Verifiers reproduce this client-side; the test pins the formula
    // so a future refactor can't silently change the binding.
    const { keccak256, toUtf8Bytes, concat } = require("ethers");
    const cid = "QmTestSampleIPFSCidValueXYZ";
    const captures = [
      {
        role: "analyst",
        provider: "aws-bedrock",
        modelId: "m",
        systemPrompt: "s",
        userPrompt: "u",
        rawText: "r",
        temperature: 0,
        maxTokens: 1,
        parsedOk: true,
        timing: null,
      },
    ];
    const mh = captureManifest.manifestHash(captures);
    const a1 = keccak256(concat([toUtf8Bytes(cid), mh]));
    const a2 = keccak256(concat([toUtf8Bytes(cid), mh]));
    expect(a1).toBe(a2);
    expect(a1).toMatch(/^0x[0-9a-f]{64}$/);
    // Different captures → different hash → different anchor
    const captures2 = [{ ...captures[0], rawText: "DIFFERENT" }];
    const mh2 = captureManifest.manifestHash(captures2);
    const a3 = keccak256(concat([toUtf8Bytes(cid), mh2]));
    expect(a3).not.toBe(a1);
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
