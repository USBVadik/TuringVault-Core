/**
 * TuringVault — Wallet Router
 *
 * Smart source-token picker for the directional swap path. Replaces
 * the hardcoded "risk-off starts from WMNT" assumption that left the
 * agent INTENT_SWAP_NO_EXEC for hours after WMNT got drained on a
 * sequence of risk-off cycles (cycles 149-151 case study).
 *
 * Reality of the demo wallet:
 *   - Native MNT       (gas + raw L2 native, 1:1 wrappable)
 *   - WMNT (ERC20)     (the canonical risk asset on Mantle DEXes)
 *   - USDT0            (LayerZero Tether, our stable hub)
 *   - USDT             (legacy bridged Tether — small float)
 *   - mETH             (yield-bearing ETH derivative)
 *
 * Smart routing for risk-off (analyst wants stable exposure):
 *   1. WMNT ≥ floor                → use WMNT directly
 *   2. MNT  ≥ (floor + gas reserve) → wrap MNT→WMNT via WMNT.deposit()
 *                                     then start the WMNT→USDT→USDT0 path
 *   3. mETH ≥ small floor          → use mETH directly (mETH→WMNT→USDT→USDT0)
 *   4. nothing → infeasible
 *
 * Smart routing for risk-on (analyst wants risk exposure):
 *   1. USDT0 ≥ floor    → start USDT0→USDT→WMNT
 *   2. USDT  ≥ floor    → start USDT→WMNT (skip leg 1)
 *   3. WMNT  > floor + reserve → already on the risk side; no swap
 *   4. nothing → infeasible
 *
 * The native-MNT-wrap path is the headline win: 29 MNT in the demo
 * wallet was sitting idle while the agent claimed "insufficient WMNT"
 * because nothing in the pipeline knew how to wrap it.
 *
 * Audit ref: discovered in operator-led debugging on 2026-05-29 after
 * cycles 149-151 produced 0.5 WMNT swaps that drained the WMNT float
 * to 0.09 while 29 MNT sat untouched.
 */

const { ethers } = require("ethers");

const ADDRESSES = {
  WMNT: "0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8",
  USDT: "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE",
  USDT0: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
  mETH: "0xcDA86A272531e8640cD7F1a92c01839911B90bb0",
};

