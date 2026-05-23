// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IMerchantMoeLBRouter.sol";

contract TuringVaultRouter is Ownable, Pausable {
    using SafeERC20 for IERC20;

    // Mantle Mainnet addresses
    address public constant MERCHANT_MOE_ROUTER = 0x013e138EF6008ae5FDFDE29700e3f2Bc61d21E3a;
    address public constant MUSD = 0xab575258d37EaA5C8956EfABe71F4eE8F6397cF3;
    address public constant METH = 0xcDA86A272531e8640cD7F1a92c01839911B90bb0;
    address public constant USDY = 0x5bE26527e817998A7206475496fDE1E68957c5A6;

    // Linked ValidationRegistry for on-chain proof
    address public validationRegistry;

    // Risk parameters
    uint256 public maxSlippageBps = 100;        // 1% max slippage
    uint256 public minConfidence = 8500;         // 85% minimum confidence
    uint256 public maxSingleSwapPct = 5000;      // 50% max single swap

    // State
    uint256 public totalDeposited;
    mapping(address => uint256) public assetBalances;

    event SwapExecuted(address indexed fromToken, address indexed toToken, uint256 amountIn, uint256 amountOut, uint256 indexed proposalId);
    event RiskParamsUpdated(uint256 maxSlippage, uint256 minConfidence, uint256 maxSwapPct);
    event Deposited(address indexed token, uint256 amount);
    event Withdrawn(address indexed token, uint256 amount);

    constructor(address _validationRegistry) Ownable(msg.sender) {
        validationRegistry = _validationRegistry;
    }

    // --- DEPOSIT/WITHDRAW ---

    function deposit(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        assetBalances[token] += amount;
        totalDeposited += amount;
        emit Deposited(token, amount);
    }

    function withdraw(address token, uint256 amount) external onlyOwner {
        require(assetBalances[token] >= amount, "Insufficient balance");
        assetBalances[token] -= amount;
        totalDeposited = totalDeposited > amount ? totalDeposited - amount : 0;
        IERC20(token).safeTransfer(msg.sender, amount);
        emit Withdrawn(token, amount);
    }

    // --- AI SWAP EXECUTION ---

    function executeSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin,
        uint256[] calldata pairBinSteps,
        uint8[] calldata versions,
        uint256 proposalId
    ) external onlyOwner whenNotPaused returns (uint256) {
        require(amountIn <= assetBalances[tokenIn], "Exceeds balance");
        require(totalDeposited > 0, "No deposits");
        require(amountIn * 10000 / totalDeposited <= maxSingleSwapPct, "Exceeds max swap size");
        require(amountOutMin > 0, "amountOutMin cannot be zero");

        // Verify proposal was approved by ValidationRegistry (on-chain proof link)
        if (validationRegistry != address(0)) {
            (,,,,,,,,uint8 status,,) = IValidationRegistry(validationRegistry).proposals(proposalId);
            require(status == 1, "Proposal not approved"); // 1 = Approved
        }

        // Approve router
        IERC20(tokenIn).forceApprove(MERCHANT_MOE_ROUTER, amountIn);

        // Build path
        address[] memory tokenPath = new address[](2);
        tokenPath[0] = tokenIn;
        tokenPath[1] = tokenOut;

        IMerchantMoeLBRouter.Path memory path = IMerchantMoeLBRouter.Path({
            pairBinSteps: pairBinSteps,
            versions: versions,
            tokenPath: tokenPath
        });

        // Execute swap
        uint256 amountOut = IMerchantMoeLBRouter(MERCHANT_MOE_ROUTER).swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            address(this),
            block.timestamp + 300
        );

        // Update balances
        assetBalances[tokenIn] -= amountIn;
        assetBalances[tokenOut] += amountOut;

        emit SwapExecuted(tokenIn, tokenOut, amountIn, amountOut, proposalId);
        return amountOut;
    }

    // --- RISK MANAGEMENT ---

    function updateRiskParams(
        uint256 _maxSlippageBps,
        uint256 _minConfidence,
        uint256 _maxSingleSwapPct
    ) external onlyOwner {
        require(_maxSlippageBps <= 1000, "Slippage too high"); // max 10%
        require(_maxSingleSwapPct <= 10000, "Invalid percentage");
        maxSlippageBps = _maxSlippageBps;
        minConfidence = _minConfidence;
        maxSingleSwapPct = _maxSingleSwapPct;
        emit RiskParamsUpdated(_maxSlippageBps, _minConfidence, _maxSingleSwapPct);
    }

    // --- VIEW FUNCTIONS ---

    function getPortfolioAllocation() external view returns (
        uint256 musdBalance,
        uint256 methBalance,
        uint256 usdyBalance
    ) {
        return (
            assetBalances[MUSD],
            assetBalances[METH],
            assetBalances[USDY]
        );
    }

    // --- EMERGENCY ---

    function emergencyWithdraw(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).safeTransfer(msg.sender, balance);
            assetBalances[token] = 0;
        }
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setValidationRegistry(address _registry) external onlyOwner {
        validationRegistry = _registry;
    }
}

interface IValidationRegistry {
    function proposals(uint256) external view returns (
        uint256 timestamp,
        string memory action,
        string memory targetAsset,
        uint256 amountIn,
        uint256 confidence,
        string memory reasoning,
        uint256 validatorConfidence,
        string memory validatorReasoning,
        uint8 status,
        uint256 validatedAt,
        bytes32 executionTxHash
    );
}
