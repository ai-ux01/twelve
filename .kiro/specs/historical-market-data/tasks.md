# Implementation Plan: Historical Market Data

## Overview

This plan implements a historical market data storage and retrieval system within the existing `MarketDataModule` in `apps/api`. The system provides a 2-year rolling window of OHLCV candle data in PostgreSQL with incremental sync, automatic retention cleanup, and consumer integrations (frontend charts, backtesting, AI analysis). All new services integrate into the existing NestJS module and Prisma schema.

## Tasks

- [x] 1. Configuration and environment setup
  - [x] 1.1 Add environment variables and configuration validation
    - Add `MARKET_DATA_RETENTION_YEARS`, `STORE_TICKS`, `TICK_BATCH_SIZE`, `TICK_BATCH_INTERVAL_MS`, `SYNC_ON_STARTUP`, `RETENTION_CRON`, `BROKER_RATE_LIMIT_RPS` to `.env.example`
    - Extend `apps/api/src/config/env.validation.ts` with validation rules for each new variable
    - Extend `apps/api/src/config/config.service.ts` with typed getter methods that return defaults on invalid values and log warnings
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [ ]* 1.2 Write unit tests for configuration defaults and invalid-value fallback
    - Test that missing env vars return documented defaults
    - Test that invalid values (non-numeric for numbers, non-boolean for booleans) log a warning and return defaults
    - _Requirements: 14.5_

- [x] 2. Implement HistoricalDataService (core data layer)
  - [x] 2.1 Create HistoricalDataService with getHistoricalCandles, upsertCandles, getLatestTimestamp, and deleteOlderThan methods
    - Create `apps/api/src/market-data/historical-data.service.ts`
    - Implement `getHistoricalCandles` with date clamping (fromDate clamped to retention boundary, toDate clamped to now), ascending timestamp ordering, and empty-array return for no results
    - Implement `upsertCandles` using Prisma `createMany` with `skipDuplicates` or raw `ON CONFLICT DO UPDATE` for idempotent batch upsert
    - Implement `getLatestTimestamp` for sync gap detection
    - Implement `deleteOlderThan` with configurable batch size to avoid long transactions
    - _Requirements: 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5, 5.2, 5.3, 13.3, 13.4_

  - [ ]* 2.2 Write property test: Candle Upsert Idempotence
    - **Property 1: Candle Upsert Idempotence**
    - Verify that upserting the same candle N times results in exactly one record with values matching the last upsert
    - **Validates: Requirements 1.3, 2.1, 2.3**

  - [ ]* 2.3 Write property test: Date Clamping at Retention Boundary
    - **Property 2: Date Clamping at Retention Boundary**
    - Verify that queries with fromDate before the retention boundary are clamped, and no candles before the boundary appear in results
    - **Validates: Requirements 3.2, 6.2, 9.2**

  - [ ]* 2.4 Write property test: Future Date Clamping
    - **Property 3: Future Date Clamping**
    - Verify that queries with toDate in the future are clamped to current timestamp
    - **Validates: Requirements 3.3**

  - [ ]* 2.5 Write property test: Query Results Ascending Order
    - **Property 4: Query Results Ascending Order**
    - Verify that all returned candles are in strictly ascending timestamp order
    - **Validates: Requirements 3.4**

  - [ ]* 2.6 Write unit tests for HistoricalDataService
    - Test valid queries with boundary dates
    - Test empty results for no matching candles
    - Test batch upsert with multiple candles
    - Test deleteOlderThan respects batch size
    - _Requirements: 3.1, 3.5, 2.2, 5.3_

- [x] 3. Checkpoint - Core data layer verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement RateLimiter service
  - [x] 4.1 Create RateLimiter with token-bucket algorithm
    - Create `apps/api/src/market-data/rate-limiter.service.ts`
    - Implement token-bucket rate limiter: configurable max tokens from `BROKER_RATE_LIMIT_RPS`, automatic refill based on elapsed time
    - Implement `acquire()` method that awaits until a token is available
    - _Requirements: 4.5_

  - [ ]* 4.2 Write unit tests for RateLimiter
    - Test token acquisition succeeds when tokens available
    - Test token acquisition blocks when exhausted
    - Test refill timing logic
    - _Requirements: 4.5_

