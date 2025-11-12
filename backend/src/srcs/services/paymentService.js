const { pool } = require('../config/database');
const axios = require('axios');

class PaymentService {
    /**
     * Verify Base Pay transaction
     */
    async verifyBasePayTransaction(txId, testnet = true) {
        try {
            // In production, verify with Base Pay SDK
            // For now, simulate verification
            const rpcUrl = testnet
                ? process.env.BASE_SEPOLIA_RPC
                : process.env.BASE_MAINNET_RPC;

            // Query transaction receipt
            const response = await axios.post(rpcUrl, {
                jsonrpc: '2.0',
                method: 'eth_getTransactionReceipt',
                params: [txId],
                id: 1
            });

            if (!response.data.result) {
                return { verified: false, error: 'Transaction not found' };
            }

            const receipt = response.data.result;

            // Verify transaction was successful
            if (receipt.status !== '0x1') {
                return { verified: false, error: 'Transaction failed' };
            }

            return {
                verified: true,
                from: receipt.from,
                to: receipt.to,
                blockNumber: parseInt(receipt.blockNumber, 16)
            };
        } catch (error) {
            console.error('Payment verification error:', error);
            return { verified: false, error: error.message };
        }
    }

    /**
     * Credit spin pack purchase
     */
    async creditSpinPurchase(wallet, sku) {
        const spinCredits = {
            'spin_pack_small': 5,
            'spin_pack_medium': 20,
            'booster_sauce': 0 // This would mint an NFT instead
        };

        const credits = spinCredits[sku] || 0;

        if (credits > 0) {
            await pool.query(
                `INSERT INTO spin_credits (wallet, credits)
                 VALUES ($1, $2)
                 ON CONFLICT (wallet)
                 DO UPDATE SET credits = spin_credits.credits + $2;`,
                [wallet.toLowerCase(), credits]
            );

            // Award purchase points
            await pool.query(
                `UPDATE points SET total = total + 2 WHERE wallet = $1;`,
                [wallet.toLowerCase()]
            );
        }

        return { success: true, creditsAdded: credits };
    }

    /**
     * Process payment success callback
     */
    async processPaymentSuccess(txId, wallet, sku, amountUsdc) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Verify transaction
            const verification = await this.verifyBasePayTransaction(txId, true);

            if (!verification.verified) {
                throw new Error('Payment verification failed');
            }

            // Record order
            await client.query(
                `INSERT INTO orders (id, wallet, sku, amount_usdc, status, tx_hash, completed_at)
                 VALUES ($1, $2, $3, $4, 'completed', $5, CURRENT_TIMESTAMP)
                 ON CONFLICT (id) DO NOTHING;`,
                [txId, wallet.toLowerCase(), sku, amountUsdc, txId]
            );

            // Credit spins or items
            await this.creditSpinPurchase(.wallet, sku);

            await client.query('COMMIT');

            return { success: true };
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Payment processing error:', error);
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = new PaymentService();
