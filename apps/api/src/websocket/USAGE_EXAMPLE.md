# WebSocket Gateway Usage Examples

## Backend Service Integration

### Example 1: Broadcasting Price Updates from MarketDataService

```typescript
// src/market-data/market-data.service.ts
import { Injectable } from '@nestjs/common';
import { WebSocketGatewayService } from '../websocket/websocket.gateway';

@Injectable()
export class MarketDataService {
  constructor(private readonly websocketGateway: WebSocketGatewayService) {}

  async fetchAndBroadcastPriceUpdate(symbol: string): Promise<void> {
    // Fetch latest price from Kite Connect
    const marketData = await this.fetchMarketData(symbol);

    // Calculate change
    const previousClose = marketData.previousClose;
    const currentPrice = marketData.lastPrice;
    const change = currentPrice - previousClose;
    const changePercent = (change / previousClose) * 100;

    // Broadcast to all subscribed clients
    this.websocketGateway.broadcastPriceUpdate(symbol, currentPrice, change, changePercent);
  }
}
```

### Example 2: Broadcasting Portfolio Updates from TradingService

```typescript
// src/trading/trading.service.ts
import { Injectable } from '@nestjs/common';
import { WebSocketGatewayService } from '../websocket/websocket.gateway';
import { PortfolioService } from '../portfolio/portfolio.service';

@Injectable()
export class TradingService {
  constructor(
    private readonly websocketGateway: WebSocketGatewayService,
    private readonly portfolioService: PortfolioService
  ) {}

  async executeTrade(tradeRequest: TradeRequest): Promise<TradeResult> {
    // Execute the trade
    const result = await this.executeTradeLogic(tradeRequest);

    // Recalculate portfolio PnL
    const portfolio = await this.portfolioService.getPortfolio();

    // Broadcast updated PnL to all clients
    this.websocketGateway.broadcastPortfolioUpdate(portfolio.totalPnL, portfolio.dailyPnL);

    return result;
  }
}
```

### Example 3: Scheduled Price Updates (Cron Job)

```typescript
// src/market-data/market-data-scheduler.service.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WebSocketGatewayService } from '../websocket/websocket.gateway';
import { MarketDataService } from './market-data.service';

@Injectable()
export class MarketDataSchedulerService {
  constructor(
    private readonly websocketGateway: WebSocketGatewayService,
    private readonly marketDataService: MarketDataService
  ) {}

  // Update prices every 5 seconds during market hours
  @Cron('*/5 * * * * *')
  async updateSubscribedSymbolPrices(): Promise<void> {
    // Get all symbols that clients are subscribed to
    const subscribedSymbols = this.websocketGateway.getSubscribedSymbols();

    if (subscribedSymbols.length === 0) {
      // No one is subscribed, skip the update
      return;
    }

    // Fetch and broadcast updates only for subscribed symbols
    for (const symbol of subscribedSymbols) {
      try {
        await this.marketDataService.fetchAndBroadcastPriceUpdate(symbol);
      } catch (error) {
        console.error(`Failed to update ${symbol}:`, error);
      }
    }
  }
}
```

### Example 4: Monitoring Active Connections

```typescript
// src/monitoring/websocket-monitor.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WebSocketGatewayService } from '../websocket/websocket.gateway';

@Injectable()
export class WebSocketMonitorService {
  private readonly logger = new Logger(WebSocketMonitorService.name);

  constructor(private readonly websocketGateway: WebSocketGatewayService) {}

  // Log WebSocket statistics every minute
  @Cron(CronExpression.EVERY_MINUTE)
  logWebSocketStats(): void {
    const connectionCount = this.websocketGateway.getConnectionCount();
    const subscribedSymbols = this.websocketGateway.getSubscribedSymbols();

    this.logger.log(
      `WebSocket Stats: ${connectionCount} connections, ` +
        `${subscribedSymbols.length} unique symbols subscribed`
    );

    // Log subscriber count per symbol
    subscribedSymbols.forEach((symbol) => {
      const count = this.websocketGateway.getSubscriberCount(symbol);
      this.logger.debug(`${symbol}: ${count} subscribers`);
    });
  }
}
```

## Frontend Client Integration

