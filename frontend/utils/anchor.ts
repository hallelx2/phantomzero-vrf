import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { AnchorWallet } from '@solana/wallet-adapter-react';
import { IDL, Sportsbook } from './idl';

// Program ID from the smart contract
export const PROGRAM_ID = new PublicKey('Spo7t11111111111111111111111111111111111111');

export function getProgram(connection: Connection, wallet: AnchorWallet) {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });

  const program = new Program<Sportsbook>(IDL, PROGRAM_ID, provider);
  return program;
}

// PDA helpers
export function getBettingPoolPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('betting_pool')],
    PROGRAM_ID
  );
}

export function getLiquidityPoolPDA(bettingPool: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('liquidity_pool'), bettingPool.toBuffer()],
    PROGRAM_ID
  );
}

export function getRoundAccountingPDA(
  bettingPool: PublicKey,
  roundId: number
): [PublicKey, number] {
  const roundIdBuffer = Buffer.alloc(8);
  roundIdBuffer.writeBigUInt64LE(BigInt(roundId));

  return PublicKey.findProgramAddressSync(
    [Buffer.from('round'), bettingPool.toBuffer(), roundIdBuffer],
    PROGRAM_ID
  );
}

export function getBetPDA(
  bettingPool: PublicKey,
  betId: number
): [PublicKey, number] {
  const betIdBuffer = Buffer.alloc(8);
  betIdBuffer.writeBigUInt64LE(BigInt(betId));

  return PublicKey.findProgramAddressSync(
    [Buffer.from('bet'), bettingPool.toBuffer(), betIdBuffer],
    PROGRAM_ID
  );
}

export function getLpPositionPDA(
  liquidityPool: PublicKey,
  provider: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('lp_position'), liquidityPool.toBuffer(), provider.toBuffer()],
    PROGRAM_ID
  );
}

// Helper to get token account for a wallet
export async function getOrCreateTokenAccount(
  connection: Connection,
  wallet: PublicKey,
  mint: PublicKey
): Promise<PublicKey> {
  return await getAssociatedTokenAddress(mint, wallet);
}

// Convert number to BN for Anchor
export function toBN(value: number | string): BN {
  return new BN(value);
}
