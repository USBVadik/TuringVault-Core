const EventEmitter = require("events");

describe("IPFS storage fallback policy", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    delete process.env.PINATA_JWT;
    delete process.env.PINATA_UPLOAD_MODE;
    delete process.env.PINATA_STRICT;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test("returns a deterministic local anchor when Pinata credentials are absent", async () => {
    const { pinJSON } = require("../../src/ipfs/storage");

    const a = await pinJSON({ ok: true }, "same-proof");
    const b = await pinJSON({ ok: true }, "same-proof");

    expect(a.cid).toBe(b.cid);
    expect(a.uri).toBe(`ipfs://${a.cid}`);
    expect(a.degraded).toBe(true);
    expect(a.storage).toBe("local-anchor");
  });

  test("default mode skips Pinata even when a JWT is configured", async () => {
    process.env.PINATA_JWT = "test-token";
    jest.doMock("https", () => ({
      request: jest.fn(() => {
        throw new Error("Pinata should not be called");
      }),
    }));

    const { pinJSON } = require("../../src/ipfs/storage");
    const result = await pinJSON({ ok: true }, "default-anchor-proof");

    expect(result.degraded).toBe(true);
    expect(result.storage).toBe("local-anchor");
    expect(result.reason).toContain("anchor-only");
  });

  test("Pinata plan-limit errors fall back instead of breaking the cycle", async () => {
    process.env.PINATA_JWT = "test-token";
    process.env.PINATA_UPLOAD_MODE = "pinata";
    jest.doMock("https", () => ({
      request: jest.fn((_options, cb) => {
        const res = new EventEmitter();
        res.statusCode = 429;
        process.nextTick(() => {
          cb(res);
          res.emit("data", JSON.stringify({ error: "plan limit exceeded" }));
          res.emit("end");
        });
        return {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn(),
        };
      }),
    }));

    const { pinJSON } = require("../../src/ipfs/storage");
    const result = await pinJSON({ ok: true }, "limit-proof");

    expect(result.degraded).toBe(true);
    expect(result.storage).toBe("local-anchor");
    expect(result.reason).toContain("Pinata error");
  });

  test("uploads only when pinata mode is explicitly selected", async () => {
    process.env.PINATA_JWT = "test-token";
    process.env.PINATA_UPLOAD_MODE = "pinata";
    const request = jest.fn((_options, cb) => {
      const res = new EventEmitter();
      process.nextTick(() => {
        cb(res);
        res.emit("data", JSON.stringify({ IpfsHash: "QmPinnedProof" }));
        res.emit("end");
      });
      return {
        on: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
      };
    });
    jest.doMock("https", () => ({ request }));

    const { pinJSON } = require("../../src/ipfs/storage");
    const result = await pinJSON({ ok: true }, "explicit-pinata-proof");

    expect(request).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      cid: "QmPinnedProof",
      storage: "pinata",
    });
    expect(result.degraded).toBeUndefined();
  });

  test("strict mode still rejects Pinata errors", async () => {
    process.env.PINATA_JWT = "test-token";
    process.env.PINATA_UPLOAD_MODE = "pinata";
    process.env.PINATA_STRICT = "true";
    jest.doMock("https", () => ({
      request: jest.fn((_options, cb) => {
        const res = new EventEmitter();
        res.statusCode = 429;
        process.nextTick(() => {
          cb(res);
          res.emit("data", JSON.stringify({ error: "plan limit exceeded" }));
          res.emit("end");
        });
        return {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn(),
        };
      }),
    }));

    const { pinJSON } = require("../../src/ipfs/storage");

    await expect(pinJSON({ ok: true }, "strict-proof")).rejects.toThrow(
      /Pinata error/
    );
  });
});
