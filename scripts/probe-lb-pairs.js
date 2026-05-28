#!/usr/bin/env node
/**
 * READ-ONLY: confirm LB pair existence + depth for the agent's target
 * trading universe. No TX, no signing.
 *
 * Pairs to verify on Merchant Moe LB Factory:
 *   USDT0/USDT  - stable hub, screenshot shows $4.5M, fee 0.01% (binStep 1)
 *   USDT/WMNT   - "MNT-USDT" in screenshot, $1.18M, fee 0.25% (binStep 25)
 *   WMNT/WETH   - "MNT-WETH" in screenshot, $49K, fee 0.1% (binStep 10)
 *
 * Output for each pair:
 *   - all binSteps the factory returns
 *   - active bin reserves
 *   - sample $5/$10/$50 swap quotes via getQuote()
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { ethers } = require("ethers");
const { MerchantMoeDEX } = require("../src/dex/merchantMoe");

const RPC = "https://rpc.mantle.xyz";
const FACTORY = "0xa6630671775c4EA2743840F9A5016dCf2A104054";
const FACTORY_ABI = [
  "function getAllLBPairs(address tokenA, address tokenB) view returns (tuple(uint256 binStep, address LBPair, bool createdByOwner, bool ignoredForRouting)[])",
];
const PAIR_ABI = [
  "function getActiveId() view returns (uint24)",
  "function getReserves() view returns (uint128 reserveX, uint128 reserveY)",
  "function getTokenX() view returns (address)",
  "function getTokenY() view returns (address)",
];
const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

const TOKENS = {
  WMNT:  "0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8",
  USDT:  "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE",
  USDT0: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
  // WETH on Mantle (canonical bridged from L1) — verify on screenshot's "MNT-WETH"
  WETH:  "0xdEAdDEaDdEadDEadDEADDEAddEADDEAddead1111",
  mETH:  "0xcDA86A272531e8640cD7F1a92c01839911B90bb0",
};

async function tokenInfo(provider, addr) {
  const c = new ethers.Contract(addr, ERC20_ABI, provider);
  try {
    const [s, d] = await Promise.all([c.symbol(), c.decimals()]);
    return { symbol: s, decimals: Number(d) };
  } catch {
    return { symbol: "?", decimals: 18 };
  }
}

async function probePair(provider, factory, A, B) {
  const tA = await tokenInfo(provider, A);
  const tB = await tokenInfo(provider, B);
  console.log(`\n=== ${tA.symbol} / ${tB.symbol} ===`);
  console.log(`   ${A}  vs  ${B}`);
  let pairs;
  try {
    pairs = await factory.getAllLBPairs(A, B);
  } catch (e) {
    console.log(`   ❌ getAllLBPairs threw: ${e.message?.slice(0, 80)}`);
    return null;
  }
  if (!pairs || pairs.length === 0) {
    console.log("   ❌ no pairs in factory");
    return null;
  }
  console.log(`   pairs returned: ${pairs.length}`);
  let best = null;
  for (const p of pairs) {
    const ignored = p.ignoredForRouting;
    const addr = p.LBPair;
    const binStep = Number(p.binStep);
    if (addr === ethers.ZeroAddress) continue;
    const pair = new ethers.Contract(addr, PAIR_ABI, provider);
    let resX = 0n, resY = 0n, activeId = 0n, tokenXaddr = "?", tokenYaddr = "?";
    try {
      [resX, resY] = await pair.getReserves();
      activeId = await pair.getActiveId();
      tokenXaddr = await pair.getTokenX();
      tokenYaddr = await pair.getTokenY();
    } catch (e) {
      console.log(`     binStep=${binStep} addr=${addr} READ FAIL: ${e.message?.slice(0,60)}`);
      continue;
    }
    const xInfo = await tokenInfo(provider, tokenXaddr);
    const yInfo = await tokenInfo(provider, tokenYaddr);
    const xHuman = ethers.formatUnits(resX, xInfo.decimals);
    const yHuman = ethers.formatUnits(resY, yInfo.decimals);
    const flag = ignored ? "  ⛔ ignoredForRouting" : "";
    console.log(`     binStep=${String(binStep).padStart(3)} ${addr}  X(${xInfo.symbol})=${Number(xHuman).toFixed(3)}  Y(${yInfo.symbol})=${Number(yHuman).toFixed(3)}  activeId=${activeId}${flag}`);
    if (!ignored && (!best || Number(xHuman) + Number(yHuman) > best._totalUsd)) {
      best = { binStep, addr, _totalUsd: Number(xHuman) + Number(yHuman), tokenX: xInfo.symbol, tokenY: yInfo.symbol };
    }
  }
  return best;
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const factory = new ethers.Contract(FACTORY, FACTORY_ABI, provider);

  console.log("Probing LB Factory for agent universe pairs...");

  const pairsToCheck = [
    [TOKENS.USDT0, TOKENS.USDT,  "USDT0/USDT  (stable hub)"],
    [TOKENS.USDT,  TOKENS.WMNT,  "USDT/WMNT   (risk on/off)"],
    [TOKENS.WMNT,  TOKENS.WETH,  "WMNT/WETH   (to ETH)"],
    [TOKENS.WETH,  TOKENS.mETH,  "WETH/mETH   (to mETH)"],
    [TOKENS.WMNT,  TOKENS.mETH,  "WMNT/mETH   (direct?)"],
  ];

  for (const [A, B, label] of pairsToCheck) {
    console.log(`\n--- ${label} ---`);
    await probePair(provider, factory, A, B);
  }

  // Now use our own MerchantMoeDEX.getQuote() against three sizes for stable hub
  console.log("\n\n=== getQuote() through our merchantMoe.js ===");
  const dex = new MerchantMoeDEX({ rpcUrl: RPC, dryRun: true });
  const tries = [
    ["USDT0", "USDT", "5"],
    ["USDT0", "USDT", "10"],
    ["USDT0", "USDT", "50"],
    ["USDT", "WMNT", "5"],
    ["USDT", "WMNT", "10"],
  ];
  console.log("FROM    -> TO     | amount  | viable | impact% | estOut");
  for (const [from, to, amt] of tries) {
    const decIn = ["USDT", "USDT0"].includes(from) ? 6 : 18;
    const amountIn = ethers.parseUnits(amt, decIn);
    try {
      const q = await dex.getQuote(from, to, amountIn);
      const v = q.viable ? "yes" : "no";
      const i = q.priceImpact != null ? (q.priceImpact * 100).toFixed(4) : "?";
      const o = q.estimatedOut != null ? Number(q.estimatedOut).toFixed(6) : "?";
      const err = q.error ? `  err=${q.error.slice(0, 40)}` : "";
      console.log(`${from.padEnd(7)} -> ${to.padEnd(6)} | ${amt.padStart(7)} | ${v.padEnd(6)} | ${i.padStart(7)} | ${o}${err}`);
    } catch (e) {
      console.log(`${from.padEnd(7)} -> ${to.padEnd(6)} | ${amt.padStart(7)} | THREW ${e.message?.slice(0, 60)}`);
    }
  }
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  console.error(e.stack?.split("\n").slice(0, 6).join("\n"));
  process.exit(1);
});
