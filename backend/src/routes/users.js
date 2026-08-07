export function userRoutes() {
  const router = express.Router();

  // GET /api/v1/users/:wallet — get user profile
  router.get('/:wallet', (req, res) => {
    res.json({
      data: {
        wallet: req.params.wallet,
        createdAt: null,
        positions: [],
        createdMarkets: []
      }
    });
  });

  // POST /api/v1/users/register — register wallet (no email, just wallet)
  router.post('/register', (req, res) => {
    const { wallet, signature, message } = req.body;

    if (!wallet) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    // In production: verify signature against message
    // For now: just register the wallet
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
