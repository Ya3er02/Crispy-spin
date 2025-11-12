// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract Fries1155 is ERC1155, AccessControl {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    
    mapping(uint256 => string) private _tokenURIs;
    mapping(bytes => bool) private _usedSignatures;
    
    uint256 public constant BASKET = 1;
    uint256 public constant FRIES = 2;
    uint256 public constant SAUCE = 3;

    event MintedWithSignature(address indexed to, uint256 indexed tokenId, uint256 amount, bytes signature);

    constructor(string memory baseURI) ERC1155(baseURI) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        
        _tokenURIs[BASKET] = "basket.json";
        _tokenURIs[FRIES] = "fries.json";
        _tokenURIs[SAUCE] = "sauce.json";
    }

    function mintWithSig(
        address to,
        uint256 tokenId,
        uint256 amount,
        bytes memory signature
    ) external {
        require(!_usedSignatures[signature], "Signature already used");
        
        bytes32 messageHash = keccak256(abi.encodePacked(to, tokenId, amount));
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        
        address signer = ethSignedMessageHash.recover(signature);
        require(hasRole(MINTER_ROLE, signer), "Invalid signature");
        
        _usedSignatures[signature] = true;
        _mint(to, tokenId, amount, "");
        
        emit MintedWithSignature(to, tokenId, amount, signature);
    }

    function burn(address account, uint256 id, uint256 amount) external {
        require(account == msg.sender || isApprovedForAll(account, msg.sender), "Not authorized");
        _burn(account, id, amount);
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        return string(abi.encodePacked(super.uri(tokenId), _tokenURIs[tokenId]));
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}