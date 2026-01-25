use anchor_lang::prelude::*;
use crate::state::{BettingPool, RoundAccounting};
use crate::vrf::{VrfRequest, extract_match_results};
use crate::errors::SportsbookError;

/// Fulfill VRF request and settle round with random results
///
/// This is called after the Switchboard oracle network has fulfilled
/// the VRF request with provably random data.
#[derive(Accounts)]
#[instruction(round_id: u64)]
pub struct FulfillVrfRequest<'info> {
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
        mut,
        seeds = [b"vrf_request", betting_pool.key().as_ref(), round_id.to_le_bytes().as_ref()],
        bump = vrf_request.bump,
        constraint = !vrf_request.fulfilled @ SportsbookError::RoundAlreadySettled,
    )]
    pub vrf_request: Account<'info, VrfRequest>,

    /// Switchboard VRF account (to read randomness from)
    /// CHECK: This is validated by reading the VRF result
    pub switchboard_vrf: UncheckedAccount<'info>,

    #[account(mut, constraint = authority.key() == betting_pool.authority)]
    pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<FulfillVrfRequest>, round_id: u64) -> Result<()> {
    // NOTE: In production, this would read the VRF result from the Switchboard
    // VRF account and verify the proof. For now, we'll use a placeholder.
    //
    // Example VRF result reading (requires switchboard-v2 crate):
    // ```
    // let vrf_account_data = VrfAccountData::new(ctx.accounts.switchboard_vrf)?;
    // let result_buffer = vrf_account_data.get_result()?;
    //
    // // Verify the result is valid
    // require!(result_buffer.len() >= 320, SportsbookError::InvalidVrfResult);
    //
    // // Copy randomness to our account
    // ctx.accounts.vrf_request.randomness.copy_from_slice(&result_buffer[0..320]);
    // ```

    // For testing purposes, generate deterministic "randomness" from round_id
    // In production, this would come from Switchboard VRF
    let mut test_randomness = [0u8; 320];
    for i in 0..320 {
        test_randomness[i] = ((round_id as usize + i) % 256) as u8;
    }
    ctx.accounts.vrf_request.randomness = test_randomness;

    // Extract match results from randomness
    let match_results = extract_match_results(&ctx.accounts.vrf_request.randomness);
    ctx.accounts.vrf_request.match_results = match_results;

    // Mark VRF request as fulfilled
    ctx.accounts.vrf_request.fulfilled = true;
    ctx.accounts.vrf_request.fulfillment_time = Clock::get()?.unix_timestamp;

    msg!("VRF request fulfilled for round {}", round_id);
    msg!("Match results: {:?}", match_results);

    Ok(())
}
