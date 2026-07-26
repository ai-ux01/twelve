# Implementation Plan: Auto Trade Logging

## Overview

This implementation plan builds the Auto Trade Logging system as a new `trade_sync` module in the quant engine. The approach: create the data models and ledger persistence first, then implement the pure mapper functions, then build the orchestrating service, and finally wire it into the quant engine's main.py. Python is used throughout (matching the existing quant engine patterns).

## Tasks

- [x] 1. Create trade_sync module structure and data models
  - [x] 1.1 Create module directory and data models
    - Create `apps/quant/trade_sync/__init__.py`
    - Create `apps/quant/trade_sync/models.py` with dataclasses: `SyncCycleResult`, `SyncStatus`, `SyncedEntry`, `PendingEntry`, `MatchResult`
    - Define `SyncCycleResult` with fields: timestamp, paper_trades_synced, live_stock_trades_synced, live_options_trades_synced, errors, kotak_session_valid
    - Define `SyncStatus` with fields: running, last_sync_timestamp, last_cycle_result, total_synced_count, pending_count
    - Define `SyncedEntry` with fields: source, source_id, trade_analysis_id, sync_timestamp
    - Define `PendingEntry` with fields: source, source_id, symbol, direction, price, quantity, timestamp, strike_price, expiry, option_type
    - Define `MatchResult` with fields: matched_pairs, unmatched_orders
    - Follow existing dataclass patterns from `apps/quant/paper_trading/`
    - _Requirements: 5.3, 5.4, 4.5_

- [x] 2. Implement Sync Ledger with JSON persistence
  - [x] 2.1 Implement SyncLedger class
    - Create `apps/quant/trade_sync/ledger.py`
    - Implement `SyncLedger.__init__()` — instantiate `JsonFileStore("trade_sync_ledger")` for persistence at `data/trade_sync_ledger.json`
    - Implement `is_synced(source, source_id) -> bool` — check if a trade ID exists in the synced entries
    - Implement `mark_synced(source, source_id, trade_analysis_id) -> None` — add entry to synced dict with sync_timestamp
    - Implement `add_pending(entry: PendingEntry) -> None` — append to pending list
    - Implement `get_pending(source, symbol) -> List[PendingEntry]` — filter pending by source and symbol
    - Implement `remove_pending(source, source_id) -> None` — remove a pending entry after successful match
    - Implement `get_all_synced() -> List[SyncedEntry]` — return all synced entries
    - Implement `load()` — load state from JSON file, initialize empty on missing/corrupted file with warning log
    - Implement `save()` — persist current state to JSON file
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 1.4, 1.5, 2.6, 2.7, 3.6, 3.7_

  - [ ]* 2.2 Write property test for Sync Ledger persistence round-trip
    - **Property 8: Sync Ledger persistence round-trip**
    - Generate random ledger states with mixed synced entries and pending entries
    - Verify persist → reload produces equivalent state
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

  - [ ]* 2.3 Write unit tests for SyncLedger
    - Test `is_synced` returns False for new ID, True after `mark_synced`
    - Test `add_pending` and `get_pending` correctly store/retrieve entries
    - Test `remove_pending` removes the correct entry
    - Test corrupted JSON file initializes empty state with warning
    - Test missing JSON file initializes empty state with warning
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 3. Implement Trade Mapper with pure transformation functions
  - [x] 3.1 Implement TradeMapper class
    - Create `apps/quant/trade_sync/mapper.py`
    - Implement `map_paper_trade(paper_trade: dict) -> TradeRecord` — map paper trade fields to TradeRecord (symbol, direction, entry_price, exit_price, quantity, realized_pnl, entry_date, exit_date, strategy="paper_trade", setup=tradeType, created_at=entry_date, holding_period_days computed)
    - Implement `map_live_stock_trade(buy_order: dict, sell_order: dict) -> TradeRecord` — map paired stock orders to TradeRecord (strategy="live_stock", direction from order sequence, realized_pnl=(exit-entry)×qty×dir_sign)
    - Implement `map_live_options_trade(buy_order: dict, sell_order: dict) -> TradeRecord` — map paired options orders (strategy="live_options", setup=f"{option_type} {strike} {expiry}", realized_pnl=(exit_premium-entry_premium)×qty×lot_size×dir_sign)
    - Implement `match_orders(orders: List[dict], instrument_type: str) -> MatchResult` — pair BUY/SELL orders by symbol (equity) or by symbol+strike+expiry+option_type (options), return matched pairs and unmatched
    - Implement `filter_equity_orders(orders: List[dict]) -> List[dict]` — filter status="complete" and instrument_type=equity
    - Implement `filter_options_orders(orders: List[dict]) -> List[dict]` — filter status="complete" and instrument_type contains "OPT" or "FUT"
    - _Requirements: 1.2, 1.3, 2.2, 2.3, 2.5, 3.1, 3.2, 3.3, 3.4, 6.1, 6.3_

  - [ ]* 3.2 Write property test for paper trade mapping preserves all fields
    - **Property 1: Paper trade mapping preserves all fields**
    - Generate random valid closed paper trade dicts
    - Verify all fields are correctly mapped in the output TradeRecord
    - **Validates: Requirements 1.2, 1.3, 6.1, 6.3**

  - [ ]* 3.3 Write property test for trade book filtering partitions correctly
    - **Property 4: Trade book filtering correctly partitions by instrument type**
    - Generate random order lists with mixed instrument types and statuses
    - Verify equity filter and options filter produce correct subsets with no loss or duplication
    - **Validates: Requirements 2.2, 3.1**

  - [ ]* 3.4 Write property test for stock order matching and P&L
    - **Property 5: Stock order matching pairs correctly and computes P&L**
    - Generate random BUY/SELL order pairs for equity
    - Verify matching pairs correctly and P&L = (exit−entry)×qty for LONG, inverse for SHORT
    - **Validates: Requirements 2.3**

  - [ ]* 3.5 Write property test for options order matching and P&L
    - **Property 6: Options order matching pairs by contract and computes P&L correctly**
    - Generate random BUY/SELL options order pairs with same contract details
    - Verify matching and P&L = (exit_premium−entry_premium)×qty×lot_size×dir
    - **Validates: Requirements 3.2, 3.4**

  - [ ]* 3.6 Write property test for unmatched orders stored as pending
    - **Property 7: Unmatched orders are stored as pending entries**
    - Generate order sets where some have no counterpart
    - Verify unmatched orders appear in MatchResult.unmatched_orders with all fields preserved
    - **Validates: Requirements 2.4, 3.5**

  - [ ]* 3.7 Write unit tests for TradeMapper
    - Test `map_paper_trade` with a known paper trade dict
    - Test `map_live_stock_trade` with known BUY/SELL pair
    - Test `map_live_options_trade` with known options pair
    - Test `match_orders` with fully matched set
    - Test `match_orders` with partial matches (some unmatched)
    - Test `filter_equity_orders` with mixed order list
    - Test `filter_options_orders` with mixed order list
    - Test mapping failure on missing required fields raises appropriate error
    - _Requirements: 1.2, 1.3, 2.2, 2.3, 3.1, 3.2, 3.4_

