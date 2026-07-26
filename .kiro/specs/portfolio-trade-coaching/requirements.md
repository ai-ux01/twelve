# Requirements Document

## Introduction

Portfolio Trade Coaching extends the existing AI Trade Coach to analyze real brokerage data from the user's Kotak Neo account. The system fetches live positions, holdings, and completed trade history via the existing BFF proxy layer, normalizes it into the Trade Coach's internal format, and produces coaching insights based on actual live trading performance — either alongside or instead of paper trading data.

## Glossary

- **Trade_Coach**: The Python quant engine module (`apps/quant/trade_coach/`) that analyzes trade data and produces coaching reports including strengths, weaknesses, behavior patterns, and recommendations.
- **Kotak_BFF**: The NestJS Backend-for-Frontend proxy controller (`apps/api/src/trading/kotak-neo-auth.controller.ts`) that manages authenticated sessions and proxies requests to the Kotak Neo API.
- **Portfolio_Fetcher**: A new component in the quant engine responsible for requesting and receiving raw portfolio data from the Kotak BFF.
- **Trade_Normalizer**: A new component that transforms raw Kotak Neo API responses (positions, holdings, trade book) into the internal Trade data model used by the Trade Coach.
- **Data_Source_Selector**: The mechanism allowing users to choose which data sources (paper, live, or both) to include in coaching analysis.
- **Session_ID**: An opaque identifier stored in the Kotak session store, passed via `X-Session-Id` header to authenticate Kotak BFF proxy requests.
- **Position**: An open intraday or carryforward trade position from the Kotak Neo account.
- **Holding**: A delivery-based stock holding in the user's demat account.
- **Trade_Book**: The list of executed (filled) orders from the Kotak Neo account for the current trading day.
- **Order_History**: Historical order records from the Kotak Neo account.

## Requirements

### Requirement 1: Fetch Live Portfolio Data

**User Story:** As a trader, I want the Trade Coach to fetch my real Kotak Neo portfolio data, so that coaching analysis reflects my actual live trading.

#### Acceptance Criteria

1. WHEN a coaching analysis is requested with source "live", THE Portfolio_Fetcher SHALL retrieve positions from the Kotak_BFF `/api/kotak-neo/reports/positions` endpoint.
2. WHEN a coaching analysis is requested with source "live", THE Portfolio_Fetcher SHALL retrieve holdings from the Kotak_BFF `/api/kotak-neo/reports/holdings` endpoint.
3. WHEN a coaching analysis is requested with source "live", THE Portfolio_Fetcher SHALL retrieve completed trades from the Kotak_BFF `/api/kotak-neo/reports/trades` endpoint.
4. THE Portfolio_Fetcher SHALL pass the user's Session_ID in the `X-Session-Id` header for all Kotak_BFF requests.
5. IF the Session_ID is missing or invalid, THEN THE Portfolio_Fetcher SHALL return a clear error indicating the user must authenticate with Kotak Neo first.
6. IF the Kotak_BFF returns an error response, THEN THE Portfolio_Fetcher SHALL propagate the error with a descriptive message including the HTTP status code.

### Requirement 2: Normalize Kotak Data to Internal Trade Format

**User Story:** As a system component, I want raw Kotak Neo API responses transformed into the internal Trade model, so that the existing coaching analysis engine can process live data without modification.

#### Acceptance Criteria

1. WHEN positions data is received from Kotak Neo, THE Trade_Normalizer SHALL map each position into a Trade object with instrument, quantity, entry price, current price, P&L, and trade source set to "live".
2. WHEN holdings data is received from Kotak Neo, THE Trade_Normalizer SHALL map each holding into a Trade object with instrument, quantity, average price, current value, and trade source set to "live".
3. WHEN trade book data is received from Kotak Neo, THE Trade_Normalizer SHALL map each executed trade into a Trade object with instrument, side (buy/sell), quantity, price, execution timestamp, and trade source set to "live".
4. THE Trade_Normalizer SHALL preserve all numeric precision from the Kotak API response without rounding.
5. IF a required field is missing from the Kotak API response, THEN THE Trade_Normalizer SHALL skip that record and log a warning with the record identifier.
6. FOR ALL valid Kotak API responses, normalizing then serializing then normalizing again SHALL produce equivalent Trade objects (round-trip consistency).

### Requirement 3: Data Source Selection

