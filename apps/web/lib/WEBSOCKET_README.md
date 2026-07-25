# WebSocket Client for ProfitTerminal

This document describes the WebSocket client implementation for real-time communication between the Frontend and Backend.

## Overview

The WebSocket client provides real-time updates for:

- **Price Updates**: Real-time price changes for subscribed symbols
- **Portfolio Updates**: Real-time P&L updates for the user's portfolio

## Architecture

```
Frontend (Next.js)
    ├── lib/websocket.ts          # WebSocket Manager (singleton)
    ├── lib/hooks/useWebSocket.ts # React hooks for easy integration
    └── Components
        ├── ChartViewer           # Subscribes to price updates
        └── PortfolioTable        # Subscribes to portfolio updates

Backend (NestJS)
    └── src/websocket/
        └── websocket.gateway.ts  # WebSocket Gateway (Socket.IO)
```

## WebSocket Manager (`lib/websocket.ts`)

The `WebSocketManager` class is a singleton that manages the WebSocket connection and subscriptions.

### Features

- **Auto-connect**: Connects automatically when module loads (browser only)
- **Auto-reconnect**: Reconnects automatically with exponential backoff
- **Subscription Management**: Tracks symbol subscriptions and handlers
- **Event Handling**: Routes incoming events to registered handlers
- **Clean Disconnect**: Cleans up subscriptions on disconnect

### Usage

```typescript
import { wsManager } from '@/lib/websocket';

// Subscribe to price updates
const handler = (update) => {
  console.log('Price update:', update);
};
wsManager.subscribe('RELIANCE', handler);

// Unsubscribe
wsManager.unsubscribe('RELIANCE', handler);

// Subscribe to portfolio updates
wsManager.subscribeToPortfolio((update) => {
  console.log('Portfolio update:', update);
});

// Check connection status
const isConnected = wsManager.getConnectionStatus();

// Get subscribed symbols
const symbols = wsManager.getSubscribedSymbols();
```

## React Hooks (`lib/hooks/useWebSocket.ts`)

React hooks provide easy integration with components.

### `usePriceUpdates(symbol, enabled?)`

Subscribe to price updates for a symbol. Automatically subscribes on mount and unsubscribes on unmount.

**Example:**

```tsx
import { usePriceUpdates } from '@/lib/hooks/useWebSocket';

function PriceDisplay({ symbol }) {
  const priceUpdate = usePriceUpdates(symbol);

  if (!priceUpdate) return <div>Loading...</div>;

  return (
    <div>
      <p>Price: ₹{priceUpdate.price}</p>
      <p>Change: {priceUpdate.changePercent}%</p>
    </div>
  );
}
```

### `usePortfolioUpdates(enabled?)`

Subscribe to portfolio P&L updates. Automatically subscribes on mount and unsubscribes on unmount.

**Example:**

```tsx
import { usePortfolioUpdates } from '@/lib/hooks/useWebSocket';

function PortfolioSummary() {
  const portfolioUpdate = usePortfolioUpdates();

  if (!portfolioUpdate) return <div>Loading...</div>;

  return (
    <div>
      <p>Total P&L: ₹{portfolioUpdate.totalPnL}</p>
      <p>Daily P&L: ₹{portfolioUpdate.dailyPnL}</p>
    </div>
  );
}
```

### `useWebSocketConnection()`

Monitor WebSocket connection status.

**Example:**

```tsx
import { useWebSocketConnection } from '@/lib/hooks/useWebSocket';

function ConnectionIndicator() {
  const isConnected = useWebSocketConnection();

  return <div>Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}</div>;
}
```

### `useWebSocketDebug()`

Get debug information for troubleshooting.

**Example:**

```tsx
import { useWebSocketDebug } from '@/lib/hooks/useWebSocket';

function DebugPanel() {
  const debug = useWebSocketDebug();

  return (
    <div>
      <p>Connected: {debug.isConnected ? 'Yes' : 'No'}</p>
      <p>Subscribed Symbols: {debug.subscribedSymbols.join(', ')}</p>
    </div>
  );
}
```

## Integration Examples

### ChartViewer with Real-time Updates

