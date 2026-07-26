# Implementation Plan: Paper Trading System

## Overview

This implementation plan builds the Paper Trading System as an enhancement to the existing backend services, a new Python trade monitor and performance calculator in the quant engine, and a dedicated `/paper-trading` frontend dashboard. The approach: extend the Prisma schema and NestJS service first, then build the Python monitoring/metrics layer, then wire up the frontend. TypeScript is used for backend API (NestJS) and frontend (Next.js), Python for quant engine modules.

## Tasks

- [ ] 1. Extend Prisma schema and NestJS data layer
  - [ ] 1.1 Create Prisma migration for extended PaperTrade model
    - Add `PaperTradeStatus` enum (OPEN, TARGET_HIT, STOP_HIT, MANUAL_EXIT, EXPIRED, CANCELLED)
    - Add `PaperTradeType` enum (SWING, INTRADAY, OPTIONS_SCALPING)
    - Extend `PaperTrade` model with: tradeType, currentPrice, unrealizedPnL, exitPrice, realizedPnL, exitedAt, decisionId, agentId, aiContext (Json), probability, riskRewardRatio, strikePrice, optionType, expiryDate, underlying, simulatedSlippage
    - Add indexes on [userId, status], [userId, tradeType], [symbol], [status]
    - Run `prisma migrate dev` to generate and apply migration
    - _Requirements: 1.3, 2.1, 2.2, 2.3, 2.4, 3.1, 3.4_

  - [ ] 1.2 Create DTOs and validation for PaperTradingController
    - Create `apps/api/src/trading/dto/create-paper-trade.dto.ts` with class-validator decorators
    - Create `apps/api/src/trading/dto/close-paper-trade.dto.ts` with exitPrice and exitReason
    - Create `apps/api/src/trading/dto/paper-trade-filters.dto.ts` with status, tradeType, page, pageSize
    - Validate OPTIONS_SCALPING requires strikePrice, optionType, expiryDate, underlying
    - _Requirements: 1.3, 2.4, 10.1, 10.3, 10.6_

- [ ] 2. Implement PaperTradingService enhancements
  - [ ] 2.1 Implement createPaperTrade method
    - Extend `apps/api/src/trading/paper-trading.service.ts`
    - Accept CreatePaperTradeDto, persist to DB with status=OPEN
    - Store AI context fields (prompt, response, indicators, trendlineAnalysis, marketDataSnapshot) as JSON in aiContext field
    - Assign tradeType based on source (SWING, INTRADAY, OPTIONS_SCALPING)
    - Return full PaperTrade response
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.4, 3.1, 3.4_

  - [ ] 2.2 Implement closePaperTrade and cancelPaperTrade methods
    - `closePaperTrade(tradeId, dto)`: validate trade is OPEN, set exitPrice, realizedPnL, exitedAt, new status
    - Calculate realizedPnL: (exitPrice - entryPrice) × quantity for LONG, (entryPrice - exitPrice) × quantity for SHORT
    - `cancelPaperTrade(tradeId)`: validate trade is OPEN, set status=CANCELLED, no exit price
    - Return 409 Conflict if trade is not in OPEN status
    - Return 404 if trade not found
    - _Requirements: 3.3, 5.1, 5.2, 5.3, 10.4, 10.5, 10.7_

  - [ ] 2.3 Implement getTradesForUser and getOpenTrades methods
    - `getTradesForUser(userId, filters)`: paginated query with optional status[] and tradeType filters
    - Default page size 20, return total count for pagination metadata
    - `getOpenTrades(userId)`: query trades where status=OPEN
    - `updateTradePrice(tradeId, currentPrice)`: update currentPrice and calculate unrealizedPnL
    - _Requirements: 4.4, 10.1, 10.6_

  - [ ]* 2.4 Write property test for trade creation round-trip (fast-check)
    - **Property 1: Trade creation round-trip preserves all fields**
    - **Validates: Requirements 1.1, 1.2, 1.3, 2.4, 3.1, 3.4**

  - [ ]* 2.5 Write property test for terminal state immutability (fast-check)
    - **Property 4: Terminal state immutability**
    - **Validates: Requirements 5.3**

  - [ ]* 2.6 Write property test for trade type filtering (fast-check)
    - **Property 11: Trade type filtering correctness**
    - **Validates: Requirements 2.5, 6.8, 9.3**

  - [ ]* 2.7 Write property test for pagination completeness (fast-check)
    - **Property 12: Pagination completeness and correctness**
    - **Validates: Requirements 10.6**

  - [ ]* 2.8 Write unit tests for PaperTradingService
    - Test create trade for each trade type (SWING, INTRADAY, OPTIONS_SCALPING)
    - Test close trade records exit data correctly
    - Test cancel trade sets CANCELLED without exit price
    - Test close/cancel on non-OPEN trade returns 409
    - Test non-existent trade ID returns 404
    - Test OPTIONS_SCALPING without options fields returns 400
    - _Requirements: 1.4, 1.5, 2.1, 2.2, 2.3, 5.1, 5.2, 5.3_

