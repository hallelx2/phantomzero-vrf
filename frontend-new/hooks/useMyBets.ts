import { useWallet } from "@solana/wallet-adapter-react"
import { useQuery } from "@tanstack/react-query"
import { useProgram } from "@/hooks/useProgram"
import { useCurrentRound } from "@/hooks/useCurrentRound"
import type { Bet, BetWithStatus, RoundAccounting } from "@/types/sportsbook"
import { outcomeToNumber, isPending } from "@/utils/format"
import BN from "bn.js"
import { ODDS_SCALE } from "@/config/program"

function determineBetStatus(
  bet: Bet,
  round: RoundAccounting | null | undefined
): BetWithStatus["status"] {
  if (bet.claimed) return "claimed"
  if (!round || !round.settled) return "pending"

  // Check all predictions
  const predictions = bet.predictions.slice(0, bet.numPredictions)
  const allCorrect = predictions.every((pred) => {
    const result = round.matchResults[pred.matchIndex]
    if (!result || isPending(result)) return false
    return outcomeToNumber(result) === pred.predictedOutcome
  })

  if (allCorrect) return "won"
  return "lost"
}

function estimateBetPayout(bet: Bet, round: RoundAccounting | null | undefined): number {
  if (!round || !round.settled) return 0
  const predictions = bet.predictions.slice(0, bet.numPredictions)

  let basePayout = 0
  for (const pred of predictions) {
    const lo = round.lockedOdds[pred.matchIndex]
    if (!lo?.locked) return 0
    const odds = pred.predictedOutcome === 1
      ? lo.homeOdds.toNumber()
      : pred.predictedOutcome === 2
      ? lo.awayOdds.toNumber()
      : lo.drawOdds.toNumber()
    basePayout += (pred.amountInPool.toNumber() * odds) / ODDS_SCALE
  }

  const finalPayout = (basePayout * bet.lockedMultiplier.toNumber()) / ODDS_SCALE
  return finalPayout / 1e9 // convert to token units
}

/** Returns all bets placed by the connected wallet */
export function useMyBets() {
  const { publicKey } = useWallet()
  const { program } = useProgram()
  const { data: currentRound } = useCurrentRound()

  return useQuery({
    queryKey: ["myBets", publicKey?.toBase58()],
    queryFn: async (): Promise<BetWithStatus[]> => {
      if (!publicKey) return []

      // Fetch all Bet accounts where bettor = user
      const accounts = await program.account.bet.all([
        {
          memcmp: {
            offset: 8, // skip discriminator
            bytes: publicKey.toBase58(),
          },
        },
      ])

      const bets = accounts.map(({ account }) => account as unknown as Bet)

      // Sort by bet ID descending (newest first)
      bets.sort((a, b) => b.betId.toNumber() - a.betId.toNumber())

      return bets.map((bet) => ({
        ...bet,
        status: determineBetStatus(bet, currentRound),
        estimatedPayout: estimateBetPayout(bet, currentRound),
        round: currentRound ?? undefined,
      }))
    },
    enabled: !!publicKey,
    refetchInterval: 20_000,
  })
}
