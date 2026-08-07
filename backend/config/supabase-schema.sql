-- Oddify Exchange — Supabase Schema
-- Run this in your Supabase SQL editor

-- Markets table
CREATE TABLE markets (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  symbol TEXT,
  strike_price NUMERIC,
  direction TEXT CHECK (direction IN ('UP', 'DOWN')),
  is_crypto_market BOOLEAN DEFAULT TRUE,
  creator TEXT NOT NULL,
  contract_address TEXT,
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SETTLING', 'RESOLVED', 'CANCELLED')),
  winning_outcome TEXT CHECK (winning_outcome IN ('YES', 'NO')),
  resolved_price NUMERIC,
  resolved_at TIMESTAMPTZ,
  oracle_id TEXT,
  expiry_time TIMESTAMPTZ NOT NULL,
  resolve_time TIMESTAMPTZ NOT NULL,
  yes_reserve NUMERIC DEFAULT 1000,
  no_reserve NUMERIC DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id TEXT NOT NULL REFERENCES markets(id),
  wallet TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('YES', 'NO')),
  type TEXT NOT NULL CHECK (type IN ('BUY', 'SELL')),
  usdc_amount NUMERIC,
  shares_amount NUMERIC,
  price NUMERIC,
  tx_hash TEXT,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'FILLED', 'CANCELLED', 'FAILED')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Positions table (cached on-chain balances)
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id TEXT NOT NULL REFERENCES markets(id),
  wallet TEXT NOT NULL,
  yes_shares NUMERIC DEFAULT 0,
  no_shares NUMERIC DEFAULT 0,
  avg_buy_price NUMERIC,
  total_invested NUMERIC DEFAULT 0,
  realized_pnl NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(market_id, wallet)
);

-- Users table
CREATE TABLE users (
  wallet TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  api_key TEXT UNIQUE,
  total_volume NUMERIC DEFAULT 0,
  total_markets_created INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Price history table (for charting)
CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id TEXT NOT NULL REFERENCES markets(id),
  yes_price NUMERIC NOT NULL,
  no_price NUMERIC NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_markets_status ON markets(status);
CREATE INDEX idx_markets_type ON markets(is_crypto_market);
CREATE INDEX idx_orders_wallet ON orders(wallet);
CREATE INDEX idx_orders_market ON orders(market_id);
CREATE INDEX idx_positions_wallet ON positions(wallet);
CREATE INDEX idx_price_history_market ON price_history(market_id, timestamp);

-- Enable Row Level Security
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies — users can only see their own orders/positions
CREATE POLICY "Users can view own orders" ON orders FOR SELECT USING (wallet = current_setting('app.current_wallet', true));
CREATE POLICY "Users can view own positions" ON positions FOR SELECT USING (wallet = current_setting('app.current_wallet', true));
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (wallet = current_setting('app.current_wallet', true));
CREATE POLICY "Anyone can view active markets" ON markets FOR SELECT USING (status = 'ACTIVE');
CREATE POLICY "Anyone can view price history" ON price_history FOR SELECT USING (true);
