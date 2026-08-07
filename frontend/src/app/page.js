'use client';
import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export default function MarketsPage() {
  const [markets, setMarkets] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMarkets();
    const interval = setInterval(fetchMarkets, 5000); // refresh every 5s
    return () => clearInterval(interval);
  }, [filter]);

  async function fetchMarkets() {
    try {
      const url = filter === 'all' ? `${API}/markets` : `${API}/markets?type=${filter}`;
      const res = await fetch(url);
      const json = await res.json();
      setMarkets(json.data || []);
    } catch (e) {
      console.error('Failed to fetch markets:', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="section-header">
        <h2>Active Markets</h2>
        <div className="filter-pills">
          <span className={`filter-pill ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</span>
          <span className={`filter-pill ${filter === 'crypto' ? 'active' : ''}`} onClick={() => setFilter('crypto')}>Crypto</span>
          <span className={`filter-pill ${filter === 'community' ? 'active' : ''}`} onClick={() => setFilter('community')}>Community</span>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading markets...</p>
      ) : markets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          <p>No active markets yet.</p>
          <p style={{ marginTop: '8px', fontSize: '14px' }}>
            <a href="/create" style={{ color: 'var(--primary)' }}>Create the first market →</a>
          </p>
        </div>
      ) : (
        <div className="market-grid">
          {markets.map(m => (
            <a key={m.id} href={`/market/${m.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="market-card">
                <h3>{m.question}</h3>
                <div className="market-prices">
                  <div className="price-pill yes">
                    YES {(m.prices?.yes * 100).toFixed(1)}%
                  </div>
                  <div className="price-pill no">
                    NO {(m.prices?.no * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="market-meta">
                  <span>{m.isCryptoMarket ? '🔵 Crypto' : '🟡 Community'}</span>
                  <span>Expires: {new Date(m.expiryTime).toLocaleTimeString()}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
