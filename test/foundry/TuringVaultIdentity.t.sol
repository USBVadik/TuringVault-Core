// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../../contracts/TuringVaultIdentity.sol";

/**
 * @title Identity Foundry test suite
 * @notice Property tests for the ERC-8004 Identity Registry. Focuses
 *         on token-id monotonicity, ownership-gated mutation, and
 *         agentWallet EIP-712 signature flow.
 */
contract IdentityRegistryTest is Test {
    TuringVaultIdentity identity;
    address constant OWNER = address(0xA1);

    function setUp() public {
        vm.prank(OWNER);
        identity = new TuringVaultIdentity();
    }

    // ─── Sequential id allocation ────────────────────────────────

    function testFuzz_IdsAreSequential(uint8 nMints) public {
        nMints = uint8(bound(nMints, 1, 50));

        for (uint256 i = 0; i < nMints; i++) {
            address rater = address(uint160(0x1000 + i));
            vm.prank(rater);
            uint256 id = identity.register("ipfs://test");
            assertEq(id, i, "ids must be sequential");
        }

        assertEq(identity.totalAgents(), nMints);
    }

    // ─── URI auto-refresh ────────────────────────────────────────

    function test_OwnerCanUpdateURI() public {
        vm.prank(OWNER);
        uint256 id = identity.register("ipfs://initial");

        vm.prank(OWNER);
        identity.setAgentURI(id, "ipfs://updated");

        assertEq(identity.tokenURI(id), "ipfs://updated");
    }

    function test_NonOwnerCannotUpdateURI() public {
        vm.prank(OWNER);
        uint256 id = identity.register("ipfs://initial");

        vm.prank(address(0xB1));
        vm.expectRevert(bytes("Not authorized"));
        identity.setAgentURI(id, "ipfs://hijacked");
    }

    // ─── Metadata ────────────────────────────────────────────────

    function testFuzz_MetadataPersists(string memory key, bytes memory value) public {
        vm.assume(bytes(key).length > 0 && bytes(key).length < 64);
        vm.assume(value.length < 256);
        // Reserved key per the contract.
        vm.assume(
            keccak256(bytes(key)) != keccak256(bytes("agentWallet"))
        );

        vm.prank(OWNER);
        uint256 id = identity.register("ipfs://x");

        vm.prank(OWNER);
        identity.setMetadata(id, key, value);

        bytes memory got = identity.getMetadata(id, key);
        assertEq(got, value);
    }

    function test_AgentWalletKeyForbiddenInSetMetadata() public {
        vm.prank(OWNER);
        uint256 id = identity.register("ipfs://x");

        vm.prank(OWNER);
        vm.expectRevert(bytes("Use setAgentWallet()"));
        identity.setMetadata(id, "agentWallet", abi.encodePacked(address(0xC1)));
    }

    // ─── agentWallet flow with EIP-712 ───────────────────────────

    function test_SetAgentWalletWithValidSig() public {
        // Setup: mint by OWNER.
        vm.prank(OWNER);
        uint256 id = identity.register("ipfs://x");

        uint256 walletPk = 0xABCDEF;
        address walletAddr = vm.addr(walletPk);
        uint256 deadline = block.timestamp + 1 hours;

        bytes32 structHash = keccak256(
            abi.encode(
                identity.AGENT_WALLET_TYPEHASH(),
                id,
                walletAddr,
                deadline
            )
        );
        bytes32 typedDigest = _typedDataHash(structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(walletPk, typedDigest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(OWNER);
        identity.setAgentWallet(id, walletAddr, deadline, sig);

        assertEq(identity.getAgentWallet(id), walletAddr);
    }

    function test_SetAgentWalletExpiredSigReverts() public {
        vm.prank(OWNER);
        uint256 id = identity.register("ipfs://x");

        uint256 walletPk = 0xCAFE;
        address walletAddr = vm.addr(walletPk);
        uint256 deadline = block.timestamp + 1 hours;

        bytes32 structHash = keccak256(
            abi.encode(
                identity.AGENT_WALLET_TYPEHASH(),
                id,
                walletAddr,
                deadline
            )
        );
        bytes32 typedDigest = _typedDataHash(structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(walletPk, typedDigest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.warp(deadline + 1);

        vm.prank(OWNER);
        vm.expectRevert(bytes("Signature expired"));
        identity.setAgentWallet(id, walletAddr, deadline, sig);
    }

    function test_SetAgentWalletWrongSignerReverts() public {
        vm.prank(OWNER);
        uint256 id = identity.register("ipfs://x");

        uint256 attackerPk = 0xBAD;
        address claimedWallet = address(0xCAFE);
        uint256 deadline = block.timestamp + 1 hours;

        bytes32 structHash = keccak256(
            abi.encode(
                identity.AGENT_WALLET_TYPEHASH(),
                id,
                claimedWallet,
                deadline
            )
        );
        bytes32 typedDigest = _typedDataHash(structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(attackerPk, typedDigest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(OWNER);
        vm.expectRevert(bytes("Invalid signature"));
        identity.setAgentWallet(id, claimedWallet, deadline, sig);
    }

    function test_UnsetAgentWalletByOwner() public {
        // First set, then unset.
        vm.prank(OWNER);
        uint256 id = identity.register("ipfs://x");

        uint256 walletPk = 0xABCDEF;
        address walletAddr = vm.addr(walletPk);
        uint256 deadline = block.timestamp + 1 hours;

        bytes32 structHash = keccak256(
            abi.encode(
                identity.AGENT_WALLET_TYPEHASH(),
                id,
                walletAddr,
                deadline
            )
        );
        bytes32 typedDigest = _typedDataHash(structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(walletPk, typedDigest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(OWNER);
        identity.setAgentWallet(id, walletAddr, deadline, sig);

        vm.prank(OWNER);
        identity.unsetAgentWallet(id);

        assertEq(identity.getAgentWallet(id), address(0));
    }

    // ─── agentExists / lookup edges ──────────────────────────────

    function testFuzz_AgentExistsBound(uint256 nMints, uint256 query) public {
        nMints = bound(nMints, 0, 20);
        for (uint256 i = 0; i < nMints; i++) {
            vm.prank(OWNER);
            identity.register("ipfs://x");
        }
        bool expected = query < nMints;
        assertEq(identity.agentExists(query), expected);
    }

    // ─── EIP-712 helper ──────────────────────────────────────────

    function _typedDataHash(bytes32 structHash) internal view returns (bytes32) {
        // Re-derive the EIP-712 domain separator the contract uses.
        bytes32 domainSep = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes("TuringVaultIdentity")),
                keccak256(bytes("1")),
                block.chainid,
                address(identity)
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", domainSep, structHash));
    }
}
