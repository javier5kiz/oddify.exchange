export function orderRoutes(marketManager) {
  const router = express.Router();

  // POST /api/v1/orders/buy — buy shares from AMM
  router.post('/buy', async (req, res) => {
    const { marketId, outcome, usdcAmount, wallet } = req.body;

    if (!marketId || !outcome || !usdcAmount) {
      return res.status(400).json({ error: 'Missing required fields: marketId, outcome, usdcAmount' });
    }

    if (!['YES', 'NO'].includes(outcome)) {
      return res.status(400).json({ error: 'outcome must be YES or NO' });
    }

    try {
      // Execute via in-memory AMM (instant)
      const result = marketManager.buyShares(marketId, outcome, usdcAmount);

      // If contract address exists, also prepare on-chain tx data
      let onChainData = null;
      const market = marketManager.getMarket(marketId);
      if (market?.contractAddress) {
        onChainData = {
          contractAddress: market.contractAddress,
          method: 'buyShares',
          args: [outcome === 'YES' ? 0 : 1, usdcAmount, 0],
          message: 'Execute this transaction on-chain to finalize'
        };
      }

      res.json({
        data: {
          marketId,
          outcome,
          usdcIn: usdcAmount,
          sharesOut: result.sharesOut,
          newPrices: marketManager.getPrices(marketId),
          onChain: onChainData
        }
      });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // POST /api/v1/orders/sell — sell shares back to AMM
  router.post('/sell', async (req, res) => {
    const { marketId, outcome, sharesAmount, wallet } = req.body;

    if (!marketId || !outcome || !sharesAmount) {
      return res.status(400).json({ error: 'Missing required fields: marketId, outcome, sharesAmount' });
    }

    const market = marketManager.getMarket(marketId);
    if (!market) {
      return res.status(404).json({ error: 'Market not found' });
    }

    res.json({
      data: {
        marketId,
        outcome,
        sharesIn: sharesAmount,
        newPrices: marketManager.getPrices(marketId),
        onChain: market.contractAddress ? {
          contractAddress: market.contractAddress,
          method: 'sellShares',
          args: [outcome === 'YES' ? 0 : 1, sharesAmount, 0],
          message: 'Execute this transaction on-chain to finalize'
        } : null
      }
    });
  });

  // GET /api/v1/orders/:wallet — get user's positions across all markets
  router.get('/:wallet', async (req, res) => {
    const wallet = req.params.wallet;
    const positions = [];

    for (const [id, market] of marketManager.markets) {
      if (market.contractAddress && marketManager.contracts) {
        try {
          const balances = await marketManager.contracts.getUserPositions(market.contractAddress, wallet);
          if (balances.yes > 0 || balances.no > 0) {
            positions.push({
              marketId: id,
              question: market.question,
              yesShares: balances.yes,
              noShares: balances.no,
              status: market.status,
              winningOutcome: market.winningOutcome
            });
          }
        } catch (e) {
          // skip
        }
      }
    }

    res.json({ data: positions });
  });

  return router;
}

import express from 'express';
