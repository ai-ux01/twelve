# Requirements Document

## Introduction

The Paper Trading System provides a comprehensive simulated trading environment that supports Swing, Intraday Stocks, and Options Scalping trade types. It integrates with the AI Trading Lab (Phase 10) and Options Scalper (Phase 9) via "BUY ON PAPER" actions, stores complete trade context including AI decision metadata, monitors open trades against live prices, and presents performance analytics through a dedicated frontend dashboard at `/paper-trading`.

## Glossary

- **Paper_Trading_Service**: The NestJS backend service responsible for creating, storing, monitoring, and closing paper trades.
- **Trade_Monitor**: A background service that periodically checks live market prices against open paper trade stop-loss and target levels.
- **Paper_Trade**: A simulated trade record containing entry parameters, AI context metadata, and lifecycle status.
- **Trade_Type**: One of SWING, INTRADAY, or OPTIONS_SCALPING, classifying the trading strategy.
- **Trade_Status**: The lifecycle state of a paper trade: OPEN, TARGET_HIT, STOP_HIT, MANUAL_EXIT, EXPIRED, or CANCELLED.
- **Performance_Calculator**: The module that computes aggregate trading metrics (win rate, profit factor, expectancy, drawdown) from closed trade records.
- **Paper_Trading_Dashboard**: The Next.js frontend page at `/paper-trading` displaying open trades, closed trades, and performance metrics.
- **Decision_Record**: The AI Trading Lab's stored interaction record containing prompt, response, market data, and recommendation context.
- **Market_Data_Snapshot**: A point-in-time capture of price, volume, and indicator data at the moment a paper trade is created.

## Requirements

### Requirement 1: Paper Trade Creation from AI Recommendations

**User Story:** As a trader, I want to create a paper trade directly from an AI recommendation, so that I can test the AI's suggestions without risking real capital.

#### Acceptance Criteria

1. WHEN the user clicks "BUY ON PAPER" in the AI Trading Lab, THE Paper_Trading_Service SHALL create a Paper_Trade with the associated Decision_Record data.
2. WHEN the user clicks "BUY ON PAPER" in the Options Scalper, THE Paper_Trading_Service SHALL create a Paper_Trade with the scalper signal data.
3. THE Paper_Trading_Service SHALL store the following metadata on each Paper_Trade: original prompt, prompt version, AI response, market data snapshot, indicators, trendline analysis, entry price, stop loss, target, probability, risk/reward ratio, timestamp, agent ID, and decision ID.
4. WHEN a Paper_Trade is created, THE Paper_Trading_Service SHALL assign an initial Trade_Status of OPEN.
5. WHEN a Paper_Trade is created, THE Paper_Trading_Service SHALL assign the appropriate Trade_Type based on the source: SWING for swing recommendations, INTRADAY for intraday recommendations, and OPTIONS_SCALPING for options scalper signals.

### Requirement 2: Trade Type Support

**User Story:** As a trader, I want the paper trading system to support all three of my trading strategies, so that I can track performance across swing, intraday, and options scalping separately.

#### Acceptance Criteria

1. THE Paper_Trading_Service SHALL support creating Paper_Trades with Trade_Type SWING.
2. THE Paper_Trading_Service SHALL support creating Paper_Trades with Trade_Type INTRADAY.
3. THE Paper_Trading_Service SHALL support creating Paper_Trades with Trade_Type OPTIONS_SCALPING.
4. WHEN a Paper_Trade has Trade_Type OPTIONS_SCALPING, THE Paper_Trading_Service SHALL store additional options-specific fields: strike price, option type (CE/PE), expiry date, and underlying symbol.
5. THE Paper_Trading_Dashboard SHALL allow filtering trades by Trade_Type.

### Requirement 3: Permanent Trade Storage

**User Story:** As a trader, I want all my paper trades permanently stored, so that I can review historical performance and learn from past decisions.

#### Acceptance Criteria

1. THE Paper_Trading_Service SHALL persist every Paper_Trade to the PostgreSQL database.
2. THE Paper_Trading_Service SHALL retain closed Paper_Trades indefinitely without automatic deletion.
3. WHEN a Paper_Trade transitions from OPEN to any terminal status, THE Paper_Trading_Service SHALL record the exit price, exit timestamp, and realized profit/loss.
4. THE Paper_Trading_Service SHALL store the complete AI context (prompt, response, indicators, trendline analysis) as a JSON field on the Paper_Trade record.

### Requirement 4: Trade Monitoring

**User Story:** As a trader, I want my open paper trades automatically monitored against live prices, so that I know when targets or stop-losses are hit without manual checking.

#### Acceptance Criteria

1. THE Trade_Monitor SHALL run as a background service checking live prices against all OPEN Paper_Trades at a configurable interval (default: 30 seconds).
2. WHEN the current market price reaches or exceeds the target price of an OPEN Paper_Trade, THE Trade_Monitor SHALL update the Trade_Status to TARGET_HIT and record the exit price.
3. WHEN the current market price reaches or falls below the stop-loss price of an OPEN Paper_Trade, THE Trade_Monitor SHALL update the Trade_Status to STOP_HIT and record the exit price.
4. WHILE a Paper_Trade has Trade_Status OPEN, THE Trade_Monitor SHALL update the current price and unrealized profit/loss on each check cycle.
5. WHEN an OPTIONS_SCALPING Paper_Trade expires (current date passes expiry date), THE Trade_Monitor SHALL update the Trade_Status to EXPIRED and record the final price.

### Requirement 5: Manual Trade Management

