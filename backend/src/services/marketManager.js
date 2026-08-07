import { ethers } from 'ethers';
import { ContractService } from '../services/contractService.js';

/**
 * MarketManager — handles market lifecycle, creation, and settlement.
 * Works with both in-memory cache (dev) and on-chain contracts (production).
 *
 * AMM price formula (matches smart contract):
 *   P(YES) = noReserve / (yesReserve + noReserve)
 *   P(NO)  = yesReserve / (yesReserve + noReserve)
 *
 * Buy YES: USDC → NO side, YES shares come out → YES price UP
 *   newNoReserve = noReserve + usdcAmount
 *   sharesOut = yesReserve - k / newNoReserve
 *
 * Buy NO: USDC → YES side, NO shares come out → NO price UP
 *   newYesReserve = yesReserve + usdcAmount
 *   sharesOut = noReserve - k / newYesReserve
 */
export class MarketManager {
  constructor(oracle, contracts = null) {
    this.oracle = oracle;
    this.contracts = contracts || new ContractService();
    this.markets = new Map();
    this.marketId = 1;

    // Seed a demo market so the frontend isn't empty on first deploy
    this._seedDemoMarkets();

    // Register oracle listener for auto-settlement
    this.oracle.onPriceUpdate((ticker) => {
      this.checkCryptoMarketSettlements(ticker);
    });
  }

  _seedDemoMarkets() {
    const now = Date.now();
    const markets = [
      {
        question: 'Will BTC be above $65,000 in 1 hour?',
        symbol: 'BTCUSDT',
        strikePrice: 65000,
        direction: 'UP',
        expiryMinutes: 60,
        isCryptoMarket: true,
      },
      {
        question: 'Will ETH be above $3,500 in 30 minutes?',
        symbol: 'ETHUSDT',
        strikePrice: 3500,
        direction: 'UP',
        expiryMinutes: 30,
        isCryptoMarket: true,
      },
      {
        question: 'Will SOL be above $150 in 2 hours?',
        symbol: 'SOLUSDT',
        strikePrice: 150,
        direction: 'UP',
        expiryMinutes: 120,
        isCryptoMarket: true,
      },
    ];

    for (const m of markets) {
      const id = this.marketId++;
      const expiryTime = now + (m.expiryMinutes * 60 * 1000);
      this.markets.set(String(id), {
        id: String(id),
        question: m.question,
        symbol: m.symbol,
        strikePrice: m.strikePrice,
        direction: m.direction,
        isCryptoMarket: m.isCryptoMarket,
        creator: '0x0000000000000000000000000000000000000000',
        status: 'ACTIVE',
        createdAt: now,
        expiryTime,
        resolveTime: expiryTime + 60000,
        oracleId: `${m.symbol}-${m.strikePrice}-${m.direction}`,
        // AMM state — 1000 USDC initial liquidity on each side
        yesReserve: 1000,
        noReserve: 1000,
        k: 1000000,
        contractAddress: null,
        priceHistory: [{ time: now, yesPrice: 0.5, noPrice: 0.5 }],
      });
    }
  }

  /**
   * Create a new prediction market (on-chain + in-memory cache)
   */
  async createMarket({ question, symbol, strikePrice, direction, expiryMinutes, isCryptoMarket, creator }) {
    const id = this.marketId++;
    const now = Date.now();
    const expiryTime = now + (expiryMinutes * 60 * 1000);
    const resolveTime = expiryTime + (60 * 1000);

    const oracleId = `${symbol}-${strikePrice}-${direction}-${Math.floor(expiryTime / 1000)}`;

    const market = {
      id: String(id),
      question,
      symbol: symbol?.toUpperCase(),
      strikePrice,
      direction,
      isCryptoMarket,
      creator,
      status: 'ACTIVE',
      createdAt: now,
      expiryTime,
      resolveTime,
      oracleId,
      yesReserve: 1000,
      noReserve: 1000,
      k: 1000000,
      contractAddress: null,
      priceHistory: [{ time: now, yesPrice: 0.5, noPrice: 0.5 }]
    };

    // Try to create on-chain if contract service is configured
    if (this.contracts?.factory && this.contracts?.signer) {
      try {
        const onChainResult = await this.contracts.createMarketOnChain({
          question,
          oracleId,
          expiryTime: Math.floor(expiryTime / 1000),
          resolveTime: Math.floor(resolveTime / 1000),
          isCryptoMarket
        });
        market.contractAddress = onChainResult.marketAddress || null;
        console.log(`📋 Market created on-chain: ${market.contractAddress}`);
      } catch (e) {
        console.error('On-chain market creation failed:', e.message);
      }
    }

    this.markets.set(String(id), market);
    return market;
  }