const WMNT_ABI = [
  "function deposit() payable",
  "function withdraw(uint256 wad)",
  "function balanceOf(address) view returns (uint256)",
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

const DECIMALS = {
  WMNT: 18,
  MNT: 18,
  USDT: 6,
  USDT0: 6,
  mETH: 18,
};

/**
 * Read every balance we care about, in human units (number).
 * Native MNT comes from provider.getBalance, ERC20s from balanceOf.
 *
 * @returns {Promise<{
 *   MNT: number,    // native L2
 *   WMNT: number,   // wrapped MNT (ERC20)
 *   USDT0: number,  // LayerZero Tether
 *   USDT: number,   // legacy bridged Tether
 *   mETH: number,   // yield ETH
 * }>}
 */
async function readAllBalances(provider, walletAddress) {
  const out = {
    MNT: 0,
    WMNT: 0,
    USDT0: 0,
    USDT: 0,
    mETH: 0,
  };
  // Native MNT.
  try {
    const native = await provider.getBalance(walletAddress);
    out.MNT = parseFloat(ethers.formatEther(native));
  } catch {
    /* keep 0 */
  }
  // ERC20s in parallel.
  await Promise.all(
    [
      ["WMNT", ADDRESSES.WMNT],
      ["USDT0", ADDRESSES.USDT0],
      ["USDT", ADDRESSES.USDT],
      ["mETH", ADDRESSES.mETH],
    ].map(async ([sym, addr]) => {
      try {
        const c = new ethers.Contract(addr, ERC20_ABI, provider);
        const raw = await c.balanceOf(walletAddress);
        out[sym] = parseFloat(ethers.formatUnits(raw, DECIMALS[sym]));
      } catch {
        /* keep 0 */
      }
    })
  );
  return out;
}

/**
 * MNT must always have a hard reserve to pay for gas. Mantle gas is
 * ~0.001 MNT per swap, BUT a full cycle does:
 *   - submitProposal       ~0.005 MNT
 *   - validateProposal     ~0.005 MNT
 *   - logDecision          ~0.005 MNT
 *   - submitFeedback       ~0.005 MNT
 *   - 2-3 swap legs        ~0.003 MNT each
 *   - setAgentURI          ~0.005 MNT
 *   - tokenURI update      ~0.005 MNT
 *   - heartbeat (occasional) ~0.006 MNT for 2 swaps
 * Total: ~0.04 MNT per cycle (sustained), ~0.077 MNT per cycle worst-case
 * (gas-cost sample at .kiro/audits/raw/gas-samples/cycle-123.json).
 *
 * History of this constant:
 *   - 0.05 — cycle 153 wrapped 28.95 MNT and left 0.075 native;
 *            cycle 154 then ran out with "insufficient funds for
 *            intrinsic transaction cost".
 *   - 0.5  — partial fix; cycle 156 still bricked under heartbeat.
 *   - 1.0  — proper margin for ~24-cycle horizon between wraps,
 *            but: 11 consecutive risk-off cycles (149-159) drained
 *            the wallet anyway because the wrap-everything-wrappable
 *            branch didn't enforce a meaningful upper bound and
 *            wrapped ~28 MNT every time WMNT fell below floor.
 *   - 5.0  — current. Target a *7-day* operator-react window if the
 *            agent goes into a sustained risk-off streak. At
 *            0.077 MNT/cycle worst-case × 48 cycles/day × 7 days =
 *            ~26 MNT, but we floor at 5.0 so the operator's
 *            UI gas-runway pill turns CRITICAL early enough to act.
 *
 * Audit ref: .kiro/audits/27-invariants-runway-adversarial-mechanics.md
 *            (gas runway surface) +
 *            .kiro/audits/28-wrap-everything-bug-fix.md (this constant +
 *            wrap sizing fix).
 */
const GAS_RESERVE_MNT = 5.0;

/**
 * Cap on how much we will wrap in a single cycle. Was previously
 * "all wrappable MNT minus gas reserve" which destroyed gas runway
 * across consecutive risk-off cycles. New rule: wrap at most enough
 * to comfortably cover the next ~5 swap-cycles worth of WMNT input,
 * AND never wrap more than this hard cap regardless of balance.
 *
 * 2.0 MNT ≈ $1.30 of WMNT at $0.65/MNT, which is more than enough
 * for the typical $0.50-1.00 risk-off swap size and leaves the
 * remainder of native MNT untouched as gas runway.
 */
const MAX_WRAP_PER_CYCLE_MNT = 2.0;

/**
 * Pure function — picks the best source token + tells the caller
 * whether they need to wrap MNT first.
 *
 * @param {object} args
 *   direction       — "risk-on" | "risk-off"
 *   balances        — output of readAllBalances()
 *   floors          — { WMNT: 0.1, USDT0: 0.5, mETH: 0.001 }
 *   gasReserveMnt   — number, default GAS_RESERVE_MNT
 *
 * @returns {object}
 *   feasible        — bool, can the swap happen at all?
 *   source          — "WMNT" | "MNT" | "USDT0" | "USDT" | "mETH" | null
 *   wrapMntFirst    — bool, must call WMNT.deposit() before swap
 *   wrapAmountMnt   — number, how much MNT to wrap (only when wrapMntFirst)
 *   path            — array of token symbols for the swap path
 *   sourceBalance   — final available balance in the chosen source token
 *                     (post-wrap if applicable)
 *   reason          — string, brief why-this-source-was-picked
 */
function pickSource({
  direction,
  balances,
  floors = { WMNT: 0.1, USDT0: 0.5, mETH: 0.001, USDT: 0.5 },
  gasReserveMnt = GAS_RESERVE_MNT,
  targetIsMeth = false,
}) {
  if (direction === "risk-off") {
    // Goal: end at USDT0. Try in order:
    //   1. WMNT directly
    //   2. wrap MNT → WMNT (the headline missing capability)
    //   3. unwind mETH → WMNT → USDT → USDT0
    if (balances.WMNT >= floors.WMNT) {
      return {
        feasible: true,
        source: "WMNT",
        wrapMntFirst: false,
        wrapAmountMnt: 0,
        path: ["WMNT", "USDT", "USDT0"],
        sourceBalance: balances.WMNT,
        reason: `WMNT ${balances.WMNT.toFixed(4)} ≥ floor ${floors.WMNT}`,
      };
    }
    const wrappableMnt = Math.max(0, balances.MNT - gasReserveMnt);
    // Cap the wrap size so we don't drain native MNT into WMNT on
    // a sustained risk-off streak (cycles 149-159 case study). Wrap
    // enough to clear floor with comfortable headroom (4× floor, or
    // 0.4 WMNT at floor=0.1) but never more than MAX_WRAP_PER_CYCLE.
    // Anything WMNT-input-heavy beyond 2 MNT will simply have to
    // happen on a subsequent cycle once the previous wrap is consumed.
    const targetWrap = Math.max(floors.WMNT * 4, 0.4);
    const wrapAmount = Math.min(
      wrappableMnt,
      Math.max(targetWrap, 0),
      MAX_WRAP_PER_CYCLE_MNT
    );
    if (wrappableMnt >= floors.WMNT && wrapAmount >= floors.WMNT) {
      // Sanity gate: refuse to leave native MNT below the gas
      // reserve floor under any circumstance. This is the second
      // layer of defence; gasReserveMnt subtraction above is the
      // first layer.
      const remainingMnt = balances.MNT - wrapAmount;
      if (remainingMnt < gasReserveMnt) {
        return {
          feasible: false,
          source: null,
          wrapMntFirst: false,
          wrapAmountMnt: 0,
          path: [],
          sourceBalance: 0,
          reason: `risk-off would leave native MNT ${remainingMnt.toFixed(4)} below gas reserve ${gasReserveMnt} — refusing to wrap (operator should top-up MNT or wait for risk-on cycle)`,
        };
      }
      return {
        feasible: true,
        source: "WMNT",
        wrapMntFirst: true,
        wrapAmountMnt: wrapAmount,
        path: ["WMNT", "USDT", "USDT0"],
        sourceBalance: balances.WMNT + wrapAmount,
        reason: `WMNT ${balances.WMNT.toFixed(4)} < floor — wrap ${wrapAmount.toFixed(4)} MNT (capped at ${MAX_WRAP_PER_CYCLE_MNT} MNT/cycle, gas reserve ${gasReserveMnt})`,
      };
    }
    // Last-resort: liquidate mETH for stables. mETH→WMNT pool exists.
    if (balances.mETH >= floors.mETH) {
      return {
        feasible: true,
        source: "mETH",
        wrapMntFirst: false,
        wrapAmountMnt: 0,
        path: ["mETH", "WMNT", "USDT", "USDT0"],
        sourceBalance: balances.mETH,
        reason: `WMNT+MNT both depleted; falling back to mETH ${balances.mETH.toFixed(6)}`,
      };
    }
    return {
      feasible: false,
      source: null,
      wrapMntFirst: false,
      wrapAmountMnt: 0,
      path: [],
      sourceBalance: 0,
      reason: `risk-off infeasible: WMNT=${balances.WMNT.toFixed(4)} MNT=${balances.MNT.toFixed(4)} mETH=${balances.mETH.toFixed(6)} all below floors`,
    };
  }

  if (direction === "risk-on") {
    // Goal: acquire WMNT (or mETH if target=mETH). Try in order:
    //   1. USDT0 directly (3-leg via USDT→WMNT, then optional WMNT→mETH)
    //   2. USDT directly (skip first leg)
    //   3. wrap MNT → WMNT to give us source-of-funds for a smaller risk-on
    //      that still moves the needle
    if (balances.USDT0 >= floors.USDT0) {
      const path = targetIsMeth
        ? ["USDT0", "USDT", "WMNT", "mETH"]
        : ["USDT0", "USDT", "WMNT"];
      return {
        feasible: true,
        source: "USDT0",
        wrapMntFirst: false,
        wrapAmountMnt: 0,
        path,
        sourceBalance: balances.USDT0,
        reason: `USDT0 ${balances.USDT0.toFixed(2)} ≥ floor ${floors.USDT0}`,
      };
    }
    if (balances.USDT >= floors.USDT) {
      const path = targetIsMeth
        ? ["USDT", "WMNT", "mETH"]
        : ["USDT", "WMNT"];
      return {
        feasible: true,
        source: "USDT",
        wrapMntFirst: false,
        wrapAmountMnt: 0,
        path,
        sourceBalance: balances.USDT,
        reason: `USDT0 depleted; fallback to USDT ${balances.USDT.toFixed(2)}`,
      };
    }
    return {
      feasible: false,
      source: null,
      wrapMntFirst: false,
      wrapAmountMnt: 0,
      path: [],
      sourceBalance: 0,
      reason: `risk-on infeasible: USDT0=${balances.USDT0.toFixed(2)} USDT=${balances.USDT.toFixed(2)} both below floors`,
    };
  }

  return {
    feasible: false,
    source: null,
    wrapMntFirst: false,
    wrapAmountMnt: 0,
    path: [],
    sourceBalance: 0,
    reason: `unknown direction: ${direction}`,
  };
}

/**
 * Execute MNT → WMNT wrap on-chain.
 * Cheap (~0.0002 MNT gas), 1:1 ratio, no slippage. Returns the tx
 * receipt so the caller can include the wrap as a "leg 0" in the
 * outcomes ledger.
 *
 * @param {ethers.Wallet} wallet
 * @param {number} amountMnt — how much native MNT to wrap (human units)
 * @param {object} [opts]
 *   nonce — optional explicit nonce; needed when chained inside the
 *           directional-swap nonce sequence in multiAgentLoop.
 */
async function wrapMnt(wallet, amountMnt, opts = {}) {
  const wmnt = new ethers.Contract(ADDRESSES.WMNT, WMNT_ABI, wallet);
  const wei = ethers.parseEther(amountMnt.toFixed(18));
  const txOpts = { value: wei };
  if (typeof opts.nonce === "number") txOpts.nonce = opts.nonce;
  const tx = await wmnt.deposit(txOpts);
  const receipt = await tx.wait();
  return {
    txHash: receipt?.hash || tx.hash,
    blockNumber: receipt?.blockNumber || null,
    amountMnt,
    amountWmntOut: amountMnt, // 1:1 by definition
  };
}

module.exports = {
  readAllBalances,
  pickSource,
  wrapMnt,
  ADDRESSES,
  GAS_RESERVE_MNT,
  MAX_WRAP_PER_CYCLE_MNT,
};
