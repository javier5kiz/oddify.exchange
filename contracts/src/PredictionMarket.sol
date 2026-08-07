// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PredictionMarket
 * @dev AMM-based prediction market contract. Each market has YES/NO outcome tokens.
 *      Uses a constant-product AMM (x*y=k) for price discovery.
 *
 *      Price formula: P(YES) = noReserve / (yesReserve + noReserve)
 *      - When YES is bought, yesReserve decreases (YES more scarce) → P(YES) goes UP
 *      - When NO is bought, noReserve decreases (NO more scarce) → P(NO) goes UP
 *
 *      Settlement via Binance oracle (for crypto markets) or admin/UMA (for community markets).
 */
contract PredictionMarket {
    enum MarketStatus { ACTIVE, SETTLING, RESOLVED, CANCELLED }
    enum Outcome { YES, NO }

    struct Market {
        string question;
        bytes32 oracleId;
        uint256 expiryTime;
        uint256 resolveTime;
        MarketStatus status;
        Outcome winningOutcome;
        bool isCryptoMarket;
        address creator;
        uint256 feeBps;
    }

    uint256 public yesReserve;
    uint256 public noReserve;
    uint256 public k;

    mapping(address => uint256) public yesBalances;
    mapping(address => uint256) public noBalances;

    uint256 public totalYesSupply;
    uint256 public totalNoSupply;

    mapping(address => uint256) public lpShares;
    uint256 public totalLpShares;
    uint256 public lpCollateral;

    Market public market;
    address public factory;
    address public oracle;

    IERC20 public usdc;

    uint256 public constant PRECISION = 1e18;
    uint256 public constant FEE_DENOMINATOR = 10000;

    event SharesPurchased(address indexed buyer, Outcome outcome, uint256 usdcIn, uint256 sharesOut);
    event SharesSold(address indexed seller, Outcome outcome, uint256 sharesIn, uint256 usdcOut);
    event LiquidityAdded(address indexed provider, uint256 usdcAmount, uint256 lpShares);
    event LiquidityRemoved(address indexed provider, uint256 lpShares, uint256 usdcAmount);
    event MarketResolved(Outcome winningOutcome, uint256 yesPrice, uint256 noPrice);
    event WinningsClaimed(address indexed user, uint256 amount);
    event MarketCancelled();

    modifier onlyOracle() {
        require(msg.sender == oracle, "Not authorized oracle");
        _;
    }

    modifier onlyFactory() {
        require(msg.sender == factory, "Not factory");
        _;
    }

    modifier activeMarket() {
        require(market.status == MarketStatus.ACTIVE, "Market not active");
        require(block.timestamp < market.expiryTime, "Market expired");
        _;
    }

    constructor(
        address _usdc,
        string memory _question,
        bytes32 _oracleId,
        uint256 _expiryTime,
        uint256 _resolveTime,
        bool _isCryptoMarket,
        address _creator,
        uint256 _feeBps
    ) {
        usdc = IERC20(_usdc);
        factory = msg.sender;
        oracle = _creator;
        market = Market({
            question: _question,
            oracleId: _oracleId,
            expiryTime: _expiryTime,
            resolveTime: _resolveTime,
            status: MarketStatus.ACTIVE,
            winningOutcome: Outcome.YES,
            isCryptoMarket: _isCryptoMarket,
            creator: _creator,
            feeBps: _feeBps
        });
    }

    /**
     * @dev Seed the pool with equal YES and NO shares.
     *      USDC is held as collateral backing both sides.
     *      Initial price: 50/50 (yesReserve == noReserve).
     */
    function addInitialLiquidity(uint256 _usdcAmount) external {
        require(market.status == MarketStatus.ACTIVE, "Market not active");
        require(totalLpShares == 0, "Initial liquidity already provided");

        usdc.transferFrom(msg.sender, address(this), _usdcAmount);

        uint256 shares = _usdcAmount * PRECISION;
        yesReserve = shares;
        noReserve = shares;
        totalYesSupply = shares;
        totalNoSupply = shares;
        yesBalances[address(this)] = shares;
        noBalances[address(this)] = shares;
        k = shares * shares;
        lpCollateral = _usdcAmount;

        totalLpShares = 1000 * PRECISION;
        lpShares[msg.sender] = totalLpShares;

        emit LiquidityAdded(msg.sender, _usdcAmount, totalLpShares);
    }

    /**
     * @dev Buy YES or NO shares from the AMM pool.
     *      Uses constant product formula: k = yesReserve * noReserve
     *
     *      Buying YES: USDC goes to NO side, YES shares come out → YES price up
     *      sharesOut = yesReserve - k / (noReserve + usdcIn)
     *
     *      Buying NO: USDC goes to YES side, NO shares come out → NO price up
     *      sharesOut = noReserve - k / (yesReserve + usdcIn)
     */
    function buyShares(Outcome _outcome, uint256 _usdcIn, uint256 _minShares) external activeMarket {
        usdc.transferFrom(msg.sender, address(this), _usdcIn);

        uint256 usdcScaled = _usdcIn * PRECISION;
        uint256 sharesOut;

        if (_outcome == Outcome.YES) {
            uint256 newNoReserve = noReserve + usdcScaled;
            sharesOut = yesReserve - (k / newNoReserve);

            require(sharesOut >= _minShares, "Slippage exceeded");
            require(yesBalances[address(this)] >= sharesOut, "Insufficient YES in pool");

            yesReserve -= sharesOut;
            noReserve = newNoReserve;
            yesBalances[address(this)] -= sharesOut;
            yesBalances[msg.sender] += sharesOut;
        } else {
            uint256 newYesReserve = yesReserve + usdcScaled;
            sharesOut = noReserve - (k / newYesReserve);

            require(sharesOut >= _minShares, "Slippage exceeded");
            require(noBalances[address(this)] >= sharesOut, "Insufficient NO in pool");

            noReserve -= sharesOut;
            yesReserve = newYesReserve;
            noBalances[address(this)] -= sharesOut;
            noBalances[msg.sender] += sharesOut;
        }

        emit SharesPurchased(msg.sender, _outcome, _usdcIn, sharesOut);
    }

    /**
     * @dev Sell YES or NO shares back to the AMM pool.
     *      Reverse of buy: shares go back to pool, USDC comes out.
     */
    function sellShares(Outcome _outcome, uint256 _sharesIn, uint256 _minUsdc) external activeMarket {
        uint256 usdcOut;

        if (_outcome == Outcome.YES) {
            require(yesBalances[msg.sender] >= _sharesIn, "Insufficient YES shares");

            uint256 newYesReserve = yesReserve + _sharesIn;
            uint256 usdcScaled = noReserve - (k / newYesReserve);
            usdcOut = usdcScaled / PRECISION;

            require(usdcOut >= _minUsdc, "Slippage exceeded");

            yesBalances[msg.sender] -= _sharesIn;
            yesBalances[address(this)] += _sharesIn;
            yesReserve = newYesReserve;
            noReserve -= usdcScaled;
        } else {
            require(noBalances[msg.sender] >= _sharesIn, "Insufficient NO shares");

            uint256 newNoReserve = noReserve + _sharesIn;
            uint256 usdcScaled = yesReserve - (k / newNoReserve);
            usdcOut = usdcScaled / PRECISION;

            require(usdcOut >= _minUsdc, "Slippage exceeded");

            noBalances[msg.sender] -= _sharesIn;
            noBalances[address(this)] += _sharesIn;
            noReserve = newNoReserve;
            yesReserve -= usdcScaled;
        }

        uint256 fee = (usdcOut * market.feeBps) / FEE_DENOMINATOR;
        uint256 userAmount = usdcOut - fee;
        usdc.transfer(msg.sender, userAmount);

        emit SharesSold(msg.sender, _outcome, _sharesIn, userAmount);
    }

    /**
     * @dev YES implied probability (0 = 0%, 1e18 = 100%).
     *      P(YES) = noReserve / (yesReserve + noReserve)
     *      Fewer YES in pool (more bought) → higher P(YES).
     */
    function getYesPrice() external view returns (uint256) {
        return (noReserve * PRECISION) / (yesReserve + noReserve);
    }

    /**
     * @dev NO implied probability. P(NO) = 1 - P(YES).
     *      P(NO) = yesReserve / (yesReserve + noReserve)
     */
    function getNoPrice() external view returns (uint256) {
        return (yesReserve * PRECISION) / (yesReserve + noReserve);
    }

    /**
     * @dev Resolve the market. Only callable by the oracle after resolveTime.
     */
    function resolveMarket(Outcome _winningOutcome) external onlyOracle {
        require(block.timestamp >= market.resolveTime, "Cannot resolve yet");
        require(market.status == MarketStatus.ACTIVE, "Market not active");

        market.status = MarketStatus.RESOLVED;
        market.winningOutcome = _winningOutcome;

        emit MarketResolved(_winningOutcome, this.getYesPrice(), this.getNoPrice());
    }

    /**
     * @dev Claim winnings after market resolution.
     */
    function claimWinnings() external {
        require(market.status == MarketStatus.RESOLVED, "Market not resolved");

        Outcome winner = market.winningOutcome;
        uint256 userShares = (winner == Outcome.YES) ? yesBalances[msg.sender] : noBalances[msg.sender];
        require(userShares > 0, "No winning shares");

        uint256 totalWinningShares = (winner == Outcome.YES) ? totalYesSupply : totalNoSupply;
        uint256 totalPool = usdc.balanceOf(address(this));
        uint256 userPayout = (userShares * totalPool) / totalWinningShares;

        uint256 fee = (userPayout * market.feeBps) / FEE_DENOMINATOR;
        uint256 finalPayout = userPayout - fee;

        if (winner == Outcome.YES) {
            yesBalances[msg.sender] = 0;
        } else {
            noBalances[msg.sender] = 0;
        }

        usdc.transfer(msg.sender, finalPayout);
        emit WinningsClaimed(msg.sender, finalPayout);
    }

    function cancelMarket() external onlyFactory {
        market.status = MarketStatus.CANCELLED;
        emit MarketCancelled();
    }

    function withdrawLiquidity() external {
        require(market.status == MarketStatus.RESOLVED, "Market not resolved");
        require(lpShares[msg.sender] > 0, "No LP shares");

        uint256 userLpShares = lpShares[msg.sender];
        lpShares[msg.sender] = 0;

        uint256 totalPool = usdc.balanceOf(address(this));
        uint256 userShare = (userLpShares * totalPool) / totalLpShares;

        totalLpShares -= userLpShares;
        usdc.transfer(msg.sender, userShare);
    }

    function setOracle(address _oracle) external onlyFactory {
        oracle = _oracle;
    }
}

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}
