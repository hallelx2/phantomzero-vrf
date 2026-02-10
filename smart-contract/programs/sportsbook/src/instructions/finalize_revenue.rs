use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::{BettingPool, RoundAccounting};
use crate::errors::SportsbookError;
use crate::constants::*;

#[derive(Accounts)]
#[instruction(round_id: u64)]
pub struct FinalizeRoundRevenue<'info> {
    #[account(mut)]
    pub betting_pool: Account<'info, BettingPool>,

    #[account(
        mut,
        seeds = [b"round", betting_pool.key().as_ref(), round_id.to_le_bytes().as_ref()],
        bump = round_accounting.bump,
        constraint = round_accounting.settled @ SportsbookError::RoundNotSettled,
        constraint = !round_accounting.revenue_distributed @ SportsbookError::RevenueAlreadyDistributed,
    )]
    pub round_accounting: Account<'info, RoundAccounting>,

    /// Betting pool's token account (protocol holds all funds)
    #[account(mut)]
    pub betting_pool_token_account: Account<'info, TokenAccount>,

    #[account(mut, constraint = authority.key() == betting_pool.authority)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<FinalizeRoundRevenue>, round_id: u64) -> Result<()> {
    // Ensure all reserved winnings have been claimed before distributing revenue
    // This prevents distributing profit while winners haven't been paid yet
    require!(
        ctx.accounts.round_accounting.total_claimed >= ctx.accounts.round_accounting.total_reserved_for_winners,
        SportsbookError::RevenueDistributedBeforeClaims
    );

    // Extract season pool share
    let season_pool_share_bps = ctx.accounts.betting_pool.season_pool_share_bps;

    // Check actual balance remaining in betting pool
    let remaining_in_contract = ctx.accounts.betting_pool_token_account.amount;

    let mut protocol_profit = 0u64;
    let mut season_share = 0u64;

    if remaining_in_contract > 0 {
        // Season pool gets exactly 2% of ACTUAL USER DEPOSITS
        let total_user_bets_before_fee = ctx.accounts.round_accounting
            .total_user_deposits
            .saturating_add(ctx.accounts.round_accounting.protocol_fee_collected);

        season_share = (total_user_bets_before_fee as u128)
            .checked_mul(season_pool_share_bps as u128)
            .ok_or(SportsbookError::CalculationOverflow)?
            .checked_div(BPS_DENOMINATOR as u128)
            .ok_or(SportsbookError::CalculationOverflow)? as u64;

        // Cap season share to what's actually available
        if season_share > remaining_in_contract {
            season_share = remaining_in_contract;
        }

        // Protocol keeps everything else (all profits stay in protocol)
        protocol_profit = remaining_in_contract.saturating_sub(season_share);

        // Allocate season pool share (stays in betting pool for season rewards)
        if season_share > 0 {
            ctx.accounts.betting_pool.season_reward_pool += season_share;
        }
    }

    // Calculate protocol profit/loss
    let total_in_contract = ctx.accounts.round_accounting
        .total_bet_volume
        .saturating_add(ctx.accounts.round_accounting.protocol_seed_amount);
    let total_paid = ctx.accounts.round_accounting.total_paid_out;

    ctx.accounts.round_accounting.protocol_revenue_share = protocol_profit;
    ctx.accounts.round_accounting.season_revenue_share = season_share;
    ctx.accounts.round_accounting.revenue_distributed = true;

    msg!("Round {} revenue finalized", round_id);
    msg!("Total in contract: {}", total_in_contract);
    msg!("Total paid: {}", total_paid);
    msg!("Protocol profit: {}", protocol_profit);
    msg!("Season share: {}", season_share);

    Ok(())
}
