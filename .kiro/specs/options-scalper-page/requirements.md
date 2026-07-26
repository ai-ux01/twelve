# Requirements Document

## Introduction

The Options Scalper Page is a dedicated route (`/options-scalper`) in the ProfitTerminal Next.js web application that auto-generates NIFTY50 options scalping signals. The page fetches analysis data from the quant engine endpoint (`http://localhost:8000/api/options-scalper/analyze`), displays structured trading signals (Signal, Strike, Entry, Target, SL, R:R, Probability, Rationale), auto-refreshes every 60 seconds during Indian market hours (9:15 AM – 3:30 PM IST), and is accessible via the sidebar navigation.

## Glossary

- **Options_Scalper_Page**: The Next.js page component rendered at the `/options-scalper` route that displays options scalping signals
- **Quant_Engine**: The backend service at `http://localhost:8000/api/options-scalper/analyze` that performs options scalping analysis and returns structured signal data
- **Signal**: A trading recommendation with one of three values: BUY CE (buy call option), BUY PE (buy put option), or HOLD (no trade)
- **Strike**: The strike price of the recommended option contract
- **Entry**: The recommended entry price for the trade
- **Target**: The price target for profit booking
- **SL**: The stop-loss price to limit downside risk
- **R_R**: The risk-to-reward ratio calculated as (Target - Entry) / (Entry - SL)
- **Probability**: A numeric confidence score (0–100) indicating the likelihood of the signal succeeding
- **Rationale**: A text explanation of why the signal was generated, referencing technical indicators and market conditions
- **Market_Hours**: Indian equity market trading session from 9:15 AM to 3:30 PM IST (Indian Standard Time, UTC+5:30)
- **Auto_Refresh**: Automatic periodic re-fetching of analysis data at a fixed interval without manual user interaction
- **Sidebar_Navigation**: The persistent left-side navigation panel in the ProfitTerminal app layout that links to all major pages
- **Live_Status_Panel**: A header component that displays the current refresh state, countdown timer, and connection status

## Requirements

### Requirement 1: Display Options Scalping Signal Data

**User Story:** As a trader, I want to see structured options scalping signals on the page, so that I can quickly assess trade opportunities at a glance.

#### Acceptance Criteria

1. WHEN the Quant_Engine returns an analysis response, THE Options_Scalper_Page SHALL display the Signal field with one of three values: BUY CE, BUY PE, or HOLD
2. WHEN the Quant_Engine returns a BUY CE or BUY PE signal, THE Options_Scalper_Page SHALL display the Strike, Entry, Target, and SL values formatted to 2 decimal places with a ₹ currency prefix
3. WHEN the Quant_Engine returns a BUY CE or BUY PE signal, THE Options_Scalper_Page SHALL display the R_R in the format "1:X.X" where X.X is the reward multiple rounded to 1 decimal place
4. WHEN the Quant_Engine returns an analysis response, THE Options_Scalper_Page SHALL display the Probability as a percentage value between 0 and 100 rounded to 1 decimal place followed by a % symbol
5. WHEN the Quant_Engine returns an analysis response, THE Options_Scalper_Page SHALL display the Rationale as a non-empty text string explaining the signal reasoning
6. WHEN the Signal is HOLD, THE Options_Scalper_Page SHALL display a hold reason text in place of the Strike, Entry, Target, and SL fields
7. IF the Quant_Engine returns a response where any of Strike, Entry, Target, SL, Probability, or R_R fields are null or missing, THEN THE Options_Scalper_Page SHALL display "N/A" in place of the missing value
8. IF the Quant_Engine fails to return a response or returns an error, THEN THE Options_Scalper_Page SHALL display a waiting or error state indicator instead of signal data
9. WHEN the Quant_Engine returns a new analysis response, THE Options_Scalper_Page SHALL update the displayed signal data within 500 milliseconds of receiving the response

### Requirement 2: Auto-Refresh During Market Hours

**User Story:** As a trader, I want the page to automatically refresh signals every 60 seconds during market hours, so that I always see the latest analysis without manual intervention.

#### Acceptance Criteria

1. WHILE the current time is within Market_Hours (9:15 AM to 3:30 PM IST, Monday to Friday), THE Options_Scalper_Page SHALL send a POST request to the Quant_Engine every 60 seconds (±2 seconds tolerance), with a request timeout of 10 seconds
2. WHILE the current time is outside Market_Hours, THE Options_Scalper_Page SHALL pause Auto_Refresh and display the most recently received successful signal data
3. WHILE the current time is within Market_Hours, WHEN the Options_Scalper_Page completes loading, THE Options_Scalper_Page SHALL execute an initial analysis request within 1 second
4. WHILE Auto_Refresh is active, THE Live_Status_Panel SHALL display a countdown timer that updates every 1 second showing whole seconds remaining until the next refresh
5. WHILE the current time is outside Market_Hours, THE Live_Status_Panel SHALL display "Market Closed" status
6. IF a POST request to the Quant_Engine fails or times out, THEN THE Options_Scalper_Page SHALL retain the previously displayed signal data, display an error indication in the Live_Status_Panel, and retry on the next 60-second interval
7. IF a previous refresh request is still in-flight when the next 60-second interval elapses, THEN THE Options_Scalper_Page SHALL skip that interval and wait for the next scheduled refresh

### Requirement 3: Quant Engine API Integration

**User Story:** As a trader, I want the page to reliably communicate with the quant engine, so that I receive accurate and timely signal data.

#### Acceptance Criteria

