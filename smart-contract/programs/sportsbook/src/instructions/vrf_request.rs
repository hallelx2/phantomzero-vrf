use anchor_lang::prelude::*;
use crate::state::{BettingPool, RoundAccounting};
use crate::vrf::VrfRequest;
use crate::errors::SportsbookError;

/// Request VRF randomness for a round
///
/// This creates a VRF request account and initiates the randomness request
/// to the Switchboard oracle network.
#[derive(Accounts)]
#[instruction(round_id: u64)]
pub struct RequestVrfRandomness<'info> {
    #[account(mut)]
    pub betting_pool: Account<'info, BettingPool>,

    #[account(
        mut,
        seeds = [b"round", betting_pool.key().as_ref(), round_id.to_le_bytes().as_ref()],
        bump = round_accounting.bump,
        constraint = round_accounting.seeded @ SportsbookError::RoundNotSeeded,
        constraint = !round_accounting.settled @ SportsbookError::RoundAlreadySettled,
    )]
    pub round_accounting: Account<'info, RoundAccounting>,

    #[account(
        init,
        payer = authority,
        space = VrfRequest::LEN,
        seeds = [b"vrf_request", betting_pool.key().as_ref(), round_id.to_le_bytes().as_ref()],
        bump
    )]
    pub vrf_request: Account<'info, VrfRequest>,

    /// Switchboard VRF account
    /// CHECK: This is validated by the Switchboard program
    #[account(mut)]
    pub switchboard_vrf: UncheckedAccount<'info>,

    /// Switchboard Oracle Queue
    /// CHECK: This is validated by the Switchboard program
    pub oracle_queue: UncheckedAccount<'info>,

    /// Switchboard Queue Authority
    /// CHECK: This is validated by the Switchboard program
    pub queue_authority: UncheckedAccount<'info>,

    /// Data Buffer
    /// CHECK: This is validated by the Switchboard program
    #[account(mut)]
    pub data_buffer: UncheckedAccount<'info>,

    /// Permission account
    /// CHECK: This is validated by the Switchboard program
    #[account(mut)]
    pub permission: UncheckedAccount<'info>,

    /// Escrow account (for oracle payment)
    /// CHECK: This is validated by the Switchboard program
    #[account(mut)]
    pub escrow: UncheckedAccount<'info>,

    /// Payer token account
    /// CHECK: This is validated by the Switchboard program
    #[account(mut)]
    pub payer_wallet: UncheckedAccount<'info>,

    /// Recent blockhashes sysvar
    /// CHECK: This is the recent blockhashes sysvar
    pub recent_blockhashes: UncheckedAccount<'info>,

    /// Token program
    /// CHECK: This is the SPL token program
    pub token_program: UncheckedAccount<'info>,

    /// Switchboard program
    /// CHECK: This is the Switchboard V2 program
    pub switchboard_program: UncheckedAccount<'info>,

    #[account(mut, constraint = authority.key() == betting_pool.authority)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<RequestVrfRandomness>, round_id: u64) -> Result<()> {
    let vrf_request = &mut ctx.accounts.vrf_request;

    // Initialize VRF request
    vrf_request.round_id = round_id;
    vrf_request.vrf_account = ctx.accounts.switchboard_vrf.key();
    vrf_request.request_time = Clock::get()?.unix_timestamp;
    vrf_request.fulfilled = false;
    vrf_request.fulfillment_time = 0;
    vrf_request.randomness = [0u8; 320];
    vrf_request.match_results = [0u8; 10];
    vrf_request.bump = ctx.bumps.vrf_request;

    // NOTE: In production, this would make a CPI call to Switchboard
    // to request randomness. For now, we just initialize the account.
    //
    // Example CPI call (requires switchboard-v2 crate):
    // ```
    // switchboard_v2::VrfRequestRandomness::invoke(
    //     CpiContext::new_with_signer(
    //         ctx.accounts.switchboard_program.to_account_info(),
    //         switchboard_v2::VrfRequestRandomness {
    //             vrf: ctx.accounts.switchboard_vrf.to_account_info(),
    //             oracle_queue: ctx.accounts.oracle_queue.to_account_info(),
    //             queue_authority: ctx.accounts.queue_authority.to_account_info(),
    //             data_buffer: ctx.accounts.data_buffer.to_account_info(),
    //             permission: ctx.accounts.permission.to_account_info(),
    //             escrow: ctx.accounts.escrow.to_account_info(),
    //             payer_wallet: ctx.accounts.payer_wallet.to_account_info(),
    //             payer_authority: ctx.accounts.authority.to_account_info(),
    //             recent_blockhashes: ctx.accounts.recent_blockhashes.to_account_info(),
    //             token_program: ctx.accounts.token_program.to_account_info(),
    //         },
    //         &[&seeds[..]],
    //     ),
    // )?;
    // ```

    msg!("VRF randomness requested for round {}", round_id);
    msg!("VRF account: {}", ctx.accounts.switchboard_vrf.key());

    Ok(())
}
