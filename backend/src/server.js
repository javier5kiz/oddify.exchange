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
import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Services
const oracle = new BinanceOracle();
const marketManager = new MarketManager(oracle);

// Initialize oracle WebSocket connection
oracle.connect();

// Routes
app.use('/api/v1/markets', marketRoutes(marketManager));
app.use('/api/v1/orders', orderRoutes(marketManager));
app.use('/api/v1/prices', priceRoutes(oracle));
app.use('/api/v1/users', userRoutes());
app.use('/api/v1/docs', apiDocsRoute);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// 404 and error handling
app.use(notFound);
app.use(errorHandler);

server.listen(PORT, () => {
  console.log(`Oddify Exchange API running on port ${PORT}`);
  console.log(`API Docs: http://localhost:${PORT}/api/v1/docs`);
  console.log(`WebSocket: ws://localhost:${PORT}/api/v1/stream`);
});

// WebSocket for real-time price + orderbook updates
import { WebSocketServer } from 'ws';
const wss = new WebSocketServer({ server, path: '/api/v1/stream' });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');

  // Send price updates every 2 seconds
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