  getActiveMarkets() {
    return Array.from(this.markets.values()).filter(m => m.status === 'ACTIVE');
  }

  getMarket(id) {
    return this.markets.get(String(id));
  }

  /**
   * AMM price — matches smart contract formula.
   * P(YES) = noReserve / (yesReserve + noReserve)
   * Buying YES reduces yesReserve → P(YES) goes UP.
   */
  getPrices(marketId) {
    const m = this.markets.get(String(marketId));
    if (!m) return null;
    const total = m.yesReserve + m.noReserve;
    if (total === 0) return { yes: 0.5, no: 0.5, yesPrice: 0.5, noPrice: 0.5 };
    return {
      yes: m.noReserve / total,
      no: m.yesReserve / total,
      yesPrice: m.noReserve / total,
      noPrice: m.yesReserve / total
    };
  }

  /**
   * Buy shares from the AMM using constant product formula (k = yesReserve * noReserve).
   * Buying YES: USDC goes to NO side, YES shares come out.
   * Buying NO: USDC goes to YES side, NO shares come out.
   */
  buyShares(marketId, outcome, usdcAmount) {
    const m = this.markets.get(String(marketId));
    if (!m) throw new Error('Market not found');
    if (m.status !== 'ACTIVE') throw new Error('Market not active');
    if (Date.now() > m.expiryTime) throw new Error('Market expired');

    let sharesOut;

    if (outcome === 'YES') {
      // USDC added to NO side, YES shares come out
      const newNoReserve = m.noReserve + usdcAmount;
      const newYesReserve = m.k / newNoReserve;
      sharesOut = m.yesReserve - newYesReserve;
      m.yesReserve = newYesReserve;
      m.noReserve = newNoReserve;
    } else {
      // USDC added to YES side, NO shares come out
      const newYesReserve = m.yesReserve + usdcAmount;
      const newNoReserve = m.k / newYesReserve;
      sharesOut = m.noReserve - newNoReserve;
      m.yesReserve = newYesReserve;
      m.noReserve = newNoReserve;
    }

    m.k = m.yesReserve * m.noReserve;

    const total = m.yesReserve + m.noReserve;
    m.priceHistory.push({
      time: Date.now(),
      yesPrice: m.noReserve / total,
      noPrice: m.yesReserve / total
    });

    // Keep only last 100 price points
    if (m.priceHistory.length > 100) {
      m.priceHistory = m.priceHistory.slice(-100);
    }

    return { sharesOut, market: m };
  }

  /**
   * Check expired crypto markets and settle them via Binance oracle.
   */
  async checkCryptoMarketSettlements(ticker) {
    for (const [id, m] of this.markets) {
      if (m.status !== 'ACTIVE' || !m.isCryptoMarket) continue;
      if (Date.now() < m.expiryTime) continue;

      const currentPrice = this.oracle.getPrice(m.symbol);
      if (!currentPrice) continue;

      let winningOutcome;
      if (m.direction === 'UP') {
        winningOutcome = currentPrice >= m.strikePrice ? 'YES' : 'NO';
      } else {
        winningOutcome = currentPrice <= m.strikePrice ? 'YES' : 'NO';
      }

      m.status = 'RESOLVED';
      m.winningOutcome = winningOutcome;
      m.resolvedPrice = currentPrice;
      m.resolvedAt = Date.now();

      console.log(`📊 Market ${id} resolved: ${winningOutcome} (price: $${currentPrice} vs strike: $${m.strikePrice})`);

      if (m.contractAddress && this.contracts?.signer) {
        try {
          await this.contracts.resolveMarket(m.contractAddress, winningOutcome);
          console.log(`✅ Market ${id} settled on-chain`);
        } catch (e) {
          console.error(`❌ On-chain settlement failed for market ${id}:`, e.message);
        }
      }
    }
  }

  resolveCommunityMarket(marketId, winningOutcome) {
    const m = this.markets.get(String(marketId));
    if (!m) throw new Error('Market not found');
    if (m.isCryptoMarket) throw new Error('Use auto-settlement for crypto markets');
    if (m.status !== 'ACTIVE') throw new Error('Market not active');

    m.status = 'RESOLVED';
    m.winningOutcome = winningOutcome;
    m.resolvedAt = Date.now();

    return m;
  }

  getMarketsByType(isCrypto) {
    return Array.from(this.markets.values()).filter(m => m.isCryptoMarket === isCrypto && m.status === 'ACTIVE');
  }
}
