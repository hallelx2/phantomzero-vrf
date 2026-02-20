import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useWallet } from "@solana/wallet-adapter-react"
import { SystemProgram } from "@solana/web3.js"
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token"
import BN from "bn.js"
import { useProgram } from "@/hooks/useProgram"
import { getBettingPoolPda, getRoundPda, getBetPda } from "@/utils/pda"
import type { BettingPool, Bet } from "@/types/sportsbook"

export interface ClaimWinningsParams {
  bet: Bet
  /** Minimum acceptable payout in raw token units (slippage protection). 0 = no check. */
  minPayoutRaw?: BN
}

/**
 * Sends a claimWinnings transaction.
 *
 * Works for both:
 * - The bettor claiming their own winnings within 24 h
 * - A bounty hunter claiming after the 24-h window expires (receives 10%)
 */
export function useClaimWinnings() {
  const { publicKey } = useWallet()
  const { program } = useProgram()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ bet, minPayoutRaw = new BN(0) }: ClaimWinningsParams) => {
      if (!publicKey) throw new Error("Wallet not connected")

      // ── Fetch token mint from pool ─────────────────────────────────────────
      const [bettingPoolPda] = getBettingPoolPda()
      const poolData = await program.account.bettingPool.fetch(bettingPoolPda)
      const pool = poolData as unknown as BettingPool

      const tokenMint = pool.tokenMint

      // ── Derive PDAs ────────────────────────────────────────────────────────
      const [roundPda] = getRoundPda(bettingPoolPda, bet.roundId)
      const [betPda] = getBetPda(bettingPoolPda, bet.betId)

      // ── Token accounts ─────────────────────────────────────────────────────
      // The original bettor's token account (where winnings go if claimer == bettor)
      const bettorTokenAccount = await getAssociatedTokenAddress(tokenMint, bet.bettor)

      // The pool's token account (source of funds)
      const bettingPoolTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        bettingPoolPda,
        true // allowOwnerOffCurve for PDA
      )

      // The claimer's token account (= bettorTokenAccount when claimer is the bettor)
      const claimerTokenAccount = await getAssociatedTokenAddress(tokenMint, publicKey)

      // ── Send transaction ───────────────────────────────────────────────────
      const tx = await program.methods
        .claimWinnings(bet.betId, minPayoutRaw)
        .accounts({
          bettingPool: bettingPoolPda,
          roundAccounting: roundPda,
          bet: betPda,
          bettingPoolTokenAccount,
          bettorTokenAccount,
          claimer: publicKey,
          claimerTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      return { signature: tx }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myBets"] })
      queryClient.invalidateQueries({ queryKey: ["currentRound"] })
    },
  })
}
