// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TuringVaultIdentity is ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;

    event AgentRegistered(uint256 indexed tokenId, string agentURI);
    event AgentURIUpdated(uint256 indexed tokenId, string newURI);

    constructor() ERC721("TuringVault Agent", "TVA") Ownable(msg.sender) {}

    function registerAgent(string memory agentURI) external onlyOwner returns (uint256) {
        uint256 tokenId = _tokenIdCounter++;
        _mint(msg.sender, tokenId);
        _setTokenURI(tokenId, agentURI);
        emit AgentRegistered(tokenId, agentURI);
        return tokenId;
    }

    function updateAgentURI(uint256 tokenId, string memory newURI) external onlyOwner {
        require(ownerOf(tokenId) == msg.sender, "Not agent owner");
        _setTokenURI(tokenId, newURI);
        emit AgentURIUpdated(tokenId, newURI);
    }
}
