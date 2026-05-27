const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TuringVaultValidation (Pre-Action Checks)", function () {
  let validation, owner, validator, attacker;

  beforeEach(async function () {
    [owner, validator, attacker] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("TuringVaultValidation");
    validation = await factory.deploy();
    await validation.waitForDeployment();

    // Authorize validator
    await validation.authorizeValidator(validator.address);
  });

  describe("Validation Request", function () {
    it("should create validation request", async function () {
      const requestHash = ethers.keccak256(
        ethers.toUtf8Bytes("swap_mETH_USDY_0.5")
      );

      const tx = await validation.validationRequest(
        validator.address,
        0, // agentId
        "ipfs://QmAnalysis1",
        requestHash
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (l) => l.fragment?.name === "ValidationRequest"
      );
      expect(event).to.exist;
      expect(await validation.requestExists(requestHash)).to.be.true;
    });

    it("should reject self-validation", async function () {
      const requestHash = ethers.keccak256(ethers.toUtf8Bytes("self"));
      await expect(
        validation.validationRequest(
          owner.address,
          0,
          "ipfs://test",
          requestHash
        )
      ).to.be.revertedWith("Self-validation not allowed");
    });

    it("should reject duplicate requests", async function () {
      const requestHash = ethers.keccak256(ethers.toUtf8Bytes("dup"));
      await validation.validationRequest(
        validator.address,
        0,
        "ipfs://1",
        requestHash
      );
      await expect(
        validation.validationRequest(
          validator.address,
          0,
          "ipfs://2",
          requestHash
        )
      ).to.be.revertedWith("Request already exists");
    });

    it("should reject from non-owner", async function () {
      const requestHash = ethers.keccak256(ethers.toUtf8Bytes("unauth"));
      await expect(
        validation
          .connect(attacker)
          .validationRequest(validator.address, 0, "ipfs://x", requestHash)
      ).to.be.reverted;
    });
  });

  describe("Validation Response", function () {
    let requestHash;

    beforeEach(async function () {
      requestHash = ethers.keccak256(ethers.toUtf8Bytes("trade_intent_1"));
      await validation.validationRequest(
        validator.address,
        0,
        "ipfs://QmIntent",
        requestHash
      );
    });

    it("should accept response from authorized validator", async function () {
      const responseHash = ethers.keccak256(ethers.toUtf8Bytes("evidence"));
      await validation.connect(validator).validationResponse(
        requestHash,
        85, // confidence score
        "ipfs://QmEvidence",
        responseHash,
        "trade"
      );

      const [vAddr, agentId, response, rHash, tag, lastUpdate] =
        await validation.getValidationStatus(requestHash);
      expect(response).to.equal(85);
      expect(tag).to.equal("trade");
    });

    it("should reject from unauthorized address", async function () {
      await expect(
        validation
          .connect(attacker)
          .validationResponse(
            requestHash,
            90,
            "ipfs://fake",
            ethers.ZeroHash,
            "hack"
          )
      ).to.be.revertedWith("Not authorized validator");
    });

    it("should reject score > 100", async function () {
      await expect(
        validation
          .connect(validator)
          .validationResponse(requestHash, 101, "", ethers.ZeroHash, "")
      ).to.be.revertedWith("Score must be 0-100");
    });
  });

  describe("Pre-Action Check (isActionApproved)", function () {
    let requestHash;

    beforeEach(async function () {
      requestHash = ethers.keccak256(ethers.toUtf8Bytes("action_check"));
      await validation.validationRequest(
        validator.address,
        0,
        "ipfs://QmCheck",
        requestHash
      );
    });

    it("should return NOT approved before response", async function () {
      const [approved, score, expired] = await validation.isActionApproved(
        requestHash
      );
      expect(approved).to.be.false;
      expect(score).to.equal(0);
      expect(expired).to.be.false;
    });

    it("should return APPROVED after high score", async function () {
      await validation
        .connect(validator)
        .validationResponse(requestHash, 80, "", ethers.ZeroHash, "trade");
      const [approved, score, expired] = await validation.isActionApproved(
        requestHash
      );
      expect(approved).to.be.true;
      expect(score).to.equal(80);
    });

    it("should return NOT approved after low score", async function () {
      await validation
        .connect(validator)
        .validationResponse(requestHash, 30, "", ethers.ZeroHash, "risky");
      const [approved, score, expired] = await validation.isActionApproved(
        requestHash
      );
      expect(approved).to.be.false;
      expect(score).to.equal(30);
    });

    it("should return expired after timeout", async function () {
      // Mine blocks to pass timeout
      await ethers.provider.send("evm_increaseTime", [301]);
      await ethers.provider.send("evm_mine");

      const [approved, score, expired] = await validation.isActionApproved(
        requestHash
      );
      expect(approved).to.be.false;
      expect(expired).to.be.true;
    });

    it("should return false for non-existent request", async function () {
      const fakeHash = ethers.keccak256(ethers.toUtf8Bytes("nonexistent"));
      const [approved, score, expired] = await validation.isActionApproved(
        fakeHash
      );
      expect(approved).to.be.false;
      expect(score).to.equal(0);
    });
  });

  describe("Summary", function () {
    it("should return aggregated stats", async function () {
      // Create multiple validated requests
      for (let i = 0; i < 3; i++) {
        const hash = ethers.keccak256(ethers.toUtf8Bytes(`req_${i}`));
        await validation.validationRequest(
          validator.address,
          0,
          `ipfs://req${i}`,
          hash
        );
        await validation
          .connect(validator)
          .validationResponse(hash, 70 + i * 10, "", ethers.ZeroHash, "trade");
      }

      const [count, avg] = await validation.getSummary(0, [], "trade");
      expect(count).to.equal(3);
      expect(avg).to.equal(80); // (70+80+90)/3 = 80
    });
  });

  describe("Admin", function () {
    it("should authorize/revoke validators", async function () {
      await validation.authorizeValidator(attacker.address);
      expect(await validation.authorizedValidators(attacker.address)).to.be
        .true;

      await validation.revokeValidator(attacker.address);
      expect(await validation.authorizedValidators(attacker.address)).to.be
        .false;
    });

    it("should update config", async function () {
      await validation.updateConfig(75, 600);
      expect(await validation.minPassScore()).to.equal(75);
      expect(await validation.validationTimeout()).to.equal(600);
    });

    it("should reject invalid config", async function () {
      await expect(validation.updateConfig(101, 300)).to.be.revertedWith(
        "Invalid score"
      );
      await expect(validation.updateConfig(50, 30)).to.be.revertedWith(
        "Timeout too short"
      );
    });
  });
});
