use anchor_lang::prelude::*;
use super::{MatchPool, LockedOdds, MatchOutcome};

/// Accounting data for a single betting round (10 matches)
#[account]
pub struct RoundAccounting {
    /// Round ID
    pub round_id: u64,

    /// Betting pool this round belongs to
    pub betting_pool: Pubkey,

    /// Match pools (10 matches per round)
    pub match_pools: [MatchPool; 10],

    /// Locked odds per match (fixed at seeding time)
    pub locked_odds: [LockedOdds; 10],

    /// Match results (outcomes)
    pub match_results: [MatchOutcome; 10],

    /// Total bet volume in this round (including bonuses)
    pub total_bet_volume: u64,

    /// Total winning pool amount
    pub total_winning_pool: u64,

    /// Total losing pool amount
    pub total_losing_pool: u64,

    /// Total reserved for winners
    pub total_reserved_for_winners: u64,

    /// Total claimed so far
    pub total_claimed: u64,

    /// Total paid out (including parlay bonuses)
    pub total_paid_out: u64,

    /// Protocol fee collected (5% of bets)
    pub protocol_fee_collected: u64,

    /// Protocol revenue share (all losses go to protocol)
    pub protocol_revenue_share: u64,

    /// Season pool revenue share
    pub season_revenue_share: u64,

    /// Has revenue been distributed?
    pub revenue_distributed: bool,

    /// Protocol seed amount
    pub protocol_seed_amount: u64,

    /// Has round been seeded?
    pub seeded: bool,

    /// Actual user deposits (for season pool calculation)
    pub total_user_deposits: u64,

    /// Number of parlays placed this round
    pub parlay_count: u64,

    /// Round start timestamp
    pub round_start_time: i64,

    /// Round end timestamp
    pub round_end_time: i64,

    /// Has round been settled?
    pub settled: bool,

    /// Bump seed for PDA
    pub bump: u8,
}

impl RoundAccounting {
    pub const LEN: usize = 8 + // discriminator
        8 +  // round_id
        32 + // betting_pool
        (10 * 32) + // match_pools (10 matches * 32 bytes each)
        (10 * 25) + // locked_odds (10 matches * 25 bytes each)
        (10 * 1) +  // match_results (10 outcomes)
        8 +  // total_bet_volume
        8 +  // total_winning_pool
        8 +  // total_losing_pool
        8 +  // total_reserved_for_winners
        8 +  // total_claimed
        8 +  // total_paid_out
        8 +  // protocol_fee_collected
        8 +  // protocol_revenue_share
        8 +  // season_revenue_share
        1 +  // revenue_distributed
        8 +  // protocol_seed_amount
        1 +  // seeded
        8 +  // total_user_deposits
        8 +  // parlay_count
        8 +  // round_start_time
        8 +  // round_end_time
        1 +  // settled
        1;   // bump
}