**User Story:** As a trader, I want to choose whether the Trade Coach analyzes my paper trades, live trades, or both together, so that I can compare my simulated vs real performance.

#### Acceptance Criteria

1. THE Data_Source_Selector SHALL support three source modes: "paper" (paper trades only), "live" (Kotak Neo data only), and "combined" (both sources merged).
2. WHEN source mode is "paper", THE Trade_Coach SHALL analyze only trades from the TradeRepository (existing behavior).
3. WHEN source mode is "live", THE Trade_Coach SHALL analyze only trades fetched and normalized from Kotak Neo.
4. WHEN source mode is "combined", THE Trade_Coach SHALL merge paper trades and live trades into a single dataset before analysis.
5. THE Data_Source_Selector SHALL default to "combined" when the user has an active Kotak Neo session and paper trades exist.
6. THE Data_Source_Selector SHALL default to "paper" when no active Kotak Neo session exists.

### Requirement 4: Extended Coaching Analysis for Live Data

**User Story:** As a trader, I want coaching insights that account for real market execution factors (slippage, partial fills, brokerage costs), so that recommendations are grounded in real-world conditions.

#### Acceptance Criteria

1. WHEN analyzing live trades, THE Trade_Coach SHALL calculate realized slippage by comparing executed price against the order's intended price where available.
2. WHEN analyzing live trades, THE Trade_Coach SHALL identify partial fill patterns and include them in behavior detection.
3. WHEN combined mode is active, THE Trade_Coach SHALL compare paper trading metrics against live trading metrics and highlight divergences in the coaching report.
4. THE Trade_Coach SHALL include the data source label ("paper", "live", or "combined") in the coaching response metadata.
5. WHEN live trade data contains fewer than 5 completed trades, THE Trade_Coach SHALL include a recommendation that more trading history is needed for meaningful analysis.

### Requirement 5: Session Validation and Authentication Flow

**User Story:** As a trader, I want a clear indication when my Kotak session has expired, so that I can re-authenticate without confusion.

#### Acceptance Criteria

1. WHEN the user requests live coaching analysis, THE Trade_Coach SHALL first validate the Kotak Neo session is active via the Kotak_BFF status endpoint.
2. IF the session validation fails, THEN THE Trade_Coach SHALL return a response with `success: false` and a message directing the user to log in to Kotak Neo.
3. THE Trade_Coach SHALL not cache stale portfolio data beyond the current analysis request.
4. WHEN the session expires mid-analysis, THE Trade_Coach SHALL abort gracefully and report which data was successfully fetched before the failure.

### Requirement 6: Frontend Data Source Toggle

**User Story:** As a trader, I want to select my data source from the Trade Coach UI, so that I can easily switch between paper, live, and combined analysis modes.

#### Acceptance Criteria

1. THE Trade_Coach_Page SHALL display a data source selector with options: "Paper Trades", "Live Portfolio", and "Combined".
2. WHILE no active Kotak Neo session exists, THE Trade_Coach_Page SHALL disable the "Live Portfolio" and "Combined" options and show a tooltip indicating login is required.
3. WHEN the user selects "Live Portfolio" or "Combined", THE Trade_Coach_Page SHALL pass the selected source mode to the coaching analysis API request.
4. THE Trade_Coach_Page SHALL display the data source label in the coaching report header to indicate which data was analyzed.
5. IF the analysis returns a session error, THEN THE Trade_Coach_Page SHALL display a prompt to authenticate with Kotak Neo, linking to the existing login dialog.

### Requirement 7: API Endpoint Extension

**User Story:** As a frontend developer, I want the coaching analysis API to accept a data source parameter, so that the frontend can request analysis of different data sources.

#### Acceptance Criteria

1. THE Trade_Coach analyze endpoint SHALL accept an optional `data_source` parameter with values "paper", "live", or "combined".
2. THE Trade_Coach analyze endpoint SHALL accept an optional `session_id` parameter required when `data_source` is "live" or "combined".
3. WHEN `data_source` is "live" or "combined" and `session_id` is not provided, THE Trade_Coach SHALL return an HTTP 400 error with a descriptive message.
4. THE Trade_Coach behaviors endpoint SHALL accept the same `data_source` and `session_id` parameters with identical validation rules.
5. THE Trade_Coach compare endpoint SHALL include live portfolio metrics as an additional source when a valid `session_id` is provided.
