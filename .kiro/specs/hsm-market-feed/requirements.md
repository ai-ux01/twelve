# Requirements Document

## Introduction

The HSM Market Feed feature provides real-time market data streaming to ProfitTerminal via Kotak Securities' HSM WebSocket service. It enables live price ticks, options chain monitoring, and market depth for equities and derivatives on NSE. The feature includes an instrument master sync pipeline, a centralized MarketDataManager, an ATM strike engine for options, a mock mode for development, user watchlists, and a frontend live dashboard.

## Glossary

- **HSM_WebSocket_Client**: The NestJS service responsible for establishing, maintaining, and reconnecting to the Kotak HSM WebSocket at wss://mlhsm.kotaksecurities.com
- **Instrument_Master_Sync**: The service that downloads, parses, and upserts Kotak scrip master CSV data into the PostgreSQL Instrument table
- **Market_Data_Manager**: The central orchestration service that manages subscriptions, routes ticks, and exposes APIs for live market data consumption
- **ATM_Engine**: The component that auto-calculates the at-the-money strike price from spot data and manages option chain subscriptions around it
- **Tick_Cache**: The in-memory store holding the latest normalized tick for each subscribed instrument token
- **Depth_Cache**: The in-memory store holding the latest market depth snapshot (5 levels of bids/asks) for subscribed instruments
- **Subscription_Builder**: The utility that constructs HSM-compatible subscription strings (e.g., `nse_cm|11536&1`) from Instrument table records
- **Normalized_Tick**: The broker-independent tick data model containing instrumentToken, exchange, symbol, lastPrice, open, high, low, previousClose, volume, oi, bid, ask, and timestamp
- **Mock_Data_Provider**: The service that generates simulated market ticks when MOCK_MARKET_DATA=true, enabling development without live credentials
- **Watchlist_Service**: The service that manages user stock watchlists and auto-subscribes instruments via the Market_Data_Manager
- **Live_Dashboard**: The Next.js frontend component displaying real-time connection status, subscriptions, ticks, options monitor, and depth panels
- **KotakSessionStore**: The existing NestJS service providing auth, sid, and dataCenter from the Kotak MPIN validation flow

## Requirements

### Requirement 1: HSM WebSocket Connection

**User Story:** As a trader, I want the system to establish a persistent WebSocket connection to Kotak HSM, so that I can receive real-time market data.

#### Acceptance Criteria

1. WHEN a valid KotakSession exists, THE HSM_WebSocket_Client SHALL connect to wss://mlhsm.kotaksecurities.com using the session auth token, SID, and dataCenter from KotakSessionStore
2. WHILE the WebSocket connection is open, THE HSM_WebSocket_Client SHALL respond to server heartbeat messages within 5 seconds to maintain the connection
3. WHEN the WebSocket connection is lost, THE HSM_WebSocket_Client SHALL attempt reconnection using exponential backoff starting at 1 second, doubling on each attempt, up to a maximum of 60 seconds
4. WHEN reconnection succeeds, THE HSM_WebSocket_Client SHALL restore all previously active subscriptions automatically
5. IF a connection attempt fails due to invalid session credentials, THEN THE HSM_WebSocket_Client SHALL emit a session-expired event and cease reconnection attempts
6. THE HSM_WebSocket_Client SHALL expose a getConnectionStatus() method returning one of: DISCONNECTED, CONNECTING, CONNECTED, RECONNECTING

### Requirement 2: Instrument Master Sync

**User Story:** As a system operator, I want to synchronize the Kotak scrip master data into the local database, so that the system has accurate instrument metadata for subscription building.

#### Acceptance Criteria

1. WHEN the sync process is triggered, THE Instrument_Master_Sync SHALL fetch scrip master CSV file paths from GET `<baseUrl>/script-details/1.0/masterscrip/file-paths`
2. WHEN CSV files are downloaded, THE Instrument_Master_Sync SHALL parse each row and upsert into the PostgreSQL Instrument table matching on exchange + instrument token
3. THE Instrument_Master_Sync SHALL mark instruments as inactive (isActive=false) when their expiry date is in the past
4. THE Instrument_Master_Sync SHALL perform the sync operation idempotently, producing the same database state regardless of how many times it is executed with the same input data
5. IF the CSV download fails, THEN THE Instrument_Master_Sync SHALL retry up to 3 times with 5-second intervals before reporting failure
6. FOR ALL valid CSV rows parsed and upserted, parsing then querying by exchange and token SHALL return an equivalent instrument record (round-trip property)

### Requirement 3: Subscription Format Builder

**User Story:** As a developer, I want subscription strings built automatically from Instrument data, so that I don't need to manually construct HSM protocol messages.

#### Acceptance Criteria