### Example 1: React Hook for Price Updates

```typescript
// hooks/usePriceUpdate.ts
import { useEffect, useState } from 'react';
import socket from '@/lib/websocket';

interface PriceUpdate {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

export function usePriceUpdate(symbol: string) {
  const [priceData, setPriceData] = useState<PriceUpdate | null>(null);

  useEffect(() => {
    // Subscribe to symbol on mount
    socket.emit('subscribe', { event: 'subscribe', symbol });

    // Listen for price updates
    const handlePriceUpdate = (data: PriceUpdate) => {
      if (data.symbol === symbol) {
        setPriceData(data);
      }
    };

    socket.on('priceUpdate', handlePriceUpdate);

    // Cleanup on unmount
    return () => {
      socket.emit('unsubscribe', { event: 'unsubscribe', symbol });
      socket.off('priceUpdate', handlePriceUpdate);
    };
  }, [symbol]);

  return priceData;
}
```

### Example 2: Chart Component with Real-time Updates

```typescript
// components/ChartViewer.tsx
import React from 'react';
import { usePriceUpdate } from '@/hooks/usePriceUpdate';

interface ChartViewerProps {
  symbol: string;
}

export function ChartViewer({ symbol }: ChartViewerProps) {
  const priceData = usePriceUpdate(symbol);

  return (
    <div className="chart-container">
      <div className="price-header">
        <h2>{symbol}</h2>
        {priceData && (
          <>
            <span className="price">₹{priceData.price.toFixed(2)}</span>
            <span className={priceData.change >= 0 ? 'positive' : 'negative'}>
              {priceData.change >= 0 ? '+' : ''}
              {priceData.change.toFixed(2)} ({priceData.changePercent.toFixed(2)}%)
            </span>
            <span className="timestamp">
              Updated: {new Date(priceData.timestamp).toLocaleTimeString()}
            </span>
          </>
        )}
      </div>
      {/* TradingView chart component here */}
    </div>
  );
}
```

### Example 3: Portfolio PnL Display

```typescript
// components/PortfolioHeader.tsx
import React, { useEffect, useState } from 'react';
import socket from '@/lib/websocket';

interface PortfolioUpdate {
  totalPnL: number;
  dailyPnL: number;
  timestamp: string;
}

export function PortfolioHeader() {
  const [pnl, setPnl] = useState<PortfolioUpdate | null>(null);

  useEffect(() => {
    // Listen for portfolio updates
    const handlePortfolioUpdate = (data: PortfolioUpdate) => {
      setPnl(data);
    };

    socket.on('portfolioUpdate', handlePortfolioUpdate);

    return () => {
      socket.off('portfolioUpdate', handlePortfolioUpdate);
    };
  }, []);

  if (!pnl) {
    return <div>Loading portfolio...</div>;
  }

  return (
    <div className="portfolio-header">
      <div className="pnl-item">
        <span className="label">Total P&L</span>
        <span className={pnl.totalPnL >= 0 ? 'positive' : 'negative'}>
          ₹{pnl.totalPnL.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      </div>
      <div className="pnl-item">
        <span className="label">Today's P&L</span>
        <span className={pnl.dailyPnL >= 0 ? 'positive' : 'negative'}>
          ₹{pnl.dailyPnL.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      </div>
      <div className="timestamp">
        Last updated: {new Date(pnl.timestamp).toLocaleString('en-IN')}
      </div>
    </div>
  );
}
```

### Example 4: WebSocket Connection Manager

```typescript
// lib/websocket.ts
import { io, Socket } from 'socket.io-client';

class WebSocketManager {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io('http://localhost:4000', {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);

      if (reason === 'io server disconnect') {
        // Server disconnected the client, manually reconnect
        this.socket?.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        this.socket?.disconnect();
      }
    });

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  subscribeToSymbol(symbol: string): void {
    if (!this.socket?.connected) {
      console.warn('WebSocket not connected, cannot subscribe');
      return;
    }

    this.socket.emit('subscribe', { event: 'subscribe', symbol });
  }

  unsubscribeFromSymbol(symbol: string): void {
    if (!this.socket?.connected) {
      return;
    }

    this.socket.emit('unsubscribe', { event: 'unsubscribe', symbol });
  }

  onPriceUpdate(callback: (data: any) => void): void {
    this.socket?.on('priceUpdate', callback);
  }

  onPortfolioUpdate(callback: (data: any) => void): void {
    this.socket?.on('portfolioUpdate', callback);
  }

  offPriceUpdate(callback: (data: any) => void): void {
    this.socket?.off('priceUpdate', callback);
  }

  offPortfolioUpdate(callback: (data: any) => void): void {
    this.socket?.off('portfolioUpdate', callback);
  }
}

const wsManager = new WebSocketManager();
export default wsManager;
```

