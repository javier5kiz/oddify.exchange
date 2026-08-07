// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PredictionMarket.sol";
import "../src/MarketFactory.sol";

/**
 * Mock USDC for testing
 */
contract MockUSDC is IERC20 {
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function transfer(address to, uint256 amount) external override returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }
}

contract PredictionMarketTest is Test {
    MockUSDC usdc;
    MarketFactory factory;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        usdc = new MockUSDC();
        factory = new MarketFactory(address(usdc), 100); // 1% fee

        // Mint USDC to test accounts
        usdc.mint(alice, 100000 * 1e6); // 100k USDC
        usdc.mint(bob, 100000 * 1e6);
    }

    function test_CreateMarket() public {
        string memory question = "Will BTC be above $65000?";
        bytes32 oracleId = keccak256("BTCUSDT-65000-UP");
        uint256 expiry = block.timestamp + 3600;
        uint256 resolve = expiry + 60;

        address market = factory.createMarket(question, oracleId, expiry, resolve, true);
        assertTrue(market != address(0), "Market should be created");
        assertEq(factory.getMarketCount(), 1);
    }

    function test_AddLiquidity() public {
        // Create market as alice
        vm.startPrank(alice);
        string memory question = "Will BTC be above $65000?";
        bytes32 oracleId = keccak256("BTCUSDT-65000-UP");
        address marketAddr = factory.createMarket(question, oracleId, block.timestamp + 3600, block.timestamp + 3660, true);

        PredictionMarket market = PredictionMarket(marketAddr);

        // Approve USDC
        usdc.approve(marketAddr, 1000 * 1e6);

        // Add liquidity
        market.addInitialLiquidity(1000 * 1e6);

        assertEq(market.totalLpShares(), 1000 * 1e18, "LP shares should be 1000");
        assertEq(market.yesReserve(), 1000 * 1e18, "YES reserve should be 1000");
        assertEq(market.noReserve(), 1000 * 1e18, "NO reserve should be 1000");
        vm.stopPrank();
    }

    function test_BuyShares() public {
        // Setup: create market + add liquidity as alice
        vm.startPrank(alice);
        bytes32 oracleId = keccak256("BTCUSDT-65000-UP");
        address marketAddr = factory.createMarket("Will BTC be above $65000?", oracleId, block.timestamp + 3600, block.timestamp + 3660, true);
        PredictionMarket market = PredictionMarket(marketAddr);
        usdc.approve(marketAddr, type(uint256).max);
        market.addInitialLiquidity(1000 * 1e6);
        vm.stopPrank();

        // Bob buys YES shares
        vm.startPrank(bob);
        usdc.approve(marketAddr, type(uint256).max);
        uint256 yesPrice = market.getYesPrice();
        assertEq(yesPrice, 5e17, "Initial YES price should be 50%"); // 0.5 * 1e18

        market.buyShares(PredictionMarket.Outcome.YES, 100 * 1e6, 0);

        uint256 newYesPrice = market.getYesPrice();
        assertGt(newYesPrice, 5e17, "YES price should increase after buying YES");
        vm.stopPrank();
    }

    function test_ResolveMarket() public {
        vm.startPrank(alice);
        bytes32 oracleId = keccak256("BTCUSDT-65000-UP");
        address marketAddr = factory.createMarket("Will BTC be above $65000?", oracleId, block.timestamp + 3600, block.timestamp + 3660, true);
        PredictionMarket market = PredictionMarket(marketAddr);
        usdc.approve(marketAddr, type(uint256).max);
        market.addInitialLiquidity(1000 * 1e6);
        vm.stopPrank();

        // Fast forward to after resolveTime
        vm.warp(block.timestamp + 3661);

        // Oracle (alice) resolves
        vm.prank(alice);
        market.resolveMarket(PredictionMarket.Outcome.YES);

        assertEq(uint256(market.market().status), uint256(PredictionMarket.MarketStatus.RESOLVED));
    }
}
