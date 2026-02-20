import { PublicKey } from "@solana/web3.js"
import BN from "bn.js"
import {
  PROGRAM_ID,
  BETTING_POOL_SEED,
  ROUND_SEED,
  BET_SEED,
  SEASON_PRED_SEED,
} from "@/config/program"

export function getBettingPoolPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(BETTING_POOL_SEED)],
    PROGRAM_ID
  )
}

export function getRoundPda(
  bettingPool: PublicKey,
  roundId: BN | number
): [PublicKey, number] {
  const id = typeof roundId === "number" ? new BN(roundId) : roundId
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(ROUND_SEED),
      bettingPool.toBuffer(),
      id.toArrayLike(Buffer, "le", 8),
    ],
    PROGRAM_ID
  )
}

export function getBetPda(
  bettingPool: PublicKey,
  betId: BN | number
): [PublicKey, number] {
  const id = typeof betId === "number" ? new BN(betId) : betId
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(BET_SEED),
      bettingPool.toBuffer(),
      id.toArrayLike(Buffer, "le", 8),
    ],
    PROGRAM_ID
  )
}

export function getSeasonPredictionPda(
  user: PublicKey,
  bettingPool: PublicKey,
  seasonId: BN | number
): [PublicKey, number] {
  const id = typeof seasonId === "number" ? new BN(seasonId) : seasonId
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(SEASON_PRED_SEED),
      user.toBuffer(),
      bettingPool.toBuffer(),
      id.toArrayLike(Buffer, "le", 8),
    ],
    PROGRAM_ID
  )
}
