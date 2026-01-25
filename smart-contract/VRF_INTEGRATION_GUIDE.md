# Switchboard VRF Integration Guide

## Overview

The PhantomZero Sportsbook now includes Switchboard VRF (Verifiable Random Function) integration for provably fair match outcome generation. This guide explains how VRF works in the context of the sportsbook and how to use it.

## Architecture

### Components

1. **VRF Request Account** (`vrf.rs`)
   - Tracks randomness requests for each round
   - Stores the 320 bytes of randomness (32 bytes per match × 10 matches)
   - Contains the derived match results

2. **VRF Request Instruction** (`vrf_request.rs`)
   - Creates a VRF request account
   - Initiates randomness request to Switchboard oracle network
   - Called after round seeding, before betting closes

3. **VRF Fulfillment Instruction** (`vrf_fulfill.rs`)
   - Processes fulfilled VRF randomness
   - Extracts match results from random bytes
   - Called after Switchboard oracles fulfill the request

## Flow

```
1. Initialize Round
   ↓
2. Seed Round Pools (lock odds)
   ↓
3. Request VRF Randomness ← New!
   ↓
4. Users Place Bets
   ↓
5. Wait for VRF Fulfillment (off-chain)
   ↓
6. Fulfill VRF Request ← New!
   ↓
7. Settle Round (with VRF results)
   ↓
8. Users Claim Winnings
```

## Usage

### 1. Request VRF Randomness

After seeding a round, request randomness from Switchboard:

```typescript
const roundId = new anchor.BN(1);

const [vrfRequestPda] = anchor.web3.PublicKey.findProgramAddressSync(
  [
    Buffer.from("vrf_request"),
    bettingPoolPda.toBuffer(),
    roundId.toArrayLike(Buffer, "le", 8),
  ],
  program.programId
);

await program.methods
  .requestVrfRandomness(roundId)
  .accounts({
    bettingPool: bettingPoolPda,
    roundAccounting: roundPda,
    vrfRequest: vrfRequestPda,
    switchboardVrf: switchboardVrfAccount, // From Switchboard
    oracleQueue: switchboardQueueAccount,
    queueAuthority: queueAuthorityAccount,
    dataBuffer: dataBufferAccount,
    permission: permissionAccount,
    escrow: escrowAccount,
    payerWallet: payerTokenAccount,
    recentBlockhashes: SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
    tokenProgram: TOKEN_PROGRAM_ID,
    switchboardProgram: SWITCHBOARD_PROGRAM_ID,
    authority: provider.wallet.publicKey,
    systemProgram: anchor.web3.SystemProgram.programId,
  })
  .rpc();
```

### 2. Wait for Fulfillment

Switchboard oracles will fulfill the VRF request off-chain. Monitor the VRF account for completion:

```typescript
// Poll for VRF fulfillment
const vrfAccount = await program.account.vrfRequest.fetch(vrfRequestPda);

while (!vrfAccount.fulfilled) {
  await sleep(5000); // Wait 5 seconds
  vrfAccount = await program.account.vrfRequest.fetch(vrfRequestPda);
}
```

### 3. Fulfill VRF Request

Once fulfilled, extract the match results:

```typescript
await program.methods
  .fulfillVrfRequest(roundId)
  .accounts({
    bettingPool: bettingPoolPda,
    roundAccounting: roundPda,
    vrfRequest: vrfRequestPda,
    switchboardVrf: switchboardVrfAccount,
    authority: provider.wallet.publicKey,
  })
  .rpc();

// Get the match results
const vrfRequest = await program.account.vrfRequest.fetch(vrfRequestPda);
console.log("Match results:", vrfRequest.matchResults);
// Output: [1, 2, 3, 1, 2, 3, 1, 2, 3, 1]
```

### 4. Settle Round with VRF Results

Use the VRF-generated results to settle the round:

