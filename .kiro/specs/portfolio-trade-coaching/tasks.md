# Implementation Plan: Portfolio Trade Coaching

## Overview

This implementation plan extends the existing AI Trade Coach to analyze real Kotak Neo brokerage data. The approach: build the Portfolio Fetcher and Trade Normalizer as pure Python modules first, then add the Data Source Selector orchestration layer, extend the FastAPI router with new parameters, and finally wire the frontend Data Source Toggle. Python is used for all quant engine components (FastAPI on port 8000), TypeScript for the NestJS BFF (port 4000) and Next.js frontend.

## Tasks

- [x] 1. Implement Portfolio Fetcher
  - [x] 1.1 Create Portfolio Fetcher module with HTTP client
    - Create `apps/quant/trade_coach/portfolio_fetcher.py`
    - Implement `PortfolioFetcher` class with `bff_base_url` configuration (default `http://localhost:4000/api/kotak-neo`)
    - Implement `async fetch_positions(session_id: str) -> dict` — GET `/reports/positions` with `X-Session-Id` header
    - Implement `async fetch_holdings(session_id: str) -> dict` — GET `/reports/holdings` with `X-Session-Id` header
    - Implement `async fetch_trades(session_id: str) -> dict` — GET `/reports/trades` with `X-Session-Id` header
    - Implement `async validate_session(session_id: str) -> bool` — GET `/status` with `X-Session-Id` header
    - Use `httpx.AsyncClient` with 10s timeout
    - Raise descriptive errors for missing/invalid session_id, 401/403 responses, 5xx errors, and connection failures
    - Implement single retry on connection errors before failing
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 5.1, 5.3, 5.4_

  - [ ]* 1.2 Write unit tests for Portfolio Fetcher
    - Mock httpx calls to BFF endpoints
    - Test correct URL construction and X-Session-Id header passing
    - Test missing session_id raises clear error
    - Test 401/403 response returns session expired error
    - Test 5xx response propagates with HTTP status code
    - Test connection refused triggers retry then fails with descriptive message
    - Test 10s timeout handling
    - Test successful responses return parsed JSON
    - _Requirements: 1.4, 1.5, 1.6, 5.1, 5.4_

