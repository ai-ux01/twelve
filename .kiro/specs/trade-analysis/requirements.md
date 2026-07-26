# Requirements Document

## Introduction

The Existing Trade Analysis system enables traders to import historical trade data, compute advanced performance metrics, and receive AI-driven insights about trading patterns and weaknesses. The system lives at the `/trade-analysis` route, with backend computation in the quant engine (`apps/quant/trade_analysis/`) and a frontend page in the Next.js app. It supports CSV import, manual entry, and future broker integration (Kotak Neo). Each trade is enriched with technical indicators and market context, then aggregated into performance metrics that can be grouped by multiple dimensions.

## Glossary

- **Trade_Analysis_Engine**: The Python/FastAPI module at `apps/quant/trade_analysis/` responsible for importing, enriching, and analyzing historical trades
- **CSV_Importer**: The component that parses CSV files from standard brokerage export formats into normalized trade records
- **Trade_Record**: A single historical trade containing entry, exit, P&L, holding period, and associated metadata
- **Performance_Calculator**: The component that computes aggregate metrics (win rate, expectancy, profit factor, etc.) from a collection of trade records
- **MFE**: Maximum Favorable Excursion — the largest unrealized profit during a trade's holding period
- **MAE**: Maximum Adverse Excursion — the largest unrealized loss during a trade's holding period
- **Expectancy**: The average profit/loss per trade, calculated as total P&L divided by total trades
- **Profit_Factor**: The ratio of gross profits to gross losses
- **Maximum_Drawdown**: The largest peak-to-trough decline in cumulative P&L across a sequence of trades
- **Average_R**: The mean R-multiple across trades, where R = realized P&L / initial risk
- **Market_Regime**: A classification of market conditions (trending, ranging, volatile) based on ADX and trend indicators
- **Grouping_Engine**: The component that breaks down performance metrics by strategy, setup, sector, time of day, holding period, market regime, or probability
- **AI_Analyzer**: The component that uses the conversational AI pipeline to generate insights from actual stored trade statistics
- **Frontend_Page**: The Next.js page at `/trade-analysis` that provides the user interface for import, visualization, and AI interaction
- **Historical_Price_Data**: OHLCV price data for a symbol during a trade's holding period, required for MFE/MAE calculation

## Requirements

### Requirement 1: CSV Trade Import

**User Story:** As a trader, I want to import my trade history from CSV files, so that I can analyze my past performance without manual data entry.

#### Acceptance Criteria

1. WHEN a CSV file is uploaded, THE CSV_Importer SHALL parse columns including date, symbol, action (BUY/SELL), quantity, price, and optional columns (strategy, setup, sector)
2. WHEN a CSV row contains missing or malformed required fields, THE CSV_Importer SHALL reject that row and return a descriptive error indicating the row number and field name
3. WHEN a CSV file is successfully parsed, THE CSV_Importer SHALL match BUY and SELL actions for the same symbol to construct complete Trade_Record objects with entry price, exit price, quantity, and P&L
4. WHEN a CSV file contains unmatched entries (open trades with no corresponding exit), THE CSV_Importer SHALL flag those entries separately and exclude them from closed-trade analysis
5. THE CSV_Importer SHALL support date formats including ISO 8601, DD/MM/YYYY, and MM/DD/YYYY

### Requirement 2: Manual Trade Entry

**User Story:** As a trader, I want to manually enter individual trades, so that I can include trades from sources that do not export CSV.

#### Acceptance Criteria

1. WHEN a manual trade entry request is submitted with symbol, entry date, entry price, exit date, exit price, quantity, and direction, THE Trade_Analysis_Engine SHALL create a valid Trade_Record
2. WHEN a manual trade entry is missing any required field, THE Trade_Analysis_Engine SHALL return a validation error listing all missing fields
3. WHEN a manual trade entry includes optional fields (strategy, setup, sector, stop loss), THE Trade_Analysis_Engine SHALL store them in the Trade_Record

### Requirement 3: Kotak Neo Broker Import

**User Story:** As a Kotak Neo user, I want to import my trade history directly from my broker account, so that I can avoid manual file handling.

#### Acceptance Criteria

1. WHERE the Kotak Neo broker integration is available, THE Trade_Analysis_Engine SHALL fetch trade history from the Kotak Neo API and normalize it into Trade_Record objects
2. WHERE the Kotak Neo broker integration is unavailable, THE Trade_Analysis_Engine SHALL display a message indicating the feature is coming soon and suggest CSV import as an alternative

