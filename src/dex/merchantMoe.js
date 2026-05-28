/**
 * TuringVault DEX Module — Merchant Moe LB Router (Mantle Mainnet)
 *
 * Concentrated liquidity swap simulation + execution via Liquidity Book.
 * Supports: mETH, USDY, WMNT, mUSD, USDT pairs on Merchant Moe.
 *
 * Architecture:
 *   AI Decision → simulateSwap() → Pre-Action Check → executeSwap()
 *                                                   ↓
 *                                              on-chain via Router
 */

require("dotenv").config({
  path: require("path").resolve(__dirname, "../../.env"),
});
const { ethers } = require("ethers");

// Mantle Mainnet addresses
const ADDRESSES = {
  LB_ROUTER: "0x013e138EF6008ae5FDFDE29700e3f2Bc61d21E3a",
  LB_FACTORY: "0xa6630671775c4EA2743840F9A5016dCf2A104054",
  WMNT: "0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8",
  mETH: "0xcDA86A272531e8640cD7F1a92c01839911B90bb0",
  USDY: "0x5bE26527e817998A7206475496fDE1E68957c5A6",
  mUSD: "0xab575258d37EaA5C8956EfABe71F4eE8F6397cF3",
  USDT: "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE",
  // LayerZero-bridged Tether — primary RWA target on Mantle (rwa-allocation-active).
  USDT0: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
};

// LB Pair info (binStep determines tick spacing for concentrated liquidity)
const PAIRS = {
  "WMNT/USDT": { binStep: 20, version: 2 },
  "mETH/WMNT": { binStep: 25, version: 2 },
  "USDY/USDT": { binStep: 1, version: 2 }, // Stable pair
  "mUSD/USDT": { binStep: 1, version: 2 }, // Stable pair
  "WMNT/mUSD": { binStep: 15, version: 2 },
};

// Minimal ABIs
const LB_ROUTER_ABI = [
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, tuple(uint256[] pairBinSteps, uint8[] versions, address[] tokenPath) path, address to, uint256 deadline) external returns (uint256 amountOut)",
  "function swapExactTokensForNATIVE(uint256 amountIn, uint256 amountOutMin, tuple(uint256[] pairBinSteps, uint8[] versions, address[] tokenPath) path, address payable to, uint256 deadline) external returns (uint256 amountOut)",
  "function swapExactNATIVEForTokens(uint256 amountOutMin, tuple(uint256[] pairBinSteps, uint8[] versions, address[] tokenPath) path, address to, uint256 deadline) external payable returns (uint256 amountOut)",
  "function getSwapOut(address pair, uint128 amountIn, bool swapForY) view returns (uint128 amountInLeft, uint128 amountOut, uint128 fee)",
];

const LB_FACTORY_ABI = [
  "function getLBPairInformation(address tokenA, address tokenB, uint256 binStep) view returns (tuple(uint256 binStep, address LBPair, bool createdByOwner, bool ignoredForRouting))",
  "function getAllLBPairs(address tokenA, address tokenB) view returns (tuple(uint256 binStep, address LBPair, bool createdByOwner, bool ignoredForRouting)[])",
];