- [x] 2. Implement Trade Normalizer
  - [x] 2.1 Create Trade Normalizer module with mapping logic
    - Create `apps/quant/trade_coach/trade_normalizer.py`
    - Implement `TradeNormalizer` class with three pure methods
    - Implement `normalize_positions(raw_positions: list[dict]) -> list[TradeRecord]`:
      - Map `trdSym` → strip `-EQ` suffix → `symbol`
      - Compute `entry_price` = `buyAmt` / `qty`
      - Map `qty` → int, `prod` → infer direction
      - Set `trade_source = "live"`, generate UUID with `"live-"` prefix
    - Implement `normalize_holdings(raw_holdings: list[dict]) -> list[TradeRecord]`:
      - Map `displaySymbol` → `symbol`
      - Map `averagePrice` → `entry_price`, `mktValue` / `quantity` → current price
      - Map `unrealisedGainLoss` → `realized_pnl`
      - Set `trade_source = "live"`
    - Implement `normalize_trades(raw_trades: list[dict]) -> list[TradeRecord]`:
      - Map `trdSym` → strip `-EQ` suffix → `symbol`
      - Map `trnsTp` "B" → LONG, "S" → SHORT
      - Map `qty` → int, `prc` → float (preserve precision)
      - Parse `flDtTm` as "YYYY-MM-DD HH:MM:SS" → `entry_date`
      - Set `trade_source = "live"`
    - Skip records with missing required fields, log warning with record identifier
    - Preserve all numeric precision (no rounding)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 2.2 Write property test: Normalization completeness
    - **Property 1: Normalization completeness**
    - Generate random valid Kotak position/holding/trade JSON objects using Hypothesis strategies
    - Verify every output TradeRecord has: non-empty symbol, valid direction, quantity > 0, non-negative price, trade_source == "live"
    - Use `@settings(max_examples=100)`
    - **Validates: Requirements 2.1, 2.2, 2.3**

  - [ ]* 2.3 Write property test: Numeric precision preservation
    - **Property 2: Numeric precision preservation**
    - Generate random decimal strings with varying precision (up to 10 decimal places)
    - Verify normalized TradeRecord numeric values exactly equal parsed float values from source
    - Use `@settings(max_examples=100)`
    - **Validates: Requirements 2.4**

  - [ ]* 2.4 Write property test: Invalid record exclusion
    - **Property 3: Invalid record exclusion**
    - Generate Kotak API responses with randomly removed required fields
    - Verify output count equals input count minus invalid record count
    - Use `@settings(max_examples=100)`
    - **Validates: Requirements 2.5**

  - [ ]* 2.5 Write property test: Normalization round-trip consistency
    - **Property 4: Normalization round-trip consistency**
    - Generate valid Kotak records, normalize → serialize to dict → normalize again
    - Verify second normalization produces TradeRecord objects equivalent to first
    - Use `@settings(max_examples=100)`
    - **Validates: Requirements 2.6**

  - [ ]* 2.6 Write unit tests for Trade Normalizer
    - Test position normalization with known Kotak response format
    - Test holding normalization with known Kotak response format
    - Test trade book normalization with known Kotak response format
    - Test `-EQ` suffix stripping from symbols
    - Test direction mapping: "B" → LONG, "S" → SHORT
    - Test missing field skipping with warning log
    - Test empty input list returns empty output
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. Implement Data Source Selector
  - [x] 3.1 Create Data Source Selector module
    - Create `apps/quant/trade_coach/data_source_selector.py`
    - Implement `DataSourceSelector` class with dependencies: `TradeRepository`, `PortfolioFetcher`, `TradeNormalizer`
    - Implement `async get_trades(user_id, source, session_id=None) -> DataSourceResult`:
      - "paper" mode: fetch from TradeRepository only
      - "live" mode: fetch from PortfolioFetcher, normalize with TradeNormalizer
      - "combined" mode: fetch from both, merge into single list
    - Implement `resolve_default_source(session_id, has_paper_trades) -> str`:
      - Return "combined" when session_id is valid AND paper trades exist
      - Return "paper" otherwise
    - Create `DataSourceResult` dataclass with: trades, source, live_fetch_errors, partial flag
    - Handle session expiry mid-fetch: set `partial=True`, include errors in `live_fetch_errors`, return whatever was successfully fetched
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.4_

  - [ ]* 3.2 Write property test: Source filtering correctness
    - **Property 5: Source filtering correctness**
    - Generate random paper trade lists and live trade lists with random source mode
    - Verify "paper" returns only paper trades, "live" returns only live trades, "combined" returns union
    - Verify response `data_source` metadata matches requested mode
    - Use `@settings(max_examples=100)`
    - **Validates: Requirements 3.2, 3.3, 3.4, 4.4**

  - [ ]* 3.3 Write property test: Default source resolution
    - **Property 6: Default source resolution**
    - Generate random boolean pairs (session_active, has_paper_trades)
    - Verify "combined" returned only when both are True, "paper" otherwise
    - Use `@settings(max_examples=100)`
    - **Validates: Requirements 3.5, 3.6**

  - [ ]* 3.4 Write unit tests for Data Source Selector
    - Test "paper" mode returns only TradeRepository data
    - Test "live" mode calls PortfolioFetcher and normalizes results
    - Test "combined" mode merges both sources
    - Test session expiry mid-fetch returns partial results
    - Test default source resolution logic
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 4. Checkpoint - Ensure all core module tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Extend Trade Coach Router with new parameters
  - [x] 5.1 Update CoachRequest model and router endpoints
    - Extend `apps/quant/trade_coach/router.py`
    - Add `data_source: str = Field(default="paper")` and `session_id: Optional[str] = Field(default=None)` to `CoachRequest`
    - Update `/analyze` endpoint: validate session_id required when data_source is "live" or "combined", return HTTP 400 if missing
    - Update `/behaviors` endpoint: add `data_source` and `session_id` query params with same validation
    - Update `/compare` endpoint: include live portfolio metrics when valid session_id provided
    - Wire `DataSourceSelector` into the analysis flow — replace direct TradeRepository usage with selector results
    - Add `data_source`, `live_trade_count`, `paper_trade_count` to `CoachResponse`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 5.2 Write property test: API parameter validation
    - **Property 8: API parameter validation**
    - Generate random combinations of data_source values and session_id (present/absent/empty)
    - Verify HTTP 400 when data_source is "live" or "combined" and session_id is missing
    - Verify validation passes when data_source is "paper" or session_id is provided
    - Use `@settings(max_examples=100)`
    - **Validates: Requirements 7.1, 7.2, 7.3**

  - [ ]* 5.3 Write unit tests for extended router endpoints
    - Test /analyze with data_source="paper" uses existing behavior
    - Test /analyze with data_source="live" without session_id returns 400
    - Test /analyze with data_source="live" with valid session_id fetches live data
    - Test /behaviors with data_source and session_id params
    - Test /compare includes live metrics when session provided
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 6. Implement Extended Coaching Analysis for Live Data
  - [x] 6.1 Add slippage calculation and live-specific analysis
    - Extend the existing behavior detection in `apps/quant/trade_coach/`
    - Implement slippage calculation: `(executed_price - intended_price)` for buys, `(intended_price - executed_price)` for sells
    - Add partial fill pattern detection to behavior detector
    - When combined mode: compare paper vs live metrics, highlight divergences in report
    - When live trades < 5: add recommendation "More trading history needed for meaningful analysis"
    - Include `slippage_summary` in CoachResponse
    - _Requirements: 4.1, 4.2, 4.3, 4.5_

  - [ ]* 6.2 Write property test: Slippage calculation correctness
    - **Property 7: Slippage calculation correctness**
    - Generate random price pairs (executed, intended) and direction (buy/sell)
    - Verify slippage = (executed - intended) for buys, (intended - executed) for sells
    - Verify positive slippage means unfavorable execution, negative means favorable
    - Use `@settings(max_examples=100)`
    - **Validates: Requirements 4.1**

  - [ ]* 6.3 Write unit tests for live-specific analysis
    - Test slippage calculation with known price pairs
    - Test partial fill detection with example trade data
    - Test paper vs live divergence comparison
    - Test insufficient data recommendation (exactly 4 trades vs 5 trades)
    - _Requirements: 4.1, 4.2, 4.3, 4.5_

