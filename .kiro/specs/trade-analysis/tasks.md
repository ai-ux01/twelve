# Implementation Plan: Trade Analysis Engine

## Overview

This implementation plan builds the Trade Analysis Engine as a new Python module at `apps/quant/trade_analysis/` with a frontend page at `apps/web/app/trade-analysis/page.tsx`. The approach: define data models and exceptions first, build core pipeline components (CSV importer → trade matcher → enricher → calculator → grouping engine), then add AI analysis, wire up API endpoints, add persistence, and finally build the frontend. Python (FastAPI + Hypothesis) is used throughout the backend; TypeScript/React for the frontend.

## Tasks

- [ ] 1. Set up module structure, data models, and exceptions
  - [ ] 1.1 Create trade_analysis module with models and enums
    - Create `apps/quant/trade_analysis/__init__.py`
    - Create `apps/quant/trade_analysis/models.py` with all Pydantic models and dataclasses: TradeDirection, MarketRegime, TimeBucket, HoldingPeriodBucket, TradeRecord, UnmatchedEntry, PerformanceMetrics, GroupedMetrics, CSVParseResult, CSVRowError, TradeMatchResult
    - Create API request/response models: ManualTradeRequest, CSVImportResponse, MetricsResponse, GroupedMetricsResponse, AIAnalyzeRequest, AIAnalysisResponse, ErrorResponse, FieldError
    - _Requirements: 2.1, 5.1, 6.1, 9.1, 9.6_

  - [ ] 1.2 Create exceptions module
    - Create `apps/quant/trade_analysis/exceptions.py`
    - Define custom exceptions: CSVParseError, ValidationError, EnrichmentError, GroupingDimensionError, AIAnalysisError
    - _Requirements: 1.2, 9.6_

- [ ] 2. Implement CSV Importer and Trade Matcher
  - [ ] 2.1 Implement CSV parsing logic
    - Create `apps/quant/trade_analysis/csv_importer.py`
    - Implement `parse_csv(file_content: str) -> CSVParseResult` to parse CSV rows with columns: date, symbol, action (BUY/SELL), quantity, price, and optional columns (strategy, setup, sector)
    - Support date formats: ISO 8601, DD/MM/YYYY, MM/DD/YYYY
    - Return per-row validation errors with row number and field name for malformed or missing required fields
    - _Requirements: 1.1, 1.2, 1.5_

  - [ ] 2.2 Implement trade matching logic
    - Implement `match_trades(actions: List[TradeAction]) -> TradeMatchResult` in csv_importer.py
    - Use FIFO matching: earliest BUY matched with earliest SELL for same symbol
    - Construct TradeRecord with entry_price, exit_price, quantity, and realized_pnl
    - Flag unmatched entries (open trades with no corresponding exit) separately with descriptive reason
    - _Requirements: 1.3, 1.4_

  - [ ]* 2.3 Write property test for CSV parsing preserves valid row data
    - **Property 1: CSV parsing preserves valid row data**
    - **Validates: Requirements 1.1, 1.5**

  - [ ]* 2.4 Write property test for invalid CSV rows produce descriptive errors
    - **Property 2: Invalid CSV rows produce descriptive errors**
    - **Validates: Requirements 1.2**

  - [ ]* 2.5 Write property test for trade matching correctness
    - **Property 3: Trade matching correctness**
    - **Validates: Requirements 1.3, 1.4**

  - [ ]* 2.6 Write unit tests for CSV importer
    - Test parsing valid CSV with all supported date formats
    - Test malformed row returns error with correct row number and field
    - Test FIFO matching produces correct P&L
    - Test CSV with only unmatched entries returns empty trade list
    - Test date format disambiguation edge cases
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 3. Implement Trade Enricher
  - [ ] 3.1 Implement trade enrichment pipeline
    - Create `apps/quant/trade_analysis/trade_enricher.py`
    - Implement `async enrich(trade: TradeRecord) -> EnrichedTradeRecord` that fetches historical OHLCV data and computes enrichment fields
    - Implement `calculate_mfe(ohlcv, entry_price, direction)` — max favorable excursion during holding period
    - Implement `calculate_mae(ohlcv, entry_price, direction)` — max adverse excursion during holding period
    - Implement `calculate_rsi(ohlcv, period=14)` — RSI at entry date
    - Implement `calculate_adx(ohlcv, period=14)` — ADX at entry date
    - Implement `calculate_relative_volume(ohlcv)` — current day volume / 20-day average volume
    - Implement `classify_market_regime(adx, atr, avg_price)` — trending/ranging/volatile classification
    - Implement `calculate_risk_reward_ratio(entry_price, exit_price, stop_loss, direction)` — risk/reward for trades with stop loss
    - Compute holding_period_days as calendar days between entry and exit
    - Handle graceful degradation: if historical data unavailable, store trade with null enrichment fields
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_

  - [ ]* 3.2 Write property test for holding period calculation
    - **Property 5: Holding period calculation**
    - **Validates: Requirements 4.1**

  - [ ]* 3.3 Write property test for MFE and MAE excursion correctness
    - **Property 6: MFE and MAE excursion correctness**
    - **Validates: Requirements 4.2, 4.3**

  - [ ]* 3.4 Write property test for market regime classification
    - **Property 7: Market regime classification**
    - **Validates: Requirements 4.8**

  - [ ]* 3.5 Write property test for risk/reward ratio formula
    - **Property 8: Risk/reward ratio formula**
    - **Validates: Requirements 4.9**

  - [ ]* 3.6 Write property test for relative volume calculation
    - **Property 13: Relative volume calculation**
    - **Validates: Requirements 4.6**

  - [ ]* 3.7 Write unit tests for trade enricher
    - Test MFE calculation for LONG and SHORT trades with known OHLCV data
    - Test MAE calculation for LONG and SHORT trades
    - Test market regime returns 'trending' when ADX > 25
    - Test market regime returns 'ranging' when ADX < 20
    - Test market regime returns 'volatile' when ATR/price > 0.025
    - Test risk/reward ratio with known values
    - Test enrichment returns null fields when historical data unavailable
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_

