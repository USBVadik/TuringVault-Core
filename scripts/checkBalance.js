require("dotenv").config();
const { ethers } = require("ethers");

async function main() {
  const provider = new ethers.JsonRpcProvider("https://rpc.mantle.xyz");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const balance = await provider.getBalance(wallet.address);
  console.log("Address:", wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "MNT");

  // Check gas price
  const feeData = await provider.getFeeData();
  console.log(
    "Gas price:",
    ethers.formatUnits(feeData.gasPrice, "gwei"),
    "gwei"
  );

  // Estimate cost of 50 txs (assuming ~100k gas each for contract calls)
  const costPerTx = feeData.gasPrice * 100000n;
  const totalCost = costPerTx * 50n;
  console.log("Est. cost for 50 txs:", ethers.formatEther(totalCost), "MNT");
  console.log("Can afford:", Number(balance / costPerTx), "txs");
}

main().catch(console.error);
