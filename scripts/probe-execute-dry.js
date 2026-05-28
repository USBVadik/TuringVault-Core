#!/usr/bin/env node
/**
 * Drives MerchantMoeDEX.executeSwap with dryRun:true, which short-circuits
 * before signing/broadcast but still runs the full quote + impact gate.
 * Verifies that for our agent universe (USDT0/USDT, USDT/WMNT) the path
 * survives every gate.
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { ethers } = require("ethers");
const { MerchantMoeDEX } = require("../src/dex/merchantMoe");

const dex = new MerchantMoeDEX({
  rpcUrl: "https://rpc.mantle.xyz",
  dryRun: true,
});

(async () => {
  const cases = [
    ["USDT0", "USDT", "5"],
    ["USDT0", "USDT", "50"],
    ["USDT", "WMNT", "5"],
    ["USDT", "WMNT", "10"],
    ["WMNT", "USDT", "1"],
    ["WMNT", "USDT", "5"],
  ];
  console.log("FROM    -> TO     | amount  | exec? | impact% | reason or estOut");
  for (const [from, to, amt] of cases) {
    const decIn = ["USDT", "USDT0"].includes(from) ? 6 : 18;
    const amountIn = ethers.parseUnits(amt, decIn);
    try {
      const r = await dex.executeSwap(from, to, amountIn, {
        maxPriceImpactBps: 100, // 1%
        slippageBps: 50,
      });
      const ok = r.executed === true ? "yes" : (r.wouldExecute ? "would" : "no");
      const imp = r.priceImpact != null ? (r.priceImpact * 100).toFixed(4) : "?";
      const tail = r.executed
        ? `tx=${r.txHash}`
        : r.reason || `estOut=${r.estimatedOut?.toFixed(6) ?? "?"}`;
      console.log(`${from.padEnd(7)} -> ${to.padEnd(6)} | ${amt.padStart(7)} | ${ok.padEnd(5)} | ${imp.padStart(7)} | ${tail}`);
    } catch (e) {
      console.log(`${from.padEnd(7)} -> ${to.padEnd(6)} | ${amt.padStart(7)} | THREW ${e.message?.slice(0, 80)}`);
    }
  }
})();