- [x] 5. Implement SyncService (incremental sync)
  - [x] 5.1 Create SyncService with incremental sync and chunking logic
    - Create `apps/api/src/market-data/sync.service.ts`
    - Implement `syncHistoricalData` that determines the latest stored timestamp and fetches only new data from broker API
    - Implement `chunkDateRange` to split date ranges into broker-API-sized segments respecting Kotak limits
    - Implement `syncAllInstruments` that iterates active instruments with rate limiting
    - Implement `onModuleInit` that triggers non-blocking background sync via `setImmediate` (non-blocking startup)
    - Add exponential backoff retry (1s, 2s, 4s, max 3 attempts) for broker API errors
    - After sync completes, trigger RetentionScheduler cleanup pass
    - Log total candles synced and duration on completion
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 10.1, 10.2, 10.3, 10.4_

  - [ ]* 5.2 Write property test: Incremental Sync Gap Detection
    - **Property 5: Incremental Sync Gap Detection**
    - Verify that sync requests data only after the latest stored timestamp and produces no gaps
    - **Validates: Requirements 4.2**

  - [ ]* 5.3 Write property test: Date Range Chunking Validity
    - **Property 6: Date Range Chunking Validity**
    - Verify chunks are contiguous, non-overlapping, cover the full range, and respect max candle count per chunk
    - **Validates: Requirements 4.4**

  - [ ]* 5.4 Write unit tests for SyncService
    - Test first sync (no existing data) fetches full 2-year window
    - Test incremental sync fetches only from latest stored timestamp
    - Test error handling with exponential backoff
    - Test non-blocking startup behavior
    - _Requirements: 4.2, 4.3, 4.6, 10.2_

- [x] 6. Implement RetentionScheduler (daily cleanup)
  - [x] 6.1 Create RetentionScheduler with cron-based batch deletion
    - Create `apps/api/src/market-data/retention-scheduler.service.ts`
    - Import and configure `@nestjs/schedule` (`ScheduleModule.forRoot()`) in the MarketDataModule
    - Implement `@Cron` decorated method using configurable `RETENTION_CRON` expression (default: daily at 2 AM)
    - Implement batch deletion loop that deletes candles older than retention boundary in configurable batch sizes
    - Log deletion count, batches processed, and duration
    - Implement error resilience: log error on batch failure and continue with next batch
    - Implement `runCleanup()` for manual trigger from SyncService
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 6.2 Write property test: Retention Cleanup Correctness
    - **Property 7: Retention Cleanup Correctness**
    - Verify that after cleanup: no candles older than boundary remain, all candles within window are preserved, non-Candle tables are unaffected
    - **Validates: Requirements 5.2, 5.5**

  - [ ]* 6.3 Write unit tests for RetentionScheduler
    - Test batch deletion processes multiple batches
    - Test error in one batch does not stop subsequent batches
    - Test logging of deletion statistics
    - _Requirements: 5.4, 5.6_

- [x] 7. Checkpoint - Sync and retention verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement TickBuffer (optional tick storage)
  - [x] 8.1 Create TickBuffer with dual-threshold flush logic
    - Create `apps/api/src/market-data/tick-buffer.service.ts`
    - Implement in-memory buffer with `push(tick)` method
    - Implement dual-threshold flush: flush when buffer reaches `TICK_BATCH_SIZE` OR when `TICK_BATCH_INTERVAL_MS` elapses since last flush
    - Implement non-blocking flush (fire-and-forget with error logging)
    - Respect `STORE_TICKS` flag — when disabled, `push` is a no-op
    - Only persist completed (closed) candle bars to the Candle table
    - _Requirements: 11.1, 11.2, 12.1, 12.2, 12.3, 12.4_

  - [ ]* 8.2 Write property test: Only Completed Bars Persisted
    - **Property 11: Only Completed Bars Persisted**
    - Verify that only completed (closed) timeframe bars are written to the Candle table
    - **Validates: Requirements 11.2**

  - [ ]* 8.3 Write property test: Tick Buffer Dual-Threshold Flush
    - **Property 12: Tick Buffer Dual-Threshold Flush**
    - Verify buffer flushes when EITHER batch size OR time interval threshold is reached first
    - **Validates: Requirements 12.2**

  - [ ]* 8.4 Write unit tests for TickBuffer
    - Test flush on size threshold
    - Test flush on time interval threshold
    - Test disabled mode (STORE_TICKS=false) is a no-op
    - Test non-blocking flush does not block pipeline
    - _Requirements: 12.1, 12.3, 12.4_

- [x] 9. Implement HistoricalDataController (REST API)
  - [x] 9.1 Create HistoricalDataController with GET /api/market-data/history endpoint
    - Create `apps/api/src/market-data/historical-data.controller.ts`
    - Create `apps/api/src/market-data/dto/historical-data-query.dto.ts` with class-validator decorators for instrumentId, timeframe, from, to
    - Create `apps/api/src/market-data/dto/historical-data-response.dto.ts` with response shape
    - Implement validation pipe returning HTTP 400 for missing/invalid params
    - Implement HTTP 404 for non-existent instrumentId
    - Return JSON with instrumentId, timeframe, from, to, count, and candles array
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 9.2 Write property test: API Response Shape Completeness
    - **Property 8: API Response Shape Completeness**
    - Verify all valid requests return responses containing all required fields with correct types
    - **Validates: Requirements 6.5**

  - [ ]* 9.3 Write unit tests for HistoricalDataController
    - Test HTTP 400 for missing required params
    - Test HTTP 404 for non-existent instrument
    - Test success response shape and field types
    - _Requirements: 6.3, 6.4, 6.5_

