# Requirements Document

## Introduction

A Python Backtesting Engine that allows users to define trading strategies with entry/exit rules, indicators, and risk management parameters, then simulate those strategies against historical OHLCV data. The engine produces comprehensive performance metrics, enforces bias prevention techniques, and supports multiple testing modes (in-sample, out-of-sample, walk-forward). A frontend route at `/backtesting` provides visualization and interaction capabilities.

## Glossary

- **Backtesting_Engine**: The core Python module that simulates trading strategies against historical data, located at `apps/quant/backtesting/`.
- **OHLCV_Data**: Historical price data consisting of Open, High, Low, Close, and Volume values per time bar.
- **Indicator**: A technical analysis calculation derived from OHLCV data (e.g., RSI, ADX, EMA, MACD, ATR, VWAP).
- **Entry_Rule**: A condition based on indicators and price data that triggers opening a new position.
- **Exit_Rule**: A condition that triggers closing an existing position (stop loss, target, trailing stop, or holding period expiry).
- **Trendline**: A line connecting price swing points used as a trading signal condition.
- **Trailing_Stop**: A dynamic stop loss that moves in the direction of profit, locking in gains.
- **Slippage**: The simulated difference between expected fill price and actual fill price.
- **Brokerage_Fee**: A fixed or percentage-based cost charged per trade transaction.
- **Transaction_Cost**: The combined cost of slippage and brokerage fees for a trade.
- **Look_Ahead_Bias**: The error of using future data that would not have been available at the time of a trading decision.
- **Data_Leakage**: The error of allowing information from the test set to influence model training or rule evaluation.
- **Survivorship_Bias**: The error of only testing on instruments that currently exist, ignoring delisted ones.
- **In_Sample_Test**: A backtest run on the data period used to develop the strategy.
- **Out_Of_Sample_Test**: A backtest run on data not used during strategy development.
- **Walk_Forward_Test**: A testing mode that rolls through time using sequential in-sample/out-of-sample windows.
- **Performance_Metrics**: Aggregate statistics computed from backtest results (Total Return, CAGR, Win Rate, etc.).
- **Backtest_Result**: The complete output of a backtest run including trades, equity curve, and performance metrics.
- **Frontend_Page**: The Next.js page at `apps/web/app/backtesting/page.tsx` providing UI for running and inspecting backtests.

## Requirements

### Requirement 1: OHLCV Data Loading

**User Story:** As a trader, I want to load historical OHLCV data from JSON files or API, so that I can run backtests against real market data.

#### Acceptance Criteria

1. WHEN a JSON file path is provided, THE Backtesting_Engine SHALL load OHLCV_Data from the file and parse it into an internal data structure.
2. WHEN an API endpoint URL is provided, THE Backtesting_Engine SHALL fetch OHLCV_Data from the endpoint and parse it into an internal data structure.
3. IF the OHLCV_Data contains missing or malformed values, THEN THE Backtesting_Engine SHALL reject the dataset and return a descriptive error message.
4. THE Backtesting_Engine SHALL store OHLCV_Data using pure Python/numpy arrays without pandas dependency.
5. WHEN OHLCV_Data is loaded, THE Backtesting_Engine SHALL validate that timestamps are in chronological order.

### Requirement 2: Indicator Computation

**User Story:** As a trader, I want the engine to compute technical indicators from OHLCV data, so that I can define entry/exit rules based on indicator values.

#### Acceptance Criteria

1. WHEN OHLCV_Data is loaded, THE Backtesting_Engine SHALL compute RSI, ADX, EMA, MACD, ATR, and VWAP indicators by reusing existing calculators from `apps/quant/calculators/`.
2. WHEN an indicator requires a warmup period, THE Backtesting_Engine SHALL exclude bars within the warmup period from trade signal evaluation.
3. THE Backtesting_Engine SHALL compute indicators incrementally so that each bar only uses data available up to and including that bar.
4. WHEN a trendline is provided as input, THE Backtesting_Engine SHALL evaluate trendline proximity and crossover conditions at each bar.

### Requirement 3: Entry Rule Evaluation

**User Story:** As a trader, I want to define entry rules using combinations of indicator conditions, so that the engine knows when to open positions.

#### Acceptance Criteria

