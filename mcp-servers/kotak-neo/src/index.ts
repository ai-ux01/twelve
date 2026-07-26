import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BFF_BASE = "http://localhost:4000/api/kotak-neo";
const QUANT_BASE = "http://localhost:8000";

// Helper: make request to our BFF
async function bffRequest(path: string, options: RequestInit = {}) {
  const url = `${BFF_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`BFF ${res.status}: ${text}`);
  }
  return res.json();
}

// Helper: make request to quant engine
async function quantRequest(path: string) {
  const url = `${QUANT_BASE}${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Quant ${res.status}: ${await res.text()}`);
  return res.json();
}

const server = new McpServer({
  name: "kotak-neo-mcp-server",
  version: "1.0.0",
});

// ==================== CONNECTION STATUS ====================
server.tool(
  "get_connection_status",
  "Get Kotak Neo connection status",
  {},
  async () => {
    const data = await bffRequest("/status");
    return {
      content: [{ type: "text", text: `Kotak Neo Status:\n• Connected: ${data.connected}\n• User: ${data.greetingName || "N/A"}\n• Base URL: ${data.baseUrl || "N/A"}\n• Data Center: ${data.dataCenter || "N/A"}` }],
    };
  }
);

// ==================== PORTFOLIO ====================
server.tool(
  "get_holdings",
  "Get current stock holdings from Kotak Neo DEMAT account",
  {},
  async () => {
    const data = await bffRequest("/reports/holdings");
    const holdings = data?.data || data || [];
    if (!Array.isArray(holdings) || holdings.length === 0) {
      return { content: [{ type: "text", text: "No holdings found." }] };
    }
    const summary = holdings.map((h: any) =>
      `${h.displaySymbol || h.symbol} | Qty: ${h.quantity} | Avg: ₹${h.averagePrice?.toFixed(2)} | Value: ₹${h.mktValue?.toFixed(2)} | P&L: ₹${h.unrealisedGainLoss?.toFixed(2)}`
    ).join("\n");
    return { content: [{ type: "text", text: `Holdings (${holdings.length}):\n\n${summary}` }] };
  }
);

server.tool(
  "get_positions",
  "Get current day trading positions from Kotak Neo",
  {},
  async () => {
    const data = await bffRequest("/reports/positions");
    const positions = data?.data || data || [];
    if (!Array.isArray(positions) || positions.length === 0) {
      return { content: [{ type: "text", text: "No positions for today." }] };
    }
    const summary = positions.map((p: any) =>
      `${p.trdSym || p.sym} | Qty: ${p.qty} | Buy: ₹${p.buyAmt} | Sell: ₹${p.sellAmt} | Product: ${p.prod}`
    ).join("\n");
    return { content: [{ type: "text", text: `Positions (${positions.length}):\n\n${summary}` }] };
  }
);

// ==================== ORDERS ====================
server.tool(
  "get_orders",
  "Get today's order book from Kotak Neo",
  {},
  async () => {
    const data = await bffRequest("/reports/orders");
    const orders = data?.data || [];
    if (!Array.isArray(orders) || orders.length === 0) {
      return { content: [{ type: "text", text: "No orders today." }] };
    }
    const summary = orders.map((o: any) =>
      `${o.trdSym} | ${o.trnsTp === "B" ? "BUY" : "SELL"} ${o.qty} @ ₹${o.prc} | Status: ${o.ordSt} | ID: ${o.nOrdNo}`
    ).join("\n");
    return { content: [{ type: "text", text: `Orders (${orders.length}):\n\n${summary}` }] };
  }
);

server.tool(
  "place_order",
  "Place a live order on Kotak Neo (BUY/SELL stocks, F&O). Uses the existing authenticated session.",
  {
    trading_symbol: z.string().describe("Trading symbol with suffix (e.g., 'RELIANCE-EQ', 'ITBEES-EQ')"),
    transaction_type: z.enum(["B", "S"]).describe("B=Buy, S=Sell"),
    quantity: z.string().describe("Order quantity as string"),
    price: z.string().default("0").describe("Price (0 for market orders)"),
    order_type: z.enum(["MKT", "L", "SL", "SL-M"]).default("MKT").describe("Order type"),
    product: z.enum(["CNC", "MIS", "NRML"]).default("CNC").describe("Product type"),
    exchange_segment: z.string().default("nse_cm").describe("Exchange segment"),
    is_amo: z.boolean().default(false).describe("After Market Order flag"),
  },
  async ({ trading_symbol, transaction_type, quantity, price, order_type, product, exchange_segment, is_amo }) => {
    const jData = {
      am: is_amo ? "YES" : "NO",
      dq: "0",
      es: exchange_segment,
      mp: "0",
      pc: product,
      pf: "N",
      pr: price,
      pt: order_type,
      qt: quantity,
      rt: "DAY",
      tp: "0",
      ts: trading_symbol,
      tt: transaction_type,
    };
    const data = await bffRequest("/orders/place", {
      method: "POST",
      body: JSON.stringify({ jData }),
    });
    if (data?.stat === "Ok" || data?.nOrdNo) {
      return { content: [{ type: "text", text: `✅ Order placed!\nOrder ID: ${data.nOrdNo}\nSymbol: ${trading_symbol}\nType: ${transaction_type === "B" ? "BUY" : "SELL"} ${quantity} @ ${price === "0" ? "MARKET" : "₹" + price}` }] };
    }
    return { content: [{ type: "text", text: `❌ Order failed: ${data?.emsg || JSON.stringify(data)}` }] };
  }
);

server.tool(
  "cancel_order",
  "Cancel an open/pending order on Kotak Neo",
  {
    order_number: z.string().describe("Nest Order Number to cancel"),
    is_amo: z.boolean().default(false).describe("Is this an AMO order?"),
    trading_symbol: z.string().optional().describe("Trading symbol (required for AMO cancellation)"),
  },
  async ({ order_number, is_amo, trading_symbol }) => {
    const jData: any = { on: order_number, am: is_amo ? "YES" : "NO" };
    if (is_amo && trading_symbol) jData.ts = trading_symbol;
    const data = await bffRequest("/orders/cancel", {
      method: "POST",
      body: JSON.stringify({ jData }),
    });
    if (data?.stat === "Ok") {
      return { content: [{ type: "text", text: `✅ Order ${order_number} cancelled successfully.` }] };
    }
    return { content: [{ type: "text", text: `❌ Cancel failed: ${data?.emsg || JSON.stringify(data)}` }] };
  }
);

server.tool(
  "modify_order",
  "Modify an existing open order on Kotak Neo",
  {
    order_number: z.string().describe("Nest Order Number to modify"),
    trading_symbol: z.string().describe("Trading symbol"),
    exchange_segment: z.string().default("nse_cm").describe("Exchange segment"),
    transaction_type: z.enum(["B", "S"]).describe("B=Buy, S=Sell"),
    quantity: z.string().describe("New quantity"),
    price: z.string().describe("New price"),
    order_type: z.enum(["MKT", "L", "SL", "SL-M"]).default("L").describe("Order type"),
    product: z.enum(["CNC", "MIS", "NRML"]).default("CNC").describe("Product type"),
  },
  async ({ order_number, trading_symbol, exchange_segment, transaction_type, quantity, price, order_type, product }) => {
    const jData = {
      no: order_number,
      ts: trading_symbol,
      es: exchange_segment,
      tt: transaction_type,
      qt: quantity,
      pr: price,
      pt: order_type,
      pc: product,
      mp: "0",
      dq: "0",
      tp: "0",
      rt: "DAY",
      am: "NO",
      pf: "N",
    };
    const data = await bffRequest("/orders/modify", {
      method: "POST",
      body: JSON.stringify({ jData }),
    });
    if (data?.stat === "Ok" || data?.nOrdNo) {
      return { content: [{ type: "text", text: `✅ Order ${order_number} modified. New ID: ${data.nOrdNo}` }] };
    }
    return { content: [{ type: "text", text: `❌ Modify failed: ${data?.emsg || JSON.stringify(data)}` }] };
  }
);

// ==================== FUNDS ====================
server.tool(
  "get_limits",
  "Get available margin/funds from Kotak Neo account",
  {},
  async () => {
    const data = await bffRequest("/funds/limits", {
      method: "POST",
      body: JSON.stringify({ jData: { seg: "ALL", exch: "ALL", prod: "ALL" } }),
    });
    return {
      content: [{ type: "text", text: `Funds:\n• Net Available: ₹${data?.Net || "N/A"}\n• Collateral: ₹${data?.CollateralValue || "N/A"}\n• Margin Used: ₹${data?.MarginUsed || "N/A"}\n• Board Lot Limit: ${data?.BoardLotLimit || "N/A"}` }],
    };
  }
);

// ==================== MARKET DATA (from MongoDB via Quant Engine) ====================
server.tool(
  "get_stock_price",
  "Get latest price and OHLCV data for a stock from MongoDB historical data",
  {
    symbol: z.string().describe("Trading symbol (e.g., RELIANCE, TCS, INFY)"),
    timeframe: z.enum(["day", "60minute"]).default("day").describe("Candle timeframe"),
    limit: z.number().int().default(5).describe("Number of candles to return"),
  },
  async ({ symbol, timeframe, limit }) => {
    const data = await quantRequest(`/api/market-data/ohlcv?symbol=${symbol}&timeframe=${timeframe}&limit=${limit}`);
    if (!data?.candles || data.candles.length === 0) {
      return { content: [{ type: "text", text: `No data found for ${symbol} (${timeframe})` }] };
    }
    const latest = data.candles[data.candles.length - 1];
    const candles = data.candles.map((c: any) => {
      const date = new Date(c.timestamp * 1000).toLocaleDateString();
      return `${date}: O:₹${c.open} H:₹${c.high} L:₹${c.low} C:₹${c.close} V:${c.volume}`;
    }).join("\n");
    return {
      content: [{ type: "text", text: `${symbol} (${timeframe}) — Last ${data.count} candles:\nLatest: ₹${latest.close}\n\n${candles}` }],
    };
  }
);

server.tool(
  "get_spot_prices",
  "Get latest spot prices for multiple symbols",
  {
    symbols: z.string().describe("Comma-separated symbols (e.g., RELIANCE,TCS,INFY)"),
  },
  async ({ symbols }) => {
    const data = await quantRequest(`/api/market-data/spot-prices?symbols=${symbols}`);
    const summary = Object.entries(data).map(([sym, info]: [string, any]) =>
      `${sym}: ₹${info.price}`
    ).join("\n");
    return { content: [{ type: "text", text: `Spot Prices:\n\n${summary}` }] };
  }
);

server.tool(
  "search_symbols",
  "Search for trading symbols in the market data database",
  {
    query: z.string().describe("Search query (prefix match)"),
    limit: z.number().int().default(10).describe("Max results"),
  },
  async ({ query, limit }) => {
    const data = await quantRequest(`/api/market-data/search?q=${query}&limit=${limit}`);
    if (!data?.symbols || data.symbols.length === 0) {
      return { content: [{ type: "text", text: `No symbols found for "${query}"` }] };
    }
    return { content: [{ type: "text", text: `Symbols matching "${query}":\n\n${data.symbols.join(", ")}` }] };
  }
);

// ==================== SWING SCAN ====================
server.tool(
  "scan_swing_trades",
  "Scan the stock universe for swing trading opportunities using technical analysis",
  {
    min_score: z.number().default(65).describe("Minimum score threshold (0-100)"),
    max_results: z.number().int().default(5).describe("Maximum results to return"),
  },
  async ({ min_score, max_results }) => {
    const res = await fetch(`${QUANT_BASE}/api/swing/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minScore: min_score, maxResults: max_results }),
    });
    const data = await res.json();
    if (!data?.candidates || data.candidates.length === 0) {
      return { content: [{ type: "text", text: "No swing trade candidates found above the score threshold." }] };
    }
    const summary = data.candidates.map((c: any) =>
      `${c.symbol}: Score=${c.score}, Trend=${c.trend}, Entry=₹${c.entry}, Target=₹${c.target}, SL=₹${c.stopLoss}, R:R=${c.riskReward}`
    ).join("\n");
    return {
      content: [{ type: "text", text: `Swing Scan (${data.scannedCount} scanned, ${data.candidatesFound} found):\n\n${summary}` }],
    };
  }
);

