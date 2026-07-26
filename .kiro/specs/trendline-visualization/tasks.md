# Implementation Plan: Trendline Visualization

## Overview

This plan implements trendline visualization across the trading platform frontend. It covers TypeScript type definitions, a shared utility function for computing trendline chart points, panel sections for displaying trendline metadata, and chart overlays for rendering diagonal support/resistance lines. The implementation follows a bottom-up approach: types → utility → panels → charts → wiring.

## Tasks

- [x] 1. Define TypeScript interfaces and install dependencies
  - [x] 1.1 Add TrendlineData, TrendlineLine, and SwingPoint interfaces to api-client.ts
    - Add `TrendlineData` interface with fields: support_line, resistance_line, swing_points, breakout_status, direction, support_status, resistance_status, confidence
    - Add `TrendlineLine` interface with fields: slope, intercept, r_squared, start_point, end_point
    - Add `SwingPoint` interface with fields: index, price, type
    - Extend `SwingCandidate` interface with optional `trendline?: TrendlineData` field
    - _Requirements: 7.1, 7.2, 7.4_

  - [x] 1.2 Install fast-check as a dev dependency
    - Run `npm install --save-dev fast-check` in apps/web
    - _Requirements: Supporting task for property-based testing_

- [x] 2. Implement computeTrendlinePoints utility function
  - [x] 2.1 Create computeTrendlinePoints in chart-utils.ts
    - Add the `computeTrendlinePoints(trendline: TrendlineLine | null | undefined, ohlcvData: OHLCVData[]): LineData[]` function
    - Return empty array for null/undefined trendline or empty OHLCV data
    - Clamp start_point and end_point to valid range [0, ohlcvData.length - 1]
    - Compute price as `slope × clamped_index + intercept`
    - Map each index to corresponding `ohlcvData[index].timestamp` converted to UTCTimestamp
    - Return exactly 2 LineData points (start and end)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x]* 2.2 Write property test: Linear Price Computation (Property 1)
    - **Property 1: Linear Price Computation**
    - **Validates: Requirements 4.4, 5.4, 6.2, 6.3**
    - Generate random `{slope, intercept, start_point, end_point}` and random OHLCV arrays
    - Verify output prices match `slope × index + intercept` for both start and end points

  - [x]* 2.3 Write property test: Output Structure Invariant (Property 2)
    - **Property 2: Output Structure Invariant**
    - **Validates: Requirements 6.1**
    - Generate random valid trendline inputs and non-empty OHLCV arrays
    - Verify output is always exactly 2 LineData points with numeric `time` and `value` fields

  - [x]* 2.4 Write property test: Index Clamping (Property 3)
    - **Property 3: Index Clamping**
    - **Validates: Requirements 6.4**
    - Generate trendlines with out-of-bounds start_point or end_point (negative or >= array length)
    - Verify indices are clamped to valid range and price uses clamped index in the formula

  - [x]* 2.5 Write property test: Null Trendline Returns Empty (Property 4)
    - **Property 4: Null Trendline Returns Empty**
    - **Validates: Requirements 6.5**
    - Pass null/undefined trendline with arbitrary OHLCV data
    - Verify empty array is always returned

- [x] 3. Checkpoint - Verify utility function and property tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement trendline panel in IntradayDataPanel
  - [x] 4.1 Add trendline section to IntradayDataPanel component
    - Add optional `trendline?: TrendlineData` prop to component props
    - Render a "Trendlines" section after the existing Support & Resistance section
    - Display direction (UPTREND/DOWNTREND/SIDEWAYS), support status, resistance status, breakout status, and confidence as percentage (1 decimal place)
    - Show green badge for BREAKOUT/CONFIRMED breakout status, red badge for BREAKDOWN
    - Display "No trendline data" when trendline prop is not provided
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 7.3_

  - [ ]* 4.2 Write unit tests for IntradayDataPanel trendline section
    - Test "Trendlines" section renders with correct data when trendline prop is provided
    - Test badge colors for breakout statuses (green for BREAKOUT/CONFIRMED, red for BREAKDOWN)
    - Test "No trendline data" fallback when trendline prop is undefined
    - _Requirements: 1.1, 1.7, 1.8, 1.9_

