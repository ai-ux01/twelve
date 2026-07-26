# Implementation Plan: Options Scalper Page

## Overview

This implementation plan builds the Options Scalper Page as a real-time trading signal dashboard at `/options-scalper` in the Next.js web app. The approach: create pure utility functions and the custom polling hook first, then wire existing UI components together on the page, then add sidebar navigation active state. TypeScript with fast-check for property-based testing.

## Tasks

- [x] 1. Create utility functions and types
  - [x] 1.1 Create data model interfaces and type definitions
    - Create `apps/web/lib/options-scalper/types.ts`
    - Define `AnalysisResult` interface with all fields from the quant engine response
    - Define `AnalyzeRequest` interface with `underlying` field
    - Define `PollingState` interface with `isPaused`, `isInFlight`, `consecutiveFailures`, `lastSuccessfulData`, `secondsRemaining`, `status`
    - Define `UseOptionsScalperPollingOptions` and `UseOptionsScalperPollingResult` interfaces
    - _Requirements: 1.1, 3.1, 3.2_

  - [x] 1.2 Implement formatting utility functions
    - Create `apps/web/lib/options-scalper/formatters.ts`
    - Implement `formatPrice(value: number | null): string` — returns `₹X.XX` for valid numbers, `"N/A"` for null
    - Implement `formatRiskReward(value: number | null): string` — returns `"1:X.X"` for valid numbers, `"N/A"` for null
    - Implement `formatProbability(value: number | null): string` — returns `"X.X%"` for values in [0, 100], `"N/A"` for null
    - Implement `formatCountdown(seconds: number): string` — returns `"M:SS"` format
    - _Requirements: 1.2, 1.3, 1.4, 1.7_

  - [x] 1.3 Implement market hours utility function
    - Create `apps/web/lib/options-scalper/market-hours.ts`
    - Implement `isMarketHours(date: Date): boolean` — returns true if Mon–Fri and IST time is between 09:15:00 (inclusive) and 15:30:00 (inclusive)
    - Handle IST timezone conversion (UTC+5:30)
    - _Requirements: 2.1, 2.2, 2.5_

  - [ ]* 1.4 Write property tests for formatting functions (fast-check)
    - **Property 1: Formatting functions produce correctly structured output**
    - **Property 2: Null inputs produce "N/A" display**
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.7**

  - [ ]* 1.5 Write property test for market hours classification (fast-check)
    - **Property 3: Market hours classification is correct for any timestamp**
    - **Validates: Requirements 2.1, 2.2, 2.5**

  - [ ]* 1.6 Write property test for countdown formatting (fast-check)
    - **Property 4: Countdown timer formatting is correct**
    - **Validates: Requirements 2.4**

- [x] 2. Implement the useOptionsScalperPolling custom hook
  - [x] 2.1 Implement core polling logic with circuit breaker
    - Create `apps/web/hooks/use-options-scalper-polling.ts`
    - Implement `useOptionsScalperPolling(options: UseOptionsScalperPollingOptions): UseOptionsScalperPollingResult`
    - Send POST request to `apiUrl` with `{ underlying }` JSON body and 10s timeout
    - On success: update data, reset countdown to `refreshIntervalSeconds`, reset `consecutiveFailures` to 0
    - On failure: retain last successful data, increment `consecutiveFailures`, show error
    - After 3 consecutive failures: trip circuit breaker, set status to `'error'`, pause auto-refresh
    - Implement countdown timer that ticks every 1 second
    - Skip fetch if previous request is still in-flight
    - Check `isMarketHours()` before scheduling — set status to `'market-closed'` when outside hours
    - Trigger initial fetch immediately on mount during market hours
    - _Requirements: 2.1, 2.3, 2.4, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 2.2 Implement page visibility handling in the hook
    - Listen for `document.visibilitychange` events
    - On hidden: pause polling, stop scheduling new requests, allow in-flight to complete
    - On visible + market hours: resume polling with immediate fetch, restart countdown
    - On visible + outside market hours: remain paused, display last data
    - If resume fetch fails: show error, retain last data, retry on next cycle
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 2.3 Implement manual refresh and pause controls
    - `refreshNow()`: trigger immediate fetch, reset countdown to 60s; if paused, fetch but remain paused
    - `togglePause(paused)`: when pausing — stop timer, set status `'paused'`; when resuming during market hours — restart with immediate fetch; when resuming outside market hours — remain paused with message
    - Manual refresh success resets circuit breaker
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 2.4 Write property test for circuit breaker behavior (fast-check)
    - **Property 5: Circuit breaker trips after exactly 3 consecutive failures**
    - **Validates: Requirements 3.5**

  - [ ]* 2.5 Write unit tests for useOptionsScalperPolling hook
    - Test initial fetch on mount during market hours
    - Test 60-second polling cycle with mocked timers
    - Test circuit breaker trips after 3 failures
    - Test circuit breaker resets on success
    - Test manual refresh resets countdown
    - Test pause/resume toggle
    - Test visibility change pause/resume
    - Test skip fetch when in-flight
    - Test market-closed status outside hours
    - _Requirements: 2.1, 2.3, 2.4, 2.6, 2.7, 3.2, 3.3, 3.4, 3.5, 5.1, 5.2, 7.1, 7.3, 7.4_

