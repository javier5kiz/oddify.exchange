'use client';
import { createContext, useContext, useState, useCallback } from 'react';

const WalletContext = createContext(null);

const WALLETS = {
  METAMASK: {
    name: 'MetaMask',
    icon: '🦊',
    getWindow: () => window.ethereum,
    // MetaMask also handles other EVM wallets via EIP-1193
    isInstalled: () => typeof window.ethereum !== 'undefined',
    chainType: 'evm'
  },
  PHANTOM: {
    name: 'Phantom',
    icon: '👻',
    getWindow: () => window.phantom,
    isInstalled: () => typeof window.phantom !== 'undefined',
    chainType: 'evm',
    // Phantom now supports EVM chains (Polygon) natively
    getProvider: () => {
      if (window.phantom?.ethereum) return window.phantom.ethereum;
      if (window.phantom) return window.phantom;
      return null;
    }
  },
  TRUST: {
    name: 'Trust Wallet',
    icon: '🛡️',
    getWindow: () => window.trustwallet || window.ethereum,
    isInstalled: () => typeof window.trustwallet !== 'undefined' || typeof window.ethereum !== 'undefined',
    chainType: 'evm',
    // Trust Wallet injects as EIP-1193 provider
    getProvider: () => window.trustwallet || window.ethereum
  }
};

export function WalletProvider({ children }) {
  const [address, setAddress] = useState(null);
  const [walletType, setWalletType] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  const connect = useCallback(async (walletName) => {
    setConnecting(true);
    setError(null);

    try {
      let provider = null;
      let accounts = [];

      if (walletName === 'METAMASK') {
        provider = WALLETS.METAMASK.getWindow();
        if (!provider) {
          // Fallback: open MetaMask install page
          window.open('https://metamask.io/download/', '_blank');
          throw new Error('MetaMask not installed. Please install it first.');
        }
        accounts = await provider.request({ method: 'eth_requestAccounts' });

        // Switch to Polygon Amoy testnet (or Polygon mainnet)
        try {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x13882' }] // Polygon Amoy testnet (80002)
          });
        } catch (switchError) {
          // Chain not added — add it
          if (switchError.code === 4902) {
            await provider.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x13882',
                chainName: 'Polygon Amoy Testnet',
                nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
                rpcUrls: ['https://rpc-amoy.polygon.technology'],
                blockExplorerUrls: ['https://www.oklink.com/amoy']
              }]
            });
          }
        }
      } else if (walletName === 'PHANTOM') {
        provider = WALLETS.PHANTOM.getProvider();
        if (!provider) {
          window.open('https://phantom.app/download', '_blank');
          throw new Error('Phantom not installed. Please install it first.');
        }

        // Phantom EVM — request accounts
        if (provider.request) {
          accounts = await provider.request({ method: 'eth_requestAccounts' });
        } else if (provider.connect) {
          const resp = await provider.connect();
          accounts = [resp.publicKey || resp.address];
        }

        // Try switching to Polygon Amoy
        if (provider.request) {
          try {
            await provider.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0x13882' }]
            });
          } catch (e) {
            if (e.code === 4902 && provider.request) {
              await provider.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: '0x13882',
                  chainName: 'Polygon Amoy Testnet',
                  nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
                  rpcUrls: ['https://rpc-amoy.polygon.technology'],
                  blockExplorerUrls: ['https://www.oklink.com/amoy']
                }]
              });
            }
          }
        }
      } else if (walletName === 'TRUST') {
        provider = WALLETS.TRUST.getProvider();
        if (!provider) {
          window.open('https://trustwallet.com/download', '_blank');
          throw new Error('Trust Wallet not installed. Please install it first.');
        }

        accounts = await provider.request({ method: 'eth_requestAccounts' });

        // Trust Wallet usually has Polygon pre-configured
        try {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x13882' }]
          });
        } catch (e) {
          if (e.code === 4902) {
            await provider.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x13882',
                chainName: 'Polygon Amoy Testnet',
                nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
                rpcUrls: ['https://rpc-amoy.polygon.technology'],
                blockExplorerUrls: ['https://www.oklink.com/amoy']
              }]
            });
          }
        }
      }

      if (accounts && accounts.length > 0) {
        setAddress(accounts[0]);
        setWalletType(walletName);
        // Store in localStorage for reconnection
        localStorage.setItem('oddify_wallet', walletName);
        localStorage.setItem('oddify_address', accounts[0]);
      }
    } catch (err) {
      console.error(`${walletName} connection error:`, err);
      setError(err.message || `Failed to connect ${WALLETS[walletName].name}`);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setWalletType(null);
    localStorage.removeItem('oddify_wallet');
    localStorage.removeItem('oddify_address');
  }, []);

  const reconnect = useCallback(() => {
    const savedWallet = localStorage.getItem('oddify_wallet');
    const savedAddress = localStorage.getItem('oddify_address');
    if (savedWallet && savedAddress) {
      setAddress(savedAddress);
      setWalletType(savedWallet);
    }
  }, []);

  // Auto-reconnect on mount
  if (typeof window !== 'undefined' && !address) {
    reconnect();
  }

  return (
    <WalletContext.Provider value={{
      address,
      walletType,
      walletName: walletType ? WALLETS[walletType].name : null,
      connecting,
      error,
      connect,
      disconnect,
      wallets: WALLETS
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
