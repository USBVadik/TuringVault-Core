// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../../contracts/TuringVaultReputationRegistry.sol";

/**
 * @title ReputationRegistry Foundry test suite
 * @notice Property tests for the ERC-8004 Reputation Registry. Focuses
 *         on score-bound enforcement, counter monotonicity, and
 *         signature-gated permissionless feedback.
 */
contract ReputationRegistryTest is Test {
    TuringVaultReputationRegistry registry;

    address constant OWNER = address(0xA1);
    uint256 constant AGENT_ID = 0;

    function setUp() public {
        vm.prank(OWNER);
        registry = new TuringVaultReputationRegistry();
    }

    // ─── Authorisation ───────────────────────────────────────────

    function test_OwnerIsAutoAuthorized() public view {
        assertTrue(registry.authorizedRaters(OWNER));
    }

    function test_NonOwnerCannotSubmit() public {
        vm.prank(address(0xB1));
        vm.expectRevert(bytes("Not authorized rater"));
        registry.submitFeedback(AGENT_ID, 50, bytes32(0), "test");
    }

    // ─── Score bounds ────────────────────────────────────────────

    function testFuzz_OutOfRangeScoreReverts(int128 score) public {
        vm.assume(score < -100 || score > 100);

        vm.prank(OWNER);
        vm.expectRevert(bytes("Score out of range"));
        registry.submitFeedback(AGENT_ID, score, bytes32(0), "fuzz");
    }

    function testFuzz_InRangeScoreAccepted(int128 score) public {
        score = int128(bound(int256(score), -100, 100));

        vm.prank(OWNER);
        registry.submitFeedback(AGENT_ID, score, bytes32(0), "fuzz");

        (
            int256 cumulative,
            uint256 totalFeedback,
            ,
            ,
        ) = registry.getReputation(AGENT_ID);

        assertEq(cumulative, int256(score));
        assertEq(totalFeedback, 1);
    }

    // ─── Cumulative monotonicity ─────────────────────────────────

    /// totalFeedback must equal positiveCount + negativeCount on every round.
    function testFuzz_FeedbackCountersConsistent(uint8 nRounds, int128 score) public {
        nRounds = uint8(bound(nRounds, 1, 30));
        score = int128(bound(int256(score), -100, 100));

        for (uint256 i = 0; i < nRounds; i++) {
            vm.prank(OWNER);
            registry.submitFeedback(AGENT_ID, score, bytes32(0), "fuzz");
        }

        (
            int256 cumulative,
            uint256 totalFeedback,
            uint256 positiveCount,
            uint256 negativeCount,
        ) = registry.getReputation(AGENT_ID);

        assertEq(totalFeedback, nRounds);
        assertEq(positiveCount + negativeCount, totalFeedback);
        assertEq(cumulative, int256(score) * int256(uint256(nRounds)));
    }

    // ─── recordPnL convenience ───────────────────────────────────

    function testFuzz_RecordPnLClampsAtBounds(int128 pnlBps) public {
        // Within int64 range to avoid string conversion overflow paths.
        pnlBps = int128(bound(int256(pnlBps), -1e9, 1e9));

        vm.prank(OWNER);
        registry.recordPnL(AGENT_ID, pnlBps, bytes32(0));

        (int256 cumulative,,,, ) = registry.getReputation(AGENT_ID);

        // Score must be clamped to [-100, 100].
        assertGe(cumulative, -100);
        assertLe(cumulative, 100);

        // Sign of the cumulative score must match sign of input pnl
        // (or be zero exactly when pnl was zero).
        if (pnlBps > 0) assertGt(cumulative, 0);
        else if (pnlBps < 0) assertLt(cumulative, 0);
        else assertEq(cumulative, 0);
    }

    function test_RecordPnLOnlyAuthorized() public {
        vm.prank(address(0xB1));
        vm.expectRevert(bytes("Not authorized rater"));
        registry.recordPnL(AGENT_ID, 50, bytes32(0));
    }

    // ─── Win rate ────────────────────────────────────────────────

    function test_WinRateTracksPositive() public {
        // Submit 4 positive (score 50) and 1 negative (score -50).
        for (uint256 i = 0; i < 4; i++) {
            vm.prank(OWNER);
            registry.submitFeedback(AGENT_ID, 50, bytes32(0), "win");
        }
        vm.prank(OWNER);
        registry.submitFeedback(AGENT_ID, -50, bytes32(0), "loss");

        (,,,, uint256 winRate) = registry.getReputation(AGENT_ID);
        // 4/5 = 80% = 8000 bps.
        assertEq(winRate, 8000);
    }

    // ─── Cross-agent isolation ───────────────────────────────────

    /// Feedback against agent X must not leak into agent Y's totals.
    function testFuzz_CrossAgentIsolation(int128 scoreA, int128 scoreB) public {
        scoreA = int128(bound(int256(scoreA), -100, 100));
        scoreB = int128(bound(int256(scoreB), -100, 100));

        vm.prank(OWNER);
        registry.submitFeedback(0, scoreA, bytes32(0), "a");

        vm.prank(OWNER);
        registry.submitFeedback(1, scoreB, bytes32(0), "b");

        (int256 cumA,,,, ) = registry.getReputation(0);
        (int256 cumB,,,, ) = registry.getReputation(1);

        assertEq(cumA, int256(scoreA));
        assertEq(cumB, int256(scoreB));
    }
}
