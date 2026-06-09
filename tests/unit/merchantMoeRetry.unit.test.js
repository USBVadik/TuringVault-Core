const { _private } = require("../../src/dex/merchantMoe");

describe("MerchantMoeDEX read retry", () => {
  test("retries transient eth_call failures before returning a quote read", async () => {
    const calls = [];
    const result = await _private.retryReadCall(
      "pair.getTokenX",
      async () => {
        calls.push(Date.now());
        if (calls.length < 3) {
          const err = new Error("missing revert data");
          err.code = "CALL_EXCEPTION";
          throw err;
        }
        return "ok";
      },
      { attempts: 3, baseDelayMs: 0 }
    );

    expect(result).toBe("ok");
    expect(calls).toHaveLength(3);
  });

  test("does not retry deterministic non-RPC failures", async () => {
    const calls = [];

    await expect(
      _private.retryReadCall(
        "token.decimals",
        async () => {
          calls.push(Date.now());
          throw new Error("bad token symbol");
        },
        { attempts: 3, baseDelayMs: 0 }
      )
    ).rejects.toThrow(/bad token symbol/);

    expect(calls).toHaveLength(1);
  });
});
