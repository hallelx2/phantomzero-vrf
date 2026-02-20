import BN from "bn.js"
import { ODDS_SCALE, TOKEN_DECIMALS } from "@/config/program"
import type { MatchOutcome } from "@/types/sportsbook"

const SCALE = 10 ** TOKEN_DECIMALS

/** Convert raw BN lamport amount → human-readable token string ("12.50") */
export function formatTokens(raw: BN | number | string, decimals = 2): string {
  const n = typeof raw === "object" && BN.isBN(raw) ? raw.toNumber() : Number(raw)
  return (n / SCALE).toFixed(decimals)
}

/** Convert raw BN odds (× 1e9) → decimal odds string ("1.75x") */
export function formatOdds(raw: BN | number): string {
  const n = typeof raw === "object" && BN.isBN(raw) ? raw.toNumber() : Number(raw)
  return (n / ODDS_SCALE).toFixed(2) + "x"
}

/** Convert raw BN odds → plain float for calculations */
export function oddsToFloat(raw: BN | number): number {
  const n = typeof raw === "object" && BN.isBN(raw) ? raw.toNumber() : Number(raw)
  return n / ODDS_SCALE
}

/** Convert human-readable token amount → BN lamports */
export function parseTokens(amount: string | number): BN {
  const n = typeof amount === "string" ? parseFloat(amount) : amount
  return new BN(Math.floor(n * SCALE))
}

/** Convert BN unix timestamp → Date */
export function bnToDate(ts: BN): Date {
  return new Date(ts.toNumber() * 1000)
}

/** Format unix timestamp → "Jan 15, 14:30" */
export function formatTimestamp(ts: BN | number): string {
  const ms = (typeof ts === "number" ? ts : ts.toNumber()) * 1000
  return new Date(ms).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** Determine if match outcome is HomeWin */
export function isHomeWin(o: MatchOutcome): boolean {
  return "homeWin" in o
}
export function isAwayWin(o: MatchOutcome): boolean {
  return "awayWin" in o
}
export function isDraw(o: MatchOutcome): boolean {
  return "draw" in o
}
export function isPending(o: MatchOutcome): boolean {
  return "pending" in o
}

/** Convert MatchOutcome → outcome number (1/2/3/0) */
export function outcomeToNumber(o: MatchOutcome): number {
  if ("homeWin" in o) return 1
  if ("awayWin" in o) return 2
  if ("draw" in o)    return 3
  return 0
}

/** Get odds for outcome from LockedOdds BN tuple */
export function getOddsForOutcome(
  lockedOdds: { homeOdds: BN; awayOdds: BN; drawOdds: BN },
  outcome: number
): number {
  switch (outcome) {
    case 1: return oddsToFloat(lockedOdds.homeOdds)
    case 2: return oddsToFloat(lockedOdds.awayOdds)
    case 3: return oddsToFloat(lockedOdds.drawOdds)
    default: return 1.0
  }
}

/** Estimate parlay multiplier for N legs (mirrors on-chain formula) */
export function getParlayMultiplier(legs: number): number {
  const multipliers = [1.0, 1.0, 1.05, 1.10, 1.13, 1.16, 1.19, 1.21, 1.23, 1.24, 1.25]
  return multipliers[Math.min(legs, 10)] ?? 1.0
}

/** Estimate payout for a parlay selection */
export function estimatePayout(
  amount: number,
  selections: { odds: number }[],
  feeBps: number = 500
): number {
  if (selections.length === 0 || amount <= 0) return 0
  const afterFee = amount * (1 - feeBps / 10000)
  const perLeg = afterFee / selections.length
  const basePayouts = selections.reduce((sum, s) => sum + perLeg * s.odds, 0)
  const multiplier = getParlayMultiplier(selections.length)
  return basePayouts * multiplier
}
