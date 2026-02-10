use anchor_lang::prelude::*;

#[error_code]
pub enum SportsbookError {
    #[msg("Invalid match index (must be 0-9)")]
    InvalidMatchIndex,

    #[msg("Invalid outcome (must be 1, 2, or 3)")]
    InvalidOutcome,

    #[msg("Array length mismatch between match indices and outcomes")]
    ArrayLengthMismatch,

    #[msg("Invalid bet count (must be 1-10)")]
    InvalidBetCount,

    #[msg("Bet amount exceeds maximum allowed")]
    BetExceedsMaximum,

    #[msg("Round already settled")]
    RoundAlreadySettled,

    #[msg("Round not settled yet")]
    RoundNotSettled,

    #[msg("Round already seeded")]
    RoundAlreadySeeded,

    #[msg("Round not seeded yet")]
    RoundNotSeeded,

    #[msg("Odds not locked yet")]
    OddsNotLocked,

    #[msg("Bet already claimed")]
    BetAlreadyClaimed,

    #[msg("Not the bettor")]
    NotBettor,

    #[msg("Payout below minimum (slippage protection)")]
    PayoutBelowMinimum,

    #[msg("Insufficient LP liquidity")]
    InsufficientLPLiquidity,

    #[msg("Insufficient protocol liquidity to pay winnings")]
    InsufficientProtocolLiquidity,

    #[msg("Insufficient available liquidity for withdrawal")]
    InsufficientAvailableLiquidity,

    #[msg("Round payout limit reached")]
    RoundPayoutLimitReached,

    #[msg("Revenue already distributed")]
    RevenueAlreadyDistributed,

    #[msg("Cannot distribute revenue while winners haven't claimed")]
    RevenueDistributedBeforeClaims,

    #[msg("Overflow in calculation")]
    CalculationOverflow,

    #[msg("Pool not initialized")]
    PoolNotInitialized,

    #[msg("Invalid authority")]
    InvalidAuthority,

    #[msg("Invalid amount (must be > 0)")]
    InvalidAmount,

    #[msg("Maximum payout exceeded")]
    MaxPayoutExceeded,

    #[msg("Invalid round ID")]
    InvalidRoundId,

    #[msg("Too many predictions (max 10)")]
    TooManyPredictions,

    #[msg("Invalid token account")]
    InvalidTokenAccount,

    #[msg("Numerical overflow")]
    NumericalOverflow,
}
