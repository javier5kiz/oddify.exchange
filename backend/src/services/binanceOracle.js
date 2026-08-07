import WebSocket from 'ws';

/**
 * BinanceOracle — connects to Binance WebSocket for real-time crypto prices.
 * Free API, no key required. Used to settle crypto up/down markets.
 */
export class BinanceOracle {
  constructor() {
    this.wsUrl = process.env.BINANCE_WS_URL || 'wss://stream.binance.com:9443/ws';
    this.ws = null;
    this.prices = {};
    this.listeners = [];
    this.reconnectAttempts = 0;
  }

  connect() {
    // Subscribe to ticker streams for BTC, ETH, SOL, BNB, XRP, ADA, DOGE, AVAX
    const streams = [
      'btcusdt@ticker',
      'ethusdt@ticker',
      'solusdt@ticker',
      'bnbusdt@ticker',
      'xrpusdt@ticker',
      'adausdt@ticker',
      'dogeusdt@ticker',
      'avaxusdt@ticker'
    ].join('/');

    const url = `${this.wsUrl}/${streams}`;
    console.log('Connecting to Binance WebSocket...');

    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      console.log('✅ Binance Oracle connected');
      this.reconnectAttempts = 0;
    });

    this.ws.on('message', (data) => {
      try {
        const ticker = JSON.parse(data.toString());
        if (ticker.c) {
          // c = last price, s = symbol
          this.prices[ticker.s] = {
            symbol: ticker.s,
            price: parseFloat(ticker.c),
            priceChange: parseFloat(ticker.p),
            priceChangePercent: parseFloat(ticker.P),
            high: parseFloat(ticker.h),
            low: parseFloat(ticker.l),
            volume: parseFloat(ticker.v),
            timestamp: Date.now()
          };

          // Notify listeners (for market settlement checks)
          this.listeners.forEach(fn => fn(this.prices[ticker.s]));
        }
      } catch (e) {
        // ignore parse errors
      }
    });

    this.ws.on('close', () => {
      console.log('⚠️ Binance WebSocket disconnected, reconnecting...');
      this.reconnectAttempts++;
      setTimeout(() => this.connect(), Math.min(5000 * this.reconnectAttempts, 30000));
    });

    this.ws.on('error', (err) => {
      console.error('Binance WS error:', err.message);
    });
  }

  /**
   * Get current price for a symbol (e.g. "BTCUSDT")
   */
  getPrice(symbol) {
    return this.prices[symbol.toUpperCase()]?.price || null;
  }

  /**
   * Get full ticker data for a symbol
   */
  getTicker(symbol) {
    return this.prices[symbol.toUpperCase()] || null;
  }

  /**
   * Get all current prices
   */
  getAllPrices() {
    return this.prices;
  }

  /**
   * Register a listener for price updates (used by MarketManager)
   */
  onPriceUpdate(fn) {
    this.listeners.push(fn);
  }

  /**
   * Check if BTC was above or below a strike price at a given time.
   * Used for crypto up/down market settlement.
   */
  evaluateCryptoMarket(symbol, strikePrice, direction) {
    const currentPrice = this.getPrice(symbol);
    if (!currentPrice) return null;

    if (direction === 'UP') {
      return currentPrice > strikePrice;
    } else {
      return currentPrice < strikePrice;
    }
  }
}
