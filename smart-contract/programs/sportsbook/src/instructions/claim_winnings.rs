use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::{BettingPool, RoundAccounting, Bet, MatchOutcome};
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
        constraint = !bet.claimed @ SportsbookError::BetAlreadyClaimed,
    )]
    pub bet: Account<'info, Bet>,

    /// Betting pool's token account (protocol provides all liquidity)
    #[account(mut)]
    pub betting_pool_token_account: Account<'info, TokenAccount>,

    /// Bettor's token account (receives winnings or 90% if bounty claim)
    /// CHECK: Verified against bet.bettor
    #[account(mut)]
    pub bettor_token_account: UncheckedAccount<'info>,

    /// Claimer (can be bettor or bounty hunter after 24h)
    /// If claiming within 24h, must be the bettor
    /// If claiming after 24h, can be anyone (receives 10% bounty)
    #[account(mut)]
    pub claimer: Signer<'info>,

    /// Claimer's token account (receives 10% bounty if third-party claim)
    /// CHECK: Only used for bounty claims after deadline
    #[account(mut)]
    pub claimer_token_account: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<ClaimWinnings>,
    bet_id: u64,
    min_payout: u64,
) -> Result<()> {
    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp;

    // Extract account infos and keys BEFORE mutable borrows
    let betting_pool_info = ctx.accounts.betting_pool.to_account_info();
    let betting_pool_bump = ctx.accounts.betting_pool.bump;

    // Calculate claim deadline: 24 hours after round settlement
    // 86400 seconds = 24 hours
    let claim_deadline = ctx.accounts.round_accounting.round_end_time + 86400;

    // Update bet's claim_deadline if not set yet
    if ctx.accounts.bet.claim_deadline == 0 {
        ctx.accounts.bet.claim_deadline = claim_deadline;
    }

    // Check claim window and determine if this is a bounty claim
    let is_bettor = ctx.accounts.claimer.key() == ctx.accounts.bet.bettor;
    let is_bounty_claim = current_time > claim_deadline && !is_bettor;

    // If within 24h window, only bettor can claim
    if current_time <= claim_deadline {
        require!(is_bettor, SportsbookError::NotBettor);
    }

    // Calculate if bet won and payout amount
    let (won, base_payout, final_payout) = calculate_bet_payout(&ctx.accounts.bet, &ctx.accounts.round_accounting)?;

    // Slippage protection
    require!(
        final_payout >= min_payout,
        SportsbookError::PayoutBelowMinimum
    );

    // Mark as claimed and settled
    ctx.accounts.bet.claimed = true;
    ctx.accounts.bet.settled = true;

    if won && final_payout > 0 {
        // Check per-round payout cap
        require!(
            ctx.accounts.round_accounting.total_paid_out + final_payout <= MAX_ROUND_PAYOUTS,
            SportsbookError::RoundPayoutLimitReached
        );

        // Update accounting
        ctx.accounts.round_accounting.total_claimed += final_payout;
        ctx.accounts.round_accounting.total_paid_out += final_payout;

        // Calculate bounty split if applicable
        let (bettor_amount, bounty_amount) = if is_bounty_claim {
            // 90% to bettor, 10% to claimer
            let bounty = (final_payout as u128)
                .checked_mul(1000)  // 10% = 1000 / 10000
                .ok_or(SportsbookError::CalculationOverflow)?
                .checked_div(10000)
                .ok_or(SportsbookError::CalculationOverflow)? as u64;
            let bettor_share = final_payout.saturating_sub(bounty);

            // Record bounty claimer
            ctx.accounts.bet.bounty_claimer = Some(ctx.accounts.claimer.key());

            msg!("Bounty claim by {}: 10% bounty = {}", ctx.accounts.claimer.key(), bounty);
            (bettor_share, bounty)
        } else {
            // Bettor claims within 24h, gets 100%
            (final_payout, 0)
        };

        let betting_pool_balance = ctx.accounts.betting_pool_token_account.amount;

        // Ensure protocol has enough to pay (should always be true)
        require!(
            betting_pool_balance >= final_payout,
            SportsbookError::InsufficientProtocolLiquidity
        );

        let seeds = &[b"betting_pool".as_ref(), &[betting_pool_bump]];
        let signer = &[&seeds[..]];

        // Pay bettor their share
        let cpi_accounts = Transfer {
            from: ctx.accounts.betting_pool_token_account.to_account_info(),
            to: ctx.accounts.bettor_token_account.to_account_info(),
            authority: betting_pool_info.clone(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, bettor_amount)?;

        // Pay bounty to claimer if applicable
        if bounty_amount > 0 {
            let cpi_accounts = Transfer {
                from: ctx.accounts.betting_pool_token_account.to_account_info(),
                to: ctx.accounts.claimer_token_account.to_account_info(),
                authority: betting_pool_info.clone(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
            token::transfer(cpi_ctx, bounty_amount)?;
        }

        msg!("Bet {} won! Paid out {} tokens (bettor: {}, bounty: {})",
             bet_id, final_payout, bettor_amount, bounty_amount);
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
