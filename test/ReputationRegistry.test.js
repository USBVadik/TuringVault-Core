const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TuringVaultReputationRegistry", function () {
  let registry, owner, rater, other;

  beforeEach(async function () {
    [owner, rater, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory(
      "TuringVaultReputationRegistry"
    );
    registry = await Factory.deploy();
    await registry.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set owner as authorized rater", async function () {
      expect(await registry.authorizedRaters(owner.address)).to.be.true;
    });

    it("Should start with zero feedback", async function () {
      expect(await registry.totalFeedbackCount()).to.equal(0);
    });
  });

  describe("Feedback Submission", function () {
    const agentId = 0;
    const reasoningHash = ethers.keccak256(
      ethers.toUtf8Bytes("test-reasoning")
    );

    it("Should submit positive feedback", async function () {
      await registry.submitFeedback(agentId, 50, reasoningHash, "profit_50bps");

      const [cumScore, total, positive, negative, winRate] =
        await registry.getReputation(agentId);
      expect(cumScore).to.equal(50);
      expect(total).to.equal(1);
      expect(positive).to.equal(1);
      expect(negative).to.equal(0);
      expect(winRate).to.equal(10000); // 100%
    });

    it("Should submit negative feedback", async function () {
      await registry.submitFeedback(agentId, -30, reasoningHash, "loss_30bps");

      const [cumScore, total, positive, negative] =
        await registry.getReputation(agentId);
      expect(cumScore).to.equal(-30);
      expect(total).to.equal(1);
      expect(positive).to.equal(0);
      expect(negative).to.equal(1);
    });

    it("Should accumulate multiple feedbacks", async function () {
      await registry.submitFeedback(agentId, 80, reasoningHash, "big_win");
      await registry.submitFeedback(agentId, -20, reasoningHash, "small_loss");
      await registry.submitFeedback(agentId, 40, reasoningHash, "medium_win");

      const [cumScore, total, positive, negative, winRate] =
        await registry.getReputation(agentId);
      expect(cumScore).to.equal(100); // 80 - 20 + 40
      expect(total).to.equal(3);
      expect(positive).to.equal(2);
      expect(negative).to.equal(1);
      expect(winRate).to.equal(6666); // 66.66%
    });

    it("Should reject unauthorized rater", async function () {
      await expect(
        registry
          .connect(other)
          .submitFeedback(agentId, 50, reasoningHash, "test")
      ).to.be.revertedWith("Not authorized rater");
    });

    it("Should reject score out of range", async function () {
      await expect(
        registry.submitFeedback(agentId, 101, reasoningHash, "test")
      ).to.be.revertedWith("Score out of range");
      await expect(
        registry.submitFeedback(agentId, -101, reasoningHash, "test")
      ).to.be.revertedWith("Score out of range");
    });

    it("Should emit FeedbackSubmitted event", async function () {
      await expect(
        registry.submitFeedback(agentId, 75, reasoningHash, "great_trade")
      )
        .to.emit(registry, "FeedbackSubmitted")
        .withArgs(agentId, owner.address, 75, reasoningHash, "great_trade");
    });
  });

  describe("PnL Recording", function () {
    const agentId = 0;
    const reasoningHash = ethers.keccak256(ethers.toUtf8Bytes("decision-hash"));

    it("Should record positive PnL", async function () {
      await registry.recordPnL(agentId, 230, reasoningHash);
      const [cumScore] = await registry.getReputation(agentId);
      expect(cumScore).to.equal(100); // Capped at 100
    });

    it("Should record negative PnL", async function () {
      await registry.recordPnL(agentId, -50, reasoningHash);
      const [cumScore] = await registry.getReputation(agentId);
      expect(cumScore).to.equal(-50);
    });

    it("Should cap extreme PnL at ±100", async function () {
      await registry.recordPnL(agentId, -500, reasoningHash);
      const [cumScore] = await registry.getReputation(agentId);
      expect(cumScore).to.equal(-100);
    });
  });

  describe("Authorized Raters", function () {
    it("Should authorize new rater", async function () {
      await registry.setAuthorizedRater(rater.address, true);
      expect(await registry.authorizedRaters(rater.address)).to.be.true;
    });

    it("Should revoke rater", async function () {
      await registry.setAuthorizedRater(rater.address, true);
      await registry.setAuthorizedRater(rater.address, false);
      expect(await registry.authorizedRaters(rater.address)).to.be.false;
    });

    it("Should only allow owner to manage raters", async function () {
      await expect(
        registry.connect(other).setAuthorizedRater(other.address, true)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });
  });

  describe("Feedback with Signature", function () {
    const agentId = 0;
    const reasoningHash = ethers.keccak256(
      ethers.toUtf8Bytes("signed-reasoning")
    );

    it("Should accept valid signature from authorized rater", async function () {
      // Owner is authorized rater, sign the message
      const messageHash = ethers.solidityPackedKeccak256(
        ["uint256", "int128", "bytes32", "string"],
        [agentId, 60, reasoningHash, "signed_win"]
      );
      const signature = await owner.signMessage(ethers.getBytes(messageHash));

      // Submit from another address but with valid sig
      await registry
        .connect(other)
        .submitFeedbackWithSignature(
          agentId,
          60,
          reasoningHash,
          "signed_win",
          signature
        );

      const [cumScore] = await registry.getReputation(agentId);
      expect(cumScore).to.equal(60);
    });
  });

  describe("View Functions", function () {
    it("Should return feedback by index", async function () {
      const reasoningHash = ethers.keccak256(ethers.toUtf8Bytes("view-test"));
      await registry.submitFeedback(0, 42, reasoningHash, "test_context");

      const [raterAddr, score, , hash, context] = await registry.getFeedback(
        0,
        0
      );
      expect(raterAddr).to.equal(owner.address);
      expect(score).to.equal(42);
      expect(hash).to.equal(reasoningHash);
      expect(context).to.equal("test_context");
    });

    it("Should return feedback count", async function () {
      const h = ethers.keccak256(ethers.toUtf8Bytes("count-test"));
      await registry.submitFeedback(0, 10, h, "a");
      await registry.submitFeedback(0, 20, h, "b");
      expect(await registry.getFeedbackCount(0)).to.equal(2);
    });
  });
});
