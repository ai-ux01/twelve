# Implementation Plan: HSM Market Feed

## Overview

Implement real-time market data streaming via Kotak HSM WebSocket integration. The plan builds incrementally: data models and interfaces first, then core caching/builder services, followed by transport (HSM client + mock), orchestration (MarketDataManager), domain services (ATM Engine, Watchlist), gateway, and finally the frontend dashboard. Each phase is independently testable.

## Tasks

- [x] 1. Data models, interfaces, and Prisma schema updates
  - [x] 1.1 Add Prisma schema changes for Instrument extensions and Watchlist model
    - Add `instrumentToken`, `exchangeSegment`, `lotSize`, `tickSize` fields to the existing `Instrument` model
    - Add `@@index([instrumentToken])` and `@@index([underlying, expiry, optionType])` indexes
    - Create new `Watchlist` model with `id`, `userId`, `name`, `symbols` (String[]), `createdAt`, `updatedAt`
    - Add `@@unique([userId, name])` and `@@index([userId])` constraints
    - Add `Watchlist Watchlist[]` relation to User model
    - Run `npx prisma migrate dev` to generate migration
    - _Requirements: 2.2, 10.3_

  - [x] 1.2 Create TypeScript interfaces and types for market feed module
    - Create `apps/api/src/market-feed/interfaces/` directory
    - Define `ConnectionStatus` type union: `'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING'`
    - Define `IMarketDataProvider` interface with `connect`, `disconnect`, `subscribe`, `unsubscribe`, `getConnectionStatus`, `getActiveSubscriptions`, `onTick`, `onDepth`, `onStatusChange` methods
    - Define `NormalizedTick` interface with all fields from design (instrumentToken, exchange, symbol, lastPrice, open, high, low, previousClose, volume, oi, bid, ask, timestamp)
    - Define `DepthLevel` interface (price, quantity, orders)
    - Define `NormalizedDepth` interface (instrumentToken, bids, asks, bestBid, bestAsk, spread, timestamp)
    - Define `RawHsmTick` and `RawHsmDepth` interfaces for broker-specific messages
    - _Requirements: 1.6, 5.1, 6.2_

- [x] 2. Implement TickCache and DepthCache services
  - [x] 2.1 Implement TickCache service
    - Create `apps/api/src/market-feed/tick-cache.service.ts`
    - Implement `set(token, tick)`, `get(token)`, `remove(token)`, `getAll()`, `clear()` methods
    - Use in-memory `Map<string, NormalizedTick>` for storage
    - Make it `@Injectable()` with singleton scope
    - _Requirements: 4.4, 4.5_

  - [ ]* 2.2 Write property tests for TickCache (Properties 11, 12)
    - **Property 11: Tick cache consistency** — For any token, storing a tick then calling get returns that exact tick; get on unstored token returns null
    - **Property 12: Unsubscribe cleanup** — For any token, calling remove results in get returning null
    - **Validates: Requirements 4.4, 4.5**

  - [x] 2.3 Implement DepthCache service
    - Create `apps/api/src/market-feed/depth-cache.service.ts`
    - Implement `set(token, depth)`, `get(token)`, `remove(token)` methods
    - Normalize incoming depth: sort bids descending, asks ascending, compute bestBid, bestAsk, spread
    - Enforce max 5 levels for bids and asks
    - Ensure spread is non-negative (bestAsk - bestBid)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 2.4 Write property tests for DepthCache (Properties 13, 14, 15)
    - **Property 13: Depth normalization structure** — Any normalized depth has ≤5 bids, ≤5 asks, and computed bestBid/bestAsk/spread
    - **Property 14: Depth sort invariant** — Bids sorted descending, asks sorted ascending
    - **Property 15: Depth spread non-negativity** — spread = bestAsk - bestBid ≥ 0
    - **Validates: Requirements 6.1, 6.2, 6.4, 6.5**

- [x] 3. Implement SubscriptionBuilder service
  - [x] 3.1 Implement SubscriptionBuilder service
    - Create `apps/api/src/market-feed/subscription-builder.service.ts`
    - Implement `buildStockSubscription(instrument)` returning `{exchangeSegment}|{instrumentToken}&1`
    - Implement `buildIndexSubscription(instrument)` returning `{exchangeSegment}|{indexName}&1`
    - Implement `buildBatch(instruments)` that builds multiple subscription strings
    - Implement `validate(instrument)` that throws if exchange or instrumentToken is missing
    - Implement `deduplicate(subscriptions)` that returns unique subscription strings
    - Implement `checkLimits(current, adding)` that throws if exceeding 200 scrips or 16 channels
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 3.2 Write property tests for SubscriptionBuilder (Properties 7, 8, 9)
    - **Property 7: Subscription string format correctness** — Valid instrument produces correct format pattern
    - **Property 8: Subscription deduplication** — Output has unique elements, all from original input
    - **Property 9: HSM protocol limit enforcement** — Rejects when C + A > 200 or channels > 16
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.5**

