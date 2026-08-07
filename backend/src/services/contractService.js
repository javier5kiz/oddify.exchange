import { ethers } from 'ethers';

/**
 * ContractService — interacts with MarketFactory and PredictionMarket contracts on Polygon.
 * Used for on-chain order execution, market creation, and settlement.
 */

const FACTORY_ABI = [
  'function createMarket(string question, bytes32 oracleId, uint256 expiryTime, uint256 resolveTime, bool isCryptoMarket) returns (address)',
  'function allMarkets(uint256) view returns (address)',
  'function getMarketCount() view returns (uint256)',
  'function marketByOracleId(bytes32) view returns (address)',
  'function owner() view returns (address)',
  'function oracle() view returns (address)',
  'function setOracle(address)',
  'event MarketCreated(address indexed marketAddress, string question, bytes32 oracleId, uint256 expiryTime, bool isCryptoMarket, address creator)'
];

const MARKET_ABI = [
  'function buyShares(uint8 outcome, uint256 usdcIn, uint256 minShares)',
  'function sellShares(uint8 outcome, uint256 sharesIn, uint256 minUsdc)',
  'function addInitialLiquidity(uint256 usdcAmount)',
  'function getYesPrice() view returns (uint256)',
  'function getNoPrice() view returns (uint256)',
  'function resolveMarket(uint8 winningOutcome)',
  'function claimWinnings()',
  'function withdrawLiquidity()',
  'function yesReserve() view returns (uint256)',
  'function noReserve() view returns (uint256)',
  'function totalYesSupply() view returns (uint256)',
  'function totalNoSupply() view returns (uint256)',
  'function market() view returns (string question, bytes32 oracleId, uint256 expiryTime, uint256 resolveTime, uint8 status, uint8 winningOutcome, bool isCryptoMarket, address creator, uint256 feeBps)',
  'event SharesPurchased(address buyer, uint8 outcome, uint256 usdcIn, uint256 sharesOut)',
  'event SharesSold(address seller, uint8 outcome, uint256 sharesIn, uint256 usdcOut)',
  'event MarketResolved(uint8 winningOutcome, uint256 yesPrice, uint256 noPrice)',
  'event WinningsClaimed(address user, uint256 amount)'
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)'
];

export class ContractService {
  constructor() {
    this.rpcUrl = process.env.POLYGON_RPC || 'https://rpc-amoy.polygon.technology';
    this.factoryAddress = process.env.FACTORY_ADDRESS || '';
    this.usdcAddress = process.env.USDC_ADDRESS || '';
    this.privateKey = process.env.PRIVATE_KEY || '';

    // Read-only provider (for queries)
    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);

    // Signer (for executing transactions — backend oracle wallet)
    this.signer = this.privateKey
      ? new ethers.Wallet(this.privateKey, this.provider)
      : null;

    // Contract instances
    this.factory = this.factoryAddress
      ? new ethers.Contract(this.factoryAddress, FACTORY_ABI, this.signer || this.provider)
      : null;