```typescript
const vrfRequest = await program.account.vrfRequest.fetch(vrfRequestPda);
const matchResults = vrfRequest.matchResults;

await program.methods
  .settleRound(roundId, matchResults)
  .accounts({
    bettingPool: bettingPoolPda,
    roundAccounting: roundPda,
    authority: provider.wallet.publicKey,
  })
  .rpc();
```

## Randomness Generation

### How Results are Derived

Each match gets 32 bytes of randomness from Switchboard VRF:

```rust
pub fn outcome_from_randomness(randomness: &[u8]) -> u8 {
    // Take first 8 bytes as u64
    let value = u64::from_le_bytes(randomness[0..8].try_into().unwrap());

    // Map to outcome (1, 2, or 3) with equal 33.33% probability
    ((value % 3) + 1) as u8
}
```

- **Outcome 1**: HOME_WIN
- **Outcome 2**: AWAY_WIN
- **Outcome 3**: DRAW

Each outcome has exactly **33.33% probability** (fair VRF odds).

### Verifiable Randomness

Switchboard VRF provides:
- ✅ **Provably Fair**: Cryptographic proof of randomness
- ✅ **Tamper-Proof**: Cannot be manipulated by anyone
- ✅ **Transparent**: All randomness is verifiable on-chain

## Production Setup

### Prerequisites

1. **Switchboard VRF Account**: Create a VRF account on Switchboard
2. **Oracle Queue**: Set up oracle queue (or use existing)
3. **Escrow**: Fund escrow account for oracle payments
4. **Permission**: Get permission to use the oracle queue

### Cost

VRF requests cost approximately:
- **Devnet**: Free (testnet)
- **Mainnet**: ~0.002 SOL per request

### Example Production Setup

```bash
# Install Switchboard CLI
npm install -g @switchboard-xyz/cli

# Create VRF account
sbv2 vrf create \
  --keypair ~/.config/solana/id.json \
  --oracleQueue <QUEUE_PUBKEY>

# Fund escrow
sbv2 vrf fund \
  --vrfKey <VRF_PUBKEY> \
  --amount 0.01
```

## Testing

Run the VRF tests:

```bash
cargo test vrf --lib
```

Output:
```
running 2 tests
test vrf::tests::test_outcome_from_randomness ... ok
test vrf::tests::test_extract_match_results ... ok
```

## Security Considerations

1. **VRF Proof Verification**: In production, verify VRF proofs
2. **Request-Fulfill Pattern**: Always use two-step process
3. **Oracle Payments**: Ensure escrow is funded
4. **Replay Protection**: VRF requests are one-time use

## Current Implementation

The current implementation includes:

✅ VRF request account structure
✅ VRF request instruction (initiation)
✅ VRF fulfill instruction (result extraction)
✅ Randomness-to-outcome conversion
✅ Match result extraction (10 matches)
✅ Integration with existing settlement flow

### Placeholder Mode

For testing without Switchboard:

```rust
// Generates deterministic "randomness" from round_id
let mut test_randomness = [0u8; 320];
for i in 0..320 {
    test_randomness[i] = ((round_id as usize + i) % 256) as u8;
}
```

### Production Mode

To enable full Switchboard integration:

1. Uncomment `switchboard-v2` in `Cargo.toml`
2. Update `vrf_request.rs` with Switchboard CPI calls
3. Update `vrf_fulfill.rs` to read actual VRF results

## Troubleshooting

### Issue: VRF Request Fails

**Solution**: Ensure escrow is funded and permissions are set

### Issue: VRF Never Fulfills

**Solution**: Check oracle queue is active and has available oracles

### Issue: Invalid Randomness

**Solution**: Verify VRF proof and ensure result buffer is 320 bytes

## References

- [Switchboard Docs](https://docs.switchboard.xyz/)
- [VRF Overview](https://docs.switchboard.xyz/randomness)
- [Solana VRF Example](https://github.com/switchboard-xyz/switchboard-v2/tree/main/programs/anchor-vrf-parser)

---

**Note**: This implementation provides the infrastructure for Switchboard VRF. For production deployment, complete the Switchboard CPI calls in `vrf_request.rs` and `vrf_fulfill.rs`.
