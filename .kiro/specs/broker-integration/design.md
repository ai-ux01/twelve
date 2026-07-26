# Design Document

## Overview

This design extends the existing `KotakNeoProvider` in the NestJS backend (`apps/api/src/trading/brokers/`) to support the full Kotak Neo API surface: authentication, order management, positions, holdings, and trades. It introduces a `KillSwitchService` for persistent emergency stop capability and a `LiveTradingController` to expose REST endpoints for the frontend. The design preserves the existing safety architecture (AI → Risk Engine → User Confirmation → Broker) and adds the kill switch as an additional gate before broker execution.

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                         │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │   Live Trading Page (/live-trading)                          │ │
│  │   - Kill Switch Toggle                                       │ │
│  │   - Order Book / Positions / Holdings / Trades views         │ │
│  │   - Place/Modify/Cancel Order (with confirmation dialog)     │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────────┘
                               │ REST API
┌──────────────────────────────▼──────────────────────────────────┐
│                     NestJS Backend (apps/api)                     │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐      │
│  │         LiveTradingController                           │      │
│  │  GET  /api/live-trading/status                          │      │
│  │  GET  /api/live-trading/kill-switch                     │      │
│  │  POST /api/live-trading/kill-switch/toggle              │      │
│  │  GET  /api/live-trading/orders                          │      │
│  │  GET  /api/live-trading/positions                       │      │
│  │  GET  /api/live-trading/holdings                        │      │
│  │  GET  /api/live-trading/trades                          │      │
│  │  POST /api/live-trading/orders/place                    │      │
│  │  POST /api/live-trading/orders/:id/modify               │      │
│  │  POST /api/live-trading/orders/:id/cancel               │      │
│  └────────────────────┬───────────────────────────────────┘      │
│                       │                                           │
│  ┌────────────────────▼───────────────────────────────────┐      │
│  │              KillSwitchService                           │      │
│  │  - getState(): KillSwitchState                          │      │
│  │  - toggle(userId, enabled): void                        │      │
│  │  - isLiveTradingAllowed(): boolean                      │      │
│  │  Persists state in database (KillSwitch table)          │      │
│  └────────────────────┬───────────────────────────────────┘      │
│                       │                                           │
│  ┌────────────────────▼───────────────────────────────────┐      │
│  │              TradingService (existing, extended)         │      │
│  │  - executeLiveTrade() [adds kill switch check]          │      │
│  │  - executePaperTrade() [unchanged]                      │      │
│  └────────────────────┬───────────────────────────────────┘      │
│                       │                                           │
│  ┌────────────────────▼───────────────────────────────────┐      │
│  │              RiskService (existing, unchanged)           │      │
│  │  - validateTrade()                                      │      │
│  └────────────────────┬───────────────────────────────────┘      │
│                       │                                           │
│  ┌────────────────────▼───────────────────────────────────┐      │
│  │         KotakNeoProvider (extended)                      │      │
│  │  - authenticate() / refreshToken()                      │      │
│  │  - placeOrder() [existing]                              │      │
│  │  - modifyOrder() [new]                                  │      │
│  │  - cancelOrder() [new]                                  │      │
│  │  - getOrders() [new]                                    │      │
│  │  - getPositions() [new]                                 │      │
│  │  - getHoldings() [new]                                  │      │
│  │  - getTrades() [new]                                    │      │
│  │  - getOrderStatus() [existing]                          │      │
│  │  Circuit breaker + retry logic (existing)               │      │
│  └────────────────────────────────────────────────────────┘      │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐      │
│  │              AuditLogService (existing, unchanged)       │      │
│  │  - log() / logBrokerCall() / logRiskValidation()        │      │
│  └────────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────┘
```

### Execution Flow (Live Order Placement)

```
User clicks "Place Order" (frontend)
        │
        ▼
LiveTradingController.placeOrder(dto)
        │
        ├── 1. Validate DTO (symbol, qty, price, etc.)
        │
        ├── 2. Check Kill Switch → if ENABLED → reject (403)
        │
        ├── 3. Check userConfirmed → if false → reject (400)
        │
        ▼
TradingService.executeLiveTrade(userId, tradeRequest, userConfirmed)
        │
        ├── 4. Re-verify userConfirmed (defense in depth)
        │
        ├── 5. RiskService.validateTrade() → if fails → reject
        │
        ▼
KotakNeoProvider.placeOrder(request)
        │
        ├── 6. Check circuit breaker
        ├── 7. Validate order params
        ├── 8. Call Kotak Neo API with retry
        ├── 9. Transform response
        │
        ▼
Return result (brokerOrderId, status)
        │
        ▼
AuditLog records complete flow
```

## Data Models

### KillSwitch (Database Table)

```typescript
// Prisma schema addition
model KillSwitch {
  id        String   @id @default(uuid())
  enabled   Boolean  @default(true)  // TRUE = live trading OFF (safe default)
  updatedBy String
  updatedAt DateTime @updatedAt
  createdAt DateTime @default(now())
}
```

### Standardized Response Interfaces

```typescript
// Standardized order format
interface BrokerOrder {
  brokerOrderId: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  filledQuantity: number;
  price: number;
  averagePrice?: number;
  status: 'PENDING' | 'OPEN' | 'COMPLETE' | 'REJECTED' | 'CANCELLED';
  orderType: 'LIMIT' | 'MARKET' | 'SL' | 'SL-M';
  productType: 'DELIVERY' | 'INTRADAY' | 'MIS' | 'CNC';
  timestamp: Date;
  statusMessage?: string;
}

