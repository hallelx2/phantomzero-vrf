import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useWallet } from "@solana/wallet-adapter-react"
import { Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js"
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token"
import BN from "bn.js"
import { useProgram } from "@/hooks/useProgram"
import { getBettingPoolPda, getRoundPda, getBetPda } from "@/utils/pda"
import type { BetSlipEntry } from "@/types/sportsbook"
import type { BettingPool } from "@/types/sportsbook"

export interface PlaceBetParams {
  selections: BetSlipEntry[]
  /** Total wager in raw token units (lamports-equivalent, 1 token = 1e9) */
  amountRaw: BN
  /** Index into bettingPool.teamTokenMints[] if user holds a team token; null otherwise */
  teamTokenIndex?: number | null
}

/**
 * Sends a placeBet transaction.
 * Invalidates ["myBets", "bettingPool", "currentRound"] queries on success.
 */
export function usePlaceBet() {
  const { publicKey } = useWallet()
  const { program } = useProgram()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ selections, amountRaw, teamTokenIndex }: PlaceBetParams) => {
      if (!publicKey) throw new Error("Wallet not connected")
      if (selections.length === 0) throw new Error("No selections made")
      if (selections.length > 10) throw new Error("Maximum 10 selections per bet")

      // ── Fetch live pool data ───────────────────────────────────────────────
      const [bettingPoolPda] = getBettingPoolPda()
      const poolData = await program.account.bettingPool.fetch(bettingPoolPda)
      const pool = poolData as unknown as BettingPool

      const nextBetId = pool.nextBetId
      const currentRoundId = new BN(pool.nextRoundId.toNumber() - 1)

      if (currentRoundId.ltn(0)) throw new Error("No active round")

      // ── Derive PDAs ───────────────────────────────────────────────────────
      const [roundPda] = getRoundPda(bettingPoolPda, currentRoundId)
      const [betPda] = getBetPda(bettingPoolPda, nextBetId)

      // ── Token accounts ────────────────────────────────────────────────────
      const tokenMint = pool.tokenMint
      const bettorTokenAccount = await getAssociatedTokenAddress(tokenMint, publicKey)
      const bettingPoolTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        bettingPoolPda,
        true // allowOwnerOffCurve = true for PDA
      )
      const protocolTreasuryTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        pool.protocolTreasury
      )

      // ── Build instruction args ────────────────────────────────────────────
      const matchIndices = selections.map((s) => s.matchIndex)
      const outcomes = selections.map((s) => s.outcome)

      // ── Optional team token account ───────────────────────────────────────
      let teamTokenAccount: ReturnType<typeof getAssociatedTokenAddress> | null = null
      if (teamTokenIndex != null && pool.teamTokenMints[teamTokenIndex]) {
        const teamMint = pool.teamTokenMints[teamTokenIndex]
        teamTokenAccount = getAssociatedTokenAddress(teamMint, publicKey)
      }

      const resolvedTeamTokenAccount = teamTokenAccount ? await teamTokenAccount : null

      // ── Send transaction ──────────────────────────────────────────────────
      const tx = await program.methods
        .placeBet(
          currentRoundId.toNumber(),
          matchIndices,
          outcomes,
          amountRaw
        )
        .accounts({
          bettingPool: bettingPoolPda,
          roundAccounting: roundPda,
          bet: betPda,
          bettorTokenAccount,
          bettingPoolTokenAccount,
          protocolTreasuryTokenAccount,
          teamTokenAccount: resolvedTeamTokenAccount ?? null,
          bettor: publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      return { signature: tx, betId: nextBetId.toNumber() }
    },

    onSuccess: (_data, { selections }) => {
      // Invalidate relevant queries so UI refreshes
      queryClient.invalidateQueries({ queryKey: ["myBets"] })
      queryClient.invalidateQueries({ queryKey: ["bettingPool"] })
      queryClient.invalidateQueries({ queryKey: ["currentRound"] })
    },
  })
}
