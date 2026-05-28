#!/usr/bin/env node
/**
 * Dry-run probe for the new 2-leg directional swap path used by
 * multiAgentLoop Step 4.7. Exercises both directions:
 *   risk-on:  USDT0 → USDT → WMNT
 *   risk-off: WMNT  → USDT → USDT0
 * No TX, no broadcast — uses dryRun:true.
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { ethers } = require("ethers");
const { MerchantMoeDEX } = require("../src/dex/merchantMoe");

(async () => {
  const dex = new MerchantMoeDEX({
    rpcUrl: "https://rpc.mantle.xyz",
    dryRun: true,
  });

  const cases = [
    { dir: "risk-on", path: ["USDT0", "USDT", "WMNT"], srcAmount: "5", srcDec: 6 },
    { dir: "risk-off", path: ["WMNT", "USDT", "USDT0"], srcAmount: "1", srcDec: 18 },
  ];

  for (const c of cases) {
    console.log(`\n=== ${c.dir}: ${c.path.join(" → ")} ===`);
    const [a, b, cTok] = c.path;
    const amountIn = ethers.parseUnits(c.srcAmount, c.srcDec);

    const leg1 = await dex.executeSwap(a, b, amountIn, {
      maxPriceImpactBps: 100,
      slippageBps: 50,
    });
    console.log(
      `  leg1 ${a}->${b}: viable=${leg1.viable} would=${leg1.wouldExecute} estOut=${leg1.estimatedOut?.toFixed(6) ?? "?"} ${b} impact=${(leg1.priceImpact * 100).toFixed(4)}%`
    );

    if (!leg1.wouldExecute) {
      console.log("  → skipping leg2 (leg1 not viable)");
      continue;
    }

    const midDec = b === "USDT" ? 6 : 18;
    const midAmount = ethers.parseUnits(
      (leg1.estimatedOut * 0.999).toFixed(midDec),
      midDec
    );
    const leg2 = await dex.executeSwap(b, cTok, midAmount, {
      maxPriceImpactBps: 200,
      slippageBps: 50,
    });
    console.log(
      `  leg2 ${b}->${cTok}: viable=${leg2.viable} would=${leg2.wouldExecute} estOut=${leg2.estimatedOut?.toFixed(6) ?? "?"} ${cTok} impact=${(leg2.priceImpact * 100).toFixed(4)}%`
    );

    if (leg2.wouldExecute) {
      const inUsd =
        a === "WMNT"
          ? Number(c.srcAmount) * 0.65 // approx
          : Number(c.srcAmount);
      const outUsd =
        cTok === "WMNT"
          ? leg2.estimatedOut * 0.65
          : leg2.estimatedOut;
      console.log(
        `  end-to-end: ~$${inUsd.toFixed(2)} ${a} → ~$${outUsd.toFixed(2)} ${cTok} (slip+fee ≈ $${(inUsd - outUsd).toFixed(4)})`
      );
    }
  }
})().catch((e) => {
  console.error("FATAL:", e?.message || e);
  if (e?.stack) console.error(e.stack.split("\n").slice(0, 5).join("\n"));
  process.exit(1);
});