- [x] 4. Checkpoint - Ensure ledger and mapper tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Trade Sync Service orchestrator
  - [x] 5.1 Implement TradeSyncService class
    - Create `apps/quant/trade_sync/service.py`
    - Implement `__init__(api_base_url, bff_base_url, interval, user_id)` — configure service with URLs, interval from TRADE_SYNC_INTERVAL env var (default 60), user_id
    - Implement `async start()` — start background polling loop (same pattern as TradeMonitor)
    - Implement `async stop()` — graceful shutdown of background loop
    - Implement `async run_sync_cycle() -> SyncCycleResult` — orchestrate full sync cycle:
      1. Sync paper trades (always)
      2. Check Kotak session validity
      3. If valid session: sync live stock trades and live options trades
      4. Return cycle result with counts and errors
    - Implement `async _sync_paper_trades() -> Tuple[int, List[str]]` — fetch closed paper trades from API, filter via ledger, map via TradeMapper, persist via TradeRepository, mark synced in ledger
    - Implement `async _sync_live_trades() -> Tuple[int, int, List[str]]` — fetch trade book via PortfolioFetcher, filter equity/options, match orders, handle pending entries, persist matched trades, mark synced
    - Implement `async _check_kotak_session() -> bool` — GET session status endpoint, return validity
    - Implement `get_status() -> SyncStatus` — return current service status
    - Process each trade independently with try/except for failure isolation (Req 7.4)
    - Handle API unreachable (log warning, skip) per Req 7.1
    - Handle 401/403 (mark session invalid) per Req 7.2
    - Handle 5xx (log error, retry next cycle) per Req 7.3
    - Never crash regardless of errors per Req 7.5
    - _Requirements: 1.1, 1.4, 1.5, 1.6, 2.1, 2.4, 2.6, 2.7, 3.5, 3.6, 3.7, 4.1, 4.2, 4.3, 4.4, 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 5.2 Write property test for sync idempotency
    - **Property 2: Sync idempotency — duplicate trades are never created**
    - Generate random trade sets, pre-populate ledger with those trade IDs
    - Run sync cycle, verify zero new TradeRecords created
    - **Validates: Requirements 1.5, 2.7, 3.7**

  - [ ]* 5.3 Write property test for ledger records all synced trades
    - **Property 3: Ledger records all successfully synced trades**
    - Generate random trade batches, run sync cycle
    - Verify every successfully persisted trade has a corresponding ledger entry
    - **Validates: Requirements 1.4, 2.6, 3.6**

  - [ ]* 5.4 Write property test for partial mapping failures
    - **Property 10: Partial mapping failures do not prevent valid trade syncing**
    - Generate batches with mix of valid and invalid trades (missing fields)
    - Verify valid trades are synced and only invalid trades appear as errors
    - **Validates: Requirements 7.4**

  - [ ]* 5.5 Write unit tests for TradeSyncService
    - Test service starts and stops correctly
    - Test service respects TRADE_SYNC_ENABLED=false (does not start)
    - Test service uses TRADE_SYNC_INTERVAL value
    - Test sync cycle calls paper sync always
    - Test sync cycle calls live sync only when session valid
    - Test sync cycle skips live sync when session invalid (no error raised)
    - Test Paper Trading API unreachable → warning logged, no crash
    - Test Kotak BFF 401 → session marked invalid
    - Test Kotak BFF 500 → error logged, retry next cycle
    - Test individual trade mapping failure doesn't halt batch
    - Test get_status returns correct fields after a cycle
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 6. Implement repository filtering by strategy
  - [x] 6.1 Add strategy filtering support to TradeRepository
    - Extend `apps/quant/trade_analysis/repository.py` to support filtering trades by `strategy` field value
    - Implement `get_trades_by_strategy(user_id, strategy) -> List[TradeRecord]` — return only trades matching the given strategy
    - Ensure existing `get_trades` method remains unchanged
    - _Requirements: 6.2_

  - [ ]* 6.2 Write property test for repository filtering by strategy
    - **Property 9: Repository filtering by strategy returns correct subset**
    - Generate random TradeRecord sets with mixed strategy values
    - Filter by each strategy, verify returns exactly matching trades
    - **Validates: Requirements 6.2**

