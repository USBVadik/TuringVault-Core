const { assertResolvableIpfsPin } = require("../../src/ipfs/pinResultGuard");

describe("IPFS pin result guard", () => {
  test("accepts a resolvable Pinata pin", () => {
    const result = {
      cid: "QmRealAgentCardCid",
      uri: "ipfs://QmRealAgentCardCid",
      gateway: "https://gateway.pinata.cloud/ipfs/QmRealAgentCardCid",
    };

    expect(assertResolvableIpfsPin(result, "Agent Card")).toBe(result);
  });

  test("rejects local-anchor fallback before tokenURI updates", () => {
    expect(() =>
      assertResolvableIpfsPin(
        {
          cid: "bafkreifake",
          uri: "ipfs://bafkreifake",
          gateway: null,
          degraded: true,
          storage: "local-anchor",
          reason: "PINATA_UPLOAD_MODE=anchor-only",
        },
        "Agent Card"
      )
    ).toThrow(/refusing to update tokenURI/i);
  });
});
