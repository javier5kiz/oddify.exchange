export function apiDocsRoute() {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json({
      name: 'Oddify Exchange API',
      version: '1.0.0',
      baseUrl: '/api/v1',
      description: 'P2P Prediction Platform with AMM — trade crypto up/down prediction markets',
      endpoints: {
        markets: {
          'GET /markets': 'List all active markets',
          'GET /markets?type=crypto': 'List crypto markets only',
          'GET /markets?type=community': 'List community prediction markets',
          'GET /markets/:id': 'Get a specific market',
          'POST /markets': 'Create a new market (requires wallet auth)',
          'GET /markets/:id/prices': 'Get current AMM YES/NO prices',
          'GET /markets/:id/history': 'Get price history for charting',
          'POST /markets/:id/resolve': 'Resolve community market (admin only)'
        },
        orders: {
          'POST /orders/buy': 'Buy YES or NO shares from AMM pool',
          'POST /orders/sell': 'Sell shares back to AMM pool',
          'GET /orders/:wallet': 'Get user positions'
        },
        prices: {
          'GET /prices': 'All current Binance prices',
          'GET /prices/:symbol': 'Get price for specific symbol (e.g. BTCUSDT)',
          'GET /prices/:symbol/history': 'Get candlestick history'
        },
        users: {
          'GET /users/:wallet': 'Get user profile',
          'POST /users/register': 'Register wallet (returns API key)'
        },
        websocket: {
          'WS /stream': 'Real-time price + market updates',
          'msg {type:"subscribe", channel:"prices"}': 'Subscribe to price feed'
        }
      },
      rateLimit: '100 requests/minute (free tier)',
      auth: 'Wallet-based — sign message with your wallet to get API key'
    });
  });

  return router;
}

import express from 'express';
