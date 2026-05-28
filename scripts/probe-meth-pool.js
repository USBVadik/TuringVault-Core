#!/usr/bin/env node
/**
 * READ-ONLY probe: confirm mETH/WMNT pool on MerchantMoe is real and
 * deep enough for a $50 swap. No signing, no broadcast.
 */
require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});
const { ethers } = require("ethers");
const { MerchantMoeDEX } = require("../src/dex/merchantMoe");

(async () => {
  const dex = new MerchantMoeDEX({
    rpcUrl: "https://rpc.mantle.xyz",
    dryRun: true,
  });

  console.log("--- WMNT → mETH quote (1 WMNT) ---");
  try {
    const q = await dex.getQuote(
      "WMNT",
      "mETH",
      ethers.parseUnits("1", 18)
    );
    console.log(`  estimatedOut: ${q.estimatedOut?.toFixed(8)} mETH`);
    console.log(`  priceImpact:  ${q.priceImpactBps} bps`);
    console.log(`  pair binStep: ${q.binStep}`);
  } catch (e) {
    console.log(`  ❌ ${e.message}`);
  }

  console.log("\n--- WMNT → mETH quote (50 WMNT, ~$32) ---");
  try {
    const q = await dex.getQuote(
      "WMNT",
      "mETH",
      ethers.parseUnits("50", 18)
    );
    console.log(`  estimatedOut: ${q.estimatedOut?.toFixed(8)} mETH`);
    console.log(`  priceImpact:  ${q.priceImpactBps} bps`);
  } catch (e) {
    console.log(`  ❌ ${e.message}`);
  }

  console.log("\n--- mETH → WMNT quote (0.01 mETH, ~$20) ---");
  try {
    const q = await dex.getQuote(
      "mETH",
      "WMNT",
      ethers.parseUnits("0.01", 18)
    );
    console.log(`  estimatedOut: ${q.estimatedOut?.toFixed(4)} WMNT`);
    console.log(`  priceImpact:  ${q.priceImpactBps} bps`);
  } catch (e) {
    console.log(`  ❌ ${e.message}`);
  }
})();