1. WHEN all conditions in an Entry_Rule evaluate to true at a given bar, THE Backtesting_Engine SHALL generate an entry signal for that bar.
2. THE Backtesting_Engine SHALL support combining multiple indicator conditions with AND logic for a single Entry_Rule.
3. THE Backtesting_Engine SHALL evaluate Entry_Rules using only data available at or before the current bar timestamp.
4. WHEN an entry signal is generated, THE Backtesting_Engine SHALL record the entry price as the next bar open price plus slippage.

### Requirement 4: Exit Rule Evaluation

**User Story:** As a trader, I want to define stop loss, target, trailing stop, and maximum holding period rules, so that positions are closed according to my risk management plan.

#### Acceptance Criteria

1. WHEN the price reaches the stop loss level during a bar, THE Backtesting_Engine SHALL close the position at the stop loss price.
2. WHEN the price reaches the target level during a bar, THE Backtesting_Engine SHALL close the position at the target price.
3. WHILE a position is open and a Trailing_Stop is configured, THE Backtesting_Engine SHALL update the trailing stop level each bar in the direction of profit.
4. WHEN a position has been held for the maximum holding period, THE Backtesting_Engine SHALL close the position at the current bar close price.
5. IF both stop loss and target are hit within the same bar, THEN THE Backtesting_Engine SHALL use the high/low sequence to determine which was hit first (conservative: assume stop loss hit first for long positions when open is closer to stop).

### Requirement 5: Transaction Cost Simulation

**User Story:** As a trader, I want the engine to simulate slippage and brokerage fees, so that backtest results reflect realistic trading conditions.

#### Acceptance Criteria

1. WHEN a trade is executed, THE Backtesting_Engine SHALL apply slippage to the fill price based on the configured slippage model (fixed points or percentage).
2. WHEN a trade is executed, THE Backtesting_Engine SHALL deduct the brokerage fee from the trade profit/loss.
3. THE Backtesting_Engine SHALL include transaction costs in all performance metric calculations.

### Requirement 6: Performance Metrics Calculation

**User Story:** As a trader, I want comprehensive performance metrics from a backtest, so that I can evaluate the viability of my strategy.

#### Acceptance Criteria

1. WHEN a backtest completes, THE Backtesting_Engine SHALL calculate Total Return as (final_equity - initial_equity) / initial_equity × 100.
2. WHEN a backtest completes, THE Backtesting_Engine SHALL calculate CAGR as ((final_equity / initial_equity) ^ (365 / total_days)) - 1.
3. WHEN a backtest completes, THE Backtesting_Engine SHALL calculate Win Rate as (winning_trades / total_trades) × 100.
4. WHEN a backtest completes, THE Backtesting_Engine SHALL calculate Profit Factor as sum(profits) / abs(sum(losses)).
5. WHEN a backtest completes, THE Backtesting_Engine SHALL calculate Expectancy as total_pnl / total_trades.
6. WHEN a backtest completes, THE Backtesting_Engine SHALL calculate Average Winner and Average Loser separately.
7. WHEN a backtest completes, THE Backtesting_Engine SHALL calculate Maximum Drawdown as the largest peak-to-trough percentage decline in the equity curve.
8. WHEN a backtest completes, THE Backtesting_Engine SHALL calculate Sharpe Ratio as (mean_return - risk_free_rate) / std_dev_returns using daily returns.
9. WHEN a backtest completes, THE Backtesting_Engine SHALL report Number of Trades and Average Holding Period.
10. THE Backtesting_Engine SHALL reuse the TradePerformanceCalculator from `apps/quant/trade_analysis/` for metrics that overlap (Win Rate, Profit Factor, Expectancy, Max Drawdown).

### Requirement 7: Look-Ahead Bias Prevention

**User Story:** As a trader, I want the engine to prevent look-ahead bias, so that my backtest results are not inflated by impossible knowledge.

#### Acceptance Criteria

1. THE Backtesting_Engine SHALL evaluate all indicators and rules using only data at or before the current bar index.
2. WHEN an entry signal is generated, THE Backtesting_Engine SHALL execute the trade on the next bar open (not the signal bar close).
3. THE Backtesting_Engine SHALL not use future high/low values to determine optimal entry or exit prices.

### Requirement 8: Data Leakage Prevention

