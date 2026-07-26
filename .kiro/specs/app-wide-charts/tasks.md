# Implementation Plan: App-Wide Charts

## Overview

This plan implements reusable charting across six pages of ProfitTerminal using lightweight-charts v4.1.3 and SVG. Work starts with the shared hook and utilities layer, then builds each chart component incrementally, and finishes by integrating components into their respective pages.

## Tasks

- [x] 1. Create shared chart infrastructure
  - [x] 1.1 Implement the chart theme configuration
    - Create `apps/web/lib/charts/chart-theme.ts`
    - Export `getChartTheme(isDark: boolean): ChartTheme` returning background, textColor, gridColor, borderColor, crosshairColor, upColor, downColor, volumeUpColor, volumeDownColor
    - Dark theme: dark backgrounds, light text; Light theme: white background, dark text
    - _Requirements: 11.2, 11.3_

  - [x] 1.2 Implement chart utility functions
    - Create `apps/web/lib/charts/chart-utils.ts`
    - Implement `toCandlestickData(data: OHLCVData[]): CandlestickData[]` — converts timestamp to Unix seconds, maps OHLC fields
    - Implement `toVolumeData(data: OHLCVData[]): HistogramData[]` — maps volume with up/down color based on close vs open
    - Implement `toLineData(points: { timestamp: string; value: number }[]): LineData[]`
    - Implement `addPriceLevel(chart, price, color, label): ISeriesApi<'Line'>`
    - Implement `cumulativeSum(values: number[]): number[]`
    - Implement `binValues(values: number[], binCount: number): { bins: [...] }`
    - _Requirements: 11.1, 11.2_

  - [x] 1.3 Implement the useChart hook
    - Create `apps/web/lib/hooks/useChart.ts`
    - Accept `UseChartOptions` (height, autoResize, darkMode, showGrid, showCrosshair, showTimeScale, showPriceScale, fitContent)
    - Create lightweight-charts instance on mount, attach to container ref
    - Register ResizeObserver with debounce <100ms for responsive width
    - Detect dark mode from `document.documentElement.classList` and apply theme
    - Clean up chart and observer on unmount
    - Return `{ chartContainerRef, chart, isReady }`
    - _Requirements: 11.1, 11.3, 11.4_

  - [ ]* 1.4 Write property tests for chart-utils (Properties 1, 4, 5, 9)
    - **Property 1: OHLCV to Candlestick Data Conversion** — For any valid OHLCVData array, toCandlestickData produces same-length array with matching fields and correct Unix timestamps
    - **Validates: Requirements 1.1, 2.1**
    - **Property 4: Data Slicing to Last N Items** — For any array and positive N, slicing returns min(length, N) items from the tail in original order
    - **Validates: Requirements 3.2, 9.2, 10.2**
    - **Property 5: Cumulative Sum Correctness** — For any numeric array, cumulative sum at position i equals sum of values 0..i, output length equals input length
    - **Validates: Requirements 4.1, 4.2, 8.1**
    - **Property 9: Histogram Binning Accounts for All Values** — For any numeric array and binCount >= 1, sum of bin counts equals input length, every value falls in a bin, bin count matches request
    - **Validates: Requirements 7.1, 7.2**

  - [ ]* 1.5 Write unit tests for chart-theme and useChart hook
    - Test `getChartTheme(true)` and `getChartTheme(false)` return correct color values
    - Test useChart creates and cleans up chart instance (mock lightweight-charts)
    - Test ResizeObserver registration and cleanup
    - _Requirements: 11.2, 11.3, 11.4_

