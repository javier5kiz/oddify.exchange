var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/routes/markets.js
import express from "express";
function marketRoutes(marketManager2) {
  const router = express.Router();
  router.get("/", (req, res) => {
    const { type } = req.query;
    let markets;
    if (type === "crypto") {
      markets = marketManager2.getMarketsByType(true);
    } else if (type === "community") {
      markets = marketManager2.getMarketsByType(false);
    } else {
      markets = marketManager2.getActiveMarkets();
    }
    res.json({
      count: markets.length,
      data: markets.map((m) => ({
        id: m.id,
        question: m.question,
        symbol: m.symbol,
        strikePrice: m.strikePrice,
        direction: m.direction,
        isCryptoMarket: m.isCryptoMarket,
        status: m.status,
        expiryTime: m.expiryTime,
        prices: marketManager2.getPrices(m.id)
      }))
    });
  });
  router.get("/:id", (req, res) => {
    const market = marketManager2.getMarket(req.params.id);
    if (!market) {
      return res.status(404).json({ error: "Market not found" });
    }
    res.json({
      ...market,
      prices: marketManager2.getPrices(market.id)
    });
  });
  router.post("/", async (req, res) => {
    const { question, symbol, strikePrice, direction, expiryMinutes, isCryptoMarket, creator } = req.body;
    if (!question || !expiryMinutes) {
      return res.status(400).json({ error: "Missing required fields: question, expiryMinutes" });
    }
    try {
      const market = await marketManager2.createMarket({
        question,
        symbol,
        strikePrice,
        direction,
        expiryMinutes,
        isCryptoMarket: isCryptoMarket ?? true,
        creator: creator || "0x0000000000000000000000000000000000000000"
      });
      res.status(201).json({ data: market });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  router.get("/:id/prices", (req, res) => {
    const prices = marketManager2.getPrices(req.params.id);
    if (!prices) {
      return res.status(404).json({ error: "Market not found" });
    }
    res.json(prices);
  });
  router.get("/:id/history", (req, res) => {
    const market = marketManager2.getMarket(req.params.id);
    if (!market) {
      return res.status(404).json({ error: "Market not found" });
    }
    res.json({ data: market.priceHistory || [] });
  });
  router.post("/:id/resolve", (req, res) => {
    const { winningOutcome } = req.body;
    if (!winningOutcome || !["YES", "NO"].includes(winningOutcome)) {
      return res.status(400).json({ error: "winningOutcome must be YES or NO" });
    }
    try {
      const market = marketManager2.resolveCommunityMarket(req.params.id, winningOutcome);
      res.json({ data: market });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  return router;
}
var init_markets = __esm({
  "src/routes/markets.js"() {
  }
});

// src/routes/orders.js
import express2 from "express";
function orderRoutes(marketManager2) {
  const router = express2.Router();
  router.post("/buy", async (req, res) => {
    const { marketId, outcome, usdcAmount, wallet } = req.body;
    if (!marketId || !outcome || !usdcAmount) {
      return res.status(400).json({ error: "Missing required fields: marketId, outcome, usdcAmount" });
    }
    if (!["YES", "NO"].includes(outcome)) {
      return res.status(400).json({ error: "outcome must be YES or NO" });
    }
    try {
      const result = marketManager2.buyShares(marketId, outcome, Number(usdcAmount));
      const market = marketManager2.getMarket(marketId);
      let onChainData = null;
      if (market?.contractAddress) {
        onChainData = {
          contractAddress: market.contractAddress,
          method: "buyShares",
          args: [outcome === "YES" ? 0 : 1, usdcAmount, 0],
          message: "Execute this transaction on-chain to finalize"
        };
      }
      res.json({
        data: {
          marketId,
          outcome,
          usdcIn: usdcAmount,
          sharesOut: result.sharesOut,
          newPrices: marketManager2.getPrices(marketId),
          onChain: onChainData
        }
      });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  router.post("/sell", async (req, res) => {
    const { marketId, outcome, sharesAmount, wallet } = req.body;
    if (!marketId || !outcome || !sharesAmount) {
      return res.status(400).json({ error: "Missing required fields: marketId, outcome, sharesAmount" });
    }
    const market = marketManager2.getMarket(marketId);
    if (!market) {
      return res.status(404).json({ error: "Market not found" });
    }
    res.json({
      data: {
        marketId,
        outcome,
        sharesIn: sharesAmount,
        newPrices: marketManager2.getPrices(marketId),
        onChain: market.contractAddress ? {
          contractAddress: market.contractAddress,
          method: "sellShares",
          args: [outcome === "YES" ? 0 : 1, sharesAmount, 0],
          message: "Execute this transaction on-chain to finalize"
        } : null
      }
    });
  });
  router.get("/:wallet", async (req, res) => {
    const wallet = req.params.wallet;
    const positions = [];
    for (const [id, market] of marketManager2.markets) {
      if (market.contractAddress && marketManager2.contracts) {
        try {
          const balances = await marketManager2.contracts.getUserPositions(market.contractAddress, wallet);
          if (balances.yes > 0 || balances.no > 0) {
            positions.push({
              marketId: id,
              question: market.question,
              yesShares: balances.yes,
              noShares: balances.no,
              status: market.status,
              winningOutcome: market.winningOutcome
            });
          }
        } catch (e) {
        }
      }
    }
    res.json({ data: positions });
  });
  return router;
}
var init_orders = __esm({
  "src/routes/orders.js"() {
  }
});

// src/routes/prices.js
import express3 from "express";
function priceRoutes(oracle2) {
  const router = express3.Router();
  router.get("/", (req, res) => {
    res.json({ data: oracle2.getAllPrices() });
  });
  router.get("/:symbol", (req, res) => {
    const ticker = oracle2.getTicker(req.params.symbol);
    if (!ticker) {
      return res.status(404).json({ error: `Symbol ${req.params.symbol} not found` });
    }
    res.json({ data: ticker });
  });
  router.get("/:symbol/history", async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    const interval = req.query.interval || "1m";
    const limit = req.query.limit || 60;
    try {
      const response = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
      );
      const data = await response.json();
      const candles = data.map((k) => ({
        time: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));
      res.json({ data: candles });
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch price history" });
    }
  });
  return router;
}
var init_prices = __esm({
  "src/routes/prices.js"() {
  }
});

// src/routes/users.js
import express4 from "express";
function userRoutes(contracts2) {
  const router = express4.Router();
  router.get("/:wallet", async (req, res) => {
    const wallet = req.params.wallet;
    let positions = [];
    if (contracts2?.factory) {
      try {
        const allMarkets = await contracts2.getAllMarkets();
        for (const market of allMarkets) {
          const balances = await contracts2.getUserPositions(market.address, wallet);
          if (balances.yes > 0 || balances.no > 0) {
            positions.push({
              marketAddress: market.address,
              question: market.question,
              yesShares: balances.yes,
              noShares: balances.no,
              status: market.status,
              prices: market.prices
            });
          }
        }
      } catch (e) {
      }
    }
    res.json({
      data: {
        wallet,
        positions,
        apiKey: `odf_${wallet.slice(2, 10)}`
      }
    });
  });
  router.post("/register", (req, res) => {
    const { wallet, signature, message } = req.body;
    if (!wallet) {
      return res.status(400).json({ error: "Wallet address required" });
    }
    res.status(201).json({
      data: {
        wallet,
        registered: true,
        apiKey: `odf_${wallet.slice(2, 10)}_${Date.now().toString(36)}`
      }
    });
  });
  return router;
}
var init_users = __esm({
  "src/routes/users.js"() {
  }
});

// src/routes/docs.js
import express5 from "express";
function apiDocsRoute() {
  const router = express5.Router();
  router.get("/", (req, res) => {
    res.json({
      name: "Oddify Exchange API",
      version: "1.0.0",
      baseUrl: "/api/v1",
      description: "P2P Prediction Platform with AMM \u2014 trade crypto up/down prediction markets",
      endpoints: {
        markets: {
          "GET /markets": "List all active markets",
          "GET /markets?type=crypto": "List crypto markets only",
          "GET /markets?type=community": "List community prediction markets",
          "GET /markets/:id": "Get a specific market",
          "POST /markets": "Create a new market (requires wallet auth)",
          "GET /markets/:id/prices": "Get current AMM YES/NO prices",
          "GET /markets/:id/history": "Get price history for charting",
          "POST /markets/:id/resolve": "Resolve community market (admin only)"
        },
        orders: {
          "POST /orders/buy": "Buy YES or NO shares from AMM pool",
          "POST /orders/sell": "Sell shares back to AMM pool",
          "GET /orders/:wallet": "Get user positions"
        },
        prices: {
          "GET /prices": "All current Binance prices",
          "GET /prices/:symbol": "Get price for specific symbol (e.g. BTCUSDT)",
          "GET /prices/:symbol/history": "Get candlestick history"
        },
        users: {
          "GET /users/:wallet": "Get user profile",
          "POST /users/register": "Register wallet (returns API key)"
        },
        websocket: {
          "WS /stream": "Real-time price + market updates",
          'msg {type:"subscribe", channel:"prices"}': "Subscribe to price feed"
        }
      },
      rateLimit: "100 requests/minute (free tier)",
      auth: "Wallet-based \u2014 sign message with your wallet to get API key"
    });
  });
  return router;
}
var init_docs = __esm({
  "src/routes/docs.js"() {
  }
});

// src/services/binanceOracle.js
import WebSocket from "ws";
var BinanceOracle;
var init_binanceOracle = __esm({
  "src/services/binanceOracle.js"() {
    BinanceOracle = class {
      constructor() {
        this.wsUrl = process.env.BINANCE_WS_URL || "wss://stream.binance.com:9443/ws";
        this.ws = null;
        this.prices = {};
        this.listeners = [];
        this.reconnectAttempts = 0;
      }
      connect() {
        const streams = [
          "btcusdt@ticker",
          "ethusdt@ticker",
          "solusdt@ticker",
          "bnbusdt@ticker",
          "xrpusdt@ticker",
          "adausdt@ticker",
          "dogeusdt@ticker",
          "avaxusdt@ticker"
        ].join("/");
        const url = `${this.wsUrl}/${streams}`;
        console.log("Connecting to Binance WebSocket...");
        this.ws = new WebSocket(url);
        this.ws.on("open", () => {
          console.log("\u2705 Binance Oracle connected");
          this.reconnectAttempts = 0;
        });
        this.ws.on("message", (data) => {
          try {
            const ticker = JSON.parse(data.toString());
            if (ticker.c) {
              this.prices[ticker.s] = {
                symbol: ticker.s,
                price: parseFloat(ticker.c),
                priceChange: parseFloat(ticker.p),
                priceChangePercent: parseFloat(ticker.P),
                high: parseFloat(ticker.h),
                low: parseFloat(ticker.l),
                volume: parseFloat(ticker.v),
                timestamp: Date.now()
              };
              this.listeners.forEach((fn) => fn(this.prices[ticker.s]));
            }
          } catch (e) {
          }
        });
        this.ws.on("close", () => {
          console.log("\u26A0\uFE0F Binance WebSocket disconnected, reconnecting...");
          this.reconnectAttempts++;
          setTimeout(() => this.connect(), Math.min(5e3 * this.reconnectAttempts, 3e4));
        });
        this.ws.on("error", (err) => {
          console.error("Binance WS error:", err.message);
        });
      }
      /**
       * Get current price for a symbol (e.g. "BTCUSDT")
       */
      getPrice(symbol) {
        return this.prices[symbol.toUpperCase()]?.price || null;
      }
      /**
       * Get full ticker data for a symbol
       */
      getTicker(symbol) {
        return this.prices[symbol.toUpperCase()] || null;
      }
      /**
       * Get all current prices
       */
      getAllPrices() {
        return this.prices;
      }
      /**
       * Register a listener for price updates (used by MarketManager)
       */
      onPriceUpdate(fn) {
        this.listeners.push(fn);
      }
      /**
       * Check if BTC was above or below a strike price at a given time.
       * Used for crypto up/down market settlement.
       */
      evaluateCryptoMarket(symbol, strikePrice, direction) {
        const currentPrice = this.getPrice(symbol);
        if (!currentPrice) return null;
        if (direction === "UP") {
          return currentPrice > strikePrice;
        } else {
          return currentPrice < strikePrice;
        }
      }
    };
  }
});

// src/services/contractService.js
import { ethers } from "ethers";
var FACTORY_ABI, MARKET_ABI, ERC20_ABI, ContractService;
var init_contractService = __esm({
  "src/services/contractService.js"() {
    FACTORY_ABI = [
      "function createMarket(string question, bytes32 oracleId, uint256 expiryTime, uint256 resolveTime, bool isCryptoMarket) returns (address)",
      "function allMarkets(uint256) view returns (address)",
      "function getMarketCount() view returns (uint256)",
      "function marketByOracleId(bytes32) view returns (address)",
      "function owner() view returns (address)",
      "function oracle() view returns (address)",
      "function setOracle(address)",
      "event MarketCreated(address indexed marketAddress, string question, bytes32 oracleId, uint256 expiryTime, bool isCryptoMarket, address creator)"
    ];
    MARKET_ABI = [
      "function buyShares(uint8 outcome, uint256 usdcIn, uint256 minShares)",
      "function sellShares(uint8 outcome, uint256 sharesIn, uint256 minUsdc)",
      "function addInitialLiquidity(uint256 usdcAmount)",
      "function getYesPrice() view returns (uint256)",
      "function getNoPrice() view returns (uint256)",
      "function resolveMarket(uint8 winningOutcome)",
      "function claimWinnings()",
      "function withdrawLiquidity()",
      "function yesReserve() view returns (uint256)",
      "function noReserve() view returns (uint256)",
      "function totalYesSupply() view returns (uint256)",
      "function totalNoSupply() view returns (uint256)",
      "function market() view returns (string question, bytes32 oracleId, uint256 expiryTime, uint256 resolveTime, uint8 status, uint8 winningOutcome, bool isCryptoMarket, address creator, uint256 feeBps)",
      "event SharesPurchased(address buyer, uint8 outcome, uint256 usdcIn, uint256 sharesOut)",
      "event SharesSold(address seller, uint8 outcome, uint256 sharesIn, uint256 usdcOut)",
      "event MarketResolved(uint8 winningOutcome, uint256 yesPrice, uint256 noPrice)",
      "event WinningsClaimed(address user, uint256 amount)"
    ];
    ERC20_ABI = [
      "function approve(address spender, uint256 amount) returns (bool)",
      "function allowance(address owner, address spender) view returns (uint256)",
      "function balanceOf(address) view returns (uint256)",
      "function transfer(address to, uint256 amount) returns (bool)"
    ];
    ContractService = class {
      constructor() {
        this.rpcUrl = process.env.POLYGON_RPC || "https://rpc-amoy.polygon.technology";
        this.factoryAddress = process.env.FACTORY_ADDRESS || "";
        this.usdcAddress = process.env.USDC_ADDRESS || "";
        this.privateKey = process.env.PRIVATE_KEY || "";
        this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
        this.signer = this.privateKey ? new ethers.Wallet(this.privateKey, this.provider) : null;
        this.factory = this.factoryAddress ? new ethers.Contract(this.factoryAddress, FACTORY_ABI, this.signer || this.provider) : null;
        this.usdc = this.usdcAddress ? new ethers.Contract(this.usdcAddress, ERC20_ABI, this.signer || this.provider) : null;
      }
      /**
       * Create a market on-chain via the MarketFactory contract
       */
      async createMarketOnChain({ question, oracleId, expiryTime, resolveTime, isCryptoMarket }) {
        if (!this.factory || !this.signer) {
          throw new Error("Factory contract or signer not configured");
        }
        const oracleIdHash = ethers.id(oracleId);
        const tx = await this.factory.createMarket(
          question,
          oracleIdHash,
          expiryTime,
          resolveTime,
          isCryptoMarket
        );
        const receipt = await tx.wait();
        const event = receipt.logs.find((log) => {
          try {
            const parsed = this.factory.interface.parseLog(log);
            return parsed.name === "MarketCreated";
          } catch {
            return false;
          }
        });
        if (event) {
          const parsed = this.factory.interface.parseLog(event);
          return {
            marketAddress: parsed.args.marketAddress,
            question: parsed.args.question,
            oracleId: parsed.args.oracleId,
            expiryTime: Number(parsed.args.expiryTime),
            txHash: tx.hash
          };
        }
        return { txHash: tx.hash };
      }
      /**
       * Get market contract instance
       */
      getMarketContract(marketAddress, useSigner = false) {
        return new ethers.Contract(
          marketAddress,
          MARKET_ABI,
          useSigner && this.signer ? this.signer : this.provider
        );
      }
      /**
       * Get on-chain market info
       */
      async getMarketInfo(marketAddress) {
        const market = this.getMarketContract(marketAddress);
        const [question, oracleId, expiryTime, resolveTime, status, winningOutcome, isCryptoMarket, creator, feeBps] = await market.market();
        const yesPrice = await market.getYesPrice();
        const noPrice = await market.getNoPrice();
        const yesReserve = await market.yesReserve();
        const noReserve = await market.noReserve();
        return {
          address: marketAddress,
          question,
          oracleId,
          expiryTime: Number(expiryTime),
          resolveTime: Number(resolveTime),
          status: ["ACTIVE", "SETTLING", "RESOLVED", "CANCELLED"][status],
          winningOutcome: winningOutcome === 0 ? "YES" : "NO",
          isCryptoMarket,
          creator,
          feeBps: Number(feeBps),
          prices: {
            yes: Number(yesPrice) / 1e18,
            no: Number(noPrice) / 1e18
          },
          reserves: {
            yes: Number(yesReserve) / 1e18,
            no: Number(noReserve) / 1e18
          }
        };
      }
      /**
       * Resolve a crypto market using Binance oracle price.
       * Called by the backend oracle wallet.
       */
      async resolveMarket(marketAddress, winningOutcome) {
        if (!this.signer) throw new Error("Signer not configured \u2014 set PRIVATE_KEY");
        const market = this.getMarketContract(marketAddress, true);
        const outcomeEnum = winningOutcome === "YES" ? 0 : 1;
        const tx = await market.resolveMarket(outcomeEnum);
        await tx.wait();
        console.log(`\u2705 Market ${marketAddress} resolved: ${winningOutcome}`);
        return { txHash: tx.hash, winningOutcome };
      }
      /**
       * Get all markets from the factory
       */
      async getAllMarkets() {
        if (!this.factory) return [];
        const count = await this.factory.getMarketCount();
        const markets = [];
        for (let i = 0; i < count; i++) {
          const addr = await this.factory.allMarkets(i);
          try {
            const info = await this.getMarketInfo(addr);
            markets.push(info);
          } catch (e) {
            console.error(`Failed to fetch market ${addr}:`, e.message);
          }
        }
        return markets;
      }
      /**
       * Set the oracle address (backend wallet that can resolve markets)
       */
      async setOracleAddress(oracleAddress) {
        if (!this.factory || !this.signer) throw new Error("Factory or signer not configured");
        const tx = await this.factory.setOracle(oracleAddress);
        await tx.wait();
        return { txHash: tx.hash };
      }
      /**
       * Check if user needs USDC approval before buying shares
       */
      async checkAndApproveUSDC(marketAddress, userAddress, amount) {
        if (!this.usdc) return { needsApproval: false };
        const allowance = await this.usdc.allowance(userAddress, marketAddress);
        if (allowance >= amount) {
          return { needsApproval: false, allowance: Number(allowance) };
        }
        return {
          needsApproval: true,
          message: "User must approve USDC spending for this market",
          approveFunction: this.usdc.interface.encodeFunctionData("approve", [marketAddress, amount])
        };
      }
      /**
       * Get user's share balances for a market
       */
      async getUserPositions(marketAddress, userAddress) {
        const market = this.getMarketContract(marketAddress);
        const yesBalance = await market.yesBalances(userAddress);
        const noBalance = await market.noBalances(userAddress);
        return {
          yes: Number(yesBalance) / 1e18,
          no: Number(noBalance) / 1e18
        };
      }
    };
  }
});

// src/services/marketManager.js
import { ethers as ethers2 } from "ethers";
var MarketManager;
var init_marketManager = __esm({
  "src/services/marketManager.js"() {
    init_contractService();
    MarketManager = class {
      constructor(oracle2, contracts2 = null) {
        this.oracle = oracle2;
        this.contracts = contracts2 || new ContractService();
        this.markets = /* @__PURE__ */ new Map();
        this.marketId = 1;
        this._seedDemoMarkets();
        this.oracle.onPriceUpdate((ticker) => {
          this.checkCryptoMarketSettlements(ticker);
        });
      }
      _seedDemoMarkets() {
        const now = Date.now();
        const markets = [
          {
            question: "Will BTC be above $65,000 in 1 hour?",
            symbol: "BTCUSDT",
            strikePrice: 65e3,
            direction: "UP",
            expiryMinutes: 60,
            isCryptoMarket: true
          },
          {
            question: "Will ETH be above $3,500 in 30 minutes?",
            symbol: "ETHUSDT",
            strikePrice: 3500,
            direction: "UP",
            expiryMinutes: 30,
            isCryptoMarket: true
          },
          {
            question: "Will SOL be above $150 in 2 hours?",
            symbol: "SOLUSDT",
            strikePrice: 150,
            direction: "UP",
            expiryMinutes: 120,
            isCryptoMarket: true
          }
        ];
        for (const m of markets) {
          const id = this.marketId++;
          const expiryTime = now + m.expiryMinutes * 60 * 1e3;
          this.markets.set(String(id), {
            id: String(id),
            question: m.question,
            symbol: m.symbol,
            strikePrice: m.strikePrice,
            direction: m.direction,
            isCryptoMarket: m.isCryptoMarket,
            creator: "0x0000000000000000000000000000000000000000",
            status: "ACTIVE",
            createdAt: now,
            expiryTime,
            resolveTime: expiryTime + 6e4,
            oracleId: `${m.symbol}-${m.strikePrice}-${m.direction}`,
            // AMM state — 1000 USDC initial liquidity on each side
            yesReserve: 1e3,
            noReserve: 1e3,
            k: 1e6,
            contractAddress: null,
            priceHistory: [{ time: now, yesPrice: 0.5, noPrice: 0.5 }]
          });
        }
      }
      /**
       * Create a new prediction market (on-chain + in-memory cache)
       */
      async createMarket({ question, symbol, strikePrice, direction, expiryMinutes, isCryptoMarket, creator }) {
        const id = this.marketId++;
        const now = Date.now();
        const expiryTime = now + expiryMinutes * 60 * 1e3;
        const resolveTime = expiryTime + 60 * 1e3;
        const oracleId = `${symbol}-${strikePrice}-${direction}-${Math.floor(expiryTime / 1e3)}`;
        const market = {
          id: String(id),
          question,
          symbol: symbol?.toUpperCase(),
          strikePrice,
          direction,
          isCryptoMarket,
          creator,
          status: "ACTIVE",
          createdAt: now,
          expiryTime,
          resolveTime,
          oracleId,
          yesReserve: 1e3,
          noReserve: 1e3,
          k: 1e6,
          contractAddress: null,
          priceHistory: [{ time: now, yesPrice: 0.5, noPrice: 0.5 }]
        };
        if (this.contracts?.factory && this.contracts?.signer) {
          try {
            const onChainResult = await this.contracts.createMarketOnChain({
              question,
              oracleId,
              expiryTime: Math.floor(expiryTime / 1e3),
              resolveTime: Math.floor(resolveTime / 1e3),
              isCryptoMarket
            });
            market.contractAddress = onChainResult.marketAddress || null;
            console.log(`\u{1F4CB} Market created on-chain: ${market.contractAddress}`);
          } catch (e) {
            console.error("On-chain market creation failed:", e.message);
          }
        }
        this.markets.set(String(id), market);
        return market;
      }
      getActiveMarkets() {
        return Array.from(this.markets.values()).filter((m) => m.status === "ACTIVE");
      }
      getMarket(id) {
        return this.markets.get(String(id));
      }
      /**
       * AMM price — matches smart contract formula.
       * P(YES) = noReserve / (yesReserve + noReserve)
       * Buying YES reduces yesReserve → P(YES) goes UP.
       */
      getPrices(marketId) {
        const m = this.markets.get(String(marketId));
        if (!m) return null;
        const total = m.yesReserve + m.noReserve;
        if (total === 0) return { yes: 0.5, no: 0.5, yesPrice: 0.5, noPrice: 0.5 };
        return {
          yes: m.noReserve / total,
          no: m.yesReserve / total,
          yesPrice: m.noReserve / total,
          noPrice: m.yesReserve / total
        };
      }
      /**
       * Buy shares from the AMM using constant product formula (k = yesReserve * noReserve).
       * Buying YES: USDC goes to NO side, YES shares come out.
       * Buying NO: USDC goes to YES side, NO shares come out.
       */
      buyShares(marketId, outcome, usdcAmount) {
        const m = this.markets.get(String(marketId));
        if (!m) throw new Error("Market not found");
        if (m.status !== "ACTIVE") throw new Error("Market not active");
        if (Date.now() > m.expiryTime) throw new Error("Market expired");
        let sharesOut;
        if (outcome === "YES") {
          const newNoReserve = m.noReserve + usdcAmount;
          const newYesReserve = m.k / newNoReserve;
          sharesOut = m.yesReserve - newYesReserve;
          m.yesReserve = newYesReserve;
          m.noReserve = newNoReserve;
        } else {
          const newYesReserve = m.yesReserve + usdcAmount;
          const newNoReserve = m.k / newYesReserve;
          sharesOut = m.noReserve - newNoReserve;
          m.yesReserve = newYesReserve;
          m.noReserve = newNoReserve;
        }
        m.k = m.yesReserve * m.noReserve;
        const total = m.yesReserve + m.noReserve;
        m.priceHistory.push({
          time: Date.now(),
          yesPrice: m.noReserve / total,
          noPrice: m.yesReserve / total
        });
        if (m.priceHistory.length > 100) {
          m.priceHistory = m.priceHistory.slice(-100);
        }
        return { sharesOut, market: m };
      }
      /**
       * Check expired crypto markets and settle them via Binance oracle.
       */
      async checkCryptoMarketSettlements(ticker) {
        for (const [id, m] of this.markets) {
          if (m.status !== "ACTIVE" || !m.isCryptoMarket) continue;
          if (Date.now() < m.expiryTime) continue;
          const currentPrice = this.oracle.getPrice(m.symbol);
          if (!currentPrice) continue;
          let winningOutcome;
          if (m.direction === "UP") {
            winningOutcome = currentPrice >= m.strikePrice ? "YES" : "NO";
          } else {
            winningOutcome = currentPrice <= m.strikePrice ? "YES" : "NO";
          }
          m.status = "RESOLVED";
          m.winningOutcome = winningOutcome;
          m.resolvedPrice = currentPrice;
          m.resolvedAt = Date.now();
          console.log(`\u{1F4CA} Market ${id} resolved: ${winningOutcome} (price: $${currentPrice} vs strike: $${m.strikePrice})`);
          if (m.contractAddress && this.contracts?.signer) {
            try {
              await this.contracts.resolveMarket(m.contractAddress, winningOutcome);
              console.log(`\u2705 Market ${id} settled on-chain`);
            } catch (e) {
              console.error(`\u274C On-chain settlement failed for market ${id}:`, e.message);
            }
          }
        }
      }
      resolveCommunityMarket(marketId, winningOutcome) {
        const m = this.markets.get(String(marketId));
        if (!m) throw new Error("Market not found");
        if (m.isCryptoMarket) throw new Error("Use auto-settlement for crypto markets");
        if (m.status !== "ACTIVE") throw new Error("Market not active");
        m.status = "RESOLVED";
        m.winningOutcome = winningOutcome;
        m.resolvedAt = Date.now();
        return m;
      }
      getMarketsByType(isCrypto) {
        return Array.from(this.markets.values()).filter((m) => m.isCryptoMarket === isCrypto && m.status === "ACTIVE");
      }
    };
  }
});

// src/middleware/errorHandler.js
function notFound(req, res) {
  res.status(404).json({ error: "Endpoint not found", path: req.path });
}
function errorHandler(err, req, res, next) {
  console.error("Error:", err.message);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error"
  });
}
var init_errorHandler = __esm({
  "src/middleware/errorHandler.js"() {
  }
});

// src/server.js
var server_exports = {};
__export(server_exports, {
  app: () => app,
  server: () => server
});
import "dotenv/config";
import express6 from "express";
import cors from "cors";
import http from "http";
import { WebSocketServer } from "ws";
var app, server, PORT, oracle, contracts, marketManager, wss;
var init_server = __esm({
  "src/server.js"() {
    init_markets();
    init_orders();
    init_prices();
    init_users();
    init_docs();
    init_binanceOracle();
    init_marketManager();
    init_contractService();
    init_errorHandler();
    app = express6();
    server = http.createServer(app);
    PORT = process.env.PORT || 3e3;
    app.use(cors());
    app.use(express6.json());
    oracle = new BinanceOracle();
    contracts = new ContractService();
    marketManager = new MarketManager(oracle, contracts);
    if (process.env.FACTORY_ADDRESS) {
      console.log("\u{1F4CB} Factory contract:", process.env.FACTORY_ADDRESS);
      console.log("\u{1F4CB} USDC contract:", process.env.USDC_ADDRESS || "not set");
    }
    oracle.connect();
    app.use("/api/v1/markets", marketRoutes(marketManager));
    app.use("/api/v1/orders", orderRoutes(marketManager));
    app.use("/api/v1/prices", priceRoutes(oracle));
    app.use("/api/v1/users", userRoutes(contracts));
    app.use("/api/v1/docs", apiDocsRoute());
    app.get("/health", (req, res) => {
      res.json({
        status: "ok",
        uptime: process.uptime(),
        binanceConnected: oracle.ws?.readyState === 1,
        factory: process.env.FACTORY_ADDRESS || "not configured",
        network: process.env.POLYGON_RPC?.includes("amoy") ? "amoy-testnet" : "mainnet"
      });
    });
    app.use(notFound);
    app.use(errorHandler);
    if (process.env.VERCEL) {
      console.log("Running as Vercel serverless function (REST only)");
    } else {
      server.listen(PORT, () => {
        console.log(`Oddify Exchange API running on port ${PORT}`);
        console.log(`API Docs: http://localhost:${PORT}/api/v1/docs`);
        console.log(`WebSocket: ws://localhost:${PORT}/api/v1/stream`);
      });
    }
    wss = new WebSocketServer({ server, path: "/api/v1/stream" });
    wss.on("connection", (ws) => {
      console.log("WebSocket client connected");
      const priceInterval = setInterval(() => {
        const prices = oracle.getAllPrices();
        ws.send(JSON.stringify({ type: "prices", data: prices }));
      }, 2e3);
      ws.on("message", (msg) => {
        const data = JSON.parse(msg.toString());
        if (data.type === "subscribe") {
          ws.send(JSON.stringify({ type: "subscribed", channel: data.channel }));
        }
      });
      ws.on("close", () => {
        clearInterval(priceInterval);
        console.log("WebSocket client disconnected");
      });
    });
  }
});

// api-entry.js
async function handler(req, res) {
  try {
    const { app: app2 } = await Promise.resolve().then(() => (init_server(), server_exports));
    return app2(req, res);
  } catch (err) {
    console.error("[api] Cold start error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Function failed to start: " + (err?.message || String(err)) });
    }
  }
}
export {
  handler as default
};
