// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IMerchantMoeLBRouter.sol";

contract MockLBRouter {
    // Simulates a swap: takes tokenIn, gives tokenOut at 1:1 ratio (simplified)
    uint256 public mockOutputMultiplier = 100; // 100 = 1:1, 105 = 5% profit

    function setMockOutputMultiplier(uint256 multiplier) external {
        mockOutputMultiplier = multiplier;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        IMerchantMoeLBRouter.Path memory path,
        address to,
        uint256 /* deadline */
    ) external returns (uint256 amountOut) {
        require(path.tokenPath.length >= 2, "Invalid path");
        
        address tokenIn = path.tokenPath[0];
        address tokenOut = path.tokenPath[path.tokenPath.length - 1];

        // Transfer tokenIn from caller
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);

        // Calculate output with multiplier
        amountOut = (amountIn * mockOutputMultiplier) / 100;
        require(amountOut >= amountOutMin, "Insufficient output");

        // Transfer tokenOut to recipient
        IERC20(tokenOut).transfer(to, amountOut);

        return amountOut;
    }
}
