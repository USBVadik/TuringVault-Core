const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TuringVaultRouter", function () {
  let router, mockRouter, tokenA, tokenB, owner, other;

  beforeEach(async () => {
    [owner, other] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    tokenA = await MockERC20.deploy("Mock mUSD", "mUSD");
    tokenB = await MockERC20.deploy("Mock mETH", "mETH");
    await tokenA.waitForDeployment();
    await tokenB.waitForDeployment();

    // Deploy mock router
    const MockLBRouter = await ethers.getContractFactory("MockLBRouter");
    mockRouter = await MockLBRouter.deploy();
    await mockRouter.waitForDeployment();

    // Deploy TuringVaultRouter
    const Router = await ethers.getContractFactory("TuringVaultRouter");
    router = await Router.deploy(ethers.ZeroAddress);
    await router.waitForDeployment();

    // Mint tokens to owner for deposit testing
    await tokenA.mint(owner.address, ethers.parseEther("10000"));
    await tokenB.mint(owner.address, ethers.parseEther("10000"));

    // Fund mock router with tokenB for swap outputs
    await tokenB.mint(await mockRouter.getAddress(), ethers.parseEther("10000"));
  });

  describe("Deposits", function () {
    it("should deposit tokens", async () => {
      const amount = ethers.parseEther("1000");
      await tokenA.approve(await router.getAddress(), amount);
      
      await expect(router.deposit(await tokenA.getAddress(), amount))
        .to.emit(router, "Deposited")
        .withArgs(await tokenA.getAddress(), amount);

      expect(await router.assetBalances(await tokenA.getAddress())).to.equal(amount);
      expect(await router.totalDeposited()).to.equal(amount);
    });

    it("should reject non-owner deposit", async () => {
      await expect(router.connect(other).deposit(await tokenA.getAddress(), 100))
        .to.be.revertedWithCustomError(router, "OwnableUnauthorizedAccount");
    });
  });

  describe("Withdrawals", function () {
    beforeEach(async () => {
      const amount = ethers.parseEther("1000");
      await tokenA.approve(await router.getAddress(), amount);
      await router.deposit(await tokenA.getAddress(), amount);
    });

    it("should withdraw tokens", async () => {
      const amount = ethers.parseEther("500");
      await expect(router.withdraw(await tokenA.getAddress(), amount))
        .to.emit(router, "Withdrawn")
        .withArgs(await tokenA.getAddress(), amount);

      expect(await router.assetBalances(await tokenA.getAddress())).to.equal(ethers.parseEther("500"));
    });

    it("should reject withdrawal exceeding balance", async () => {
      await expect(router.withdraw(await tokenA.getAddress(), ethers.parseEther("2000")))
        .to.be.revertedWith("Insufficient balance");
    });
  });

  describe("Risk Parameters", function () {
    it("should update risk params", async () => {
      await expect(router.updateRiskParams(200, 9000, 3000))
        .to.emit(router, "RiskParamsUpdated")
        .withArgs(200, 9000, 3000);

      expect(await router.maxSlippageBps()).to.equal(200);
      expect(await router.minConfidence()).to.equal(9000);
      expect(await router.maxSingleSwapPct()).to.equal(3000);
    });

    it("should reject slippage above 10%", async () => {
      await expect(router.updateRiskParams(1001, 9000, 3000))
        .to.be.revertedWith("Slippage too high");
    });

    it("should reject non-owner risk update", async () => {
      await expect(router.connect(other).updateRiskParams(200, 9000, 3000))
        .to.be.revertedWithCustomError(router, "OwnableUnauthorizedAccount");
    });
  });

  describe("Swap Execution (max swap size check)", function () {
    beforeEach(async () => {
      // Deposit 1000 tokenA
      const amount = ethers.parseEther("1000");
      await tokenA.approve(await router.getAddress(), amount);
      await router.deposit(await tokenA.getAddress(), amount);
    });

    it("should reject swap exceeding max single swap percentage", async () => {
      // maxSingleSwapPct = 5000 (50%), trying to swap 600 out of 1000 = 60%
      const swapAmount = ethers.parseEther("600");
      await expect(router.executeSwap(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        swapAmount,
        1,
        [15],
        [2],
        0
      )).to.be.revertedWith("Exceeds max swap size");
    });

    it("should reject swap exceeding balance", async () => {
      const swapAmount = ethers.parseEther("2000");
      await expect(router.executeSwap(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        swapAmount,
        1,
        [15],
        [2],
        0
      )).to.be.revertedWith("Exceeds balance");
    });

    it("should reject swap with zero amountOutMin", async () => {
      const swapAmount = ethers.parseEther("100");
      await expect(router.executeSwap(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        swapAmount,
        0,
        [15],
        [2],
        0
      )).to.be.revertedWith("amountOutMin cannot be zero");
    });
  });

  describe("Portfolio View", function () {
    it("should return zero allocations initially", async () => {
      const [musd, meth, usdy] = await router.getPortfolioAllocation();
      expect(musd).to.equal(0);
      expect(meth).to.equal(0);
      expect(usdy).to.equal(0);
    });
  });

  describe("Emergency Withdraw", function () {
    it("should emergency withdraw all tokens", async () => {
      const amount = ethers.parseEther("1000");
      await tokenA.approve(await router.getAddress(), amount);
      await router.deposit(await tokenA.getAddress(), amount);

      const balanceBefore = await tokenA.balanceOf(owner.address);
      await router.emergencyWithdraw(await tokenA.getAddress());
      const balanceAfter = await tokenA.balanceOf(owner.address);

      expect(balanceAfter - balanceBefore).to.equal(amount);
      expect(await router.assetBalances(await tokenA.getAddress())).to.equal(0);
    });
  });
});
