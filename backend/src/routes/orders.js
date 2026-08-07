export function orderRoutes(marketManager) {
  const router = express.Router();

  // POST /api/v1/orders — buy shares from AMM
  router.post('/buy', (req, res) => {
    const { marketId, outcome, usdcAmount, wallet } = req.body;

    if (!marketId || !outcome || !usdcAmount) {
      return res.status(400).json({ error: 'Missing required fields: marketId, outcome, usdcAmount' });
    }

    if (!['YES', 'NO'].includes(outcome)) {
      return res.status(400).json({ error: 'outcome must be YES or NO' });
    }

    try {
      const result = marketManager.buyShares(marketId, outcome, usdcAmount);
      res.json({
        data: {
          marketId,
          outcome,
          usdcIn: usdcAmount,
          sharesOut: result.sharesOut,
          newPrices: marketManager.getPrices(marketId)
        }
      });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // POST /api/v1/orders/sell — sell shares back to AMM
  router.post('/sell', (req, res) => {
    const { marketId, outcome, sharesAmount, wallet } = req.body;

    if (!marketId || !outcome || !sharesAmount) {
      return res.status(400).json({ error: 'Missing required fields: marketId, outcome, sharesAmount' });
    }

    // Note: sell logic will interact with the smart contract
    // For now, return the AMM calculation
    res.json({
      data: {
        marketId,
        outcome,
        sharesIn: sharesAmount,
        message: 'Sell order — connect wallet to execute on-chain',
        newPrices: marketManager.getPrices(marketId)
      }
    });
  });

  // GET /api/v1/orders/:wallet — get user's positions
  router.get('/:wallet', (req, res) => {
    // In production, query blockchain for user positions
    res.json({
      data: [],
      message: `Positions for ${req.params.wallet} — query on-chain balances`
    });
  });

  return router;
}

import express from 'express';
