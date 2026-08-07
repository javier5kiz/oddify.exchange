export function priceRoutes(oracle) {
  const router = express.Router();

  // GET /api/v1/prices — all current prices
  router.get('/', (req, res) => {
    res.json({ data: oracle.getAllPrices() });
  });

  // GET /api/v1/prices/:symbol — specific symbol price
  router.get('/:symbol', (req, res) => {
    const ticker = oracle.getTicker(req.params.symbol);
    if (!ticker) {
      return res.status(404).json({ error: `Symbol ${req.params.symbol} not found` });
    }
    res.json({ data: ticker });
  });

  // GET /api/v1/prices/:symbol/history — price history (from Binance REST API)
  router.get('/:symbol/history', async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    const interval = req.query.interval || '1m';
    const limit = req.query.limit || 60;

    try {
      const response = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
      );
      const data = await response.json();

      const candles = data.map(k => ({
        time: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));

      res.json({ data: candles });
    } catch (e) {
      res.status(500).json({ error: 'Failed to fetch price history' });
    }
  });

  return router;
}

import express from 'express';
