use anchor_lang::prelude::*;
use crate::state::BettingPool;
use crate::errors::SportsbookError;

#[derive(Accounts)]
pub struct EndSeason<'info> {
    #[account(mut)]
    pub betting_pool: Account<'info, BettingPool>,

    #[account(mut, constraint = authority.key() == betting_pool.authority @ SportsbookError::InvalidAuthority)]
    pub authority: Signer<'info>,
}

pub fn handler(
    ctx: Context<EndSeason>,
    winning_team: u8,
) -> Result<()> {
    // Validate winning team index
    require!(
        winning_team < 10,
        SportsbookError::InvalidMatchIndex
    );

    // Ensure season hasn't already ended
    require!(
        !ctx.accounts.betting_pool.season_ended,
        SportsbookError::RoundAlreadySettled // Reusing error
    );

    // Set season as ended
    ctx.accounts.betting_pool.season_ended = true;
    ctx.accounts.betting_pool.season_winning_team = winning_team;

    msg!("Season {} ended!", ctx.accounts.betting_pool.current_season_id);
    msg!("Winning team: {}", winning_team);
    msg!("Season reward pool: {}", ctx.accounts.betting_pool.season_reward_pool);

    Ok(())
}

#[derive(Accounts)]
pub struct StartNewSeason<'info> {
    #[account(mut)]
    pub betting_pool: Account<'info, BettingPool>,

    #[account(mut, constraint = authority.key() == betting_pool.authority @ SportsbookError::InvalidAuthority)]
    pub authority: Signer<'info>,
}

pub fn start_new_season_handler(
    ctx: Context<StartNewSeason>,
) -> Result<()> {
    // Ensure previous season has ended
    require!(
        ctx.accounts.betting_pool.season_ended,
        SportsbookError::RoundNotSettled
    );

    // Increment season ID and reset state
    ctx.accounts.betting_pool.current_season_id += 1;
    ctx.accounts.betting_pool.season_ended = false;
    ctx.accounts.betting_pool.season_winning_team = 0;
    // Note: season_reward_pool carries over to new season

    msg!("New season started: {}", ctx.accounts.betting_pool.current_season_id);

    Ok(())
}
