use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::{BettingPool, RoundAccounting, Bet, Prediction};
use crate::errors::SportsbookError;
use crate::constants::*;
use crate::utils::{calculate_parlay_multiplier_dynamic, calculate_odds_weighted_allocations, calculate_max_payout};

#[derive(Accounts)]
#[instruction(round_id: u64)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub betting_pool: Box<Account<'info, BettingPool>>,

    #[account(
        mut,
        seeds = [b"round", betting_pool.key().as_ref(), round_id.to_le_bytes().as_ref()],
        bump = round_accounting.bump,
        constraint = round_accounting.seeded @ SportsbookError::RoundNotSeeded,
        constraint = !round_accounting.settled @ SportsbookError::RoundAlreadySettled,
    )]
    pub round_accounting: Box<Account<'info, RoundAccounting>>,

    #[account(
        init,
        payer = bettor,
        space = Bet::LEN,
        seeds = [
            b"bet",
            betting_pool.key().as_ref(),
            betting_pool.next_bet_id.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub bet: Box<Account<'info, Bet>>,

    /// Bettor's token account
    #[account(mut)]
    pub bettor_token_account: Box<Account<'info, TokenAccount>>,

    /// Betting pool's token account (receives bet funds)
    #[account(mut)]
    pub betting_pool_token_account: Box<Account<'info, TokenAccount>>,

    /// Protocol treasury token account (receives fees)
    #[account(mut)]
    pub protocol_treasury_token_account: Box<Account<'info, TokenAccount>>,

    /// Optional: User's team token account (for fee discount + odds boost)
    /// If provided and has balance, user gets benefits
    pub team_token_account: Option<Box<Account<'info, TokenAccount>>>,

    #[account(mut)]
    pub bettor: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<PlaceBet>,
    round_id: u64,
    match_indices: Vec<u8>,
    outcomes: Vec<u8>,
    amount: u64,
) -> Result<()> {
    // Validate inputs
    require!(amount > 0, SportsbookError::InvalidAmount);
    require!(amount <= MAX_BET_AMOUNT, SportsbookError::BetExceedsMaximum);
    require!(
        match_indices.len() == outcomes.len(),
        SportsbookError::ArrayLengthMismatch
    );
    require!(
        match_indices.len() > 0 && match_indices.len() <= MATCHES_PER_ROUND,
        SportsbookError::InvalidBetCount
    );

    // Validate match indices and outcomes
    for i in 0..match_indices.len() {
        require!(
            (match_indices[i] as usize) < MATCHES_PER_ROUND,
            SportsbookError::InvalidMatchIndex
        );
        require!(
            outcomes[i] >= 1 && outcomes[i] <= 3,
            SportsbookError::InvalidOutcome
        );
    }

    // Extract all account infos, keys, and bumps BEFORE any mutable borrows
    let betting_pool_info = ctx.accounts.betting_pool.to_account_info();
    let betting_pool_bump = ctx.accounts.betting_pool.bump;
    let betting_pool_fee_bps = ctx.accounts.betting_pool.protocol_fee_bps;

    // Check if user holds team tokens for benefits
    let has_team_tokens = if let Some(ref team_token_account) = ctx.accounts.team_token_account {
        team_token_account.amount >= MIN_TEAM_TOKEN_BALANCE
    } else {
        false
    };

    // Transfer user's stake
    let cpi_accounts = Transfer {
        from: ctx.accounts.bettor_token_account.to_account_info(),
        to: ctx.accounts.betting_pool_token_account.to_account_info(),
        authority: ctx.accounts.bettor.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    // Deduct protocol fee (reduced for team token holders)
    let fee_bps = if has_team_tokens {
        TEAM_TOKEN_FEE_BPS
    } else {
        betting_pool_fee_bps
    };

    let protocol_fee = (amount as u128)
        .checked_mul(fee_bps as u128)
        .ok_or(SportsbookError::CalculationOverflow)?
        .checked_div(BPS_DENOMINATOR as u128)
        .ok_or(SportsbookError::CalculationOverflow)? as u64;

    let amount_after_fee = amount.saturating_sub(protocol_fee);

    // Transfer fee to treasury
    let seeds = &[
        b"betting_pool".as_ref(),
        &[betting_pool_bump],
    ];
    let signer = &[&seeds[..]];

    let cpi_accounts = Transfer {
        from: ctx.accounts.betting_pool_token_account.to_account_info(),
        to: ctx.accounts.protocol_treasury_token_account.to_account_info(),
        authority: betting_pool_info.clone(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    token::transfer(cpi_ctx, protocol_fee)?;

    ctx.accounts.round_accounting.protocol_fee_collected += protocol_fee;
    ctx.accounts.round_accounting.total_bet_volume += amount_after_fee;
    ctx.accounts.round_accounting.total_user_deposits += amount_after_fee;

    // Determine if this is a parlay
    let is_parlay = match_indices.len() > 1;

    // Calculate dynamic parlay multiplier
    let mut parlay_multiplier = calculate_parlay_multiplier_dynamic(
        &ctx.accounts.round_accounting,
        &match_indices,
        match_indices.len() as u8,
    );

    // Apply odds boost for team token holders (5% better multiplier)
    if has_team_tokens {
        let boost = (parlay_multiplier as u128)
            .checked_mul(TEAM_TOKEN_ODDS_BOOST_BPS as u128)
            .ok_or(SportsbookError::CalculationOverflow)?
            .checked_div(BPS_DENOMINATOR as u128)
            .ok_or(SportsbookError::CalculationOverflow)? as u64;

        parlay_multiplier = parlay_multiplier.saturating_add(boost);

        msg!("Team token holder: odds boost applied (+{})", boost);
    }

    // CRITICAL: Check protocol has enough capital to cover potential payout
    // This prevents insolvency if multiple large parlays win
    let max_possible_payout = calculate_max_payout(
        amount_after_fee,
        match_indices.len() as u8,
        parlay_multiplier,
    );

    let current_balance = ctx.accounts.betting_pool_token_account.amount;
    require!(
        current_balance >= max_possible_payout,
        SportsbookError::InsufficientProtocolLiquidity
    );

    // Increment parlay count (FOMO mechanism)
    if is_parlay {
        ctx.accounts.round_accounting.parlay_count += 1;
    }

    // Calculate odds-weighted allocations
    // Note: Protocol provides all liquidity, no borrowing needed
    let (allocations, total_allocated, _lp_borrowed) = calculate_odds_weighted_allocations(
        &ctx.accounts.round_accounting,
        &match_indices,
        &outcomes,
        amount_after_fee,
        parlay_multiplier,
    )
    .map_err(|_| SportsbookError::CalculationOverflow)?;

    // Get bet ID and increment
    let bet_id = ctx.accounts.betting_pool.next_bet_id;
    ctx.accounts.betting_pool.next_bet_id += 1;

    // Store bet
    ctx.accounts.bet.bettor = ctx.accounts.bettor.key();
    ctx.accounts.bet.round_id = round_id;
    ctx.accounts.bet.bet_id = bet_id;
    ctx.accounts.bet.amount = amount;
    ctx.accounts.bet.amount_after_fee = amount_after_fee;
    ctx.accounts.bet.allocated_amount = total_allocated;
    ctx.accounts.bet.bonus = 0; // No bonus
    ctx.accounts.bet.locked_multiplier = parlay_multiplier;
    ctx.accounts.bet.num_predictions = match_indices.len() as u8;
    ctx.accounts.bet.settled = false;
    ctx.accounts.bet.claimed = false;
    ctx.accounts.bet.claim_deadline = 0; // Will be set when round is settled
    ctx.accounts.bet.bounty_claimer = None;
    ctx.accounts.bet.bump = ctx.bumps.bet;

    // Add predictions and update pools
    let mut predictions = [Prediction {
        match_index: 0,
        predicted_outcome: 0,
        amount_in_pool: 0,
    }; 10];

    for i in 0..match_indices.len() {
        let match_index = match_indices[i];
        let outcome = outcomes[i];
        let allocation = allocations[i];

        predictions[i] = Prediction {
            match_index,
            predicted_outcome: outcome,
            amount_in_pool: allocation,
        };

        // Add to appropriate match pool (with overflow protection)
        let pool = &mut ctx.accounts.round_accounting.match_pools[match_index as usize];
        pool.add_to_pool(outcome, allocation)?;
    }

    ctx.accounts.bet.predictions = predictions;

    msg!("Bet {} placed successfully", bet_id);
    msg!("Amount: {}, After fee: {}", amount, amount_after_fee);
    msg!("Parlay multiplier: {}", parlay_multiplier);
    msg!("Allocated: {}", total_allocated);

    Ok(())
}
