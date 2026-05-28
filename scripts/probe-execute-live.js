#!/usr/bin/env node
/**
 * LIVE one-shot: 5 USDT0 -> USDT via MerchantMoeDEX.executeSwap.
 *
 * Run only with explicit confirmation from user. No state files
 * written, no commit. Returns tx hash + Mantlescan link.
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { ethers } = require("ethers");
const { MerchantMoeDEX } = require("../src/dex/merchantMoe");

(async () => {
  if (!process.env.PRIVATE_KEY) {
    console.error("PRIVATE_KEY missing in .env");
    process.exit(1);
  }

  const dex = new MerchantMoeDEX({
    rpcUrl: "https://rpc.mantle.xyz",
    privateKey: process.env.PRIVATE_KEY,
    dryRun: false,
  });

  const FROM = "USDT0";
  const TO = "USDT";
  const HUMAN = "5";
  const decIn = 6; // USDT0
  const amountIn = ethers.parseUnits(HUMAN, decIn);

  console.log(`Wallet:   ${dex.wallet.address}`);
  console.log(`Swap:     ${HUMAN} ${FROM} -> ${TO}`);
  console.log(`Amount wei: ${amountIn.toString()}`);
  console.log();

  // Live quote first, so we log what we expect to receive.
  const quote = await dex.getQuote(FROM, TO, amountIn);
  console.log("Quote:");
  console.log(`  pair:        ${quote.pairAddress}`);
  console.log(`  binStep:     ${quote.binStep}`);
  console.log(`  estimatedOut: ${quote.estimatedOut} ${TO}`);
  console.log(`  fee:         ${quote.fee}%`);
  console.log(`  priceImpact: ${(quote.priceImpact * 100).toFixed(4)}%`);
  console.log(`  viable:      ${quote.viable}`);
  console.log();

  if (!quote.viable) {
    console.error("Quote not viable, aborting before broadcast.");
    process.exit(1);
  }

  console.log("Broadcasting executeSwap...");
  const t0 = Date.now();
  const result = await dex.executeSwap(FROM, TO, amountIn, {
    maxPriceImpactBps: 100, // 1%
    slippageBps: 50,        // 0.5%
  });
  const dt = Date.now() - t0;

  console.log();
  console.log("Result:");
  console.log(JSON.stringify(
    {
      executed: result.executed,
      txHash: result.txHash,
      blockNumber: result.blockNumber,
      gasUsed: result.gasUsed,
      reason: result.reason,
      estimatedOut: result.estimatedOut,
      priceImpact: result.priceImpact,
    },
    null,
    2
  ));

  if (result.executed) {
    console.log();
    console.log(`✅ DONE in ${dt}ms`);
    console.log(`   Mantlescan: https://mantlescan.xyz/tx/${result.txHash}`);
  } else {
    console.log();
    console.log(`❌ NOT EXECUTED. reason="${result.reason}"`);
    process.exit(2);
  }
})().catch((e) => {
  console.error("FATAL:", e?.message || e);
  if (e?.stack) console.error(e.stack.split("\n").slice(0, 6).join("\n"));
  process.exit(99);
});
