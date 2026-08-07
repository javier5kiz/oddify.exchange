export function userRoutes(contracts) {
  const router = express.Router();

  // GET /api/v1/users/:wallet — get user profile + positions
  router.get('/:wallet', async (req, res) => {
    const wallet = req.params.wallet;

    // Get positions from contracts if available
    let positions = [];
    if (contracts?.factory) {
      try {
        const allMarkets = await contracts.getAllMarkets();
        for (const market of allMarkets) {
          const balances = await contracts.getUserPositions(market.address, wallet);
          if (balances.yes > 0 || balances.no > 0) {
            positions.push({
              marketAddress: market.address,
              question: market.question,
              yesShares: balances.yes,
              noShares: balances.no,
              status: market.status,
              prices: market.prices
            });
          }
        }
      } catch (e) {
        // contracts not configured
      }
    }

    res.json({
      data: {
        wallet,
        positions,
        apiKey: `odf_${wallet.slice(2, 10)}`
      }
    });
  });

  // POST /api/v1/users/register — register wallet (returns API key)
  router.post('/register', (req, res) => {
    const { wallet, signature, message } = req.body;

    if (!wallet) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    // In production: verify signature against message
    res.status(201).json({
      data: {
        wallet,
        registered: true,
        apiKey: `odf_${wallet.slice(2, 10)}_${Date.now().toString(36)}`
      }
    });
  });

  return router;
}

import express from 'express';
