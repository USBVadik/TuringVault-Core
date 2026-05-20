// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title TuringVaultReputationRegistry
 * @notice ERC-8004 Reputation Registry — tracks agent performance with signed feedback
 * @dev Implements pluggable trust model with EIP-191 signature verification
 * 
 * Records:
 *   - PnL after each trading cycle
 *   - Win/loss ratio
 *   - Cumulative reputation score (int128)
 *   - Anti-Sybil: feedback requires valid signature from authorized raters
 */
contract TuringVaultReputationRegistry is Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    struct FeedbackEntry {
        address rater;          // Who submitted the feedback
        uint256 agentId;        // Agent identity token ID
        int128 score;           // Reputation delta (-100 to +100)
        uint256 timestamp;      // Block timestamp
        bytes32 reasoningHash;  // Hash of off-chain reasoning proof (IPFS CID hash)
        string context;         // Brief description (e.g., "swap_mETH_profit_2.3%")
    }

    struct AgentReputation {
        int256 cumulativeScore;     // Sum of all feedback scores
        uint256 totalFeedback;      // Number of feedback entries
        uint256 positiveCount;      // Entries with score > 0
        uint256 negativeCount;      // Entries with score <= 0
        uint256 lastUpdateBlock;    // Last feedback block
        int128 bestScore;           // Highest single score received
        int128 worstScore;          // Lowest single score received
    }

    // Agent ID => reputation stats
    mapping(uint256 => AgentReputation) public reputations;
    
    // Agent ID => all feedback entries
    mapping(uint256 => FeedbackEntry[]) public feedbackHistory;
    
    // Authorized raters (can submit feedback without signature)
    mapping(address => bool) public authorizedRaters;
    
    // Total feedback across all agents
    uint256 public totalFeedbackCount;

    // Events
    event FeedbackSubmitted(
        uint256 indexed agentId,
        address indexed rater,
        int128 score,
        bytes32 reasoningHash,
        string context
    );
    event RaterAuthorized(address indexed rater, bool status);

    constructor() Ownable(msg.sender) {
        // Owner is automatically an authorized rater
        authorizedRaters[msg.sender] = true;
    }

    /**
     * @notice Submit reputation feedback for an agent (authorized rater)
     * @param agentId The agent's identity token ID
     * @param score Reputation delta (-100 to +100)
     * @param reasoningHash Hash of the full reasoning proof on IPFS
     * @param context Brief human-readable context
     */
    function submitFeedback(
        uint256 agentId,
        int128 score,
        bytes32 reasoningHash,
        string calldata context
    ) external {
        require(authorizedRaters[msg.sender], "Not authorized rater");
        require(score >= -100 && score <= 100, "Score out of range");
        
        _recordFeedback(agentId, msg.sender, score, reasoningHash, context);
    }

    /**
     * @notice Submit feedback with EIP-191 signature (permissionless, anti-Sybil)
     * @param agentId The agent's identity token ID
     * @param score Reputation delta
     * @param reasoningHash Hash of reasoning proof
     * @param context Brief context
     * @param signature EIP-191 signature from an authorized rater
     */
    function submitFeedbackWithSignature(
        uint256 agentId,
        int128 score,
        bytes32 reasoningHash,
        string calldata context,
        bytes calldata signature
    ) external {
        require(score >= -100 && score <= 100, "Score out of range");
        
        // Verify signature
        bytes32 messageHash = keccak256(abi.encodePacked(
            agentId, score, reasoningHash, context
        ));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(signature);
        
        require(authorizedRaters[signer], "Signer not authorized");
        
        _recordFeedback(agentId, signer, score, reasoningHash, context);
    }

    /**
     * @notice Record PnL-based feedback (convenience for orchestrator)
     * @param agentId Agent token ID
     * @param pnlBps PnL in basis points (e.g., 230 = +2.30%, -150 = -1.50%)
     * @param reasoningHash IPFS hash of the decision that led to this PnL
     */
    function recordPnL(
        uint256 agentId,
        int128 pnlBps,
        bytes32 reasoningHash
    ) external {
        require(authorizedRaters[msg.sender], "Not authorized rater");
        
        // Convert PnL bps to score: cap at ±100
        int128 score = pnlBps > 100 ? int128(100) : (pnlBps < -100 ? int128(-100) : pnlBps);
        
        string memory context = pnlBps >= 0 
            ? string(abi.encodePacked("profit_", _intToString(pnlBps), "bps"))
            : string(abi.encodePacked("loss_", _intToString(-pnlBps), "bps"));
            
        _recordFeedback(agentId, msg.sender, score, reasoningHash, context);
    }

    // === VIEW FUNCTIONS ===

    /**
     * @notice Get agent's reputation summary
     */
    function getReputation(uint256 agentId) external view returns (
        int256 cumulativeScore,
        uint256 totalFeedback,
        uint256 positiveCount,
        uint256 negativeCount,
        uint256 winRate // in basis points (e.g., 7500 = 75%)
    ) {
        AgentReputation storage rep = reputations[agentId];
        cumulativeScore = rep.cumulativeScore;
        totalFeedback = rep.totalFeedback;
        positiveCount = rep.positiveCount;
        negativeCount = rep.negativeCount;
        winRate = rep.totalFeedback > 0 
            ? (rep.positiveCount * 10000) / rep.totalFeedback 
            : 0;
    }

    /**
     * @notice Get feedback entry by index
     */
    function getFeedback(uint256 agentId, uint256 index) external view returns (
        address rater,
        int128 score,
        uint256 timestamp,
        bytes32 reasoningHash,
        string memory context
    ) {
        FeedbackEntry storage entry = feedbackHistory[agentId][index];
        return (entry.rater, entry.score, entry.timestamp, entry.reasoningHash, entry.context);
    }

    /**
     * @notice Get total feedback count for an agent
     */
    function getFeedbackCount(uint256 agentId) external view returns (uint256) {
        return feedbackHistory[agentId].length;
    }

    // === ADMIN ===

    function setAuthorizedRater(address rater, bool status) external onlyOwner {
        authorizedRaters[rater] = status;
        emit RaterAuthorized(rater, status);
    }

    // === INTERNAL ===

    function _recordFeedback(
        uint256 agentId,
        address rater,
        int128 score,
        bytes32 reasoningHash,
        string memory context
    ) internal {
        // Update reputation stats
        AgentReputation storage rep = reputations[agentId];
        rep.cumulativeScore += int256(score);
        rep.totalFeedback++;
        rep.lastUpdateBlock = block.number;
        
        if (score > 0) {
            rep.positiveCount++;
        } else {
            rep.negativeCount++;
        }
        
        if (score > rep.bestScore) rep.bestScore = score;
        if (score < rep.worstScore) rep.worstScore = score;

        // Store feedback entry
        feedbackHistory[agentId].push(FeedbackEntry({
            rater: rater,
            agentId: agentId,
            score: score,
            timestamp: block.timestamp,
            reasoningHash: reasoningHash,
            context: context
        }));

        totalFeedbackCount++;
        
        emit FeedbackSubmitted(agentId, rater, score, reasoningHash, context);
    }

    function _intToString(int128 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint128 uval = value < 0 ? uint128(-value) : uint128(value);
        uint128 temp = uval;
        uint128 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (uval != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uval % 10));
            uval /= 10;
        }
        return string(buffer);
    }
}
