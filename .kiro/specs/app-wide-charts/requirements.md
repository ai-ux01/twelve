# Requirements Document

## Introduction

This feature adds TradingView Lightweight Charts to all applicable pages in the ProfitTerminal app. Currently, charts exist only on the Analysis page via the `ChartViewer.tsx` component. This spec covers adding real-time candlestick charts, price charts with signal overlays, mini sparkline charts, equity curve charts, statistical distribution charts, and portfolio value charts across six pages: Market Feed, Intraday, Swing Scanner, Paper Trading, Trade Coach, and Dashboard.

## Glossary

- **Chart_Library**: The `lightweight-charts` v4.1.3 package from TradingView, already installed in the web app
- **Market_Feed_Chart**: A live candlestick chart on the Market Feed page that updates in real-time as WebSocket tick data arrives
- **Intraday_Chart**: A 5-minute candlestick chart on the Intraday page with horizontal price level overlays for entry, stop-loss, and target
- **Swing_Mini_Chart**: A compact candlestick or sparkline chart per swing candidate showing recent price trend with entry/SL/target markers
- **Equity_Curve_Chart**: A line chart on the Paper Trading page showing cumulative portfolio P&L over time
- **Trade_PnL_Chart**: A histogram/bar chart on the Paper Trading page showing individual trade P&L values
- **Win_Rate_Chart**: A pie or donut chart on the Trade Coach page showing win/loss distribution
- **PnL_Distribution_Chart**: A histogram on the Trade Coach page showing P&L value frequency distribution
- **Cumulative_PnL_Chart**: A line chart on the Trade Coach page showing cumulative P&L progression over time
- **Portfolio_Value_Chart**: A line chart on the Dashboard page showing total portfolio value over time
- **Dashboard_Sparkline**: A small inline sparkline on the Dashboard page for key metric trends
- **OHLCV_Data**: Open, High, Low, Close, Volume candle data fetched from the quant engine API
- **Tick_Data**: Real-time price updates received via Socket.IO from the NestJS market-feed gateway
- **Price_Level_Overlay**: A horizontal line drawn on a chart at a specific price (entry, stop-loss, or target)
- **Auto_Scroll**: Behavior where the chart time axis automatically scrolls to show the most recent candle as new data arrives

## Requirements

### Requirement 1: Market Feed Live Candlestick Chart

**User Story:** As a trader, I want to see a live candlestick chart for the selected instrument on the Market Feed page, so that I can visually track price action in real-time alongside the tick data table.

#### Acceptance Criteria

1. WHEN a user selects an instrument from the subscriptions table, THE Market_Feed_Chart SHALL display a candlestick chart for that instrument using recent OHLCV_Data fetched from the quant engine API
2. WHEN new Tick_Data arrives via WebSocket for the selected instrument, THE Market_Feed_Chart SHALL update the current candle's open, high, low, and close values in real-time
3. WHILE Tick_Data is streaming, THE Market_Feed_Chart SHALL Auto_Scroll to keep the most recent candle visible on the time axis
4. WHEN the WebSocket connection status changes to DISCONNECTED, THE Market_Feed_Chart SHALL display a visual indicator showing the data feed is stale
5. WHEN a user selects a different instrument, THE Market_Feed_Chart SHALL clear the previous chart data and load the new instrument's OHLCV_Data within 500ms of selection

### Requirement 2: Intraday Price Chart with Signal Overlays

**User Story:** As an intraday trader, I want to see a 5-minute candlestick chart with entry, stop-loss, and target levels overlaid, so that I can visualize the trading signal in context of recent price action.

#### Acceptance Criteria

1. WHEN an intraday analysis completes successfully, THE Intraday_Chart SHALL display the recent 5-minute OHLCV_Data for the analyzed symbol
2. WHEN a trading signal is generated with entry, stop-loss, and target prices, THE Intraday_Chart SHALL render three Price_Level_Overlay lines: green for entry, red for stop-loss, and blue for target
3. THE Intraday_Chart SHALL display a legend identifying each Price_Level_Overlay with its label and price value
4. WHEN the user clicks REFRESH & ANALYZE again, THE Intraday_Chart SHALL update with the latest OHLCV_Data and revised signal levels

### Requirement 3: Swing Scanner Mini Charts

**User Story:** As a swing trader, I want to see a mini price chart for each top candidate in the scan results, so that I can quickly assess the price trend and signal levels without navigating away.

#### Acceptance Criteria

1. WHEN scan results are displayed, THE Swing_Mini_Chart SHALL render a compact candlestick chart (maximum height 120 pixels) for each candidate in the results list
2. THE Swing_Mini_Chart SHALL display the most recent 30 daily candles for the candidate symbol
3. WHEN a candidate has entry, stop-loss, and target levels, THE Swing_Mini_Chart SHALL overlay Price_Level_Overlay lines on the chart with distinct colors: green for entry, red for stop-loss, blue for target
4. THE Swing_Mini_Chart SHALL omit volume display and time axis labels to maintain compact size
5. WHEN a user clicks on a Swing_Mini_Chart, THE Swing_Scanner page SHALL select that candidate and show its detail view

### Requirement 4: Paper Trading Equity Curve

**User Story:** As a paper trader, I want to see my portfolio's cumulative P&L as a line chart over time, so that I can track my overall performance trajectory.

#### Acceptance Criteria

