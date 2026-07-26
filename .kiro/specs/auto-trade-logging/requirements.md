# Requirements Document

## Introduction

Auto Trade Logging enables automatic synchronization of completed trades from all trading sources (paper trading, live stock trades, live options trades) into the Trade Analysis module. This eliminates manual trade entry and ensures the Trade Analysis engine always has a complete, up-to-date record of all trading activity for performance metrics, AI analysis, and coaching insights.

## Glossary

- **Trade_Sync_Service**: The background service in the quant engine that orchestrates automatic logging of trades from all sources into Trade Analysis.
- **Trade_Analysis_Repository**: The existing `TradeRepository` that persists `TradeRecord` objects in JSON files (`apps/quant/trade_analysis/repository.py`).
- **Paper_Trading_API**: The NestJS API (`apps/api/src/trading/paper-trading.service.ts`) that manages paper trade lifecycle in Postgres via Prisma.
- **Kotak_BFF**: The NestJS Backend-for-Frontend proxy (`kotak-neo-auth.controller.ts`) that proxies authenticated requests to the Kotak Neo broker API.
- **Trade_Monitor**: The existing background service (`apps/quant/paper_trading/trade_monitor.py`) that polls open paper trades and evaluates stop/target conditions.
- **Portfolio_Fetcher**: The existing HTTP client (`apps/quant/trade_coach/portfolio_fetcher.py`) that fetches positions, holdings, and trades from the Kotak BFF.
- **TradeRecord**: The dataclass in Trade Analysis that represents a complete trade with entry/exit prices, P&L, and enrichment fields.
- **Sync_Ledger**: A persistent record of previously synced trade IDs used to prevent duplicate logging.
- **Trade_Mapper**: A component that converts source-specific trade data (paper trade DB records, Kotak order book entries) into the unified `TradeRecord` format.

## Requirements

### Requirement 1: Paper Trade Auto-Logging on Close

**User Story:** As a trader, I want closed paper trades to be automatically logged to Trade Analysis, so that my simulated trading performance is tracked without manual entry.

#### Acceptance Criteria

1. WHEN a paper trade status changes to a closed state (TARGET_HIT, STOP_HIT, MANUAL_EXIT, or EXPIRED), THE Trade_Sync_Service SHALL create a corresponding TradeRecord in the Trade_Analysis_Repository within the same monitoring cycle.
2. THE Trade_Mapper SHALL map paper trade fields to TradeRecord fields: symbol → symbol, direction → direction, entryPrice → entry_price, exitPrice → exit_price, quantity → quantity, realizedPnL → realized_pnl, enteredAt → entry_date, exitedAt → exit_date.
3. THE Trade_Mapper SHALL set the strategy field to "paper_trade" and include the paper trade's tradeType (SWING, OPTIONS_SCALPING) in the setup field.
4. THE Trade_Sync_Service SHALL record the paper trade ID in the Sync_Ledger after successful logging.
5. IF a paper trade ID already exists in the Sync_Ledger, THEN THE Trade_Sync_Service SHALL skip logging that trade to prevent duplicates.
6. IF the Trade_Analysis_Repository write fails, THEN THE Trade_Sync_Service SHALL log the error and retry on the next monitoring cycle without marking the trade as synced.

### Requirement 2: Live Stock Trade Auto-Logging

**User Story:** As a trader, I want executed stock orders on Kotak Neo to be automatically logged to Trade Analysis, so that my live trading performance is continuously updated.

#### Acceptance Criteria

1. WHEN the Trade_Sync_Service runs a sync cycle and a valid Kotak Neo session exists, THE Trade_Sync_Service SHALL fetch the trade book from the Kotak_BFF via the Portfolio_Fetcher.
2. THE Trade_Sync_Service SHALL identify completed stock orders (status = "complete", instrument type = equity) from the trade book response.
3. THE Trade_Mapper SHALL pair matching BUY and SELL executions for the same symbol into a single TradeRecord with computed realized_pnl and holding_period_days.
4. IF a completed order has no matching counterpart (open position), THEN THE Trade_Sync_Service SHALL store it as a pending entry in the Sync_Ledger and attempt to match on subsequent cycles.
5. THE Trade_Mapper SHALL set the strategy field to "live_stock" for all live equity trades.
6. THE Trade_Sync_Service SHALL record the Kotak order ID in the Sync_Ledger after successful logging.
7. IF a Kotak order ID already exists in the Sync_Ledger, THEN THE Trade_Sync_Service SHALL skip that order to prevent duplicates.

### Requirement 3: Live Options Trade Auto-Logging

