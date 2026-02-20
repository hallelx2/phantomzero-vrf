import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useWallet } from "@solana/wallet-adapter-react"
import { Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js"
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token"
import BN from "bn.js"
import { useProgram } from "@/hooks/useProgram"
import { useBettingPool } from "@/hooks/useBettingPool"
import { getBettingPoolPda, getSeasonPredictionPda } from "@/utils/pda"
import type { BettingPool, SeasonPrediction } from "@/types/sportsbook"

// ── Fetch current user's season prediction ────────────────────────────────────

export function useMySeasonPrediction() {
  const { publicKey } = useWallet()
  const { program } = useProgram()
  const { data: pool } = useBettingPool()
  const [bettingPoolPda] = getBettingPoolPda()

  return useQuery({
    queryKey: ["seasonPrediction", publicKey?.toBase58(), pool?.currentSeasonId?.toNumber()],
    queryFn: async (): Promise<SeasonPrediction | null> => {
      if (!publicKey || !pool) return null
      const [predPda] = getSeasonPredictionPda(
        publicKey,
        bettingPoolPda,
        pool.currentSeasonId
      )
      try {
        const data = await program.account.seasonPrediction.fetch(predPda)
        return data as unknown as SeasonPrediction
      } catch {
        return null // account does not exist yet
      }
    },
    enabled: !!publicKey && !!pool,
    refetchInterval: 20_000,
  })
}

// ── Make season prediction ────────────────────────────────────────────────────

export interface MakeSeasonPredictionParams {
  predictedTeam: number // 0-9 index into TEAMS array
}

/**
 * Mints a prediction NFT and records the user's season prediction on-chain.
 * Each wallet can only predict once per season.
 */
export function useMakeSeasonPrediction() {
  const { publicKey } = useWallet()
  const { program } = useProgram()
  const queryClient = useQueryClient()
  const [bettingPoolPda] = getBettingPoolPda()

  return useMutation({
    mutationFn: async ({ predictedTeam }: MakeSeasonPredictionParams) => {
      if (!publicKey) throw new Error("Wallet not connected")

      // Fetch live pool data
      const poolData = await program.account.bettingPool.fetch(bettingPoolPda)
      const pool = poolData as unknown as BettingPool

      if (pool.seasonEnded) throw new Error("Season has already ended")

      // Generate a fresh NFT mint keypair for this prediction
      const nftMint = Keypair.generate()

      // Derive season prediction PDA
      const [seasonPredictionPda] = getSeasonPredictionPda(
        publicKey,
        bettingPoolPda,
        pool.currentSeasonId
      )

      // User's token account for the new NFT mint
      const userNftAccount = await getAssociatedTokenAddress(nftMint.publicKey, publicKey)

      const tx = await program.methods
        .makeSeasonPrediction(predictedTeam)
        .accounts({
          bettingPool: bettingPoolPda,
          seasonPrediction: seasonPredictionPda,
          nftMint: nftMint.publicKey,
          userNftAccount,
          user: publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([nftMint])
        .rpc()

      return { signature: tx, nftMint: nftMint.publicKey.toBase58() }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seasonPrediction"] })
      queryClient.invalidateQueries({ queryKey: ["bettingPool"] })
    },
  })
}

// ── Claim season reward ───────────────────────────────────────────────────────

export interface ClaimSeasonRewardParams {
  /** Total number of predictors for the season (fetched from getProgramAccounts count) */
  totalPredictors: BN
}

/**
 * Claims the token reward for a correct season prediction.
 * Can only be called after the season has ended with a winning team declared.
 */
export function useClaimSeasonReward() {
  const { publicKey } = useWallet()
  const { program } = useProgram()
  const queryClient = useQueryClient()
  const [bettingPoolPda] = getBettingPoolPda()

  return useMutation({
    mutationFn: async ({ totalPredictors }: ClaimSeasonRewardParams) => {
      if (!publicKey) throw new Error("Wallet not connected")

      const poolData = await program.account.bettingPool.fetch(bettingPoolPda)
      const pool = poolData as unknown as BettingPool

      if (!pool.seasonEnded) throw new Error("Season has not ended yet")

      const [seasonPredictionPda] = getSeasonPredictionPda(
        publicKey,
        bettingPoolPda,
        pool.currentSeasonId
      )

      const tokenMint = pool.tokenMint

      const bettingPoolTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        bettingPoolPda,
        true
      )
      const userTokenAccount = await getAssociatedTokenAddress(tokenMint, publicKey)

      const tx = await program.methods
        .claimSeasonReward(totalPredictors)
        .accounts({
          bettingPool: bettingPoolPda,
          seasonPrediction: seasonPredictionPda,
          bettingPoolTokenAccount,
          userTokenAccount,
          user: publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc()

      return { signature: tx }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seasonPrediction"] })
    },
  })
}
