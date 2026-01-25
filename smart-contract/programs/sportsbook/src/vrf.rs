/// Switchboard VRF Integration Module
///
/// This module provides integration with Switchboard V2 VRF for provably fair randomness
/// in match outcome generation.

use anchor_lang::prelude::*;

/// VRF Request account to track randomness requests
#[account]
pub struct VrfRequest {
    /// Round ID this VRF request is for
    pub round_id: u64,

    /// VRF account public key (Switchboard)
    pub vrf_account: Pubkey,

    /// Request timestamp
    pub request_time: i64,

    /// Whether the request has been fulfilled
    pub fulfilled: bool,

    /// Fulfillment timestamp
    pub fulfillment_time: i64,

    /// Randomness result (320 bytes = 32 bytes per match × 10 matches)
    pub randomness: [u8; 320],

    /// Match results derived from randomness
    pub match_results: [u8; 10],

    /// Bump seed for PDA
    pub bump: u8,
}

impl VrfRequest {
    pub const LEN: usize = 8 + // discriminator
        8 +  // round_id
        32 + // vrf_account
        8 +  // request_time
        1 +  // fulfilled
        8 +  // fulfillment_time
        320 + // randomness (32 bytes × 10 matches)
        10 + // match_results
        1;   // bump
}

/// Generate match outcome from randomness bytes
///
/// Maps random bytes to match outcomes (1, 2, or 3)
/// Each outcome has equal 33.33% probability
pub fn outcome_from_randomness(randomness: &[u8]) -> u8 {
    // Take first 8 bytes and convert to u64
    let value = u64::from_le_bytes(randomness[0..8].try_into().unwrap());

    // Map to outcome (1, 2, or 3) with equal probability
    ((value % 3) + 1) as u8
}

/// Extract all 10 match results from VRF randomness
pub fn extract_match_results(randomness: &[u8; 320]) -> [u8; 10] {
    let mut results = [0u8; 10];

    for i in 0..10 {
        let offset = i * 32;
        let match_randomness = &randomness[offset..offset + 32];
        results[i] = outcome_from_randomness(match_randomness);
    }

    results
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_outcome_from_randomness() {
        // Test with known values
        let randomness1 = [0u8; 32];
        let outcome1 = outcome_from_randomness(&randomness1);
        assert!(outcome1 >= 1 && outcome1 <= 3);

        let randomness2 = [255u8; 32];
        let outcome2 = outcome_from_randomness(&randomness2);
        assert!(outcome2 >= 1 && outcome2 <= 3);

        // Test that different random values can produce different outcomes
        let mut randomness3 = [0u8; 32];
        randomness3[0] = 1;
        let outcome3 = outcome_from_randomness(&randomness3);
        assert!(outcome3 >= 1 && outcome3 <= 3);
    }

    #[test]
    fn test_extract_match_results() {
        let randomness = [0u8; 320];
        let results = extract_match_results(&randomness);

        // All results should be valid outcomes
        for result in &results {
            assert!(*result >= 1 && *result <= 3);
        }

        assert_eq!(results.len(), 10);
    }
}