- [x] 4. Checkpoint - Core services validated
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement HsmWebSocketClient (real connection)
  - [x] 5.1 Implement HsmWebSocketClient service
    - Create `apps/api/src/market-feed/hsm-websocket-client.service.ts`
    - Implement `IMarketDataProvider` interface
    - Use `ws` package to connect to `wss://mlhsm.kotaksecurities.com`
    - Accept auth token, SID, dataCenter from KotakSessionStore
    - Implement heartbeat response logic (respond within 5 seconds)
    - Track connection status transitions (DISCONNECTED → CONNECTING → CONNECTED, RECONNECTING)
    - Store active subscriptions in a `Set<string>` for restoration
    - _Requirements: 1.1, 1.2, 1.6_

  - [x] 5.2 Implement reconnection with exponential backoff
    - Implement backoff: `min(1000 * 2^(N-1), 60000)` milliseconds
    - On reconnection success, restore all previous subscriptions within 2 seconds
    - Emit `session-expired` event on auth failure and cease reconnection
    - Emit `connection-critical` after 5 consecutive minutes of failure
    - Track metrics: totalReconnectAttempts, successfulReconnections, disconnectedSince
    - _Requirements: 1.3, 1.4, 1.5, 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ]* 5.3 Write property tests for HsmWebSocketClient (Properties 1, 2, 3, 23)
    - **Property 1: Exponential backoff calculation** — For attempt N, delay = min(1000 × 2^(N-1), 60000)
    - **Property 2: Subscription preservation through reconnection** — Subscriptions after reconnect equal subscriptions before disconnect
    - **Property 3: Connection status state validity** — Status always one of the 4 valid values
    - **Property 23: Reconnection metrics accuracy** — Metrics match actual attempt/success counts
    - **Validates: Requirements 1.3, 1.4, 1.6, 11.2, 11.4**

- [x] 6. Implement MockDataProvider
  - [x] 6.1 Implement MockDataProvider service
    - Create `apps/api/src/market-feed/mock-data-provider.service.ts`
    - Implement `IMarketDataProvider` interface
    - Generate synthetic ticks at configurable interval (default 1s) with ±2% random walk
    - Generate depth snapshots with 5 bid/5 ask levels around simulated price
    - Report status as CONNECTED without real WebSocket
    - Support subscribe/unsubscribe by tracking active tokens and base prices
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 6.2 Write property tests for MockDataProvider (Properties 19, 20)
    - **Property 19: Mock price within bounds** — Generated lastPrice within [P×0.98, P×1.02] of base price P
    - **Property 20: Mock depth structure** — Generated depth has exactly 5 bid and 5 ask levels
    - **Validates: Requirements 8.2, 8.5**

- [x] 7. Implement tick parsing and NormalizedTick transformation
  - [x] 7.1 Create tick parser utility
    - Create `apps/api/src/market-feed/tick-parser.ts`
    - Transform `RawHsmTick` → `NormalizedTick`: parse numeric strings to numbers, format timestamp as ISO-8601
    - Validate required fields, return null for invalid ticks (log warning with raw payload)
    - Ensure lastPrice is positive
    - _Requirements: 5.2, 5.3, 5.4_

  - [ ]* 7.2 Write property test for tick parsing (Property 10)
    - **Property 10: Tick parsing structural validity** — All numeric fields are numbers, lastPrice positive, timestamp valid ISO-8601
    - **Validates: Requirements 4.3, 5.2, 5.4**

