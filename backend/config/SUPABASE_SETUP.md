# Supabase Setup Guide

## Step 1: Create a Supabase Project (free tier)

1. Go to [supabase.com](https://supabase.com) and sign up (free — no credit card)
2. Click "New Project"
3. Name it `oddify-exchange`
4. Set a database password (save it somewhere safe)
5. Choose the closest region
6. Wait ~2 minutes for provisioning

## Step 2: Run the schema SQL

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Paste the entire contents of `config/supabase-schema.sql` (from this repo)
4. Click **Run**

This creates:
- `markets` — market records (question, prices, status, resolution)
- `orders` — buy/sell orders with tx hashes
- `positions` — cached on-chain balances per user
- `users` — wallet addresses, API keys, volume stats
- `price_history` — AMM price snapshots for charting
- Row-level security policies (users see only their own data)
- Performance indexes

## Step 3: Get your API keys

1. Go to **Settings → API**
2. Copy:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGci...` (safe for frontend use)

3. Add to your Railway environment variables:
```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
```

4. Add to your Vercel frontend:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

## Step 4: Enable Realtime (optional — for live updates)

1. Go to **Database → Replication**
2. Enable replication for `markets`, `orders`, `price_history` tables
3. This lets the frontend subscribe to live price/order updates

## Database Schema Summary

```
markets
  ├── id (TEXT, PK)
  ├── question (TEXT)
  ├── symbol (TEXT)           — e.g. "BTCUSDT"
  ├── strike_price (NUMERIC)   — e.g. 65000
  ├── direction (TEXT)        — "UP" or "DOWN"
  ├── is_crypto_market (BOOL)
  ├── status (TEXT)           — ACTIVE, SETTLING, RESOLVED, CANCELLED
  ├── winning_outcome (TEXT)  — YES or NO
  ├── contract_address (TEXT) — on-chain address
  ├── yes_reserve (NUMERIC)    — AMM state
  ├── no_reserve (NUMERIC)
  ├── expiry_time (TIMESTAMPTZ)
  └── resolve_time (TIMESTAMPTZ)

orders
  ├── market_id → markets.id
  ├── wallet (TEXT)
  ├── outcome (YES/NO)
  ├── type (BUY/SELL)
  ├── usdc_amount (NUMERIC)
  ├── shares_amount (NUMERIC)
  ├── tx_hash (TEXT)
  └── status (PENDING/FILLED/CANCELLED/FAILED)

positions
  ├── market_id → markets.id
  ├── wallet (TEXT)
  ├── yes_shares (NUMERIC)
  ├── no_shares (NUMERIC)
  ├── total_invested (NUMERIC)
  └── realized_pnl (NUMERIC)

users
  ├── wallet (TEXT, PK)
  ├── username (TEXT, unique)
  ├── api_key (TEXT, unique)
  └── total_volume (NUMERIC)

price_history
  ├── market_id → markets.id
  ├── yes_price (NUMERIC)
  ├── no_price (NUMERIC)
  └── timestamp (TIMESTAMPTZ)
```

## Cost

- **Free tier**: 500MB database, 50,000 monthly rows, unlimited API requests
- This is more than enough for testnet and early mainnet usage
- Upgrades ($25/mo) only needed if you hit >500MB or >50k rows/month
