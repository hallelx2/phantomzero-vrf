use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::{BettingPool, RoundAccounting, Bet, LiquidityPool, MatchOutcome};
use crate::errors::SportsbookError;
use crate::constants::*;

#[derive(Accounts)]
#[instruction(bet_id: u64)]
pub struct ClaimWinnings<'info> {
    #[account(mut)]
    pub betting_pool: Account<'info, BettingPool>,

    #[account(
        mut,
        seeds = [b"round", betting_pool.key().as_ref(), bet.round_id.to_le_bytes().as_ref()],
        bump = round_accounting.bump,
        constraint = round_accounting.settled @ SportsbookError::RoundNotSettled,
    )]
    pub round_accounting: Account<'info, RoundAccounting>,

    #[account(
        mut,
        seeds = [b"bet", betting_pool.key().as_ref(), bet_id.to_le_bytes().as_ref()],
        bump = bet.bump,
        constraint = bet.bettor == bettor.key() @ SportsbookError::NotBettor,
        constraint = !bet.claimed @ SportsbookError::BetAlreadyClaimed,
    )]
    pub bet: Account<'info, Bet>,

    #[account(
        mut,
        seeds = [b"liquidity_pool", betting_pool.key().as_ref()],
        bump = liquidity_pool.bump,
    )]
    pub liquidity_pool: Account<'info, LiquidityPool>,

    /// Betting pool's token account
    #[account(mut)]
    pub betting_pool_token_account: Account<'info, TokenAccount>,

    /// LP pool's token account (for shortfall payments)
    #[account(mut)]
    pub lp_token_account: Account<'info, TokenAccount>,

    /// Bettor's token account (receives winnings)
    #[account(mut)]
    pub bettor_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub bettor: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(
    ctx: Context<ClaimWinnings>,
    bet_id: u64,
    min_payout: u64,
) -> Result<()> {
    // Extract account infos and keys BEFORE mutable borrows
    let betting_pool_info = ctx.accounts.betting_pool.to_account_info();
    let betting_pool_key = ctx.accounts.betting_pool.key();
    let betting_pool_bump = ctx.accounts.betting_pool.bump;

    let liquidity_pool_info = ctx.accounts.liquidity_pool.to_account_info();
    let liquidity_pool_bump = ctx.accounts.liquidity_pool.bump;

    // Calculate if bet won and payout amount
    let (won, base_payout, final_payout) = calculate_bet_payout(&ctx.accounts.bet, &ctx.accounts.round_accounting)?;

    // Slippage protection
    require!(
        final_payout >= min_payout,
        SportsbookError::PayoutBelowMinimum
    );

    ctx.accounts.bet.claimed = true;
    ctx.accounts.bet.settled = true;

    if won && final_payout > 0 {
        // Check per-round payout cap
        require!(
            ctx.accounts.round_accounting.total_paid_out + final_payout <= MAX_ROUND_PAYOUTS,
            SportsbookError::RoundPayoutLimitReached
        );

        ctx.accounts.round_accounting.total_claimed += final_payout;
        ctx.accounts.round_accounting.total_paid_out += final_payout;

        // Pay from betting pool's balance first, pull from LP if insufficient
        let betting_pool_balance = ctx.accounts.betting_pool_token_account.amount;

        if betting_pool_balance >= final_payout {
            // Betting pool has enough, pay directly
            let seeds = &[b"betting_pool".as_ref(), &[betting_pool_bump]];
            let signer = &[&seeds[..]];

            let cpi_accounts = Transfer {
                from: ctx.accounts.betting_pool_token_account.to_account_info(),
                to: ctx.accounts.bettor_token_account.to_account_info(),
                authority: betting_pool_info.clone(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
            token::transfer(cpi_ctx, final_payout)?;
        } else {
            // Need to pull from LP
            let shortfall = final_payout - betting_pool_balance;

            // Pay what betting pool has
            if betting_pool_balance > 0 {
                let seeds = &[b"betting_pool".as_ref(), &[betting_pool_bump]];
                let signer = &[&seeds[..]];

                let cpi_accounts = Transfer {
                    from: ctx.accounts.betting_pool_token_account.to_account_info(),
                    to: ctx.accounts.bettor_token_account.to_account_info(),
                    authority: betting_pool_info.clone(),
                };
                let cpi_program = ctx.accounts.token_program.to_account_info();
                let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
                token::transfer(cpi_ctx, betting_pool_balance)?;
            }

            // Pull shortfall from LP
            let seeds = &[b"liquidity_pool", betting_pool_key.as_ref(), &[liquidity_pool_bump]];
            let signer = &[&seeds[..]];

            let cpi_accounts = Transfer {
                from: ctx.accounts.lp_token_account.to_account_info(),
                to: ctx.accounts.bettor_token_account.to_account_info(),
                authority: liquidity_pool_info,
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
            token::transfer(cpi_ctx, shortfall)?;

            // Update LP liquidity
            ctx.accounts.liquidity_pool.total_liquidity -= shortfall;
            ctx.accounts.liquidity_pool.available_liquidity = ctx.accounts.liquidity_pool
                .total_liquidity
                .saturating_sub(ctx.accounts.liquidity_pool.locked_reserve);
        }

        msg!("Bet {} won! Paid out {} tokens", bet_id, final_payout);
        msg!("Base payout: {}, Parlay multiplier: {}", base_payout, ctx.accounts.bet.locked_multiplier);
    } else {
        msg!("Bet {} lost", bet_id);
    }

    Ok(())
}

/// Calculate bet payout with parlay multiplier
fn calculate_bet_payout(
    bet: &Bet,
    round_accounting: &RoundAccounting,
) -> Result<(bool, u64, u64)> {
    let mut all_correct = true;
    let mut total_base_payout = 0u64;

    let predictions = bet.get_predictions();

    for prediction in predictions {
        let match_result = &round_accounting.match_results[prediction.match_index as usize];
        let locked_odds = &round_accounting.locked_odds[prediction.match_index as usize];

        // Check if prediction is correct
        let predicted_outcome = match prediction.predicted_outcome {
            1 => MatchOutcome::HomeWin,
            2 => MatchOutcome::AwayWin,
            3 => MatchOutcome::Draw,
            _ => MatchOutcome::Pending,
        };

        if *match_result != predicted_outcome {
            all_correct = false;
            break;
        }

        // Use locked odds for payout calculation
        require!(locked_odds.locked, SportsbookError::OddsNotLocked);

        let odds = locked_odds.get_odds(prediction.predicted_outcome);

        // Simple multiplication: amount × locked odds
        let match_payout = (prediction.amount_in_pool as u128)
            .checked_mul(odds as u128)
            .ok_or(SportsbookError::CalculationOverflow)?
            .checked_div(ODDS_SCALE as u128)
            .ok_or(SportsbookError::CalculationOverflow)? as u64;

        total_base_payout += match_payout;
    }

    if !all_correct {
        return Ok((false, 0, 0));
    }

    // Apply locked parlay multiplier
    let total_final_payout = (total_base_payout as u128)
        .checked_mul(bet.locked_multiplier as u128)
        .ok_or(SportsbookError::CalculationOverflow)?
        .checked_div(ODDS_SCALE as u128)
        .ok_or(SportsbookError::CalculationOverflow)? as u64;

    // Cap maximum payout per bet
    let capped_payout = if total_final_payout > MAX_PAYOUT_PER_BET {
        MAX_PAYOUT_PER_BET
    } else {
        total_final_payout
    };

    Ok((true, total_base_payout, capped_payout))
}