// Standardized position format
interface BrokerPosition {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  pnl: number;
  productType: 'DELIVERY' | 'INTRADAY' | 'MIS' | 'CNC';
  exchange: string;
}

// Standardized holding format
interface BrokerHolding {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentValue: number;
  pnl: number;
  isin: string;
}

// Standardized trade format
interface BrokerTrade {
  tradeId: string;
  brokerOrderId: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  timestamp: Date;
  exchange: string;
}

// Kill switch state
interface KillSwitchState {
  enabled: boolean;     // true = live trading OFF
  updatedBy: string;
  updatedAt: Date;
}
```

## Key Design Decisions

1. **Kill Switch defaults to ENABLED (live trading OFF)**: This is the safest default. Users must explicitly disable the kill switch to start live trading.

2. **Defense in depth for user confirmation**: User confirmation is checked at both the controller level and the service level. Even if the controller check is bypassed, the service will still reject unconfirmed trades.

3. **Extend existing KotakNeoProvider**: Rather than creating a new service, we extend the existing provider with new methods for orders, positions, holdings, trades, modify, and cancel. This maintains a single point of broker communication.

4. **New KillSwitchService**: Separated from TradingService to follow single responsibility. The kill switch is a cross-cutting safety concern that should be independently testable and deployable.

5. **New LiveTradingController**: Separate from existing TradingController to cleanly namespace live trading endpoints and avoid polluting the paper trading API surface.

6. **Database persistence for kill switch**: Using the database rather than config file or in-memory ensures the kill switch state survives restarts and is shared across instances.

7. **All broker responses transformed to standardized formats**: The provider handles all Kotak Neo response parsing internally, exposing clean TypeScript interfaces to consumers.

## File Structure

```
apps/api/src/trading/
├── brokers/
│   ├── kotak-neo.provider.ts          (extended with new methods)
│   ├── kotak-neo.provider.spec.ts     (extended tests)
│   └── kotak-neo.interfaces.ts        (new: standardized interfaces)
├── kill-switch/
│   ├── kill-switch.service.ts         (new)
│   ├── kill-switch.service.spec.ts    (new)
│   └── kill-switch.module.ts          (new)
├── live-trading.controller.ts          (new)
├── live-trading.controller.spec.ts     (new)
├── trading.module.ts                   (updated imports)
├── trading.service.ts                  (extended with kill switch check)
└── ... (existing files unchanged)
```

## Correctness Properties

### Property 1: Kill Switch Invariant (Requirement 9.2)

For ALL possible order requests, WHILE the kill switch is ENABLED, the Trading_Service SHALL reject the order. No order can reach the broker when the kill switch is active.

```
∀ orderRequest: OrderRequest,
  killSwitch.enabled === true →
    executeLiveTrade(orderRequest).status === 'FAILED' ∧
    brokerCallCount === 0
```

### Property 2: User Confirmation Gate (Requirements 10.1, 10.2)

For ALL possible order requests, IF userConfirmed is not explicitly true, the Trading_Service SHALL reject the order before calling the broker.

```
∀ orderRequest: OrderRequest,
  orderRequest.userConfirmed !== true →
    executeLiveTrade(orderRequest).status === 'FAILED' ∧
    brokerCallCount === 0
```

### Property 3: Risk Engine Gate (Requirement 11.1, 11.3)

For ALL possible live trades, the Risk Engine MUST be called before the broker. If the Risk Engine rejects the trade, the broker is never called.

```
∀ tradeRequest: TradeRequest,
  riskService.validateTrade(tradeRequest).passed === false →
    brokerCallCount === 0 ∧
    result.status === 'FAILED'
```

### Property 4: Order Validation Completeness (Requirement 6.1)

For ALL possible order parameter combinations, invalid parameters (negative quantity, empty symbol, invalid action) SHALL be rejected before reaching the broker API.

```
∀ params: OrderParams,
  isInvalid(params) →
    placeOrder(params) throws ValidationError ∧
    brokerApiCallCount === 0
```

### Property 5: Response Transformation Consistency (Requirements 2.2, 3.2, 4.2, 5.2)

For ALL valid Kotak Neo API responses, the transformation functions SHALL produce output matching the standardized interface (all required fields present, correct types, valid enum values).

```
∀ kotakResponse: KotakApiResponse,
  isValidKotakResponse(kotakResponse) →
    transform(kotakResponse) satisfies StandardizedInterface ∧
    transform(kotakResponse).requiredFields are all defined
```

### Property 6: Combined Safety Gate (Requirement 13.4)

For ALL order placement requests through the LiveTradingController, both the kill switch check AND user confirmation check must pass. If either fails, no broker call is made.

```
∀ request: PlaceOrderRequest,
  (killSwitch.enabled ∨ !request.userConfirmed) →
    controller.placeOrder(request).success === false ∧
    brokerCallCount === 0
```

### Property 7: Audit Log Completeness (Requirement 12.1)

For ALL broker API calls (success or failure), an audit log entry SHALL be created. The count of audit log entries must equal or exceed the count of broker API calls.

```
∀ brokerOperation: BrokerOperation,
  after(brokerOperation) →
    auditLog.count >= brokerApiCallCount
```

## Testing Strategy

- **Property-based tests**: Kill switch invariant, user confirmation gate, risk engine gate, order validation, response transformations, combined safety gate
- **Unit tests**: Each new method in KotakNeoProvider, KillSwitchService, LiveTradingController
- **Integration tests**: End-to-end flow with mocked Kotak Neo API, kill switch persistence across restarts
- **Architectural tests**: Verify AI module cannot import KotakNeoProvider or TradingService directly
