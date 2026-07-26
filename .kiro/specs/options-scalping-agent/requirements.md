# Requirements Document

## Introduction

This document specifies the requirements for an AI-powered options scalping agent that automatically analyzes NIFTY50 and BANKNIFTY options contracts every 1 minute and provides actionable BUY/SELL/HOLD signals. This is the only module in the system with automatic refresh capability, designed specifically for high-frequency intraday options scalping with strict probability and risk/reward thresholds.

The agent integrates with existing options chain fetching (Phase 8), intraday analysis (Phase 7), and paper trading functionality while adding auto-refresh, AI-powered decision making, and scalping-specific signal generation rules.

## Glossary

- **Scalping_Agent**: The AI-powered system that analyzes market data and generates options trading signals
- **Auto_Refresh_System**: The subsystem that fetches and analyzes market data every 60 seconds
- **Signal_Generator**: The component that produces BUY/SELL/HOLD recommendations
- **Options_Chain**: Complete list of all available options contracts (strikes and expirations) for an underlying
- **Market_Data_Fetcher**: The component that retrieves spot prices, OHLCV data, and options chain data
- **Technical_Analyzer**: The component that calculates technical indicators (VWAP, EMA, RSI, MACD, ATR, Volume)
- **Options_Analyzer**: The component that analyzes options-specific metrics (OI, PCR, IV, liquidity)
- **AI_Analysis_Engine**: The AI component that evaluates all data and generates trading recommendations
- **UI_Dashboard**: The frontend interface that displays signals, market analysis, and controls
- **Probability_Threshold**: Minimum confidence level (70%) required for BUY signal generation
- **Risk_Reward_Ratio**: Minimum R:R ratio (1:2) required for BUY signal generation
- **Stale_Data**: Market data older than 2 minutes
- **Live_Indicator**: UI element showing real-time system status
- **Paper_Trading_System**: The existing simulated trading functionality for testing signals
- **CE**: Call Option (right to buy)
- **PE**: Put Option (right to sell)
- **OI**: Open Interest (number of outstanding contracts)
- **PCR**: Put-Call Ratio (Put OI / Call OI)
- **IV**: Implied Volatility (market's forecast of price movement)
- **ATM**: At-The-Money (strike price nearest to spot price)
- **Bid_Ask_Spread**: Difference between highest buy price and lowest sell price
- **VWAP**: Volume-Weighted Average Price
- **EMA**: Exponential Moving Average
- **RSI**: Relative Strength Index
- **MACD**: Moving Average Convergence Divergence
- **ATR**: Average True Range
- **OHLCV**: Open, High, Low, Close, Volume data

## Requirements

### Requirement 1: Auto-Refresh System Initialization

**User Story:** As a scalping trader, I want the system to automatically refresh market data every 1 minute, so that I always see the latest trading opportunities without manual intervention.

#### Acceptance Criteria

1. WHEN the user navigates to the options scalper page, THE Auto_Refresh_System SHALL initiate a 60-second refresh cycle
2. WHEN the Auto_Refresh_System initiates a cycle, THE Market_Data_Fetcher SHALL retrieve all required market data
3. WHEN a refresh cycle completes, THE Auto_Refresh_System SHALL schedule the next cycle in exactly 60 seconds
4. WHEN the user navigates away from the options scalper page, THE Auto_Refresh_System SHALL pause all refresh cycles
5. WHEN the user returns to the options scalper page, THE Auto_Refresh_System SHALL resume refresh cycles from the last known state

### Requirement 2: Manual Refresh Controls

**User Story:** As a scalping trader, I want to manually trigger data refresh and pause auto-refresh, so that I can control data updates when needed.

#### Acceptance Criteria

1. THE UI_Dashboard SHALL display a "REFRESH NOW" button
2. WHEN the user clicks "REFRESH NOW", THE Market_Data_Fetcher SHALL immediately fetch all market data regardless of the refresh cycle
3. THE UI_Dashboard SHALL display a "PAUSE AUTO REFRESH" toggle button
4. WHEN the user enables "PAUSE AUTO REFRESH", THE Auto_Refresh_System SHALL stop all automatic refresh cycles
5. WHEN the user disables "PAUSE AUTO REFRESH", THE Auto_Refresh_System SHALL resume automatic refresh cycles within 60 seconds
6. WHILE auto-refresh is paused, THE UI_Dashboard SHALL display a visible "PAUSED" indicator

### Requirement 3: Live Status Display

**User Story:** As a scalping trader, I want to see real-time system status including last update time and next refresh countdown, so that I know the freshness of displayed data.

#### Acceptance Criteria

1. THE UI_Dashboard SHALL display a green pulsing dot as a Live_Indicator when auto-refresh is active
2. THE UI_Dashboard SHALL display a "Last Updated" timestamp showing when data was last fetched
3. THE UI_Dashboard SHALL display a countdown timer showing seconds until next refresh
4. WHEN auto-refresh is paused, THE Live_Indicator SHALL change to gray and stop pulsing
5. WHEN data fetch fails, THE Live_Indicator SHALL change to red and display an error indicator
6. THE UI_Dashboard SHALL update the countdown timer every second

### Requirement 4: Market Data Collection

**User Story:** As a scalping trader, I want the system to collect comprehensive market data including spot prices, technical indicators, and options chain data, so that the AI can make informed trading decisions.

#### Acceptance Criteria

1. WHEN a refresh cycle executes, THE Market_Data_Fetcher SHALL retrieve the current NIFTY50 spot price
2. WHEN a refresh cycle executes, THE Market_Data_Fetcher SHALL retrieve the current BANKNIFTY spot price
3. WHEN a refresh cycle executes, THE Market_Data_Fetcher SHALL retrieve 1-minute OHLCV data for the selected underlying
4. WHEN a refresh cycle executes, THE Market_Data_Fetcher SHALL retrieve the complete options chain including all strikes and expirations
5. WHEN a refresh cycle executes, THE Market_Data_Fetcher SHALL retrieve bid price, ask price, last traded price, volume, and open interest for each options contract
6. WHEN a refresh cycle executes, THE Market_Data_Fetcher SHALL validate that all retrieved data has a timestamp within the last 2 minutes
7. IF any retrieved data has a timestamp older than 2 minutes, THEN THE Market_Data_Fetcher SHALL reject the data as stale

### Requirement 5: Technical Indicators Calculation

**User Story:** As a scalping trader, I want the system to calculate key technical indicators, so that trend and momentum analysis can be performed.

#### Acceptance Criteria

1. WHEN market data is retrieved, THE Technical_Analyzer SHALL calculate VWAP for the current trading session
2. WHEN market data is retrieved, THE Technical_Analyzer SHALL calculate 5-period EMA
3. WHEN market data is retrieved, THE Technical_Analyzer SHALL calculate 15-period EMA
4. WHEN market data is retrieved, THE Technical_Analyzer SHALL calculate 14-period RSI
5. WHEN market data is retrieved, THE Technical_Analyzer SHALL calculate MACD (12, 26, 9)
6. WHEN market data is retrieved, THE Technical_Analyzer SHALL calculate 14-period ATR
7. WHEN market data is retrieved, THE Technical_Analyzer SHALL calculate current volume and compare to average volume

### Requirement 6: Support and Resistance Analysis

**User Story:** As a scalping trader, I want the system to identify support and resistance levels and trendlines, so that key price levels are considered in trading decisions.

#### Acceptance Criteria

1. WHEN market data is retrieved, THE Technical_Analyzer SHALL identify the nearest support level below current price
2. WHEN market data is retrieved, THE Technical_Analyzer SHALL identify the nearest resistance level above current price
3. WHEN market data is retrieved, THE Technical_Analyzer SHALL detect active trendlines using swing high and swing low points
4. WHEN market data is retrieved, THE Technical_Analyzer SHALL classify trendline status as "Bullish", "Bearish", or "Neutral"
5. WHEN market data is retrieved, THE Technical_Analyzer SHALL calculate the distance from current price to support level
6. WHEN market data is retrieved, THE Technical_Analyzer SHALL calculate the distance from current price to resistance level

### Requirement 7: Options Chain Analysis

**User Story:** As a scalping trader, I want the system to analyze options chain metrics including open interest, PCR, and implied volatility, so that options-specific sentiment indicators are available.

#### Acceptance Criteria

1. WHEN options chain data is retrieved, THE Options_Analyzer SHALL calculate total Call open interest
2. WHEN options chain data is retrieved, THE Options_Analyzer SHALL calculate total Put open interest
3. WHEN options chain data is retrieved, THE Options_Analyzer SHALL calculate change in Call OI from previous refresh
4. WHEN options chain data is retrieved, THE Options_Analyzer SHALL calculate change in Put OI from previous refresh
5. WHEN options chain data is retrieved, THE Options_Analyzer SHALL calculate Put-Call Ratio (PCR)
6. WHEN options chain data is retrieved, THE Options_Analyzer SHALL identify contracts with highest Call OI buildup
7. WHEN options chain data is retrieved, THE Options_Analyzer SHALL identify contracts with highest Put OI buildup
8. WHEN options chain data is retrieved, THE Options_Analyzer SHALL calculate implied volatility for ATM options contracts

### Requirement 8: Liquidity Validation

**User Story:** As a scalping trader, I want the system to validate options contract liquidity before recommending trades, so that I only receive signals for tradeable contracts.

#### Acceptance Criteria

1. WHEN analyzing an options contract, THE Options_Analyzer SHALL calculate the bid-ask spread
2. WHEN analyzing an options contract, THE Options_Analyzer SHALL calculate the spread percentage as (spread / mid-price) × 100
3. WHEN analyzing an options contract, THE Options_Analyzer SHALL verify that trading volume is greater than zero
4. WHEN analyzing an options contract, THE Options_Analyzer SHALL verify that open interest is greater than 100 contracts
5. IF an options contract has a spread percentage greater than 5%, THEN THE Options_Analyzer SHALL mark it as illiquid
6. IF an options contract has zero volume or OI less than 100, THEN THE Options_Analyzer SHALL mark it as illiquid

### Requirement 9: AI Analysis Execution

**User Story:** As a scalping trader, I want an AI to analyze all collected market data and provide expert trading recommendations, so that I receive intelligent signal generation based on comprehensive analysis.

#### Acceptance Criteria

1. WHEN all market data and indicators are collected, THE AI_Analysis_Engine SHALL receive the complete data package
2. WHEN analyzing data, THE AI_Analysis_Engine SHALL evaluate price action patterns
3. WHEN analyzing data, THE AI_Analysis_Engine SHALL evaluate trend direction and strength
4. WHEN analyzing data, THE AI_Analysis_Engine SHALL evaluate all technical indicators (VWAP, EMA, RSI, MACD, ATR, Volume)
5. WHEN analyzing data, THE AI_Analysis_Engine SHALL evaluate options chain metrics (OI, PCR, IV)
6. WHEN analyzing data, THE AI_Analysis_Engine SHALL evaluate support and resistance levels
7. WHEN analyzing data, THE AI_Analysis_Engine SHALL evaluate trendline status
8. WHEN analyzing data, THE AI_Analysis_Engine SHALL interpret open interest changes as bullish, bearish, or neutral signals
9. WHEN analyzing data, THE AI_Analysis_Engine SHALL act as an elite intraday options scalper persona
10. WHEN analysis is complete, THE AI_Analysis_Engine SHALL output a structured trading recommendation

### Requirement 10: Signal Generation with Probability and Risk/Reward

**User Story:** As a scalping trader, I want the system to generate BUY signals only when probability is at least 70% and risk/reward ratio is at least 1:2, so that I receive high-quality trading opportunities.

#### Acceptance Criteria

1. WHEN AI analysis completes, THE Signal_Generator SHALL calculate a probability percentage for the trade setup
2. WHEN AI analysis completes, THE Signal_Generator SHALL calculate entry price, target price, and stop loss price
3. WHEN AI analysis completes, THE Signal_Generator SHALL calculate risk/reward ratio as (Target - Entry) / (Entry - Stop Loss)
4. IF probability is greater than or equal to 70% AND risk/reward ratio is greater than or equal to 1:2, THEN THE Signal_Generator SHALL generate a BUY signal
5. IF probability is less than 70% OR risk/reward ratio is less than 1:2, THEN THE Signal_Generator SHALL generate a HOLD signal
6. WHEN generating a BUY signal, THE Signal_Generator SHALL specify whether it is BUY CE or BUY PE
7. WHEN generating a BUY signal, THE Signal_Generator SHALL include the specific strike price and expiry date

### Requirement 11: Contract Selection Criteria

**User Story:** As a scalping trader, I want the system to prefer ATM or near-ATM highly liquid contracts, so that recommended trades are executable with minimal slippage.

#### Acceptance Criteria

1. WHEN selecting a contract for BUY signal, THE Signal_Generator SHALL prioritize ATM contracts (strike nearest to spot price)
2. WHEN selecting a contract for BUY signal, THE Signal_Generator SHALL prioritize contracts within 2 strikes of ATM
3. WHEN selecting a contract for BUY signal, THE Signal_Generator SHALL prioritize contracts with spread percentage less than 5%
4. WHEN selecting a contract for BUY signal, THE Signal_Generator SHALL prioritize contracts with open interest greater than 1000
5. WHEN selecting a contract for BUY signal, THE Signal_Generator SHALL prioritize contracts with volume greater than 500
6. WHEN selecting a contract for BUY signal, THE Signal_Generator SHALL verify implied volatility is less than 100%
7. IF no contracts meet all criteria, THEN THE Signal_Generator SHALL generate a HOLD signal

### Requirement 12: Safety Controls for Signal Generation

**User Story:** As a scalping trader, I want the system to enforce safety controls that prevent signal generation under adverse conditions, so that I avoid trading in risky scenarios.

#### Acceptance Criteria

1. IF market data timestamp is older than 2 minutes, THEN THE Signal_Generator SHALL generate a HOLD signal with reason "Stale Data"
2. IF current time is outside market hours (9:15 AM - 3:30 PM IST on trading days), THEN THE Signal_Generator SHALL generate a HOLD signal with reason "Market Closed"
3. IF implied volatility for the selected contract exceeds 100%, THEN THE Signal_Generator SHALL generate a HOLD signal with reason "Extreme IV"
4. IF bid-ask spread percentage exceeds 5%, THEN THE Signal_Generator SHALL generate a HOLD signal with reason "Poor Liquidity"
5. IF any required market data is missing or null, THEN THE Signal_Generator SHALL generate a HOLD signal with reason "Incomplete Data"
6. IF probability is less than 70%, THEN THE Signal_Generator SHALL generate a HOLD signal with reason "Low Probability"
7. IF risk/reward ratio is less than 1:2, THEN THE Signal_Generator SHALL generate a HOLD signal with reason "Insufficient R:R"

### Requirement 13: Signal Display Format

**User Story:** As a scalping trader, I want to see clear and comprehensive signal details including entry, target, stop loss, and rationale, so that I can make informed trading decisions.

#### Acceptance Criteria

1. THE UI_Dashboard SHALL display the current signal as "BUY CE", "BUY PE", or "HOLD" in large prominent text
2. WHEN the signal is BUY, THE UI_Dashboard SHALL display the strike price
3. WHEN the signal is BUY, THE UI_Dashboard SHALL display the expiry date
4. WHEN the signal is BUY, THE UI_Dashboard SHALL display the entry price
5. WHEN the signal is BUY, THE UI_Dashboard SHALL display the target price
6. WHEN the signal is BUY, THE UI_Dashboard SHALL display the stop loss price
7. WHEN the signal is BUY or HOLD, THE UI_Dashboard SHALL display the probability percentage
8. WHEN the signal is BUY or HOLD, THE UI_Dashboard SHALL display the risk/reward ratio
9. THE UI_Dashboard SHALL display the current trend classification (Bullish, Bearish, Neutral)
10. THE UI_Dashboard SHALL display the OI interpretation (Bullish, Bearish, Neutral)
11. THE UI_Dashboard SHALL display the current PCR value
12. THE UI_Dashboard SHALL display the trendline status
13. THE UI_Dashboard SHALL display the support level
14. THE UI_Dashboard SHALL display the resistance level
15. THE UI_Dashboard SHALL display detailed AI rationale explaining the signal decision

### Requirement 14: Probability Gauge Visualization

**User Story:** As a scalping trader, I want to see a visual probability gauge, so that I can quickly assess signal confidence.

#### Acceptance Criteria

1. THE UI_Dashboard SHALL display a probability gauge showing percentage from 0% to 100%
2. WHEN probability is less than 50%, THE probability gauge SHALL display red color
3. WHEN probability is between 50% and 70%, THE probability gauge SHALL display yellow color
4. WHEN probability is greater than or equal to 70%, THE probability gauge SHALL display green color
5. THE probability gauge SHALL update immediately when new analysis completes

### Requirement 15: Trade Details Card Display

**User Story:** As a scalping trader, I want to see all trade parameters in a clear card format, so that I can quickly review entry, exit, and risk management details.

#### Acceptance Criteria

1. WHEN signal is BUY, THE UI_Dashboard SHALL display a trade details card
2. THE trade details card SHALL contain the underlying symbol (NIFTY or BANKNIFTY)
3. THE trade details card SHALL contain the option type (CE or PE)
4. THE trade details card SHALL contain the strike price
5. THE trade details card SHALL contain the expiry date
6. THE trade details card SHALL contain the entry price
7. THE trade details card SHALL contain the target price with expected profit amount
8. THE trade details card SHALL contain the stop loss price with maximum loss amount
9. THE trade details card SHALL contain the risk/reward ratio in format "1:X"
10. THE trade details card SHALL contain the lot size for the contract

### Requirement 16: Market Analysis Panel Display

**User Story:** As a scalping trader, I want to see comprehensive market analysis including trend, indicators, and key levels, so that I understand the context behind the signal.

#### Acceptance Criteria

1. THE UI_Dashboard SHALL display a market analysis panel
2. THE market analysis panel SHALL display the current spot price
3. THE market analysis panel SHALL display the current trend (Bullish, Bearish, Neutral)
4. THE market analysis panel SHALL display RSI value with overbought/oversold indication
5. THE market analysis panel SHALL display MACD value with bullish/bearish indication
6. THE market analysis panel SHALL display current price relative to VWAP
7. THE market analysis panel SHALL display EMA 5 and EMA 15 values
8. THE market analysis panel SHALL display the nearest support level
9. THE market analysis panel SHALL display the nearest resistance level
10. THE market analysis panel SHALL display the trendline status
11. THE market analysis panel SHALL display total Call OI and Put OI
12. THE market analysis panel SHALL display change in Call OI and Put OI
13. THE market analysis panel SHALL display PCR value with interpretation
14. THE market analysis panel SHALL display ATR value

### Requirement 17: Detailed Rationale Display

**User Story:** As a scalping trader, I want to see detailed AI reasoning for the signal, so that I can understand why the recommendation was made.

#### Acceptance Criteria

1. THE UI_Dashboard SHALL display a detailed rationale text section
2. THE rationale SHALL explain the price action analysis
3. THE rationale SHALL explain the trend analysis and direction
4. THE rationale SHALL explain the technical indicator signals
5. THE rationale SHALL explain the options chain interpretation
6. THE rationale SHALL explain the open interest analysis
7. THE rationale SHALL explain support and resistance considerations
8. THE rationale SHALL explain why the probability and R:R thresholds were or were not met
9. THE rationale SHALL be written in clear, professional trading language
10. THE rationale SHALL be between 100 and 300 words

### Requirement 18: Action Buttons for Trade Execution

**User Story:** As a scalping trader, I want to execute paper trades directly from the signal display, so that I can quickly test the recommendation.

#### Acceptance Criteria

1. WHEN signal is BUY, THE UI_Dashboard SHALL display a "BUY ON PAPER" button
2. WHEN the user clicks "BUY ON PAPER", THE Paper_Trading_System SHALL create a paper trade with the displayed parameters
3. WHEN paper trade is created, THE UI_Dashboard SHALL display a success confirmation
4. WHEN paper trade is created, THE UI_Dashboard SHALL navigate to the paper trading portfolio view
5. THE "BUY ON PAPER" button SHALL be disabled when signal is HOLD

### Requirement 19: API Endpoint for Analysis

**User Story:** As a developer, I want a dedicated API endpoint for options scalping analysis, so that the frontend can request fresh analysis on demand.

#### Acceptance Criteria

1. THE backend SHALL provide a POST endpoint at `/api/options-scalper/analyze`
2. THE endpoint SHALL accept a request parameter specifying the underlying (NIFTY or BANKNIFTY)
3. WHEN the endpoint receives a request, THE Scalping_Agent SHALL execute the complete analysis workflow
4. WHEN analysis completes, THE endpoint SHALL return a structured JSON response containing signal, probability, R:R ratio, trade details, market analysis, and rationale
5. THE endpoint SHALL return response within 3 seconds for 95% of requests
6. IF analysis fails, THEN THE endpoint SHALL return a 500 status code with error details
7. IF the underlying parameter is invalid, THEN THE endpoint SHALL return a 400 status code with validation error

### Requirement 20: Analysis History Storage

**User Story:** As a scalping trader, I want the system to store analysis history, so that I can review past signals and performance.

#### Acceptance Criteria

1. WHEN analysis completes, THE Scalping_Agent SHALL store the analysis result in the database
2. THE stored analysis SHALL include timestamp, underlying, signal, probability, R:R ratio, trade details, and market metrics
3. THE database SHALL retain analysis history for at least 30 days
4. THE UI_Dashboard SHALL provide a link to view analysis history
5. THE analysis history view SHALL display past signals in reverse chronological order
6. THE analysis history view SHALL allow filtering by underlying, signal type, and date range

### Requirement 21: WebSocket Support for Real-Time Updates

**User Story:** As a scalping trader, I want real-time signal updates pushed to my browser, so that I don't have to rely on polling for the latest data.

#### Acceptance Criteria

1. THE backend SHALL provide a WebSocket endpoint at `/ws/options-scalper`
2. WHEN a client connects to the WebSocket, THE Auto_Refresh_System SHALL send analysis updates to that client
3. WHEN analysis completes, THE Auto_Refresh_System SHALL broadcast the result to all connected WebSocket clients
4. WHEN a client disconnects, THE Auto_Refresh_System SHALL clean up the connection
5. THE WebSocket connection SHALL include heartbeat messages every 30 seconds to maintain connectivity

### Requirement 22: Error Handling and Graceful Degradation

**User Story:** As a scalping trader, I want the system to handle API failures gracefully, so that temporary issues don't disrupt my workflow.

#### Acceptance Criteria

1. WHEN market data fetch fails, THE UI_Dashboard SHALL display the last successfully retrieved analysis
2. WHEN market data fetch fails, THE UI_Dashboard SHALL display a warning message indicating data may be stale
3. WHEN market data fetch fails, THE Auto_Refresh_System SHALL retry the fetch after 30 seconds
4. WHEN 3 consecutive data fetches fail, THE Auto_Refresh_System SHALL pause automatic refresh and alert the user
5. WHEN AI analysis fails, THE Signal_Generator SHALL generate a HOLD signal with reason "Analysis Error"
6. WHEN database storage fails, THE Scalping_Agent SHALL log the error but continue operation
7. THE UI_Dashboard SHALL never display blank or error screens due to backend failures

### Requirement 23: Performance Requirements

**User Story:** As a scalping trader, I want the system to be fast and responsive, so that I receive timely signals for scalping opportunities.

#### Acceptance Criteria

1. THE complete analysis workflow (data fetch + indicators + AI analysis) SHALL complete within 3 seconds for 95% of requests
2. THE UI_Dashboard SHALL display new analysis results within 500 milliseconds of receiving the data
3. THE countdown timer SHALL update within 50 milliseconds of each second change
4. THE "REFRESH NOW" button SHALL trigger analysis within 200 milliseconds of click
5. THE Auto_Refresh_System SHALL not block the UI during data fetch or analysis
6. THE database query for analysis history SHALL complete within 1 second for queries returning up to 1000 records

### Requirement 24: Integration with Existing Options Chain Module

**User Story:** As a developer, I want to reuse existing options chain fetching logic, so that I avoid code duplication and maintain consistency.

#### Acceptance Criteria

1. THE Market_Data_Fetcher SHALL use the existing options chain API from Phase 8
2. THE Market_Data_Fetcher SHALL use the same data models and parsing logic as Phase 8
3. IF the Phase 8 options chain API is unavailable, THEN THE Market_Data_Fetcher SHALL log an error and return HOLD signal
4. THE Scalping_Agent SHALL maintain compatibility with Phase 8 data structures

### Requirement 25: Integration with Existing Intraday Analysis

**User Story:** As a developer, I want to reuse existing intraday analysis logic, so that technical indicator calculations are consistent across modules.

#### Acceptance Criteria

1. THE Technical_Analyzer SHALL use the existing intraday analysis service from Phase 7
2. THE Technical_Analyzer SHALL use the same technical indicator calculation methods as Phase 7
3. THE Scalping_Agent SHALL extend Phase 7 logic with scalping-specific analysis
4. THE Scalping_Agent SHALL maintain compatibility with Phase 7 data structures

### Requirement 26: Integration with Paper Trading System

**User Story:** As a scalping trader, I want seamless integration with paper trading, so that I can test signals without switching contexts.

#### Acceptance Criteria

1. WHEN the user clicks "BUY ON PAPER", THE Scalping_Agent SHALL create a paper trade using the existing Paper_Trading_System
2. THE paper trade SHALL include the exact strike, expiry, entry price, target, stop loss, and quantity from the signal
3. THE paper trade SHALL be tagged with source "Options Scalper" for tracking
4. THE Paper_Trading_System SHALL track P&L for scalper-generated trades separately
5. THE UI_Dashboard SHALL provide a link to view all paper trades created from scalper signals

### Requirement 27: Page Lifecycle Management

**User Story:** As a scalping trader, I want the system to automatically pause when I navigate away, so that unnecessary API calls are not made when I'm not viewing the page.

#### Acceptance Criteria

1. WHEN the user navigates away from the options scalper page, THE Auto_Refresh_System SHALL detect the page visibility change
2. WHEN the options scalper page becomes hidden, THE Auto_Refresh_System SHALL pause all refresh cycles within 1 second
3. WHEN the user returns to the options scalper page, THE Auto_Refresh_System SHALL detect the page visibility change
4. WHEN the options scalper page becomes visible, THE Auto_Refresh_System SHALL resume refresh cycles within 2 seconds
5. WHEN the browser tab closes, THE Auto_Refresh_System SHALL clean up all timers and connections

### Requirement 28: Accessibility and Responsive Design

**User Story:** As a scalping trader using different devices, I want the UI to be responsive and accessible, so that I can use the system on desktop, tablet, or mobile.

#### Acceptance Criteria

1. THE UI_Dashboard SHALL be fully responsive and functional on desktop screens (1920x1080 and above)
2. THE UI_Dashboard SHALL be fully responsive and functional on tablet screens (768x1024)
3. THE UI_Dashboard SHALL be fully responsive and functional on mobile screens (375x667)
4. THE UI_Dashboard SHALL use sufficient color contrast for readability (WCAG AA compliance)
5. THE UI_Dashboard SHALL provide keyboard navigation for all interactive elements
6. THE signal display SHALL use large, easy-to-read fonts for critical information

### Requirement 29: Logging and Monitoring

**User Story:** As a system administrator, I want comprehensive logging of all scalper activities, so that I can debug issues and monitor performance.

#### Acceptance Criteria

1. THE Scalping_Agent SHALL log each refresh cycle with timestamp and duration
2. THE Scalping_Agent SHALL log all generated signals with complete details
3. THE Scalping_Agent SHALL log all API failures with error details and stack traces
4. THE Scalping_Agent SHALL log AI analysis execution time
5. THE Scalping_Agent SHALL log data fetch execution time
6. THE Scalping_Agent SHALL log all user actions (manual refresh, pause, paper trade creation)
7. THE logs SHALL be structured in JSON format for easy parsing and analysis

### Requirement 30: Configuration and Customization

**User Story:** As a scalping trader, I want to customize refresh interval and thresholds, so that I can adjust the system to my trading style.

#### Acceptance Criteria

1. THE system SHALL provide a configuration option to set refresh interval (minimum 30 seconds, maximum 300 seconds)
2. THE system SHALL provide a configuration option to set probability threshold (minimum 50%, maximum 90%)
3. THE system SHALL provide a configuration option to set risk/reward ratio threshold (minimum 1:1, maximum 1:5)
4. THE system SHALL provide a configuration option to set maximum spread percentage (minimum 1%, maximum 10%)
5. THE system SHALL provide a configuration option to set minimum open interest (minimum 100, maximum 10000)
6. WHEN configuration changes are saved, THE Scalping_Agent SHALL apply the new settings immediately
7. THE UI_Dashboard SHALL display current configuration values in a settings panel
