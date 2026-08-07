// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MarketFactory.sol";

/**
 * Deploy MarketFactory to Polygon Amoy testnet.
 * Usage: forge script script/Deploy.s.sol:Deploy --rpc-url $POLYGON_RPC --private-key $PRIVATE_KEY --broadcast
 */
contract Deploy is Script {
    // USDC on Polygon Amoy testnet (replace with actual testnet USDC if available)
    // If no testnet USDC, deploy a mock USDC first
    address constant USDC_AMOY = 0x1c7D4B196Cb0C7B0d8F9F2C5C5C5C5C5C5C5C5C5; // placeholder — update after deployment
    uint256 constant FEE_BPS = 100; // 1%

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address usdc = vm.envOr("USDC_ADDRESS", USDC_AMOY);
        uint256 feeBps = vm.envOr("DEFAULT_FEE_BPS", FEE_BPS);

        vm.startBroadcast(deployerPrivateKey);

        MarketFactory factory = new MarketFactory(usdc, feeBps);
        console.log("MarketFactory deployed:", address(factory));
        console.log("Owner:", factory.owner());
        console.log("USDC:", usdc);
        console.log("Fee (bps):", feeBps);

        vm.stopBroadcast();
    }
}
