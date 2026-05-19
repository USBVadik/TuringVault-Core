// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

contract TuringVaultDecisionLog is Ownable {
    struct Decision {
        uint256 timestamp;
        string action;           // "swap" | "hold"
        string targetAsset;      // адрес целевого токена
        uint256 amountIn;
        uint256 amountOut;
        uint256 confidence;      // 0-10000 (basis points, где 8500 = 85%)
        string reasoningHash;    // IPFS hash или короткая строка JSON
        bytes32 txHash;          // hash исполненной транзакции в Mantle
    }

    Decision[] public decisions;
    uint256 public totalDecisions;

    // Репутационные метрики для агента
    uint256 public successfulSwaps;
    uint256 public totalPnLBasisPoints;

    event DecisionLogged(
        uint256 indexed decisionId,
        string action,
        string targetAsset,
        uint256 confidence,
        string reasoningHash
    );

    event PerformanceUpdated(
        uint256 indexed decisionId,
        int256 pnlBasisPoints
    );

    constructor() Ownable(msg.sender) {}

    function logDecision(
        string memory action,
        string memory targetAsset,
        uint256 amountIn,
        uint256 amountOut,
        uint256 confidence,
        string memory reasoningHash,
        bytes32 txHash
    ) external onlyOwner returns (uint256) {
        uint256 decisionId = decisions.length;
        decisions.push(Decision({
            timestamp: block.timestamp,
            action: action,
            targetAsset: targetAsset,
            amountIn: amountIn,
            amountOut: amountOut,
            confidence: confidence,
            reasoningHash: reasoningHash,
            txHash: txHash
        }));
        totalDecisions++;
        emit DecisionLogged(decisionId, action, targetAsset, confidence, reasoningHash);
        return decisionId;
    }

    function updatePerformance(uint256 decisionId, int256 pnlBps) external onlyOwner {
        require(decisionId < decisions.length, "Invalid decision ID");
        if (pnlBps > 0) successfulSwaps++;
        if (pnlBps >= 0) {
            totalPnLBasisPoints += uint256(pnlBps);
        } else {
            uint256 absPnl = uint256(-pnlBps);
            if (totalPnLBasisPoints >= absPnl) {
                totalPnLBasisPoints -= absPnl;
            } else {
                totalPnLBasisPoints = 0;
            }
        }
        emit PerformanceUpdated(decisionId, pnlBps);
    }

    function getDecision(uint256 id) external view returns (Decision memory) {
        require(id < decisions.length, "Invalid decision ID");
        return decisions[id];
    }

    function getRecentDecisions(uint256 count) external view returns (Decision[] memory) {
        if (decisions.length == 0) {
            return new Decision[](0);
        }
        uint256 length = decisions.length > count ? count : decisions.length;
        uint256 start = decisions.length - length;
        Decision[] memory recent = new Decision[](length);
        for (uint256 i = 0; i < length; i++) {
            recent[i] = decisions[start + i];
        }
        return recent;
    }
}