- [x] 7. Checkpoint - Ensure all quant engine tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement Frontend Data Source Toggle
  - [x] 8.1 Create Data Source Toggle component
    - Create `apps/web/components/trade-coach/data-source-toggle.tsx`
    - Implement toggle with three options: "Paper Trades", "Live Portfolio", "Combined"
    - Accept `kotakSessionActive: boolean` prop
    - When `kotakSessionActive` is false: disable "Live Portfolio" and "Combined" options, show tooltip "Log in to Kotak Neo to analyze live trades"
    - Emit selected source mode via `onSourceChange` callback
    - Style consistently with existing Trade Coach page components
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 8.2 Integrate toggle into Trade Coach page
    - Update `apps/web/app/trade-coach/page.tsx`
    - Add DataSourceToggle to the page layout
    - Detect Kotak session status (check for existing session_id in local state or via BFF status call)
    - Pass selected `data_source` and `session_id` to coaching analysis API requests
    - Display `data_source` label in coaching report header
    - Handle session error responses: show login prompt linking to existing Kotak login dialog
    - Handle partial results: show warning banner "Some live data could not be fetched"
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 8.3 Write unit tests for frontend components
    - Test DataSourceToggle renders three options
    - Test disabled state when no Kotak session
    - Test tooltip appears on disabled options
    - Test source selection triggers callback
    - Test session error displays login prompt
    - Test data source label appears in report header
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after core modules (task 4), quant engine (task 7), and frontend (task 9)
- Property tests validate the 8 correctness properties from the design document using Python Hypothesis
- Unit tests validate specific examples and edge cases
- Quant engine follows existing patterns in `apps/quant/trade_coach/` (async, dataclasses, FastAPI routers)
- Frontend follows Next.js App Router conventions at `apps/web/app/trade-coach/`
- All BFF calls are mocked in tests — no live broker calls in CI
- Test file location: `apps/quant/tests/test_trade_normalizer_properties.py` for property tests

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "2.2", "2.3", "2.4", "2.5", "2.6"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4"] },
    { "id": 4, "tasks": ["5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3", "6.1"] },
    { "id": 6, "tasks": ["6.2", "6.3"] },
    { "id": 7, "tasks": ["8.1"] },
    { "id": 8, "tasks": ["8.2"] },
    { "id": 9, "tasks": ["8.3"] }
  ]
}
```
