import './globals.css';
import { WalletProvider } from '../lib/wallet';

export const metadata = {
  title: 'Oddify Exchange — P2P Prediction Markets',
  description: 'Trade crypto up/down prediction markets with an AMM. Zero capital, wallet-based, API for developers.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <nav className="navbar">
            <div className="logo">Oddify<span>.exchange</span></div>
            <div className="nav-links">
              <a href="/">Markets</a>
              <a href="/create">Create Market</a>
              <a href="/portfolio">Portfolio</a>
              <a href="/docs">API Docs</a>
              <WalletButton />
            </div>
          </nav>
          <main>{children}</main>
          <footer>
            <p>Oddify Exchange — AMM-based prediction markets on Polygon</p>
          </footer>
        </WalletProvider>
      </body>
    </html>
  );
}

import WalletButton from '../components/WalletButton';
