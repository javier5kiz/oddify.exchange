# Smart Contract Deployment Guide

## Prerequisites

1. **Install Foundry** on your VPS:
```bash
curl -L https://foundry.paradigm.xyz | bash
source ~/.bashrc
foundryup
```

2. **Get testnet MATIC** from the [Polygon Amoy Faucet](https://faucet.polygon.technology/)

3. **Clone the repo**:
```bash
git clone https://github.com/javier5kiz/oddify.exchange.git
cd oddify.exchange/contracts
forge install foundry-rs/forge-std
```

## Deploy to Polygon Amoy Testnet

### Step 1: Set environment variables
```bash
export PRIVATE_KEY=0xYOUR_PRIVATE_KEY
export POLYGON_RPC=https://rpc-amoy.polygon.technology
export USDC_ADDRESS=0xYOUR_USDC_ADDRESS  # see Step 2
export DEFAULT_FEE_BPS=100  # 1% fee
```

### Step 2: Deploy a mock USDC (testnet only)

Since Polygon Amoy doesn't have a real USDC, deploy a simple ERC20:

```bash
# Create a simple USDC mock
forge create src/MockUSDC.sol:MockUSDC \
  --rpc-url $POLYGON_RPC \
  --private-key $PRIVATE_KEY

# Note the deployed address, then set it:
export USDC_ADDRESS=0xDEPLOYED_USDC_ADDRESS

# Mint some test USDC to your wallet
cast send $USDC_ADDRESS "mint(address,uint256)" \
  YOUR_WALLET_ADDRESS 1000000000000 \
  --rpc-url $POLYGON_RPC \
  --private-key $PRIVATE_KEY
```

### Step 3: Deploy MarketFactory

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $POLYGON_RPC \
  --private-key $PRIVATE_KEY \
  --broadcast

# Note the MarketFactory address from the output:
# "MarketFactory deployed: 0x..."
export FACTORY_ADDRESS=0xDEPLOYED_FACTORY_ADDRESS
```

### Step 4: Create a sample market

```bash
export FACTORY_ADDRESS=0xYOUR_FACTORY_ADDRESS
forge script script/CreateSampleMarket.s.sol:CreateSampleMarket \
  --rpc-url $POLYGON_RPC \
  --private-key $PRIVATE_KEY \
  --broadcast
```

### Step 5: Verify on the explorer

Go to [Polygon Amoy Explorer](https://www.oklink.com/amoy) and search for your factory address.

## Deploy to Polygon Mainnet (later)

Same steps but:
```bash
export POLYGON_RPC=https://polygon-rpc.com
# Use real USDC: 0x3c499c542cEF5E3811e1192ce70d8cc03d5c3359
export USDC_ADDRESS=0x3c499c542cEF5E3811e1192ce70d8cc03d5c3359
# Use a funded mainnet wallet
export PRIVATE_KEY=0xYOUR_MAINNET_KEY
```

## Test Results

```
Ran 7 tests: 7 passed, 0 failed
✓ test_AddLiquidity        — Pool seeded with 1000 USDC, 50/50 prices
✓ test_BuyYesPushesYesPriceUp — Buying YES increases YES price (0.50 → 0.55)
✓ test_BuyNoPushesNoPriceUp  — Buying NO increases NO price (0.50 → 0.55)
✓ test_BothOutcomes          — User can hold both YES and NO simultaneously
✓ test_SellShares            — Selling shares returns USDC to user
✓ test_ResolveMarket         — Oracle resolves market after expiry
✓ test_CreateMarket          — Factory creates markets correctly
```

## Contract Addresses (fill after deployment)

| Contract | Amoy Testnet | Mainnet |
|----------|-------------|---------|
| USDC | 0x... | 0x3c499c542cEF5E3811e1192ce70d8cc03d5c3359 |
| MarketFactory | 0x... | 0x... |
| Sample Market | 0x... | 0x... |
