const hre = require("hardhat");

async function main() {
  console.log("Deploying ERC-8004 compliant contracts to Mantle Mainnet...\n");

  // Deploy TuringVaultValidation (Pre-Action Checks)
  console.log("1. Deploying TuringVaultValidation...");
  const Validation = await hre.ethers.getContractFactory("TuringVaultValidation");
  const validation = await Validation.deploy();
  await validation.waitForDeployment();
  const validationAddr = await validation.getAddress();
  console.log("   TuringVaultValidation:", validationAddr);

  // Deploy updated TuringVaultIdentity (ERC-8004 + EIP-712)
  console.log("\n2. Deploying TuringVaultIdentity (ERC-8004)...");
  const Identity = await hre.ethers.getContractFactory("TuringVaultIdentity");
  const identity = await Identity.deploy();
  await identity.waitForDeployment();
  const identityAddr = await identity.getAddress();
  console.log("   TuringVaultIdentity:", identityAddr);

  console.log("\n═══════════════════════════════════════");
  console.log("DEPLOYED CONTRACTS:");
  console.log("═══════════════════════════════════════");
  console.log("TuringVaultValidation:", validationAddr);
  console.log("TuringVaultIdentity:  ", identityAddr);
  console.log("═══════════════════════════════════════");
}

main().catch(console.error);
