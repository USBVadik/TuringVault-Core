/**
 * Verify all TuringVault contracts on Mantlescan
 * Run: npx hardhat run scripts/verifyContracts.js --network mantle
 */

const hre = require("hardhat");
const deployments = require("../deployments.json");

async function main() {
  console.log("🔍 Verifying TuringVault contracts on Mantlescan...\n");

  if (!process.env.MANTLESCAN_API_KEY) {
    console.error("❌ MANTLESCAN_API_KEY not set in .env");
    console.log("\nTo get an API key:");
    console.log("1. Go to https://mantlescan.xyz/myapikey");
    console.log("2. Create a new API key");
    console.log("3. Add to .env: MANTLESCAN_API_KEY=your_key_here\n");
    process.exit(1);
  }

  const contracts = [
    {
      name: "TuringVaultDecisionLog",
      address: deployments.contracts.TuringVaultDecisionLog.address,
      args: [],
    },
    {
      name: "TuringVaultIdentity",
      address: deployments.contracts.TuringVaultIdentity.address,
      args: [],
    },
    {
      name: "TuringVaultValidation",
      address: deployments.contracts.TuringVaultValidation.address,
      args: [],
    },
    {
      name: "TuringVaultRouter",
      address: deployments.contracts.TuringVaultRouter.address,
      args: [
        deployments.contracts.TuringVaultDecisionLog.address,
        deployments.contracts.TuringVaultIdentity.address,
        deployments.contracts.TuringVaultValidation.address,
      ],
    },
    {
      name: "ReputationRegistry",
      address: deployments.contracts.ReputationRegistry.address,
      args: [],
    },
    {
      name: "TuringVaultValidationRegistry",
      address: deployments.contracts.TuringVaultValidationRegistry.address,
      args: [],
    },
  ];

  let verified = 0;
  let failed = 0;

  for (const contract of contracts) {
    console.log(`\n📋 ${contract.name}`);
    console.log(`   Address: ${contract.address}`);

    try {
      await hre.run("verify:verify", {
        address: contract.address,
        constructorArguments: contract.args,
      });
      console.log(`   ✅ Verified successfully!`);
      verified++;
    } catch (error) {
      if (error.message.includes("Already Verified")) {
        console.log(`   ✅ Already verified`);
        verified++;
      } else {
        console.log(`   ❌ Failed: ${error.message.slice(0, 100)}`);
        failed++;
      }
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`✅ Verified: ${verified}`);
  console.log(`❌ Failed: ${failed}`);
  console.log("=".repeat(50));

  if (verified === contracts.length) {
    console.log("\n🎉 All contracts verified on Mantlescan!");
    console.log("View at: https://mantlescan.xyz/address/<contract_address>");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
