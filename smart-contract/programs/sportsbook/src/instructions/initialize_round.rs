use anchor_lang::prelude::*;
use crate::state::{BettingPool, RoundAccounting};
use crate::errors::SportsbookError;

#[derive(Accounts)]
#[instruction(round_id: u64)]
pub struct InitializeRound<'info> {
    #[account(mut)]
    pub betting_pool: Account<'info, BettingPool>,

    #[account(
        init,
        payer = authority,
        space = RoundAccounting::LEN,
        seeds = [b"round", betting_pool.key().as_ref(), round_id.to_le_bytes().as_ref()],
        bump
    )]
    pub round_accounting: Account<'info, RoundAccounting>,

    #[account(mut, constraint = authority.key() == betting_pool.authority)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeRound>, round_id: u64) -> Result<()> {
    // Validate round_id is sequential
    require!(
        round_id == ctx.accounts.betting_pool.next_round_id,
        SportsbookError::InvalidRoundId
    );

    // Increment next_round_id for future rounds
    ctx.accounts.betting_pool.next_round_id += 1;

    let round_accounting = &mut ctx.accounts.round_accounting;

    // Initialize round
    round_accounting.round_id = round_id;
    round_accounting.betting_pool = ctx.accounts.betting_pool.key();
    round_accounting.match_pools = [Default::default(); 10];
    round_accounting.locked_odds = [Default::default(); 10];
    round_accounting.match_results = [Default::default(); 10];
    round_accounting.total_bet_volume = 0;
    round_accounting.total_winning_pool = 0;
    round_accounting.total_losing_pool = 0;
    round_accounting.total_reserved_for_winners = 0;
    round_accounting.total_claimed = 0;
    round_accounting.total_paid_out = 0;
    round_accounting.protocol_fee_collected = 0;
    round_accounting.protocol_revenue_share = 0;
    round_accounting.season_revenue_share = 0;
    round_accounting.revenue_distributed = false;
    round_accounting.protocol_seed_amount = 0;
    round_accounting.seeded = false;
    round_accounting.total_user_deposits = 0;
    round_accounting.parlay_count = 0;
    round_accounting.round_start_time = Clock::get()?.unix_timestamp;
    round_accounting.round_end_time = 0;
    round_accounting.settled = false;
    round_accounting.bump = ctx.bumps.round_accounting;

    msg!("Round {} initialized", round_id);

    Ok(())
}