## Testing WebSocket Manually

### Using wscat (Command Line)

```bash
# Install wscat
npm install -g wscat

# Connect to WebSocket server
wscat -c ws://localhost:4000/socket.io/?EIO=4&transport=websocket

# Subscribe to a symbol (after connection)
42["subscribe",{"event":"subscribe","symbol":"RELIANCE"}]

# Listen for price updates
# Server will send: 42["priceUpdate",{...}]

# Unsubscribe
42["unsubscribe",{"event":"unsubscribe","symbol":"RELIANCE"}]
```

### Using Browser Console

```javascript
// Open browser console on http://localhost:3000
const socket = io('http://localhost:4000');

// Subscribe to RELIANCE
socket.emit('subscribe', { event: 'subscribe', symbol: 'RELIANCE' });

// Listen for price updates
socket.on('priceUpdate', (data) => {
  console.log('Price update:', data);
});

// Listen for portfolio updates
socket.on('portfolioUpdate', (data) => {
  console.log('Portfolio update:', data);
});

// Unsubscribe
socket.emit('unsubscribe', { event: 'unsubscribe', symbol: 'RELIANCE' });

// Disconnect
socket.disconnect();
```

## Common Patterns

### Pattern 1: Batch Updates

```typescript
// Broadcast updates for multiple symbols efficiently
async batchBroadcastPriceUpdates(symbols: string[]): Promise<void> {
  const priceData = await this.fetchBulkMarketData(symbols);

  priceData.forEach(data => {
    this.websocketGateway.broadcastPriceUpdate(
      data.symbol,
      data.price,
      data.change,
      data.changePercent
    );
  });
}
```

### Pattern 2: Throttled Updates

```typescript
// Use throttling to prevent excessive updates
import { throttle } from 'lodash';

const throttledBroadcast = throttle(
  (symbol: string, price: number, change: number, changePercent: number) => {
    this.websocketGateway.broadcastPriceUpdate(symbol, price, change, changePercent);
  },
  1000, // Maximum once per second per symbol
  { leading: true, trailing: true }
);
```

### Pattern 3: Conditional Broadcasting

```typescript
// Only broadcast if there are active subscribers
broadcastIfSubscribed(symbol: string, ...args): void {
  const subscriberCount = this.websocketGateway.getSubscriberCount(symbol);

  if (subscriberCount > 0) {
    this.websocketGateway.broadcastPriceUpdate(symbol, ...args);
  }
}
```

## Performance Tips

1. **Check subscribers before fetching data**: Use `getSubscribedSymbols()` to only fetch data for symbols that clients are watching
2. **Throttle updates**: Don't send updates more frequently than clients can process (1-5 seconds is usually sufficient)
3. **Batch database operations**: When multiple trades execute, batch the portfolio recalculation
4. **Use Redis adapter for scaling**: If deploying multiple instances, use Redis adapter to sync subscriptions
5. **Monitor memory usage**: The in-memory subscription tracking uses minimal memory, but log metrics periodically

## Error Handling

```typescript
try {
  this.websocketGateway.broadcastPriceUpdate(symbol, price, change, changePercent);
} catch (error) {
  this.logger.error(`Failed to broadcast price update for ${symbol}:`, error);
  // Don't throw - broadcasting is non-critical
}
```

## Next Steps

- Implement Task 22.2: Frontend WebSocket client
- Add scheduled price updates for subscribed symbols
- Implement portfolio PnL updates after trades
- Add WebSocket monitoring dashboard
- Consider Redis adapter for multi-instance deployment
