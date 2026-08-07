'use client';
import { createContext, useContext } from 'react';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  return (
    <WalletContext.Provider value={{ address: null }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