**User Story:** As a trader, I want executed options orders on Kotak Neo to be automatically logged to Trade Analysis, so that my options trading performance is tracked alongside stock and paper trades.

#### Acceptance Criteria

1. WHEN the Trade_Sync_Service runs a sync cycle and a valid Kotak Neo session exists, THE Trade_Sync_Service SHALL identify completed options orders (instrument type containing "OPT" or "FUT") from the trade book response.
2. THE Trade_Mapper SHALL pair matching BUY and SELL executions for the same options contract (same symbol, strike, expiry, option type) into a single TradeRecord.
3. THE Trade_Mapper SHALL set the strategy field to "live_options" and include the option type (CE/PE), strike price, and expiry in the setup field.
4. THE Trade_Mapper SHALL calculate realized_pnl for options trades as (exit_premium − entry_premium) × quantity × lot_size for long positions, and the inverse for short positions.
5. IF a completed options order has no matching counterpart, THEN THE Trade_Sync_Service SHALL store it as a pending entry in the Sync_Ledger and attempt to match on subsequent cycles.
6. THE Trade_Sync_Service SHALL record the Kotak order ID in the Sync_Ledger after successful logging.
7. IF a Kotak order ID already exists in the Sync_Ledger, THEN THE Trade_Sync_Service SHALL skip that order to prevent duplicates.

### Requirement 4: Sync Cycle Scheduling and Configuration

**User Story:** As a trader, I want the trade sync to run automatically at configurable intervals, so that my Trade Analysis stays current without manual intervention.

#### Acceptance Criteria

1. THE Trade_Sync_Service SHALL run sync cycles at a configurable interval (default: 60 seconds) controlled by the TRADE_SYNC_INTERVAL environment variable.
2. THE Trade_Sync_Service SHALL start automatically when the quant engine starts, controlled by the TRADE_SYNC_ENABLED environment variable (default: true).
3. WHILE a valid Kotak Neo session exists, THE Trade_Sync_Service SHALL sync both paper trades and live trades in each cycle.
4. WHILE no valid Kotak Neo session exists, THE Trade_Sync_Service SHALL sync only paper trades and skip live trade fetching without raising errors.
5. THE Trade_Sync_Service SHALL expose a status endpoint returning: running state, last sync timestamp, trades synced in last cycle, and any errors from last cycle.

### Requirement 5: Sync Ledger Persistence

**User Story:** As a trader, I want the sync state to persist across quant engine restarts, so that previously synced trades are not duplicated after a restart.

#### Acceptance Criteria

1. THE Sync_Ledger SHALL persist synced trade IDs and pending entries to a JSON file at `data/trade_sync_ledger.json`.
2. WHEN the Trade_Sync_Service starts, THE Sync_Ledger SHALL load previously synced state from the persistence file.
3. THE Sync_Ledger SHALL store for each synced entry: source (paper/live_stock/live_options), source_id, trade_analysis_id, and sync_timestamp.
4. THE Sync_Ledger SHALL store pending (unmatched) entries with: source, source_id, symbol, direction, price, quantity, and timestamp.
5. IF the persistence file is missing or corrupted, THEN THE Sync_Ledger SHALL initialize with an empty state and log a warning.

### Requirement 6: Trade Source Identification

**User Story:** As a trader, I want to identify which trades in Trade Analysis came from auto-sync vs manual entry, so that I can filter and analyze by trade source.

#### Acceptance Criteria

1. THE Trade_Mapper SHALL populate the strategy field with the trade source identifier: "paper_trade", "live_stock", or "live_options".
2. THE Trade_Analysis_Repository SHALL support filtering trades by strategy field value.
3. WHEN a trade is auto-logged, THE Trade_Mapper SHALL set the created_at timestamp to the actual trade execution time (not the sync time).

### Requirement 7: Error Handling and Resilience

**User Story:** As a trader, I want the sync service to handle failures gracefully, so that temporary errors do not cause data loss or system instability.

#### Acceptance Criteria

1. IF the Paper_Trading_API is unreachable, THEN THE Trade_Sync_Service SHALL log a warning, skip paper trade sync for that cycle, and retry on the next cycle.
2. IF the Kotak_BFF returns a session error (401/403), THEN THE Trade_Sync_Service SHALL mark the Kotak session as invalid and skip live trade sync until a new valid session is detected.
3. IF the Kotak_BFF returns a server error (5xx), THEN THE Trade_Sync_Service SHALL log the error and retry live trade sync on the next cycle.
4. IF an individual trade mapping fails (missing required fields), THEN THE Trade_Sync_Service SHALL log the error with trade details and continue processing remaining trades.
5. THE Trade_Sync_Service SHALL not crash or halt the quant engine regardless of the error encountered during sync.
