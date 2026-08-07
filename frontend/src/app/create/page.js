'use client';
import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export default function CreateMarketPage() {
  const [type, setType] = useState('crypto');
  const [question, setQuestion] = useState('');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [strikePrice, setStrikePrice] = useState('');
  const [direction, setDirection] = useState('UP');
  const [expiryMinutes, setExpiryMinutes] = useState('60');
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState(null);

  async function handleCreate() {
    setCreating(true);
    try {
      const body = {
        question: type === 'crypto'
          ? `Will ${symbol.replace('USDT','')} be ${direction === 'UP' ? 'above' : 'below'} $${strikePrice} in ${expiryMinutes} minutes?`
          : question,
        symbol: type === 'crypto' ? symbol : null,
        strikePrice: type === 'crypto' ? parseFloat(strikePrice) : null,
        direction: type === 'crypto' ? direction : null,
        expiryMinutes: parseInt(expiryMinutes),
        isCryptoMarket: type === 'crypto'
      };

      const res = await fetch(`${API}/markets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      setResult(json);
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="section-header">
        <h2>Create Market</h2>
      </div>

      <div className="trade-panel" style={{ maxWidth: '500px' }}>
        <div className="filter-pills" style={{ marginBottom: '20px' }}>
          <span className={`filter-pill ${type === 'crypto' ? 'active' : ''}`} onClick={() => setType('crypto')}>Crypto Up/Down</span>
          <span className={`filter-pill ${type === 'community' ? 'active' : ''}`} onClick={() => setType('community')}>Community</span>
        </div>

        {type === 'crypto' ? (
          <>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--text-muted)' }}>Asset</label>
            <select value={symbol} onChange={e => setSymbol(e.target.value)} style={{ marginBottom: '16px' }}>
              <option value="BTCUSDT">BTC (Bitcoin)</option>
              <option value="ETHUSDT">ETH (Ethereum)</option>
              <option value="SOLUSDT">SOL (Solana)</option>
              <option value="BNBUSDT">BNB</option>
              <option value="XRPUSDT">XRP</option>
              <option value="ADAUSDT">ADA</option>
              <option value="AVAXUSDT">AVAX</option>
              <option value="DOGEUSDT">DOGE</option>
            </select>

            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--text-muted)' }}>Strike Price (USD)</label>
            <input type="number" value={strikePrice} onChange={e => setStrikePrice(e.target.value)} placeholder="e.g. 65000" style={{ marginBottom: '16px' }} />

            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--text-muted)' }}>Direction</label>
            <div className="trade-tabs" style={{ marginBottom: '16px' }}>
              <div className={`trade-tab yes ${direction === 'UP' ? 'active' : ''}`} onClick={() => setDirection('UP')}>⬆️ UP (Above)</div>
              <div className={`trade-tab no ${direction === 'DOWN' ? 'active' : ''}`} onClick={() => setDirection('DOWN')}>⬇️ DOWN (Below)</div>
            </div>

            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--text-muted)' }}>Duration (minutes)</label>
            <input type="number" value={expiryMinutes} onChange={e => setExpiryMinutes(e.target.value)} style={{ marginBottom: '20px' }} />

            <div style={{ padding: '12px', background: 'var(--surface-2)', borderRadius: '8px', marginBottom: '20px', fontSize: '14px' }}>
              <strong>Preview:</strong> Will {symbol.replace('USDT','')} be {direction === 'UP' ? 'above' : 'below'} ${strikePrice} in {expiryMinutes} minutes?
            </div>
          </>
        ) : (
          <>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--text-muted)' }}>Market Question</label>
            <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="e.g. Will Trump win the 2028 election?" style={{ marginBottom: '16px' }} />

            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--text-muted)' }}>Duration (minutes)</label>
            <input type="number" value={expiryMinutes} onChange={e => setExpiryMinutes(e.target.value)} style={{ marginBottom: '20px' }} />
          </>
        )}

        <button className="btn-primary" onClick={handleCreate} disabled={creating || (type === 'crypto' && !strikePrice) || (type === 'community' && !question)}>
          {creating ? 'Creating...' : 'Create Market'}
        </button>

        {result?.data && (
          <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(34,197,94,0.1)', borderRadius: '8px', fontSize: '14px' }}>
            ✅ Market created! ID: {result.data.id}
          </div>
        )}
        {result?.error && (
          <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', fontSize: '14px' }}>
            ❌ {result.error}
          </div>
        )}
      </div>
    </div>
  );
}
