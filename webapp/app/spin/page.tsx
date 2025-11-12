'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import CooldownTimer from '@/components/CooldownTimer';
import SpinWheel from '@/components/SpinWheel';

export default function SpinPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);
  const [canSpin, setCanSpin] = useState(false);
  const [cooldownEnd, setCooldownEnd] = useState<number>(0);
  const [result, setResult] = useState<any>(null);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (isConnected && address) {
      checkSpinAvailability();
    }
  }, [isConnected, address]);

  const checkSpinAvailability = async () => {
    try {
      const response = await fetch(`/api/spin/start?wallet=${address}&check=true`);
      const data = await response.json();

      setCanSpin(data.canSpin);
      if (!data.canSpin && data.remainingTime) {
        setCooldownEnd(Date.now() + data.remainingTime * 1000);
      }
    } catch (error) {
      console.error('Error checking spin availability:', error);
    }
  };

  const handleSpin = async () => {
    if (!canSpin || spinning) return;

    setSpinning(true);
    setShowResult(false);

    try {
      // Start spin
      const startResponse = await fetch('/api/spin/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address }),
      });

      const spinData = await startResponse.json();

      if (!spinData.success) {
        throw new Error(spinData.error || 'Spin failed');
      }

      // Animate wheel spinning
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Get reward
      const rewardResponse = await fetch('/api/spin/reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: address,
          spinId: spinData.spinId
        }),
      });

      const rewardData = await rewardResponse.json();
      setResult(rewardData.reward);
      setShowResult(true);
      setCanSpin(false);

      // Set new cooldown
      setCooldownEnd(Date.now() + 86400000);
    } catch (error) {
      console.error('Spin error:', error);
      alert('Failed to spin. Please try again.');
    } finally {
      setSpinning(false);
    }
  };

  if (!isConnected) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-12 shadow-xl text-center">
          <h2 className="text-2xl font-bold mb-4">Connect Wallet</h2>
          <p className="text-gray-600 mb-6">
            Please connect your wallet to spin
          </p>
          <ConnectButton />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold text-center text-orange-900 mb-8">
            Daily Spin 🎰
          </h1>

          <div className="bg-white rounded-2xl p-8 shadow-xl">
            {canSpin ? (
              <>
                <SpinWheel spinning={spinning} result={result} />

                <button
                  onClick={handleSpin}
                  disabled={spinning || !canSpin}
                  className="w-full mt-8 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white font-bold py-4 px-8 rounded-lg text-xl transition-colors"
                >
                  {spinning ? 'SPINNING...' : 'SPIN NOW! 🎰'}
                </button>
              </>
            ) : (
              <div className="text-center">
                <Image
                  src="/basket.png"
                  alt="Come back later"
                  width={150}
                  height={150}
                  className="mx-auto mb-6 opacity-50"
                />
                <h3 className="text-2xl font-bold mb-4">Come Back Later!</h3>
                <p className="text-gray-600 mb-6">
                  Your next free spin is available in:
                </p>
                <CooldownTimer endTime={cooldownEnd} />
                <div className="mt-8">
                  <button
                    onClick={() => router.push('/market')}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg"
                  >
                    Buy More Spins
                  </button>
                </div>
              </div>
            )}
          </div>

          {showResult && result && (
            <div className="mt-8 bg-white rounded-2xl p-8 shadow-xl animate-bounce-in">
              <h3 className="text-2xl font-bold text-center mb-4">
                🎉 You Won!
              </h3>
              <div className="text-center">
                {result.type === 'nft' && (
                  <>
                    <p className="text-xl mb-4">NFT: {result.value}</p>
                    <p className="text-gray-600">
                      Check your inventory to see your new item!
                    </p>
                  </>
                )}
                {result.type === 'points' && (
                  <>
                    <p className="text-xl mb-4">{result.amount} FryPoints!</p>
                    <p className="text-gray-600">
                      Points have been added to your account
                    </p>
                  </>
                )}
                {result.type === 'partner' && (
                  <>
                    <p className="text-xl mb-4">Partner Reward!</p>
                    <p className="text-gray-600">{result.message}</p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