- [x] 10. Wire module registration and integrate services
  - [x] 10.1 Update MarketDataModule to register all new services
    - Add `ScheduleModule.forRoot()` to imports in `apps/api/src/market-data/market-data.module.ts`
    - Register `HistoricalDataService`, `SyncService`, `RetentionScheduler`, `RateLimiter`, `TickBuffer`, `HistoricalDataController` in module
    - Export `HistoricalDataService` for use by other modules
    - Verify no breaking changes to existing MarketDataService or controllers
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

- [x] 11. Checkpoint - API and module integration verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement frontend chart range selectors
  - [x] 12.1 Add range selector buttons to frontend chart component
    - Identify the existing chart component in `apps/web`
    - Add range selector buttons: 1D, 1W, 1M, 3M, 6M, 1Y, 2Y (no options beyond 2Y)
    - Implement date calculation for each range (from = now minus duration, to = now)
    - Wire button clicks to call GET /api/market-data/history with calculated dates
    - Display notification when API returns clamped dates indicating actual available range
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 12.2 Write property test: Range Selector Date Calculation
    - **Property 9: Range Selector Date Calculation**
    - Verify that each range value computes the correct fromDate (exact duration before now) and toDate (current date)
    - **Validates: Requirements 7.3**

- [x] 13. Implement backtesting integration
  - [x] 13.1 Integrate backtesting engine with HistoricalDataService
    - Update backtesting engine in `apps/quant` or `apps/api/src/quant` to source candle data from `HistoricalDataService`
    - Add validation that rejects backtest requests with start date before retention boundary, returning error with earliest available date
    - Reject backtests where entire date range falls outside available data window
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ]* 13.2 Write property test: Backtest Date Validation
    - **Property 10: Backtest Date Validation**
    - Verify that backtest requests with start date before retention boundary return validation error with earliest available date and do not execute
    - **Validates: Requirements 8.2**

- [x] 14. Implement AI analysis integration
  - [x] 14.1 Integrate AI analysis service with HistoricalDataService
    - Update AI service in `apps/api/src/ai` to source candle data from `HistoricalDataService`
    - Ensure requests beyond 2-year window return only available data within retention boundary
    - Include available data date range in analysis context
    - _Requirements: 9.1, 9.2, 9.3_

- [ ] 15. Implement configuration invalid-value fallback property test
  - [ ]* 15.1 Write property test: Configuration Invalid Value Fallback
    - **Property 13: Configuration Invalid Value Fallback**
    - Verify that invalid env var values (non-numeric, non-boolean) cause a warning log and fallback to documented defaults
    - **Validates: Requirements 14.5**

- [ ] 16. Integration tests
  - [ ]* 16.1 Write integration test: Full sync flow
    - Mock broker API → SyncService → PostgreSQL → Query verification
    - Verify end-to-end data flow from API response to stored candles to query results
    - _Requirements: 4.1, 4.2, 10.1_

  - [ ]* 16.2 Write integration test: Retention end-to-end
    - Insert candles with timestamps outside retention window → Run scheduler → Verify deletion and preservation
    - _Requirements: 5.2, 5.5_

  - [ ]* 16.3 Write integration test: API endpoint end-to-end
    - HTTP request → Controller → Service → DB → Verify response shape and content
    - _Requirements: 6.1, 6.5_

- [x] 17. Final checkpoint - Full system verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (Properties 1-13)
- Unit tests validate specific examples and edge cases
- The existing Prisma `Candle` model and indexes already satisfy data model requirements — no schema migration needed
- All new services integrate into the existing `MarketDataModule` without breaking changes
- The design uses TypeScript (NestJS + Prisma) — all implementations use this stack
- Property tests use [fast-check](https://github.com/dubzzz/fast-check) as specified in the design

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "4.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "2.6", "4.2"] },
    { "id": 3, "tasks": ["5.1", "6.1"] },
    { "id": 4, "tasks": ["5.2", "5.3", "5.4", "6.2", "6.3", "8.1"] },
    { "id": 5, "tasks": ["8.2", "8.3", "8.4", "9.1"] },
    { "id": 6, "tasks": ["9.2", "9.3", "10.1"] },
    { "id": 7, "tasks": ["12.1", "13.1", "14.1", "15.1"] },
    { "id": 8, "tasks": ["12.2", "13.2", "16.1", "16.2", "16.3"] }
  ]
}
```
