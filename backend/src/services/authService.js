const { ethers } = require('ethers');
const { pool } = require('../config/database');

class AuthService {
    constructor() {
        this.nonces = new Map(); // In-memory nonce storage
    }

    /**
     * Generate a random nonce for SIWE
     */
    generateNonce() {
        return ethers.hexlify(ethers.randomBytes(16));
    }

    /**
     * Store nonce for a session
     */
    async storeNonce(sessionId, nonce) {
        this.nonces.set(sessionId, {
            nonce,
            timestamp: Date.now()
        });

        // Clean up old nonces (older than 5 minutes)
        this.cleanupOldNonces();
    }

    /**
     * Verify SIWE message and signature
     */
    async verifySIWE(message, signature, expectedNonce) {
        try {
            // Parse SIWE message
            const lines = message.split('\n');
            const addressLine = lines.find(l => l.startsWith('0x'));
            const nonceLine = lines.find(l => l.includes('Nonce:'));

            if (!addressLine || !nonceLine) {
                throw new Error('Invalid SIWE message format');
            }

            const address = addressLine.trim();
            const nonce = nonceLine.split(':')[1].trim();

            // Verify nonce
            if (nonce !== expectedNonce) {
                throw new Error('Invalid nonce');
            }

            // Verify signature
            const recoveredAddress = ethers.verifyMessage(message, signature);

            if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
                throw new Error('Signature verification failed');
            }

            // Create or update user in database
            await this.upsertUser(address);

            return {
                success: true,
                address: address.toLowerCase()
            };
        } catch (error) {
            console.error('SIWE verification error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create or update user record
     */
    async upsertUser(wallet) {
        const query = `
            INSERT INTO users (wallet, last_active)
            VALUES ($1, CURRENT_TIMESTAMP)
            ON CONFLICT (wallet)
            DO UPDATE SET last_active = CURRENT_TIMESTAMP
            RETURNING wallet;
        `;

        await pool.query(query, [wallet.toLowerCase()]);
    }

    /**
     * Clean up nonces older than 5 minutes
     */
    cleanupOldNonces() {
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);

        for (const [sessionId, data] of this.nonces.entries()) {
            if (data.timestamp < fiveMinutesAgo) {
                this.nonces.delete(sessionId);
            }
        }
    }

    /**
     * Get nonce for session
     */
    getNonce(sessionId) {
        return this.nonces.get(sessionId)?.nonce;
    }

    /**
     * Remove nonce after verification
     */
    removeNonce(sessionId) {
        this.nonces.delete(sessionId);
    }
}

module.exports = new AuthService();
