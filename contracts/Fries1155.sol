// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title Fries1155
 * @notice ERC1155 contract for CrispySpin game items with signature-based minting
 * @dev Implements role-based minting with server signature verification
 */
contract Fries1155 is ERC1155, AccessControl, ERC1155Burnable, ERC1155Supply {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // Token IDs
    uint256 public constant BASKET = 1;
    uint256 public constant FRIES = 2;
    uint256 public constant SAUCE = 3;

    // Token metadata URIs (can be IPFS URIs)
    mapping(uint256 => string) private _tokenURIs;

    // Nonce tracking for signature replay protection
    mapping(address => uint256) public nonces;

    // Used signatures tracking
    mapping(bytes => bool) public usedSignatures;

    event TokenMinted(address indexed to, uint256 indexed tokenId, uint256 amount, bytes signature);
    event TokenURIUpdated(uint256 indexed tokenId, string uri);

    constructor(
        string memory baseURI,
        address admin,
        address minter
    ) ERC1155(baseURI) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, minter);

        // Set initial token URIs
        _tokenURIs[BASKET] = "ipfs://QmBasket/metadata.json";
        _tokenURIs[FRIES] = "ipfs://QmFries/metadata.json";
        _tokenURIs[SAUCE] = "ipfs://QmSauce/metadata.json";
    }

    /**
     * @notice Mint tokens with server signature
     * @param to Recipient address
     * @param tokenId Token ID to mint
     * @param amount Amount to mint
     * @param nonce Unique nonce for replay protection
     * @param signature Server signature
     */
    function mintWithSig(
        address to,
        uint256 tokenId,
        uint256 amount,
        uint256 nonce,
        bytes memory signature
    ) external {
        require(!usedSignatures[signature], "Signature already used");
        require(nonces[to] == nonce, "Invalid nonce");
        require(tokenId >= BASKET && tokenId <= SAUCE, "Invalid token ID");

        // Verify signature
        bytes32 messageHash = keccak256(
            abi.encodePacked(to, tokenId, amount, nonce, address(this))
        );
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(signature);

        require(hasRole(MINTER_ROLE, signer), "Invalid signature");

        // Mark signature as used and increment nonce
        usedSignatures[signature] = true;
        nonces[to]++;

        // Mint tokens
        _mint(to, tokenId, amount, "");

        emit TokenMinted(to, tokenId, amount, signature);
    }

    /**
     * @notice Batch mint multiple token types (admin only)
     * @param to Recipient address
     * @param ids Array of token IDs
     * @param amounts Array of amounts
     */
    function mintBatch(
        address to,
        uint256[] memory ids,
        uint256[] memory amounts
    ) external onlyRole(MINTER_ROLE) {
        _mintBatch(to, ids, amounts, "");
    }

    /**
     * @notice Update token URI (admin only)
     * @param tokenId Token ID
     * @param newuri New URI
     */
    function setTokenURI(uint256 tokenId, string memory newuri)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _tokenURIs[tokenId] = newuri;
        emit TokenURIUpdated(tokenId, newuri);
    }

    /**
     * @notice Get token-specific URI
     * @param tokenId Token ID
     * @return Token URI
     */
    function uri(uint256 tokenId) public view override returns (string memory) {
        return _tokenURIs[tokenId];
    }

    // Required overrides
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override(ERC1155, ERC1155Supply) {
        super._update(from, to, ids, values);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
