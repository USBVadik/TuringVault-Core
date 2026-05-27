// Deploy TuringVaultReputationRegistry to Mantle Mainnet
const hre = require("hardhat");

async function main() {
  console.log("Deploying TuringVaultReputationRegistry to Mantle Mainnet...");

  const Factory = await hre.ethers.getContractFactory(
    "TuringVaultReputationRegistry"
  );
  const registry = await Factory.deploy();
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log(`✅ TuringVaultReputationRegistry deployed: ${address}`);

  // Verify on Sourcify
  console.log("\nVerifying on Sourcify...");
  try {
    await hre.run("verify:verify", {
      address: address,
      constructorArguments: [],
    });
    console.log("✅ Verified on Sourcify!");
  } catch (e) {
    console.log("Verification:", e.message.slice(0, 100));
  }
}

main().catch(console.error);
