#!/usr/bin/env node
/**
 * Chain probe: eth_getCode for every contract in deployments.json,
 * recent TX list for the agent EOA, and ValidationRegistry total.
 * Output: Markdown to stdout.
 *
 * Usage: node scripts/audit/chain-probe.js
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC = process.env.MANTLE_RPC_URL || "https://rpc.mantle.xyz";
const EOA = "0xDC783CDBfA993f3FC299460627b204E83bf4fb5a";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const deployments = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../../deployments.json"), "utf8")
  );

  console.log(`# Chain probe — ${new Date().toISOString()}`);
  console.log("");
  console.log(`RPC: \`${RPC}\``);
  const blockNumber = await provider.getBlockNumber();
  console.log(`Block height: \`${blockNumber}\``);
  console.log("");

  console.log("## Contract bytecode");
  console.log("");
  console.log("| Name | Address | Bytecode bytes | Deployed |");
  console.log("|------|---------|----------------|----------|");
  for (const [name, meta] of Object.entries(deployments.contracts)) {
    const code = await provider.getCode(meta.address);
    const bytes = code.length > 2 ? (code.length - 2) / 2 : 0;
    console.log(
      `| ${name} | \`${meta.address}\` | ${bytes} | ${meta.deployedAt} |`
    );
  }
  console.log("");

  console.log("## Agent EOA balance + recent activity");
  console.log("");
  const balance = await provider.getBalance(EOA);
  console.log(`EOA: \`${EOA}\``);
  console.log(`Native MNT balance: ${ethers.formatEther(balance)}`);
  const txCount = await provider.getTransactionCount(EOA);
  console.log(`Total TX count (nonce): ${txCount}`);
  console.log("");

  // Note: vanilla JSON-RPC doesn't expose tx history; would need
  // explorer API. Document gap.
  console.log("> Note: full TX history requires Mantlescan API.");
  console.log("> This probe only captures balance + nonce.");
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
