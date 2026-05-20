require("dotenv").config();
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying ValidationRegistry with:", deployer.address);

  const Registry = await ethers.getContractFactory("TuringVaultValidationRegistry");
  const registry = await Registry.deploy(0, 1); // analystTokenId=0, validatorTokenId=1
  await registry.waitForDeployment();
  const addr = await registry.getAddress();
  console.log("ValidationRegistry deployed to:", addr);
}

main().catch((e) => { console.error(e); process.exit(1); });
