use anchor_lang::prelude::*;

/// User's season prediction
/// One per user per season
#[account]
pub struct SeasonPrediction {
    /// User's public key
    pub user: Pubkey,

    /// Season ID this prediction is for
    pub season_id: u64,

    /// Predicted winning team index (0-9)
    pub predicted_team: u8,

    /// NFT mint address for this prediction
    /// Minted when prediction is made as proof of participation
    pub nft_mint: Pubkey,

    /// Has user claimed season rewards?
    pub claimed_reward: bool,

    /// Timestamp of prediction
    pub predicted_at: i64,

    /// Bump seed for PDA
    pub bump: u8,
}

impl SeasonPrediction {
    pub const LEN: usize = 8 + // discriminator
        32 + // user
        8 +  // season_id
        1 +  // predicted_team
        32 + // nft_mint
        1 +  // claimed_reward
        8 +  // predicted_at
        1;   // bump
}
