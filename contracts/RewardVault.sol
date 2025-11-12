// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title RewardVault
 * @notice Vault for claiming partner rewards with server-signed claims
 * @dev Supports ERC20 and ERC1155 token claims with daily limits
 */
contract RewardVault is AccessControl, ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    struct Claim {
        address user;
        address token;
        uint256 amount;
        uint256 tokenId; // For ERC1155, 0 for ERC20
        uint256 expiry;
        uint256 nonce;
        bool isERC1155;
    }

    // User => Date (YYYYMMDD) => Claim Count
    mapping(address => mapping(uint256 => uint256)) public dailyClaims;

    // Used claim signatures
    mapping(bytes => bool) public usedClaimSignatures;

    // Daily claim limit
    uint256 public constant DAILY_CLAIM_LIMIT = 1;

    event RewardClaimed(
        address indexed user,
        address indexed token,
        uint256 amount,
        uint256 tokenId,
        bool isERC1155
    );
    event EmergencyWithdraw(address indexed token, uint256 amount, bool isERC1155);

    constructor(address admin, address signer) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(SIGNER_ROLE, signer);
    }

    /**
     * @notice Claim rewards with server signature
     * @param claim Claim details
     * @param signature Server signature
     */
    function claimReward(Claim calldata claim, bytes memory signature)
        external
        nonReentrant
    {
        require(msg.sender == claim.user, "Not claim owner");
        require(block.timestamp <= claim.expiry, "Claim expired");
        require(!usedClaimSignatures[signature], "Claim already used");

        // Check daily limit
        uint256 today = getToday();
        require(
            dailyClaims[claim.user][today] < DAILY_CLAIM_LIMIT,
            "Daily limit reached"
        );

        // Verify signature
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                claim.user,
                claim.token,
                claim.amount,
                claim.tokenId,
                claim.expiry,
                claim.nonce,
                claim.isERC1155,
                address(this)
            )
        );
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(signature);

        require(hasRole(SIGNER_ROLE, signer), "Invalid signature");

        // Mark as used and increment daily count
        usedClaimSignatures[signature] = true;
        dailyClaims[claim.user][today]++;

        // Transfer tokens
        if (claim.isERC1155) {
            IERC1155(claim.token).safeTransferFrom(
                address(this),
                claim.user,
                claim.tokenId,
                claim.amount,
                ""
            );
        } else {
            IERC20(claim.token).transfer(claim.user, claim.amount);
        }

        emit RewardClaimed(
            claim.user,
            claim.token,
            claim.amount,
            claim.tokenId,
            claim.isERC1155
        );
    }

    /**
     * @notice Get current date in YYYYMMDD format
     * @return Current date
     */
    function getToday() public view returns (uint256) {
        return block.timestamp / 1 days;
    }

    /**
     * @notice Emergency withdraw (admin only)
     * @param token Token address
     * @param amount Amount to withdraw
     * @param isERC1155 Whether token is ERC1155
     * @param tokenId Token ID for ERC1155
     */
    function emergencyWithdraw(
        address token,
        uint256 amount,
        bool isERC1155,
        uint256 tokenId
    ) external onlyRole(ADMIN_ROLE) {
        if (isERC1155) {
            IERC1155(token).safeTransferFrom(
                address(this),
                msg.sender,
                tokenId,
                amount,
                ""
            );
        } else {
            IERC20(token).transfer(msg.sender, amount);
        }

        emit EmergencyWithdraw(token, amount, isERC1155);
    }

    /**
     * @notice Required for ERC1155 receiving
     */
    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes memory
    ) public pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    /**
     * @notice Required for ERC1155 batch receiving
     */
    function onERC1155BatchReceived(
        address,
        address,
        uint256[] memory,
        uint256[] memory,
        bytes memory
    ) public pure returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }
}
