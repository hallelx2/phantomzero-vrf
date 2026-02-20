import { useQuery } from "@tanstack/react-query"
import BN from "bn.js"
import { getBettingPoolPda, getRoundPda } from "@/utils/pda"
import { useProgram } from "@/hooks/useProgram"
import { useBettingPool } from "@/hooks/useBettingPool"
import type { RoundAccounting } from "@/types/sportsbook"

/** Fetches the most recent (current) round's RoundAccounting account */
export function useCurrentRound() {
  const { program } = useProgram()
  const { data: pool } = useBettingPool()
  const [bettingPoolPda] = getBettingPoolPda()

  // nextRoundId - 1 = last created round
  const currentRoundId = pool
    ? new BN(pool.nextRoundId.toNumber() - 1)
    : null

  return useQuery({
    queryKey: ["currentRound", currentRoundId?.toNumber()],
    queryFn: async (): Promise<RoundAccounting | null> => {
      if (!currentRoundId || currentRoundId.ltn(0)) return null
      const [roundPda] = getRoundPda(bettingPoolPda, currentRoundId)
      try {
        const data = await program.account.roundAccounting.fetch(roundPda)
        return data as unknown as RoundAccounting
      } catch {
        return null
      }
    },
    enabled: !!currentRoundId && currentRoundId.gtn(0),
    refetchInterval: 15_000,
  })
}

/** Fetch a specific round by ID */
export function useRound(roundId: number | null) {
  const { program } = useProgram()
  const [bettingPoolPda] = getBettingPoolPda()

  return useQuery({
    queryKey: ["round", roundId],
    queryFn: async (): Promise<RoundAccounting | null> => {
      if (roundId == null || roundId < 0) return null
      const [roundPda] = getRoundPda(bettingPoolPda, roundId)
      try {
        const data = await program.account.roundAccounting.fetch(roundPda)
        return data as unknown as RoundAccounting
      } catch {
        return null
      }
    },
    enabled: roundId != null && roundId >= 0,
    refetchInterval: 15_000,
  })
}
