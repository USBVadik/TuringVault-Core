// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../../contracts/TuringVaultValidationRegistry.sol";

/**
 * @title ValidationRegistry Foundry test suite
 * @notice Fuzz + invariant tests for the ERC-8004 Validation Registry.
 *         Companion to the Hardhat tests; this suite uses Foundry's
 *         property-based testing to surface edge cases that scripted
 *         tests can miss.
 */
contract ValidationRegistryTest is Test {
    TuringVaultValidationRegistry registry;

    address constant OWNER = address(0xA1);
    uint256 constant ANALYST_ID = 0;
    uint256 constant VALIDATOR_ID = 1;

    function setUp() public {
        vm.prank(OWNER);
        registry = new TuringVaultValidationRegistry(ANALYST_ID, VALIDATOR_ID);
    }

    function _getProposalStatus(uint256 id)
        internal
        view
        returns (TuringVaultValidationRegistry.ValidationStatus)
    {
        // Use a separate getter call via the contract interface to dodge
        // the stack-too-deep that destructuring 12-tuple triggers.
        return _readStatus(id);
    }

    function _readStatus(uint256 id)
        private
        view
        returns (TuringVaultValidationRegistry.ValidationStatus s)
    {
        // proposals(id) returns 12 fields. We only need field 10 (status).
        // Solidity getter for a dynamic-containing struct ABI-encodes
        // strings as offsets into a heap area. Easier to ask the
        // contract directly via low-level staticcall and only decode
        // the static slots we care about.
        (bool ok, bytes memory data) = address(registry).staticcall(
            abi.encodeWithSignature("proposals(uint256)", id)
        );
        require(ok, "getter failed");
        // Layout returned by a public mapping/array getter for our
        // Proposal struct (head section, dynamic fields are offsets):
        //   0  timestamp           (uint256)
        //   1  action              (string OFFSET)
        //   2  targetAsset         (string OFFSET)
        //   3  amountIn            (uint256)
        //   4  confidence          (uint256)
        //   5  reasoning           (string OFFSET)
        //   6  validatorConfidence (uint256)
        //   7  validatorReasoning  (string OFFSET)
        //   8  riskScore           (uint256)
        //   9  status              (uint8/enum)        ← target
        //   10 validatedAt         (uint256)
        //   11 executionTxHash     (bytes32)
        // Each head slot is 32 bytes. Offset = 9 * 32 = 0x120.
        uint256 statusUint;
        assembly {
            statusUint := mload(add(data, add(0x20, mul(9, 0x20))))
        }
        s = TuringVaultValidationRegistry.ValidationStatus(statusUint);
    }

    function test_ConstructorWiresIds() public view {
        assertEq(registry.analystTokenId(), ANALYST_ID);
        assertEq(registry.validatorTokenId(), VALIDATOR_ID);
        assertEq(registry.totalProposals(), 0);
        assertEq(registry.totalApproved(), 0);
        assertEq(registry.totalRejected(), 0);
    }

    function test_DefaultThresholds() public view {
        // Sanity: defaults match the constants used by the orchestrator.
        assertEq(registry.minAnalystConfidence(), 8500);
        assertEq(registry.minValidatorConfidence(), 7500);
        assertEq(registry.maxRiskScore(), 6000);
        assertEq(registry.proposalTTL(), 300);
    }

    // ─── Permission / access control ─────────────────────────────

    function test_OnlyOwnerCanSubmit() public {
        vm.prank(address(0xB1));
        vm.expectRevert();
        registry.submitProposal("swap", "mETH", 1e18, 9000, "test");
    }

    function test_OnlyOwnerCanValidate() public {
        vm.prank(OWNER);
        registry.submitProposal("swap", "mETH", 1e18, 9000, "test");

        vm.prank(address(0xB1));
        vm.expectRevert();
        registry.validateProposal(0, 8000, 3000, "ok", true);
    }

    // ─── Counter monotonicity ────────────────────────────────────

    /// totalProposals must equal approved + rejected for every cycle that completes.
    function testFuzz_CountersStayConsistent(
        uint256 nCycles,
        uint16 confidence,
        uint16 validatorConf,
        uint16 riskScore,
        bool approve
    ) public {
        nCycles = bound(nCycles, 1, 30);
        confidence = uint16(bound(confidence, 0, 10000));
        validatorConf = uint16(bound(validatorConf, 0, 10000));
        riskScore = uint16(bound(riskScore, 0, 10000));

        for (uint256 i = 0; i < nCycles; i++) {
            vm.prank(OWNER);
            uint256 id = registry.submitProposal(
                "swap",
                "mETH",
                1e18,
                confidence,
                "fuzz"
            );

            vm.prank(OWNER);
            registry.validateProposal(id, validatorConf, riskScore, "fuzz", approve);
        }

        assertEq(
            registry.totalProposals(),
            registry.totalApproved() + registry.totalRejected(),
            "approved + rejected must equal total"
        );
        assertEq(registry.totalProposals(), nCycles);
    }

    // ─── Consensus logic, exhaustive ─────────────────────────────

    /// Approval requires ALL of: validator-approves AND confidence>=8500
    /// AND validatorConfidence>=7500 AND riskScore<=6000.
    function testFuzz_ConsensusGatesAreANDed(
        uint16 confidence,
        uint16 validatorConf,
        uint16 riskScore,
        bool approve
    ) public {
        confidence = uint16(bound(confidence, 0, 10000));
        validatorConf = uint16(bound(validatorConf, 0, 10000));
        riskScore = uint16(bound(riskScore, 0, 10000));

        vm.prank(OWNER);
        uint256 id = registry.submitProposal(
            "swap", "mETH", 1e18, confidence, "fuzz"
        );

        vm.prank(OWNER);
        registry.validateProposal(id, validatorConf, riskScore, "fuzz", approve);

        bool shouldApprove = approve
            && confidence >= 8500
            && validatorConf >= 7500
            && riskScore <= 6000;

        TuringVaultValidationRegistry.ValidationStatus status = _readStatus(id);

        if (shouldApprove) {
            assertEq(
                uint256(status),
                uint256(TuringVaultValidationRegistry.ValidationStatus.Approved),
                "should APPROVE when all gates pass"
            );
        } else {
            assertEq(
                uint256(status),
                uint256(TuringVaultValidationRegistry.ValidationStatus.Rejected),
                "should REJECT if any gate fails"
            );
        }
    }

    // ─── TTL / freshness ─────────────────────────────────────────

    function test_ExpiredProposalCannotBeValidated() public {
        vm.prank(OWNER);
        uint256 id = registry.submitProposal("swap", "mETH", 1e18, 9000, "x");

        // Walk past TTL.
        vm.warp(block.timestamp + registry.proposalTTL() + 1);

        vm.prank(OWNER);
        vm.expectRevert(bytes("Proposal expired"));
        registry.validateProposal(id, 8000, 3000, "ok", true);
    }

    function testFuzz_FreshWithinTTL(uint256 elapsed) public {
        elapsed = bound(elapsed, 0, registry.proposalTTL());

        vm.prank(OWNER);
        uint256 id = registry.submitProposal("swap", "mETH", 1e18, 9000, "x");

        vm.warp(block.timestamp + elapsed);

        // Should NOT revert on freshness.
        vm.prank(OWNER);
        registry.validateProposal(id, 8000, 3000, "ok", true);
    }

    // ─── Idempotency ─────────────────────────────────────────────

    function test_DoubleValidationReverts() public {
        vm.prank(OWNER);
        uint256 id = registry.submitProposal("swap", "mETH", 1e18, 9000, "x");

        vm.prank(OWNER);
        registry.validateProposal(id, 8000, 3000, "ok", true);

        vm.prank(OWNER);
        vm.expectRevert(bytes("Already validated"));
        registry.validateProposal(id, 8000, 3000, "ok2", true);
    }

    function test_InvalidProposalIdReverts() public {
        vm.prank(OWNER);
        vm.expectRevert(bytes("Invalid proposal ID"));
        registry.validateProposal(999, 8000, 3000, "x", true);
    }
}
