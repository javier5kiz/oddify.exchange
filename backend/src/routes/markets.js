export function marketRoutes(marketManager) {
  const router = express.Router();

  // GET /api/v1/markets — list all active markets
  router.get('/', (req, res) => {
    const { type } = req.query;
    let markets;
    if (type === 'crypto') {
      markets = marketManager.getMarketsByType(true);
    } else if (type === 'community') {
      markets = marketManager.getMarketsByType(false);
    } else {
      markets = marketManager.getActiveMarkets();
    }

    res.json({
      count: markets.length,
      data: markets.map(m => ({
        id: m.id,
        question: m.question,
        symbol: m.symbol,
        strikePrice: m.strikePrice,
        direction: m.direction,
        isCryptoMarket: m.isCryptoMarket,
        status: m.status,
        expiryTime: m.expiryTime,
        prices: marketManager.getPrices(m.id)
      }))
    });
  });

  // GET /api/v1/markets/:id — get a specific market
  router.get('/:id', (req, res) => {
    const market = marketManager.getMarket(req.params.id);
    if (!market) {
      return res.status(404).json({ error: 'Market not found' });
    }
    res.json({
      ...market,
      prices: marketManager.getPrices(market.id)
    });
  });

  // POST /api/v1/markets — create a new market
  router.post('/', (req, res) => {
    const { question, symbol, strikePrice, direction, expiryMinutes, isCryptoMarket, creator } = req.body;

    if (!question || !expiryMinutes) {
      return res.status(400).json({ error: 'Missing required fields: question, expiryMinutes' });
    }

    const market = marketManager.createMarket({
      question,
      symbol,
      strikePrice,
      direction,
      expiryMinutes,
      isCryptoMarket: isCryptoMarket ?? true,
      creator: creator || '0x0000000000000000000000000000000000000000'
    });

    res.status(201).json({ data: market });
  });

  // GET /api/v1/markets/:id/prices — get current AMM prices
  router.get('/:id/prices', (req, res) => {
    const prices = marketManager.getPrices(req.params.id);
    if (!prices) {
      return res.status(404).json({ error: 'Market not found' });
    }
    res.json(prices);
  });

  // GET /api/v1/markets/:id/history — get price history for charting
  router.get('/:id/history', (req, res) => {
    const market = marketManager.getMarket(req.params.id);
    if (!market) {
      return res.status(404).json({ error: 'Market not found' });
    }
    res.json({ data: market.priceHistory || [] });
  });

  // POST /api/v1/markets/:id/resolve — resolve a community market (admin only)
  router.post('/:id/resolve', (req, res) => {
    const { winningOutcome } = req.body;
    if (!winningOutcome || !['YES', 'NO'].includes(winningOutcome)) {
      return res.status(400).json({ error: 'winningOutcome must be YES or NO' });
    }
    try {
      const market = marketManager.resolveCommunityMarket(req.params.id, winningOutcome);
      res.json({ data: market });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  return router;
}

import express from 'express';
