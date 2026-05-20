require("dotenv").config();
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying to Mantle MAINNET with:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "MNT\n");

  // 1. Identity
  console.log("Deploying TuringVaultIdentity...");
  const Identity = await ethers.getContractFactory("TuringVaultIdentity");
  const identity = await Identity.deploy();
  await identity.waitForDeployment();
  const idAddr = await identity.getAddress();
  console.log("✅ Identity:", idAddr);

  // 2. DecisionLog
  console.log("Deploying TuringVaultDecisionLog...");
  const DecisionLog = await ethers.getContractFactory("TuringVaultDecisionLog");
  const decisionLog = await DecisionLog.deploy();
  await decisionLog.waitForDeployment();
  const dlAddr = await decisionLog.getAddress();
  console.log("✅ DecisionLog:", dlAddr);

  // 3. Router (with placeholder tokens for mainnet — real mETH/mUSD)
  // Mantle mainnet mETH: 0xcDA86A272531e8640cD7F1a92c01839911B90bb0
  // Mantle mainnet USDT: 0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE
  // Merchant Moe LB Router: 0x1E2A72DE26Ba630a4C71B87C5d5A2E1bb5DD2E8d (placeholder)
  console.log("Deploying TuringVaultRouter...");
  const Router = await ethers.getContractFactory("TuringVaultRouter");
  const router = await Router.deploy();
  await router.waitForDeployment();
  const rAddr = await router.getAddress();
  console.log("✅ Router:", rAddr);

  // 4. ValidationRegistry
  console.log("Deploying TuringVaultValidationRegistry...");
  const Registry = await ethers.getContractFactory("TuringVaultValidationRegistry");
  const registry = await Registry.deploy(0, 1);
  await registry.waitForDeployment();
  const regAddr = await registry.getAddress();
  console.log("✅ ValidationRegistry:", regAddr);

  // 5. Mint AI Agent Identity NFT
  console.log("\nMinting AI Agent Identity NFT...");
  const tx = await identity.mintAgentIdentity(
    deployer.address,
    "TuringVault AI Agent",
    "Claude Sonnet 4.6 (Multi-Agent: Analyst + Validator)",
    "ipfs://QmTuringVaultAgent"
  );
  await tx.wait();
  console.log("✅ Agent NFT minted (Token #0)");

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  MANTLE MAINNET DEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Identity:           ${idAddr}`);
  console.log(`  DecisionLog:        ${dlAddr}`);
  console.log(`  Router:             ${rAddr}`);
  console.log(`  ValidationRegistry: ${regAddr}`);
  console.log("═══════════════════════════════════════════════════════════");

  const finalBalance = await ethers.provider.getBalance(deployer.address);
  console.log(`\nGas spent: ${ethers.formatEther(balance - finalBalance)} MNT`);
  console.log(`Remaining: ${ethers.formatEther(finalBalance)} MNT`);
}

main().catch((e) => { console.error(e); process.exit(1); });
