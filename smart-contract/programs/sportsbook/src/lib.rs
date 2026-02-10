use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

pub mod state;
pub mod instructions;
pub mod errors;
pub mod constants;
pub mod utils;
pub mod vrf;

use instructions::*;
use state::*;

declare_id!("Spo7t11111111111111111111111111111111111111");

#[program]
pub mod sportsbook {
    use super::*;

    /// Initialize the global betting pool configuration
    pub fn initialize(
        ctx: Context<Initialize>,
        protocol_fee_bps: u16,
        winner_share_bps: u16,
        season_pool_share_bps: u16,
    ) -> Result<()> {
        instructions::initialize::handler(ctx, protocol_fee_bps, winner_share_bps, season_pool_share_bps)
    }

    /// Initialize a new round with seeded match pools
    pub fn initialize_round(
        ctx: Context<InitializeRound>,
        round_id: u64,
    ) -> Result<()> {
        instructions::initialize_round::handler(ctx, round_id)
    }

    /// Seed match pools with differentiated amounts based on team matchup
    pub fn seed_round_pools(
        ctx: Context<SeedRoundPools>,
        round_id: u64,
    ) -> Result<()> {
        instructions::seed_round::handler(ctx, round_id)
    }

    /// Place a bet on multiple match outcomes (parlay betting)
    pub fn place_bet(
        ctx: Context<PlaceBet>,
        round_id: u64,
        match_indices: Vec<u8>,
        outcomes: Vec<u8>,
        amount: u64,
    ) -> Result<()> {
        instructions::place_bet::handler(ctx, round_id, match_indices, outcomes, amount)
    }

    /// Settle round after VRF generates results
    pub fn settle_round(
        ctx: Context<SettleRound>,
        round_id: u64,
        match_results: Vec<u8>,
    ) -> Result<()> {
        instructions::settle_round::handler(ctx, round_id, match_results)
    }

    /// Claim winnings for a bet (pull pattern)
    pub fn claim_winnings(
        ctx: Context<ClaimWinnings>,
        bet_id: u64,
        min_payout: u64,
    ) -> Result<()> {
        instructions::claim_winnings::handler(ctx, bet_id, min_payout)
    }

    /// Finalize round revenue distribution
    pub fn finalize_round_revenue(
        ctx: Context<FinalizeRoundRevenue>,
        round_id: u64,
    ) -> Result<()> {
        instructions::finalize_revenue::handler(ctx, round_id)
    }

    /// Request VRF randomness for a round
    pub fn request_vrf_randomness(
        ctx: Context<RequestVrfRandomness>,
        round_id: u64,
    ) -> Result<()> {
        instructions::vrf_request::handler(ctx, round_id)
    }

    /// Fulfill VRF request and extract match results
    pub fn fulfill_vrf_request(
        ctx: Context<FulfillVrfRequest>,
        round_id: u64,
    ) -> Result<()> {
        instructions::vrf_fulfill::handler(ctx, round_id)
    }
}
