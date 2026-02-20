import { PublicKey } from "@solana/web3.js"
import BN from "bn.js"

// ── On-chain state types ──────────────────────────────────────────────────────

export interface MatchPool {
  homeWinPool: BN
  awayWinPool: BN
  drawPool:    BN
  totalPool:   BN
}

export interface LockedOdds {
  homeOdds: BN
  awayOdds: BN
  drawOdds: BN
  locked:   boolean
}

export interface Prediction {
  matchIndex:       number
  predictedOutcome: number   // 1=Home 2=Away 3=Draw
  amountInPool:     BN
}

export type MatchOutcome = { pending: {} } | { homeWin: {} } | { awayWin: {} } | { draw: {} }

export interface BettingPool {
  authority:          PublicKey
  tokenMint:          PublicKey
  protocolTreasury:   PublicKey
  liquidityPool:      PublicKey
  protocolFeeBps:     number
  winnerShareBps:     number
  seasonPoolShareBps: number
  seasonRewardPool:   BN
  nextBetId:          BN
  nextRoundId:        BN
  teamTokenMints:     PublicKey[]
  seasonNftCollection:PublicKey
  currentSeasonId:    BN
  seasonEnded:        boolean
  seasonWinningTeam:  number
  bump:               number
}

export interface RoundAccounting {
  roundId:                 BN
  bettingPool:             PublicKey
  matchPools:              MatchPool[]
  lockedOdds:              LockedOdds[]
  matchResults:            MatchOutcome[]
  totalBetVolume:          BN
  totalWinningPool:        BN
  totalLosingPool:         BN
  totalReservedForWinners: BN
  totalClaimed:            BN
  totalPaidOut:            BN
  protocolFeeCollected:    BN
  protocolRevenueShare:    BN
  seasonRevenueShare:      BN
  revenueDistributed:      boolean
  protocolSeedAmount:      BN
  seeded:                  boolean
  totalUserDeposits:       BN
  parlayCount:             BN
  roundStartTime:          BN
  roundEndTime:            BN
  settled:                 boolean
  bump:                    number
}

export interface Bet {
  bettor:           PublicKey
  roundId:          BN
  betId:            BN
  amount:           BN
  amountAfterFee:   BN
  allocatedAmount:  BN
  bonus:            BN
  lockedMultiplier: BN
  numPredictions:   number
  predictions:      Prediction[]
  settled:          boolean
  claimed:          boolean
  claimDeadline:    BN
  bountyClaimer:    PublicKey | null
  bump:             number
}

export interface SeasonPrediction {
  user:          PublicKey
  seasonId:      BN
  predictedTeam: number
  nftMint:       PublicKey
  claimedReward: boolean
  predictedAt:   BN
  bump:          number
}

// ── UI / derived types ────────────────────────────────────────────────────────

export type OutcomeId = 1 | 2 | 3

export interface MatchSelection {
  matchIndex: number
  outcome:    OutcomeId
  odds:       number   // decimal, e.g. 1.75
}

/** A line in the active bet-slip */
export interface BetSlipEntry extends MatchSelection {
  label: string  // "Arsenal vs Chelsea – Home"
}

export type BetStatus = "pending" | "won" | "lost" | "claimed"

export interface BetWithStatus extends Bet {
  status:       BetStatus
  estimatedPayout: number  // in tokens (human-readable)
  round?:       RoundAccounting
}