1. WHEN a stock subscription is requested, THE Subscription_Builder SHALL construct a string in the format `{exchange_segment}|{instrument_token}&1` from the Instrument record
2. WHEN an index subscription is requested, THE Subscription_Builder SHALL construct a string in the format `{exchange_segment}|{index_name}&1` from the Instrument record
3. THE Subscription_Builder SHALL deduplicate subscription strings, ensuring no duplicate tokens are sent to the HSM WebSocket
4. IF the Instrument record is missing required fields (exchange or instrumentToken), THEN THE Subscription_Builder SHALL throw a validation error with a descriptive message
5. THE Subscription_Builder SHALL enforce the HSM protocol limit of 200 total scrips and 16 channels, rejecting subscriptions that would exceed these limits

### Requirement 4: Market Data Manager

**User Story:** As a trading system component, I want a single service to manage all market data subscriptions and access, so that consumers have a unified interface for live data.

#### Acceptance Criteria

1. THE Market_Data_Manager SHALL expose connect(), subscribeStock(symbol), subscribeIndex(symbol), subscribeOption({underlying, expiry, strike, optionType}), subscribeDepth(token), unsubscribe(token), getLatestTick(token), getLatestDepth(token), getActiveSubscriptions(), and getConnectionStatus() methods
2. WHEN a subscription method is called, THE Market_Data_Manager SHALL resolve the symbol to an instrument token via the Instrument table, build the subscription string, and send it to the HSM_WebSocket_Client
3. WHEN the HSM_WebSocket_Client delivers a raw tick message, THE Market_Data_Manager SHALL parse it into a Normalized_Tick and store it in the Tick_Cache
4. WHEN getLatestTick(token) is called, THE Market_Data_Manager SHALL return the most recent Normalized_Tick from the Tick_Cache for that token, or null if no tick has been received
5. WHEN unsubscribe(token) is called, THE Market_Data_Manager SHALL send an unsubscribe message to the HSM_WebSocket_Client and remove the token from active subscriptions and the Tick_Cache
6. THE Market_Data_Manager SHALL emit tick events via NestJS EventEmitter so other services can react to price updates in real time

### Requirement 5: Normalized Tick Model

**User Story:** As a developer, I want a broker-independent tick format, so that downstream services are not coupled to Kotak's raw message structure.

#### Acceptance Criteria

1. THE Normalized_Tick SHALL contain the fields: instrumentToken, exchange, symbol, lastPrice, open, high, low, previousClose, volume, oi, bid, ask, and timestamp
2. WHEN a raw HSM tick message is received, THE Market_Data_Manager SHALL transform it into a Normalized_Tick with all numeric fields as numbers and timestamp as an ISO-8601 string
3. IF a raw tick message is missing required fields, THEN THE Market_Data_Manager SHALL discard the message and log a warning with the raw payload
4. FOR ALL valid raw tick messages parsed into Normalized_Tick objects, the lastPrice SHALL be a positive number and timestamp SHALL be a valid ISO-8601 date string (structural validity property)

### Requirement 6: Market Depth

**User Story:** As a trader, I want to see market depth for subscribed instruments, so that I can assess liquidity and order flow before placing trades.

#### Acceptance Criteria

1. WHEN a depth subscription is active, THE Market_Data_Manager SHALL store the latest depth snapshot in the Depth_Cache containing up to 5 levels of bids and 5 levels of asks
2. THE Depth_Cache SHALL normalize each depth snapshot into a structure containing: bids (array of {price, quantity, orders}), asks (array of {price, quantity, orders}), bestBid, bestAsk, and spread
3. WHEN getLatestDepth(token) is called, THE Market_Data_Manager SHALL return the most recent normalized depth snapshot from the Depth_Cache
4. THE Depth_Cache SHALL ensure bids are sorted in descending price order and asks are sorted in ascending price order (sort invariant property)
5. THE Depth_Cache SHALL compute spread as bestAsk minus bestBid, and spread SHALL be a non-negative number

### Requirement 7: ATM Engine

**User Story:** As an options trader, I want the system to automatically track ATM strikes and subscribe to nearby options, so that I always have live data for the most relevant strikes.

#### Acceptance Criteria

1. WHEN a spot price tick is received for an underlying instrument, THE ATM_Engine SHALL calculate the at-the-money strike as the strike price closest to the current spot price from available strikes in the Instrument table
2. THE ATM_Engine SHALL subscribe to ±N strikes around the ATM (configurable via ATM_STRIKE_RANGE, default 5), covering both CALL and PUT option types
3. WHEN the calculated ATM strike changes from the previous ATM strike, THE ATM_Engine SHALL unsubscribe from strikes that fall outside the new ±N range and subscribe to newly included strikes
4. THE ATM_Engine SHALL expose getATMStrike(underlying) returning the current ATM strike price for a given underlying
5. IF no option contracts exist in the Instrument table for the requested underlying and expiry, THEN THE ATM_Engine SHALL log a warning and skip subscription without throwing an error

