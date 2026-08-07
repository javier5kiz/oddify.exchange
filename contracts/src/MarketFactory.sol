// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PredictionMarket.sol";

/**
 * @title MarketFactory
 * @dev Factory contract that deploys new prediction markets.
 *      Maintains a registry of all markets and manages the oracle role.
 */
contract MarketFactory {
    address public owner;
    address public oracle;          // backend oracle service (for crypto markets)
    address public usdc;           // USDC token address
    uint256 public defaultFeeBps;  // default platform fee (100 = 1%)

    address[] public allMarkets;
    mapping(bytes32 => address) public marketByOracleId;

    event MarketCreated(
        address indexed marketAddress,
        string question,
        bytes32 oracleId,
        uint256 expiryTime,
        bool isCryptoMarket,
        address creator
    );
    event OracleUpdated(address newOracle);
    event FeeUpdated(uint256 newFeeBps);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _usdc, uint256 _defaultFeeBps) {
        owner = msg.sender;
        usdc = _usdc;
        defaultFeeBps = _defaultFeeBps;
    }

    /**
     * @dev Create a new prediction market.
     * @param _question Human-readable market question
     * @param _oracleId Unique identifier for oracle resolution (e.g. "BTC-USDT-65000-1700000000")
     * @param _expiryTime When trading closes (unix timestamp)
     * @param _resolveTime When market can be settled (usually expiryTime + buffer)
     * @param _isCryptoMarket True for Binance oracle, false for admin/UMA
     */
    function createMarket(
        string memory _question,
        bytes32 _oracleId,
        uint256 _expiryTime,
        uint256 _resolveTime,
        bool _isCryptoMarket
    ) external returns (address) {
        require(_expiryTime > block.timestamp, "Expiry must be future");
        require(_resolveTime >= _expiryTime, "Resolve must be >= expiry");
        require(marketByOracleId[_oracleId] == address(0), "Market already exists");

        PredictionMarket market = new PredictionMarket(
            usdc,
            _question,
            _oracleId,
            _expiryTime,
            _resolveTime,
            _isCryptoMarket,
            msg.sender,
            defaultFeeBps
        );

        allMarkets.push(address(market));
        marketByOracleId[_oracleId] = address(market);

        emit MarketCreated(
            address(market),
            _question,
            _oracleId,
            _expiryTime,
            _isCryptoMarket,
            msg.sender
        );

        return address(market);
    }

    function setOracle(address _oracle) external onlyOwner {
        oracle = _oracle;
        emit OracleUpdated(_oracle);
    }

    function setFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 500, "Fee too high (max 5%)");
        defaultFeeBps = _feeBps;
        emit FeeUpdated(_feeBps);
    }

    function getMarketCount() external view returns (uint256) {
        return allMarkets.length;
    }

    function getAllMarkets() external view returns (address[] memory) {
        return allMarkets;
    }
}
