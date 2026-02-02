import { Program, BN } from '@coral-xyz/anchor';
import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { AnchorWallet } from '@solana/wallet-adapter-react';
import { Sportsbook } from './idl';
import {
  getProgram,
  getBettingPoolPDA,
  getLiquidityPoolPDA,
  getRoundAccountingPDA,
  getBetPDA,
  getLpPositionPDA,
  getOrCreateTokenAccount,
  toBN,
} from './anchor';

/**
 * Place a bet on match outcomes
 */
export async function placeBetTransaction(
  connection: Connection,
  wallet: AnchorWallet,
  roundId: number,
  matchIndices: number[],
  outcomes: number[],
  amount: number,
  tokenMint: PublicKey
) {
  const program = getProgram(connection, wallet);
  const [bettingPool] = getBettingPoolPDA();
  const [liquidityPool] = getLiquidityPoolPDA(bettingPool);
  const [roundAccounting] = getRoundAccountingPDA(bettingPool, roundId);

  // Get betting pool data to determine next bet ID
  const bettingPoolData = await program.account.bettingPool.fetch(bettingPool);
  const betId = bettingPoolData.nextBetId.toNumber();
  const [betPDA] = getBetPDA(bettingPool, betId);

  // Get token accounts
  const bettorTokenAccount = await getOrCreateTokenAccount(
    connection,
    wallet.publicKey,
    tokenMint
  );
  const bettingPoolTokenAccount = await getOrCreateTokenAccount(
    connection,
    bettingPool,
    tokenMint
  );
  const protocolTreasuryTokenAccount = await getOrCreateTokenAccount(
    connection,
    bettingPoolData.protocolTreasury,
    tokenMint
  );

  // Build transaction
  const tx = await program.methods
    .placeBet(
      toBN(roundId),
      matchIndices.map((i) => i),
      outcomes.map((o) => o),
      toBN(amount)
    )
    .accounts({
      bettingPool,
      roundAccounting,
      liquidityPool,
      bet: betPDA,
      bettor: wallet.publicKey,
      bettorTokenAccount,
      bettingPoolTokenAccount,
      protocolTreasuryTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .transaction();

  return { transaction: tx, betId };
}

/**
 * Add liquidity to the LP pool
 */
export async function addLiquidityTransaction(
  connection: Connection,
  wallet: AnchorWallet,
  amount: number,
  tokenMint: PublicKey
) {
  const program = getProgram(connection, wallet);
  const [bettingPool] = getBettingPoolPDA();
  const [liquidityPool] = getLiquidityPoolPDA(bettingPool);
  const [lpPosition] = getLpPositionPDA(liquidityPool, wallet.publicKey);

  // Get token accounts
  const providerTokenAccount = await getOrCreateTokenAccount(
    connection,
    wallet.publicKey,
    tokenMint
  );
  const lpTokenAccount = await getOrCreateTokenAccount(
    connection,
    liquidityPool,
    tokenMint
  );

  // Build transaction
  const tx = await program.methods
    .addLiquidity(toBN(amount))
    .accounts({
      bettingPool,
      liquidityPool,
      lpPosition,
      provider: wallet.publicKey,
      providerTokenAccount,
      lpTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .transaction();

  return tx;
}

/**
 * Remove liquidity from the LP pool
 */
export async function removeLiquidityTransaction(
  connection: Connection,
  wallet: AnchorWallet,
  shares: number,
  tokenMint: PublicKey
) {
  const program = getProgram(connection, wallet);
  const [bettingPool] = getBettingPoolPDA();
  const [liquidityPool] = getLiquidityPoolPDA(bettingPool);
  const [lpPosition] = getLpPositionPDA(liquidityPool, wallet.publicKey);

  // Get token accounts
  const providerTokenAccount = await getOrCreateTokenAccount(
    connection,
    wallet.publicKey,
    tokenMint
  );
  const lpTokenAccount = await getOrCreateTokenAccount(
    connection,
    liquidityPool,
    tokenMint
  );

  // Build transaction
  const tx = await program.methods
    .removeLiquidity(toBN(shares))
    .accounts({
      bettingPool,
      liquidityPool,
      lpPosition,
      provider: wallet.publicKey,
      providerTokenAccount,
      lpTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .transaction();

  return tx;
}

/**
 * Claim winnings for a bet
 */
export async function claimWinningsTransaction(
  connection: Connection,
  wallet: AnchorWallet,
  betId: number,
  roundId: number,
  minPayout: number,
  tokenMint: PublicKey
) {
  const program = getProgram(connection, wallet);
  const [bettingPool] = getBettingPoolPDA();
  const [liquidityPool] = getLiquidityPoolPDA(bettingPool);
  const [roundAccounting] = getRoundAccountingPDA(bettingPool, roundId);
  const [betPDA] = getBetPDA(bettingPool, betId);

  // Get token accounts
  const bettorTokenAccount = await getOrCreateTokenAccount(
    connection,
    wallet.publicKey,
    tokenMint
  );
  const bettingPoolTokenAccount = await getOrCreateTokenAccount(
    connection,
    bettingPool,
    tokenMint
  );
  const lpTokenAccount = await getOrCreateTokenAccount(
    connection,
    liquidityPool,
    tokenMint
  );

  // Build transaction
  const tx = await program.methods
    .claimWinnings(toBN(betId), toBN(minPayout))
    .accounts({
      bet: betPDA,
      bettingPool,
      roundAccounting,
      liquidityPool,
      bettor: wallet.publicKey,
      bettorTokenAccount,
      bettingPoolTokenAccount,
      lpTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .transaction();

  return tx;
}

/**
 * Fetch betting pool data
 */
export async function fetchBettingPool(connection: Connection, wallet: AnchorWallet) {
  const program = getProgram(connection, wallet);
  const [bettingPool] = getBettingPoolPDA();

  try {
    const data = await program.account.bettingPool.fetch(bettingPool);
    return data;
  } catch (error) {
    console.error('Error fetching betting pool:', error);
    return null;
  }
}

/**
 * Fetch liquidity pool data
 */
export async function fetchLiquidityPool(connection: Connection, wallet: AnchorWallet) {
  const program = getProgram(connection, wallet);
  const [bettingPool] = getBettingPoolPDA();
  const [liquidityPool] = getLiquidityPoolPDA(bettingPool);

  try {
    const data = await program.account.liquidityPool.fetch(liquidityPool);
    return data;
  } catch (error) {
    console.error('Error fetching liquidity pool:', error);
    return null;
  }
}

/**
 * Fetch round accounting data
 */
export async function fetchRoundAccounting(
  connection: Connection,
  wallet: AnchorWallet,
  roundId: number
) {
  const program = getProgram(connection, wallet);
  const [bettingPool] = getBettingPoolPDA();
  const [roundAccounting] = getRoundAccountingPDA(bettingPool, roundId);

  try {
    const data = await program.account.roundAccounting.fetch(roundAccounting);
    return data;
  } catch (error) {
    console.error('Error fetching round accounting:', error);
    return null;
  }
}

/**
 * Fetch LP position data
 */
export async function fetchLpPosition(connection: Connection, wallet: AnchorWallet) {
  const program = getProgram(connection, wallet);
  const [bettingPool] = getBettingPoolPDA();
  const [liquidityPool] = getLiquidityPoolPDA(bettingPool);
  const [lpPosition] = getLpPositionPDA(liquidityPool, wallet.publicKey);

  try {
    const data = await program.account.lpPosition.fetch(lpPosition);
    return data;
  } catch (error) {
    // Position might not exist yet
    return null;
  }
}

/**
 * Fetch bet data
 */
export async function fetchBet(
  connection: Connection,
  wallet: AnchorWallet,
  betId: number
) {
  const program = getProgram(connection, wallet);
  const [bettingPool] = getBettingPoolPDA();
  const [betPDA] = getBetPDA(bettingPool, betId);

  try {
    const data = await program.account.bet.fetch(betPDA);
    return data;
  } catch (error) {
    console.error('Error fetching bet:', error);
    return null;
  }
}
