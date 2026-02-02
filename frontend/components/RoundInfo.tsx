'use client';

import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { claimWinningsTransaction } from '@/utils/transactions';

// TODO: Replace with your actual token mint
const TOKEN_MINT = new PublicKey('So11111111111111111111111111111111111111112'); // Devnet WSOL for now

interface MatchResult {
  id: number;
  homeTeam: string;
  awayTeam: string;
  result: 'HOME' | 'AWAY' | 'DRAW' | 'PENDING';
  homePool: number;
  awayPool: number;
  drawPool: number;
}

export default function RoundInfo() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [currentRound, setCurrentRound] = useState(0);
  const [loading, setLoading] = useState(false);
  const [claimingBetId, setClaimingBetId] = useState<number | null>(null);

  // Mock round data - in production, fetch from chain
  const roundData = {
    roundId: currentRound,
    status: 'ACTIVE' as 'ACTIVE' | 'SETTLED' | 'PENDING',
    startTime: new Date(Date.now() - 3600000),
    totalBetVolume: 250000,
    totalBets: 145,
    totalParlays: 52,
    winningPool: 95000,
    losingPool: 155000,
    reservedForWinners: 185000,
    totalClaimed: 0,
    seeded: true,
  };

  const matches: MatchResult[] = Array.from({ length: 10 }, (_, i) => ({
    id: i,
    homeTeam: `Team ${i * 2 + 1}`,
    awayTeam: `Team ${i * 2 + 2}`,
    result: roundData.status === 'SETTLED' ? (['HOME', 'AWAY', 'DRAW'][Math.floor(Math.random() * 3)] as any) : 'PENDING',
    homePool: 10000 + Math.random() * 20000,
    awayPool: 10000 + Math.random() * 20000,
    drawPool: 5000 + Math.random() * 10000,
  }));

  const yourBets = [
    {
      betId: 1,
      amount: 100,
      matches: [0, 1, 2],
      outcomes: ['HOME', 'AWAY', 'HOME'],
      expectedPayout: 285.5,
      status: 'ACTIVE',
      claimed: false,
    },
    {
      betId: 2,
      amount: 50,
      matches: [5],
      outcomes: ['DRAW'],
      expectedPayout: 82.5,
      status: 'ACTIVE',
      claimed: false,
    },
  ];

  const handleClaimWinnings = async (betId: number, expectedPayout: number) => {
    if (!publicKey || !sendTransaction) return;

    setClaimingBetId(betId);
    try {
      // Convert expected payout to lamports (with 1% slippage tolerance)
      const minPayoutLamports = Math.floor(expectedPayout * 0.99 * 1e9);

      console.log('Claiming winnings:', {
        betId,
        roundId: currentRound,
        minPayout: minPayoutLamports,
      });

      // Build the transaction
      const transaction = await claimWinningsTransaction(
        connection,
        { publicKey, signTransaction: async (tx) => tx, signAllTransactions: async (txs) => txs } as any,
        betId,
        currentRound,
        minPayoutLamports,
        TOKEN_MINT
      );

      // Send and confirm transaction
      const signature = await sendTransaction(transaction, connection);
      console.log('Transaction signature:', signature);

      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');

      alert(`Winnings claimed successfully!\nSignature: ${signature}`);

      // In production, refresh the bet data here
    } catch (error: any) {
      console.error('Error claiming winnings:', error);
      alert(`Failed to claim winnings: ${error.message || error}`);
    } finally {
      setClaimingBetId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Round Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold mb-2">Round #{roundData.roundId}</h2>
          <div className="flex items-center gap-4">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
              roundData.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' :
              roundData.status === 'SETTLED' ? 'bg-blue-500/20 text-blue-400' :
              'bg-yellow-500/20 text-yellow-400'
            }`}>
              {roundData.status}
            </span>
            <span className="text-gray-400 text-sm">
              Started {roundData.startTime.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setCurrentRound(Math.max(0, currentRound - 1))}
            disabled={currentRound === 0}
            className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <button
            onClick={() => setCurrentRound(currentRound + 1)}
            className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Round Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-700 p-4 rounded-lg">
          <div className="text-sm text-gray-400 mb-1">Total Volume</div>
          <div className="text-xl font-bold text-primary">
            {roundData.totalBetVolume.toLocaleString()}
          </div>
        </div>

        <div className="bg-gray-700 p-4 rounded-lg">
          <div className="text-sm text-gray-400 mb-1">Total Bets</div>
          <div className="text-xl font-bold">
            {roundData.totalBets}
          </div>
        </div>

        <div className="bg-gray-700 p-4 rounded-lg">
          <div className="text-sm text-gray-400 mb-1">Parlays</div>
          <div className="text-xl font-bold">
            {roundData.totalParlays}
          </div>
        </div>

        <div className="bg-gray-700 p-4 rounded-lg">
          <div className="text-sm text-gray-400 mb-1">Reserved</div>
          <div className="text-xl font-bold text-yellow-400">
            {roundData.reservedForWinners.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Match Results */}
      <div>
        <h3 className="text-xl font-bold mb-4">Match Results</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {matches.map((match) => (
            <div key={match.id} className="bg-gray-700 p-4 rounded-lg">
              <div className="flex justify-between items-start mb-3">
                <div className="text-sm font-medium">Match {match.id + 1}</div>
                {match.result !== 'PENDING' && (
                  <span className="px-2 py-1 bg-primary text-dark text-xs font-bold rounded">
                    {match.result}
                  </span>
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className={match.result === 'HOME' ? 'font-bold text-primary' : ''}>
                    {match.homeTeam}
                  </span>
                  <span className="text-gray-400">
                    {match.homePool.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className={match.result === 'DRAW' ? 'font-bold text-primary' : ''}>
                    Draw
                  </span>
                  <span className="text-gray-400">
                    {match.drawPool.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className={match.result === 'AWAY' ? 'font-bold text-primary' : ''}>
                    {match.awayTeam}
                  </span>
                  <span className="text-gray-400">
                    {match.awayPool.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Your Bets */}
      {yourBets.length > 0 && (
        <div>
          <h3 className="text-xl font-bold mb-4">Your Bets</h3>
          <div className="space-y-4">
            {yourBets.map((bet) => (
              <div key={bet.betId} className="bg-gray-700 p-6 rounded-lg">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="text-lg font-bold mb-1">Bet #{bet.betId}</div>
                    <div className="text-sm text-gray-400">
                      {bet.matches.length} match{bet.matches.length > 1 ? 'es' : ''}
                      {bet.matches.length > 1 && ' (Parlay)'}
                    </div>
                  </div>

                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    bet.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' :
                    bet.claimed ? 'bg-gray-500/20 text-gray-400' :
                    'bg-primary/20 text-primary'
                  }`}>
                    {bet.claimed ? 'CLAIMED' : bet.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-gray-400">Amount</div>
                    <div className="font-bold">{bet.amount}</div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-400">Expected Payout</div>
                    <div className="font-bold text-primary">{bet.expectedPayout}</div>
                  </div>

                  <div className="col-span-2">
                    <div className="text-sm text-gray-400 mb-1">Predictions</div>
                    <div className="flex flex-wrap gap-2">
                      {bet.matches.map((matchId, idx) => (
                        <span key={matchId} className="px-2 py-1 bg-gray-600 rounded text-xs">
                          M{matchId + 1}: {bet.outcomes[idx]}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {!bet.claimed && roundData.status === 'SETTLED' && (
                  <button
                    onClick={() => handleClaimWinnings(bet.betId, bet.expectedPayout)}
                    disabled={claimingBetId === bet.betId}
                    className="w-full bg-primary text-dark font-bold py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {claimingBetId === bet.betId ? 'Claiming...' : 'Claim Winnings'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VRF Info */}
      {roundData.status === 'SETTLED' && (
        <div className="bg-gray-700 p-6 rounded-lg">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            🎲 VRF Randomness
          </h3>
          <p className="text-gray-400 text-sm mb-4">
            Match outcomes for this round were determined using Switchboard VRF (Verifiable Random
            Function), ensuring provably fair and unbiased results.
          </p>
          <div className="bg-gray-600 p-4 rounded-lg font-mono text-xs break-all">
            VRF Proof: 0xabcd1234...ef567890 (Mock)
          </div>
        </div>
      )}
    </div>
  );
}