- [ ] 4. Implement Performance Calculator
  - [ ] 4.1 Implement performance metrics calculation
    - Create `apps/quant/trade_analysis/performance_calculator.py`
    - Implement `TradePerformanceCalculator` class following Phase 11 PerformanceCalculator pattern
    - Implement `calculate_metrics(trades) -> PerformanceMetrics` — compute all aggregate metrics
    - Implement `calculate_win_rate(trades)` — (winning trades / total trades) × 100
    - Implement `calculate_profit_factor(trades)` — sum(profits) / |sum(losses)|, return inf if no losses
    - Implement `calculate_expectancy(trades)` — total P&L / total trades
    - Implement `calculate_max_drawdown(trades)` — largest peak-to-trough in cumulative P&L ordered by exit_date
    - Implement `calculate_average_r(trades)` — mean(realized_pnl / initial_risk) for trades with stop_loss
    - Implement `calculate_mfe_mae_stats(trades)` — mean, median, max of MFE and MAE values
    - Handle edge cases: zero trades returns zero metrics, no losses returns positive infinity for profit_factor
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 4.2 Write property test for performance metrics formulas
    - **Property 9: Performance metrics formulas**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.5**

  - [ ]* 4.3 Write property test for maximum drawdown calculation
    - **Property 10: Maximum drawdown calculation**
    - **Validates: Requirements 5.4**

  - [ ]* 4.4 Write property test for MFE/MAE statistics
    - **Property 11: MFE/MAE statistics**
    - **Validates: Requirements 5.6**

  - [ ]* 4.5 Write unit tests for performance calculator
    - Test win rate with known trades (e.g., 3 wins / 5 total = 60%)
    - Test profit factor with known profits and losses
    - Test profit factor returns infinity when all trades profitable
    - Test expectancy with known total P&L
    - Test max drawdown with known cumulative P&L sequence
    - Test average R skips trades without stop_loss
    - Test MFE/MAE stats with known values
    - Test zero trades returns all-zero metrics
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [ ] 5. Implement Grouping Engine
  - [ ] 5.1 Implement dimension-based grouping
    - Create `apps/quant/trade_analysis/grouping_engine.py`
    - Implement `GroupingEngine` class with `group_and_calculate(trades, dimension) -> List[GroupedMetrics]`
    - Support dimensions: strategy, setup, market_regime, sector, time_of_day, holding_period, probability
    - Implement time_of_day bucketing: pre_market, morning, midday, afternoon, closing
    - Implement holding_period bucketing: intraday, 1-3 days, 4-7 days, 1-2 weeks, 2+ weeks
    - Implement probability bucketing: 0-25%, 25-50%, 50-75%, 75-100%
    - Omit groups with zero trades from results
    - Return 422 error for invalid dimension values
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [ ]* 5.2 Write property test for grouping engine partitioning invariant
    - **Property 12: Grouping engine partitioning invariant**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8**

  - [ ]* 5.3 Write unit tests for grouping engine
    - Test grouping by strategy produces correct per-group metrics
    - Test grouping by market_regime partitions correctly
    - Test time_of_day bucketing boundary cases (e.g., trade at exactly 9:15)
    - Test holding_period bucketing (0 days = intraday, 1 day = 1-3 days)
    - Test groups with no trades are omitted
    - Test invalid dimension returns error
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [ ] 6. Checkpoint - Ensure all backend core pipeline tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement AI Analyzer
  - [ ] 7.1 Implement AI-driven trade analysis
    - Create `apps/quant/trade_analysis/ai_analyzer.py`
    - Implement `AIAnalyzer` class reusing Phase 10 AI pipeline pattern (orchestrator + recommendation engine)
    - Implement `async analyze(prompt, user_id) -> AIAnalysisResponse`
    - Implement `_build_analysis_context(metrics, grouped)` — construct context string with factual trade statistics
    - Query stored trade statistics from database before generating response
    - Include factual metrics (win rate, profit factor, expectancy, max drawdown, average R) in AI context
    - Reference specific grouping breakdowns (by strategy, regime, time of day) to identify patterns
    - Identify weakest-performing dimensions and provide actionable suggestions
    - Return informative message when no trade data exists, suggesting import
    - Handle OpenAI API failure gracefully with fallback message
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ]* 7.2 Write unit tests for AI analyzer
    - Test analyze queries database before generating response
    - Test context builder includes all key metrics
    - Test empty database returns "no data" message suggesting trade import
    - Test OpenAI failure returns graceful fallback
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [ ] 8. Implement Repository and Database Layer
  - [ ] 8.1 Implement trade repository
    - Create `apps/quant/trade_analysis/repository.py`
    - Implement `TradeRepository` class with PostgreSQL JSONB storage pattern
    - Implement `persist_trades(user_id, trades: List[TradeRecord])` — store trades in database
    - Implement `get_trades(user_id) -> List[TradeRecord]` — retrieve all trades for user
    - Implement `update_enrichment(trade_id, enrichment_data)` — update enrichment fields
    - Create database table `trade_records` with columns: id (UUID), user_id, data (JSONB), symbol, direction, entry_date, exit_date, realized_pnl, created_at, updated_at
    - Add indexes on user_id, symbol, exit_date, data->>'strategy', data->>'market_regime'
    - _Requirements: 10.1, 10.2, 10.3_

  - [ ]* 8.2 Write unit tests for repository
    - Test persist and retrieve round-trip
    - Test update enrichment modifies correct fields
    - Test get_trades filters by user_id
    - _Requirements: 10.1, 10.2, 10.3_

