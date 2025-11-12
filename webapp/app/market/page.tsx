'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { pay, getPaymentStatus } from '@base-org/account';
import { BasePayButton } from '@base-org/account-ui/react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

const PACKS = [
  {
    sku: 'spin_pack_small',
    name: 'Small Pack',
    price: '1.00',
    spins: 5,
    description: '5 extra spins'
  },
  {
    sku: 'spin_pack_medium',
    name: 'Medium Pack',
    price: '3.00',
    spins: 20,
    description: '20 extra spins - Best value!'
  },
  {
    sku: 'booster_sauce',
    name: 'Booster Sauce',
    price: '0.50',
    spins: 0,
    description: 'Special NFT booster item'
  }
];

export default function MarketPage() {
  const { address, isConnected } = useAccount();
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const handlePurchase = async (pack: typeof PACKS[0]) => {
    if (!address) return;

    setPurchasing(pack.sku);

    try {
      // Initiate Base Pay payment
      const payment = await pay({
        amount: pack.price,
        to: process.env.NEXT_PUBLIC_TREASURY_ADDRESS!,
        testnet: true
      });

      // Wait for payment confirmation
      const status = await getPaymentStatus({
        id: payment.id,
        testnet: true
      });

      if (status.status === 'completed') {
        // Notify backend
        const response = await fetch('/api/market/pay/success', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            txId: payment.id,
            wallet: address,
            sku: pack.sku,
            amount: pack.price
          })
        });

        const result = await response.json();

        if (result.success) {
          alert(`Purchase successful! You received ${pack.spins} spins`);
        }
      }
    } catch (error: any) {
      console.error('Purchase error:', error);
      alert(`Purchase failed: ${error.message}`);
    } finally {
      setPurchasing(null);
    }
  };

  if (!isConnected) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-12 shadow-xl text-center">
          <h2 className="text-2xl font-bold mb-4">Connect Wallet</h2>
          <ConnectButton />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <div className="container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-center text-orange-900 mb-8">
          🛒 Market
        </h1>

        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {PACKS.map((pack) => (
            <div
              key={pack.sku}
              className="bg-white rounded-2xl p-8 shadow-xl"
            >
              <h3 className="text-2xl font-bold mb-2">{pack.name}</h3>
              <p className="text-gray-600 mb-4">{pack.description}</p>
              <div className="text-3xl font-bold text-orange-600 mb-6">
                ${pack.price} USDC
              </div>

              <BasePayButton
                onClick={() => handlePurchase(pack)}
                colorScheme="light"
                disabled={purchasing === pack.sku}
              >
                {purchasing === pack.sku ? 'Processing...' : 'Buy Now'}
              </BasePayButton>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
