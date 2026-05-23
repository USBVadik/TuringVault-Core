// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TuringVaultValidationRegistry
 * @notice On-chain consensus layer for multi-agent AI decisions
 * @dev Implements a 2-of-2 validation pattern:
 *      1. Analyst Agent proposes a decision
 *      2. Validator Agent independently verifies it
 *      3. Only consensus decisions get executed
 *      
 *      This creates cryptographic Proof-of-Reasoning where
 *      TWO independent AI models must agree before capital moves.
 */
contract TuringVaultValidationRegistry is Ownable {

    enum ValidationStatus { Pending, Approved, Rejected, Expired }

    struct Proposal {
        // Analyst Agent's proposal
        uint256 timestamp;
        string action;           // "swap" | "hold"
        string targetAsset;      // "mETH" | "mUSD"
        uint256 amountIn;
        uint256 confidence;      // 0-10000 bps from Analyst
        string reasoning;        // Analyst's full reasoning

        // Validator Agent's assessment
        uint256 validatorConfidence;  // 0-10000 bps from Validator
        string validatorReasoning;    // Validator's independent analysis
        uint256 riskScore;            // 0-10000 (0 = safe, 10000 = extreme risk)
        
        // Consensus result
        ValidationStatus status;
        uint256 validatedAt;
        bytes32 executionTxHash;      // filled after execution
    }

    // Storage
    Proposal[] public proposals;
    uint256 public totalProposals;
    uint256 public totalApproved;
    uint256 public totalRejected;
    
    // Consensus parameters
    uint256 public minAnalystConfidence = 8500;   // 85%
    uint256 public minValidatorConfidence = 7500; // 75%
    uint256 public maxRiskScore = 6000;           // 60% risk tolerance
    uint256 public proposalTTL = 300;             // 5 min validity

    // Agent identities (ERC-8004 token IDs)
    uint256 public analystTokenId;
    uint256 public validatorTokenId;

    // Events
    event ProposalCreated(
        uint256 indexed proposalId,
        string action,
        string targetAsset,
        uint256 confidence,
        string reasoning
    );

    event ProposalValidated(
        uint256 indexed proposalId,
        ValidationStatus status,
        uint256 validatorConfidence,
        uint256 riskScore,
        string validatorReasoning
    );

    event ConsensusReached(
        uint256 indexed proposalId,
        string action,
        string targetAsset,
        uint256 analystConfidence,
        uint256 validatorConfidence
    );

    event ProposalRejected(
        uint256 indexed proposalId,
        string reason
    );

    constructor(uint256 _analystTokenId, uint256 _validatorTokenId) Ownable(msg.sender) {
        analystTokenId = _analystTokenId;
        validatorTokenId = _validatorTokenId;
    }

    /**
     * @notice Analyst Agent submits a trading proposal
     * @dev Called by orchestrator after Analyst LLM produces a decision
     */
    function submitProposal(
        string memory action,
        string memory targetAsset,
        uint256 amountIn,
        uint256 confidence,
        string memory reasoning
    ) external onlyOwner returns (uint256) {
        uint256 proposalId = proposals.length;
        
        proposals.push(Proposal({
            timestamp: block.timestamp,
            action: action,
            targetAsset: targetAsset,
            amountIn: amountIn,
            confidence: confidence,
            reasoning: reasoning,
            validatorConfidence: 0,
            validatorReasoning: "",
            riskScore: 0,
            status: ValidationStatus.Pending,
            validatedAt: 0,
            executionTxHash: bytes32(0)
        }));

        totalProposals++;

        emit ProposalCreated(proposalId, action, targetAsset, confidence, reasoning);
        return proposalId;
    }

    /**
     * @notice Validator Agent reviews and votes on a proposal
     * @dev Called by orchestrator after Validator LLM independently assesses the proposal
     */
    function validateProposal(
        uint256 proposalId,
        uint256 validatorConfidence,
        uint256 riskScore,
        string memory validatorReasoning,
        bool approved
    ) external onlyOwner {
        require(proposalId < proposals.length, "Invalid proposal ID");
        Proposal storage p = proposals[proposalId];
        require(p.status == ValidationStatus.Pending, "Already validated");
        require(block.timestamp - p.timestamp <= proposalTTL, "Proposal expired");

        p.validatorConfidence = validatorConfidence;
        p.validatorReasoning = validatorReasoning;
        p.riskScore = riskScore;
        p.validatedAt = block.timestamp;

        // Consensus logic: both agents must agree AND meet thresholds
        bool consensusReached = approved
            && p.confidence >= minAnalystConfidence
            && validatorConfidence >= minValidatorConfidence
            && riskScore <= maxRiskScore;

        if (consensusReached) {
            p.status = ValidationStatus.Approved;
            totalApproved++;
            emit ConsensusReached(proposalId, p.action, p.targetAsset, p.confidence, validatorConfidence);
        } else {
            p.status = ValidationStatus.Rejected;
            totalRejected++;
            
            string memory reason;
            if (!approved) reason = "Validator rejected";
            else if (p.confidence < minAnalystConfidence) reason = "Analyst confidence too low";
            else if (validatorConfidence < minValidatorConfidence) reason = "Validator confidence too low";
            else reason = "Risk score too high";
            
            emit ProposalRejected(proposalId, reason);
        }

        emit ProposalValidated(proposalId, p.status, validatorConfidence, riskScore, validatorReasoning);
    }

    /**
     * @notice Record execution tx hash after swap is executed
     */
    function recordExecution(uint256 proposalId, bytes32 txHash) external onlyOwner {
        require(proposalId < proposals.length, "Invalid proposal ID");
        require(proposals[proposalId].status == ValidationStatus.Approved, "Not approved");
        proposals[proposalId].executionTxHash = txHash;
    }

    /**
     * @notice Update consensus parameters
     */
    function updateParameters(
        uint256 _minAnalystConfidence,
        uint256 _minValidatorConfidence,
        uint256 _maxRiskScore,
        uint256 _proposalTTL
    ) external onlyOwner {
        minAnalystConfidence = _minAnalystConfidence;
        minValidatorConfidence = _minValidatorConfidence;
        maxRiskScore = _maxRiskScore;
        proposalTTL = _proposalTTL;
    }

    /**
     * @notice Get recent proposals for dashboard
     */
    function getRecentProposals(uint256 count) external view returns (Proposal[] memory) {
        if (proposals.length == 0) return new Proposal[](0);
        
        uint256 length = proposals.length > count ? count : proposals.length;
        uint256 start = proposals.length - length;
        
        Proposal[] memory recent = new Proposal[](length);
        for (uint256 i = 0; i < length; i++) {
            recent[i] = proposals[start + i];
        }
        return recent;
    }

    /**
     * @notice Mark expired proposals as Expired (cleanup)
     */
    function expireProposal(uint256 proposalId) external {
        require(proposalId < proposals.length, "Invalid proposal ID");
        Proposal storage p = proposals[proposalId];
        require(p.status == ValidationStatus.Pending, "Not pending");
        require(block.timestamp - p.timestamp > proposalTTL, "Not yet expired");
        p.status = ValidationStatus.Expired;
    }

    /**
     * @notice Get consensus rate (approved / total)
     */
    function getConsensusRate() external view returns (uint256 approved, uint256 rejected, uint256 total) {
        return (totalApproved, totalRejected, totalProposals);
    }
}
