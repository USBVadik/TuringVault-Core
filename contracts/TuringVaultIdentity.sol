// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title TuringVaultIdentity
 * @notice ERC-8004 compliant Identity Registry for AI Agents
 * @dev ERC-721 based agent registry with metadata, agentWallet (EIP-712 verified)
 *      Implements Jan 2026 Spec (v1.2)
 */
contract TuringVaultIdentity is ERC721URIStorage, Ownable, EIP712 {
    using ECDSA for bytes32;

    uint256 private _tokenIdCounter;

    // EIP-712 typehash for agentWallet verification
    bytes32 public constant AGENT_WALLET_TYPEHASH = 
        keccak256("SetAgentWallet(uint256 agentId,address newWallet,uint256 deadline)");

    // Agent metadata storage: agentId => key => value
    mapping(uint256 => mapping(string => bytes)) private _metadata;
    
    // Agent wallet: agentId => wallet address
    mapping(uint256 => address) private _agentWallets;

    // Events per ERC-8004 spec
    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
    event MetadataSet(uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue);
    event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy);
    event AgentWalletSet(uint256 indexed agentId, address indexed newWallet, address indexed setBy);
    event AgentWalletUnset(uint256 indexed agentId, address indexed unsetBy);

    struct MetadataEntry {
        string metadataKey;
        bytes metadataValue;
    }

    constructor() 
        ERC721("TuringVault Agent", "TVA") 
        Ownable(msg.sender)
        EIP712("TuringVaultIdentity", "1")
    {}

    // ============ Registration (ERC-8004 spec) ============

    /// @notice Register agent with URI and metadata
    function register(string calldata agentURI, MetadataEntry[] calldata metadata) external returns (uint256 agentId) {
        agentId = _tokenIdCounter++;
        _mint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);
        
        for (uint256 i = 0; i < metadata.length; i++) {
            require(
                keccak256(bytes(metadata[i].metadataKey)) != keccak256(bytes("agentWallet")),
                "Use setAgentWallet()"
            );
            _metadata[agentId][metadata[i].metadataKey] = metadata[i].metadataValue;
            emit MetadataSet(agentId, metadata[i].metadataKey, metadata[i].metadataKey, metadata[i].metadataValue);
        }
        
        emit Registered(agentId, agentURI, msg.sender);
    }

    /// @notice Register agent with URI only
    function register(string calldata agentURI) external returns (uint256 agentId) {
        agentId = _tokenIdCounter++;
        _mint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);
        emit Registered(agentId, agentURI, msg.sender);
    }

    /// @notice Register agent without URI
    function register() external returns (uint256 agentId) {
        agentId = _tokenIdCounter++;
        _mint(msg.sender, agentId);
        emit Registered(agentId, "", msg.sender);
    }

    // ============ Metadata ============

    function setMetadata(uint256 agentId, string calldata metadataKey, bytes calldata metadataValue) external {
        require(_isApprovedOrOwner(msg.sender, agentId), "Not authorized");
        require(
            keccak256(bytes(metadataKey)) != keccak256(bytes("agentWallet")),
            "Use setAgentWallet()"
        );
        _metadata[agentId][metadataKey] = metadataValue;
        emit MetadataSet(agentId, metadataKey, metadataKey, metadataValue);
    }

    function getMetadata(uint256 agentId, string calldata metadataKey) external view returns (bytes memory) {
        return _metadata[agentId][metadataKey];
    }

    function setAgentURI(uint256 agentId, string calldata newURI) external {
        require(_isApprovedOrOwner(msg.sender, agentId), "Not authorized");
        _setTokenURI(agentId, newURI);
        emit URIUpdated(agentId, newURI, msg.sender);
    }

    // ============ Agent Wallet (EIP-712 verified) ============

    /// @notice Set agent wallet with EIP-712 signature from the wallet
    function setAgentWallet(
        uint256 agentId,
        address newWallet,
        uint256 deadline,
        bytes calldata signature
    ) external {
        require(_isApprovedOrOwner(msg.sender, agentId), "Not authorized");
        require(block.timestamp <= deadline, "Signature expired");
        require(newWallet != address(0), "Invalid wallet");

        bytes32 structHash = keccak256(abi.encode(AGENT_WALLET_TYPEHASH, agentId, newWallet, deadline));
        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = hash.recover(signature);
        require(signer == newWallet, "Invalid signature");

        _agentWallets[agentId] = newWallet;
        emit AgentWalletSet(agentId, newWallet, msg.sender);
    }

    /// @notice Get agent wallet
    function getAgentWallet(uint256 agentId) external view returns (address) {
        return _agentWallets[agentId];
    }

    /// @notice Clear agent wallet
    function unsetAgentWallet(uint256 agentId) external {
        require(_isApprovedOrOwner(msg.sender, agentId), "Not authorized");
        _agentWallets[agentId] = address(0);
        emit AgentWalletUnset(agentId, msg.sender);
    }

    // ============ View Functions ============

    function totalAgents() external view returns (uint256) {
        return _tokenIdCounter;
    }

    function agentExists(uint256 agentId) external view returns (bool) {
        return agentId < _tokenIdCounter;
    }

    // ============ Legacy compatibility ============

    /// @notice Legacy register (backwards compatible)
    function registerAgent(string memory agentURI) external onlyOwner returns (uint256) {
        uint256 tokenId = _tokenIdCounter++;
        _mint(msg.sender, tokenId);
        _setTokenURI(tokenId, agentURI);
        emit Registered(tokenId, agentURI, msg.sender);
        return tokenId;
    }

    // ============ Internal ============

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address owner = ownerOf(tokenId);
        return (spender == owner || getApproved(tokenId) == spender || isApprovedForAll(owner, spender));
    }
}
