#!/usr/bin/env node
/**
 * Smoke-test the OpenOcean aggregator fallback with a SMALL real swap.
 *
 * Validates, before enabling RWA_AGGREGATOR_FALLBACK_ENABLED in prod, that
 * the OpenOcean route for USDT0->WMNT (the path Merchant Moe multi-hop
 * can't fill) not only quotes but actually executes on-chain.
 *
 * SAFETY (money path):
 *   - READ-ONLY by default: prints balances + quote, moves nothing.
 *   - Broadcast requires BOTH `--broadcast` AND env `CONFIRM=YES`.
 *   - Tiny default amount (SMOKE_AMOUNT, default 1.5 USDT0).
 *   - 5s abort window before broadcast.
 *   - PRIVATE_KEY is only loaded/used on the broadcast path.
 *
 * Usage:
 *   # read-only (no funds moved, no key needed — pass SMOKE_ADDRESS to see balances):
 *   MANTLE_RPC_URL=... SMOKE_ADDRESS=0x... node scripts/smoke-test-aggregator-swap.js
 *
 *   # real swap (needs PRIVATE_KEY + MANTLE_RPC_URL in env/.env):
 *   CONFIRM=YES node scripts/smoke-test-aggregator-swap.js --broadcast
 *
 * Tunables (env): SMOKE_FROM (USDT0), SMOKE_TO (WMNT), SMOKE_AMOUNT (1.5).
 */
require("dotenv").config();
const { ethers } = require("ethers");
const { OpenOceanDEX, ADDRESSES } = require("../src/dex/openOcean");

const FROM = process.env.SMOKE_FROM || "USDT0";
const TO = process.env.SMOKE_TO || "WMNT";
const AMOUNT = Number(process.env.SMOKE_AMOUNT || "1.5");
const BROADCAST = process.argv.includes("--broadcast");
const CONFIRMED = process.env.CONFIRM === "YES";
const EXPLORER = "https://mantlescan.xyz/tx/";

function fail(msg) {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

(async () => {
  if (!ADDRESSES[FROM]) fail(`unknown FROM token "${FROM}" (not in OpenOcean ADDRESSES)`);
  if (!ADDRESSES[TO]) fail(`unknown TO token "${TO}" (not in OpenOcean ADDRESSES)`);
  if (!(AMOUNT > 0)) fail(`SMOKE_AMOUNT must be > 0 (got ${AMOUNT})`);

  const rpc = process.env.MANTLE_RPC_URL;
  if (!rpc) fail("MANTLE_RPC_URL not set (export it or copy .env into this worktree)");
  const provider = new ethers.JsonRpcProvider(rpc);

  const pk = process.env.PRIVATE_KEY;
  const wallet = pk ? new ethers.Wallet(pk, provider) : null;
  const addr = wallet?.address || process.env.SMOKE_ADDRESS || null;

  const net = await provider.getNetwork();
  console.log("=== OpenOcean aggregator smoke test ===");
  console.log(`Network : Mantle (chainId ${net.chainId})`);
  console.log(`Account : ${addr || "(none — quote only)"}`);
  console.log(`Swap    : ${AMOUNT} ${FROM} -> ${TO}`);
  console.log(`Mode    : ${BROADCAST ? "BROADCAST (real)" : "READ-ONLY"}`);

  if (Number(net.chainId) !== 5000) {
    fail(`expected Mantle mainnet chainId 5000, got ${net.chainId}`);
  }

  // --- read-only: balances ---
  const readDex = new OpenOceanDEX(provider, wallet, { dryRun: true });
  if (addr) {
    const bals = await readDex.getBalances(addr);
    console.log(`Balance : ${FROM}=${bals[FROM] ?? 0}  ${TO}=${bals[TO] ?? 0}  (MNT=${bals.MNT})`);
    if ((bals[FROM] ?? 0) < AMOUNT) {
      console.log(`⚠️  Insufficient ${FROM} for ${AMOUNT}; lower SMOKE_AMOUNT or top up before broadcasting.`);
    }
  }

  // --- read-only: quote ---
  const amountWei = ethers.parseEther(String(AMOUNT));
  const quote = await readDex.getQuote(FROM, TO, amountWei);
  console.log(
    `Quote   : viable=${quote.viable}` +
      (quote.viable
        ? `  estOut=${quote.estimatedOut} ${TO}  router=${quote.routerAddress}`
        : `  error=${quote.error}`)
  );
  if (!quote.viable) fail("aggregator quote not viable — do NOT enable the fallback flag");

  if (!BROADCAST) {
    console.log("\n✅ READ-ONLY complete. No funds moved.");
    console.log("   To execute one REAL swap:");
    console.log("   CONFIRM=YES node scripts/smoke-test-aggregator-swap.js --broadcast");
    return;
  }

  // --- broadcast gates ---
  if (!CONFIRMED) fail("--broadcast given but CONFIRM=YES not set; refusing to send. No funds moved.");
  if (!wallet) fail("PRIVATE_KEY required to broadcast");

  console.log(`\n⚠️  Broadcasting a REAL ${AMOUNT} ${FROM} -> ${TO} swap in 5s. Ctrl-C to abort.`);
  await new Promise((r) => setTimeout(r, 5000));

  const liveDex = new OpenOceanDEX(provider, wallet, { dryRun: false });
  const res = await liveDex.executeSwap(FROM, TO, amountWei);
  if (res.executed && res.txHash) {
    console.log(`\n✅ Swap executed: ${EXPLORER}${res.txHash}  (block ${res.blockNumber})`);
    const after = await readDex.getBalances(addr);
    console.log(`Balance after: ${FROM}=${after[FROM] ?? 0}  ${TO}=${after[TO] ?? 0}`);
  } else {
    fail(`swap not executed: ${res.reason || "unknown"}`);
  }
})().catch((e) => fail(e.message || String(e)));
