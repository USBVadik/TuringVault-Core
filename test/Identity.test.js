const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TuringVaultIdentity (ERC-8004 Spec)", function () {
  let identity, owner, addr1, addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("TuringVaultIdentity");
    identity = await factory.deploy();
    await identity.waitForDeployment();
  });

  describe("Registration", function () {
    it("should register agent with URI", async function () {
      const tx = await identity["register(string)"]("ipfs://QmAgent1");
      const receipt = await tx.wait();
      const event = receipt.logs.find((l) => l.fragment?.name === "Registered");
      expect(event).to.exist;
      expect(await identity.tokenURI(0)).to.equal("ipfs://QmAgent1");
    });

    it("should register agent with URI and metadata", async function () {
      const metadata = [
        { metadataKey: "model", metadataValue: ethers.toUtf8Bytes("GLM-5") },
        { metadataKey: "version", metadataValue: ethers.toUtf8Bytes("1.0.0") },
      ];
      await identity["register(string,(string,bytes)[])"](
        "ipfs://QmAgent2",
        metadata
      );

      const modelData = await identity.getMetadata(0, "model");
      expect(ethers.toUtf8String(modelData)).to.equal("GLM-5");
    });

    it("should register agent without URI", async function () {
      await identity["register()"]();
      expect(await identity.totalAgents()).to.equal(1);
      expect(await identity.agentExists(0)).to.be.true;
    });

    it("should reject agentWallet metadata key", async function () {
      const metadata = [
        {
          metadataKey: "agentWallet",
          metadataValue: ethers.toUtf8Bytes("fake"),
        },
      ];
      await expect(
        identity["register(string,(string,bytes)[])"]("ipfs://test", metadata)
      ).to.be.revertedWith("Use setAgentWallet()");
    });

    it("should increment token IDs", async function () {
      await identity["register()"]();
      await identity["register()"]();
      expect(await identity.totalAgents()).to.equal(2);
      expect(await identity.ownerOf(0)).to.equal(owner.address);
      expect(await identity.ownerOf(1)).to.equal(owner.address);
    });
  });

  describe("Metadata", function () {
    beforeEach(async function () {
      await identity["register(string)"]("ipfs://QmTest");
    });

    it("should set and get metadata", async function () {
      await identity.setMetadata(0, "strategy", ethers.toUtf8Bytes("momentum"));
      const data = await identity.getMetadata(0, "strategy");
      expect(ethers.toUtf8String(data)).to.equal("momentum");
    });

    it("should reject metadata from non-owner", async function () {
      await expect(
        identity.connect(addr1).setMetadata(0, "test", ethers.toUtf8Bytes("x"))
      ).to.be.revertedWith("Not authorized");
    });

    it("should update agent URI", async function () {
      await identity.setAgentURI(0, "ipfs://QmUpdated");
      expect(await identity.tokenURI(0)).to.equal("ipfs://QmUpdated");
    });
  });

  describe("Agent Wallet (EIP-712)", function () {
    let agentId;

    beforeEach(async function () {
      await identity["register(string)"]("ipfs://QmWallet");
      agentId = 0;
    });

    it("should set agent wallet with valid signature", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const domain = {
        name: "TuringVaultIdentity",
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await identity.getAddress(),
      };
      const types = {
        SetAgentWallet: [
          { name: "agentId", type: "uint256" },
          { name: "newWallet", type: "address" },
          { name: "deadline", type: "uint256" },
        ],
      };
      const value = { agentId, newWallet: addr1.address, deadline };
      const signature = await addr1.signTypedData(domain, types, value);

      await identity.setAgentWallet(
        agentId,
        addr1.address,
        deadline,
        signature
      );
      expect(await identity.getAgentWallet(agentId)).to.equal(addr1.address);
    });

    it("should reject expired signature", async function () {
      const deadline = Math.floor(Date.now() / 1000) - 3600; // expired
      const domain = {
        name: "TuringVaultIdentity",
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await identity.getAddress(),
      };
      const types = {
        SetAgentWallet: [
          { name: "agentId", type: "uint256" },
          { name: "newWallet", type: "address" },
          { name: "deadline", type: "uint256" },
        ],
      };
      const value = { agentId, newWallet: addr1.address, deadline };
      const signature = await addr1.signTypedData(domain, types, value);

      await expect(
        identity.setAgentWallet(agentId, addr1.address, deadline, signature)
      ).to.be.revertedWith("Signature expired");
    });

    it("should unset agent wallet", async function () {
      // First set it
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const domain = {
        name: "TuringVaultIdentity",
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await identity.getAddress(),
      };
      const types = {
        SetAgentWallet: [
          { name: "agentId", type: "uint256" },
          { name: "newWallet", type: "address" },
          { name: "deadline", type: "uint256" },
        ],
      };
      const value = { agentId, newWallet: addr1.address, deadline };
      const signature = await addr1.signTypedData(domain, types, value);
      await identity.setAgentWallet(
        agentId,
        addr1.address,
        deadline,
        signature
      );

      // Then unset
      await identity.unsetAgentWallet(agentId);
      expect(await identity.getAgentWallet(agentId)).to.equal(
        ethers.ZeroAddress
      );
    });
  });

  describe("Legacy compatibility", function () {
    it("should support registerAgent()", async function () {
      await identity.registerAgent("ipfs://legacy");
      expect(await identity.tokenURI(0)).to.equal("ipfs://legacy");
    });
  });
});
