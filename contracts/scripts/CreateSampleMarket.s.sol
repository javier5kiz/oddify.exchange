// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MarketFactory.sol";
import "../src/PredictionMarket.sol";

/**
 * Create a sample crypto market after deploying the factory.
 * Usage: forge script script/CreateSampleMarket.s.sol:CreateSampleMarket --rpc-url $POLYGON_RPC --private-key $PRIVATE_KEY --broadcast
 */
contract CreateSampleMarket is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address factoryAddr = vm.envAddress("FACTORY_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        MarketFactory factory = MarketFactory(factoryAddr);

        // Create "Will BTC be above $65000 in 60 minutes?"
        string memory question = "Will BTC be above $65000 in 60 minutes?";
        bytes32 oracleId = keccak256(abi.encodePacked("BTCUSDT", uint256(65000), "UP", block.timestamp + 3600));
        uint256 expiryTime = block.timestamp + 3600; // 1 hour from now
        uint256 resolveTime = expiryTime + 60; // 1 min buffer

        address market = factory.createMarket(
            question,
            oracleId,
            expiryTime,
            resolveTime,
            true // isCryptoMarket
        );

        console.log("Sample market created:", market);

        // Seed the pool with initial liquidity (requires USDC approval first)
        // PredictionMarket(market).addInitialLiquidity(1000 * 1e6); // 1000 USDC
        // console.log("Initial liquidity added");

        vm.stopBroadcast();
    }
}
