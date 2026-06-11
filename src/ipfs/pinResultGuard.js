function assertResolvableIpfsPin(result, label = "IPFS pin") {
  const cid = typeof result?.cid === "string" ? result.cid : "";
  const uri = typeof result?.uri === "string" ? result.uri : "";
  const gateway = typeof result?.gateway === "string" ? result.gateway : "";

  if (!cid || !uri || !gateway || result?.degraded) {
    const reason = result?.reason || result?.storage || "unknown pin failure";
    throw new Error(
      `${label} did not produce a resolvable IPFS pin (${reason}); refusing to update tokenURI`
    );
  }

  return result;
}

module.exports = { assertResolvableIpfsPin };