- [ ] 3. Implement PaperTradingController REST endpoints
  - [ ] 3.1 Create PaperTradingController with all REST endpoints
    - Create/extend `apps/api/src/trading/paper-trading.controller.ts`
    - POST `/api/paper-trades` — create paper trade
    - GET `/api/paper-trades` — list trades with pagination, status/type filters
    - PATCH `/api/paper-trades/:id` — update current price (for trade monitor)
    - PATCH `/api/paper-trades/:id/close` — close trade (manual or monitor-triggered)
    - PATCH `/api/paper-trades/:id/cancel` — cancel an open trade
    - GET `/api/paper-trades/metrics` — proxy to quant engine performance calculator
    - Wire DTOs with validation pipes
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [ ]* 3.2 Write integration tests for API endpoints
    - Test POST creates trade and returns 201
    - Test GET with filters returns correct subset
    - Test PATCH close returns updated trade with exitPrice
    - Test PATCH cancel returns CANCELLED status
    - Test 404 for non-existent trade
    - Test 409 for closing already-closed trade
    - Test pagination returns correct page metadata
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [ ] 4. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement Trade Monitor in Quant Engine
  - [ ] 5.1 Create trade monitor module structure and data models
    - Create `apps/quant/paper_trading/__init__.py`
    - Create `apps/quant/paper_trading/models.py` with dataclasses: PaperTradeData, TradeAction, MonitorCycleResult, ClosedTradeData
    - Create `apps/quant/paper_trading/exceptions.py` with custom exceptions
    - Follow existing patterns from `apps/quant/scalper/` module
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ] 5.2 Implement TradeMonitor background service
    - Create `apps/quant/paper_trading/trade_monitor.py`
    - Implement `async def start()` — start background loop at configurable interval (default 30s)
    - Implement `async def stop()` — graceful shutdown
    - Implement `async def check_trades()` — fetch open trades from NestJS API, get current prices, evaluate each trade
    - Implement `async def evaluate_trade(trade, current_price)` — determine action based on price vs target/stop-loss/expiry
    - For LONG: target hit when price >= target, stop hit when price <= stop_loss
    - For SHORT: target hit when price <= target, stop hit when price >= stop_loss
    - For OPTIONS_SCALPING: check expiry date
    - Call PATCH endpoints on NestJS API to update/close trades
    - Handle API errors gracefully: log and continue with remaining trades
    - Handle market data unavailability: skip trade, log warning
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 5.3 Write property test for trade evaluation logic (Hypothesis)
    - **Property 2: Trade evaluation determines correct status transition**
    - **Validates: Requirements 4.2, 4.3, 4.5**

  - [ ]* 5.4 Write property test for unrealized P&L calculation (Hypothesis)
    - **Property 3: Unrealized P&L calculation correctness**
    - **Validates: Requirements 4.4**

  - [ ]* 5.5 Write unit tests for TradeMonitor
    - Test LONG trade target hit when price >= target
    - Test LONG trade stop hit when price <= stop_loss
    - Test SHORT trade target hit when price <= target
    - Test SHORT trade stop hit when price >= stop_loss
    - Test OPTIONS_SCALPING expired when past expiry date
    - Test trade remains OPEN when no conditions met
    - Test API error handling (skip and continue)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 6. Implement Performance Calculator in Quant Engine
  - [ ] 6.1 Implement PerformanceCalculator class
    - Create `apps/quant/paper_trading/performance_calculator.py`
    - Implement `calculate_metrics(closed_trades, trade_type=None)` — compute all metrics
    - Implement `calculate_win_rate(trades)` — winning_trades / total_trades × 100
    - Implement `calculate_profit_factor(trades)` — sum(profits) / abs(sum(losses))
    - Implement `calculate_expectancy(trades)` — total_pnl / total_trades
    - Implement `calculate_average_r(trades)` — mean(realized_pnl / initial_risk) per trade
    - Implement `calculate_max_drawdown(trades)` — largest peak-to-trough in cumulative P&L
    - Handle edge cases: zero trades returns all zeros, no losses returns Infinity for profit factor, zero initial risk skips trade in Average R
    - Support optional trade_type filter
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [ ]* 6.2 Write property test for Win Rate (Hypothesis)
    - **Property 5: Win Rate calculation**
    - **Validates: Requirements 6.1**

  - [ ]* 6.3 Write property test for Profit Factor (Hypothesis)
    - **Property 6: Profit Factor calculation**
    - **Validates: Requirements 6.2**

  - [ ]* 6.4 Write property test for Total P&L (Hypothesis)
    - **Property 7: Total P&L calculation**
    - **Validates: Requirements 6.3**

  - [ ]* 6.5 Write property test for Expectancy (Hypothesis)
    - **Property 8: Expectancy calculation**
    - **Validates: Requirements 6.4**

  - [ ]* 6.6 Write property test for Average R (Hypothesis)
    - **Property 9: Average R calculation**
    - **Validates: Requirements 6.5**

  - [ ]* 6.7 Write property test for Max Drawdown (Hypothesis)
    - **Property 10: Max Drawdown calculation**
    - **Validates: Requirements 6.6**

  - [ ]* 6.8 Write unit tests for PerformanceCalculator
    - Test win rate with known trades (3 wins, 2 losses → 60%)
    - Test profit factor with known values
    - Test zero trades returns all zeros
    - Test profit factor with no losses returns Infinity
    - Test max drawdown with a known sequence
    - Test filtering by trade type
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [ ] 7. Implement Paper Trading FastAPI Router
  - [ ] 7.1 Create FastAPI router with metrics and monitor status endpoints
    - Create `apps/quant/paper_trading/router.py`
    - GET `/api/paper-trading/metrics` — accept user_id and optional trade_type query params, fetch closed trades from NestJS API, calculate and return PerformanceMetrics
    - GET `/api/paper-trading/monitor/status` — return trade monitor running status, last cycle result
    - Register router in main FastAPI app entry point
    - _Requirements: 6.1, 6.8, 10.2_

  - [ ] 7.2 Integrate TradeMonitor startup with FastAPI lifespan
    - Register TradeMonitor start in FastAPI lifespan startup event
    - Register TradeMonitor stop in FastAPI lifespan shutdown event
    - Configure API base URL and polling interval from environment
    - _Requirements: 4.1_

  - [ ]* 7.3 Write integration tests for quant paper-trading endpoints
    - Test GET /metrics returns correct structure with all fields
    - Test GET /metrics with trade_type filter
    - Test GET /monitor/status returns running state
    - Test zero trades returns zero metrics
    - _Requirements: 6.1, 6.7, 6.8_

