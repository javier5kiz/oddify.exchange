/**
 * MarketManager — handles market lifecycle, creation, and settlement.
 * Interfaces with the MarketFactory smart contract on Polygon and the Binance oracle.
 */
export class MarketManager {
  constructor(oracle) {
    this.oracle = oracle;
    this.markets = new Map(); // in-memory cache (backed by DB in production)
    this.marketId = 1;

    // Register oracle listener for auto-settlement of crypto markets
    this.oracle.onPriceUpdate((ticker) => {
      this.checkCryptoMarketSettlements(ticker);
    });
  }

  /**
   * Create a new prediction market
   */
  createMarket({ question, symbol, strikePrice, direction, expiryMinutes, isCryptoMarket, creator }) {
    const id = this.marketId++;
    const now = Date.now();
    const expiryTime = now + (expiryMinutes * 60 * 1000);
    const resolveTime = expiryTime + (60 * 1000); // 1 min buffer

    const market = {
      id: String(id),
      question,
      symbol: symbol?.toUpperCase(),
      strikePrice,
      direction, // 'UP' or 'DOWN' for crypto, null for community
      isCryptoMarket,
      creator,
      status: 'ACTIVE',
      createdAt: now,
      expiryTime,
      resolveTime,
      // AMM state
      yesReserve: 1000,
      noReserve: 1000,
      k: 1000000,
      // Price history for charting
      priceHistory: [{ time: now, yesPrice: 0.5, noPrice: 0.5 }]
    };

    this.markets.set(String(id), market);
    return market;
  }

  /**
   * Get all active markets
   */
  getActiveMarkets() {
    return Array.from(this.markets.values()).filter(m => m.status === 'ACTIVE');
  }

  /**
   * Get a specific market
   */
  getMarket(id) {
    return this.markets.get(String(id));
  }

  /**
   * Get current YES/NO prices from AMM
   */
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

  /**
   * Buy shares from the AMM pool
   */
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

    // Update price history
    const total = m.yesReserve + m.noReserve;
    m.priceHistory.push({
      time: Date.now(),
      yesPrice: m.yesReserve / total,
      noPrice: m.noReserve / total
    });

    return { sharesOut, market: m };
  }

  /**
   * Check if any crypto markets need settlement
   */
  checkCryptoMarketSettlements(ticker) {
    for (const [id, m] of this.markets) {
      if (m.status !== 'ACTIVE' || !m.isCryptoMarket) continue;
      if (Date.now() < m.expiryTime) continue;

      // Market has expired — settle using Binance price
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
    }
  }

  /**
   * Resolve a community (non-crypto) market — admin only
   */
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

  /**
   * Get markets by type
   */
  getMarketsByType(isCrypto) {
    return Array.from(this.markets.values()).filter(m => m.isCryptoMarket === isCrypto && m.status === 'ACTIVE');
  }
}
