'use client';
import { useState } from 'react';

export default function WalletButton() {
  const [address, setAddress] = useState(null);

  async function connect() {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setAddress(accounts[0]);
      } catch (e) {
        console.error('Wallet connection failed:', e);
      }
    } else {
      alert('Please install MetaMask or a Web3 wallet');
    }
  }

  if (address) {
    return (
      <span className="wallet-btn" style={{ background: 'var(--green)' }}>
        {address.slice(0, 6)}...{address.slice(-4)}
      </span>
    );
  }

  return (
    <button className="wallet-btn" onClick={connect}>
      Connect Wallet
    </button>
  );
}
