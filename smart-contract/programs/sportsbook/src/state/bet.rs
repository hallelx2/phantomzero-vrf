use anchor_lang::prelude::*;

/// Individual prediction for a single match within a bet
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct Prediction {
    /// Match index (0-9)
    pub match_index: u8,

    /// Predicted outcome (1=HOME_WIN, 2=AWAY_WIN, 3=DRAW)
    pub predicted_outcome: u8,

    /// Amount allocated to this pool
    pub amount_in_pool: u64,
}

/// A bet placed by a user (parlay or single bet)
#[account]
pub struct Bet {
    /// Bettor's public key
    pub bettor: Pubkey,

    /// Round ID this bet is for
    pub round_id: u64,

    /// Bet ID (unique identifier)
    pub bet_id: u64,

    /// Original bet amount (shown in frontend)
    pub amount: u64,

    /// Amount after protocol fee
    pub amount_after_fee: u64,

    /// Total allocated to pools (protocol provides all liquidity)
    pub allocated_amount: u64,

    /// Protocol stake bonus (deprecated)
    pub bonus: u64,

    /// Locked parlay multiplier at bet placement (scaled by 1e9)
    pub locked_multiplier: u64,

    /// Number of predictions in this bet
    pub num_predictions: u8,

    /// Predictions (max 10 matches)
    pub predictions: [Prediction; 10],

    /// Has round been settled?
    pub settled: bool,

    /// Has user claimed winnings?
    pub claimed: bool,

    /// Deadline for claiming (settlement_time + 24 hours)
    /// After this, anyone can claim with 10% bounty
    pub claim_deadline: i64,

    /// If claimed via bounty, this is the claimer's address
    pub bounty_claimer: Option<Pubkey>,

    /// Bump seed for PDA
    pub bump: u8,
}

impl Bet {
    pub const LEN: usize = 8 + // discriminator
        32 + // bettor
        8 +  // round_id
        8 +  // bet_id
        8 +  // amount
        8 +  // amount_after_fee
        8 +  // allocated_amount
        8 +  // bonus
        8 +  // locked_multiplier
        1 +  // num_predictions
        (10 * 17) + // predictions (10 predictions * 17 bytes each)
        1 +  // settled
        1 +  // claimed
        8 +  // claim_deadline
        (1 + 32) + // bounty_claimer (Option<Pubkey>)
        1;   // bump

    pub fn get_predictions(&self) -> &[Prediction] {
        &self.predictions[0..self.num_predictions as usize]
    }
}