- [x] 7. Checkpoint - Ensure all service and repository tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Register Trade Sync Service in quant engine
  - [x] 8.1 Create FastAPI router for trade sync status endpoint
    - Create `apps/quant/trade_sync/router.py`
    - GET `/api/trade-sync/status` — return TradeSyncService.get_status() as JSON (running state, last sync timestamp, trades synced in last cycle, errors)
    - _Requirements: 4.5_

  - [x] 8.2 Integrate TradeSyncService into quant engine main.py
    - Modify `apps/quant/main.py` to import and register the trade_sync router
    - Read TRADE_SYNC_ENABLED env var (default: "true") — if "false", skip service startup
    - Read TRADE_SYNC_INTERVAL env var (default: "60") — pass as interval to TradeSyncService
    - Register TradeSyncService start in FastAPI lifespan startup event
    - Register TradeSyncService stop in FastAPI lifespan shutdown event
    - Follow existing pattern from TradeMonitor registration
    - _Requirements: 4.1, 4.2, 4.5_

  - [ ]* 8.3 Write integration tests for trade sync end-to-end
    - Test end-to-end paper trade sync with real TradeRepository (file-based)
    - Test end-to-end live trade sync with mocked PortfolioFetcher
    - Test multi-cycle sync with accumulating ledger state
    - Test restart scenario: verify ledger loads correctly and prevents re-sync
    - Test status endpoint returns correct structure
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after mapper/ledger (task 4), service (task 7), and integration (task 9)
- Property tests validate universal correctness properties from the design document (10 properties total)
- Unit tests validate specific examples and edge cases
- All code lives in `apps/quant/trade_sync/` following existing quant engine module patterns
- Test files go in `apps/quant/tests/test_trade_sync_properties.py` and `apps/quant/tests/test_trade_sync_unit.py`
- Uses Python Hypothesis for property-based tests (already configured in project)
- Reuses existing `PortfolioFetcher`, `TradeRepository`, and `JsonFileStore` — no new dependencies needed
- Persistence file: `apps/quant/data/trade_sync_ledger.json`
- Environment variables: `TRADE_SYNC_ENABLED` (default: true), `TRADE_SYNC_INTERVAL` (default: 60 seconds)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7"] },
    { "id": 3, "tasks": ["5.1", "6.1"] },
    { "id": 4, "tasks": ["5.2", "5.3", "5.4", "5.5", "6.2"] },
    { "id": 5, "tasks": ["8.1", "8.2"] },
    { "id": 6, "tasks": ["8.3"] }
  ]
}
```
