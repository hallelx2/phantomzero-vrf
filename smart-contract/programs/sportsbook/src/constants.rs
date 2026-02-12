/// Constants for the sportsbook betting contract
///
/// All constants are defined to match the Solidity contract behavior
/// Odds and multipliers are scaled by 1e9 on Solana (vs 1e18 on Ethereum)

/// BASIS POINTS = 10000 (100%)
pub const BPS_DENOMINATOR: u64 = 10000;

/// Protocol fee on all bets (5%)
pub const DEFAULT_PROTOCOL_FEE_BPS: u16 = 500;

/// Winner share distributed (25%)
pub const DEFAULT_WINNER_SHARE_BPS: u16 = 2500;

/// Season pool share (2%)
pub const DEFAULT_SEASON_POOL_SHARE_BPS: u16 = 200;

/// MULTIBET STAKE BONUS RATES (basis points)
/// Bonus added to pool upfront
pub const BONUS_2_MATCH: u64 = 500;   // 5%
pub const BONUS_3_MATCH: u64 = 1000;  // 10%
pub const BONUS_4_PLUS: u64 = 2000;   // 20%

/// PARLAY PAYOUT MULTIPLIERS (1e9 scale, reduced for LP safety)
/// Linear progression: 1.05x (2 matches) to 1.25x (10 matches)
pub const ODDS_SCALE: u64 = 1_000_000_000; // 1e9 (vs 1e18 on Ethereum)

pub const PARLAY_MULTIPLIER_1_MATCH: u64 = ODDS_SCALE;            // 1.0x
pub const PARLAY_MULTIPLIER_2_MATCHES: u64 = 1_050_000_000;       // 1.05x
pub const PARLAY_MULTIPLIER_3_MATCHES: u64 = 1_100_000_000;       // 1.10x
pub const PARLAY_MULTIPLIER_4_MATCHES: u64 = 1_130_000_000;       // 1.13x
pub const PARLAY_MULTIPLIER_5_MATCHES: u64 = 1_160_000_000;       // 1.16x
pub const PARLAY_MULTIPLIER_6_MATCHES: u64 = 1_190_000_000;       // 1.19x
pub const PARLAY_MULTIPLIER_7_MATCHES: u64 = 1_210_000_000;       // 1.21x
pub const PARLAY_MULTIPLIER_8_MATCHES: u64 = 1_230_000_000;       // 1.23x
pub const PARLAY_MULTIPLIER_9_MATCHES: u64 = 1_240_000_000;       // 1.24x
pub const PARLAY_MULTIPLIER_10_MATCHES: u64 = 1_250_000_000;      // 1.25x

/// SEEDING AMOUNTS PER MATCH (assuming 9 decimals for LEAGUE token)
/// These create initial odds in 1.2-1.8x range
pub const SEED_HOME_POOL: u64 = 1_200_000_000_000;   // 1200 tokens (9 decimals)
pub const SEED_AWAY_POOL: u64 = 800_000_000_000;     // 800 tokens
pub const SEED_DRAW_POOL: u64 = 1_000_000_000_000;   // 1000 tokens
pub const SEED_PER_MATCH: u64 = 3_000_000_000_000;   // 3000 tokens
pub const SEED_PER_ROUND: u64 = SEED_PER_MATCH * 10; // 30,000 tokens per round

/// VIRTUAL LIQUIDITY MULTIPLIER
/// Multiplier for virtual liquidity to dampen odds movement
/// Set to 12M to create stable odds (can be adjusted)
pub const VIRTUAL_LIQUIDITY_MULTIPLIER: u64 = 12_000_000;

/// LIQUIDITY-AWARE PARLAY PARAMETERS
/// Minimum pool imbalance for full bonus (40%)
pub const MIN_IMBALANCE_FOR_FULL_BONUS: u64 = 4000; // 40% in basis points

/// Minimum parlay multiplier (1.1x)
pub const MIN_PARLAY_MULTIPLIER: u64 = 1_100_000_000;

/// COUNT-BASED PARLAY TIERS (FOMO mechanism)
pub const COUNT_TIER_1: u64 = 10;   // First 10 parlays
pub const COUNT_TIER_2: u64 = 20;   // Parlays 11-20
pub const COUNT_TIER_3: u64 = 30;   // Parlays 21-30
pub const COUNT_TIER_4: u64 = 40;   // Parlays 31-40

/// COUNT-BASED MULTIPLIERS (decreasing with each tier)
pub const COUNT_MULT_TIER_1: u64 = 2_500_000_000;  // 2.5x (first 10)
pub const COUNT_MULT_TIER_2: u64 = 2_200_000_000;  // 2.2x (next 10)
pub const COUNT_MULT_TIER_3: u64 = 1_900_000_000;  // 1.9x (next 10)
pub const COUNT_MULT_TIER_4: u64 = 1_600_000_000;  // 1.6x (next 10)
pub const COUNT_MULT_TIER_5: u64 = 1_300_000_000;  // 1.3x (41+)

/// RESERVE-BASED DECAY TIERS (safety valve)
pub const RESERVE_TIER_1: u64 = 100_000_000_000_000;  // 100k tokens
pub const RESERVE_TIER_2: u64 = 250_000_000_000_000;  // 250k tokens
pub const RESERVE_TIER_3: u64 = 500_000_000_000_000;  // 500k tokens

/// Multiplier decay per tier (basis points)
pub const TIER_1_DECAY: u64 = 10000; // 100% (no decay)
pub const TIER_2_DECAY: u64 = 8800;  // 88% (12% decay)
pub const TIER_3_DECAY: u64 = 7600;  // 76% (24% decay)
pub const TIER_4_DECAY: u64 = 6400;  // 64% (36% decay)

/// RISK MANAGEMENT CAPS
/// Max bet amount (10,000 tokens with 9 decimals)
pub const MAX_BET_AMOUNT: u64 = 10_000_000_000_000;

/// Max payout per bet (100,000 tokens with 9 decimals)
pub const MAX_PAYOUT_PER_BET: u64 = 100_000_000_000_000;

/// Max round payouts (500,000 tokens with 9 decimals)
pub const MAX_ROUND_PAYOUTS: u64 = 500_000_000_000_000;

/// Number of matches per round
pub const MATCHES_PER_ROUND: usize = 10;

/// Odds compression constants (compress raw odds to 1.25x - 1.95x range)
pub const MIN_COMPRESSED_ODDS: u64 = 1_250_000_000;  // 1.25x
pub const MAX_COMPRESSED_ODDS: u64 = 1_950_000_000;  // 1.95x
pub const RAW_ODDS_MIN: u64 = 1_800_000_000;         // 1.8x raw
pub const RAW_ODDS_MAX: u64 = 5_500_000_000;         // 5.5x raw

/// TEAM TOKEN HOLDER BENEFITS
/// Reduced protocol fee for team token holders (2% instead of 5%)
pub const TEAM_TOKEN_FEE_BPS: u16 = 200;  // 2%

/// Odds boost for team token holders (5% better multiplier)
pub const TEAM_TOKEN_ODDS_BOOST_BPS: u64 = 500;  // 5%

/// Minimum team token balance required for benefits (1 token with 9 decimals)
pub const MIN_TEAM_TOKEN_BALANCE: u64 = 1_000_000_000;