- [ ] 8. Checkpoint - Ensure all backend and quant engine tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement Paper Trading Dashboard - Page layout and data fetching
  - [ ] 9.1 Create Paper Trading page with layout and types
    - Create `apps/web/app/paper-trading/page.tsx` with Next.js App Router page component
    - Create `apps/web/components/paper-trading/types.ts` with TypeScript interfaces: PaperTrade, PerformanceMetrics, TradeType, TradeStatus, PaginatedTradesResponse
    - Set up page layout with three panels: Open Trades, Closed Trades, Performance Metrics
    - Implement TradeTypeFilter component (All, Swing, Intraday, Options Scalping)
    - _Requirements: 7.1, 8.1, 9.1, 9.3_

  - [ ] 9.2 Create data fetching hooks for paper trades
    - Create `apps/web/components/paper-trading/use-paper-trades.ts` custom hook
    - Fetch open trades from GET `/api/paper-trades?status=OPEN`
    - Fetch closed trades from GET `/api/paper-trades?status=TARGET_HIT,STOP_HIT,MANUAL_EXIT,EXPIRED,CANCELLED`
    - Fetch metrics from GET `/api/paper-trades/metrics` (proxied to quant)
    - Auto-refresh open trades at 30s interval
    - Support trade type filter parameter
    - Support pagination for closed trades
    - _Requirements: 7.3, 9.4, 10.1, 10.6_