- [x] 2. Checkpoint - Shared infrastructure complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement Market Feed and Intraday chart components
  - [x] 3.1 Implement MarketFeedChart component
    - Create `apps/web/components/charts/MarketFeedChart.tsx`
    - Accept `{ symbol, height }` props
    - Fetch OHLCV from quant engine on symbol change
    - Add candlestick series and volume histogram series
    - Subscribe to Socket.IO tick events for real-time candle updates (update high/low/close, keep open)
    - Show "Feed disconnected" overlay when WebSocket connection lost
    - Auto-scroll to keep latest candle visible
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 3.2 Write property test for candle tick update (Property 2)
    - **Property 2: Candle Update from Tick Preserves Invariants** — For any candle state and tick price: high = max(prev high, tick), low = min(prev low, tick), close = tick, open unchanged
    - **Validates: Requirements 1.2**

  - [x] 3.3 Implement IntradayChart component
    - Create `apps/web/components/charts/IntradayChart.tsx`
    - Accept `{ symbol, data, entry?, stopLoss?, target?, height }` props
    - Render 5-minute candlestick from provided OHLCV data
    - Add price level overlays: green line for entry, red for stop-loss, blue for target
    - Render legend below chart with labels and values
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 3.4 Write property test for price level color mapping (Property 3)
    - **Property 3: Price Level Color Mapping** — For any signal with entry, stopLoss, target values, color assignment is green→entry, red→stopLoss, blue→target, each at exact specified price
    - **Validates: Requirements 2.2, 3.3**

- [x] 4. Implement Swing Scanner and Paper Trading chart components
  - [x] 4.1 Implement SwingMiniChart component
    - Create `apps/web/components/charts/SwingMiniChart.tsx`
    - Accept `{ symbol, data, entry?, stopLoss?, target?, onClick? }` props
    - Fixed 120px height, no volume, no time axis labels
    - Compact candlestick with price level overlays (green entry, red SL, blue target)
    - Fire onClick when chart area is clicked
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 4.2 Implement EquityCurveChart component
    - Create `apps/web/components/charts/EquityCurveChart.tsx`
    - Accept `{ trades: { closedAt, realizedPnL }[], height? }` props
    - Compute cumulative P&L from trades using `cumulativeSum`
    - Use baseline series for green above zero / red below zero
    - Show empty state when no trades
    - _Requirements: 4.1, 4.2, 4.3, 4.5_

  - [x] 4.3 Implement TradePnLChart component
    - Create `apps/web/components/charts/TradePnLChart.tsx`
    - Accept `{ trades: { closedAt, realizedPnL }[], height? }` props
    - Histogram series with green bars for profit, red for loss
    - Ordered chronologically by closedAt
    - Show empty state when no trades
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

  - [ ]* 4.4 Write property tests for sign-based color, trade filter, and sort (Properties 6, 7, 8)
    - **Property 6: Sign-Based Color Assignment** — For any numeric value: positive → green, negative → red, zero → neutral
    - **Validates: Requirements 4.3, 5.2, 7.3, 8.2**
    - **Property 7: Trade Type Filter Preserves Only Matching Trades** — For any mixed trades and filter, output contains only matching trades, and all matching trades from input are present
    - **Validates: Requirements 4.4, 5.4**
    - **Property 8: Chronological Sort Invariant** — After sorting, each closedAt ≤ next closedAt
    - **Validates: Requirements 5.3**

