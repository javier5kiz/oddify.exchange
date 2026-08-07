'use client';
import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export default function MarketPage({ params }) {
  const { id } = params;
  const [market, setMarket] = useState(null);
  const [prices, setPrices] = useState(null);
  const [history, setHistory] = useState([]);
  const [outcome, setOutcome] = useState('YES');
  const [amount, setAmount] = useState('10');
  const [trading, setTrading] = useState(false);
  const [txResult, setTxResult] = useState(null);

  useEffect(() => {
    fetchMarket();
    const interval = setInterval(fetchMarket, 3000);
    return () => clearInterval(interval);
  }, []);

  async function fetchMarket() {
    try {
      const [mRes, pRes, hRes] = await Promise.all([
        fetch(`${API}/markets/${id}`),
        fetch(`${API}/markets/${id}/prices`),
        fetch(`${API}/markets/${id}/history`)
      ]);
      const m = await mRes.json();
      const p = await pRes.json();
      const h = await hRes.json();
      setMarket(m);
      setPrices(p);
      setHistory(h.data || []);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleTrade() {
    setTrading(true);
    try {
      const res = await fetch(`${API}/orders/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId: id,
          outcome,
          usdcAmount: parseFloat(amount),
          wallet: '0x0000000000000000000000000000000000000000'
        })
      });
      const json = await res.json();
      setTxResult(json);
    } catch (e) {
      setTxResult({ error: e.message });
    } finally {
      setTrading(false);
    }
  }

  if (!market) return <p style={{ color: 'var(--text-muted)' }}>Loading market...</p>;

  return (
    <div>
      <div className="section-header">
        <h2>{market.question}</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '24px' }}>
        {/* Price chart */}
        <div className="trade-panel">
          <h3 style={{ marginBottom: '16px' }}>Price History</h3>
          {history.length > 0 ? (
            <div style={{ height: '300px', position: 'relative' }}>
              <svg width="100%" height="100%" viewBox="0 0 400 300">
                {(() => {
                  const max = Math.max(...history.map(h => h.yesPrice));
                  const min = Math.min(...history.map(h => h.yesPrice));
                  const range = max - min || 0.01;
                  const points = history.map((h, i) => {
                    const x = (i / (history.length - 1)) * 400;
                    const y = 300 - ((h.yesPrice - min) / range) * 280 - 10;
                    return `${x},${y}`;
                  }).join(' ');
                  return <polyline points={points} fill="none" stroke="var(--primary)" strokeWidth="2" />;
                })()}
              </svg>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>No price history yet</p>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <div className="price-pill yes">
              YES {prices?.yes ? (prices.yes * 100).toFixed(1) : '--'}%
            </div>
            <div className="price-pill no">
              NO {prices?.no ? (prices.no * 100).toFixed(1) : '--'}%
            </div>
          </div>

          <div style={{ marginTop: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
            <p>Expires: {new Date(market.expiryTime).toLocaleString()}</p>
            <p>Status: {market.status}</p>
            {market.isCryptoMarket && <p>Oracle: Binance ({market.symbol})</p>}
          </div>
        </div>

        {/* Trade panel */}
        <div className="trade-panel">
          <h3 style={{ marginBottom: '16px' }}>Trade</h3>

          <div className="trade-tabs" style={{ marginBottom: '16px' }}>
            <div className={`trade-tab yes ${outcome === 'YES' ? 'active' : ''}`} onClick={() => setOutcome('YES')}>
              BUY YES {prices?.yes ? `$${prices.yes.toFixed(2)}` : '--'}
            </div>
            <div className={`trade-tab no ${outcome === 'NO' ? 'active' : ''}`} onClick={() => setOutcome('NO')}>
              BUY NO {prices?.no ? `$${prices.no.toFixed(2)}` : '--'}
            </div>
          </div>

          <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--text-muted)' }}>Amount (USDC)</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} style={{ marginBottom: '16px' }} />

          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Est. shares: ~{(parseFloat(amount) / (prices?.[outcome.toLowerCase()] || 0.5)).toFixed(2)}
          </div>

          <button
            className={outcome === 'YES' ? 'btn-yes' : 'btn-no'}
            onClick={handleTrade}
            disabled={trading || market.status !== 'ACTIVE'}
          >
            {trading ? 'Trading...' : `Buy ${outcome}`}
          </button>

          {txResult?.data && (
            <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(34,197,94,0.1)', borderRadius: '8px', fontSize: '14px' }}>
              ✅ Got {txResult.data.sharesOut?.toFixed(2) || '--'} shares
            </div>
          )}
          {txResult?.error && (
            <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', fontSize: '14px' }}>
              ❌ {txResult.error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