### Requirement 4: Trade Enrichment with Technical Indicators

**User Story:** As a trader, I want each trade to be annotated with market context and technical indicators, so that I can understand the conditions under which I traded.

#### Acceptance Criteria

1. WHEN a Trade_Record is created, THE Trade_Analysis_Engine SHALL compute the holding period as the number of calendar days between entry date and exit date
2. WHEN a Trade_Record is created and Historical_Price_Data is available, THE Trade_Analysis_Engine SHALL calculate the MFE as the maximum price movement in the favorable direction during the holding period
3. WHEN a Trade_Record is created and Historical_Price_Data is available, THE Trade_Analysis_Engine SHALL calculate the MAE as the maximum price movement in the adverse direction during the holding period
4. WHEN a Trade_Record is created and Historical_Price_Data is available, THE Trade_Analysis_Engine SHALL compute the RSI value at the entry date
5. WHEN a Trade_Record is created and Historical_Price_Data is available, THE Trade_Analysis_Engine SHALL compute the ADX value at the entry date
6. WHEN a Trade_Record is created and Historical_Price_Data is available, THE Trade_Analysis_Engine SHALL compute the volume relative to 20-day average volume at the entry date
7. WHEN a Trade_Record is created and Historical_Price_Data is available, THE Trade_Analysis_Engine SHALL detect the trendline context (support/resistance proximity) at entry
8. WHEN a Trade_Record is created, THE Trade_Analysis_Engine SHALL classify the Market_Regime at entry using ADX and trend indicators (trending, ranging, or volatile)
9. WHEN a Trade_Record has entry price, exit price, and stop loss defined, THE Trade_Analysis_Engine SHALL compute the risk/reward ratio as (exit price - entry price) / (entry price - stop loss) for long trades

### Requirement 5: Performance Metrics Calculation

**User Story:** As a trader, I want to see aggregate performance statistics across my trade history, so that I can evaluate my overall trading effectiveness.

#### Acceptance Criteria

1. WHEN a set of Trade_Records is provided, THE Performance_Calculator SHALL compute Win Rate as (winning trades / total trades) × 100
2. WHEN a set of Trade_Records is provided, THE Performance_Calculator SHALL compute Profit_Factor as sum of profits divided by absolute sum of losses
3. WHEN a set of Trade_Records is provided, THE Performance_Calculator SHALL compute Expectancy as total P&L divided by total number of trades
4. WHEN a set of Trade_Records is provided, THE Performance_Calculator SHALL compute Maximum_Drawdown as the largest peak-to-trough decline in cumulative P&L ordered by exit date
5. WHEN a set of Trade_Records is provided, THE Performance_Calculator SHALL compute Average_R as the mean of (realized P&L / initial risk) across all trades with defined stop loss
6. WHEN a set of Trade_Records with MFE and MAE values is provided, THE Performance_Calculator SHALL include MFE and MAE statistics (mean, median, max) in the results
7. WHEN a set of Trade_Records is provided and all trades have zero losses, THE Performance_Calculator SHALL return Profit_Factor as positive infinity

### Requirement 6: Grouping and Breakdown

**User Story:** As a trader, I want to break down my performance by different dimensions, so that I can identify which strategies, setups, or conditions yield the best results.

#### Acceptance Criteria

1. WHEN a grouping dimension is specified as "strategy", THE Grouping_Engine SHALL partition Trade_Records by the strategy field and compute Performance_Calculator metrics for each group
2. WHEN a grouping dimension is specified as "setup", THE Grouping_Engine SHALL partition Trade_Records by the setup field and compute Performance_Calculator metrics for each group
3. WHEN a grouping dimension is specified as "market_regime", THE Grouping_Engine SHALL partition Trade_Records by Market_Regime classification and compute Performance_Calculator metrics for each group
4. WHEN a grouping dimension is specified as "sector", THE Grouping_Engine SHALL partition Trade_Records by sector field and compute Performance_Calculator metrics for each group
5. WHEN a grouping dimension is specified as "time_of_day", THE Grouping_Engine SHALL partition Trade_Records into time buckets (pre-market, morning, midday, afternoon, closing) based on entry time and compute Performance_Calculator metrics for each bucket
6. WHEN a grouping dimension is specified as "holding_period", THE Grouping_Engine SHALL partition Trade_Records into duration buckets (intraday, 1-3 days, 4-7 days, 1-2 weeks, 2+ weeks) and compute Performance_Calculator metrics for each bucket
7. WHEN a grouping dimension is specified as "probability", THE Grouping_Engine SHALL partition Trade_Records by probability ranges (0-25%, 25-50%, 50-75%, 75-100%) and compute Performance_Calculator metrics for each range
8. WHEN a group contains zero trades, THE Grouping_Engine SHALL omit that group from the results