**User Story:** As a trader, I want to manually close or cancel paper trades, so that I can exit positions based on my own judgment.

#### Acceptance Criteria

1. WHEN the user requests a manual exit on an OPEN Paper_Trade, THE Paper_Trading_Service SHALL update the Trade_Status to MANUAL_EXIT and record the current market price as exit price.
2. WHEN the user cancels an OPEN Paper_Trade, THE Paper_Trading_Service SHALL update the Trade_Status to CANCELLED without recording an exit price.
3. IF a user attempts to close or cancel a Paper_Trade that is not in OPEN status, THEN THE Paper_Trading_Service SHALL return an error indicating the trade is already closed.

### Requirement 6: Performance Metrics Calculation

**User Story:** As a trader, I want to see aggregate performance metrics, so that I can evaluate how well my paper trading strategies perform over time.

#### Acceptance Criteria

1. THE Performance_Calculator SHALL compute Win Rate as the percentage of closed trades where realized profit/loss is greater than zero.
2. THE Performance_Calculator SHALL compute Profit Factor as the ratio of gross profits to gross losses across all closed trades.
3. THE Performance_Calculator SHALL compute Total P&L as the sum of realized profit/loss across all closed trades.
4. THE Performance_Calculator SHALL compute Expectancy as the average profit/loss per trade (Total P&L divided by number of closed trades).
5. THE Performance_Calculator SHALL compute Average R as the mean of (actual profit or loss divided by initial risk amount) across all closed trades, where initial risk is entry price minus stop-loss multiplied by quantity.
6. THE Performance_Calculator SHALL compute Maximum Drawdown as the largest peak-to-trough decline in cumulative P&L.
7. WHEN there are zero closed trades, THE Performance_Calculator SHALL return zero for all metrics.
8. THE Performance_Calculator SHALL support filtering metrics by Trade_Type.

### Requirement 7: Paper Trading Dashboard - Open Trades View

**User Story:** As a trader, I want to see all my open paper trades in a table, so that I can monitor active positions at a glance.

#### Acceptance Criteria

1. THE Paper_Trading_Dashboard SHALL display an Open Trades table at the `/paper-trading` route.
2. THE Paper_Trading_Dashboard SHALL display the following columns for each open trade: symbol, trade type, direction, entry price, current price, stop loss, target, unrealized P&L, and time since entry.
3. WHILE trades are open, THE Paper_Trading_Dashboard SHALL update unrealized P&L values at a configurable refresh interval (default: 30 seconds).
4. THE Paper_Trading_Dashboard SHALL provide a "Close" action button on each open trade row to trigger manual exit.
5. THE Paper_Trading_Dashboard SHALL provide a "Cancel" action button on each open trade row to cancel the trade.

### Requirement 8: Paper Trading Dashboard - Closed Trades View

**User Story:** As a trader, I want to see all my closed paper trades in a table, so that I can review past trade outcomes.

#### Acceptance Criteria

1. THE Paper_Trading_Dashboard SHALL display a Closed Trades table showing trades with terminal statuses (TARGET_HIT, STOP_HIT, MANUAL_EXIT, EXPIRED, CANCELLED).
2. THE Paper_Trading_Dashboard SHALL display the following columns for each closed trade: symbol, trade type, direction, entry price, exit price, realized P&L, R-multiple, exit reason (status), and duration.
3. WHEN the user clicks on a closed trade row, THE Paper_Trading_Dashboard SHALL display the full AI context: original prompt, AI response, indicators, and trendline analysis.
4. THE Paper_Trading_Dashboard SHALL support sorting closed trades by date, P&L, and R-multiple.

### Requirement 9: Paper Trading Dashboard - Performance Metrics Display

**User Story:** As a trader, I want performance metrics prominently displayed, so that I can quickly assess my trading effectiveness.

#### Acceptance Criteria

1. THE Paper_Trading_Dashboard SHALL display a performance summary panel showing Win Rate, Profit Factor, Total P&L, Expectancy, Average R, and Maximum Drawdown.
2. THE Paper_Trading_Dashboard SHALL color-code metrics: green for positive values, red for negative values.
3. THE Paper_Trading_Dashboard SHALL allow filtering all dashboard views and metrics by Trade_Type (All, Swing, Intraday, Options Scalping).
4. WHEN the user changes the Trade_Type filter, THE Paper_Trading_Dashboard SHALL recalculate and update all displayed metrics and tables within 2 seconds.

### Requirement 10: API Endpoints

**User Story:** As a frontend developer, I want well-defined REST API endpoints, so that the dashboard can fetch and manage paper trades.

#### Acceptance Criteria

1. THE Paper_Trading_Service SHALL expose a GET endpoint to retrieve all Paper_Trades for a user with optional status and trade-type filters.
2. THE Paper_Trading_Service SHALL expose a GET endpoint to retrieve performance metrics for a user with optional trade-type filter.
3. THE Paper_Trading_Service SHALL expose a POST endpoint to create a Paper_Trade from a Decision_Record or scalper signal.
4. THE Paper_Trading_Service SHALL expose a PATCH endpoint to manually close an OPEN Paper_Trade.
5. THE Paper_Trading_Service SHALL expose a PATCH endpoint to cancel an OPEN Paper_Trade.
6. THE Paper_Trading_Service SHALL support pagination on the trade list endpoint with configurable page size (default: 20).
7. IF an API request references a Paper_Trade that does not exist, THEN THE Paper_Trading_Service SHALL return a 404 status with a descriptive error message.
