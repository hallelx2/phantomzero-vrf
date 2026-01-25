use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::{BettingPool, RoundAccounting, LiquidityPool};
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

    #[account(
        mut,
        seeds = [b"liquidity_pool", betting_pool.key().as_ref()],
        bump = liquidity_pool.bump,
    )]
    pub liquidity_pool: Account<'info, LiquidityPool>,

    /// Betting pool's token account
    #[account(mut)]
    pub betting_pool_token_account: Account<'info, TokenAccount>,

    /// LP pool's token account (receives profit share)
    #[account(mut)]
    pub lp_token_account: Account<'info, TokenAccount>,

    #[account(mut, constraint = authority.key() == betting_pool.authority)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<FinalizeRoundRevenue>, round_id: u64) -> Result<()> {
    // Extract account infos and keys BEFORE mutable borrows
    let betting_pool_info = ctx.accounts.betting_pool.to_account_info();
    let betting_pool_bump = ctx.accounts.betting_pool.bump;
    let season_pool_share_bps = ctx.accounts.betting_pool.season_pool_share_bps;

    // Check actual balance in betting pool contract
    let remaining_in_contract = ctx.accounts.betting_pool_token_account.amount;

    let mut profit_to_lp = 0u64;
    let mut loss_from_lp = 0u64;
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

        // LP gets everything else
        profit_to_lp = remaining_in_contract.saturating_sub(season_share);

        // Transfer LP's share back to LP pool
        if profit_to_lp > 0 {
            let seeds = &[b"betting_pool".as_ref(), &[betting_pool_bump]];
            let signer = &[&seeds[..]];

            let cpi_accounts = Transfer {
                from: ctx.accounts.betting_pool_token_account.to_account_info(),
                to: ctx.accounts.lp_token_account.to_account_info(),
                authority: betting_pool_info,
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
            token::transfer(cpi_ctx, profit_to_lp)?;

            // Update LP liquidity tracking
            ctx.accounts.liquidity_pool.total_liquidity += profit_to_lp;
            ctx.accounts.liquidity_pool.total_profit += profit_to_lp;
            ctx.accounts.liquidity_pool.available_liquidity = ctx.accounts.liquidity_pool
                .total_liquidity
                .saturating_sub(ctx.accounts.liquidity_pool.locked_reserve);
        }

        // Allocate season pool share (stays in betting pool for season rewards)
        if season_share > 0 {
            ctx.accounts.betting_pool.season_reward_pool += season_share;
        }
    }

    // Track if LP took a loss (paid out more than collected)
    let total_in_contract = ctx.accounts.round_accounting
        .total_bet_volume
        .saturating_add(ctx.accounts.round_accounting.protocol_seed_amount);
    let total_paid = ctx.accounts.round_accounting.total_paid_out;

    if total_paid > total_in_contract {
        loss_from_lp = total_paid - total_in_contract;
        ctx.accounts.liquidity_pool.total_loss += loss_from_lp;
    }

    ctx.accounts.round_accounting.lp_revenue_share = profit_to_lp;
    ctx.accounts.round_accounting.season_revenue_share = season_share;
    ctx.accounts.round_accounting.revenue_distributed = true;

    msg!("Round {} revenue finalized", round_id);
    msg!("Total in contract: {}", total_in_contract);
    msg!("Total paid: {}", total_paid);
    msg!("Profit to LP: {}", profit_to_lp);
    msg!("Loss from LP: {}", loss_from_lp);
    msg!("Season share: {}", season_share);

    Ok(())
}
