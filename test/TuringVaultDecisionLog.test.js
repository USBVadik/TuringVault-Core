const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TuringVaultDecisionLog", function () {
  let logContract, owner, other;

  beforeEach(async () => {
    [owner, other] = await ethers.getSigners();
    const LogContract = await ethers.getContractFactory("TuringVaultDecisionLog");
    logContract = await LogContract.deploy();
    await logContract.waitForDeployment();
  });

  describe("Logging Decisions", function () {
    it("should log a decision and emit event", async () => {
      const txHash = ethers.encodeBytes32String("test-tx-hash");
      
      await expect(logContract.logDecision(
        "swap",
        "0xab575258d37EaA5C8956EfABe71F4eE8F6397cF3",
        1000,
        1005,
        8500,
        "ipfs://reasoning",
        txHash
      ))
        .to.emit(logContract, "DecisionLogged")
        .withArgs(0, "swap", "0xab575258d37EaA5C8956EfABe71F4eE8F6397cF3", 8500, "ipfs://reasoning");

      expect(await logContract.totalDecisions()).to.equal(1);
    });

    it("should reject non-owner calls", async () => {
      const txHash = ethers.encodeBytes32String("test-tx-hash");
      await expect(logContract.connect(other).logDecision(
        "swap", "0xTarget", 100, 100, 9000, "hash", txHash
      )).to.be.revertedWithCustomError(logContract, "OwnableUnauthorizedAccount");
    });
  });

  describe("Performance Updates", function () {
    beforeEach(async () => {
      const txHash = ethers.encodeBytes32String("test-tx-hash");
      await logContract.logDecision("swap", "0xTarget", 100, 100, 9000, "hash", txHash);
    });

    it("should increase successful swaps and total PnL on positive update", async () => {
      await logContract.updatePerformance(0, 500);
      expect(await logContract.successfulSwaps()).to.equal(1);
      expect(await logContract.totalPnLBasisPoints()).to.equal(500);
    });

    it("should decrease total PnL on negative update", async () => {
      await logContract.updatePerformance(0, 500);
      await logContract.updatePerformance(0, -200);
      expect(await logContract.totalPnLBasisPoints()).to.equal(300);
    });

    it("should not underflow on large negative PnL", async () => {
      await logContract.updatePerformance(0, 100);
      await logContract.updatePerformance(0, -500);
      expect(await logContract.totalPnLBasisPoints()).to.equal(0);
    });

    it("should reject invalid decision ID", async () => {
      await expect(logContract.updatePerformance(99, 500))
        .to.be.revertedWith("Invalid decision ID");
    });
  });

  describe("View Functions", function () {
    beforeEach(async () => {
      const txHash = ethers.encodeBytes32String("test-tx-hash");
      await logContract.logDecision("swap", "0x1", 100, 100, 9000, "hash1", txHash);
      await logContract.logDecision("swap", "0x2", 200, 200, 8500, "hash2", txHash);
      await logContract.logDecision("swap", "0x3", 300, 300, 9500, "hash3", txHash);
    });

    it("should get decision by ID", async () => {
      const decision = await logContract.getDecision(1);
      expect(decision.targetAsset).to.equal("0x2");
    });

    it("should get recent decisions with pagination", async () => {
      const recent = await logContract.getRecentDecisions(2);
      expect(recent.length).to.equal(2);
      expect(recent[0].targetAsset).to.equal("0x2");
      expect(recent[1].targetAsset).to.equal("0x3");
    });

    it("should handle request for more decisions than exist", async () => {
      const recent = await logContract.getRecentDecisions(10);
      expect(recent.length).to.equal(3);
      expect(recent[0].targetAsset).to.equal("0x1");
    });

    it("should return empty array when no decisions", async () => {
      const fresh = await ethers.getContractFactory("TuringVaultDecisionLog");
      const freshLog = await fresh.deploy();
      await freshLog.waitForDeployment();
      const recent = await freshLog.getRecentDecisions(5);
      expect(recent.length).to.equal(0);
    });
  });
});
