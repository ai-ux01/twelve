# Requirements Document

## Introduction

This feature adds trendline visualization across all analysis pages in the trading platform. It includes two capabilities: (1) displaying trendline metadata (status, breakout/breakdown detection, support/resistance info) in UI data panels on the Intraday, Swing Scanner, and Options Scalper pages, and (2) rendering diagonal support and resistance trendlines directly on price charts (IntradayChart and SwingMiniChart) using lightweight-charts line series.

The quant engine already computes trendline data (via `TrendlineService`) and the API already returns it in the `trendline` field of `QuantAnalysisResult`. This feature focuses purely on frontend visualization of that existing data.

## Glossary

- **Trendline_Panel**: A UI section within a data panel component that displays trendline metadata (direction, status, breakout info, confidence)
- **Trendline_Overlay**: A diagonal line drawn on a price chart representing a support or resistance trendline
- **IntradayDataPanel**: The component displaying technical indicators on the Intraday analysis page
- **SwingAnalysisPanel**: The component displaying technical analysis for swing trading candidates
- **SignalCard**: The component displaying the current trading signal on the Options Scalper page
- **IntradayChart**: The 5-minute candlestick chart component on the Intraday page
- **SwingMiniChart**: The compact candlestick chart component in the Swing Scanner
- **Trendline_Data**: The `trendline` field from API responses containing support_line, resistance_line, swing_points, breakout_status, direction, support_status, resistance_status, and confidence
- **Support_Trendline**: A diagonal line fitted to swing lows, representing dynamic support
- **Resistance_Trendline**: A diagonal line fitted to swing highs, representing dynamic resistance
- **Breakout_Status**: The current breakout state: NONE, BREAKOUT, BREAKDOWN, or CONFIRMED
- **Chart_API**: The lightweight-charts IChartApi instance used to render chart elements

## Requirements

### Requirement 1: Intraday Page Trendline Panel

**User Story:** As a trader viewing intraday analysis, I want to see trendline status information in the data panel, so that I can quickly assess the current trend direction and any breakout conditions.

#### Acceptance Criteria

1. WHEN Trendline_Data is available in the intraday analysis response, THE IntradayDataPanel SHALL display a "Trendlines" section after the Support & Resistance section
2. THE Trendline_Panel in IntradayDataPanel SHALL display the market direction (UPTREND, DOWNTREND, or SIDEWAYS)
3. THE Trendline_Panel in IntradayDataPanel SHALL display the support trendline status (ACTIVE, BROKEN, or RETESTING)
4. THE Trendline_Panel in IntradayDataPanel SHALL display the resistance trendline status (ACTIVE, BROKEN, or RETESTING)
5. THE Trendline_Panel in IntradayDataPanel SHALL display the Breakout_Status (NONE, BREAKOUT, BREAKDOWN, or CONFIRMED)
6. THE Trendline_Panel in IntradayDataPanel SHALL display the confidence score as a percentage with one decimal place
7. IF Trendline_Data is not available, THEN THE IntradayDataPanel SHALL display "No trendline data" in the Trendlines section
8. WHEN Breakout_Status is BREAKOUT or CONFIRMED, THE Trendline_Panel SHALL highlight the status with a green badge
9. WHEN Breakout_Status is BREAKDOWN, THE Trendline_Panel SHALL highlight the status with a red badge

### Requirement 2: Swing Scanner Trendline Panel

**User Story:** As a swing trader, I want to see trendline information for each candidate, so that I can evaluate trend strength and breakout potential alongside other scoring factors.

#### Acceptance Criteria

1. WHEN a SwingCandidate includes trendline data, THE SwingAnalysisPanel SHALL display a "Trendline Analysis" section after the Scoring Breakdown section
2. THE Trendline_Panel in SwingAnalysisPanel SHALL display the market direction
3. THE Trendline_Panel in SwingAnalysisPanel SHALL display the breakout status
4. THE Trendline_Panel in SwingAnalysisPanel SHALL display the confidence score as a percentage
5. THE Trendline_Panel in SwingAnalysisPanel SHALL display support and resistance trendline statuses
6. IF trendline data is not available for a candidate, THEN THE SwingAnalysisPanel SHALL omit the Trendline Analysis section

### Requirement 3: Options Scalper Trendline Display

**User Story:** As an options scalper, I want to see detailed trendline context alongside my trading signal, so that I can validate signal direction against the trendline structure.