- [ ] 9. Implement FastAPI Router and API Endpoints
  - [ ] 9.1 Create trade analysis router with all endpoints
    - Create `apps/quant/trade_analysis/router.py`
    - POST `/api/trade-analysis/import/csv` — accept CSV file upload, parse, match, enrich, persist, return trades + errors + unmatched
    - POST `/api/trade-analysis/trades` — accept manual trade entry, validate, create TradeRecord, enrich, persist
    - GET `/api/trade-analysis/metrics` — retrieve all trades for user, compute PerformanceMetrics
    - GET `/api/trade-analysis/metrics/grouped` — accept `dimension` query param, compute grouped metrics
    - POST `/api/trade-analysis/ai/analyze` — accept prompt, run AI analysis on stored data
    - Return 422 with structured field-level errors for invalid requests
    - Register router in main FastAPI app
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [ ] 9.2 Implement Kotak Neo placeholder endpoint
    - Add handler that returns "coming soon" message for Kotak Neo integration
    - Suggest CSV import as alternative
    - _Requirements: 3.1, 3.2_

  - [ ]* 9.3 Write property test for API validation error structure
    - **Property 14: API validation error structure**
    - **Validates: Requirements 9.6**

  - [ ]* 9.4 Write property test for manual trade entry preserves all fields
    - **Property 4: Manual trade entry preserves all fields**
    - **Validates: Requirements 2.1, 2.2, 2.3**

  - [ ]* 9.5 Write integration tests for API endpoints
    - Test CSV upload endpoint returns correct response structure with trades, errors, and unmatched
    - Test manual trade endpoint persists and returns created TradeRecord
    - Test metrics endpoint computes from stored trades for correct user
    - Test grouped metrics endpoint with each valid dimension
    - Test AI analyze endpoint queries database and returns analysis
    - Test invalid requests return 422 with field-level errors
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [ ] 10. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Implement Frontend Page and Components
  - [ ] 11.1 Create trade analysis page with layout and types
    - Create `apps/web/app/trade-analysis/page.tsx` with Next.js App Router page component
    - Create `apps/web/components/trade-analysis/types.ts` with TypeScript interfaces matching backend models: TradeRecord, PerformanceMetrics, GroupedMetrics, CSVImportResponse, AIAnalysisResponse
    - Set up page layout with sections: Import, Metrics, Grouped Breakdown, AI Analysis
    - _Requirements: 8.1_

  - [ ] 11.2 Create CSV upload and manual entry components
    - Create `apps/web/components/trade-analysis/csv-upload.tsx` with file upload component
    - Create `apps/web/components/trade-analysis/manual-trade-form.tsx` with form fields: symbol, entry date, entry price, exit date, exit price, quantity, direction, and optional fields (strategy, setup, sector, stop loss)
    - Display validation errors from API responses
    - Show import results: trades imported count, errors list, unmatched entries
    - _Requirements: 8.2, 8.3_

  - [ ] 11.3 Create performance metrics display component
    - Create `apps/web/components/trade-analysis/performance-metrics.tsx`
    - Display aggregate metrics: Win Rate, Profit Factor, Expectancy, Max Drawdown, Average R, MFE mean, MAE mean
    - Format values appropriately (percentages, ratios, currency)
    - Show empty state when no trades imported
    - _Requirements: 8.4_

  - [ ] 11.4 Create dimension selector and grouped metrics component
    - Create `apps/web/components/trade-analysis/dimension-selector.tsx` with dropdown for: strategy, setup, market_regime, sector, time_of_day, holding_period, probability
    - Create `apps/web/components/trade-analysis/grouped-metrics-table.tsx` displaying tabular layout with dimension value, trade count, win rate, profit factor, expectancy per group
    - _Requirements: 8.5, 8.6_

  - [ ] 11.5 Create AI analysis chat component
    - Create `apps/web/components/trade-analysis/ai-analysis.tsx`
    - Provide text input for submitting AI analysis prompts
    - Display AI responses with referenced statistics clearly formatted
    - Handle loading state and error states
    - _Requirements: 8.7, 8.8_