- [x] 5. Checkpoint - Core chart components complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Trade Coach chart components
  - [x] 6.1 Implement WinRateDonut component
    - Create `apps/web/components/charts/WinRateDonut.tsx`
    - Accept `{ wins, losses, size? }` props
    - Pure SVG donut: green segment for wins, red for losses
    - Centered label with win rate percentage (handle 0+0 → "N/A")
    - Legend below with win/loss counts
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 6.2 Write property tests for donut and win rate (Properties 10, 11)
    - **Property 10: Donut Arc Proportions** — For any wins+losses > 0, arc angles are proportional to count/total, sum of arcs = 360° (±tolerance)
    - **Validates: Requirements 6.1**
    - **Property 11: Win Rate Percentage Computation** — For any wins+losses > 0, winRate = round(wins/(wins+losses)*100)
    - **Validates: Requirements 6.2, 6.3**

  - [x] 6.3 Implement PnLDistributionChart component
    - Create `apps/web/components/charts/PnLDistributionChart.tsx`
    - Accept `{ pnlValues, binCount?, height? }` props
    - SVG-based histogram using `binValues` utility
    - Green bars for positive midpoint bins, red for negative
    - X-axis shows P&L range labels, Y-axis shows trade count
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 6.4 Implement CumulativePnLChart component
    - Create `apps/web/components/charts/CumulativePnLChart.tsx`
    - Accept `{ trades: { date, pnl }[], height? }` props
    - Line chart with baseline series: green area above zero, red below
    - Display zero reference line
    - Show loading skeleton while data is loading
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 7. Implement Dashboard chart components
  - [x] 7.1 Implement PortfolioValueChart component
    - Create `apps/web/components/charts/PortfolioValueChart.tsx`
    - Accept `{ data: { date, value }[], height? }` props
    - Line chart for 30-day portfolio value
    - Tooltip on hover showing date and exact value
    - Show empty state when no data available
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 7.2 Implement DashboardSparkline component
    - Create `apps/web/components/charts/DashboardSparkline.tsx`
    - Accept `{ data: number[], width?, height? }` props
    - Minimal line chart: no axes, no grid, no crosshair via useChart options
    - Green line when last > first, red otherwise
    - Default 120×40px dimensions
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ]* 7.3 Write property test for trend direction color (Property 12)
    - **Property 12: Trend Direction Color Assignment** — For any array of ≥2 points, sparkline is green when last > first, red otherwise
    - **Validates: Requirements 10.4**

- [x] 8. Checkpoint - All chart components complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Integrate charts into pages
  - [x] 9.1 Integrate MarketFeedChart into /market-feed page
    - Import and render MarketFeedChart in the market-feed page layout
    - Wire selected instrument symbol from subscriptions table to chart prop
    - Connect existing Socket.IO market-feed connection for tick updates
    - Handle disconnection indicator state from existing WebSocket status
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 9.2 Integrate IntradayChart into /intraday page
    - Import and render IntradayChart below the analysis results
    - Pass OHLCV data from quant engine response and signal levels (entry, SL, target) from analysis
    - Re-render on REFRESH & ANALYZE action
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 9.3 Integrate SwingMiniChart into /swing page
    - Import and render SwingMiniChart for each candidate in scan results
    - Pass last 30 daily candles and signal levels per candidate
    - Wire onClick to select candidate and show detail view
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 9.4 Integrate EquityCurveChart and TradePnLChart into /paper-trading page
    - Import and render both charts in the Paper Trading page layout
    - Fetch closed trades from NestJS API, pass to both components
    - Wire trade type filter to re-render charts with filtered data
    - Handle empty state when no trades exist
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 9.5 Integrate Trade Coach charts into /trade-coach page
    - Import and render WinRateDonut, PnLDistributionChart, and CumulativePnLChart
    - Extract wins/losses, pnlValues, and cumulative data from coach API response
    - Show loading skeletons while analysis is in progress
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4_

  - [x] 9.6 Integrate PortfolioValueChart and DashboardSparkline into / (dashboard) page
    - Import and render PortfolioValueChart with 30-day history from paper trades API
    - Import and render DashboardSparkline in each metric card with last 7 data points
    - Handle empty states for both components
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 10.1, 10.2, 10.3, 10.4_

- [x] 10. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (12 properties using fast-check)
- Unit tests validate specific examples and edge cases
- All chart components go in `apps/web/components/charts/`
- Shared infrastructure lives in `apps/web/lib/charts/` and `apps/web/lib/hooks/`
- lightweight-charts v4.1.3 is already installed — no package installation needed
- Socket.IO connection for market-feed already exists on the page; just subscribe to events

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4", "1.5"] },
    { "id": 2, "tasks": ["3.1", "3.3", "4.1"] },
    { "id": 3, "tasks": ["3.2", "3.4", "4.2", "4.3"] },
    { "id": 4, "tasks": ["4.4", "6.1", "6.3", "6.4"] },
    { "id": 5, "tasks": ["6.2", "7.1", "7.2"] },
    { "id": 6, "tasks": ["7.3", "9.1", "9.2", "9.3"] },
    { "id": 7, "tasks": ["9.4", "9.5", "9.6"] }
  ]
}
```
