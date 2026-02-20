import { PublicKey } from "@solana/web3.js"

// ── Program address ─────────────────────────────────────────────────────────
export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ?? "Spo7t11111111111111111111111111111111111111"
)

// ── Token scaling ────────────────────────────────────────────────────────────
export const TOKEN_DECIMALS = 9
export const LAMPORTS = 10 ** TOKEN_DECIMALS   // 1e9 per token
export const ODDS_SCALE  = 1_000_000_000       // odds are stored × 1e9

// ── Protocol constants (mirror on-chain) ─────────────────────────────────────
export const DEFAULT_PROTOCOL_FEE_BPS  = 500   // 5 %
export const TEAM_TOKEN_FEE_BPS        = 200   // 2 % for token holders
export const TEAM_TOKEN_ODDS_BOOST_BPS = 500   // 5 % odds boost
export const BOUNTY_BPS                = 1000  // 10 % for late claims
export const CLAIM_WINDOW_SECONDS      = 86400 // 24 h
export const MATCHES_PER_ROUND         = 10

// ── Team names (index 0-9 maps to program team_token_mints[]) ────────────────
export const TEAMS = [
  "Arsenal",
  "Chelsea",
  "Liverpool",
  "Man City",
  "Man United",
  "Tottenham",
  "Newcastle",
  "Aston Villa",
  "Brighton",
  "West Ham",
] as const

export type TeamIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

// ── Outcome labels ────────────────────────────────────────────────────────────
export const OUTCOME_LABELS: Record<number, string> = {
  1: "Home",
  2: "Away",
  3: "Draw",
}

// ── PDA seeds ────────────────────────────────────────────────────────────────
export const BETTING_POOL_SEED = "betting_pool"
export const ROUND_SEED        = "round"
export const BET_SEED          = "bet"
export const SEASON_PRED_SEED  = "season_prediction"