- [x] 3. Checkpoint - Ensure all utility and hook tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Wire page component with polling hook and UI components
  - [x] 4.1 Integrate useOptionsScalperPolling hook into the page component
    - Update `apps/web/app/options-scalper/page.tsx` to use the `useOptionsScalperPolling` hook
    - Configure hook with: `underlying: 'NIFTY'`, `refreshIntervalSeconds: 60`, `apiUrl: 'http://localhost:8000/api/options-scalper/analyze'`, `requestTimeoutMs: 10000`
    - Pass hook result data to existing sub-components: `LiveStatusPanel`, `SignalCard`, `TradeDetailsCard`, `ProbabilityGauge`, `MarketAnalysisPanel`, `RationalePanel`, `ActionButtons`
    - Display "Waiting for analysis..." when data is null
    - Display hold reason when signal is HOLD (hide Strike, Entry, Target, SL)
    - Use formatting utilities for all displayed values
    - Ensure data updates display within 500ms of response
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.3, 2.4_

  - [x] 4.2 Implement responsive grid layout
    - Apply Tailwind CSS grid classes to the page layout
    - 3-column grid at viewport ≥ 1024px (`lg:grid-cols-3`)
    - 2-column grid at viewport 768px–1023px (`md:grid-cols-2`)
    - 1-column stacked at viewport < 768px (default)
    - Ensure all signal card content displays without horizontal scroll or clipping
    - Ensure all interactive elements have minimum 44x44px touch targets
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 4.3 Write unit tests for page component rendering
    - Test page renders signal data from hook
    - Test HOLD state hides trade fields, shows hold reason
    - Test null data shows waiting state
    - Test error state shows error indicator
    - Test responsive grid classes at each breakpoint
    - _Requirements: 1.1, 1.5, 1.6, 1.8, 6.1, 6.2, 6.3_

- [x] 5. Implement sidebar navigation active state
  - [x] 5.1 Add active state styling to sidebar navigation
    - Update `apps/web/app/layout.tsx` (or sidebar component)
    - Use `usePathname()` from `next/navigation` to detect current route
    - When pathname is `/options-scalper`: apply `bg-accent text-accent-foreground` and `aria-current="page"` to the Options Scalper link
    - When navigating away: remove active styling and `aria-current` attribute
    - Ensure link matches existing sidebar link styling (element type, font, padding, border-radius, hover)
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 5.2 Write unit tests for sidebar active state
    - Test `aria-current="page"` is set when on `/options-scalper`
    - Test active background class applied on `/options-scalper`
    - Test no active state on other routes
    - _Requirements: 4.3, 4.4_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after utilities/hook (task 3) and full integration (task 6)
- Property tests validate universal correctness properties from the design document using fast-check
- Unit tests validate specific examples and edge cases
- Existing UI components (SignalCard, TradeDetailsCard, etc.) are already implemented — this plan focuses on the polling logic, utilities, page wiring, and navigation integration
- The page component at `apps/web/app/options-scalper/page.tsx` already exists and needs to be updated, not created from scratch

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "1.5", "1.6", "2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3"] },
    { "id": 4, "tasks": ["2.4", "2.5"] },
    { "id": 5, "tasks": ["4.1", "5.1"] },
    { "id": 6, "tasks": ["4.2"] },
    { "id": 7, "tasks": ["4.3", "5.2"] }
  ]
}
```