### Requirement 8: Mock Market Data

**User Story:** As a developer, I want simulated market data during development, so that I can build and test features without live Kotak credentials.

#### Acceptance Criteria

1. WHEN the environment variable MOCK_MARKET_DATA is set to "true", THE Mock_Data_Provider SHALL generate synthetic tick data for all active subscriptions
2. WHILE mock mode is active, THE Mock_Data_Provider SHALL emit ticks at a configurable interval (default 1 second) with randomized price movements within ±2% of a base price
3. THE Mock_Data_Provider SHALL implement the same interface as the HSM_WebSocket_Client, allowing the Market_Data_Manager to operate identically in mock and live modes
4. WHEN mock mode is active, THE Mock_Data_Provider SHALL report connection status as CONNECTED without establishing a real WebSocket connection
5. THE Mock_Data_Provider SHALL generate depth snapshots with 5 bid levels and 5 ask levels around the simulated last price

### Requirement 9: Startup Flow

**User Story:** As a system operator, I want a defined startup sequence, so that the system initializes all market data components in the correct order.

#### Acceptance Criteria

1. WHEN the application starts, THE Market_Data_Manager SHALL execute the startup sequence in order: load instrument master, connect HSM WebSocket, restore persisted subscriptions, begin receiving data
2. IF the instrument master sync fails during startup, THEN THE Market_Data_Manager SHALL log the error and proceed with stale instrument data if available, or emit a startup-degraded event
3. IF no active KotakSession exists at startup, THEN THE Market_Data_Manager SHALL enter a waiting state and connect when a session becomes available
4. WHEN all startup steps complete successfully, THE Market_Data_Manager SHALL emit a market-feed-ready event

### Requirement 10: Watchlists

**User Story:** As a trader, I want to manage watchlists of stocks, so that selected instruments are automatically subscribed for live data.

#### Acceptance Criteria

1. WHEN a user adds a symbol to a watchlist, THE Watchlist_Service SHALL auto-subscribe the instrument via the Market_Data_Manager
2. WHEN a user removes a symbol from a watchlist, THE Watchlist_Service SHALL unsubscribe the instrument via the Market_Data_Manager if no other watchlist references it
3. THE Watchlist_Service SHALL persist watchlists to the database so they survive application restarts
4. IF the symbol does not exist in the Instrument table, THEN THE Watchlist_Service SHALL return a descriptive error indicating the symbol is not found
5. THE Watchlist_Service SHALL enforce a maximum of 50 symbols per watchlist to stay within HSM subscription limits

### Requirement 11: Reconnection Resilience

**User Story:** As a trader, I want the system to recover gracefully from network disruptions, so that I never miss market data for extended periods.

#### Acceptance Criteria

1. WHEN a disconnection is detected, THE HSM_WebSocket_Client SHALL immediately transition connection status to RECONNECTING and begin the exponential backoff sequence
2. WHILE reconnecting, THE HSM_WebSocket_Client SHALL retain the list of active subscriptions in memory so they can be restored on successful reconnection
3. WHEN reconnection succeeds, THE HSM_WebSocket_Client SHALL resubscribe to all previously active subscriptions within 2 seconds of connection establishment
4. THE HSM_WebSocket_Client SHALL track reconnection metrics: total reconnection attempts, successful reconnections, and time spent disconnected
5. IF reconnection has failed for more than 5 consecutive minutes, THEN THE HSM_WebSocket_Client SHALL emit a connection-critical event to alert monitoring systems

### Requirement 12: Frontend Live Dashboard

**User Story:** As a trader, I want a real-time dashboard showing live market data, so that I can monitor prices, options, and depth visually.

#### Acceptance Criteria

1. THE Live_Dashboard SHALL display a connection status indicator showing the current HSM WebSocket state (CONNECTED, DISCONNECTED, RECONNECTING)
2. THE Live_Dashboard SHALL display a list of active subscriptions with columns: symbol, LTP, change (absolute and percentage), and volume, updating in real time
3. THE Live_Dashboard SHALL include an options monitor panel showing CE and PE LTP, volume, and OI for the ATM ± configured strikes
4. THE Live_Dashboard SHALL include a market depth panel showing 5 levels of bids and asks with price, quantity, and order count for a selected instrument
5. WHEN new tick data arrives, THE Live_Dashboard SHALL update the displayed values within 100 milliseconds of receipt from the backend WebSocket
6. THE Live_Dashboard SHALL communicate with the backend via a dedicated WebSocket gateway on the NestJS API server