1. WHEN the Options_Scalper_Page fetches analysis data, THE Options_Scalper_Page SHALL send a POST request to `http://localhost:8000/api/options-scalper/analyze` with a JSON body containing the underlying symbol, with a request timeout of 10 seconds
2. WHEN the Quant_Engine returns a successful response (HTTP 200), THE Options_Scalper_Page SHALL parse the JSON response, update all displayed signal fields within 1 second of response receipt, and reset the consecutive failure counter to zero
3. IF the Quant_Engine returns an error response (HTTP 4xx or 5xx), THEN THE Options_Scalper_Page SHALL display an error message in the status panel indicating the failure, retain the last successful signal data on screen, and increment the consecutive failure counter
4. IF the Quant_Engine is unreachable (no response received within the 10-second timeout or network error), THEN THE Options_Scalper_Page SHALL display a connection error status in the status panel, increment the consecutive failure counter, and retry on the next Auto_Refresh cycle
5. IF three consecutive API calls fail (due to HTTP error responses or network errors), THEN THE Options_Scalper_Page SHALL pause Auto_Refresh and display a persistent error notification that remains visible until the user manually triggers a refresh or re-enables Auto_Refresh

### Requirement 4: Sidebar Navigation Integration

**User Story:** As a user, I want to access the Options Scalper page from the sidebar navigation, so that I can reach it from anywhere in the application.

#### Acceptance Criteria

1. THE Sidebar_Navigation SHALL include a link labeled "Options Scalper" that navigates to the `/options-scalper` route when clicked
2. THE Sidebar_Navigation SHALL render the "Options Scalper" link with the same element type, font size, font weight, padding, border-radius, and hover behavior as all other navigation links in the sidebar
3. WHEN the user is on the `/options-scalper` route, THE Sidebar_Navigation SHALL apply a visually distinct background color to the "Options Scalper" link and set the `aria-current` attribute to `"page"` to indicate it is the active page
4. WHEN the user navigates away from the `/options-scalper` route, THE Sidebar_Navigation SHALL remove the active background color and `aria-current` attribute from the "Options Scalper" link

### Requirement 5: Page Visibility Handling

**User Story:** As a trader, I want the page to pause refreshing when I navigate away and resume when I return, so that unnecessary API calls are avoided.

#### Acceptance Criteria

1. WHEN the browser tab becomes hidden (document.visibilitychange event with visibilityState "hidden"), THE Options_Scalper_Page SHALL pause Auto_Refresh, stop sending new requests to the Quant_Engine, and allow any in-flight request to complete without processing its response into a new refresh cycle
2. WHILE Market_Hours (9:15 AM – 3:30 PM IST), WHEN the browser tab becomes visible (document.visibilitychange event with visibilityState "visible"), THE Options_Scalper_Page SHALL resume Auto_Refresh by executing an analysis request to the Quant_Engine within 1 second of the visibility change and restarting the 60-second polling interval from the time of that request
3. WHILE outside Market_Hours, WHEN the browser tab becomes visible (document.visibilitychange event with visibilityState "visible"), THE Options_Scalper_Page SHALL display the data from the last successful Quant_Engine response received before the tab was hidden, without resuming Auto_Refresh
4. IF the analysis request triggered on tab resume fails (network error or non-success response from Quant_Engine), THEN THE Options_Scalper_Page SHALL display the last successfully received data, show an error indication to the trader, and retry on the next 60-second polling cycle

### Requirement 6: Responsive Layout

**User Story:** As a trader, I want the page to be usable on different screen sizes, so that I can monitor signals on desktop, tablet, or mobile devices.

#### Acceptance Criteria

1. WHILE the viewport width is 1024px or greater, THE Options_Scalper_Page SHALL render signal components in a 3-column grid layout
2. WHILE the viewport width is between 768px and 1023px, THE Options_Scalper_Page SHALL render signal components in a two-column grid layout
3. WHILE the viewport width is less than 768px, THE Options_Scalper_Page SHALL render signal components in a single-column stacked layout
4. THE Options_Scalper_Page SHALL maintain minimum touch target sizes of 44x44 pixels for all interactive elements
5. THE Options_Scalper_Page SHALL display all signal card content (Signal, Strike, Entry, Target, SL, R:R, Probability, Rationale) without horizontal scrolling or content clipping at every breakpoint
6. WHEN the viewport width crosses a breakpoint boundary (768px or 1024px), THE Options_Scalper_Page SHALL re-render the grid layout within 1 second without content overlap or loss of visible signal data

### Requirement 7: Manual Refresh and Pause Controls

**User Story:** As a trader, I want to manually trigger a refresh or pause auto-refresh, so that I have control over when data is fetched.

#### Acceptance Criteria

1. WHEN the user clicks the refresh button, THE Options_Scalper_Page SHALL execute an analysis request within 1 second and reset the countdown timer to 60 seconds
2. WHEN the user clicks the refresh button while Auto_Refresh is paused, THE Options_Scalper_Page SHALL execute an analysis request within 1 second and remain in the paused state without restarting Auto_Refresh
3. WHEN the user toggles the pause control, THE Options_Scalper_Page SHALL stop Auto_Refresh, stop the countdown timer, and display "Paused" status in the live status panel
4. WHILE Market_Hours, WHEN the user resumes from paused state, THE Options_Scalper_Page SHALL restart Auto_Refresh with an analysis request executed within 1 second and reset the countdown timer to 60 seconds
5. IF the user resumes from paused state outside Market_Hours, THEN THE Options_Scalper_Page SHALL remain in the paused state and display a status message indicating that auto-refresh is only available during market hours
