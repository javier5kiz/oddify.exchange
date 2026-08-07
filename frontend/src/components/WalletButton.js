'use client';
import { useState } from 'react';
import { useWallet } from '../lib/wallet';

export default function WalletButton() {
  const { address, walletName, connecting, error, connect, disconnect, wallets } = useWallet();
  const [showDropdown, setShowDropdown] = useState(false);

  if (address) {
    return (
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span className="wallet-btn" style={{ background: 'var(--green)' }}>
          {walletName} {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button
          onClick={disconnect}
          style={{ width: 'auto', padding: '8px 12px', fontSize: '12px', background: 'var(--surface-2)', border: '1px solid var(--border)' }}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="wallet-btn"
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={connecting}
      >
        {connecting ? 'Connecting...' : 'Connect Wallet'}
      </button>

      {showDropdown && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: '100%',
          marginTop: '8px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '8px',
          minWidth: '200px',
          zIndex: 1000,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
        }}>
          {Object.entries(wallets).map(([key, wallet]) => (
            <button
              key={key}
              onClick={() => { connect(key); setShowDropdown(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                marginBottom: '4px',
                borderRadius: '8px',
                cursor: 'pointer',
                background: 'transparent',
                color: 'var(--text)',
                textAlign: 'left',
                fontSize: '14px',
                border: '1px solid transparent',
                width: '100%'
              }}
              onMouseEnter={(e) => e.target.style.background = 'var(--surface-2)'}
              onMouseLeave={(e) => e.target.style.background = 'transparent'}
            >
              <span style={{ fontSize: '20px' }}>{wallet.icon}</span>
              <div>
                <div style={{ fontWeight: '600' }}>{wallet.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {wallet.isInstalled() ? 'Detected' : 'Will prompt install'}
                </div>
              </div>
            </button>
          ))}
          {error && (
            <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--red)' }}>
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
