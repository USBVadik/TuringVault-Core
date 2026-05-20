// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TuringVaultValidation
 * @notice ERC-8004 compliant Validation Registry — Pre-Action Checks
 * @dev Enables AI agent to request validation BEFORE executing trades.
 *      Validator (Claude) must approve before execution proceeds.
 *      Implements Jan 2026 Spec validationRequest/validationResponse pattern.
 *
 *      Flow: AI Intent → validationRequest() → Validator analyzes → 
 *            validationResponse() → getValidationStatus() → ONLY THEN execute
 */
contract TuringVaultValidation is Ownable {
    
    // ============ Structs ============
    
    struct ValidationRecord {
        address validatorAddress;
        uint256 agentId;
        string requestURI;          // IPFS URI to full analysis
        uint256 requestTimestamp;
        uint8 response;             // 0-100 confidence score
        string responseURI;         // IPFS URI to validation evidence  
        bytes32 responseHash;
        string tag;                 // e.g., "trade", "rebalance", "stake"
        uint256 responseTimestamp;
        bool responded;
    }

    // ============ State ============

    // requestHash => ValidationRecord
    mapping(bytes32 => ValidationRecord) public validations;
    
    // agentId => requestHashes[]
    mapping(uint256 => bytes32[]) public agentValidations;
    
    // validatorAddress => requestHashes[]
    mapping(address => bytes32[]) public validatorRequests;

    // Authorized validators (addresses that can respond)
    mapping(address => bool) public authorizedValidators;

    // Minimum score to pass validation (0-100)
    uint8 public minPassScore = 60;

    // Validation timeout (seconds) — auto-reject if not responded
    uint256 public validationTimeout = 300; // 5 minutes

    // ============ Events (ERC-8004 spec) ============

    event ValidationRequest(
        address indexed validatorAddress,
        uint256 indexed agentId,
        string requestURI,
        bytes32 indexed requestHash
    );

    event ValidationResponse(
        address indexed validatorAddress,
        uint256 indexed agentId,
        bytes32 indexed requestHash,
        uint8 response,
        string responseURI,
        bytes32 responseHash,
        string tag
    );

    event ValidatorAuthorized(address indexed validator);
    event ValidatorRevoked(address indexed validator);
    event ConfigUpdated(uint8 minPassScore, uint256 validationTimeout);

    // ============ Constructor ============

    constructor() Ownable(msg.sender) {
        // Owner is first authorized validator
        authorizedValidators[msg.sender] = true;
        emit ValidatorAuthorized(msg.sender);
    }

    // ============ Core Functions ============

    /**
     * @notice Request validation for an AI agent's proposed action
     * @param validatorAddress The validator who should respond
     * @param agentId The agent requesting validation (NFT tokenId)
     * @param requestURI IPFS URI pointing to the full analysis/intent
     * @param requestHash Keccak256 hash of the request payload
     */
    function validationRequest(
        address validatorAddress,
        uint256 agentId,
        string calldata requestURI,
        bytes32 requestHash
    ) external onlyOwner {
        require(validatorAddress != address(0), "Invalid validator");
        require(validatorAddress != msg.sender, "Self-validation not allowed");
        require(!_requestExists(requestHash), "Request already exists");

        validations[requestHash] = ValidationRecord({
            validatorAddress: validatorAddress,
            agentId: agentId,
            requestURI: requestURI,
            requestTimestamp: block.timestamp,
            response: 0,
            responseURI: "",
            responseHash: bytes32(0),
            tag: "",
            responseTimestamp: 0,
            responded: false
        });

        agentValidations[agentId].push(requestHash);
        validatorRequests[validatorAddress].push(requestHash);

        emit ValidationRequest(validatorAddress, agentId, requestURI, requestHash);
    }

    /**
     * @notice Provide validation response (approve/reject with score)
     * @param requestHash The hash of the validation request
     * @param response Validation score (0-100, higher = more confident)
     * @param responseURI URI to validation evidence
     * @param responseHash Hash of response data
     * @param tag Categorization tag
     */
    function validationResponse(
        bytes32 requestHash,
        uint8 response,
        string calldata responseURI,
        bytes32 responseHash,
        string calldata tag
    ) external {
        ValidationRecord storage record = validations[requestHash];
        require(record.requestTimestamp > 0, "Request not found");
        require(
            msg.sender == record.validatorAddress || authorizedValidators[msg.sender],
            "Not authorized validator"
        );
        require(response <= 100, "Score must be 0-100");

        record.response = response;
        record.responseURI = responseURI;
        record.responseHash = responseHash;
        record.tag = tag;
        record.responseTimestamp = block.timestamp;
        record.responded = true;

        emit ValidationResponse(
            msg.sender,
            record.agentId,
            requestHash,
            response,
            responseURI,
            responseHash,
            tag
        );
    }

    // ============ Pre-Action Check (KEY FUNCTION) ============

    /**
     * @notice Check if a proposed action has been validated and approved
     * @param requestHash The request to check
     * @return approved Whether the action can proceed
     * @return score The validation score (0-100)
     * @return expired Whether validation timed out
     */
    function isActionApproved(bytes32 requestHash) external view returns (
        bool approved,
        uint8 score,
        bool expired
    ) {
        ValidationRecord storage record = validations[requestHash];
        
        if (record.requestTimestamp == 0) {
            return (false, 0, false);
        }

        expired = !record.responded && 
                  (block.timestamp > record.requestTimestamp + validationTimeout);
        
        if (expired) {
            return (false, 0, true);
        }

        approved = record.responded && record.response >= minPassScore;
        score = record.response;
    }

    // ============ Read Functions ============

    function getValidationStatus(bytes32 requestHash) external view returns (
        address validatorAddress,
        uint256 agentId,
        uint8 response,
        bytes32 responseHash,
        string memory tag,
        uint256 lastUpdate
    ) {
        ValidationRecord storage r = validations[requestHash];
        return (
            r.validatorAddress,
            r.agentId,
            r.response,
            r.responseHash,
            r.tag,
            r.responded ? r.responseTimestamp : r.requestTimestamp
        );
    }

    function getSummary(
        uint256 agentId,
        address[] calldata validatorAddresses,
        string calldata tag
    ) external view returns (uint64 count, uint8 averageResponse) {
        bytes32[] storage hashes = agentValidations[agentId];
        uint256 total = 0;
        uint64 matched = 0;

        for (uint256 i = 0; i < hashes.length; i++) {
            ValidationRecord storage r = validations[hashes[i]];
            if (!r.responded) continue;
            
            // Filter by validators if provided
            if (validatorAddresses.length > 0) {
                bool found = false;
                for (uint256 j = 0; j < validatorAddresses.length; j++) {
                    if (r.validatorAddress == validatorAddresses[j]) {
                        found = true;
                        break;
                    }
                }
                if (!found) continue;
            }

            // Filter by tag if provided
            if (bytes(tag).length > 0) {
                if (keccak256(bytes(r.tag)) != keccak256(bytes(tag))) continue;
            }

            total += r.response;
            matched++;
        }

        count = matched;
        averageResponse = matched > 0 ? uint8(total / matched) : 0;
    }

    function getAgentValidations(uint256 agentId) external view returns (bytes32[] memory) {
        return agentValidations[agentId];
    }

    function getValidatorRequests(address validatorAddress) external view returns (bytes32[] memory) {
        return validatorRequests[validatorAddress];
    }

    function requestExists(bytes32 requestHash) external view returns (bool) {
        return _requestExists(requestHash);
    }

    // ============ Admin ============

    function authorizeValidator(address validator) external onlyOwner {
        authorizedValidators[validator] = true;
        emit ValidatorAuthorized(validator);
    }

    function revokeValidator(address validator) external onlyOwner {
        authorizedValidators[validator] = false;
        emit ValidatorRevoked(validator);
    }

    function updateConfig(uint8 _minPassScore, uint256 _validationTimeout) external onlyOwner {
        require(_minPassScore <= 100, "Invalid score");
        require(_validationTimeout >= 60, "Timeout too short");
        minPassScore = _minPassScore;
        validationTimeout = _validationTimeout;
        emit ConfigUpdated(_minPassScore, _validationTimeout);
    }

    // ============ Internal ============

    function _requestExists(bytes32 requestHash) internal view returns (bool) {
        return validations[requestHash].requestTimestamp > 0;
    }
}