const LB_PAIR_ABI = [
  "function getActiveId() view returns (uint24)",
  "function getBin(uint24 id) view returns (uint128 binReserveX, uint128 binReserveY)",
  "function getReserves() view returns (uint128 reserveX, uint128 reserveY)",
  "function getTokenX() view returns (address)",
  "function getTokenY() view returns (address)",
  "function totalSupply(uint256 id) view returns (uint256)",
  "function getOracleParameters() view returns (uint8 sampleLifetime, uint16 size, uint16 activeSize, uint40 lastUpdated, uint40 firstTimestamp)",
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

class MerchantMoeDEX {
  constructor(options = {}) {
    this.provider = new ethers.JsonRpcProvider(
      options.rpcUrl || "https://rpc.mantle.xyz"
    );
    this.wallet = options.privateKey
      ? new ethers.Wallet(options.privateKey, this.provider)
      : null;
    this.dryRun = options.dryRun !== false; // default: simulation only
    this.maxSlippageBps = options.maxSlippageBps || 100; // 1%

    this.router = new ethers.Contract(
      ADDRESSES.LB_ROUTER,
      LB_ROUTER_ABI,
      this.wallet || this.provider
    );
    this.factory = new ethers.Contract(
      ADDRESSES.LB_FACTORY,
      LB_FACTORY_ABI,
      this.provider
    );
  }

  /**
   * Find the best LB pair for a token pair.
   *
   * Strategy: pick the pair with the deepest active liquidity, not the
   * lowest binStep. The factory may return multiple binSteps for the
   * same token pair, where the canonical-deep pool is on a higher
   * binStep (e.g. USDT/WMNT lives on binStep=25 with $1.18M, while
   * binStep=15 has only $1.3K). Sorting by binStep silently routes
   * trades through the shallow pool, which then trips the >10% price
   * impact gate and blocks every realistic swap.
   *
   * We probe each non-ignored pair's reserves and rank by aggregated
   * reserve magnitude. Single RPC roundtrip per candidate pair; pairs
   * with both reserves zero are dropped.
   */
  async findPair(tokenA, tokenB) {
    try {
      const pairs = await this.factory.getAllLBPairs(tokenA, tokenB);
      if (!pairs || pairs.length === 0) return null;

      const candidates = [...pairs].filter(
        (p) => !p.ignoredForRouting && p.LBPair !== ethers.ZeroAddress
      );
      if (candidates.length === 0) return null;
      if (candidates.length === 1) return candidates[0];

      // Probe reserves for each candidate. We don't need exact USD
      // valuation — just a relative ranking. reserveX + reserveY in
      // raw units is a good enough proxy because both tokens in a
      // sane pair are within an order of magnitude of each other in
      // 18-dec terms (or 6-dec, identically).
      const PAIR_RES_ABI = [
        "function getReserves() view returns (uint128 reserveX, uint128 reserveY)",
      ];
      const ranked = await Promise.all(
        candidates.map(async (p) => {
          try {
            const c = new ethers.Contract(p.LBPair, PAIR_RES_ABI, this.provider);
            const [rX, rY] = await c.getReserves();
            const depth = rX + rY; // BigInt
            return { pair: p, depth };
          } catch {
            return { pair: p, depth: 0n };
          }
        })
      );
      ranked.sort((a, b) => (b.depth > a.depth ? 1 : b.depth < a.depth ? -1 : 0));
      const best = ranked[0];
      if (best.depth === 0n) return null;
      return best.pair;
    } catch {
      return null;
    }
  }

  /**
   * Get quote for a swap (simulation)
   * Returns expected output amount and price impact
   */
  async getQuote(tokenIn, tokenOut, amountIn) {
    const tokenInAddr = ADDRESSES[tokenIn] || tokenIn;
    const tokenOutAddr = ADDRESSES[tokenOut] || tokenOut;

    // Find pair
    const pairInfo = await this.findPair(tokenInAddr, tokenOutAddr);
    if (!pairInfo) {
      // Try via WMNT hop
      return this._getMultiHopQuote(tokenInAddr, tokenOutAddr, amountIn);
    }

    const pair = new ethers.Contract(
      pairInfo.LBPair,
      LB_PAIR_ABI,
      this.provider
    );
    const tokenX = await pair.getTokenX();
    const activeId = await pair.getActiveId();
    const [reserveX, reserveY] = await pair.getReserves();

    // Determine swap direction
    const swapForY = tokenInAddr.toLowerCase() === tokenX.toLowerCase();

    // Get decimals (needed for price + impact normalization)
    const tokenInContract = new ethers.Contract(
      tokenInAddr,
      ERC20_ABI,
      this.provider
    );
    const tokenOutContract = new ethers.Contract(
      tokenOutAddr,
      ERC20_ABI,
      this.provider
    );
    const tokenXContract = new ethers.Contract(
      tokenX,
      ERC20_ABI,
      this.provider
    );
    const tokenYContract = new ethers.Contract(
      await pair.getTokenY(),
      ERC20_ABI,
      this.provider
    );

    const [decimalsIn, decimalsOut, decimalsX, decimalsY, symbolIn, symbolOut] =
      await Promise.all([
        tokenInContract.decimals(),
        tokenOutContract.decimals(),
        tokenXContract.decimals(),
        tokenYContract.decimals(),
        tokenInContract.symbol().catch(() => tokenIn),
        tokenOutContract.symbol().catch(() => tokenOut),
      ]);

    // LB v2.1 price formula:
    // rawPrice = (1 + binStep/10000)^(activeId - 8388608)
    // humanPrice (Y per X) = rawPrice * 10^(decimalsX - decimalsY)
    const binStep = Number(pairInfo.binStep);
    const rawPrice = Math.pow(1 + binStep / 10000, Number(activeId) - 8388608);
    const priceYperX =
      rawPrice * Math.pow(10, Number(decimalsX) - Number(decimalsY));

    const amountInFloat = parseFloat(ethers.formatUnits(amountIn, decimalsIn));
    const feeRate = binStep / 10000;

    // Use the LB pair's own getSwapOut() — this respects bin walking
    // and returns the actual amount out for the requested amountIn,
    // including fee. This is the single source of truth for the pool
    // and is what the router will use at execution time. The previous
    // implementation read only the active bin's reserves and divided
    // amountIn by it, which produced 100% impact for any swap whose
    // size exceeded the very narrow active-bin liquidity even when the
    // surrounding bins held millions in TVL. That caused viable=false
    // and silently blocked every USDT/WMNT or USDT0/WMNT trade.
    let estimatedOutFloat = null;
    let onchainFeeFloat = 0;
    try {
      const SWAP_OUT_ABI = [
        "function getSwapOut(uint128 amountIn, bool swapForY) view returns (uint128 amountInLeft, uint128 amountOut, uint128 fee)",
      ];
      const pairForSwap = new ethers.Contract(
        pairInfo.LBPair,
        SWAP_OUT_ABI,
        this.provider
      );
      const [amountInLeft, amountOut, feeOut] = await pairForSwap.getSwapOut(
        amountIn,
        swapForY
      );
      estimatedOutFloat = parseFloat(
        ethers.formatUnits(amountOut, decimalsOut)
      );
      onchainFeeFloat = parseFloat(
        ethers.formatUnits(feeOut, decimalsIn)
      );
      // If the pool can't fully consume amountIn (more than 1% remains
      // unconsumed), treat as not-viable — pool is too thin.
      if (amountInLeft > 0n) {
        const leftFloat = parseFloat(
          ethers.formatUnits(amountInLeft, decimalsIn)
        );
        if (leftFloat / Math.max(amountInFloat, 1e-12) > 0.01) {
          estimatedOutFloat = null;
        }
      }
    } catch {
      // Fall back to the price-formula estimate. Only triggers on
      // exotic pair configs.
      const fallback = swapForY
        ? amountInFloat * priceYperX
        : amountInFloat / priceYperX;
      estimatedOutFloat = fallback * (1 - feeRate);
    }

    // Mid-market value of amountIn in tokenOut units (zero-impact
    // theoretical fill, before fees and slippage).
    const midOutFloat = swapForY
      ? amountInFloat * priceYperX
      : amountInFloat / priceYperX;

    // priceImpact = relative shortfall of actual output vs midprice,
    // expressed as a fraction (NOT a percent). 0.005 == 0.5%.
    // We add the protocol fee back so impact reflects only depth
    // slippage; the fee is reported separately as `fee`.
    let priceImpact = 1;
    if (estimatedOutFloat != null && midOutFloat > 0) {
      const feeOutValueIn = onchainFeeFloat * (swapForY ? priceYperX : 1 / priceYperX);
      const grossOut = estimatedOutFloat + feeOutValueIn;
      priceImpact = Math.max(0, 1 - grossOut / midOutFloat);
    }

    // depthFraction = how much of the input-side reserve we are eating.
    // Used as a sanity gate against draining a pool.
    const inputReserveFloat = swapForY
      ? parseFloat(ethers.formatUnits(reserveX, decimalsX))
      : parseFloat(ethers.formatUnits(reserveY, decimalsY));
    const depthFraction =
      inputReserveFloat > 0 ? amountInFloat / inputReserveFloat : 1;

    // viable when:
    //   - getSwapOut returned a value (pool consumed our amountIn)
    //   - price impact (excluding protocol fee) is below 5%
    //   - we are not draining > 50% of the input-side reserves
    const viable =
      estimatedOutFloat != null &&
      priceImpact < 0.05 &&
      depthFraction < 0.5;

    return {
      tokenIn: symbolIn,
      tokenOut: symbolOut,
      amountIn: amountInFloat,
      estimatedOut: estimatedOutFloat ?? 0,
      price: swapForY ? priceYperX : 1 / priceYperX,
      fee: feeRate * 100, // as percentage
      // priceImpact is a FRACTION (0.005 = 0.5%). Multiply by 100 for
      // human display. executeSwap compares it to maxPriceImpactBps via
      // (priceImpact * 100 > maxImpactBps), see below.
      priceImpact,
      depthFraction,
      binStep,
      activeId: Number(activeId),
      pairAddress: pairInfo.LBPair,
      path: {
        pairBinSteps: [BigInt(binStep)],
        // Merchant Moe LB v2.2 — confirmed via estimateGas probe on
        // USDT0/USDT and mETH/WMNT (rwa-allocation-active T16 debug).
        // V1=0, V2=1, V2_1=2, V2_2=3.
        versions: [3],
        tokenPath: [tokenInAddr, tokenOutAddr],
      },
      // Decimals exposed so executeSwap can convert estimatedOut→wei
      // correctly without re-fetching them. Spec: rwa-allocation-active C4.
      _decimalsIn: Number(decimalsIn),
      _decimalsOut: Number(decimalsOut),
      viable,
    };
  }

  /**
   * Multi-hop quote (tokenA → WMNT → tokenB)
   */
  async _getMultiHopQuote(tokenInAddr, tokenOutAddr, amountIn) {
    // Try routing through WMNT
    const hop1 = await this.findPair(tokenInAddr, ADDRESSES.WMNT);
    const hop2 = await this.findPair(ADDRESSES.WMNT, tokenOutAddr);

    if (!hop1 || !hop2) {
      return { viable: false, error: "No liquidity path found" };
    }

    return {
      tokenIn: tokenInAddr,
      tokenOut: tokenOutAddr,
      multiHop: true,
      hops: [
        { pair: hop1.LBPair, binStep: Number(hop1.binStep) },
        { pair: hop2.LBPair, binStep: Number(hop2.binStep) },
      ],
      path: {
        pairBinSteps: [BigInt(hop1.binStep), BigInt(hop2.binStep)],
        // Merchant Moe LB v2.2 (=3) for both hops.
        versions: [3, 3],
        tokenPath: [tokenInAddr, ADDRESSES.WMNT, tokenOutAddr],
      },
      viable: true,
      note: "Multi-hop via WMNT",
    };
  }

  /**
   * Lazy allowance setter — sets MaxUint256 once per token per process.
   * Subsequent calls for the same tokenIn are no-ops, saving the
   * extra approve TX on every swap.
   *
   * Spec: rwa-allocation-active CP7 (allowance is set-once).
   */
  async _ensureAllowance(tokenInAddr) {
    if (!this.wallet) throw new Error("No wallet configured");
    if (!this._allowanceCache) this._allowanceCache = new Map();
    if (this._allowanceCache.get(tokenInAddr) === true) return;

    const tokenContract = new ethers.Contract(
      tokenInAddr,
      ERC20_ABI,
      this.wallet
    );
    const current = await tokenContract.allowance(
      this.wallet.address,
      ADDRESSES.LB_ROUTER
    );
    // If already > 1e30 we treat it as effectively infinite.
    if (current > 10n ** 30n) {
      this._allowanceCache.set(tokenInAddr, true);
      return;
    }
    const tx = await tokenContract.approve(
      ADDRESSES.LB_ROUTER,
      ethers.MaxUint256
    );
    await tx.wait();
    this._allowanceCache.set(tokenInAddr, true);
  }

  /**
   * Execute swap on-chain (requires wallet + non-dryRun mode)
   *
   * Options:
   *   - maxPriceImpactBps  (default 100) — refuse if quote impact > this
   *   - slippageBps        (default 50)  — applied to minAmountOut
   *
   * Spec: rwa-allocation-active R4, design §C4, CP6/CP7/CP8.
   */
  async executeSwap(tokenIn, tokenOut, amountIn, options = {}) {
    // SECURITY: whitelist of accepted tokens. Defense-in-depth — even if an
    // upstream caller passes an arbitrary address (e.g., LLM hallucinated a
    // contract), we refuse rather than approve and route through it.
    const ALLOWED = new Set([
      "WMNT", "mETH", "USDY", "mUSD", "USDT", "USDT0",
    ]);
    if (!ALLOWED.has(tokenIn) || !ALLOWED.has(tokenOut)) {
      throw new Error(
        `TOKEN_NOT_WHITELISTED: tokenIn=${tokenIn} tokenOut=${tokenOut}. ` +
        `Allowed: ${[...ALLOWED].join(", ")}`
      );
    }

    // CP6: USDY pool is dry on Mantle. Refuse loudly so nobody silently
    // re-enables the path before the pool has depth.
    if (tokenIn === "USDY" || tokenOut === "USDY") {
      const err = new Error(
        "RWA_POOL_INACTIVE: USDY/USDT pool has no active liquidity on Mantle. " +
          'Re-enable manually after verifying pool depth (see runbook section "Reactivate USDY").'
      );
      err.code = "RWA_POOL_INACTIVE";
      throw err;
    }

    if (this.dryRun) {
      const quote = await this.getQuote(tokenIn, tokenOut, amountIn);
      return {
        ...quote,
        executed: false,
        reason: "DRY_RUN mode — simulation only",
        wouldExecute: quote.viable,
      };
    }

    if (!this.wallet) throw new Error("No wallet configured");

    const maxImpactBps =
      options.maxPriceImpactBps ?? this.maxSlippageBps ?? 100;
    const slipBps = options.slippageBps ?? 50;

    const tokenInAddr = ADDRESSES[tokenIn] || tokenIn;
    const quote = await this.getQuote(tokenIn, tokenOut, amountIn);

    if (!quote.viable) {
      return { ...quote, executed: false, reason: quote.error || "not-viable" };
    }
    // priceImpact is a fraction (0.005 = 0.5%). Convert to bps (×10_000)
    // for comparison with maxImpactBps.
    const impactBps = quote.priceImpact * 10000;
    if (impactBps > maxImpactBps) {
      return {
        ...quote,
        executed: false,
        reason: `impact ${(quote.priceImpact * 100).toFixed(3)}% > ${(
          maxImpactBps / 100
        ).toFixed(3)}%`,
      };
    }

    // CP7: ensure allowance (set once per process per token).
    await this._ensureAllowance(tokenInAddr);

    // Min-out floor with slippage, using the decimals exposed from getQuote.
    // SECURITY: must use string-based parseUnits — Math.floor on float ×
    // 10^18 silently overflows JS safe integer range (2^53) for high-decimal
    // tokens like mETH, producing wrong minOut and accepting bad fills.
    const decimalsOut = quote._decimalsOut ?? 18;
    const slippageMultiplier = (10000 - slipBps) / 10000;
    const minOutFloat = quote.estimatedOut * slippageMultiplier;
    // toFixed truncates to decimalsOut places; ethers.parseUnits handles BigInt safely.
    const minOut =
      options.minAmountOut ??
      ethers.parseUnits(minOutFloat.toFixed(decimalsOut), decimalsOut);

    // CP8: pending nonce so we coexist with the 4 attestation TXs the
    // cycle has already broadcast.
    const nonce = await this.provider.getTransactionCount(
      this.wallet.address,
      "pending"
    );
    const deadline = Math.floor(Date.now() / 1000) + 300;

    const tx = await this.router.swapExactTokensForTokens(
      amountIn,
      minOut,
      quote.path,
      this.wallet.address,
      deadline,
      { nonce }
    );
    const receipt = await tx.wait();

    return {
      ...quote,
      executed: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    };
  }

  /**
   * Get portfolio balances
   */
  async getBalances(address) {
    const addr = address || this.wallet?.address;
    if (!addr) throw new Error("No address");

    const tokens = ["WMNT", "mETH", "USDY", "mUSD", "USDT", "USDT0"];
    const balances = {};

    // Native MNT
    const nativeBalance = await this.provider.getBalance(addr);
    balances.MNT = parseFloat(ethers.formatEther(nativeBalance));

    // ERC-20 tokens
    for (const symbol of tokens) {
      try {
        const contract = new ethers.Contract(
          ADDRESSES[symbol],
          ERC20_ABI,
          this.provider
        );
        const [balance, decimals] = await Promise.all([
          contract.balanceOf(addr),
          contract.decimals(),
        ]);
        balances[symbol] = parseFloat(ethers.formatUnits(balance, decimals));
      } catch {
        balances[symbol] = 0;
      }
    }

    return balances;
  }
}

// Export
module.exports = { MerchantMoeDEX, ADDRESSES, PAIRS };

// Self-test if called directly
if (require.main === module) {
  (async () => {
    console.log("═══ Merchant Moe DEX Simulation ═══\n");

    const dex = new MerchantMoeDEX({
      privateKey: process.env.PRIVATE_KEY,
      dryRun: true,
    });

    // Check balances
    console.log("Portfolio balances:");
    const balances = await dex.getBalances();
    for (const [token, bal] of Object.entries(balances)) {
      if (bal > 0) console.log(`  ${token}: ${bal.toFixed(6)}`);
    }

    // Simulate swaps
    console.log("\nSwap simulations:");

    // Test: WMNT → USDT
    try {
      const quote1 = await dex.getQuote("WMNT", "USDT", ethers.parseEther("1"));
      console.log(
        `  1 WMNT → ${quote1.estimatedOut?.toFixed(
          4
        )} USDT (impact: ${quote1.priceImpact?.toFixed(
          2
        )}%, fee: ${quote1.fee?.toFixed(2)}%)`
      );
    } catch (e) {
      console.log(`  WMNT→USDT: ${e.message}`);
    }

    // Test: mETH → WMNT
    try {
      const quote2 = await dex.getQuote(
        "mETH",
        "WMNT",
        ethers.parseEther("0.01")
      );
      console.log(
        `  0.01 mETH → ${quote2.estimatedOut?.toFixed(
          4
        )} WMNT (impact: ${quote2.priceImpact?.toFixed(
          2
        )}%, fee: ${quote2.fee?.toFixed(2)}%)`
      );
    } catch (e) {
      console.log(`  mETH→WMNT: ${e.message}`);
    }

    console.log("\n✅ DEX module operational");
  })().catch(console.error);
}
