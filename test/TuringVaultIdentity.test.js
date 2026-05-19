const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TuringVaultIdentity", function () {
  let identity, owner, other;

  beforeEach(async () => {
    [owner, other] = await ethers.getSigners();
    const Identity = await ethers.getContractFactory("TuringVaultIdentity");
    identity = await Identity.deploy();
    await identity.waitForDeployment();
  });

  describe("Agent Registration", function () {
    it("should register an agent with URI", async () => {
      const uri = "ipfs://QmTestAgentMetadata";
      await identity.registerAgent(uri);
      expect(await identity.tokenURI(0)).to.equal(uri);
    });

    it("should increment token IDs", async () => {
      await identity.registerAgent("ipfs://agent1");
      await identity.registerAgent("ipfs://agent2");
      expect(await identity.tokenURI(0)).to.equal("ipfs://agent1");
      expect(await identity.tokenURI(1)).to.equal("ipfs://agent2");
    });

    it("should emit AgentRegistered event", async () => {
      await expect(identity.registerAgent("ipfs://test"))
        .to.emit(identity, "AgentRegistered")
        .withArgs(0, "ipfs://test");
    });

    it("should reject non-owner registration", async () => {
      await expect(identity.connect(other).registerAgent("ipfs://hack"))
        .to.be.revertedWithCustomError(identity, "OwnableUnauthorizedAccount");
    });

    it("should mint NFT to owner", async () => {
      await identity.registerAgent("ipfs://test");
      expect(await identity.ownerOf(0)).to.equal(owner.address);
    });
  });

  describe("Agent URI Update", function () {
    beforeEach(async () => {
      await identity.registerAgent("ipfs://original");
    });

    it("should update agent URI", async () => {
      await identity.updateAgentURI(0, "ipfs://updated");
      expect(await identity.tokenURI(0)).to.equal("ipfs://updated");
    });

    it("should emit AgentURIUpdated event", async () => {
      await expect(identity.updateAgentURI(0, "ipfs://new"))
        .to.emit(identity, "AgentURIUpdated")
        .withArgs(0, "ipfs://new");
    });

    it("should reject non-owner URI update", async () => {
      await expect(identity.connect(other).updateAgentURI(0, "ipfs://hack"))
        .to.be.revertedWithCustomError(identity, "OwnableUnauthorizedAccount");
    });
  });

  describe("ERC-721 Compliance", function () {
    it("should return correct name and symbol", async () => {
      expect(await identity.name()).to.equal("TuringVault Agent");
      expect(await identity.symbol()).to.equal("TVA");
    });

    it("should support ERC-721 interface", async () => {
      // ERC-721 interface ID: 0x80ac58cd
      expect(await identity.supportsInterface("0x80ac58cd")).to.be.true;
    });
  });
});
