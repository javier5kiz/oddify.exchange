export default function DocsPage() {
  return (
    <div>
      <div className="section-header">
        <h2>API Documentation</h2>
      </div>

      <div className="docs-section">
        <h3>Markets</h3>
        <div className="endpoint"><span className="method GET">GET</span><code>/api/v1/markets</code> — List all active markets</div>
        <div className="endpoint"><span className="method GET">GET</span><code>/api/v1/markets?type=crypto</code> — Crypto markets only</div>
        <div className="endpoint"><span className="method GET">GET</span><code>/api/v1/markets/:id</code> — Get specific market</div>
        <div className="endpoint"><span className="method POST">POST</span><code>/api/v1/markets</code> — Create new market</div>
        <div className="endpoint"><span className="method GET">GET</span><code>/api/v1/markets/:id/prices</code> — Current AMM prices</div>
        <div className="endpoint"><span className="method GET">GET</span><code>/api/v1/markets/:id/history</code> — Price history</div>
      </div>

      <div className="docs-section">
        <h3>Orders</h3>
        <div className="endpoint"><span className="method POST">POST</span><code>/api/v1/orders/buy</code> — Buy YES/NO shares</div>
        <div className="endpoint"><span className="method POST">POST</span><code>/api/v1/orders/sell</code> — Sell shares back to AMM</div>
        <div className="endpoint"><span className="method GET">GET</span><code>/api/v1/orders/:wallet</code> — Get user positions</div>
      </div>

      <div className="docs-section">
        <h3>Prices (Binance Oracle)</h3>
        <div className="endpoint"><span className="method GET">GET</span><code>/api/v1/prices</code> — All current prices</div>
        <div className="endpoint"><span className="method GET">GET</span><code>/api/v1/prices/:symbol</code> — Specific symbol (e.g. BTCUSDT)</div>
        <div className="endpoint"><span className="method GET">GET</span><code>/api/v1/prices/:symbol/history</code> — Candlestick history</div>
      </div>

      <div className="docs-section">
        <h3>Users</h3>
        <div className="endpoint"><span className="method GET">GET</span><code>/api/v1/users/:wallet</code> — Get user profile</div>
        <div className="endpoint"><span className="method POST">POST</span><code>/api/v1/users/register</code> — Register wallet, get API key</div>
      </div>

      <div className="docs-section">
        <h3>WebSocket</h3>
        <div className="endpoint"><span className="method WS">WS</span><code>/api/v1/stream</code> — Real-time price + market updates</div>
      </div>

      <div className="docs-section">
        <h3>Example: Create a crypto market</h3>
        <pre style={{ background: 'var(--surface-2)', padding: '16px', borderRadius: '8px', fontSize: '13px', overflowX: 'auto' }}>
{`curl -X POST https://api.oddify.exchange/api/v1/markets \\
  -H "Content-Type: application/json" \\
  -d '{
    "question": "Will BTC be above $65000 in 60 minutes?",
    "symbol": "BTCUSDT",
    "strikePrice": 65000,
    "direction": "UP",
    "expiryMinutes": 60,
    "isCryptoMarket": true
  }'`}
        </pre>
      </div>

      <div className="docs-section">
        <h3>Example: Buy shares</h3>
        <pre style={{ background: 'var(--surface-2)', padding: '16px', borderRadius: '8px', fontSize: '13px', overflowX: 'auto' }}>
{`curl -X POST https://api.oddify.exchange/api/v1/orders/buy \\
  -H "Content-Type: application/json" \\
  -d '{
    "marketId": "1",
    "outcome": "YES",
    "usdcAmount": 100,
    "wallet": "0xYourWalletAddress"
  }'`}
        </pre>
      </div>

      <div className="docs-section">
        <h3>Example: WebSocket subscription</h3>
        <pre style={{ background: 'var(--surface-2)', padding: '16px', borderRadius: '8px', fontSize: '13px', overflowX: 'auto' }}>
{`const ws = new WebSocket('wss://api.oddify.exchange/api/v1/stream');

ws.onmessage = (e) => {
  const data = JSON.parse(e.data);
  if (data.type === 'prices') {
    console.log('BTC:', data.data.BTCUSDT?.price);
  }
};`}
        </pre>
      </div>
    </div>
  );
}