    this.usdc = this.usdcAddress
      ? new ethers.Contract(this.usdcAddress, ERC20_ABI, this.signer || this.provider)
      : null;
  }

  /**
   * Create a market on-chain via the MarketFactory contract
   */
  async createMarketOnChain({ question, oracleId, expiryTime, resolveTime, isCryptoMarket }) {
    if (!this.factory || !this.signer) {
      throw new Error('Factory contract or signer not configured');
    }

    const oracleIdHash = ethers.id(oracleId);
    const tx = await this.factory.createMarket(
      question,
      oracleIdHash,
      expiryTime,
      resolveTime,
      isCryptoMarket
    );
    const receipt = await tx.wait();

    // Parse MarketCreated event
    const event = receipt.logs.find(log => {
      try {
        const parsed = this.factory.interface.parseLog(log);
        return parsed.name === 'MarketCreated';
      } catch { return false; }
    });

    if (event) {
      const parsed = this.factory.interface.parseLog(event);
      return {
        marketAddress: parsed.args.marketAddress,
        question: parsed.args.question,
        oracleId: parsed.args.oracleId,
        expiryTime: Number(parsed.args.expiryTime),
        txHash: tx.hash
      };
    }

    return { txHash: tx.hash };
  }

  /**
   * Get market contract instance
   */
  getMarketContract(marketAddress, useSigner = false) {
    return new ethers.Contract(
      marketAddress,
      MARKET_ABI,
      useSigner && this.signer ? this.signer : this.provider
    );
  }

  /**
   * Get on-chain market info
   */
  async getMarketInfo(marketAddress) {
    const market = this.getMarketContract(marketAddress);
    const [question, oracleId, expiryTime, resolveTime, status, winningOutcome, isCryptoMarket, creator, feeBps] = await market.market();
    const yesPrice = await market.getYesPrice();
    const noPrice = await market.getNoPrice();
    const yesReserve = await market.yesReserve();
    const noReserve = await market.noReserve();

    return {
      address: marketAddress,
      question,
      oracleId,
      expiryTime: Number(expiryTime),
      resolveTime: Number(resolveTime),
      status: ['ACTIVE', 'SETTLING', 'RESOLVED', 'CANCELLED'][status],
      winningOutcome: winningOutcome === 0 ? 'YES' : 'NO',
      isCryptoMarket,
      creator,
      feeBps: Number(feeBps),
      prices: {
        yes: Number(yesPrice) / 1e18,
        no: Number(noPrice) / 1e18
      },
      reserves: {
        yes: Number(yesReserve) / 1e18,
        no: Number(noReserve) / 1e18
      }
    };
  }

  /**
   * Resolve a crypto market using Binance oracle price.
   * Called by the backend oracle wallet.
   */
  async resolveMarket(marketAddress, winningOutcome) {
    if (!this.signer) throw new Error('Signer not configured — set PRIVATE_KEY');

    const market = this.getMarketContract(marketAddress, true);
    const outcomeEnum = winningOutcome === 'YES' ? 0 : 1;

    const tx = await market.resolveMarket(outcomeEnum);
    await tx.wait();

    console.log(`✅ Market ${marketAddress} resolved: ${winningOutcome}`);
    return { txHash: tx.hash, winningOutcome };
  }

  /**
   * Get all markets from the factory
   */
  async getAllMarkets() {
    if (!this.factory) return [];

    const count = await this.factory.getMarketCount();
    const markets = [];

    for (let i = 0; i < count; i++) {
      const addr = await this.factory.allMarkets(i);
      try {
        const info = await this.getMarketInfo(addr);
        markets.push(info);
      } catch (e) {
        console.error(`Failed to fetch market ${addr}:`, e.message);
      }
    }

    return markets;
  }

  /**
   * Set the oracle address (backend wallet that can resolve markets)
   */
  async setOracleAddress(oracleAddress) {
    if (!this.factory || !this.signer) throw new Error('Factory or signer not configured');
    const tx = await this.factory.setOracle(oracleAddress);
    await tx.wait();
    return { txHash: tx.hash };
  }

  /**
   * Check if user needs USDC approval before buying shares
   */
  async checkAndApproveUSDC(marketAddress, userAddress, amount) {
    if (!this.usdc) return { needsApproval: false };

    const allowance = await this.usdc.allowance(userAddress, marketAddress);
    if (allowance >= amount) {
      return { needsApproval: false, allowance: Number(allowance) };
    }

    return {
      needsApproval: true,
      message: 'User must approve USDC spending for this market',
      approveFunction: this.usdc.interface.encodeFunctionData('approve', [marketAddress, amount])
    };
  }

  /**
   * Get user's share balances for a market
   */
  async getUserPositions(marketAddress, userAddress) {
    const market = this.getMarketContract(marketAddress);
    // YES balance and NO balance are public mappings
    const yesBalance = await market.yesBalances(userAddress);
    const noBalance = await market.noBalances(userAddress);
    return {
      yes: Number(yesBalance) / 1e18,
      no: Number(noBalance) / 1e18
    };
  }
}
