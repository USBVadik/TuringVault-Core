const { ethers } = require("ethers");

// The first measured OpenOcean entry consumed 0.0341 MNT across approval +
// swap. Budget 0.018 MNT per transaction so the exit gate does not call a
// trade profitable by underestimating its broadcast cost.
const DEFAULT_ESTIMATED_TX_GAS_MNT = 0.018;

function bigintOrZero(value) {
  try {
    return value == null ? 0n : BigInt(value);
  } catch {
    return 0n;
  }
}

function transactionGasMnt(receipt = {}) {
  const gasUsed = bigintOrZero(receipt.gasUsed);
  const gasPrice = bigintOrZero(receipt.gasPrice ?? receipt.effectiveGasPrice);
  if (!gasUsed || !gasPrice) return 0;
  return Number(ethers.formatEther(gasUsed * gasPrice));
}

function estimatedGasUsd({
  transactionCount = 1,
  mntPriceUsd = 0,
  gasPerTxMnt = DEFAULT_ESTIMATED_TX_GAS_MNT,
} = {}) {
  const count = Math.max(0, Number(transactionCount) || 0);
  const price = Math.max(0, Number(mntPriceUsd) || 0);
  const gas = Math.max(0, Number(gasPerTxMnt) || 0);
  return count * gas * price;
}

module.exports = {
  DEFAULT_ESTIMATED_TX_GAS_MNT,
  estimatedGasUsd,
  transactionGasMnt,
};
