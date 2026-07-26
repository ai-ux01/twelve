# Tasks

## Task 1: Create Standardized Broker Interfaces

- [ ] 1.1 Create `apps/api/src/trading/brokers/kotak-neo.interfaces.ts` with standardized interfaces: `BrokerOrder`, `BrokerPosition`, `BrokerHolding`, `BrokerTrade`, `KillSwitchState`, `ModifyOrderRequest`, `CancelOrderRequest`
- [ ] 1.2 Add Kotak Neo raw response type definitions for type-safe transformations
- [ ] 1.3 Export all interfaces from a barrel file

## Task 2: Extend KotakNeoProvider - Authentication

- [ ] 2.1 Add token refresh method `refreshToken()` that uses stored refresh credentials to get a new session token
- [ ] 2.2 Add automatic retry on 401 responses that calls `refreshToken()` before retrying the original request
- [ ] 2.3 Add environment variable validation on provider initialization (consumer key, consumer secret, access token)
- [ ] 2.4 Write unit tests for authentication flow including token refresh and failure scenarios

## Task 3: Extend KotakNeoProvider - Read Operations

- [ ] 3.1 Implement `getOrders()` method that calls Kotak Neo order book endpoint and transforms response to `BrokerOrder[]`
- [ ] 3.2 Implement `getPositions()` method that calls Kotak Neo positions endpoint and transforms response to `BrokerPosition[]`
- [ ] 3.3 Implement `getHoldings()` method that calls Kotak Neo holdings endpoint and transforms response to `BrokerHolding[]`
- [ ] 3.4 Implement `getTrades()` method that calls Kotak Neo trade book endpoint and transforms response to `BrokerTrade[]`
- [ ] 3.5 Write unit tests for all read operations with mocked HTTP responses
- [ ] 3.6 <PBT> Write property test: for all valid Kotak Neo order responses, transformation produces valid `BrokerOrder` objects with all required fields defined and valid enum values

## Task 4: Extend KotakNeoProvider - Modify and Cancel Orders

- [ ] 4.1 Implement `modifyOrder(brokerOrderId, modifications)` method that sends modification request to Kotak Neo API
- [ ] 4.2 Implement `cancelOrder(brokerOrderId)` method that sends cancellation request to Kotak Neo API
- [ ] 4.3 Add error handling for non-modifiable/non-cancellable orders (already executed, already cancelled)
- [ ] 4.4 Write unit tests for modify and cancel operations including error scenarios

## Task 5: Create KillSwitchService

- [ ] 5.1 Add `KillSwitch` model to Prisma schema with fields: id, enabled (default true), updatedBy, updatedAt, createdAt
- [ ] 5.2 Run Prisma migration to create the KillSwitch table
- [ ] 5.3 Create `apps/api/src/trading/kill-switch/kill-switch.service.ts` with methods: `getState()`, `toggle(userId, enabled)`, `isLiveTradingAllowed()`
- [ ] 5.4 Implement database seeding: on first access, create KillSwitch record with `enabled: true` (live trading OFF by default)
- [ ] 5.5 Add audit logging for all kill switch state changes
- [ ] 5.6 Create `kill-switch.module.ts` with service registration and exports
- [ ] 5.7 Write unit tests for KillSwitchService including default state and toggle behavior
- [ ] 5.8 <PBT> Write property test: for all possible order requests, while kill switch is enabled, executeLiveTrade always returns FAILED status and broker is never called

## Task 6: Integrate Kill Switch into TradingService

- [ ] 6.1 Inject `KillSwitchService` into `TradingService`
- [ ] 6.2 Add kill switch check as the first gate in `executeLiveTrade()` — before user confirmation and risk validation
- [ ] 6.3 Add kill switch check before `modifyOrder()` and `cancelOrder()` broker calls
- [ ] 6.4 Update `trading.module.ts` to import KillSwitchModule
- [ ] 6.5 Write unit tests verifying kill switch blocks live trades when enabled
- [ ] 6.6 <PBT> Write property test: for all order requests, if userConfirmed is not true, executeLiveTrade rejects without calling broker

## Task 7: Create LiveTradingController

- [ ] 7.1 Create `apps/api/src/trading/live-trading.controller.ts` with route prefix `/api/live-trading`
- [ ] 7.2 Implement `GET /status` endpoint returning authentication state and circuit breaker state
- [ ] 7.3 Implement `GET /kill-switch` endpoint returning current kill switch state
- [ ] 7.4 Implement `POST /kill-switch/toggle` endpoint with userId in body, toggling kill switch state
- [ ] 7.5 Implement `GET /orders` endpoint delegating to KotakNeoProvider.getOrders()
- [ ] 7.6 Implement `GET /positions` endpoint delegating to KotakNeoProvider.getPositions()
- [ ] 7.7 Implement `GET /holdings` endpoint delegating to KotakNeoProvider.getHoldings()
- [ ] 7.8 Implement `GET /trades` endpoint delegating to KotakNeoProvider.getTrades()
- [ ] 7.9 Implement `POST /orders/place` endpoint with DTO validation, kill switch check, user confirmation check, then delegate to TradingService
- [ ] 7.10 Implement `POST /orders/:id/modify` endpoint with kill switch check, then delegate to KotakNeoProvider.modifyOrder()
- [ ] 7.11 Implement `POST /orders/:id/cancel` endpoint with kill switch check, then delegate to KotakNeoProvider.cancelOrder()
- [ ] 7.12 Register LiveTradingController in TradingModule
- [ ] 7.13 Write unit tests for all controller endpoints including validation and error cases
- [ ] 7.14 <PBT> Write property test: for all order placement requests, if kill switch is enabled OR userConfirmed is false, the controller rejects and no broker call is made

## Task 8: Audit Logging Integration

- [ ] 8.1 Add `logBrokerCall()` invocations to all new KotakNeoProvider methods (getOrders, getPositions, getHoldings, getTrades, modifyOrder, cancelOrder)
- [ ] 8.2 Add latency measurement (start/end timestamps) to all broker API calls and include in audit log
- [ ] 8.3 Ensure all audit log entries include userId, endpoint, request params, response status, latency, and circuit breaker state on failure
- [ ] 8.4 Write tests verifying audit log entries are created for both success and failure scenarios

## Task 9: Execution Flow Safety Property Tests

- [ ] 9.1 <PBT> Write property test: for all live trade requests, if Risk Engine rejects, broker is never called and result status is FAILED
- [ ] 9.2 Write architectural constraint test: verify AI module (apps/api/src/ai/) does not import KotakNeoProvider or TradingService.executeLiveTrade
- [ ] 9.3 Write integration test: complete execution flow from controller through risk engine to broker (mocked) with audit log verification

## Task 10: Database Schema and Environment Configuration

- [ ] 10.1 Add Kotak Neo environment variables to `.env.example`: `KOTAK_NEO_CONSUMER_KEY`, `KOTAK_NEO_CONSUMER_SECRET`, `KOTAK_NEO_ACCESS_TOKEN`, `KOTAK_NEO_SESSION_TOKEN`
- [ ] 10.2 Update `ConfigService` to expose new Kotak Neo configuration values with validation
- [ ] 10.3 Add environment variable validation in `env.validation.ts` for new Kotak Neo variables (optional but validated when present)
