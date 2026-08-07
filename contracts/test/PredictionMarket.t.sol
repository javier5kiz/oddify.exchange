// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PredictionMarket.sol";
import "../src/MarketFactory.sol";

/**
 * Mock USDC for testing (6 decimals like real USDC)
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

        usdc.mint(alice, 100000 * 1e6);
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
        vm.startPrank(alice);
        bytes32 oracleId = keccak256("BTCUSDT-65000-UP");
        address marketAddr = factory.createMarket("Will BTC be above $65000?", oracleId, block.timestamp + 3600, block.timestamp + 3660, true);

        PredictionMarket market = PredictionMarket(marketAddr);

        usdc.approve(marketAddr, 1000 * 1e6);
        market.addInitialLiquidity(1000 * 1e6);

        // USDC has 6 decimals, reserves use 18 (PRECISION)
        // 1000 USDC = 1000 * 1e6 = 1e9, reserve = 1e9 * 1e18 = 1e27
        assertEq(market.totalLpShares(), 1000 * 1e18, "LP shares should be 1000");
        assertEq(market.yesReserve(), 1000 * 1e6 * 1e18, "YES reserve should match");
        assertEq(market.noReserve(), 1000 * 1e6 * 1e18, "NO reserve should match");
        assertEq(market.k(), (1000 * 1e6 * 1e18) * (1000 * 1e6 * 1e18), "k should be reserve^2");
        vm.stopPrank();
    }

    function test_BuyYesPushesYesPriceUp() public {
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

        uint256 priceBefore = market.getYesPrice();
        assertEq(priceBefore, 5e17, "Initial YES price should be 50%"); // 0.5 * 1e18

        market.buyShares(PredictionMarket.Outcome.YES, 100 * 1e6, 0);

        uint256 priceAfter = market.getYesPrice();
        assertGt(priceAfter, priceBefore, "YES price should INCREASE after buying YES");

        // Bob should have YES shares
        assertGt(market.yesBalances(bob), 0, "Bob should have YES shares");
        vm.stopPrank();
    }

    function test_BuyNoPushesNoPriceUp() public {
        vm.startPrank(alice);
        bytes32 oracleId = keccak256("ETHUSDT-3500-UP");
        address marketAddr = factory.createMarket("Will ETH be above $3500?", oracleId, block.timestamp + 3600, block.timestamp + 3660, true);
        PredictionMarket market = PredictionMarket(marketAddr);
        usdc.approve(marketAddr, type(uint256).max);
        market.addInitialLiquidity(1000 * 1e6);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(marketAddr, type(uint256).max);

        uint256 noPriceBefore = market.getNoPrice();
        assertEq(noPriceBefore, 5e17, "Initial NO price should be 50%");

        market.buyShares(PredictionMarket.Outcome.NO, 100 * 1e6, 0);

        uint256 noPriceAfter = market.getNoPrice();
        assertGt(noPriceAfter, noPriceBefore, "NO price should INCREASE after buying NO");

        // YES price should DECREASE (inverse)
        uint256 yesPriceAfter = market.getYesPrice();
        assertLt(yesPriceAfter, 5e17, "YES price should decrease when NO is bought");
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

        // Destructure the public struct getter (returns all 9 fields)
        (
            , // question
            , // oracleId
            , // expiryTime
            , // resolveTime
            PredictionMarket.MarketStatus status,
            , // winningOutcome
            , // isCryptoMarket
            , // creator
            // feeBps
        ) = market.market();

        assertEq(uint256(status), uint256(PredictionMarket.MarketStatus.RESOLVED));
    }

    function test_BothOutcomes() public {
        vm.startPrank(alice);
        bytes32 oracleId = keccak256("ETHUSDT-3500-UP");
        address marketAddr = factory.createMarket("Will ETH be above $3500?", oracleId, block.timestamp + 3600, block.timestamp + 3660, true);
        PredictionMarket market = PredictionMarket(marketAddr);
        usdc.approve(marketAddr, type(uint256).max);
        market.addInitialLiquidity(1000 * 1e6);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(marketAddr, type(uint256).max);

        // Buy YES
        market.buyShares(PredictionMarket.Outcome.YES, 100 * 1e6, 0);
        assertGt(market.yesBalances(bob), 0, "Bob should have YES shares");

        // Buy NO
        market.buyShares(PredictionMarket.Outcome.NO, 50 * 1e6, 0);
        assertGt(market.noBalances(bob), 0, "Bob should have NO shares");
        vm.stopPrank();
    }

    function test_SellShares() public {
        vm.startPrank(alice);
        bytes32 oracleId = keccak256("SOLUSDT-150-UP");
        address marketAddr = factory.createMarket("Will SOL be above $150?", oracleId, block.timestamp + 3600, block.timestamp + 3660, true);
        PredictionMarket market = PredictionMarket(marketAddr);
        usdc.approve(marketAddr, type(uint256).max);
        market.addInitialLiquidity(1000 * 1e6);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(marketAddr, type(uint256).max);

        // Buy YES
        market.buyShares(PredictionMarket.Outcome.YES, 100 * 1e6, 0);
        uint256 bobYesShares = market.yesBalances(bob);
        assertGt(bobYesShares, 0, "Bob should have YES shares");

        uint256 usdcBefore = usdc.balanceOf(bob);

        // Sell YES back
        market.sellShares(PredictionMarket.Outcome.YES, bobYesShares, 0);

        uint256 usdcAfter = usdc.balanceOf(bob);
        assertGt(usdcAfter, usdcBefore, "Bob should get USDC back");
        assertEq(market.yesBalances(bob), 0, "Bob should have 0 YES shares after selling");
        vm.stopPrank();
    }
}