- [ ] 12. Wire frontend components and integrate with API
  - [ ] 12.1 Create data fetching hooks and wire components
    - Create `apps/web/components/trade-analysis/use-trade-analysis.ts` custom hook
    - Implement API calls: importCSV, createTrade, getMetrics, getGroupedMetrics, analyzeWithAI
    - Connect CSV upload component to POST `/api/trade-analysis/import/csv`
    - Connect manual entry form to POST `/api/trade-analysis/trades`
    - Connect metrics display to GET `/api/trade-analysis/metrics`
    - Connect dimension selector to GET `/api/trade-analysis/metrics/grouped`
    - Connect AI chat to POST `/api/trade-analysis/ai/analyze`
    - Handle loading, error, and empty states across all components
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

  - [ ]* 12.2 Write unit tests for frontend components
    - Test CSV upload component renders file input and handles upload
    - Test manual trade form validates required fields
    - Test performance metrics panel displays all metric values
    - Test dimension selector triggers grouped metrics fetch
    - Test AI analysis component submits prompt and displays response
    - Test empty states render correctly
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

- [ ] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after core pipeline (task 6), full backend (task 10), and frontend (task 13)
- Property tests validate universal correctness properties from the design document using Hypothesis
- Unit tests validate specific examples and edge cases using pytest
- Backend follows existing patterns from `apps/quant/` modules (dataclasses, FastAPI routers, async operations)
- Reuses Phase 11 PerformanceCalculator pattern for metrics computation
- Reuses Phase 10 AI pipeline pattern (orchestrator + recommendation engine) for AI analyzer
- Frontend follows Next.js App Router conventions at `apps/web/app/trade-analysis/`
- PostgreSQL JSONB storage pattern consistent with paper trading module

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["2.3", "2.4", "2.5", "2.6", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "4.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "4.4", "4.5", "5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3", "7.1", "8.1"] },
    { "id": 6, "tasks": ["7.2", "8.2", "9.1"] },
    { "id": 7, "tasks": ["9.2", "9.3", "9.4", "9.5"] },
    { "id": 8, "tasks": ["11.1"] },
    { "id": 9, "tasks": ["11.2", "11.3", "11.4", "11.5"] },
    { "id": 10, "tasks": ["12.1"] },
    { "id": 11, "tasks": ["12.2"] }
  ]
}
```
