const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TuringVaultValidationRegistry", function () {
  let registry, owner, addr1;

  beforeEach(async () => {
    [owner, addr1] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("TuringVaultValidationRegistry");
    registry = await Registry.deploy(0, 1); // analystTokenId=0, validatorTokenId=1
    await registry.waitForDeployment();
  });

  describe("Proposal Submission", () => {
    it("Should submit a proposal", async () => {
      const tx = await registry.submitProposal("swap", "mETH", ethers.parseEther("1"), 9100, "Bullish signal detected");
      await tx.wait();
      expect(await registry.totalProposals()).to.equal(1);
    });

    it("Should emit ProposalCreated event", async () => {
      await expect(registry.submitProposal("swap", "mETH", ethers.parseEther("1"), 9100, "reasoning"))
        .to.emit(registry, "ProposalCreated")
        .withArgs(0, "swap", "mETH", 9100, "reasoning");
    });

    it("Should reject non-owner", async () => {
      await expect(registry.connect(addr1).submitProposal("swap", "mETH", 0, 9100, "test"))
        .to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });
  });

  describe("Validation", () => {
    beforeEach(async () => {
      await registry.submitProposal("swap", "mETH", ethers.parseEther("1"), 9100, "Bullish signal");
    });

    it("Should approve with consensus (both agents agree)", async () => {
      await registry.validateProposal(0, 8000, 3000, "Verified, low risk", true);
      const [approved, rejected, total] = await registry.getConsensusRate();
      expect(approved).to.equal(1);
      expect(total).to.equal(1);
    });

    it("Should reject if validator disapproves", async () => {
      await registry.validateProposal(0, 8000, 3000, "Hallucination detected", false);
      const [approved, rejected] = await registry.getConsensusRate();
      expect(approved).to.equal(0);
      expect(rejected).to.equal(1);
    });

    it("Should reject if risk score too high", async () => {
      await registry.validateProposal(0, 8000, 7000, "Extreme risk", true);
      const [approved, rejected] = await registry.getConsensusRate();
      expect(rejected).to.equal(1);
    });

    it("Should reject if validator confidence too low", async () => {
      await registry.validateProposal(0, 5000, 3000, "Low confidence", true);
      const [approved, rejected] = await registry.getConsensusRate();
      expect(rejected).to.equal(1);
    });

    it("Should reject if analyst confidence below threshold", async () => {
      // New proposal with low analyst confidence
      await registry.submitProposal("swap", "mETH", ethers.parseEther("1"), 7000, "Weak signal");
      await registry.validateProposal(1, 8000, 3000, "OK", true);
      const proposal = await registry.proposals(1);
      expect(proposal.status).to.equal(2); // Rejected
    });

    it("Should emit ConsensusReached on approval", async () => {
      await expect(registry.validateProposal(0, 8000, 3000, "All clear", true))
        .to.emit(registry, "ConsensusReached")
        .withArgs(0, "swap", "mETH", 9100, 8000);
    });

    it("Should emit ProposalRejected on rejection", async () => {
      await expect(registry.validateProposal(0, 8000, 3000, "Bad", false))
        .to.emit(registry, "ProposalRejected");
    });

    it("Should not allow double validation", async () => {
      await registry.validateProposal(0, 8000, 3000, "OK", true);
      await expect(registry.validateProposal(0, 8000, 3000, "Again", true))
        .to.be.revertedWith("Already validated");
    });
  });

  describe("Execution Recording", () => {
    it("Should record execution tx hash", async () => {
      await registry.submitProposal("swap", "mETH", ethers.parseEther("1"), 9100, "Go");
      await registry.validateProposal(0, 8000, 3000, "OK", true);
      const txHash = ethers.keccak256(ethers.toUtf8Bytes("fake-tx"));
      await registry.recordExecution(0, txHash);
      const proposal = await registry.proposals(0);
      expect(proposal.executionTxHash).to.equal(txHash);
    });

    it("Should reject recording for non-approved proposals", async () => {
      await registry.submitProposal("swap", "mETH", ethers.parseEther("1"), 9100, "Go");
      await registry.validateProposal(0, 8000, 3000, "No", false);
      const txHash = ethers.keccak256(ethers.toUtf8Bytes("fake-tx"));
      await expect(registry.recordExecution(0, txHash)).to.be.revertedWith("Not approved");
    });
  });

  describe("Recent Proposals", () => {
    it("Should return recent proposals", async () => {
      await registry.submitProposal("swap", "mETH", ethers.parseEther("1"), 9100, "First");
      await registry.submitProposal("hold", "mUSD", 0, 5000, "Second");
      await registry.submitProposal("swap", "mUSD", ethers.parseEther("2"), 8500, "Third");
      
      const recent = await registry.getRecentProposals(2);
      expect(recent.length).to.equal(2);
      expect(recent[1].reasoning).to.equal("Third");
    });
  });

  describe("Parameter Updates", () => {
    it("Should update consensus parameters", async () => {
      await registry.updateParameters(9000, 8000, 5000, 600);
      expect(await registry.minAnalystConfidence()).to.equal(9000);
      expect(await registry.minValidatorConfidence()).to.equal(8000);
      expect(await registry.maxRiskScore()).to.equal(5000);
      expect(await registry.proposalTTL()).to.equal(600);
    });
  });
});