// ==================== TECHNICAL ANALYSIS ====================
server.tool(
  "analyze_stock",
  "Run full technical analysis on a stock (RSI, MACD, SMA, ADX, ATR, Bollinger, Support/Resistance)",
  {
    symbol: z.string().describe("Trading symbol (e.g., RELIANCE)"),
  },
  async ({ symbol }) => {
    const data = await quantRequest(`/api/swing/analyze/${symbol}`);
    if (data?.status === "error") {
      return { content: [{ type: "text", text: `Analysis failed: ${data.message}` }] };
    }
    const ind = data.indicators || {};
    const levels = data.levels || {};
    return {
      content: [{
        type: "text",
        text: `Technical Analysis for ${data.symbol}:\n\nPrice: ₹${data.currentPrice} | Trend: ${data.trend}\n\nIndicators:\n• RSI: ${ind.rsi}\n• MACD: ${ind.macd} (Signal: ${ind.macdSignal})\n• ADX: ${ind.adx}\n• ATR: ${ind.atr}\n• SMA20: ₹${ind.sma20}\n• SMA50: ₹${ind.sma50}\n• EMA20: ₹${ind.ema20}\n• VWAP: ₹${ind.vwap}\n• Bollinger: ₹${ind.bollingerLower} — ₹${ind.bollingerMiddle} — ₹${ind.bollingerUpper}\n\nLevels:\n• Support: ₹${levels.support}\n• Resistance: ₹${levels.resistance}\n• Entry: ₹${levels.entry}\n• Stop Loss: ₹${levels.stopLoss}\n• Target: ₹${levels.target}\n\nVolume: ${data.volume?.current} (Avg: ${data.volume?.average20}, Ratio: ${data.volume?.ratio}x)`,
      }],
    };
  }
);

