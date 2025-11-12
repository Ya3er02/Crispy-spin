'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';

export default function Home() {
  const { address, isConnected } = useAccount();
  const [points, setPoints] = useState(0);
  const [canSpin, setCanSpin] = useState(false);

  useEffect(() => {
    if (isConnected && address) {
      fetchUserData();
    }
  }, [isConnected, address]);

  const fetchUserData = async () => {
    try {
      const response = await fetch(`/api/points?wallet=${address}`);
      const data = await response.json();
      setPoints(data.total || 0);
      setCanSpin(data.canSpin || false);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <nav className="container mx-auto px-4 py-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Image src="/basket.png" alt="CrispySpin" width={40} height={40} />
          <h1 className="text-2xl font-bold text-orange-800">CrispySpin</h1>
        </div>
        <div className="flex items-center gap-4">
          {isConnected && (
            <div className="bg-white px-4 py-2 rounded-lg shadow">
              <span className="text-orange-600 font-semibold">
                {points} FryPoints
              </span>
            </div>
          )}
          <ConnectButton />
        </div>
      </nav>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl font-bold text-orange-900 mb-6">
            Spin Daily, Win Big! 🍟
          </h2>
          <p className="text-xl text-orange-700 mb-12">
            Connect your wallet and spin to win NFTs, points, and partner rewards
          </p>

          {!isConnected ? (
            <div className="bg-white rounded-2xl p-12 shadow-xl">
              <Image
                src="/fries.png"
                alt="Fries"
                width={200}
                height={200}
                className="mx-auto mb-6"
              />
              <h3 className="text-2xl font-semibold mb-4">Get Started</h3>
              <p className="text-gray-600 mb-6">
                Connect your wallet to start spinning
              </p>
              <ConnectButton />
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              <Link
                href="/spin"
                className={`bg-white rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all ${
                  !canSpin ? 'opacity-50' : 'hover:scale-105'
                }`}
              >
                <Image
                  src="/basket.png"
                  alt="Spin"
                  width={80}
                  height={80}
                  className="mx-auto mb-4"
                />
                <h3 className="text-xl font-bold mb-2">Daily Spin</h3>
                <p className="text-gray-600">
                  {canSpin ? 'Spin now!' : 'Come back tomorrow'}
                </p>
                {canSpin && (
                  <div className="mt-4 bg-orange-500 text-white py-2 px-4 rounded-lg font-semibold">
                    SPIN FREE
                  </div>
                )}
              </Link>

              <Link
                href="/inventory"
                className="bg-white rounded-2xl p-8 shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
              >
                <Image
                  src="/fries.png"
                  alt="Inventory"
                  width={80}
                  height={80}
                  className="mx-auto mb-4"
                />
                <h3 className="text-xl font-bold mb-2">Inventory</h3>
                <p className="text-gray-600">View your NFTs</p>
              </Link>

              <Link
                href="/quests"
                className="bg-white rounded-2xl p-8 shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
              >
                <Image
                  src="/sauce.png"
                  alt="Quests"
                  width={80}
                  height={80}
                  className="mx-auto mb-4"
                />
                <h3 className="text-xl font-bold mb-2">Quests</h3>
                <p className="text-gray-600">Complete tasks for points</p>
              </Link>

              <Link
                href="/market"
                className="bg-white rounded-2xl p-8 shadow-xl hover:shadow-2xl hover:scale-105 transition-all md:col-span-3"
              >
                <h3 className="text-xl font-bold mb-2">🛒 Market</h3>
                <p className="text-gray-600">Buy spin packs with USDC</p>
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
