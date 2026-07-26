# Requirements Document

## Introduction

This feature adds a historical market data storage and retrieval system to ProfitTerminal. It provides a 2-year rolling window of OHLCV candle data in PostgreSQL, integrating with the existing Kite Connect and Kotak Neo broker infrastructure. The system supports incremental sync, automatic retention cleanup, and serves as the data backbone for backtesting, AI analysis, and frontend charting. It builds upon the existing `Candle` model and `Instrument` master table already in the Prisma schema.

## Glossary

- **Historical_Data_Service**: The NestJS service responsible for fetching, storing, syncing, and querying historical OHLCV candle data within the `apps/api` application.
- **Retention_Scheduler**: The scheduled background job that runs daily to delete candle data older than the configured retention period.
- **Candle**: A single OHLCV (Open, High, Low, Close, Volume) data point for a specific instrument and timeframe at a specific timestamp, stored in the existing PostgreSQL `Candle` table.
- **Instrument_Master**: The existing `Instrument` table in PostgreSQL that holds metadata for all tradable instruments (symbol, exchange, asset type, etc.).
- **Sync_Service**: The component responsible for incrementally fetching missing historical data from the broker API and persisting it to PostgreSQL.
- **Market_Data_API**: The REST API endpoint that serves historical candle data to frontend and other consumers.
- **Tick_Buffer**: An in-memory buffer that batches incoming live ticks before optional persistence to the database.
- **HSM_WebSocket**: The Kotak HSM WebSocket connection (wss://mlhsm.kotaksecurities.com) that streams live market ticks.
- **Retention_Period**: The configurable maximum age of stored candle data, defaulting to 2 years.
- **Rate_Limiter**: The mechanism that throttles outbound broker API requests to stay within Kotak's 10 requests/second limit.

## Requirements

### Requirement 1: Historical Candle Data Model

**User Story:** As a developer, I want a well-defined data model for historical candles that references the instrument master, so that candle data is normalized and efficient to query.

#### Acceptance Criteria

1. THE Candle model SHALL store id, instrumentId, timeframe, timestamp, open, high, low, close, volume, and createdAt fields.
2. THE Candle model SHALL support optional openInterest (oi) storage via the existing schema.
3. THE Candle model SHALL enforce a unique constraint on the combination of instrumentId, timeframe, and timestamp.
4. THE Candle model SHALL reference the Instrument_Master via a foreign key on instrumentId.
5. THE Candle model SHALL support the timeframes ONE_MIN, FIVE_MIN, FIFTEEN_MIN, ONE_HOUR, and ONE_DAY from the existing Timeframe enum.
6. WHEN a new timeframe is needed, THE Timeframe enum SHALL be extensible by adding a new value to the Prisma enum definition.

### Requirement 2: Duplicate Prevention via Idempotent Upsert

**User Story:** As a developer, I want candle inserts to be idempotent, so that re-syncing or overlapping data never creates duplicate records.

#### Acceptance Criteria

1. WHEN the Sync_Service inserts a candle with an instrumentId, timeframe, and timestamp that already exists, THE Historical_Data_Service SHALL perform an upsert that updates the existing record instead of creating a duplicate.
2. THE Historical_Data_Service SHALL use batch upsert operations for inserting multiple candles in a single database transaction.
3. FOR ALL candle upsert operations, inserting then querying SHALL return exactly one record per instrumentId+timeframe+timestamp combination (idempotence property).

### Requirement 3: Historical Data Query Service

**User Story:** As a consumer of market data (frontend, backtesting engine, AI), I want to query historical candles by instrument, timeframe, and date range, so that I can perform analysis on past price action.

#### Acceptance Criteria

1. THE Historical_Data_Service SHALL provide a getHistoricalCandles method accepting instrumentId, timeframe, fromDate, and toDate parameters.
2. WHEN fromDate is earlier than the retention boundary (current date minus Retention_Period), THE Historical_Data_Service SHALL clamp fromDate to the retention boundary.
3. WHEN toDate is in the future, THE Historical_Data_Service SHALL clamp toDate to the current timestamp.
4. THE Historical_Data_Service SHALL return candles ordered by timestamp in ascending order.
5. IF no candles exist for the requested range, THEN THE Historical_Data_Service SHALL return an empty array.

### Requirement 4: Incremental Sync Service

**User Story:** As a system operator, I want the sync process to only fetch missing data from the broker, so that API usage is minimized and sync is fast.

#### Acceptance Criteria

1. THE Sync_Service SHALL provide a syncHistoricalData method accepting instrumentId and timeframe parameters.
2. WHEN syncing, THE Sync_Service SHALL determine the latest stored timestamp for the instrument+timeframe combination and only request data after that timestamp from the broker API.
3. WHEN an instrument has no stored candles, THE Sync_Service SHALL request up to 2 years of historical data from the broker API.
4. THE Sync_Service SHALL chunk broker API requests into date ranges that respect the Kotak API response limits.
5. THE Rate_Limiter SHALL throttle outbound broker API requests to a maximum of 10 requests per second.
6. IF the broker API returns an error, THEN THE Sync_Service SHALL log the error and retry with exponential backoff up to 3 attempts.

### Requirement 5: 2-Year Rolling Retention with Automatic Cleanup

**User Story:** As a system operator, I want data older than 2 years to be automatically deleted, so that storage remains bounded and the system stays performant.

#### Acceptance Criteria

1. THE Retention_Scheduler SHALL execute once daily at a configurable time.
2. WHEN the Retention_Scheduler executes, THE Retention_Scheduler SHALL delete all Candle records where the timestamp is older than the configured Retention_Period.
3. THE Retention_Scheduler SHALL perform deletion in batches to avoid long-running transactions and database locks.
4. THE Retention_Scheduler SHALL log the number of records deleted and the execution duration.
5. THE Retention_Scheduler SHALL only delete Candle records and SHALL NOT delete Instrument, Signal, Trade, or any other entity type.
6. IF the Retention_Scheduler encounters an error during batch deletion, THEN THE Retention_Scheduler SHALL log the error and continue with the next batch.

### Requirement 6: REST API Endpoint for Historical Data

**User Story:** As a frontend developer, I want a REST endpoint to fetch historical candle data, so that I can render charts and perform client-side analysis.

#### Acceptance Criteria

1. THE Market_Data_API SHALL expose GET /api/market-data/history accepting query parameters: instrumentId, timeframe, from, and to.
2. WHEN the from parameter is earlier than 2 years ago, THE Market_Data_API SHALL clamp the from value to 2 years ago and return data from the clamped boundary.
3. WHEN required parameters (instrumentId, timeframe) are missing, THE Market_Data_API SHALL return HTTP 400 with a descriptive validation error.
4. IF the requested instrumentId does not exist in the Instrument_Master, THEN THE Market_Data_API SHALL return HTTP 404 with a descriptive error message.
5. THE Market_Data_API SHALL return JSON with fields: instrumentId, timeframe, from, to, count, and candles array.

### Requirement 7: Frontend Chart Range Selectors

**User Story:** As a trader, I want to select predefined time ranges (1D, 1W, 1M, 3M, 6M, 1Y, 2Y) on charts, so that I can quickly view different historical windows.

#### Acceptance Criteria

1. THE frontend chart component SHALL display range selector buttons for 1D, 1W, 1M, 3M, 6M, 1Y, and 2Y.
2. THE frontend chart component SHALL NOT display range options beyond 2Y (no 3Y, 5Y, or All-Time selectors).
3. WHEN a user selects a range, THE frontend SHALL request data from the Market_Data_API with the calculated from and to dates.
4. WHEN the Market_Data_API returns clamped dates, THE frontend SHALL display a notification indicating the available data range.

### Requirement 8: Backtesting Integration with 2-Year Window

**User Story:** As a quant researcher, I want the backtesting engine to use the historical data within the 2-year window, so that backtests operate on consistent stored data.

#### Acceptance Criteria

1. THE backtesting engine SHALL source candle data from the Historical_Data_Service for all backtests.
2. WHEN a user selects a backtest start date older than the retention boundary, THE backtesting engine SHALL return a validation error specifying the earliest available date.
3. THE backtesting engine SHALL NOT execute a backtest if the requested date range falls entirely outside the available data window.

### Requirement 9: AI Analysis Integration

**User Story:** As an AI-powered analysis consumer, I want AI analysis to use the available 2-year data window, so that analysis is grounded in stored historical data.

#### Acceptance Criteria

1. THE AI analysis service SHALL source candle data from the Historical_Data_Service.
2. WHEN AI analysis requests data beyond the 2-year window, THE Historical_Data_Service SHALL return only available data within the retention boundary.
3. THE AI analysis service SHALL include the available data date range in its analysis context.

### Requirement 10: Startup Background Sync

**User Story:** As a system operator, I want the application to automatically sync missing historical data on startup, so that the system is always up-to-date without manual intervention.

#### Acceptance Criteria

1. WHEN the application starts, THE Sync_Service SHALL initiate a background sync for all active instruments.
2. THE startup sync SHALL be non-blocking and SHALL NOT delay the API server from accepting requests.
3. WHEN the startup sync completes, THE Sync_Service SHALL log the total number of candles synced and duration.
4. THE startup sync SHALL also trigger the Retention_Scheduler to perform a cleanup pass.

### Requirement 11: Live HSM Tick Separation

**User Story:** As a developer, I want live ticks from the HSM WebSocket to remain in memory/cache and be stored separately from historical candles, so that the two data paths do not conflict.

#### Acceptance Criteria

1. THE HSM_WebSocket live tick data SHALL remain in memory or cache and SHALL NOT be written directly to the Candle table.
2. THE Historical_Data_Service SHALL only persist completed candles (closed timeframe bars) to the Candle table.
3. WHILE live market data is streaming, THE system SHALL serve real-time data from the in-memory cache and historical data from PostgreSQL independently.

### Requirement 12: Optional Tick Storage

**User Story:** As a system operator, I want to optionally enable tick-level storage for detailed analysis, so that raw tick data is available when needed without impacting default performance.

#### Acceptance Criteria

1. THE Tick_Buffer SHALL be disabled by default (STORE_TICKS=false environment variable).
2. WHERE tick storage is enabled (STORE_TICKS=true), THE Tick_Buffer SHALL batch incoming ticks and flush to the database at intervals of TICK_BATCH_SIZE (default 1000) ticks or TICK_BATCH_INTERVAL_MS (default 5000) milliseconds, whichever threshold is reached first.
3. WHERE tick storage is disabled, THE system SHALL NOT write any tick data to the database.
4. THE Tick_Buffer SHALL NOT block the live data processing pipeline during database flush operations.

### Requirement 13: Performance and Indexing

**User Story:** As a developer, I want queries on historical data to be fast, so that chart rendering, backtesting, and AI analysis remain responsive.

#### Acceptance Criteria

1. THE Candle table SHALL maintain a composite index on (instrumentId, timeframe, timestamp).
2. THE Candle table SHALL maintain an index on timestamp for retention cleanup queries.
3. THE Historical_Data_Service SHALL use batch operations for all bulk insert and delete operations.
4. THE Historical_Data_Service SHALL NOT perform full-table scans for any standard query operation.

### Requirement 14: Configuration

**User Story:** As a system operator, I want key parameters to be configurable via environment variables, so that I can tune the system without code changes.

#### Acceptance Criteria

1. THE system SHALL read MARKET_DATA_RETENTION_YEARS from environment variables with a default value of 2.
2. THE system SHALL read STORE_TICKS from environment variables with a default value of false.
3. THE system SHALL read TICK_BATCH_SIZE from environment variables with a default value of 1000.
4. THE system SHALL read TICK_BATCH_INTERVAL_MS from environment variables with a default value of 5000.
5. WHEN an environment variable has an invalid value, THE system SHALL log a warning and use the default value.

### Requirement 15: Integration Constraints

**User Story:** As a developer, I want this feature to integrate cleanly into the existing ProfitTerminal architecture, so that no existing functionality is broken.

#### Acceptance Criteria

1. THE Historical_Data_Service SHALL integrate into the existing `market-data` NestJS module within `apps/api`.
2. THE system SHALL use the existing PrismaService for all PostgreSQL operations.
3. THE system SHALL use the existing Candle model and Instrument model from the Prisma schema.
4. THE system SHALL NOT modify existing API endpoints, services, or database tables in a breaking way.
5. THE system SHALL run entirely locally without requiring external cloud services beyond the existing broker APIs.