- [x] 8. Implement MarketDataManager (central orchestration)
  - [x] 8.1 Implement MarketDataManager service
    - Create `apps/api/src/market-feed/market-data-manager.service.ts`
    - Inject IMarketDataProvider (HSM or Mock based on MOCK_MARKET_DATA env), SubscriptionBuilder, TickCache, DepthCache, EventEmitter2, KotakSessionStore, PrismaService
    - Implement `connect()` — use provider.connect with session credentials
    - Implement `subscribeStock(symbol)` — resolve symbol → instrument → build subscription → send to provider
    - Implement `subscribeIndex(symbol)` — resolve index → build index subscription
    - Implement `subscribeOption({underlying, expiry, strike, optionType})` — resolve option instrument → subscribe
    - Implement `subscribeDepth(token)` — subscribe for depth data
    - Implement `unsubscribe(token)` — send unsubscribe, remove from active subs and caches
    - Implement `getLatestTick(token)`, `getLatestDepth(token)`, `getActiveSubscriptions()`, `getConnectionStatus()`
    - Wire provider tick/depth callbacks to parse, cache, and emit events via EventEmitter2
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 8.2 Implement startup sequence in MarketDataManager
    - On `onModuleInit()`: sync instruments → connect provider → restore persisted subscriptions → emit `market-feed-ready`
    - Handle sync failure gracefully (proceed with stale data, emit `startup-degraded`)
    - If no active KotakSession, enter waiting state and connect when session becomes available
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 9. Checkpoint - Core orchestration complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement InstrumentMasterSync service
  - [x] 10.1 Implement InstrumentMasterSync service
    - Create `apps/api/src/market-feed/instrument-master-sync.service.ts`
    - Implement `syncAll()` method orchestrating the full sync pipeline
    - Implement `fetchFilePaths()` — GET `<baseUrl>/script-details/1.0/masterscrip/file-paths` to get CSV URLs
    - Implement `downloadAndParseCsv(url)` — download and parse CSV rows with retry (3× at 5s intervals)
    - Implement `upsertInstruments(rows)` — upsert into Instrument table matching on exchange + instrumentToken
    - Implement `deactivateExpired()` — set isActive=false for instruments with past expiry
    - Ensure idempotency (same input → same DB state)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 10.2 Write property tests for InstrumentMasterSync (Properties 4, 5, 6)
    - **Property 4: Instrument sync idempotency** — Running sync twice with same data produces identical state
    - **Property 5: Instrument CSV parse round-trip** — Parsed and upserted row can be queried back with equivalent fields
    - **Property 6: Expiry-based deactivation** — Past expiry → isActive=false; future/null expiry → isActive=true
    - **Validates: Requirements 2.3, 2.4, 2.6**

- [x] 11. Implement ATMEngine
  - [x] 11.1 Implement ATMEngine service
    - Create `apps/api/src/market-feed/atm-engine.service.ts`
    - Read `ATM_STRIKE_RANGE` from config (default 5)
    - Implement `onSpotTick(underlying, spotPrice)` — recalculate ATM when spot price changes
    - Implement `calculateATM(spotPrice, availableStrikes)` — find strike minimizing |strike - spot|
    - Implement `getATMStrike(underlying)` — return current ATM for an underlying
    - Implement `rebalanceSubscriptions(underlying, newATM, oldATM)` — unsubscribe old range, subscribe new range (±N strikes, CALL+PUT = 4N options)
    - Subscribe to tick events via EventEmitter2 for spot price updates
    - Log warning and skip if no contracts exist for underlying/expiry
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 11.2 Write property tests for ATMEngine (Properties 16, 17, 18)
    - **Property 16: ATM strike nearest to spot** — Selected strike minimizes |strike - spot|
    - **Property 17: ATM subscription range completeness** — Subscribes to exactly 4N options (N above + N below, CALL + PUT)
    - **Property 18: ATM rebalance correctness** — New subs = (newRange \ oldRange), unsubs = (oldRange \ newRange)
    - **Validates: Requirements 7.1, 7.2, 7.3**

- [x] 12. Implement WatchlistService
  - [x] 12.1 Implement WatchlistService
    - Create `apps/api/src/market-feed/watchlist.service.ts`
    - Implement `addSymbol(userId, watchlistId, symbol)` — validate symbol exists, check 50-symbol limit, persist, auto-subscribe via MarketDataManager
    - Implement `removeSymbol(userId, watchlistId, symbol)` — remove from watchlist, unsubscribe only if no other watchlist references it (reference counting)
    - Implement `getWatchlist(userId, watchlistId)` — return watchlist items
    - Implement `getPersistedSubscriptions()` — return all symbols from all watchlists for startup restoration
    - Return descriptive error if symbol not found in Instrument table
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 12.2 Write property tests for WatchlistService (Properties 21, 22)
    - **Property 21: Watchlist reference-counted unsubscribe** — Removing symbol from one watchlist doesn't unsubscribe if another watchlist still has it
    - **Property 22: Watchlist size limit enforcement** — Cannot add 51st symbol; watchlist stays at 50
    - **Validates: Requirements 10.2, 10.5**