```tsx
import { ChartViewer } from '@/components/ChartViewer';
import { usePriceUpdates } from '@/lib/hooks/useWebSocket';

function RealTimeChart({ symbol, initialData }) {
  const [chartData, setChartData] = useState(initialData);
  const priceUpdate = usePriceUpdates(symbol);

  useEffect(() => {
    if (priceUpdate) {
      // Update last candle with new price
      setChartData((prev) => {
        const newData = [...prev];
        const lastCandle = newData[newData.length - 1];

        if (lastCandle) {
          lastCandle.close = priceUpdate.price;
          lastCandle.high = Math.max(lastCandle.high, priceUpdate.price);
          lastCandle.low = Math.min(lastCandle.low, priceUpdate.price);
        }

        return newData;
      });
    }
  }, [priceUpdate]);

  return <ChartViewer symbol={symbol} data={chartData} />;
}
```

### PortfolioTable with Real-time PnL

```tsx
import { PortfolioTable } from '@/components/portfolio-table';
import { usePortfolioUpdates } from '@/lib/hooks/useWebSocket';

function RealTimePortfolio({ userId }) {
  const portfolioUpdate = usePortfolioUpdates();

  return (
    <div>
      {portfolioUpdate && (
        <div className="mb-4">
          <p>Total P&L: ₹{portfolioUpdate.totalPnL}</p>
          <p>Daily P&L: ₹{portfolioUpdate.dailyPnL}</p>
          <p className="text-xs text-muted-foreground">
            Last update: {new Date(portfolioUpdate.timestamp).toLocaleTimeString()}
          </p>
        </div>
      )}

      <PortfolioTable userId={userId} />
    </div>
  );
}
```

## Message Formats

### Price Update

```typescript
{
  event: 'priceUpdate',
  symbol: 'RELIANCE',
  price: 2460.50,
  change: 5.50,
  changePercent: 0.22,
  timestamp: '2024-01-15T10:30:00Z'
}
```

### Portfolio Update

```typescript
{
  event: 'portfolioUpdate',
  totalPnL: 25200,
  dailyPnL: 1400,
  timestamp: '2024-01-15T10:30:00Z'
}
```

### Subscription

**Client → Server:**

```typescript
{
  event: 'subscribe',
  symbol: 'RELIANCE'
}
```

**Server → Client (confirmation):**

```typescript
{
  symbol: 'RELIANCE',
  timestamp: '2024-01-15T10:30:00Z'
}
```

### Unsubscription

**Client → Server:**

```typescript
{
  event: 'unsubscribe',
  symbol: 'RELIANCE'
}
```

**Server → Client (confirmation):**

```typescript
{
  symbol: 'RELIANCE',
  timestamp: '2024-01-15T10:30:00Z'
}
```

## Connection Management

### Auto-connect

The WebSocket client automatically connects when the module loads (browser only):

```typescript
// lib/websocket.ts
if (typeof window !== 'undefined') {
  wsManager.connect();
}
```

### Auto-reconnect

The client automatically reconnects with the following settings:

- **Max attempts**: 5
- **Reconnect delay**: 2 seconds
- **Strategy**: Exponential backoff

When reconnected, all previous subscriptions are automatically restored.

### Manual Disconnect

To manually disconnect (e.g., on logout):

```typescript
import { wsManager } from '@/lib/websocket';

wsManager.disconnect();
```

## Error Handling

The WebSocket client handles errors gracefully:

- **Connection errors**: Logged and auto-retry
- **Handler errors**: Caught and logged, don't affect other handlers
- **Invalid messages**: Logged as warnings
- **Network issues**: Auto-reconnect after delay

## Testing

Unit tests are provided for:

- WebSocket Manager (`lib/websocket.test.ts`)
- React Hooks (`lib/hooks/useWebSocket.test.tsx`)

Run tests:

```bash
npm test
```

## Requirements Satisfied

This implementation satisfies **Requirement 13.6**:

- ✅ Frontend updates data reactively using TanStack Query
- ✅ WebSocket client for real-time updates
- ✅ Subscribe to symbols when chart is viewed
- ✅ Update chart data on price updates
- ✅ Update portfolio PnL on portfolio updates

## Related Tasks

- **Task 22.1**: Backend WebSocket Gateway (completed)
- **Task 22.2**: Frontend WebSocket Client (this implementation)

## Dependencies

- `socket.io-client`: ^4.8.1
- `react`: ^18.3.1
- `next`: ^14.2.3

## Files

- `lib/websocket.ts` - WebSocket Manager class
- `lib/hooks/useWebSocket.ts` - React hooks
- `lib/websocket.test.ts` - Unit tests for manager
- `lib/hooks/useWebSocket.test.tsx` - Unit tests for hooks
- `lib/websocket.example.tsx` - Integration examples
- `lib/WEBSOCKET_README.md` - This documentation
