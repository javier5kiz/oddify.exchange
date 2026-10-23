import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { marketRoutes } from './routes/markets.js';
import { orderRoutes } from './routes/orders.js';
import { priceRoutes } from './routes/prices.js';
import { userRoutes } from './routes/users.js';
import { apiDocsRoute } from './routes/docs.js';
import { BinanceOracle } from './services/binanceOracle.js';
import { MarketManager } from './services/marketManager.js';
import { ContractService } from './services/contractService.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
const oracle = new BinanceOracle();
const contracts = new ContractService();
const marketManager = new MarketManager(oracle, contracts);

// Wire contract service for on-chain settlement
if (process.env.FACTORY_ADDRESS) {
  console.log('📋 Factory contract:', process.env.FACTORY_ADDRESS);
  console.log('📋 USDC contract:', process.env.USDC_ADDRESS || 'not set');
}

// Connect Binance oracle WebSocket
oracle.connect();

// Routes
app.use('/api/v1/markets', marketRoutes(marketManager));
app.use('/api/v1/orders', orderRoutes(marketManager));
app.use('/api/v1/prices', priceRoutes(oracle));
app.use('/api/v1/users', userRoutes(contracts));
app.use('/api/v1/docs', apiDocsRoute());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    binanceConnected: oracle.ws?.readyState === 1,
    factory: process.env.FACTORY_ADDRESS || 'not configured',
    network: process.env.POLYGON_RPC?.includes('amoy') ? 'amoy-testnet' : 'mainnet'
  });
});

// 404 and error handling
app.use(notFound);
app.use(errorHandler);

if (process.env.VERCEL) {
  console.log('Running as Vercel serverless function (REST only)');
} else {
  server.listen(PORT, () => {
    console.log(`Oddify Exchange API running on port ${PORT}`);
    console.log(`API Docs: http://localhost:${PORT}/api/v1/docs`);
    console.log(`WebSocket: ws://localhost:${PORT}/api/v1/stream`);
  });
}

// WebSocket for real-time price + orderbook updates
import { WebSocketServer } from 'ws';
const wss = new WebSocketServer({ server, path: '/api/v1/stream' });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');

  const priceInterval = setInterval(() => {
    const prices = oracle.getAllPrices();
    ws.send(JSON.stringify({ type: 'prices', data: prices }));
  }, 2000);

  ws.on('message', (msg) => {
    const data = JSON.parse(msg.toString());
    if (data.type === 'subscribe') {
      ws.send(JSON.stringify({ type: 'subscribed', channel: data.channel }));
    }
  });

  ws.on('close', () => {
    clearInterval(priceInterval);
    console.log('WebSocket client disconnected');
  });
});

export { app, server };
