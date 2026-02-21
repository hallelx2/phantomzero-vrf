use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, MintTo};
use crate::state::{BettingPool, SeasonPrediction};
use crate::errors::SportsbookError;

#[derive(Accounts)]
#[instruction(predicted_team: u8)]
pub struct MakeSeasonPrediction<'info> {
    #[account(mut)]
    pub betting_pool: Box<Account<'info, BettingPool>>,

    #[account(
        init,
        payer = user,
        space = SeasonPrediction::LEN,
        seeds = [
            b"season_prediction",
            betting_pool.key().as_ref(),
            betting_pool.current_season_id.to_le_bytes().as_ref(),
            user.key().as_ref()
        ],
        bump
    )]
    pub season_prediction: Box<Account<'info, SeasonPrediction>>,

    /// NFT mint for this prediction (PDA)
    #[account(
        init,
        payer = user,
        mint::decimals = 0,
        mint::authority = betting_pool,
        seeds = [
            b"prediction_nft",
            betting_pool.key().as_ref(),
            betting_pool.current_season_id.to_le_bytes().as_ref(),
            user.key().as_ref()
        ],
        bump
    )]
    pub nft_mint: Box<Account<'info, Mint>>,

    /// User's token account to receive the NFT
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = nft_mint,
        associated_token::authority = user
    )]
    pub user_nft_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, anchor_spl::associated_token::AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<MakeSeasonPrediction>,
    predicted_team: u8,
) -> Result<()> {
    // Validate team index
    require!(
        predicted_team < 10,
        SportsbookError::InvalidMatchIndex
    );

    // Ensure season hasn't ended
    require!(
        !ctx.accounts.betting_pool.season_ended,
        SportsbookError::RoundAlreadySettled // Reusing error
    );

    let clock = Clock::get()?;

    // Initialize season prediction
    ctx.accounts.season_prediction.user = ctx.accounts.user.key();
    ctx.accounts.season_prediction.season_id = ctx.accounts.betting_pool.current_season_id;
    ctx.accounts.season_prediction.predicted_team = predicted_team;
    ctx.accounts.season_prediction.nft_mint = ctx.accounts.nft_mint.key();
    ctx.accounts.season_prediction.claimed_reward = false;
    ctx.accounts.season_prediction.predicted_at = clock.unix_timestamp;
    ctx.accounts.season_prediction.bump = ctx.bumps.season_prediction;

    // Mint NFT to user (1 token, non-fungible)
    let seeds = &[
        b"betting_pool".as_ref(),
        &[ctx.accounts.betting_pool.bump],
    ];
    let signer = &[&seeds[..]];

    let cpi_accounts = MintTo {
        mint: ctx.accounts.nft_mint.to_account_info(),
        to: ctx.accounts.user_nft_account.to_account_info(),
        authority: ctx.accounts.betting_pool.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    token::mint_to(cpi_ctx, 1)?;

    msg!("Season prediction made!");
    msg!("User: {}", ctx.accounts.user.key());
    msg!("Season: {}", ctx.accounts.betting_pool.current_season_id);
    msg!("Predicted team: {}", predicted_team);
    msg!("NFT minted: {}", ctx.accounts.nft_mint.key());

    Ok(())
}

#[derive(Accounts)]
pub struct ClaimSeasonReward<'info> {
    #[account(mut)]
    pub betting_pool: Box<Account<'info, BettingPool>>,

    #[account(
        mut,
        seeds = [
            b"season_prediction",
            betting_pool.key().as_ref(),
            season_prediction.season_id.to_le_bytes().as_ref(),
            user.key().as_ref()
        ],
        bump = season_prediction.bump,
        constraint = season_prediction.user == user.key() @ SportsbookError::NotBettor,
        constraint = !season_prediction.claimed_reward @ SportsbookError::BetAlreadyClaimed,
    )]
    pub season_prediction: Box<Account<'info, SeasonPrediction>>,

    /// Betting pool's token account
    #[account(mut)]
    pub betting_pool_token_account: Box<Account<'info, TokenAccount>>,

    /// User's token account (receives season rewards)
    #[account(mut)]
    pub user_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn claim_season_reward_handler(
    ctx: Context<ClaimSeasonReward>,
    total_predictors: u64, // Total number of users who predicted correctly
) -> Result<()> {
    // Ensure season has ended
    require!(
        ctx.accounts.betting_pool.season_ended,
        SportsbookError::RoundNotSettled
    );

    // Check if user predicted correctly
    require!(
        ctx.accounts.season_prediction.predicted_team == ctx.accounts.betting_pool.season_winning_team,
        SportsbookError::NotBettor // Reusing error - means "not a winner"
    );

    // Calculate user's share of season pool
    let season_pool = ctx.accounts.betting_pool.season_reward_pool;
    require!(
        season_pool > 0,
        SportsbookError::InvalidAmount
    );

    // Each correct predictor gets equal share
    let user_share = season_pool / total_predictors;

    // Mark as claimed
    ctx.accounts.season_prediction.claimed_reward = true;

    // Transfer tokens
    let seeds = &[
        b"betting_pool".as_ref(),
        &[ctx.accounts.betting_pool.bump],
    ];
    let signer = &[&seeds[..]];

    let cpi_accounts = anchor_spl::token::Transfer {
        from: ctx.accounts.betting_pool_token_account.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.betting_pool.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    token::transfer(cpi_ctx, user_share)?;

    // Update pool
    ctx.accounts.betting_pool.season_reward_pool -= user_share;

    msg!("Season reward claimed!");
    msg!("User: {}", ctx.accounts.user.key());
    msg!("Share: {}", user_share);

    Ok(())
}
