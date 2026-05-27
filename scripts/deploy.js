const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);
  console.log(
    "Balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "MNT"
  );

  // 1. Deploy TuringVaultIdentity
  console.log("\n--- Deploying TuringVaultIdentity ---");
  const Identity = await ethers.getContractFactory("TuringVaultIdentity");
  const identity = await Identity.deploy();
  await identity.waitForDeployment();
  console.log("TuringVaultIdentity deployed to:", await identity.getAddress());

  // 2. Deploy TuringVaultDecisionLog
  console.log("\n--- Deploying TuringVaultDecisionLog ---");
  const DecisionLog = await ethers.getContractFactory("TuringVaultDecisionLog");
  const decisionLog = await DecisionLog.deploy();
  await decisionLog.waitForDeployment();
  console.log(
    "TuringVaultDecisionLog deployed to:",
    await decisionLog.getAddress()
  );

  // 3. Deploy TuringVaultRouter
  console.log("\n--- Deploying TuringVaultRouter ---");
  const Router = await ethers.getContractFactory("TuringVaultRouter");
  const router = await Router.deploy(ethers.ZeroAddress);
  await router.waitForDeployment();
  console.log("TuringVaultRouter deployed to:", await router.getAddress());

  // 4. Register Agent Identity
  console.log("\n--- Registering AI Agent ---");
  const agentURI = JSON.stringify({
    name: "TuringVault AI Agent",
    version: "1.0.0",
    model: "claude-opus-4",
    strategy: "RWA-routing",
    riskParams: { maxSlippage: "1%", minConfidence: "85%", maxSwapSize: "50%" },
  });
  const tx = await identity.registerAgent(agentURI);
  await tx.wait();
  console.log("Agent registered with token ID: 0");

  // Summary
  console.log("\n========================================");
  console.log("DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log(
    "Chain ID:",
    (await ethers.provider.getNetwork()).chainId.toString()
  );
  console.log("TuringVaultIdentity:", await identity.getAddress());
  console.log("TuringVaultDecisionLog:", await decisionLog.getAddress());
  console.log("TuringVaultRouter:", await router.getAddress());
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
