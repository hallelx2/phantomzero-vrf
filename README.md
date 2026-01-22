# phantomzero-vrf

i need you start a solana smart contract program in this repo in smat-contract/ folder,  iit will be a sportsbook betting prediction contract but powered by randomness, i have a solidity sample here -  // SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IGameEngine.sol";
import "./interfaces/ILiquidityPoolV2.sol";

/**
 * @title BettingPoolV2.1 - Unified LP Pool Model
 * @notice Pool-based betting system where ALL risk flows through LP pool
 * @dev NEW ARCHITECTURE:
 *      - Protocol earns 5% fee on all bets
 *      - LP pool covers ALL payouts (base + parlay bonuses)
 *      - LP pool funds round seeding (3k per round)
 *      - Reduced parlay bonuses (1.25x max) for LP safety
 *      - AMM-style LP shares (deposit/withdraw anytime)
 *
 * KEY FEATURES:
 * - ✅ Unified LP pool (no separate protocol reserve)
 * - ✅ Direct deduction model (losses immediately reduce LP value)
 * - ✅ 5% protocol fee on every bet
 * - ✅ Reduced parlay multipliers (1.0x - 1.25x)
 * - ✅ Max bet, max payout, and per-round caps
 */
contract BettingPoolV2_1 is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    IERC20 public immutable leagueToken;
    IGameEngine public immutable gameEngine;
    ILiquidityPoolV2 public immutable liquidityPoolV2;

    address public immutable protocolTreasury;
    address public rewardsDistributor;

    // NEW: Protocol fee model (5% on all bets)
    uint256 public constant PROTOCOL_FEE = 500; // 5% fee in basis points
    uint256 public constant WINNER_SHARE = 2500; // 25% distributed to winners (REDUCED for LP safety)
    uint256 public constant SEASON_POOL_SHARE = 200; // 2% for season rewards

    // Multibet stake bonus rates (basis points) - added to pool
    uint256 public constant BONUS_2_MATCH = 500;   // 5%
    uint256 public constant BONUS_3_MATCH = 1000;  // 10%
    uint256 public constant BONUS_4_PLUS = 2000;   // 20%

    // Parlay payout multipliers (1e18 scale) - UPDATED to match-based linear scaling
    // REDUCED Linear progression: 1.05x (2 matches) to 1.25x (10 matches) for LP safety
    // Reduces LP risk by ~50% while keeping parlays attractive
    uint256 public constant PARLAY_MULTIPLIER_1_MATCH = 1e18;      // 1.0x (no bonus)
    uint256 public constant PARLAY_MULTIPLIER_2_MATCHES = 105e16;  // 1.05x (was 1.15x)
    uint256 public constant PARLAY_MULTIPLIER_3_MATCHES = 11e17;   // 1.10x (was 1.194x)
    uint256 public constant PARLAY_MULTIPLIER_4_MATCHES = 113e16;  // 1.13x (was 1.238x)
    uint256 public constant PARLAY_MULTIPLIER_5_MATCHES = 116e16;  // 1.16x (was 1.281x)
    uint256 public constant PARLAY_MULTIPLIER_6_MATCHES = 119e16;  // 1.19x (was 1.325x)
    uint256 public constant PARLAY_MULTIPLIER_7_MATCHES = 121e16;  // 1.21x (was 1.369x)
    uint256 public constant PARLAY_MULTIPLIER_8_MATCHES = 123e16;  // 1.23x (was 1.413x)
    uint256 public constant PARLAY_MULTIPLIER_9_MATCHES = 124e16;  // 1.24x (was 1.456x)
    uint256 public constant PARLAY_MULTIPLIER_10_MATCHES = 125e16; // 1.25x (was 1.5x)

    // Protocol seeding per match (INCREASED for tighter odds control)
    // Strategy: Large seed amounts provide natural depth, reducing need for virtual liquidity
    uint256 public constant SEED_HOME_POOL = 1200 ether;   // Favorite
    uint256 public constant SEED_AWAY_POOL = 800 ether;    // Underdog
    uint256 public constant SEED_DRAW_POOL = 1000 ether;   // Middle
    uint256 public constant SEED_PER_MATCH = 3000 ether;   // Total per match (10x increase)
    uint256 public constant SEED_PER_ROUND = SEED_PER_MATCH * 10; // 30,000 LEAGUE per round

    // Virtual liquidity for odds dampening (DISABLED for maximum variance)
    // Multiplier = 1 means NO virtual liquidity, raw seeding determines odds
    // Creates true 1.2-1.8x odds range based on allocation
    uint256 public constant VIRTUAL_LIQUIDITY_MULTIPLIER = 12000000;

    // Liquidity-aware parlay parameters (NEW per Logic2.md)
    uint256 public constant MIN_IMBALANCE_FOR_FULL_BONUS = 4000; // 40% in basis points
    uint256 public constant MIN_PARLAY_MULTIPLIER = 11e17; // 1.1x minimum

    // Count-based parlay tiers (PRIMARY FOMO mechanism) - NEW!
    uint256 public constant COUNT_TIER_1 = 10;   // First 10 parlays
    uint256 public constant COUNT_TIER_2 = 20;   // Parlays 11-20
    uint256 public constant COUNT_TIER_3 = 30;   // Parlays 21-30
    uint256 public constant COUNT_TIER_4 = 40;   // Parlays 31-40
    // Tier 5: 41+ parlays

    // Count-based multipliers (decreasing with each tier)
    uint256 public constant COUNT_MULT_TIER_1 = 25e17;  // 2.5x (first 10)
    uint256 public constant COUNT_MULT_TIER_2 = 22e17;  // 2.2x (next 10)
    uint256 public constant COUNT_MULT_TIER_3 = 19e17;  // 1.9x (next 10)
    uint256 public constant COUNT_MULT_TIER_4 = 16e17;  // 1.6x (next 10)
    uint256 public constant COUNT_MULT_TIER_5 = 13e17;  // 1.3x (41+)

    // Reserve-based multiplier decay (SECONDARY safety valve) - NEW!
    uint256 public constant RESERVE_TIER_1 = 100000 ether;  // 0-100k locked reserve
    uint256 public constant RESERVE_TIER_2 = 250000 ether;  // 100k-250k locked reserve
    uint256 public constant RESERVE_TIER_3 = 500000 ether;  // 250k-500k locked reserve
    // Tier 4: 500k+ locked reserve

    // Multiplier decay per tier (applied as percentage of base multiplier)
    uint256 public constant TIER_1_DECAY = 10000; // 100% (no decay)
    uint256 public constant TIER_2_DECAY = 8800;  // 88% (12% decay)
    uint256 public constant TIER_3_DECAY = 7600;  // 76% (24% decay)
    uint256 public constant TIER_4_DECAY = 6400;  // 64% (36% decay)

    // ============ RISK MANAGEMENT CAPS (CRITICAL) ============
    // These caps protect protocol reserve from catastrophic depletion
    uint256 public constant MAX_BET_AMOUNT = 10000 ether; // 10,000 LEAGUE max bet
    uint256 public constant MAX_PAYOUT_PER_BET = 100000 ether; // 100,000 LEAGUE max payout
    uint256 public constant MAX_ROUND_PAYOUTS = 500000 ether; // 500,000 LEAGUE per round

    // REMOVED: protocolReserve (now handled by LP pool)
    // REMOVED: lockedParlayReserve (LP pool covers all payouts)
    uint256 public seasonRewardPool;
    uint256 public nextBetId;

    // ============ Structs ============

    struct MatchPool {
        uint256 homeWinPool;    // Total LEAGUE bet on HOME_WIN (outcome 1)
        uint256 awayWinPool;    // Total LEAGUE bet on AWAY_WIN (outcome 2)
        uint256 drawPool;       // Total LEAGUE bet on DRAW (outcome 3)
        uint256 totalPool;      // Sum of all three pools
    }

    // NEW: Locked odds at betting close
    struct LockedOdds {
        uint256 homeOdds;       // e.g., 1.5e18 = 1.5x odds for Home win
        uint256 awayOdds;       // e.g., 1.7e18 = 1.7x odds for Away win
        uint256 drawOdds;       // e.g., 1.8e18 = 1.8x odds for Draw
        bool locked;            // Have odds been locked for this match?
    }

    struct RoundAccounting {
        // Match-level pools (10 matches per round)
        mapping(uint256 => MatchPool) matchPools;

        // Locked odds per match (NEW!)
        mapping(uint256 => LockedOdds) lockedMatchOdds;

        // Round totals
        uint256 totalBetVolume;         // Total LEAGUE bet in this round
        uint256 totalWinningPool;       // Sum of all winning outcome pools (after settlement)
        uint256 totalLosingPool;        // Sum of all losing outcome pools
        uint256 totalReservedForWinners; // Total owed to winners (calculated from pools)
        uint256 totalClaimed;            // Total LEAGUE claimed so far
        uint256 totalPaidOut;            // Total LEAGUE paid out (including parlay bonuses) - NEW

        // Revenue distribution
        uint256 protocolFeeCollected;    // Protocol fee collected (5% of bets) - NEW
        uint256 protocolRevenueShare;   // Protocol's share of net revenue
        uint256 lpRevenueShare;          // LP's share of net revenue
        uint256 seasonRevenueShare;      // Season pool share
        bool revenueDistributed;         // Has revenue been distributed?

        // Seeding tracking - NEW!
        uint256 protocolSeedAmount;      // Total LEAGUE seeded by protocol
        bool seeded;                     // Has round been seeded?

        // LP borrowing for odds-weighted allocation - NEW!
        uint256 lpBorrowedForBets;       // Total borrowed from LP to balance pools
        uint256 totalUserDeposits;       // Actual user deposits (for season pool calculation)

        // Parlay count tracking (for count-based tiers) - NEW!
        uint256 parlayCount;             // Number of parlays placed this round

        // Timestamps
        uint256 roundStartTime;
        uint256 roundEndTime;
        bool settled;
    }

    struct Prediction {
        uint256 matchIndex;         // 0-9
        uint8 predictedOutcome;     // 1=HOME_WIN, 2=AWAY_WIN, 3=DRAW
        uint256 amountInPool;       // How much LEAGUE was added to this pool
    }

    struct Bet {
        address bettor;
        uint256 roundId;
        uint256 amount;             // User's total bet amount (SHOWN IN FRONTEND)
        uint256 amountAfterFee;     // Amount after 5% protocol fee
        uint256 allocatedAmount;    // Total allocated to pools (includes LP borrowed)
        uint256 lpBorrowedAmount;   // Amount borrowed from LP for this bet
        uint256 bonus;              // Protocol stake bonus added to pools
        uint256 lockedMultiplier;   // Parlay multiplier locked at bet placement (CRITICAL FIX)
        Prediction[] predictions;   // Match predictions
        bool settled;               // Has round been settled?
        bool claimed;               // Has user claimed winnings?
    }

    // ============ Mappings ============

    mapping(uint256 => RoundAccounting) public roundAccounting;
    mapping(uint256 => Bet) public bets;
    mapping(address => uint256[]) public userBets;
    mapping(uint256 => uint256) public betParlayReserve;  // NEW: betId => reserved parlay bonus

    // ============ Events ============

    event BetPlaced(
        uint256 indexed betId,
        address indexed bettor,
        uint256 indexed roundId,
        uint256 amount,
        uint256 bonus,
        uint256 parlayMultiplier,  // NEW
        uint256[] matchIndices,
        uint8[] outcomes
    );

    event RoundSeeded(
        uint256 indexed roundId,
        uint256 totalSeedAmount
    );

    event OddsLocked(
        uint256 indexed roundId,
        uint256 timestamp
    );

    event RoundSettled(
        uint256 indexed roundId,
        uint256 totalWinningPool,
        uint256 totalLosingPool,
        uint256 totalReserved
    );

    event WinningsClaimed(
        uint256 indexed betId,
        address indexed bettor,
        uint256 basePayout,
        uint256 parlayMultiplier,
        uint256 finalPayout
    );

    event BetLost(uint256 indexed betId, address indexed bettor);

    event ParlayBonusReleased(
        uint256 indexed betId,
        uint256 reservedAmount,
        uint256 actualBonus
    );

    event RoundRevenueFinalized(
        uint256 indexed roundId,
        uint256 netRevenue,
        uint256 toProtocol,
        uint256 toLP,
        uint256 toSeason,
        uint256 seedRecovered
    );

    event ProtocolReserveFunded(address indexed funder, uint256 amount);

    // ============ Constructor ============

    constructor(
        address _leagueToken,
        address _gameEngine,
        address _liquidityPool,
        address _protocolTreasury,
        address _rewardsDistributor,
        address _initialOwner
    ) Ownable(_initialOwner) {
        require(_leagueToken != address(0), "Invalid token");
        require(_gameEngine != address(0), "Invalid game engine");
        require(_liquidityPool != address(0), "Invalid liquidity pool");

        leagueToken = IERC20(_leagueToken);
        gameEngine = IGameEngine(_gameEngine);
        liquidityPoolV2 = ILiquidityPoolV2(_liquidityPool);
        protocolTreasury = _protocolTreasury;
        rewardsDistributor = _rewardsDistributor;
    }

    // ============ Seeding Functions ============

    /**
     * @notice Calculate differentiated seed amounts for a match (HYBRID MODEL)
     * @dev Round 1-3: Pseudo-random based on team IDs (no stats yet)
     *      Round 4+: Stats-based using actual team performance
     * @param roundId The round ID
     * @param matchIndex The match index (0-9)
     * @return homeSeed Amount to seed home pool
     * @return awaySeed Amount to seed away pool
     * @return drawSeed Amount to seed draw pool
     */
    function _calculateMatchSeeds(uint256 roundId, uint256 matchIndex)
        internal
        view
        returns (uint256 homeSeed, uint256 awaySeed, uint256 drawSeed)
    {
        // Get match from game engine
        IGameEngine.Match memory matchData = gameEngine.getMatch(roundId, matchIndex);
        uint256 homeTeamId = matchData.homeTeamId;
        uint256 awayTeamId = matchData.awayTeamId;

        // Get current season info
        uint256 seasonId = gameEngine.getCurrentSeason();
        IGameEngine.Season memory season = gameEngine.getSeason(seasonId);
        uint256 seasonRound = season.currentRound;

        // Use pseudo-random for first 3 rounds (no meaningful stats yet)
        if (seasonRound <= 3) {
            return _calculatePseudoRandomSeeds(homeTeamId, awayTeamId, roundId);
        }

        // Use actual team stats from round 4 onwards
        return _calculateStatsBasedSeeds(seasonId, homeTeamId, awayTeamId);
    }

    /**
     * @notice Calculate seeds using TIGHT BALANCED distribution for profitable LP
     * @dev UPDATED: Keeps odds in 1.3-1.6 range for LP profitability
     * @dev Strategy: Even distribution (30-35% per outcome) with small variance
     */
    function _calculatePseudoRandomSeeds(
        uint256 homeTeamId,
        uint256 awayTeamId,
        uint256 roundId
    )
        internal
        pure
        returns (uint256 homeSeed, uint256 awaySeed, uint256 drawSeed)
    {
        // Generate deterministic pseudo-random seed
        uint256 seed = uint256(
            keccak256(abi.encodePacked(homeTeamId, awayTeamId, roundId))
        );

        // Extract randomness (0-99)
        uint256 homeStrength = (seed >> 0) % 100;
        uint256 awayStrength = (seed >> 8) % 100;
        uint256 drawFactor = (seed >> 16) % 100;

        uint256 totalSeed = SEED_PER_MATCH; // 3000 LEAGUE

        // WIDE VARIANCE SEEDING FOR 1.2x - 1.8x ODDS RANGE  
        // 6 granular tiers create exciting varied odds across matches

        uint256 diff = homeStrength > awayStrength
            ? homeStrength - awayStrength
            : awayStrength - homeStrength;

        uint256 favoriteAlloc;
        uint256 underdogAlloc;
        uint256 drawAlloc;

        // More granular tiers = better odds distribution
        if (diff > 65) {
            // HUGE FAVORITE: 50/18/32 → 1.16x / 1.94x / 1.56x (EXTREME ODDS!)
            favoriteAlloc = 50;
            underdogAlloc = 18;
            drawAlloc = 32;
        } else if (diff > 50) {
            // VERY STRONG: 46/23/31 → 1.21x / 1.78x / 1.61x
            favoriteAlloc = 46;
            underdogAlloc = 23;
            drawAlloc = 31;
        } else if (diff > 35) {
            // STRONG: 42/27/31 → 1.26x / 1.67x / 1.61x
            favoriteAlloc = 42;
            underdogAlloc = 27;
            drawAlloc = 31;
        } else if (diff > 20) {
            // MODERATE: 38/31/31 → 1.32x / 1.55x / 1.61x
            favoriteAlloc = 38;
            underdogAlloc = 31;
            drawAlloc = 31;
        } else if (diff > 8) {
            // SLIGHT: 36/33/31 → 1.39x / 1.48x / 1.61x
            favoriteAlloc = 36;
            underdogAlloc = 33;
            drawAlloc = 31;
        } else {
            // BALANCED: 34/34/32 → 1.44x / 1.44x / 1.56x
            favoriteAlloc = 34;
            underdogAlloc = 34;
            drawAlloc = 32;
        }

        // Allocate pools
        if (homeStrength > awayStrength) {
            homeSeed = (totalSeed * favoriteAlloc) / 100;
            awaySeed = (totalSeed * underdogAlloc) / 100;
        } else {
            homeSeed = (totalSeed * underdogAlloc) / 100;
            awaySeed = (totalSeed * favoriteAlloc) / 100;
        }
        drawSeed = (totalSeed * drawAlloc) / 100;

        // Draw-heavy matchups (20% of matches get boosted draws)
        if (drawFactor > 80) {
            uint256 drawBoost = (totalSeed * 16) / 100; // Boost draw by 16%
            drawSeed += drawBoost;
            homeSeed -= drawBoost / 2;
            awaySeed -= drawBoost / 2;
        }

        return (homeSeed, awaySeed, drawSeed);
    }

    /**
     * @notice Calculate seeds using TIGHT stats-based distribution (mid-late season)
     * @dev UPDATED: Uses team stats but keeps odds in 1.3-1.6 range for LP profitability
     */
    function _calculateStatsBasedSeeds(
        uint256 seasonId,
        uint256 homeTeamId,
        uint256 awayTeamId
    )
        internal
        view
        returns (uint256 homeSeed, uint256 awaySeed, uint256 drawSeed)
    {
        // Get team stats from game engine
        IGameEngine.Team memory homeTeam = gameEngine.getTeamStanding(seasonId, homeTeamId);
        IGameEngine.Team memory awayTeam = gameEngine.getTeamStanding(seasonId, awayTeamId);

        uint256 totalSeed = SEED_PER_MATCH; // 300 LEAGUE

        // Calculate adjusted points (home advantage: +10%)
        uint256 adjustedHomePoints = (homeTeam.points * 110) / 100;
        uint256 totalPoints = adjustedHomePoints + awayTeam.points;

        if (totalPoints == 0) {
            // Fallback: use balanced seeding
            return (100 ether, 100 ether, 100 ether); // All 1.5x odds
        }

        // WIDE VARIANCE ALLOCATION (same as pseudo-random)
        uint256 homeTotalGames = homeTeam.wins + homeTeam.draws + homeTeam.losses;
        uint256 awayTotalGames = awayTeam.wins + awayTeam.draws + awayTeam.losses;

        if (homeTotalGames > 0 && awayTotalGames > 0) {
            // Point difference percentage
            uint256 pointDiff = adjustedHomePoints > awayTeam.points
                ? ((adjustedHomePoints - awayTeam.points) * 100) / totalPoints
                : ((awayTeam.points - adjustedHomePoints) * 100) / totalPoints;

            if (pointDiff > 30) {
                // STRONG FAVORITE: 45/25/30 split
                if (adjustedHomePoints > awayTeam.points) {
                    homeSeed = (totalSeed * 45) / 100;
                    awaySeed = (totalSeed * 25) / 100;
                    drawSeed = (totalSeed * 30) / 100;
                } else {
                    homeSeed = (totalSeed * 25) / 100;
                    awaySeed = (totalSeed * 45) / 100;
                    drawSeed = (totalSeed * 30) / 100;
                }
            } else if (pointDiff > 15) {
                // MODERATE FAVORITE: 40/30/30 split
                if (adjustedHomePoints > awayTeam.points) {
                    homeSeed = (totalSeed * 40) / 100;
                    awaySeed = (totalSeed * 30) / 100;
                    drawSeed = (totalSeed * 30) / 100;
                } else {
                    homeSeed = (totalSeed * 30) / 100;
                    awaySeed = (totalSeed * 40) / 100;
                    drawSeed = (totalSeed * 30) / 100;
                }
            } else {
                // BALANCED: 35/35/30 split
                homeSeed = (totalSeed * 35) / 100;
                awaySeed = (totalSeed * 35) / 100;
                drawSeed = (totalSeed * 30) / 100;
            }
        } else {
            // Fallback to balanced
            homeSeed = (totalSeed * 35) / 100;
            awaySeed = (totalSeed * 35) / 100;
            drawSeed = (totalSeed * 30) / 100;
        }

        return (homeSeed, awaySeed, drawSeed);
    }

    /**
     * @notice Seed match pools at round start with DYNAMIC differentiated odds
     * @dev Uses hybrid model: pseudo-random for rounds 1-3, stats-based for rounds 4+
     * @param roundId The round to seed
     */
    function seedRoundPools(uint256 roundId) external onlyOwner {
        RoundAccounting storage accounting = roundAccounting[roundId];
        require(!accounting.seeded, "Round already seeded");
        require(!accounting.settled, "Round already settled");

        uint256 totalSeedAmount = 0;

        // Seed each match with DIFFERENTIATED amounts based on team matchup
        for (uint256 matchIndex = 0; matchIndex < 10; matchIndex++) {
            (uint256 homeSeed, uint256 awaySeed, uint256 drawSeed) = _calculateMatchSeeds(roundId, matchIndex);

            MatchPool storage pool = accounting.matchPools[matchIndex];
            pool.homeWinPool = homeSeed;
            pool.awayWinPool = awaySeed;
            pool.drawPool = drawSeed;
            pool.totalPool = homeSeed + awaySeed + drawSeed;

            totalSeedAmount += pool.totalPool;
            accounting.totalBetVolume += pool.totalPool;
        }

        // Request seeding from LP pool
        bool success = liquidityPoolV2.fundSeeding(roundId, totalSeedAmount);
        require(success, "LP pool cannot fund seeding - insufficient liquidity");

        accounting.protocolSeedAmount = totalSeedAmount;
        accounting.seeded = true;

        // IMMEDIATELY LOCK ODDS after seeding (everyone gets same fixed odds)
        _lockRoundOddsFromSeeds(roundId, accounting);

        emit RoundSeeded(roundId, totalSeedAmount);
    }

    /**
     * @notice Lock odds based on seed ratios (called automatically after seeding)
     * @dev CRITICAL: Odds are locked at seeding time and NEVER change
     * @dev Everyone gets paid at these fixed odds, making accounting exact
     * @param roundId The round to lock odds for
     * @param accounting Storage reference to round accounting
     */
    function _lockRoundOddsFromSeeds(uint256 roundId, RoundAccounting storage accounting) internal {
        // Lock odds for all 10 matches based on INITIAL SEED ratios
        for (uint256 i = 0; i < 10; i++) {
            MatchPool storage pool = accounting.matchPools[i];
            LockedOdds storage odds = accounting.lockedMatchOdds[i];

            uint256 totalPool = pool.totalPool;
            require(totalPool > 0, "Pool not initialized");

            // FIXED ODDS FORMULA - Compressed to 1.2x - 1.8x range
            // Formula: odds = 1.0 + (totalPool / outcomePool - 1.0) × compressionFactor
            //
            // Allocation examples:
            // 50% (huge favorite): totalPool/outcomePool = 2.0 → compressed to ~1.25x
            // 34% (balanced): totalPool/outcomePool = 2.94 → compressed to ~1.50x
            // 18% (huge underdog): totalPool/outcomePool = 5.56 → compressed to ~1.75x
            //
            // Compression factor chosen to map raw 2-5.5 range to target 1.2-1.8 range

            // Raw parimutuel odds (no virtual liquidity)
            uint256 rawHomeOdds = (totalPool * 1e18) / pool.homeWinPool;
            uint256 rawAwayOdds = (totalPool * 1e18) / pool.awayWinPool;
            uint256 rawDrawOdds = (totalPool * 1e18) / pool.drawPool;

            // Compress to target range: 1.2x - 1.8x
            // Formula: compressed = 1.0 + (raw - 2.0) × 0.17
            // This maps: 2.0x→1.2x, 3.0x→1.37x, 4.0x→1.54x, 5.5x→1.8x
            odds.homeOdds = _compressOdds(rawHomeOdds);
            odds.awayOdds = _compressOdds(rawAwayOdds);
            odds.drawOdds = _compressOdds(rawDrawOdds);
            odds.locked = true;
        }

        emit OddsLocked(roundId, block.timestamp);
    }

    /**
     * @notice Compress raw parimutuel odds to target 1.3-1.7x range
     * @param rawOdds Raw odds from pool ratios (e.g., 3.0e18)
     * @return Compressed odds in 1.3-1.7x range
     */
    function _compressOdds(uint256 rawOdds) internal pure returns (uint256) {
        // Target range: 1.3x - 1.7x (safe profitable range)
        // Raw range: ~1.8x - 5.5x (from our 6-tier allocation system)

        // Minimum odds: 1.3x (even huge favorites must pay something)
        if (rawOdds < 18e17) { // Less than 1.8x raw
            return 13e17; // 1.3x min
        }

        // Maximum odds: 1.7x (cap huge underdogs)
        if (rawOdds > 55e17) { // More than 5.5x raw
            return 17e17; // 1.7x max
        }

        // Linear compression formula:
        // compressed = minOdds + (raw - minRaw) × (maxOdds - minOdds) / (maxRaw - minRaw)
        // compressed = 1.3 + (raw - 1.8) × (1.7 - 1.3) / (5.5 - 1.8)
        // compressed = 1.3 + (raw - 1.8) × 0.4 / 3.7
        // compressed = 1.3 + (raw - 1.8) × 0.108

        uint256 excess = rawOdds - 18e17; // Amount above 1.8x
        uint256 scaledExcess = (excess * 108) / 1000; // 0.108 factor
        uint256 compressed = 13e17 + scaledExcess; // Add to min 1.3x

        return compressed;
    }

    /**
     * @notice Calculate odds-weighted allocations for parlay bets
     * @dev Allocates tokens such that each match contributes equally to target payout
     * @param roundId Current round ID
     * @param matchIndices Array of match indices
     * @param outcomes Array of predicted outcomes
     * @param amountAfterFee User's bet amount after protocol fee
     * @param parlayMultiplier Locked parlay multiplier
     * @return allocations Array of allocations per match
     * @return totalAllocated Total tokens allocated to pools
     * @return lpBorrowed Amount borrowed from LP (totalAllocated - amountAfterFee)
     */
    function _calculateOddsWeightedAllocations(
        uint256 roundId,
        uint256[] calldata matchIndices,
        uint8[] calldata outcomes,
        uint256 amountAfterFee,
        uint256 parlayMultiplier
    ) internal view returns (uint256[] memory allocations, uint256 totalAllocated, uint256 lpBorrowed) {
        RoundAccounting storage accounting = roundAccounting[roundId];
        allocations = new uint256[](matchIndices.length);

        // Step 1: Calculate target final payout
        // Base payout = product of all odds
        uint256 basePayout = amountAfterFee;
        for (uint256 i = 0; i < matchIndices.length; i++) {
            LockedOdds storage odds = accounting.lockedMatchOdds[matchIndices[i]];
            require(odds.locked, "Odds not locked - seed round first");

            // Get odds for predicted outcome
            uint256 matchOdds;
            if (outcomes[i] == 1) {
                matchOdds = odds.homeOdds;
            } else if (outcomes[i] == 2) {
                matchOdds = odds.awayOdds;
            } else {
                matchOdds = odds.drawOdds;
            }

            // Multiply: basePayout = basePayout × matchOdds / 1e18
            // Check for overflow before multiplication
            require(basePayout <= type(uint256).max / matchOdds, "Parlay calculation overflow");
            basePayout = (basePayout * matchOdds) / 1e18;
        }

        // Apply parlay multiplier
        // Check for overflow before multiplication
        require(basePayout <= type(uint256).max / parlayMultiplier, "Parlay multiplier overflow");
        uint256 targetPayout = (basePayout * parlayMultiplier) / 1e18;

        // Step 2: Calculate per-match contribution (equal contribution)
        uint256 perMatchContribution = targetPayout / matchIndices.length;

        // Step 3: Calculate required allocation for each match (working backwards)
        totalAllocated = 0;
        for (uint256 i = 0; i < matchIndices.length; i++) {
            LockedOdds storage odds = accounting.lockedMatchOdds[matchIndices[i]];

            // Get odds for predicted outcome
            uint256 matchOdds;
            if (outcomes[i] == 1) {
                matchOdds = odds.homeOdds;
            } else if (outcomes[i] == 2) {
                matchOdds = odds.awayOdds;
            } else {
                matchOdds = odds.drawOdds;
            }

            // Calculate: allocation = perMatchContribution / matchOdds
            // allocation × matchOdds = perMatchContribution
            allocations[i] = (perMatchContribution * 1e18) / matchOdds;
            totalAllocated += allocations[i];
        }

        // Step 4: Calculate LP borrowing needed
        if (totalAllocated > amountAfterFee) {
            lpBorrowed = totalAllocated - amountAfterFee;
        } else {
            lpBorrowed = 0;
        }

        return (allocations, totalAllocated, lpBorrowed);
    }

    // ============ Betting Functions ============

    /**
     * @notice Place a bet on multiple match outcomes
     * @param matchIndices Array of match indices (0-9)
     * @param outcomes Array of predicted outcomes (1=HOME, 2=AWAY, 3=DRAW)
     * @param amount Total LEAGUE to bet (protocol bonus added on top)
     */
    function placeBet(
        uint256[] calldata matchIndices,
        uint8[] calldata outcomes,
        uint256 amount
    ) external nonReentrant returns (uint256 betId) {
        require(amount > 0, "Amount must be > 0");
        require(amount <= MAX_BET_AMOUNT, "Bet exceeds maximum"); // CRITICAL: Cap max bet
        require(matchIndices.length == outcomes.length, "Array length mismatch");
        require(matchIndices.length > 0 && matchIndices.length <= 10, "Invalid bet count");

        uint256 currentRoundId = gameEngine.getCurrentRound();
        require(currentRoundId > 0, "No active round");
        require(!gameEngine.isRoundSettled(currentRoundId), "Round already settled");

        // Transfer user's stake using SafeERC20
        leagueToken.safeTransferFrom(msg.sender, address(this), amount);

        RoundAccounting storage accounting = roundAccounting[currentRoundId];

        // Deduct 5% protocol fee
        uint256 protocolFee = (amount * PROTOCOL_FEE) / 10000;
        uint256 amountAfterFee = amount - protocolFee;

        // Transfer fee to treasury using SafeERC20
        leagueToken.safeTransfer(protocolTreasury, protocolFee);

        accounting.protocolFeeCollected += protocolFee;
        accounting.totalBetVolume += amountAfterFee;
        accounting.totalUserDeposits += amountAfterFee; // Track actual user deposits

        // Assign betId FIRST (BUG #1 fix)
        betId = nextBetId++;

        // Determine if this is a parlay (multi-leg bet)
        bool isParlay = matchIndices.length > 1;

        // Calculate DYNAMIC parlay multiplier for accurate reservation (BUG #2 fix)
        // This uses the CURRENT parlay count for tier calculation
        uint256 parlayMultiplier = _getParlayMultiplierDynamicPreview(
            matchIndices,
            currentRoundId,
            matchIndices.length
        );

        // CRITICAL: Check LP pool can cover worst-case payout BEFORE accepting bet
        uint256 maxPossiblePayout = _calculateMaxPayout(amountAfterFee, matchIndices.length, parlayMultiplier);
        require(
            liquidityPoolV2.canCoverPayout(maxPossiblePayout),
            "Insufficient LP liquidity for this bet"
        );

        // INCREMENT parlay count AFTER calculating multiplier (count-based FOMO)
        // This ensures next bettor sees the tier has moved
        if (isParlay) {
            accounting.parlayCount += 1;
        }

        // Calculate odds-weighted allocations
        (uint256[] memory allocations, uint256 totalAllocated, uint256 lpBorrowed) = _calculateOddsWeightedAllocations(
            currentRoundId,
            matchIndices,
            outcomes,
            amountAfterFee,
            parlayMultiplier
        );

        // If we need to borrow from LP, do it now
        if (lpBorrowed > 0) {
            require(
                liquidityPoolV2.canCoverPayout(lpBorrowed),
                "Insufficient LP liquidity to borrow for bet allocation"
            );

            // CRITICAL: Update state BEFORE external call (Checks-Effects-Interactions pattern)
            accounting.lpBorrowedForBets += lpBorrowed;

            // Transfer borrowed funds from LP to BettingPool
            liquidityPoolV2.payWinner(address(this), lpBorrowed);
        }

        // Store bet
        Bet storage bet = bets[betId];
        bet.bettor = msg.sender;
        bet.roundId = currentRoundId;
        bet.amount = amount;              // Original bet amount (shown in frontend)
        bet.amountAfterFee = amountAfterFee;  // After 5% fee
        bet.allocatedAmount = totalAllocated;  // Total allocated to pools
        bet.lpBorrowedAmount = lpBorrowed;     // Borrowed from LP
        bet.bonus = 0; // No stake bonus in unified LP model
        bet.lockedMultiplier = parlayMultiplier;  // CRITICAL FIX: Lock multiplier at bet placement
        bet.settled = false;
        bet.claimed = false;

        // Now add predictions and update pools with odds-weighted allocations
        for (uint256 i = 0; i < matchIndices.length; i++) {
            uint256 matchIndex = matchIndices[i];
            uint8 outcome = outcomes[i];

            require(matchIndex < 10, "Invalid match index");
            require(outcome >= 1 && outcome <= 3, "Invalid outcome");

            uint256 allocation = allocations[i];

            // Add to appropriate match pool
            MatchPool storage pool = accounting.matchPools[matchIndex];

            if (outcome == 1) {
                pool.homeWinPool += allocation;
            } else if (outcome == 2) {
                pool.awayWinPool += allocation;
            } else {
                pool.drawPool += allocation;
            }
            pool.totalPool += allocation;

            // Push prediction to storage array
            bet.predictions.push(Prediction({
                matchIndex: matchIndex,
                predictedOutcome: outcome,
                amountInPool: allocation
            }));
        }

        userBets[msg.sender].push(betId);

        emit BetPlaced(
            betId,
            msg.sender,
            currentRoundId,
            amount,
            0, // No stake bonus in unified LP model
            parlayMultiplier,
            matchIndices,
            outcomes
        );
    }

    /**
     * @notice Claim winnings for a bet (pull pattern)
     * @param betId The bet ID to claim
     * @param minPayout Minimum acceptable payout (slippage protection)
     */
    function claimWinnings(uint256 betId, uint256 minPayout) external nonReentrant {
        Bet storage bet = bets[betId];
        require(bet.bettor == msg.sender, "Not your bet");
        require(!bet.claimed, "Already claimed");

        RoundAccounting storage accounting = roundAccounting[bet.roundId];
        require(accounting.settled, "Round not settled");

        // Calculate if bet won and payout amount (with parlay multiplier)
        (bool won, uint256 basePayout, uint256 finalPayout) = _calculateBetPayout(betId);

        // Slippage protection: ensure payout meets minimum expectation
        require(finalPayout >= minPayout, "Payout below minimum (slippage)");

        bet.claimed = true;
        bet.settled = true;

        if (won && finalPayout > 0) {
            // CRITICAL: Check per-round payout cap to prevent excessive payouts
            require(
                accounting.totalPaidOut + finalPayout <= MAX_ROUND_PAYOUTS,
                "Round payout limit reached"
            );

            accounting.totalClaimed += finalPayout;
            accounting.totalPaidOut += finalPayout; // Track total paid including bonuses

            // Pay from BettingPool's balance first, pull from LP if insufficient
            uint256 bettingPoolBalance = leagueToken.balanceOf(address(this));

            if (bettingPoolBalance >= finalPayout) {
                // BettingPool has enough, pay directly using SafeERC20
                leagueToken.safeTransfer(msg.sender, finalPayout);
            } else {
                // BettingPool insufficient, need to pull from LP
                uint256 shortfall = finalPayout - bettingPoolBalance;

                // Pay what we have from BettingPool using SafeERC20
                if (bettingPoolBalance > 0) {
                    leagueToken.safeTransfer(msg.sender, bettingPoolBalance);
                }

                // Pull shortfall from LP and pay user
                liquidityPoolV2.payWinner(msg.sender, shortfall);
            }

            emit WinningsClaimed(
                betId,
                msg.sender,
                basePayout,
                bet.lockedMultiplier,  // Use locked multiplier instead of recalculating
                finalPayout
            );
        } else {
            emit BetLost(betId, msg.sender);
        }
    }

    // ============ Settlement Functions ============

    /**
     * @notice Settle round after VRF generates results
     * @param roundId The round to settle
     * @dev Only owner can settle to prevent frontrunning and ensure proper timing
     */
    function settleRound(uint256 roundId) external onlyOwner nonReentrant {
        require(gameEngine.isRoundSettled(roundId), "Round not settled in GameEngine");

        RoundAccounting storage accounting = roundAccounting[roundId];
        require(!accounting.settled, "Already settled");

        // Calculate winning and losing pools (O(10) - constant time)
        for (uint256 matchIndex = 0; matchIndex < 10; matchIndex++) {
            IGameEngine.Match memory matchResult = gameEngine.getMatch(roundId, matchIndex);
            MatchPool storage pool = accounting.matchPools[matchIndex];

            IGameEngine.MatchOutcome winningOutcome = matchResult.outcome;
            uint256 winningPool;
            uint256 losingPool;

            if (winningOutcome == IGameEngine.MatchOutcome.HOME_WIN) {
                winningPool = pool.homeWinPool;
                losingPool = pool.awayWinPool + pool.drawPool;
            } else if (winningOutcome == IGameEngine.MatchOutcome.AWAY_WIN) {
                winningPool = pool.awayWinPool;
                losingPool = pool.homeWinPool + pool.drawPool;
            } else {
                // DRAW
                winningPool = pool.drawPool;
                losingPool = pool.homeWinPool + pool.awayWinPool;
            }

            accounting.totalWinningPool += winningPool;
            accounting.totalLosingPool += losingPool;
        }

        // Calculate total owed to winners (prevents LP exploit)
        accounting.totalReservedForWinners = _calculateTotalWinningPayouts(roundId);

        accounting.settled = true;
        accounting.roundEndTime = block.timestamp;

        emit RoundSettled(
            roundId,
            accounting.totalWinningPool,
            accounting.totalLosingPool,
            accounting.totalReservedForWinners
        );
    }

    /**
     * @notice Distribute net revenue after all claims (or after timeout)
     * @param roundId The round to finalize
     */
    function finalizeRoundRevenue(uint256 roundId) external nonReentrant {
        RoundAccounting storage accounting = roundAccounting[roundId];
        require(accounting.settled, "Round not settled");
        require(!accounting.revenueDistributed, "Already distributed");

        // CORRECT ACCOUNTING:
        // All user bets and LP seed are in BettingPool contract
        // Winners were paid directly from LP pool (via payWinner)
        // Now return remaining funds in BettingPool back to LP

        // Check actual balance in this contract
        uint256 remainingInContract = leagueToken.balanceOf(address(this));

        uint256 profitToLP = 0;
        uint256 lossFromLP = 0;
        uint256 seasonShare = 0;

        if (remainingInContract > 0) {
            // Season pool gets exactly 2% of ACTUAL USER DEPOSITS (not including LP borrowed)
            uint256 totalUserBetsBeforeFee = accounting.totalUserDeposits + accounting.protocolFeeCollected;
            seasonShare = (totalUserBetsBeforeFee * 200) / 10000; // 2%

            // Cap seasonShare to what's actually available
            if (seasonShare > remainingInContract) {
                seasonShare = remainingInContract;
            }

            // LP gets everything else
            profitToLP = remainingInContract - seasonShare;

            // Transfer LP's share back to LP pool
            if (profitToLP > 0) {
                leagueToken.safeTransfer(address(liquidityPoolV2), profitToLP);
                // Update LP liquidity tracking
                liquidityPoolV2.returnSeedFunds(profitToLP);
            }

            // Allocate season pool share
            if (seasonShare > 0) {
                seasonRewardPool += seasonShare;
                // Funds stay in BettingPool contract for season rewards
            }
        }

        // Track if LP took a loss (paid out more than collected)
        uint256 totalInContract = accounting.totalBetVolume + accounting.protocolSeedAmount;
        uint256 totalPaid = accounting.totalPaidOut;

        if (totalPaid > totalInContract) {
            lossFromLP = totalPaid - totalInContract;
        }

        accounting.lpRevenueShare = profitToLP;
        accounting.seasonRevenueShare = seasonShare;
        accounting.revenueDistributed = true;

        emit RoundRevenueFinalized(
            roundId,
            totalInContract,
            totalPaid,
            profitToLP,
            lossFromLP,
            seasonShare
        );
    }

    // ============ Internal Helper Functions ============

    /**
     * @notice Calculate multibet stake bonus (added to pools upfront)
     */
    function _calculateMultibetBonus(uint256 amount, uint256 numMatches)
        internal
        pure
        returns (uint256)
    {
        if (numMatches == 1) return 0;
        if (numMatches == 2) return (amount * BONUS_2_MATCH) / 10000;
        if (numMatches == 3) return (amount * BONUS_3_MATCH) / 10000;
        return (amount * BONUS_4_PLUS) / 10000; // 4+ matches
    }

    /**
     * @notice Get parlay payout multiplier based on number of legs
     * @dev Multipliers are capped to prevent exponential growth
     * @param numLegs Number of matches in multibet
     * @return multiplier Multiplier in 1e18 scale (e.g., 1.5e18 = 1.5x)
     */
    /**
     * @notice Get base parlay multiplier based on number of matches (UPDATED: linear 1.15x-1.5x)
     * @dev Linear progression: 1 match = 1.0x, 2 matches = 1.15x, 10 matches = 1.5x
     * @param numMatches Number of matches in the parlay
     * @return multiplier Multiplier in 1e18 scale
     */
    function _getParlayMultiplier(uint256 numMatches)
        internal
        pure
        returns (uint256 multiplier)
    {
        if (numMatches == 1) return PARLAY_MULTIPLIER_1_MATCH;      // 1.0x
        if (numMatches == 2) return PARLAY_MULTIPLIER_2_MATCHES;    // 1.15x
        if (numMatches == 3) return PARLAY_MULTIPLIER_3_MATCHES;    // 1.194x
        if (numMatches == 4) return PARLAY_MULTIPLIER_4_MATCHES;    // 1.238x
        if (numMatches == 5) return PARLAY_MULTIPLIER_5_MATCHES;    // 1.281x
        if (numMatches == 6) return PARLAY_MULTIPLIER_6_MATCHES;    // 1.325x
        if (numMatches == 7) return PARLAY_MULTIPLIER_7_MATCHES;    // 1.369x
        if (numMatches == 8) return PARLAY_MULTIPLIER_8_MATCHES;    // 1.413x
        if (numMatches == 9) return PARLAY_MULTIPLIER_9_MATCHES;    // 1.456x
        return PARLAY_MULTIPLIER_10_MATCHES;                         // 1.5x (capped at 10)
    }

    /**
     * @notice Calculate pool imbalance for a match (Logic2.md)
     * @dev Measures dominance of largest pool
     * @param roundId The round ID
     * @param matchIndex The match index (0-9)
     * @return imbalance Pool imbalance in basis points (0-10000, where 10000 = 100%)
     */
    function _calculatePoolImbalance(uint256 roundId, uint256 matchIndex)
        internal
        view
        returns (uint256 imbalance)
    {
        MatchPool storage pool = roundAccounting[roundId].matchPools[matchIndex];

        if (pool.totalPool == 0) return 0;

        // Find max pool
        uint256 maxPool = pool.homeWinPool;
        if (pool.awayWinPool > maxPool) maxPool = pool.awayWinPool;
        if (pool.drawPool > maxPool) maxPool = pool.drawPool;

        // Return as basis points (10000 = 100%)
        imbalance = (maxPool * 10000) / pool.totalPool;

        return imbalance;
    }

    /**
     * @notice Get count-based parlay multiplier (PRIMARY FOMO mechanism)
     * @dev Returns multiplier based on parlay index in current round
     * @param parlayIndex The current parlay count (0-indexed)
     * @return multiplier Multiplier in 1e18 scale
     */
    function _getParlayMultiplierByCount(uint256 parlayIndex)
        internal
        pure
        returns (uint256 multiplier)
    {
        if (parlayIndex < COUNT_TIER_1) return COUNT_MULT_TIER_1;      // 2.5x (first 10)
        if (parlayIndex < COUNT_TIER_2) return COUNT_MULT_TIER_2;      // 2.2x (next 10)
        if (parlayIndex < COUNT_TIER_3) return COUNT_MULT_TIER_3;      // 1.9x (next 10)
        if (parlayIndex < COUNT_TIER_4) return COUNT_MULT_TIER_4;      // 1.6x (next 10)
        return COUNT_MULT_TIER_5;                                        // 1.3x (41+)
    }

    /**
     * @notice Get reserve-based decay factor (SECONDARY safety valve)
     * @dev Higher locked reserve = lower multipliers (capital protection)
     * @return decayFactor Percentage to apply to multiplier (10000 = 100%)
     */
    function _getReserveDecayFactor() internal pure returns (uint256 decayFactor) {
        // In unified LP model, no reserve decay - LP pool manages all risk
        return 10000; // 100% (no decay)
    }

    /**
     * @notice Get liquidity-aware parlay multiplier (PREVIEW for reservation)
     * @dev Combines 3 layers: count-based tiers + reserve decay + pool imbalance
     * @dev Used BEFORE bet exists for accurate reservation
     * @param matchIndices Array of match indices
     * @param roundId The round ID
     * @param numLegs Number of legs
     * @return multiplier Multiplier in 1e18 scale
     */
    function _getParlayMultiplierDynamicPreview(
        uint256[] calldata matchIndices,
        uint256 roundId,
        uint256 numLegs
    )
        internal
        view
        returns (uint256 multiplier)
    {
        // Single bets always get 1.0x
        if (numLegs == 1) return 1e18;

        RoundAccounting storage accounting = roundAccounting[roundId];

        // LAYER 1: Base multiplier based on number of matches (NEW: Linear 1.15x-1.5x)
        uint256 countBasedMult = _getParlayMultiplier(numLegs);

        // LAYER 2: Pool imbalance gating (ECONOMIC PROTECTION)
        uint256 totalImbalance = 0;
        for (uint256 i = 0; i < matchIndices.length; i++) {
            uint256 imbalance = _calculatePoolImbalance(roundId, matchIndices[i]);
            totalImbalance += imbalance;
        }
        uint256 avgImbalance = totalImbalance / matchIndices.length;

        // If pools are balanced, reduce to minimum regardless of tier
        if (avgImbalance < MIN_IMBALANCE_FOR_FULL_BONUS) {
            return MIN_PARLAY_MULTIPLIER; // 1.1x
        }

        // LAYER 3: Reserve-based decay (SECONDARY SAFETY VALVE)
        uint256 decayFactor = _getReserveDecayFactor();
        uint256 finalMultiplier = (countBasedMult * decayFactor) / 10000;

        // Never go below minimum
        if (finalMultiplier < MIN_PARLAY_MULTIPLIER) {
            return MIN_PARLAY_MULTIPLIER;
        }

        return finalMultiplier;
    }

    /**
     * @notice Get liquidity-aware parlay multiplier (stored from bet placement)
     * @dev Uses the same layered model as preview for consistency
     * @dev This is called during payout - multiplier was locked at bet time
     * @param betId The bet ID
     * @return multiplier Multiplier in 1e18 scale
     */
    function _getParlayMultiplierDynamic(uint256 betId)
        internal
        view
        returns (uint256 multiplier)
    {
        Bet storage bet = bets[betId];
        uint256 numLegs = bet.predictions.length;

        // Single bets always get 1.0x
        if (numLegs == 1) return 1e18;

        // NOTE: This recalculates the multiplier at payout time
        // In production, you might want to store the locked multiplier in the Bet struct
        // For now, we recalculate using the SAME logic as preview to ensure consistency

        RoundAccounting storage accounting = roundAccounting[bet.roundId];

        // We use the parlay count AT THE TIME OF BET PLACEMENT
        // This is stored implicitly - the bet was placed when count was X
        // For simplicity, we recalculate based on imbalance + reserve state

        // Calculate average imbalance across all legs
        uint256 totalImbalance = 0;
        for (uint256 i = 0; i < bet.predictions.length; i++) {
            Prediction memory pred = bet.predictions[i];
            uint256 imbalance = _calculatePoolImbalance(bet.roundId, pred.matchIndex);
            totalImbalance += imbalance;
        }
        uint256 avgImbalance = totalImbalance / bet.predictions.length;

        // If pools were balanced at bet time, reduce to minimum
        if (avgImbalance < MIN_IMBALANCE_FOR_FULL_BONUS) {
            return MIN_PARLAY_MULTIPLIER; // 1.1x
        }

        // For payout, we use the reserved multiplier
        // This should match what was calculated at bet placement
        // NOTE: In V2.2, consider storing multiplier in Bet struct for exact consistency

        // Use the base multiplier from number of legs as fallback
        uint256 baseMultiplier = _getParlayMultiplier(numLegs);
        return baseMultiplier > MIN_PARLAY_MULTIPLIER ? baseMultiplier : MIN_PARLAY_MULTIPLIER;
    }

    /**
     * @notice Reserve parlay bonus at bet time to prevent insolvency
     * @dev Reserves max possible bonus (pessimistic estimate)
     * @return maxBonus The amount reserved from protocol reserve
     */
    /**
     * @notice No longer used - parlay bonuses paid directly from LP pool
     * @dev Kept for backwards compatibility, always returns 0
     */
    function _reserveParlayBonus(uint256, uint256)
        internal
        pure
        returns (uint256)
    {
        return 0; // No upfront reservation in unified LP model
    }

    /**
     * @notice Calculate bet payout with parlay multiplier
     * @return won Whether all predictions were correct
     * @return basePayout Base payout from pools (without multiplier)
     * @return finalPayout Final payout after parlay multiplier
     */
    function _calculateBetPayout(uint256 betId)
        internal
        view
        returns (bool won, uint256 basePayout, uint256 finalPayout)
    {
        Bet storage bet = bets[betId];
        RoundAccounting storage accounting = roundAccounting[bet.roundId];

        bool allCorrect = true;
        uint256 totalBasePayout = 0;

        for (uint256 i = 0; i < bet.predictions.length; i++) {
            Prediction memory pred = bet.predictions[i];
            IGameEngine.Match memory matchResult = gameEngine.getMatch(
                bet.roundId,
                pred.matchIndex
            );

            // Check if prediction is correct
            IGameEngine.MatchOutcome predictedEnum;
            if (pred.predictedOutcome == 1) predictedEnum = IGameEngine.MatchOutcome.HOME_WIN;
            else if (pred.predictedOutcome == 2) predictedEnum = IGameEngine.MatchOutcome.AWAY_WIN;
            else predictedEnum = IGameEngine.MatchOutcome.DRAW;

            if (matchResult.outcome != predictedEnum) {
                allCorrect = false;
                break; // Multibet failed
            }

            // Use LOCKED ODDS for payout calculation
            LockedOdds storage odds = accounting.lockedMatchOdds[pred.matchIndex];
            require(odds.locked, "Odds not locked yet");

            // Get the locked odds for the predicted outcome
            uint256 lockedOdds;
            if (pred.predictedOutcome == 1) {
                lockedOdds = odds.homeOdds;
            } else if (pred.predictedOutcome == 2) {
                lockedOdds = odds.awayOdds;
            } else {
                lockedOdds = odds.drawOdds;
            }

            // Simple multiplication: amount × locked odds
            uint256 matchPayout = (pred.amountInPool * lockedOdds) / 1e18;

            totalBasePayout += matchPayout;
        }

        if (!allCorrect) {
            return (false, 0, 0);
        }

        // Apply LOCKED parlay multiplier (CRITICAL FIX: use stored value from bet placement)
        uint256 parlayMultiplier = bet.lockedMultiplier;
        uint256 totalFinalPayout = (totalBasePayout * parlayMultiplier) / 1e18;

        // CRITICAL: Cap maximum payout per bet to protect protocol reserve
        if (totalFinalPayout > MAX_PAYOUT_PER_BET) {
            totalFinalPayout = MAX_PAYOUT_PER_BET;
        }

        return (true, totalBasePayout, totalFinalPayout);
    }

    /**
     * @notice Calculate total payouts owed to ALL winners using LOCKED ODDS
     * @dev Loops through 10 matches (O(10) constant time)
     * @dev Uses locked odds × winning pool for exact payout calculation
     * @dev NOTE: This calculates BASE payouts only (without parlay multipliers)
     */
    function _calculateTotalWinningPayouts(uint256 roundId)
        internal
        view
        returns (uint256 totalOwed)
    {
        RoundAccounting storage accounting = roundAccounting[roundId];

        for (uint256 matchIndex = 0; matchIndex < 10; matchIndex++) {
            IGameEngine.Match memory matchResult = gameEngine.getMatch(roundId, matchIndex);
            MatchPool storage pool = accounting.matchPools[matchIndex];
            LockedOdds storage odds = accounting.lockedMatchOdds[matchIndex];

            IGameEngine.MatchOutcome winningOutcome = matchResult.outcome;
            if (winningOutcome == IGameEngine.MatchOutcome.PENDING) continue;

            uint8 outcomeAsUint8;
            if (winningOutcome == IGameEngine.MatchOutcome.HOME_WIN) outcomeAsUint8 = 1;
            else if (winningOutcome == IGameEngine.MatchOutcome.AWAY_WIN) outcomeAsUint8 = 2;
            else outcomeAsUint8 = 3; // DRAW

            uint256 winningPool = _getWinningPoolAmount(pool, outcomeAsUint8);
            if (winningPool == 0) continue;

            // Get locked odds for winning outcome
            uint256 lockedOdds;
            if (outcomeAsUint8 == 1) {
                lockedOdds = odds.homeOdds;
            } else if (outcomeAsUint8 == 2) {
                lockedOdds = odds.awayOdds;
            } else {
                lockedOdds = odds.drawOdds;
            }

            // Total owed = winning pool × locked odds
            uint256 totalOwedForMatch = (winningPool * lockedOdds) / 1e18;
            totalOwed += totalOwedForMatch;
        }

        return totalOwed;
    }

    /**
     * @notice Get the winning pool amount for a given outcome
     */
    function _getWinningPoolAmount(MatchPool storage pool, uint8 outcome)
        internal
        view
        returns (uint256)
    {
        if (outcome == 1) return pool.homeWinPool;
        if (outcome == 2) return pool.awayWinPool;
        return pool.drawPool;
    }

    // ============ Admin Functions ============

    /**
     * @notice Fund protocol reserve (required for bonuses and seeding)
     * @param amount Amount of LEAGUE to add
     */
    /**
     * @notice Calculate maximum possible payout for a bet
     * @dev Used to check if LP pool can cover potential winnings
     */
    function _calculateMaxPayout(uint256 amount, uint256 numMatches, uint256 parlayMultiplier)
        internal
        pure
        returns (uint256)
    {
        // Pessimistic estimate: assume best case odds (2x per match in worst case)
        uint256 maxBasePayout = amount * (2 ** numMatches);

        // Apply parlay multiplier
        uint256 maxFinalPayout = (maxBasePayout * parlayMultiplier) / 1e18;

        // Apply per-bet cap
        if (maxFinalPayout > MAX_PAYOUT_PER_BET) {
            maxFinalPayout = MAX_PAYOUT_PER_BET;
        }

        return maxFinalPayout;
    }

    /**
     * @notice Update rewards distributor address
     */
    function setRewardsDistributor(address _distributor) external onlyOwner {
        require(_distributor != address(0), "Invalid address");
        rewardsDistributor = _distributor;
    }

    // ============ View Functions ============

    /**
     * @notice Get the locked odds for a match (fixed at seeding time)
     * @dev These odds NEVER change after seeding, even as bets come in
     * @param roundId The round ID
     * @param matchIndex The match index (0-9)
     * @return homeOdds Home win odds (e.g., 1.5e18 = 1.5x)
     * @return awayOdds Away win odds
     * @return drawOdds Draw odds
     * @return locked Whether odds are locked
     */
    function getLockedOdds(uint256 roundId, uint256 matchIndex)
        external
        view
        returns (
            uint256 homeOdds,
            uint256 awayOdds,
            uint256 drawOdds,
            bool locked
        )
    {
        RoundAccounting storage accounting = roundAccounting[roundId];
        LockedOdds storage odds = accounting.lockedMatchOdds[matchIndex];

        return (odds.homeOdds, odds.awayOdds, odds.drawOdds, odds.locked);
    }

    /**
     * @notice Get preview of match odds before any bets (for frontend)
     * @dev Shows initial seeded odds for a match based on team matchup
     * @param roundId The round ID
     * @param matchIndex The match index (0-9)
     * @return homeOdds Home win odds (e.g., 1.2e18 = 1.2x)
     * @return awayOdds Away win odds
     * @return drawOdds Draw odds
     */
    function previewMatchOdds(uint256 roundId, uint256 matchIndex)
        external
        view
        returns (
            uint256 homeOdds,
            uint256 awayOdds,
            uint256 drawOdds
        )
    {
        RoundAccounting storage accounting = roundAccounting[roundId];
        MatchPool storage pool = accounting.matchPools[matchIndex];

        // Use CURRENT pool state (includes all bets placed so far)
        uint256 homePool = pool.homeWinPool;
        uint256 awayPool = pool.awayWinPool;
        uint256 drawPool = pool.drawPool;
        uint256 totalPool = pool.totalPool;

        // If not seeded yet, calculate what the initial odds would be
        if (totalPool == 0) {
            (homePool, awayPool, drawPool) = _calculateMatchSeeds(roundId, matchIndex);
            totalPool = homePool + awayPool + drawPool;
        }

        // Apply virtual liquidity to dampen price impact
        uint256 virtualLiquidity = SEED_PER_MATCH * VIRTUAL_LIQUIDITY_MULTIPLIER; // 3000 LEAGUE virtual

        // Add virtual liquidity to each pool
        uint256 virtualHomePool = homePool + (virtualLiquidity / 3);
        uint256 virtualAwayPool = awayPool + (virtualLiquidity / 3);
        uint256 virtualDrawPool = drawPool + (virtualLiquidity / 3);
        uint256 virtualTotalPool = virtualHomePool + virtualAwayPool + virtualDrawPool;

        // Calculate dampened market odds
        homeOdds = (virtualTotalPool * 1e18) / virtualHomePool;
        awayOdds = (virtualTotalPool * 1e18) / virtualAwayPool;
        drawOdds = (virtualTotalPool * 1e18) / virtualDrawPool;

        return (homeOdds, awayOdds, drawOdds);
    }

    /**
     * @notice Get odds for all 10 matches in a round
     * @param roundId The round ID
     * @return homeOdds Array of home win odds (1e18 scale)
     * @return awayOdds Array of away win odds (1e18 scale)
     * @return drawOdds Array of draw odds (1e18 scale)
     */
    function getAllMatchOdds(uint256 roundId)
        external
        view
        returns (
            uint256[10] memory homeOdds,
            uint256[10] memory awayOdds,
            uint256[10] memory drawOdds
        )
    {
        RoundAccounting storage accounting = roundAccounting[roundId];

        for (uint256 i = 0; i < 10; i++) {
            MatchPool storage pool = accounting.matchPools[i];

            uint256 homePool = pool.homeWinPool;
            uint256 awayPool = pool.awayWinPool;
            uint256 drawPool = pool.drawPool;
            uint256 totalPool = pool.totalPool;

            // If not seeded yet, calculate initial odds
            if (totalPool == 0) {
                (homePool, awayPool, drawPool) = _calculateMatchSeeds(roundId, i);
                totalPool = homePool + awayPool + drawPool;
            }

            // Apply virtual liquidity to dampen price impact
            uint256 virtualLiquidity = SEED_PER_MATCH * VIRTUAL_LIQUIDITY_MULTIPLIER; // 3000 LEAGUE

            // Add virtual liquidity to each pool
            uint256 virtualHomePool = homePool + (virtualLiquidity / 3);
            uint256 virtualAwayPool = awayPool + (virtualLiquidity / 3);
            uint256 virtualDrawPool = drawPool + (virtualLiquidity / 3);
            uint256 virtualTotalPool = virtualHomePool + virtualAwayPool + virtualDrawPool;

            // Calculate dampened odds
            homeOdds[i] = (virtualTotalPool * 1e18) / virtualHomePool;
            awayOdds[i] = (virtualTotalPool * 1e18) / virtualAwayPool;
            drawOdds[i] = (virtualTotalPool * 1e18) / virtualDrawPool;
        }
    }

    /**
     * @notice Get current parlay multiplier for a bet (preview before placing)
     * @dev Shows users what multiplier they'll get with FOMO tier visibility
     * @param roundId The round ID
     * @param matchIndices Array of match indices
     * @param numLegs Number of legs in the parlay
     * @return currentMultiplier The multiplier they would get now (1e18 scale)
     * @return currentTier Current count-based tier (1-5)
     * @return parlaysLeftInTier How many parlays left in current tier
     * @return nextTierMultiplier What multiplier drops to in next tier
     */
    function getCurrentParlayMultiplier(
        uint256 roundId,
        uint256[] calldata matchIndices,
        uint256 numLegs
    )
        external
        view
        returns (
            uint256 currentMultiplier,
            uint256 currentTier,
            uint256 parlaysLeftInTier,
            uint256 nextTierMultiplier
        )
    {
        if (numLegs == 1) {
            return (1e18, 0, 0, 0); // Single bets don't use tiers
        }

        RoundAccounting storage accounting = roundAccounting[roundId];
        uint256 parlayCount = accounting.parlayCount;

        // Determine current tier
        if (parlayCount < COUNT_TIER_1) {
            currentTier = 1;
            parlaysLeftInTier = COUNT_TIER_1 - parlayCount;
            nextTierMultiplier = COUNT_MULT_TIER_2;
        } else if (parlayCount < COUNT_TIER_2) {
            currentTier = 2;
            parlaysLeftInTier = COUNT_TIER_2 - parlayCount;
            nextTierMultiplier = COUNT_MULT_TIER_3;
        } else if (parlayCount < COUNT_TIER_3) {
            currentTier = 3;
            parlaysLeftInTier = COUNT_TIER_3 - parlayCount;
            nextTierMultiplier = COUNT_MULT_TIER_4;
        } else if (parlayCount < COUNT_TIER_4) {
            currentTier = 4;
            parlaysLeftInTier = COUNT_TIER_4 - parlayCount;
            nextTierMultiplier = COUNT_MULT_TIER_5;
        } else {
            currentTier = 5;
            parlaysLeftInTier = 0; // Final tier
            nextTierMultiplier = COUNT_MULT_TIER_5;
        }

        // Calculate actual multiplier using layered model
        currentMultiplier = _getParlayMultiplierDynamicPreview(
            matchIndices,
            roundId,
            numLegs
        );

        return (currentMultiplier, currentTier, parlaysLeftInTier, nextTierMultiplier);
    }

    function getMatchPoolData(uint256 roundId, uint256 matchIndex)
        external
        view
        returns (
            uint256 homePool,
            uint256 awayPool,
            uint256 drawPool,
            uint256 totalPool
        )
    {
        MatchPool storage pool = roundAccounting[roundId].matchPools[matchIndex];
        return (pool.homeWinPool, pool.awayWinPool, pool.drawPool, pool.totalPool);
    }

    function getBet(uint256 betId)
        external
        view
        returns (
            address bettor,
            uint256 roundId,
            uint256 amount,
            uint256 bonus,
            uint256 lockedMultiplier,
            bool settled,
            bool claimed
        )
    {
        Bet storage bet = bets[betId];
        return (
            bet.bettor,
            bet.roundId,
            bet.amount,
            bet.bonus,
            bet.lockedMultiplier,
            bet.settled,
            bet.claimed
        );
    }

    function getUserBets(address user) external view returns (uint256[] memory) {
        return userBets[user];
    }

    function getBetPredictions(uint256 betId) external view returns (Prediction[] memory) {
        return bets[betId].predictions;
    }

    /**
     * @notice Get round accounting data including parlay count
     * @param roundId The round ID
     * @return totalBetVolume Total amount bet in the round (including bonuses)
     * @return totalReservedForWinners Total amount reserved for winners
     * @return protocolRevenueShare Protocol's revenue share
     * @return seasonRevenueShare Season pool's revenue share
     * @return parlayCount Number of parlays placed in the round
     */
    function getRoundAccounting(uint256 roundId)
        external
        view
        returns (
            uint256 totalBetVolume,
            uint256 totalReservedForWinners,
            uint256 protocolRevenueShare,
            uint256 seasonRevenueShare,
            uint256 parlayCount
        )
    {
        RoundAccounting storage accounting = roundAccounting[roundId];
        return (
            accounting.totalBetVolume,
            accounting.totalReservedForWinners,
            accounting.protocolRevenueShare,
            accounting.seasonRevenueShare,
            accounting.parlayCount
        );
    }

    /**
     * @notice Calculate current market odds for a match outcome
     * @param roundId The round ID
     * @param matchIndex The match index (0-9)
     * @param outcome The outcome (1=HOME, 2=AWAY, 3=DRAW)
     * @return odds The current market odds in 1e18 scale (e.g., 2.5e18 = 2.5x)
     */
    function getMarketOdds(uint256 roundId, uint256 matchIndex, uint8 outcome)
        external
        view
        returns (uint256 odds)
    {
        MatchPool storage pool = roundAccounting[roundId].matchPools[matchIndex];

        uint256 winningPool = _getWinningPoolAmount(pool, outcome);
        uint256 losingPool = pool.totalPool - winningPool;

        if (winningPool == 0) return 3e18; // Fallback: fair VRF odds (33.33% = 3.0x)

        // Apply virtual liquidity to dampen price impact
        // This makes pools behave like they have VIRTUAL_LIQUIDITY_MULTIPLIER times more depth
        uint256 virtualLiquidity = SEED_PER_MATCH * VIRTUAL_LIQUIDITY_MULTIPLIER; // 3000 LEAGUE virtual

        // Add virtual liquidity proportionally (33.33% per outcome for balanced distribution)
        uint256 virtualWinningPool = winningPool + (virtualLiquidity / 3);
        uint256 virtualLosingPool = losingPool + (virtualLiquidity * 2 / 3);

        // Calculate odds with dampened pools
        uint256 distributedLosingPool = (virtualLosingPool * WINNER_SHARE) / 10000;
        odds = 1e18 + (distributedLosingPool * 1e18) / virtualWinningPool;

        return odds;
    }

    /**
     * @notice Preview bet payout (including parlay multiplier)
     * @dev Uses locked multiplier from bet placement for accurate preview
     */
    function previewBetPayout(uint256 betId)
        external
        view
        returns (bool won, uint256 basePayout, uint256 finalPayout, uint256 parlayMultiplier)
    {
        (won, basePayout, finalPayout) = _calculateBetPayout(betId);
        parlayMultiplier = bets[betId].lockedMultiplier;  // Use locked multiplier
        return (won, basePayout, finalPayout, parlayMultiplier);
    }

    // ============ Season Reward Management (H-2 Fix) ============

    /**
     * @notice Distribute season rewards to specified address
     * @param recipient Address to receive season rewards
     * @param amount Amount to distribute
     * @dev Only owner can distribute season rewards
     */
    function distributeSeasonRewards(address recipient, uint256 amount) external onlyOwner {
        require(amount <= seasonRewardPool, "Amount exceeds season pool");
        require(recipient != address(0), "Invalid recipient");

        seasonRewardPool -= amount;
        leagueToken.safeTransfer(recipient, amount);

        emit SeasonRewardsDistributed(recipient, amount);
    }

    /**
     * @notice Emergency recovery of season pool funds
     * @param amount Amount to recover
     * @dev Only owner - use if season never completes or predictor contract fails
     */
    function emergencyRecoverSeasonPool(uint256 amount) external onlyOwner {
        require(amount <= seasonRewardPool, "Amount exceeds season pool");

        seasonRewardPool -= amount;
        leagueToken.safeTransfer(owner(), amount);

        emit SeasonPoolRecovered(owner(), amount);
    }

    // ============ Events for Season Reward Management ============

    event SeasonRewardsDistributed(address indexed recipient, uint256 amount);
    event SeasonPoolRecovered(address indexed owner, uint256 amount);
}
, there are many features to look at, Locked odds (1.25x - 1.95x range)
Odds-weighted allocation (Solidity's fund splitting logic)
LP share system
Risk management caps
Advanced profit tracking