- [x] 13. Checkpoint - Domain services complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Implement MarketFeedGateway (Socket.IO)
  - [x] 14.1 Implement MarketFeedGateway WebSocket gateway
    - Create `apps/api/src/market-feed/market-feed.gateway.ts`
    - Use `@WebSocketGateway({ namespace: '/market-feed', cors: { origin: '*', credentials: true } })`
    - Implement `OnGatewayConnection` and `OnGatewayDisconnect`
    - Listen to EventEmitter2 `tick.*` events and broadcast to subscribed clients
    - Handle client messages: `subscribe` (add tokens to client room), `unsubscribe`, `getStatus`
    - Emit connection status changes to all connected clients
    - _Requirements: 12.6_

  - [ ]* 14.2 Write unit tests for MarketFeedGateway
    - Test client subscription/unsubscription handling
    - Test tick broadcasting to correct rooms
    - Test connection status emission
    - _Requirements: 12.6_

- [x] 15. Configuration and Module Registration
  - [x] 15.1 Add environment variables and configuration
    - Add `HSM_WS_URL`, `MOCK_MARKET_DATA`, `ATM_STRIKE_RANGE`, `MOCK_TICK_INTERVAL` to `.env.example`
    - Create `apps/api/src/market-feed/market-feed.config.ts` with ConfigService-based configuration
    - Use `MOCK_MARKET_DATA=true` to select MockDataProvider vs HsmWebSocketClient as IMarketDataProvider
    - _Requirements: 8.1, 7.2_

  - [x] 15.2 Create MarketFeedModule and register all services
    - Create `apps/api/src/market-feed/market-feed.module.ts`
    - Register providers: TickCache, DepthCache, SubscriptionBuilder, HsmWebSocketClient, MockDataProvider, MarketDataManager, InstrumentMasterSync, ATMEngine, WatchlistService, MarketFeedGateway
    - Use factory provider for `IMarketDataProvider` token that selects HSM or Mock based on config
    - Import required modules (PrismaModule, EventEmitterModule, ConfigModule)
    - Register module in `app.module.ts`
    - _Requirements: 9.1_

- [x] 16. Implement Frontend Live Dashboard
  - [x] 16.1 Create Live Dashboard page with connection status and subscriptions panel
    - Create `apps/web/app/dashboard/market-feed/page.tsx`
    - Create Socket.IO client hook connecting to `/market-feed` namespace
    - Display connection status indicator (CONNECTED/DISCONNECTED/RECONNECTING with color coding)
    - Display active subscriptions table with columns: symbol, LTP, change (abs + %), volume
    - Update values in real-time as tick events arrive (<100ms from receipt)
    - _Requirements: 12.1, 12.2, 12.5, 12.6_

  - [x] 16.2 Create Options Monitor and Market Depth panels
    - Add options monitor panel showing CE/PE LTP, volume, OI for ATM ± configured strikes
    - Add market depth panel showing 5 levels of bids and asks (price, quantity, orders) for selected instrument
    - Wire panels to Socket.IO events for real-time updates
    - _Requirements: 12.3, 12.4, 12.5_

- [x] 17. Checkpoint - Integration complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 18. Integration tests
  - [ ]* 18.1 Write integration tests for end-to-end market feed flow
    - Test: tick from mock provider → NormalizedTick → TickCache → EventEmitter → Gateway emission
    - Test: InstrumentMasterSync with mocked CSV endpoint
    - Test: Subscription restoration timing (<2s after reconnection)
    - Test: MarketDataManager startup sequence (sync → connect → restore → ready event)
    - _Requirements: 4.6, 9.1, 11.3_

- [x] 19. Final checkpoint - All tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The `IMarketDataProvider` factory pattern ensures Mock and HSM are transparently swappable
- `fast-check` is already available in devDependencies for property-based tests

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.3", "3.1"] },
    { "id": 2, "tasks": ["2.2", "2.4", "3.2", "7.1"] },
    { "id": 3, "tasks": ["5.1", "6.1", "7.2"] },
    { "id": 4, "tasks": ["5.2", "5.3", "6.2"] },
    { "id": 5, "tasks": ["8.1", "10.1", "15.1"] },
    { "id": 6, "tasks": ["8.2", "10.2", "11.1", "15.2"] },
    { "id": 7, "tasks": ["11.2", "12.1"] },
    { "id": 8, "tasks": ["12.2", "14.1"] },
    { "id": 9, "tasks": ["14.2", "16.1"] },
    { "id": 10, "tasks": ["16.2"] },
    { "id": 11, "tasks": ["18.1"] }
  ]
}
```