1. WHEN the Paper Trading page loads with closed trades data, THE Equity_Curve_Chart SHALL display a line chart plotting cumulative realized P&L over time
2. THE Equity_Curve_Chart SHALL use trade close timestamps as the x-axis and cumulative P&L value as the y-axis
3. WHILE the cumulative P&L is positive, THE Equity_Curve_Chart SHALL render the line in green; WHILE the cumulative P&L is negative, THE Equity_Curve_Chart SHALL render the line in red
4. WHEN the trade type filter changes, THE Equity_Curve_Chart SHALL update to show the equity curve for only the filtered trade type
5. IF no closed trades exist for the selected filter, THEN THE Equity_Curve_Chart SHALL display an empty state message indicating insufficient data

### Requirement 5: Paper Trading Individual Trade P&L Chart

**User Story:** As a paper trader, I want to see a bar chart of individual trade P&L values, so that I can identify my best and worst trades at a glance.

#### Acceptance Criteria

1. WHEN the Paper Trading page loads with closed trades data, THE Trade_PnL_Chart SHALL display a histogram where each bar represents one closed trade's P&L
2. THE Trade_PnL_Chart SHALL color profitable trade bars green and losing trade bars red
3. THE Trade_PnL_Chart SHALL order bars chronologically by trade close time
4. WHEN the trade type filter changes, THE Trade_PnL_Chart SHALL update to show only trades matching the selected filter
5. IF no closed trades exist for the selected filter, THEN THE Trade_PnL_Chart SHALL display an empty state message indicating insufficient data

### Requirement 6: Trade Coach Win Rate Chart

**User Story:** As a trader reviewing my coaching report, I want to see a pie or donut chart of my win/loss distribution, so that I can quickly understand my success rate visually.

#### Acceptance Criteria

1. WHEN the Trade Coach analysis completes successfully, THE Win_Rate_Chart SHALL display a donut chart with segments for winning trades (green) and losing trades (red)
2. THE Win_Rate_Chart SHALL display the win rate percentage as a centered label inside the donut
3. THE Win_Rate_Chart SHALL include a legend showing the count of winning trades and losing trades
4. WHILE the Trade Coach analysis is loading, THE Win_Rate_Chart SHALL display a loading skeleton placeholder

### Requirement 7: Trade Coach P&L Distribution Histogram

**User Story:** As a trader reviewing my coaching report, I want to see a histogram of my P&L distribution, so that I can understand the spread of my trade outcomes.

#### Acceptance Criteria

1. WHEN the Trade Coach analysis completes successfully, THE PnL_Distribution_Chart SHALL display a histogram grouping trade P&L values into bins
2. THE PnL_Distribution_Chart SHALL use a minimum of 10 bins to represent the P&L range
3. THE PnL_Distribution_Chart SHALL color bins with positive midpoints green and bins with negative midpoints red
4. THE PnL_Distribution_Chart SHALL display axis labels showing P&L values on the x-axis and trade count on the y-axis

### Requirement 8: Trade Coach Cumulative P&L Line Chart

**User Story:** As a trader reviewing my coaching report, I want to see a cumulative P&L line chart over time, so that I can track whether my trading performance is improving or declining.

#### Acceptance Criteria

1. WHEN the Trade Coach analysis completes successfully, THE Cumulative_PnL_Chart SHALL display a line chart with trade date on the x-axis and cumulative P&L on the y-axis
2. WHILE the cumulative P&L is positive, THE Cumulative_PnL_Chart SHALL render the area fill in green; WHILE the cumulative P&L is negative, THE Cumulative_PnL_Chart SHALL render the area fill in red
3. THE Cumulative_PnL_Chart SHALL display a zero-line for reference
4. WHILE the Trade Coach analysis is loading, THE Cumulative_PnL_Chart SHALL display a loading skeleton placeholder

### Requirement 9: Dashboard Portfolio Value Chart

**User Story:** As a user landing on the dashboard, I want to see a line chart of my portfolio value over time, so that I can get an at-a-glance view of my overall progress.

#### Acceptance Criteria

1. WHEN the Dashboard page loads, THE Portfolio_Value_Chart SHALL fetch portfolio value history from the paper trades API and display a line chart
2. THE Portfolio_Value_Chart SHALL display the most recent 30 days of daily portfolio value on the x-axis
3. THE Portfolio_Value_Chart SHALL render a tooltip showing the exact value and date when a user hovers over a data point
4. IF no portfolio history data is available, THEN THE Portfolio_Value_Chart SHALL display a placeholder message indicating no data yet

### Requirement 10: Dashboard Metric Sparklines

**User Story:** As a user landing on the dashboard, I want to see mini sparkline charts next to key metrics, so that I can quickly see trends without navigating to detail pages.

#### Acceptance Criteria

1. WHEN the Dashboard page loads, THE Dashboard_Sparkline SHALL render a small inline line chart (maximum height 40 pixels, maximum width 120 pixels) for each key metric card
2. THE Dashboard_Sparkline SHALL display the most recent 7 data points for the respective metric
3. THE Dashboard_Sparkline SHALL omit axis labels, grid lines, and crosshair to maintain minimal size
4. THE Dashboard_Sparkline SHALL use a green line when the trend is positive (last value higher than first) and a red line when the trend is negative

### Requirement 11: Shared Chart Utilities

**User Story:** As a developer, I want reusable chart components and utilities built on top of the existing Chart_Library, so that all pages use consistent chart styling and behavior without code duplication.

#### Acceptance Criteria

1. THE Chart_Library integration SHALL provide a base hook or wrapper that handles chart creation, resize observer registration, and cleanup on unmount
2. THE Chart_Library integration SHALL provide consistent default styling (colors, grid, crosshair) matching the existing ChartViewer component aesthetics
3. THE Chart_Library integration SHALL support dark mode by reading the current theme and applying appropriate background and text colors
4. WHEN the browser window resizes, THE Chart_Library integration SHALL resize all active chart instances to fit their container width within 100ms
