# API Client Documentation

## Overview

The API client (`lib/api-client.ts`) provides typed methods for all ProfitTerminal Backend API endpoints. It handles request/response formatting, error handling, and TypeScript type safety.

**Base URL**: `http://localhost:4000`

**Requirements**: 13.1

## Installation

The API client is already available in the project. Simply import it:

```typescript
import { apiClient } from '@/lib/api-client';
```

## Usage Examples

### Submit a Natural Language Prompt

```typescript
import { apiClient } from '@/lib/api-client';

const response = await apiClient.submitPrompt('Find the best swing trade in RELIANCE');

console.log(response.parsed.symbols); // ['RELIANCE']
console.log(response.recommendation.action); // 'BUY' | 'SELL' | 'HOLD'
console.log(response.recommendation.confidence); // 0.75
```

### Get Portfolio

```typescript
const portfolio = await apiClient.getPortfolio('user123');

console.log(portfolio.totalValue); // 1000000
console.log(portfolio.positions); // Array of positions
console.log(portfolio.metrics.winRate); // 68.5
```

### Execute Paper Trade

```typescript
const result = await apiClient.executePaperTrade({
  userId: 'user123',
  symbol: 'RELIANCE',
  action: 'BUY',
  quantity: 10,
  price: 2460,
  stopLoss: 2430,
  target: 2520,
});

console.log(result.status); // 'EXECUTED' | 'FAILED' | 'PENDING'
console.log(result.executedPrice); // 2460
```

### Execute Live Trade (with confirmation)

```typescript
const result = await apiClient.executeLiveTrade({
  userId: 'user123',
  symbol: 'RELIANCE',
  action: 'BUY',
  quantity: 10,
  price: 2460,
  userConfirmed: true, // Required for live trades
});

console.log(result.brokerOrderId); // 'NEO123456'
```

### Validate Trade Against Risk Rules

```typescript
const validation = await apiClient.validateTrade({
  userId: 'user123',
  symbol: 'RELIANCE',
  action: 'BUY',
  quantity: 100,
  price: 2460,
});

if (!validation.passed) {
  validation.violations.forEach((v) => {
    console.log(`${v.severity}: ${v.rule} - ${v.message}`);
  });
}
```

### Get Market Data

```typescript
const marketData = await apiClient.getMarketData('RELIANCE', '1d');

console.log(marketData.data); // Array of OHLCV candles
console.log(marketData.data[0].close); // 2465
```

### Get Options Chain

```typescript
const optionsChain = await apiClient.getOptionsChain('NIFTY', '2024-12-26');

console.log(optionsChain.spotPrice); // 21500
console.log(optionsChain.strikes); // Array of strike prices with call/put data
```

## Usage with TanStack Query

The API client works seamlessly with TanStack Query for data fetching and caching:

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

function usePortfolio(userId: string) {
  return useQuery({
    queryKey: ['portfolio', userId],
    queryFn: () => apiClient.getPortfolio(userId),
    refetchInterval: 10000, // Auto-refetch every 10 seconds
  });
}

function useMarketData(symbol: string, timeframe: '1d' | '5m' | '1m') {
  return useQuery({
    queryKey: ['market', symbol, timeframe],
    queryFn: () => apiClient.getMarketData(symbol, timeframe),
    staleTime: 60000, // Cache for 60 seconds
  });
}
```

## Type Definitions

All API types are exported from the API client:

```typescript
import type {
  ParsedPrompt,
  QuantAnalysisResult,
  Recommendation,
  PromptResponse,
  Portfolio,
  PositionInfo,
  TradeRequest,
  TradeResult,
  RiskValidationResult,
  MarketDataResponse,
  OptionsChainResponse,
} from '@/lib/api-client';
```

## Error Handling

The API client throws errors for failed requests. Use try-catch or handle errors in your query client:

```typescript
try {
  const result = await apiClient.submitPrompt('invalid prompt');
} catch (error) {
  console.error('API Error:', error.message);
  // Handle error appropriately
}
```

With TanStack Query:

```typescript
const { data, error, isError } = useQuery({
  queryKey: ['portfolio', userId],
  queryFn: () => apiClient.getPortfolio(userId),
});

if (isError) {
  console.error('Failed to load portfolio:', error);
}
```

## Custom Base URL

For testing or production deployments, you can create a custom client instance:

```typescript
import { ApiClient } from '@/lib/api-client';

const customClient = new ApiClient('https://api.profitterminal.com');
```

## Available Endpoints

| Method                                | Endpoint                         | Description                                 |
| ------------------------------------- | -------------------------------- | ------------------------------------------- |
| `submitPrompt(prompt)`                | `POST /prompt`                   | Submit natural language prompt for analysis |
| `getPortfolio(userId)`                | `GET /portfolio`                 | Get complete portfolio with positions       |
| `executePaperTrade(request)`          | `POST /trade/paper`              | Execute paper trade (simulation)            |
| `executeLiveTrade(request)`           | `POST /trade/live`               | Execute live trade (requires confirmation)  |
| `validateTrade(request)`              | `POST /risk/validate`            | Validate trade against risk rules           |
| `getMarketData(symbol, timeframe)`    | `GET /market-data`               | Get OHLCV market data                       |
| `getOptionsChain(underlying, expiry)` | `GET /market-data/options-chain` | Get options chain for NIFTY/BANKNIFTY       |

## Testing

Unit tests are available in `lib/api-client.test.ts`. To run tests:

1. Install Jest (if not already installed):

   ```bash
   npm install --save-dev jest @types/jest ts-jest
   ```

2. Configure Jest in `jest.config.js`:

   ```javascript
   module.exports = {
     preset: 'ts-jest',
     testEnvironment: 'node',
   };
   ```

3. Run tests:
   ```bash
   npm test
   ```

## Architecture Notes

- The API client enforces the architectural constraint that AI only receives quantitative results, not raw market data
- All trade requests are validated by the Risk Engine before execution
- Live trades require explicit user confirmation (userConfirmed flag)
- Paper trades never call the broker API
- Error responses are properly typed and include meaningful error messages

## Related Files

- `lib/api-client.ts` - Main API client implementation
- `lib/api-client.test.ts` - Unit tests
- Backend API controllers in `apps/api/src/**/` - Server-side implementation
