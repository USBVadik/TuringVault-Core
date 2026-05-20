require("dotenv").config();
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Continuing mainnet deploy with:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "MNT\n");

  // Identity & DecisionLog already deployed at same addresses (deterministic nonce)
  console.log("✅ Identity: 0x582E6a649B99784829193E14bB7Af8c4A482E165 (already deployed)");
  console.log("✅ DecisionLog: 0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5 (already deployed)");

  // 3. Router
  console.log("\nDeploying TuringVaultRouter...");
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
  const identity = await ethers.getContractAt("TuringVaultIdentity", "0x582E6a649B99784829193E14bB7Af8c4A482E165");
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
  console.log(`  Identity:           0x582E6a649B99784829193E14bB7Af8c4A482E165`);
  console.log(`  DecisionLog:        0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5`);
  console.log(`  Router:             ${rAddr}`);
  console.log(`  ValidationRegistry: ${regAddr}`);
  console.log("═══════════════════════════════════════════════════════════");

  const finalBalance = await ethers.provider.getBalance(deployer.address);
  console.log(`\nGas spent: ${ethers.formatEther(balance - finalBalance)} MNT`);
  console.log(`Remaining: ${ethers.formatEther(finalBalance)} MNT`);
}

main().catch((e) => { console.error(e); process.exit(1); });
