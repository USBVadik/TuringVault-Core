/**
 * TuringVault RWA Module — USDT0 (LayerZero omnichain Tether)
 *
 * USDT0 is bridge-wrapped USDT distributed by LayerZero across chains.
 * The underlying collateral is the same as native USDT — short-term
 * US Treasury bills + cash equivalents — held by Tether Limited.
 *
 * IMPORTANT: USDT0 is NOT a yield-bearing token. It targets a 1:1 USD
 * peg and accrues no APY on its own. Any frontend / prompt copy MUST
 * NOT claim a yield on USDT0 (rwa-allocation-active R6, no-lying-about-state).
 *
 * Mantle Mainnet:
 *   - Token: 0x779Ded0c9e1022225f8E0630b35a9b54bE713736
 *   - Active swap pair: USDT/USDT0 (binStep=1) on Merchant Moe LB
 *
 * This module mirrors the shape of usdyModule.js so callers can swap
 * the implementation when more RWA targets come online.
 *
 * Spec: rwa-allocation-active (R1, design §C1).
 */

require("dotenv").config({
  path: require("path").resolve(__dirname, "../../.env"),
});
const { ethers } = require("ethers");

const USDT0_ADDRESS = "0x779Ded0c9e1022225f8E0630b35a9b54bE713736";

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function totalSupply() view returns (uint256)",
];

class USDT0Module {
  constructor(options = {}) {
    this.provider = new ethers.JsonRpcProvider(
      options.rpcUrl || "https://rpc.mantle.xyz"
    );
    this.wallet = options.privateKey
      ? new ethers.Wallet(options.privateKey, this.provider)
      : null;

    // Static metadata — surfaced honestly to UI / prompts.
    this.assetClass = "rwa-treasury";
    this.issuer = "Tether (via LayerZero omnichain wrap)";
    this.underlying = "US Treasury Bills + cash equivalents";
    this.currentAPY = 0; // USDT0 itself yields nothing
    this.liquidityRoute = "USDT/USDT0 binStep=1 on Merchant Moe LB";

    this.token = new ethers.Contract(USDT0_ADDRESS, ERC20_ABI, this.provider);
  }

  /**
   * Get current USDT0 position for an address.
   * @param {string} [address] — defaults to this.wallet.address
   * @returns {Promise<object>}
   */
  async getPosition(address) {
    const addr = address || this.wallet?.address;
    if (!addr)
      throw new Error(
        "USDT0Module.getPosition: no address (pass arg or construct with privateKey)"
      );

    const [balance, decimals, totalSupply] = await Promise.all([
      this.token.balanceOf(addr),
      this.token.decimals(),
      this.token.totalSupply(),
    ]);

    const balanceFloat = parseFloat(ethers.formatUnits(balance, decimals));
    const totalSupplyFloat = parseFloat(
      ethers.formatUnits(totalSupply, decimals)
    );

    return {
      token: "USDT0",
      address: USDT0_ADDRESS,
      balance: balanceFloat,
      decimals: Number(decimals),
      totalSupply: totalSupplyFloat,
      poolShare:
        totalSupplyFloat > 0 ? (balanceFloat / totalSupplyFloat) * 100 : 0,
      apy: this.currentAPY, // 0
      underlying: this.underlying,
      issuer: this.issuer,
      assetClass: this.assetClass,
    };
  }

  /**
   * Generate a USDT0 context block for inclusion in the AI prompt.
   * @param {string} [address]
   * @returns {Promise<object>}
   */
  async getContextForAI(address) {
    const position = await this.getPosition(address);
    return {
      asset: "USDT0",
      address: USDT0_ADDRESS,
      assetClass: this.assetClass,
      issuer: this.issuer,
      underlying: this.underlying,
      // Honest no-yield framing (rwa-allocation-active Q6).
      yield: "none — USDT0 targets a 1:1 USD peg, accrues no APY on its own",
      liquidity: this.liquidityRoute,
      currentBalance: position.balance,
    };
  }
}

module.exports = { USDT0Module, USDT0_ADDRESS };

// Self-test if invoked directly.
if (require.main === module) {
  (async () => {
    console.log("═══ USDT0 Module (LayerZero Tether) ═══\n");
    const mod = new USDT0Module({ privateKey: process.env.PRIVATE_KEY });
    if (mod.wallet) {
      const pos = await mod.getPosition();
      console.log(`USDT0 balance:     ${pos.balance.toFixed(6)} USDT0`);
      console.log(`Total supply:      ${(pos.totalSupply / 1e6).toFixed(2)}M`);
      console.log(`Pool share:        ${pos.poolShare.toFixed(8)}%`);
      console.log(`APY:               ${pos.apy} (USDT0 is not yield-bearing)`);
      console.log(`Underlying:        ${pos.underlying}`);
      console.log(`Liquidity route:   ${mod.liquidityRoute}`);
    } else {
      console.log("No PRIVATE_KEY set — skipping live read.");
    }
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