#### Acceptance Criteria

1. WHEN trendline data is available in the scalper analysis, THE SignalCard SHALL display trendline direction alongside the existing trendlineStatus field
2. THE SignalCard SHALL display the support and resistance levels derived from trendlines when available
3. WHEN Breakout_Status is BREAKOUT or BREAKDOWN, THE SignalCard SHALL display a visual indicator highlighting the breakout condition
4. IF trendline data is not present, THEN THE SignalCard SHALL continue displaying "N/A" for trendline-related fields

### Requirement 4: Trendline Overlay on Intraday Chart

**User Story:** As a trader, I want to see diagonal support and resistance trendlines drawn on the intraday chart, so that I can visually identify trend boundaries and potential breakout points.

#### Acceptance Criteria

1. WHEN Trendline_Data contains a support_line, THE IntradayChart SHALL render a diagonal line series from the trendline start point to the end point in green color
2. WHEN Trendline_Data contains a resistance_line, THE IntradayChart SHALL render a diagonal line series from the trendline start point to the end point in red color
3. THE Trendline_Overlay SHALL use dashed line style to distinguish trendlines from price level overlays
4. THE IntradayChart SHALL compute trendline start and end prices using the formula: price = slope × bar_index + intercept, mapped to the corresponding timestamps in the OHLCV data
5. WHEN trendline data is updated, THE IntradayChart SHALL remove previous trendline overlays before rendering new ones
6. IF neither support_line nor resistance_line is present in Trendline_Data, THEN THE IntradayChart SHALL render without trendline overlays
7. THE IntradayChart SHALL include trendline entries in the chart legend showing "Support TL" and "Resistance TL" labels with their respective colors

### Requirement 5: Trendline Overlay on Swing Mini Chart

**User Story:** As a swing trader scanning candidates, I want to see trendlines drawn on the mini chart for each candidate, so that I can quickly assess trend structure visually without needing to open a detailed view.

#### Acceptance Criteria

1. WHEN Trendline_Data contains a support_line, THE SwingMiniChart SHALL render a diagonal line from trendline start to end in green color
2. WHEN Trendline_Data contains a resistance_line, THE SwingMiniChart SHALL render a diagonal line from trendline start to end in red color
3. THE Trendline_Overlay on SwingMiniChart SHALL use dashed line style
4. THE SwingMiniChart SHALL compute trendline prices using slope × bar_index + intercept formula mapped to OHLCV timestamps
5. WHEN trendline data is updated, THE SwingMiniChart SHALL remove previous trendline overlays before rendering new ones
6. IF trendline data is not available, THEN THE SwingMiniChart SHALL render without trendline overlays

### Requirement 6: Trendline Price Calculation Utility

**User Story:** As a developer, I want a reusable utility function to convert trendline slope/intercept data into chart-renderable line data points, so that all chart components compute trendline positions consistently.

#### Acceptance Criteria

1. THE chart-utils module SHALL export a function that accepts a trendline object (slope, intercept, start_point, end_point) and an array of OHLCV data, and returns an array of two LineData points for lightweight-charts
2. THE utility function SHALL map the start_point index to the corresponding OHLCV timestamp and compute the price as slope × start_index + intercept
3. THE utility function SHALL map the end_point index to the corresponding OHLCV timestamp and compute the price as slope × end_index + intercept
4. IF the start or end index exceeds the OHLCV data array bounds, THEN THE utility function SHALL clamp the index to the valid range
5. THE utility function SHALL return an empty array when the trendline parameter is null or undefined

### Requirement 7: Trendline Data Type Definitions

**User Story:** As a developer, I want TypeScript interfaces for trendline data that match the API response format, so that trendline visualization components have type-safe data contracts.

#### Acceptance Criteria

1. THE api-client module SHALL export a TrendlineData interface matching the API trendline field structure (support_line, resistance_line, swing_points, breakout_status, direction, support_status, resistance_status, confidence)
2. THE api-client module SHALL export a TrendlineLine interface with slope, intercept, and rSquared fields
3. THE IntradayDataPanel props interface SHALL accept an optional trendline field of type TrendlineData
4. THE SwingCandidate interface SHALL include an optional trendline field of type TrendlineData
5. THE IntradayChart props interface SHALL accept an optional trendlines prop containing support and resistance line data
6. THE SwingMiniChart props interface SHALL accept an optional trendlines prop containing support and resistance line data
