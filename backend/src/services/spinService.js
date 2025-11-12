const { ethers } = require('ethers');
const { pool } = require('../config/database');
const crypto = require('crypto');

const COOLDOWN_SECONDS = 86400; // 24 hours

class SpinService {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC);
        this.signerWallet = new ethers.Wallet(process.env.SIGNER_PRIVATE_KEY, this.provider);
    }

    /**
     * Check if user can spin
     */
    async checkCooldown(wallet) {
        const query = `
            SELECT last_spin_at
            FROM points
            WHERE wallet = $1;
        `;

        const result = await pool.query(query, [wallet.toLowerCase()]);

        if (result.rows.length === 0) {
            return { canSpin: true, remainingTime: 0 };
        }

        const lastSpinAt = result.rows[0].last_spin_at;
        if (!lastSpinAt) {
            return { canSpin: true, remainingTime: 0 };
        }

        const lastSpinTimestamp = new Date(lastSpinAt).getTime();
        const now = Date.now();
        const timeSinceLastSpin = (now - lastSpinTimestamp) / 1000;

        if (timeSinceLastSpin >= COOLDOWN_SECONDS) {
            return { canSpin: true, remainingTime: 0 };
        }

        return {
            canSpin: false,
            remainingTime: Math.ceil(COOLDOWN_SECONDS - timeSinceLastSpin)
        };
    }

    /**
     * Check if user has paid spin credits
     */
    async hasSpinCredits(wallet) {
        const query = `
            SELECT credits
            FROM spin_credits
            WHERE wallet = $1;
        `;

        const result = await pool.query(query, [wallet.toLowerCase()]);
        return result.rows.length > 0 && result.rows[0].credits > 0;
    }

    /**
     * Generate cryptographically secure random reward
     */
    async generateReward() {
        // Use crypto.randomBytes for secure RNG
        const randomValue = crypto.randomInt(0, 100);

        // Reward distribution:
        // 0-5: BASKET (6%)
        // 6-20: FRIES (15%)
        // 21-40: SAUCE (20%)
        // 41-70: Points 50-200 (30%)
        // 71-100: Partner rewards (29%)

        if (randomValue <= 5) {
            return {
                type: 'nft',
                tokenId: 1, // BASKET
                amount: 1,
                value: 'BASKET'
            };
        } else if (randomValue <= 20) {
            return {
                type: 'nft',
                tokenId: 2, // FRIES
                amount: 1,
                value: 'FRIES'
            };
        } else if (randomValue <= 40) {
            return {
                type: 'nft',
                tokenId: 3, // SAUCE
                amount: 1,
                value: 'SAUCE'
            };
        } else if (randomValue <= 70) {
            const points = crypto.randomInt(50, 201);
            return {
                type: 'points',
                amount: points,
                value: `${points}_POINTS`
            };
        } else {
            return {
                type: 'partner',
                value: 'PARTNER_REWARD',
                message: 'Partner reward available!'
            };
        }
    }

    /**
     * Create signature for NFT minting
     */
    async createMintSignature(wallet, tokenId, amount, nonce) {
        const contractAddress = process.env.FRIES1155_ADDRESS;

        const messageHash = ethers.solidityPackedKeccak256(
            ['address', 'uint256', 'uint256', 'uint256', 'address'],
            [wallet, tokenId, amount, nonce, contractAddress]
        );

        const signature = await this.signerWallet.signMessage(
            ethers.getBytes(messageHash)
        );

        return signature;
    }

    /**
     * Create signature for vault claim
     */
    async createClaimSignature(wallet, token, amount, tokenId, nonce) {
        const vaultAddress = process.env.REWARD_VAULT_ADDRESS;
        const expiry = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24h expiry
        const isERC1155 = tokenId > 0;

        const messageHash = ethers.solidityPackedKeccak256(
            ['address', 'address', 'uint256', 'uint256', 'uint256', 'uint256', 'bool', 'address'],
            [wallet, token, amount, tokenId, expiry, nonce, isERC1155, vaultAddress]
        );

        const signature = await this.signerWallet.signMessage(
            ethers.getBytes(messageHash)
        );

        return { signature, expiry };
    }

    /**
     * Process spin and return reward with signature
     */
    async processSpin(wallet) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Generate reward
            const reward = await this.generateReward();

            // Update last spin time
            await client.query(
                `INSERT INTO points (wallet, total, last_spin_at)
                 VALUES ($1, 10, CURRENT_TIMESTAMP)
                 ON CONFLICT (wallet)
                 DO UPDATE SET
                    total = points.total + 10,
                    last_spin_at = CURRENT_TIMESTAMP;`,
                [wallet.toLowerCase()]
            );

            let signature = null;
            let txData = null;

            // Get current nonce from contract
            const nonce = crypto.randomInt(0, 1000000);

            if (reward.type === 'nft') {
                // Create mint signature
                signature = await this.createMintSignature(
                    wallet,
                    reward.tokenId,
                    reward.amount,
                    nonce
                );

                txData = {
                    contractAddress: process.env.FRIES1155_ADDRESS,
                    nonce,
                    signature
                };
            } else if (reward.type === 'partner') {
                // Create claim signature
                const claimSig = await this.createClaimSignature(
                    wallet,
                    process.env.PARTNER_TOKEN_ADDRESS,
                    ethers.parseEther('1'),
                    0,
                    nonce
                );

                signature = claimSig.signature;
                txData = {
                    vaultAddress: process.env.REWARD_VAULT_ADDRESS,
                    expiry: claimSig.expiry,
                    nonce,
                    signature
                };
            } else if (reward.type === 'points') {
                // Update points directly
                await client.query(
                    `UPDATE points SET total = total + $1 WHERE wallet = $2;`,
                    [reward.amount, wallet.toLowerCase()]
                );
            }

            // Record spin
            await client.query(
                `INSERT INTO spins (wallet, reward_type, reward_value, tx_hash)
                 VALUES ($1, $2, $3, $4);`,
                [wallet.toLowerCase(), reward.type, reward.value, signature]
            );

            await client.query('COMMIT');

            return {
                success: true,
                reward,
                signature,
                txData
            };
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Spin processing error:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Deduct paid spin credit
     */
    async deductSpinCredit(wallet) {
        await pool.query(
            `UPDATE spin_credits
             SET credits = credits - 1
             WHERE wallet = $1 AND credits > 0;`,
            [wallet.toLowerCase()]
        );
    }
}

module.exports = new SpinService();