// ==================== AI TRADING ====================
server.tool(
  "ai_trading_prompt",
  "Send a natural language prompt to the AI Trading Lab for analysis and recommendations",
  {
    prompt: z.string().describe("Natural language trading prompt (e.g., 'Analyze ONGC for swing trading')"),
  },
  async ({ prompt }) => {
    const res = await fetch(`${QUANT_BASE}/api/ai-trading/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, response_mode: "DETAILED", session_id: "mcp-session" }),
    });
    const text = await res.text();
    const recMatch = text.match(/event: recommendation\ndata: (.+)/);
    if (recMatch) {
      const rec = JSON.parse(recMatch[1]);
      return {
        content: [{ type: "text", text: `AI Recommendation:\n\nSignal: ${rec.signal}\nProbability: ${rec.probability}%\nR:R: 1:${rec.risk_reward_ratio?.toFixed(1)}\n${rec.entry_price ? `Entry: ₹${rec.entry_price}\nStop Loss: ₹${rec.stop_loss}\nTarget: ₹${rec.target_price}` : ""}\n\nRationale: ${rec.rationale}` }],
      };
    }
    return { content: [{ type: "text", text: "AI analysis completed but no recommendation was generated." }] };
  }
);

// ==================== START SERVER ====================
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Kotak Neo MCP Server running on stdio");
}

main().catch(console.error);