### Requirement 7: AI-Driven Trade Analysis

**User Story:** As a trader, I want to ask an AI to analyze my trading history and tell me what I am doing wrong, so that I can improve my decision-making.

#### Acceptance Criteria

1. WHEN a user submits an analysis prompt, THE AI_Analyzer SHALL query the actual stored trade statistics from the database before generating a response
2. THE AI_Analyzer SHALL include factual metrics (win rate, profit factor, expectancy, max drawdown, average R) in its analysis context
3. WHEN generating insights, THE AI_Analyzer SHALL reference specific grouping breakdowns (by strategy, regime, time of day) to identify patterns
4. THE AI_Analyzer SHALL identify the weakest-performing dimensions and provide actionable suggestions for improvement
5. IF the AI_Analyzer cannot retrieve trade statistics from the database, THEN THE AI_Analyzer SHALL inform the user that analysis requires stored trade data and suggest importing trades first
6. THE AI_Analyzer SHALL present only factual conclusions derived from stored data and SHALL NOT invent or hallucinate trade statistics

### Requirement 8: Frontend Trade Analysis Page

**User Story:** As a trader, I want a dedicated page at /trade-analysis to view my analysis results and interact with the AI, so that I have a centralized interface for all trade review activities.

#### Acceptance Criteria

1. THE Frontend_Page SHALL be accessible at the route `/trade-analysis`
2. THE Frontend_Page SHALL provide a file upload component for CSV import
3. THE Frontend_Page SHALL provide a form for manual trade entry with fields: symbol, entry date, entry price, exit date, exit price, quantity, direction, and optional fields (strategy, setup, sector, stop loss)
4. THE Frontend_Page SHALL display aggregate performance metrics (Win Rate, Profit Factor, Expectancy, Max Drawdown, Average R, MFE mean, MAE mean) after trades are imported
5. THE Frontend_Page SHALL provide a dimension selector to group results by strategy, setup, market regime, sector, time of day, holding period, or probability
6. THE Frontend_Page SHALL display grouped metrics in a tabular or card-based layout with the dimension value, trade count, win rate, profit factor, and expectancy for each group
7. THE Frontend_Page SHALL provide a text input for submitting AI analysis prompts
8. THE Frontend_Page SHALL display AI analysis responses with referenced statistics clearly formatted

### Requirement 9: Trade Analysis API Endpoints

**User Story:** As a frontend developer, I want well-defined API endpoints for trade analysis, so that the frontend can communicate with the quant engine reliably.

#### Acceptance Criteria

1. THE Trade_Analysis_Engine SHALL expose a POST `/api/trade-analysis/import/csv` endpoint that accepts a CSV file upload and returns parsed Trade_Records with any validation errors
2. THE Trade_Analysis_Engine SHALL expose a POST `/api/trade-analysis/trades` endpoint that accepts manual trade entry and returns the created Trade_Record
3. THE Trade_Analysis_Engine SHALL expose a GET `/api/trade-analysis/metrics` endpoint that returns aggregate Performance_Calculator results for the authenticated user's trades
4. THE Trade_Analysis_Engine SHALL expose a GET `/api/trade-analysis/metrics/grouped` endpoint that accepts a `dimension` query parameter and returns grouped performance breakdowns
5. THE Trade_Analysis_Engine SHALL expose a POST `/api/trade-analysis/ai/analyze` endpoint that accepts a prompt string and returns AI-generated analysis based on stored statistics
6. WHEN any endpoint receives an invalid request, THE Trade_Analysis_Engine SHALL return a 422 status code with a structured error response containing field-level validation messages

### Requirement 10: Data Persistence

**User Story:** As a trader, I want my imported trades to be saved persistently, so that I can return to my analysis across sessions without re-importing data.

#### Acceptance Criteria

1. WHEN trades are imported or manually entered, THE Trade_Analysis_Engine SHALL persist Trade_Records to the database associated with the authenticated user
2. WHEN the metrics endpoint is called, THE Performance_Calculator SHALL compute metrics from all persisted Trade_Records for the authenticated user
3. WHEN a trade is enriched with technical indicators, THE Trade_Analysis_Engine SHALL persist the enrichment data (MFE, MAE, RSI, ADX, volume ratio, market regime, trendline context) alongside the Trade_Record