- [x] 5. Implement trendline panel in SwingAnalysisPanel
  - [x] 5.1 Add trendline analysis section to SwingAnalysisPanel component
    - Add optional `trendline?: TrendlineData` prop to component props
    - Render a "Trendline Analysis" section after the Scoring Breakdown section
    - Display direction, breakout status, confidence percentage, support status, resistance status
    - Omit the section entirely when trendline data is not available
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 5.2 Write unit tests for SwingAnalysisPanel trendline section
    - Test "Trendline Analysis" section renders when trendline data is present
    - Test section is omitted when trendline data is not available
    - Test all fields display correctly (direction, breakout, confidence, statuses)
    - _Requirements: 2.1, 2.6_

- [x] 6. Implement trendline display in SignalCard
  - [x] 6.1 Extend SignalCard to display trendline context
    - Add trendline direction and breakout indicator to the existing SignalData interface
    - Display trendline direction alongside existing trendlineStatus field
    - Show visual indicator (badge/icon) highlighting breakout/breakdown condition
    - Display "N/A" for trendline-related fields when data is not present
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 6.2 Write unit tests for SignalCard trendline display
    - Test trendline direction renders when data is available
    - Test breakout/breakdown visual indicator appears correctly
    - Test "N/A" fallback when trendline data is missing
    - _Requirements: 3.1, 3.3, 3.4_

- [x] 7. Checkpoint - Verify all panel components
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement trendline overlays on IntradayChart
  - [x] 8.1 Add trendline line series overlays to IntradayChart
    - Add optional `trendlines?: { support?: TrendlineLine; resistance?: TrendlineLine }` prop
    - Use `computeTrendlinePoints()` to convert trendline data into LineData points
    - Render support trendline as green dashed LineSeries (color: #26a69a, lineStyle: 2, lineWidth: 2)
    - Render resistance trendline as red dashed LineSeries (color: #ef5350, lineStyle: 2, lineWidth: 2)
    - Remove previous trendline series via `chart.removeSeries()` before adding new ones on re-render
    - Guard rendering with `isReady` check to ensure chart is initialized
    - Add "Support TL" and "Resistance TL" entries to the chart legend
    - Skip rendering if neither support nor resistance line is present
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 7.5_

  - [ ]* 8.2 Write unit tests for IntradayChart trendline overlays
    - Test that line series are added with correct colors and dashed style when trendline props are provided
    - Test that trendline series are removed on update before new ones are added
    - Test legend entries appear for "Support TL" and "Resistance TL"
    - Test chart renders without overlays when trendline data is not provided
    - _Requirements: 4.1, 4.5, 4.6, 4.7_

- [x] 9. Implement trendline overlays on SwingMiniChart
  - [x] 9.1 Add trendline line series overlays to SwingMiniChart
    - Add optional `trendlines?: { support?: TrendlineLine; resistance?: TrendlineLine }` prop
    - Use `computeTrendlinePoints()` to convert trendline data into LineData points
    - Render support trendline as green dashed LineSeries (color: #26a69a, lineStyle: 2, lineWidth: 2)
    - Render resistance trendline as red dashed LineSeries (color: #ef5350, lineStyle: 2, lineWidth: 2)
    - Remove previous trendline series before adding new ones on re-render
    - Guard rendering with chart readiness check
    - Skip rendering if trendline data is not available
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 7.6_

  - [ ]* 9.2 Write unit tests for SwingMiniChart trendline overlays
    - Test line series are added with correct colors and dashed style
    - Test trendline series are removed on update
    - Test chart renders without overlays when trendline data is not available
    - _Requirements: 5.1, 5.5, 5.6_

- [ ] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using fast-check + vitest
- Unit tests validate specific examples and edge cases using @testing-library/react
- The `computeTrendlinePoints` utility is the only logic with property-based tests; UI components use example-based unit tests
- All chart constants (colors, line styles) match the existing project theme

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "4.1", "5.1", "6.1"] },
    { "id": 3, "tasks": ["4.2", "5.2", "6.2", "8.1", "9.1"] },
    { "id": 4, "tasks": ["8.2", "9.2"] }
  ]
}
```