- [ ] 10. Implement Paper Trading Dashboard - UI Components
  - [ ] 10.1 Create OpenTradesTable component
    - Create `apps/web/components/paper-trading/open-trades-table.tsx`
    - Display columns: symbol, trade type, direction, entry price, current price, stop loss, target, unrealized P&L, time since entry
    - Color-code unrealized P&L (green positive, red negative)
    - Add "Close" action button per row (calls PATCH close endpoint with current price as exit)
    - Add "Cancel" action button per row (calls PATCH cancel endpoint)
    - Show confirmation dialog before close/cancel actions
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ] 10.2 Create ClosedTradesTable component
    - Create `apps/web/components/paper-trading/closed-trades-table.tsx`
    - Display columns: symbol, trade type, direction, entry price, exit price, realized P&L, R-multiple, exit reason, duration
    - Support sorting by date, P&L, R-multiple
    - Implement expandable row to show full AI context (prompt, response, indicators, trendline analysis)
    - Color-code realized P&L and R-multiple
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ] 10.3 Create PerformanceMetricsPanel component
    - Create `apps/web/components/paper-trading/performance-metrics-panel.tsx`
    - Display summary cards: Win Rate, Profit Factor, Total P&L, Expectancy, Average R, Maximum Drawdown
    - Color-code metrics: green for positive, red for negative
    - Format values appropriately (percentages, ratios, currency)
    - Show "No closed trades" state when metrics are all zero
    - _Requirements: 9.1, 9.2_

  - [ ]* 10.4 Write unit tests for frontend components
    - Test OpenTradesTable renders all columns correctly
    - Test ClosedTradesTable sorting functionality
    - Test ClosedTradesTable expandable AI context row
    - Test PerformanceMetricsPanel color coding
    - Test TradeTypeFilter selection updates state
    - Test Close/Cancel button handlers
    - _Requirements: 7.2, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3_

- [ ] 11. Wire dashboard components and integrate with API
  - [ ] 11.1 Wire all components together on the page
    - Connect TradeTypeFilter to data fetching hooks
    - Connect OpenTradesTable close/cancel actions to API calls
    - Connect ClosedTradesTable pagination to data fetching
    - Ensure filter changes recalculate metrics within 2 seconds
    - Handle loading states and error states for all panels
    - Display appropriate empty states when no trades exist
    - _Requirements: 9.3, 9.4, 7.1, 8.1, 9.1_

  - [ ]* 11.2 Write integration tests for dashboard
    - Test full page renders with mocked API data
    - Test trade type filter updates all panels
    - Test close action calls API and refreshes table
    - Test cancel action calls API and refreshes table
    - Test pagination navigation
    - _Requirements: 7.1, 8.1, 9.1, 9.3, 9.4_

- [ ] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after backend (task 4), quant engine (task 8), and frontend (task 12)
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Backend follows existing NestJS patterns in `apps/api/src/trading/`
- Quant engine follows existing patterns from `apps/quant/scalper/` (dataclasses, FastAPI routers, async operations)
- Frontend follows Next.js App Router conventions at `apps/web/app/paper-trading/`
- TypeScript fast-check used for backend property tests, Python Hypothesis for quant engine property tests

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "5.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "5.2"] },
    { "id": 4, "tasks": ["2.4", "2.5", "2.6", "2.7", "2.8", "5.3", "5.4", "5.5", "6.1"] },
    { "id": 5, "tasks": ["3.1", "6.2", "6.3", "6.4", "6.5", "6.6", "6.7", "6.8"] },
    { "id": 6, "tasks": ["3.2", "7.1", "7.2"] },
    { "id": 7, "tasks": ["7.3"] },
    { "id": 8, "tasks": ["9.1"] },
    { "id": 9, "tasks": ["9.2", "10.1", "10.2", "10.3"] },
    { "id": 10, "tasks": ["10.4", "11.1"] },
    { "id": 11, "tasks": ["11.2"] }
  ]
}
```
