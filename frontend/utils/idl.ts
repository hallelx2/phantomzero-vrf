export type Sportsbook = {
  "version": "0.1.0",
  "name": "sportsbook",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        {
          "name": "bettingPool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityPool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "tokenMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "protocolTreasury",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "protocolFeeBps",
          "type": "u16"
        },
        {
          "name": "winnerShareBps",
          "type": "u16"
        },
        {
          "name": "seasonPoolShareBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "initializeRound",
      "accounts": [
        {
          "name": "bettingPool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "roundAccounting",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "roundId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "seedRoundPools",
      "accounts": [
        {
          "name": "bettingPool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "roundAccounting",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityPool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "bettingPoolTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lpTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "roundId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "placeBet",
      "accounts": [
        {
          "name": "bettingPool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "roundAccounting",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityPool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "bet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "bettor",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "bettorTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "bettingPoolTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "protocolTreasuryTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "roundId",
          "type": "u64"
        },
        {
          "name": "matchIndices",
          "type": {
            "vec": "u8"
          }
        },
        {
          "name": "outcomes",
          "type": {
            "vec": "u8"
          }
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "settleRound",
      "accounts": [
        {
          "name": "bettingPool",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "roundAccounting",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        }
      ],
      "args": [
        {
          "name": "roundId",
          "type": "u64"
        },
        {
          "name": "matchResults",
          "type": {
            "vec": "u8"
          }
        }
      ]
    },
    {
      "name": "claimWinnings",
      "accounts": [
        {
          "name": "bet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "bettingPool",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "roundAccounting",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityPool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "bettor",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "bettorTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "bettingPoolTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lpTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "betId",
          "type": "u64"
        },
        {
          "name": "minPayout",
          "type": "u64"
        }
      ]
    },
    {
      "name": "finalizeRoundRevenue",
      "accounts": [
        {
          "name": "bettingPool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "roundAccounting",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityPool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "bettingPoolTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lpTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "roundId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "addLiquidity",
      "accounts": [
        {
          "name": "bettingPool",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "liquidityPool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lpPosition",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "provider",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "providerTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lpTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "removeLiquidity",
      "accounts": [
        {
          "name": "bettingPool",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "liquidityPool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lpPosition",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "provider",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "providerTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lpTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "shares",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "BettingPool",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "tokenMint",
            "type": "publicKey"
          },
          {
            "name": "protocolTreasury",
            "type": "publicKey"
          },
          {
            "name": "liquidityPool",
            "type": "publicKey"
          },
          {
            "name": "protocolFeeBps",
            "type": "u16"
          },
          {
            "name": "winnerShareBps",
            "type": "u16"
          },
          {
            "name": "seasonPoolShareBps",
            "type": "u16"
          },
          {
            "name": "seasonRewardPool",
            "type": "u64"
          },
          {
            "name": "nextBetId",
            "type": "u64"
          },
          {
            "name": "nextRoundId",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "LiquidityPool",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bettingPool",
            "type": "publicKey"
          },
          {
            "name": "totalLiquidity",
            "type": "u64"
          },
          {
            "name": "totalShares",
            "type": "u64"
          },
          {
            "name": "lockedReserve",
            "type": "u64"
          },
          {
            "name": "availableLiquidity",
            "type": "u64"
          },
          {
            "name": "totalProfit",
            "type": "u64"
          },
          {
            "name": "totalLoss",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "RoundAccounting",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "roundId",
            "type": "u64"
          },
          {
            "name": "bettingPool",
            "type": "publicKey"
          },
          {
            "name": "totalBetVolume",
            "type": "u64"
          },
          {
            "name": "totalReservedForWinners",
            "type": "u64"
          },
          {
            "name": "totalClaimed",
            "type": "u64"
          },
          {
            "name": "settled",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "Bet",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "betId",
            "type": "u64"
          },
          {
            "name": "bettor",
            "type": "publicKey"
          },
          {
            "name": "roundId",
            "type": "u64"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "potentialPayout",
            "type": "u64"
          },
          {
            "name": "claimed",
            "type": "bool"
          },
          {
            "name": "won",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "LpPosition",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "publicKey"
          },
          {
            "name": "liquidityPool",
            "type": "publicKey"
          },
          {
            "name": "shares",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InvalidMatchIndex",
      "msg": "Invalid match index (must be 0-9)"
    },
    {
      "code": 6001,
      "name": "InvalidOutcome",
      "msg": "Invalid outcome (must be 1, 2, or 3)"
    },
    {
      "code": 6002,
      "name": "ArrayLengthMismatch",
      "msg": "Array length mismatch between match indices and outcomes"
    },
    {
      "code": 6003,
      "name": "InvalidBetCount",
      "msg": "Invalid bet count (must be 1-10)"
    },
    {
      "code": 6004,
      "name": "BetExceedsMaximum",
      "msg": "Bet amount exceeds maximum allowed"
    },
    {
      "code": 6005,
      "name": "RoundAlreadySettled",
      "msg": "Round already settled"
    },
    {
      "code": 6006,
      "name": "RoundNotSettled",
      "msg": "Round not settled yet"
    },
    {
      "code": 6007,
      "name": "RoundAlreadySeeded",
      "msg": "Round already seeded"
    },
    {
      "code": 6008,
      "name": "RoundNotSeeded",
      "msg": "Round not seeded yet"
    },
    {
      "code": 6009,
      "name": "OddsNotLocked",
      "msg": "Odds not locked yet"
    },
    {
      "code": 6010,
      "name": "BetAlreadyClaimed",
      "msg": "Bet already claimed"
    },
    {
      "code": 6011,
      "name": "NotBettor",
      "msg": "Not the bettor"
    },
    {
      "code": 6012,
      "name": "PayoutBelowMinimum",
      "msg": "Payout below minimum (slippage protection)"
    },
    {
      "code": 6013,
      "name": "InsufficientLPLiquidity",
      "msg": "Insufficient LP liquidity"
    },
    {
      "code": 6014,
      "name": "InsufficientAvailableLiquidity",
      "msg": "Insufficient available liquidity for withdrawal"
    },
    {
      "code": 6015,
      "name": "InvalidRoundId",
      "msg": "Invalid round ID"
    }
  ]
};

export const IDL: Sportsbook = {
  "version": "0.1.0",
  "name": "sportsbook",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        {
          "name": "bettingPool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityPool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "tokenMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "protocolTreasury",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "protocolFeeBps",
          "type": "u16"
        },
        {
          "name": "winnerShareBps",
          "type": "u16"
        },
        {
          "name": "seasonPoolShareBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "initializeRound",
      "accounts": [
        {
          "name": "bettingPool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "roundAccounting",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "roundId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "seedRoundPools",
      "accounts": [
        {
          "name": "bettingPool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "roundAccounting",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityPool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "bettingPoolTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lpTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "roundId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "placeBet",
      "accounts": [
        {
          "name": "bettingPool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "roundAccounting",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityPool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "bet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "bettor",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "bettorTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "bettingPoolTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "protocolTreasuryTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "roundId",
          "type": "u64"
        },
        {
          "name": "matchIndices",
          "type": {
            "vec": "u8"
          }
        },
        {
          "name": "outcomes",
          "type": {
            "vec": "u8"
          }
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "settleRound",
      "accounts": [
        {
          "name": "bettingPool",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "roundAccounting",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        }
      ],
      "args": [
        {
          "name": "roundId",
          "type": "u64"
        },
        {
          "name": "matchResults",
          "type": {
            "vec": "u8"
          }
        }
      ]
    },
    {
      "name": "claimWinnings",
      "accounts": [
        {
          "name": "bet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "bettingPool",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "roundAccounting",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityPool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "bettor",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "bettorTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "bettingPoolTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lpTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "betId",
          "type": "u64"
        },
        {
          "name": "minPayout",
          "type": "u64"
        }
      ]
    },
    {
      "name": "finalizeRoundRevenue",
      "accounts": [
        {
          "name": "bettingPool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "roundAccounting",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "liquidityPool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "bettingPoolTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lpTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "roundId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "addLiquidity",
      "accounts": [
        {
          "name": "bettingPool",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "liquidityPool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lpPosition",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "provider",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "providerTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lpTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "removeLiquidity",
      "accounts": [
        {
          "name": "bettingPool",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "liquidityPool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lpPosition",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "provider",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "providerTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lpTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "shares",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "BettingPool",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "tokenMint",
            "type": "publicKey"
          },
          {
            "name": "protocolTreasury",
            "type": "publicKey"
          },
          {
            "name": "liquidityPool",
            "type": "publicKey"
          },
          {
            "name": "protocolFeeBps",
            "type": "u16"
          },
          {
            "name": "winnerShareBps",
            "type": "u16"
          },
          {
            "name": "seasonPoolShareBps",
            "type": "u16"
          },
          {
            "name": "seasonRewardPool",
            "type": "u64"
          },
          {
            "name": "nextBetId",
            "type": "u64"
          },
          {
            "name": "nextRoundId",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "LiquidityPool",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bettingPool",
            "type": "publicKey"
          },
          {
            "name": "totalLiquidity",
            "type": "u64"
          },
          {
            "name": "totalShares",
            "type": "u64"
          },
          {
            "name": "lockedReserve",
            "type": "u64"
          },
          {
            "name": "availableLiquidity",
            "type": "u64"
          },
          {
            "name": "totalProfit",
            "type": "u64"
          },
          {
            "name": "totalLoss",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "RoundAccounting",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "roundId",
            "type": "u64"
          },
          {
            "name": "bettingPool",
            "type": "publicKey"
          },
          {
            "name": "totalBetVolume",
            "type": "u64"
          },
          {
            "name": "totalReservedForWinners",
            "type": "u64"
          },
          {
            "name": "totalClaimed",
            "type": "u64"
          },
          {
            "name": "settled",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "Bet",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "betId",
            "type": "u64"
          },
          {
            "name": "bettor",
            "type": "publicKey"
          },
          {
            "name": "roundId",
            "type": "u64"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "potentialPayout",
            "type": "u64"
          },
          {
            "name": "claimed",
            "type": "bool"
          },
          {
            "name": "won",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "LpPosition",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "publicKey"
          },
          {
            "name": "liquidityPool",
            "type": "publicKey"
          },
          {
            "name": "shares",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InvalidMatchIndex",
      "msg": "Invalid match index (must be 0-9)"
    },
    {
      "code": 6001,
      "name": "InvalidOutcome",
      "msg": "Invalid outcome (must be 1, 2, or 3)"
    },
    {
      "code": 6002,
      "name": "ArrayLengthMismatch",
      "msg": "Array length mismatch between match indices and outcomes"
    },
    {
      "code": 6003,
      "name": "InvalidBetCount",
      "msg": "Invalid bet count (must be 1-10)"
    },
    {
      "code": 6004,
      "name": "BetExceedsMaximum",
      "msg": "Bet amount exceeds maximum allowed"
    },
    {
      "code": 6005,
      "name": "RoundAlreadySettled",
      "msg": "Round already settled"
    },
    {
      "code": 6006,
      "name": "RoundNotSettled",
      "msg": "Round not settled yet"
    },
    {
      "code": 6007,
      "name": "RoundAlreadySeeded",
      "msg": "Round already seeded"
    },
    {
      "code": 6008,
      "name": "RoundNotSeeded",
      "msg": "Round not seeded yet"
    },
    {
      "code": 6009,
      "name": "OddsNotLocked",
      "msg": "Odds not locked yet"
    },
    {
      "code": 6010,
      "name": "BetAlreadyClaimed",
      "msg": "Bet already claimed"
    },
    {
      "code": 6011,
      "name": "NotBettor",
      "msg": "Not the bettor"
    },
    {
      "code": 6012,
      "name": "PayoutBelowMinimum",
      "msg": "Payout below minimum (slippage protection)"
    },
    {
      "code": 6013,
      "name": "InsufficientLPLiquidity",
      "msg": "Insufficient LP liquidity"
    },
    {
      "code": 6014,
      "name": "InsufficientAvailableLiquidity",
      "msg": "Insufficient available liquidity for withdrawal"
    },
    {
      "code": 6015,
      "name": "InvalidRoundId",
      "msg": "Invalid round ID"
    }
  ]
};
