// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MarketFactory.sol";
import "../src/MockUSDC.sol";

contract DeployLocal is Script {
    function run() external {
        uint256 deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        
        vm.startBroadcast(deployerPrivateKey);
        
        MockUSDC usdc = new MockUSDC();
        console.log("USDC deployed:", address(usdc));
        
        usdc.mint(msg.sender, 1000000000000);
        
        MarketFactory factory = new MarketFactory(address(usdc), 100);
        console.log("MarketFactory deployed:", address(factory));
        
        vm.stopBroadcast();
    }
}
