# Oddify Exchange

P2P Prediction Platform with AMM — trade crypto up/down prediction markets with zero capital.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Frontend   │────▶│   Backend    │────▶│  Smart Contracts │
│  (Next.js)  │     │  (Node.js)   │     │  (Polygon)       │
│  Vercel     │     │  Railway     │     │  AMM + Escrow    │
└─────────────┘     └──────┬───────┘     └──────────────────┘
                           │
                    ┌──────▼───────┐
                    │   Binance    │
                    │   WebSocket  │
                    │   (Oracle)   │
                    └──────────────┘
```

## Features

- **AMM-based prediction markets** — constant product formula (x*y=k) for price discovery
- **Crypto up/down markets** — auto-settled via Binance price oracle (BTC, ETH, SOL, and more)
- **Community prediction markets** — admin/settler resolution (UMA oracle planned)
- **Wallet authentication** — MetaMask/WalletConnect, no email signup
- **Public API** — REST + WebSocket for developers to integrate
- **Zero capital** — peer-to-peer, users provide liquidity, platform takes 1% fee

## Smart Contracts

- `MarketFactory.sol` — deploys and registers new prediction markets
- `PredictionMarket.sol` — AMM pool + escrow + settlement per market

## Tech Stack

| Layer | Technology | Cost |
|-------|-----------|------|
| Frontend | Next.js + Vercel | $0 |
| Backend | Node.js + Railway | $0 |
| Database | Supabase (planned) | $0 |
| Blockchain | Polygon | ~$0.01/tx |
| Oracle | Binance WebSocket | $0 |
| Wallet Auth | MetaMask / WalletConnect | $0 |
| Domain | oddify.exchange | ~$15/yr |

## API Endpoints

### Markets
- `GET /api/v1/markets` — list all active markets
- `GET /api/v1/markets?type=crypto` — crypto markets only
- `GET /api/v1/markets/:id` — get a specific market
- `POST /api/v1/markets` — create a new market
- `GET /api/v1/markets/:id/prices` — current AMM YES/NO prices
- `GET /api/v1/markets/:id/history` — price history for charting

### Orders
- `POST /api/v1/orders/buy` — buy YES or NO shares from AMM
- `POST /api/v1/orders/sell` — sell shares back to AMM
- `GET /api/v1/orders/:wallet` — get user positions

### Prices
- `GET /api/v1/prices` — all current Binance prices
- `GET /api/v1/prices/:symbol` — specific symbol price
- `GET /api/v1/prices/:symbol/history` — candlestick history

### WebSocket
- `WS /api/v1/stream` — real-time price + market updates

## Getting Started

### Backend
```bash
cd backend
cp .env.example .env
npm install
npm start
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Smart Contracts
```bash
cd contracts
# Deploy using Foundry or Hardhat
forge create src/MarketFactory.sol:MarketFactory --constructor-args $USDC_ADDRESS 100 --rpc-url $POLYGON_RPC --private-key $KEY
```

## License

MIT
