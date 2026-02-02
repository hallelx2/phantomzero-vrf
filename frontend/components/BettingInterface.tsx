'use client';

import { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { placeBetTransaction } from '@/utils/transactions';

// TODO: Replace with your actual token mint
const TOKEN_MINT = new PublicKey('So11111111111111111111111111111111111111112'); // Devnet WSOL for now
const CURRENT_ROUND_ID = 0; // TODO: Fetch from betting pool

interface Match {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeOdds: number;
  awayOdds: number;
  drawOdds: number;
}

interface Bet {
  matchId: number;
  outcome: 1 | 2 | 3; // 1=HOME, 2=AWAY, 3=DRAW
}

export default function BettingInterface() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [betAmount, setBetAmount] = useState<string>('');
  const [selectedBets, setSelectedBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(false);

  // Mock matches - in production, fetch from chain
  const matches: Match[] = Array.from({ length: 10 }, (_, i) => ({
    id: i,
    homeTeam: `Team ${i * 2 + 1}`,
    awayTeam: `Team ${i * 2 + 2}`,
    homeOdds: 1.25 + Math.random() * 0.7,
    awayOdds: 1.25 + Math.random() * 0.7,
    drawOdds: 1.25 + Math.random() * 0.7,
  }));

  const handleBetSelection = (matchId: number, outcome: 1 | 2 | 3) => {
    const existingBet = selectedBets.find((b) => b.matchId === matchId);

    if (existingBet) {
      if (existingBet.outcome === outcome) {
        // Deselect
        setSelectedBets(selectedBets.filter((b) => b.matchId !== matchId));
      } else {
        // Change outcome
        setSelectedBets(
          selectedBets.map((b) =>
            b.matchId === matchId ? { ...b, outcome } : b
          )
        );
      }
    } else {
      // Add new bet
      setSelectedBets([...selectedBets, { matchId, outcome }]);
    }
  };

  const calculatePayout = () => {
    if (!betAmount || selectedBets.length === 0) return '0.00';

    const amount = parseFloat(betAmount);
    let multiplier = 1;

    selectedBets.forEach((bet) => {
      const match = matches[bet.matchId];
      const odds =
        bet.outcome === 1
          ? match.homeOdds
          : bet.outcome === 2
          ? match.awayOdds
          : match.drawOdds;
      multiplier *= odds;
    });

    // Apply parlay bonus for multiple bets
    if (selectedBets.length > 1) {
      const parlayBonus = 1 + (selectedBets.length - 1) * 0.025; // 2.5% per match
      multiplier *= parlayBonus;
    }

    return (amount * multiplier).toFixed(2);
  };

  const handlePlaceBet = async () => {
    if (!publicKey || selectedBets.length === 0 || !betAmount || !sendTransaction) return;

    setLoading(true);
    try {
      // Prepare match indices and outcomes arrays
      const matchIndices = selectedBets.map((b) => b.matchId);
      const outcomes = selectedBets.map((b) => b.outcome);

      // Convert bet amount to lamports (assuming 9 decimals like SOL)
      const amountLamports = Math.floor(parseFloat(betAmount) * 1e9);

      console.log('Placing bet:', {
        roundId: CURRENT_ROUND_ID,
        matchIndices,
        outcomes,
        amount: amountLamports,
      });

      // Build the transaction
      const { transaction, betId } = await placeBetTransaction(
        connection,
        { publicKey, signTransaction: async (tx) => tx, signAllTransactions: async (txs) => txs } as any,
        CURRENT_ROUND_ID,
        matchIndices,
        outcomes,
        amountLamports,
        TOKEN_MINT
      );

      // Send and confirm transaction
      const signature = await sendTransaction(transaction, connection);
      console.log('Transaction signature:', signature);

      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');

      alert(`Bet placed successfully! Bet ID: ${betId}\nSignature: ${signature}`);

      // Clear form
      setSelectedBets([]);
      setBetAmount('');
    } catch (error: any) {
      console.error('Error placing bet:', error);
      alert(`Failed to place bet: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Matches List */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-2xl font-bold mb-4">Select Matches</h2>
          {matches.map((match) => {
            const selectedBet = selectedBets.find((b) => b.matchId === match.id);

            return (
              <div
                key={match.id}
                className="bg-gray-700 p-4 rounded-lg"
              >
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-gray-400">Match {match.id + 1}</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {/* Home Win */}
                  <button
                    onClick={() => handleBetSelection(match.id, 1)}
                    className={`p-3 rounded-lg transition-all ${
                      selectedBet?.outcome === 1
                        ? 'bg-primary text-dark font-bold'
                        : 'bg-gray-600 hover:bg-gray-500'
                    }`}
                  >
                    <div className="text-sm font-medium">{match.homeTeam}</div>
                    <div className="text-lg font-bold">{match.homeOdds.toFixed(2)}x</div>
                  </button>

                  {/* Draw */}
                  <button
                    onClick={() => handleBetSelection(match.id, 3)}
                    className={`p-3 rounded-lg transition-all ${
                      selectedBet?.outcome === 3
                        ? 'bg-primary text-dark font-bold'
                        : 'bg-gray-600 hover:bg-gray-500'
                    }`}
                  >
                    <div className="text-sm font-medium">Draw</div>
                    <div className="text-lg font-bold">{match.drawOdds.toFixed(2)}x</div>
                  </button>

                  {/* Away Win */}
                  <button
                    onClick={() => handleBetSelection(match.id, 2)}
                    className={`p-3 rounded-lg transition-all ${
                      selectedBet?.outcome === 2
                        ? 'bg-primary text-dark font-bold'
                        : 'bg-gray-600 hover:bg-gray-500'
                    }`}
                  >
                    <div className="text-sm font-medium">{match.awayTeam}</div>
                    <div className="text-lg font-bold">{match.awayOdds.toFixed(2)}x</div>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bet Slip */}
        <div className="bg-gray-700 p-6 rounded-lg h-fit sticky top-4">
          <h2 className="text-2xl font-bold mb-4">Bet Slip</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Selected Bets</label>
              {selectedBets.length === 0 ? (
                <p className="text-gray-400 text-sm">No bets selected</p>
              ) : (
                <div className="space-y-2">
                  {selectedBets.map((bet) => {
                    const match = matches[bet.matchId];
                    const outcomeName =
                      bet.outcome === 1
                        ? match.homeTeam
                        : bet.outcome === 2
                        ? match.awayTeam
                        : 'Draw';
                    const odds =
                      bet.outcome === 1
                        ? match.homeOdds
                        : bet.outcome === 2
                        ? match.awayOdds
                        : match.drawOdds;

                    return (
                      <div
                        key={bet.matchId}
                        className="bg-gray-600 p-2 rounded text-sm flex justify-between"
                      >
                        <span>
                          M{bet.matchId + 1}: {outcomeName}
                        </span>
                        <span className="font-bold">{odds.toFixed(2)}x</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Bet Amount (tokens)</label>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2 bg-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                min="0"
                step="0.01"
              />
            </div>

            <div className="bg-gray-600 p-4 rounded-lg">
              <div className="flex justify-between mb-2">
                <span className="text-sm">Bet Count:</span>
                <span className="font-bold">{selectedBets.length}</span>
              </div>
              {selectedBets.length > 1 && (
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-primary">Parlay Bonus:</span>
                  <span className="font-bold text-primary">
                    +{((selectedBets.length - 1) * 2.5).toFixed(1)}%
                  </span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t border-gray-500 pt-2">
                <span>Est. Payout:</span>
                <span className="text-primary">{calculatePayout()}</span>
              </div>
            </div>

            <button
              onClick={handlePlaceBet}
              disabled={loading || selectedBets.length === 0 || !betAmount}
              className="w-full bg-primary text-dark font-bold py-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Placing Bet...' : 'Place Bet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