**User Story:** As a trader, I want the engine to prevent data leakage between training and testing periods, so that out-of-sample results are trustworthy.

#### Acceptance Criteria

1. WHEN running Out_Of_Sample_Test mode, THE Backtesting_Engine SHALL not allow indicator calculations to use data from the out-of-sample period during parameter fitting.
2. WHEN running Walk_Forward_Test mode, THE Backtesting_Engine SHALL recalculate indicators fresh for each window without carrying state from previous windows.
3. THE Backtesting_Engine SHALL log the exact date boundaries used for each in-sample and out-of-sample window.

### Requirement 9: Survivorship Bias Mitigation

**User Story:** As a trader, I want the engine to flag potential survivorship bias, so that I am aware of limitations in my backtest data.

#### Acceptance Criteria

1. WHEN a backtest is initiated, THE Backtesting_Engine SHALL log a warning if the dataset does not include delisted or removed instruments.
2. THE Backtesting_Engine SHALL include a survivorship_bias_warning field in the Backtest_Result indicating whether the data source accounts for delistings.

### Requirement 10: In-Sample and Out-of-Sample Testing

**User Story:** As a trader, I want to split my data into in-sample and out-of-sample periods, so that I can validate strategy robustness.

#### Acceptance Criteria

1. WHEN a split ratio is specified, THE Backtesting_Engine SHALL divide OHLCV_Data into in-sample and out-of-sample periods by date.
2. WHEN In_Sample_Test mode is selected, THE Backtesting_Engine SHALL run the backtest only on the in-sample portion.
3. WHEN Out_Of_Sample_Test mode is selected, THE Backtesting_Engine SHALL run the backtest only on the out-of-sample portion.
4. THE Backtesting_Engine SHALL report separate Performance_Metrics for each data segment.

### Requirement 11: Walk-Forward Testing

**User Story:** As a trader, I want to run walk-forward analysis with rolling windows, so that I can evaluate strategy stability over time.

#### Acceptance Criteria

1. WHEN Walk_Forward_Test mode is selected, THE Backtesting_Engine SHALL divide data into sequential rolling windows with configurable in-sample and out-of-sample sizes.
2. WHEN processing each window, THE Backtesting_Engine SHALL run the strategy on the in-sample portion first, then validate on the out-of-sample portion.
3. WHEN all windows are processed, THE Backtesting_Engine SHALL aggregate out-of-sample results across all windows into combined Performance_Metrics.
4. THE Backtesting_Engine SHALL report per-window metrics alongside the aggregate metrics.

### Requirement 12: Backend API Integration

**User Story:** As a frontend developer, I want FastAPI endpoints for running backtests and fetching results, so that the UI can interact with the engine.

#### Acceptance Criteria

1. THE Backtesting_Engine SHALL expose a POST endpoint at `/quant/backtesting/run` that accepts strategy configuration and returns a Backtest_Result.
2. THE Backtesting_Engine SHALL expose a GET endpoint at `/quant/backtesting/results/{backtest_id}` that returns a stored Backtest_Result.
3. THE Backtesting_Engine SHALL store Backtest_Results in memory with a unique identifier.
4. WHEN the router module is created, THE Backtesting_Engine SHALL register the router in `apps/quant/main.py`.
5. IF the request payload is invalid, THEN THE Backtesting_Engine SHALL return HTTP 422 with a descriptive validation error.

### Requirement 13: Frontend Backtesting Page

**User Story:** As a trader, I want a web page at `/backtesting` to configure, run, and inspect backtests with results visualization, so that I can interact with the engine through a UI.

#### Acceptance Criteria

1. THE Frontend_Page SHALL provide a form to configure strategy parameters including indicators, entry rules, exit rules, and cost settings.
2. WHEN the user submits a backtest configuration, THE Frontend_Page SHALL call the backend `/quant/backtesting/run` endpoint and display a loading state.
3. WHEN results are received, THE Frontend_Page SHALL display all Performance_Metrics in a summary panel.
4. WHEN results are received, THE Frontend_Page SHALL render an equity curve chart showing portfolio value over time.
5. WHEN results are received, THE Frontend_Page SHALL display a trade list showing entry/exit dates, prices, and P&L for each trade.
6. THE Frontend_Page SHALL include a sidebar navigation link for the `/backtesting` route.
