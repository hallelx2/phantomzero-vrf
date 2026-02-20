import { useQuery } from "@tanstack/react-query"
import { getBettingPoolPda } from "@/utils/pda"
import { useProgram } from "@/hooks/useProgram"
import type { BettingPool } from "@/types/sportsbook"

export function useBettingPool() {
  const { program } = useProgram()
  const [bettingPoolPda] = getBettingPoolPda()

  return useQuery({
    queryKey: ["bettingPool", bettingPoolPda.toBase58()],
    queryFn: async (): Promise<BettingPool> => {
      const data = await program.account.bettingPool.fetch(bettingPoolPda)
      return data as unknown as BettingPool
    },
    // Refresh every 15 seconds
    refetchInterval: 15_000,
    retry: 2,
  })
}
