import { ethers } from 'ethers';
import { ContractService } from '../services/contractService.js';

/**
 * MarketManager — handles market lifecycle, creation, and settlement.
 * Works with both in-memory cache (dev) and on-chain contracts (production).
 */
export class MarketManager {
  constructor(oracle, contracts = null) {
    this.oracle = oracle;
    this.contracts = contracts || new ContractService();
    this.markets = new Map();
    this.marketId = 1;

    // Register oracle listener for auto-settlement
    this.oracle.onPriceUpdate((ticker) => {
      this.checkCryptoMarketSettlements(ticker);
    });
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
      // AMM state (in-memory mirror)
      yesReserve: 1000,
      noReserve: 1000,
      k: 1000000,
      // On-chain address (set after contract creation)
      contractAddress: null,
      // Price history
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
        // Continue with off-chain fallback
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

  getPrices(marketId) {
    const m = this.markets.get(String(marketId));
    if (!m) return null;
    const total = m.yesReserve + m.noReserve;
    return {
      yes: m.yesReserve / total,
      no: m.noReserve / total,
      yesPrice: m.yesReserve / total,
      noPrice: m.noReserve / total
    };
  }

  buyShares(marketId, outcome, usdcAmount) {
    const m = this.markets.get(String(marketId));
    if (!m) throw new Error('Market not found');
    if (m.status !== 'ACTIVE') throw new Error('Market not active');
    if (Date.now() > m.expiryTime) throw new Error('Market expired');

    let sharesOut;
    if (outcome === 'YES') {
      const newYesReserve = m.yesReserve + usdcAmount;
      sharesOut = (1000 * (newYesReserve - m.yesReserve)) / newYesReserve;
      m.yesReserve = newYesReserve - sharesOut;
      m.noReserve += usdcAmount;
    } else {
      const newNoReserve = m.noReserve + usdcAmount;
      sharesOut = (1000 * (newNoReserve - m.noReserve)) / newNoReserve;
      m.noReserve = newNoReserve - sharesOut;
      m.yesReserve += usdcAmount;
    }
    m.k = m.yesReserve * m.noReserve;

    const total = m.yesReserve + m.noReserve;
    m.priceHistory.push({
      time: Date.now(),
      yesPrice: m.yesReserve / total,
      noPrice: m.noReserve / total
    });

    return { sharesOut, market: m };
  }

  /**
   * Check expired crypto markets and settle them via Binance oracle.
   * If contract service is configured, also settles on-chain.
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

      // Settle on-chain if contract exists
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
