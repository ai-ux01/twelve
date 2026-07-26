# Implementation Plan: Options Scalping Agent

## Overview

This implementation plan creates an AI-powered auto-refreshing options scalping agent that analyzes NIFTY50 and BANKNIFTY options every 60 seconds and generates high-quality BUY/SELL/HOLD signals with strict probability (≥70%) and risk/reward (≥1:2) thresholds. The implementation integrates with existing Phase 7 (Intraday Analysis) and Phase 8 (Options Chain) modules, adds WebSocket support for real-time updates, and provides a comprehensive React-based UI dashboard.

## Tasks

- [ ] 1. Set up core data models and database schema
  - Create AnalysisResult, MarketDataPackage, TechnicalIndicators, OptionsAnalysis, Signal, ScalperConfiguration data models in Python
  - Create PostgreSQL schema for analysis_history table with fields: id, timestamp, underlying, signal_type, probability, risk_reward_ratio, strike_price, expiry_date, entry_price, target_price, stop_loss, lot_size, spot_price, trend, oi_interpretation, pcr, trendline_status, support_level, resistance_level, rsi, macd, macd_signal, vwap, ema_5, ema_15, atr, volume_ratio, call_oi, put_oi, call_oi_change, put_oi_change, atm_iv, rationale, hold_reason
  - Create PostgreSQL schema for scalper_configuration table with fields: id, user_id, refresh_interval, probability_threshold, risk_reward_threshold, max_spread_percentage, min_open_interest
  - Add database migration script
  - _Requirements: 20.1, 20.2, 30.1, 30.2, 30.3, 30.4, 30.5, 30.6_


- [ ] 2. Implement Market Data Fetcher
  - [ ] 2.1 Create MarketDataFetcher class with methods for fetching spot prices, OHLCV data, and options chain
    - Implement fetch_spot_prices() to retrieve NIFTY50 and BANKNIFTY spot prices from market data API
    - Implement fetch_ohlcv_data(symbol, interval, count) to retrieve 1-minute candles (last 100 bars)
    - Implement fetch_options_chain(symbol, spot_price) to retrieve options chain within 10% of spot, up to 30 days expiry
    - Implement validate_data_freshness(data) to check timestamp <2 minutes old
    - Add timeout handling: 5 seconds per API call, 10 seconds total for complete fetch
    - Add retry logic: up to 2 additional attempts with 1-second delay
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10_

  - [ ]* 2.2 Write property test for data validation
    - **Property 1: OHLCV Validation Rejects Invalid Data**
    - **Validates: Requirements 5.10**

  - [ ]* 2.3 Write unit tests for Market Data Fetcher
    - Test timeout handling (5s per call, 10s total)
    - Test retry logic with simulated API failures
    - Test data freshness validation with old timestamps
    - Test null/missing field rejection
    - _Requirements: 4.6, 4.7, 4.8, 4.9_

- [ ] 3. Implement Technical Analyzer with Phase 7 integration
  - [ ] 3.1 Create TechnicalAnalyzer class that wraps Phase 7 IntradayAnalysisService
    - Instantiate IntradayAnalysisService with rsi_period=14, atr_period=14, volume_period=20, stale_threshold_seconds=120
    - Implement analyze_technical_indicators(ohlcv_data) that calls IntradayAnalysisService.analyze()
    - Extract VWAP, EMA (5, 15), RSI (14), MACD (12, 26, 9), ATR (14), volume ratio from Phase 7 results
    - Implement identify_support_resistance(ohlcv_data) to find swing lows/highs within last 50 bars
    - Implement detect_trendlines(ohlcv_data) to identify active trendlines (≥3 swing points)
    - Implement classify_trend(indicators) to return Bullish/Bearish/Neutral
    - _Requirements: 25.1, 25.2, 25.3, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.2, 6.3, 6.4, 6.5, 6.7, 6.8, 6.9_


  - [ ]* 3.2 Write property tests for distance calculations
    - **Property 2: Support Distance Calculation Accuracy**
    - **Validates: Requirements 6.10**
    - **Property 3: Resistance Distance Calculation Accuracy**
    - **Validates: Requirements 6.11**

  - [ ]* 3.3 Write unit tests for Technical Analyzer
    - Test Phase 7 integration with valid OHLCV data
    - Test insufficient data handling (minimum 26 candles for MACD)
    - Test invalid candle rejection (null values, zero/negative prices)
    - Test support/resistance identification with various patterns
    - Test trendline classification (Bullish, Bearish, Neutral)
    - _Requirements: 5.8, 5.9, 5.10, 6.12, 6.13, 6.14_

- [ ] 4. Implement Options Analyzer with Phase 8 integration
  - [ ] 4.1 Create OptionsAnalyzer class that wraps Phase 8 OptionsChainService
    - Implement analyze_options_chain(chain_data) that calls OptionsChainService.process_options_chain()
    - Extract bid, ask, ltp, volume, OI, IV, Greeks from Phase 8 OptionsChainContractResult
    - Implement calculate_oi_metrics(chain_data, previous_data) to compute total Call/Put OI and changes
    - Implement calculate_pcr(call_oi, put_oi) to compute Put-Call Ratio
    - Implement identify_oi_buildup(oi_changes) to find top 5 contracts with highest OI increase (≥100 threshold)
    - Calculate ATM Call IV and ATM Put IV for nearest weekly expiry
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 7.1, 7.2, 7.4, 7.5, 7.9, 7.11, 7.12, 7.15, 7.16_

  - [ ] 4.2 Implement liquidity validation logic
    - Calculate bid-ask spread as (ask - bid)
    - Calculate mid-price as (bid + ask) / 2
    - Calculate spread percentage as (spread / mid-price) × 100
    - Set liquidity_valid = false if spread % >5%, volume =0, OI ≤100, bid ≤0, ask ≤0, bid > ask, or any null
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11_

  - [ ]* 4.3 Write property tests for liquidity metrics
    - **Property 4: Liquidity Metrics Calculation Chain**
    - **Validates: Requirements 8.1, 8.2, 8.3**
    - **Property 5: Liquidity Validation Rules**
    - **Validates: Requirements 8.6, 8.7, 8.9, 8.11**


  - [ ]* 4.4 Write unit tests for Options Analyzer
    - Test Phase 8 integration with valid options chain data
    - Test OI change calculation (first refresh vs subsequent)
    - Test PCR calculation with zero Call OI (should return null)
    - Test OI buildup identification (top 5 with ≥100 increase)
    - Test ATM IV extraction for nearest weekly expiry
    - Test missing Greeks handling (exclude contracts with null Greeks)
    - _Requirements: 7.3, 7.8, 7.10, 7.13, 7.14, 7.18, 24.10, 24.11_

- [ ] 5. Implement AI Analysis Engine
  - [ ] 5.1 Create AIAnalysisEngine class with LLM integration
    - Implement analyze_market_data(data_package) that sends complete data to GPT-4
    - Use persona: "Elite intraday options scalper with aggressive risk/reward preferences"
    - Provide context: spot price, OHLCV, technical indicators, options metrics, support/resistance, trendlines
    - Set timeout: 2 seconds for LLM response
    - Implement classify_price_action(ohlcv_data) to identify candlestick patterns and momentum
    - Implement interpret_technical_indicators(indicators) to classify each as bullish/bearish/neutral
    - Implement interpret_options_metrics(options_analysis) to derive market sentiment
    - Implement generate_rationale(analysis) to create 100-300 word explanation
    - _Requirements: 9.1, 9.3, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11, 9.12, 9.13_

  - [ ]* 5.2 Write unit tests for AI Analysis Engine
    - Test LLM API call with mocked responses
    - Test timeout handling (2 seconds)
    - Test incomplete data rejection (missing required fields)
    - Test output structure validation (all required fields present)
    - Test rationale length validation (100-300 words)
    - Test error handling when LLM fails
    - _Requirements: 9.2, 9.4, 17.10, 22.5_

- [ ] 6. Implement Signal Generator
  - [ ] 6.1 Create SignalGenerator class with threshold logic and contract selection
    - Implement generate_signal(ai_result, contracts) main method
    - Implement calculate_risk_reward_ratio(entry, target, stop_loss) as (target - entry) / (entry - stop_loss)
    - Implement threshold check: probability ≥70% AND R:R ≥2.0 for BUY signal
    - Implement select_best_contract(contracts, option_type) to find ATM or ±2 strikes with best liquidity
    - Filter contracts: ATM ±2 strikes, spread ≤5%, OI >1000, volume >500, IV <100%
    - Rank by strike proximity to ATM, then by lowest spread
    - Calculate entry price as mid-price (bid + ask) / 2
    - Calculate target as entry + (2 × ATR) and stop loss as entry - (1 × ATR)
    - Select expiry: nearest weekly with ≥2 days remaining
    - Determine CE vs PE based on trend classification from AI
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 11.1, 11.2, 11.3, 11.5, 11.6_


  - [ ] 6.2 Implement safety controls
    - Check market data timestamp (>2 min old → HOLD "Stale Data")
    - Check market hours (9:15 AM - 3:30 PM IST, weekdays only → else HOLD "Market Closed")
    - Check holidays (Saturday/Sunday/Indian stock market holiday → HOLD "Market Closed")
    - Check selected contract exists (no contract → HOLD "No Contract Selected")
    - Check extreme IV (IV >100% → HOLD "Extreme IV")
    - Check liquidity (spread >5% → HOLD "Poor Liquidity")
    - Check complete data (any null field → HOLD "Incomplete Data")
    - Check probability (< 70% → HOLD "Low Probability")
    - Check R:R (< 1:2 → HOLD "Insufficient R:R")
    - Priority order: Stale Data → Market Closed → No Contract → Incomplete Data → Extreme IV → Poor Liquidity → Low Probability → Insufficient R:R
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10_

  - [ ]* 6.3 Write property tests for signal generation logic
    - **Property 6: Risk/Reward Ratio Calculation**
    - **Validates: Requirements 10.3**
    - **Property 7: Signal Generation Threshold Logic**
    - **Validates: Requirements 10.4, 10.5**
    - **Property 8: Contract Strike Proximity Filtering**
    - **Validates: Requirements 11.2**
    - **Property 9: Contract Ranking by Strike Proximity**
    - **Validates: Requirements 11.5**
    - **Property 10: Stale Data Detection**
    - **Validates: Requirements 12.1**

  - [ ]* 6.4 Write unit tests for Signal Generator
    - Test probability exactly 70% with R:R 2.0 → BUY
    - Test probability 69.9% with R:R 2.0 → HOLD
    - Test probability 70% with R:R 1.99 → HOLD
    - Test market hours boundary (9:14:59 AM, 9:15:00 AM, 3:30:00 PM, 3:30:01 PM)
    - Test weekend/holiday detection
    - Test no liquid contracts available → HOLD "No Liquid Contracts Available"
    - Test multiple contracts with same spread → select by OI
    - Test all safety control violations
    - _Requirements: 10.11, 10.12, 10.13, 11.4, 11.7, 12.1, 12.2, 12.3_

- [ ] 7. Checkpoint - Ensure all core analysis components pass tests
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 8. Implement Auto Refresh Orchestrator
  - [ ] 8.1 Create AutoRefreshOrchestrator class with timer management and WebSocket client tracking
    - Implement start_refresh_cycle(underlying) to initiate 60-second timer within 1 second
    - Implement execute_refresh_cycle() to orchestrate: fetch data → analyze → generate signal → broadcast → store
    - Implement pause_refresh_cycle() to stop timer within 1 second
    - Implement resume_refresh_cycle() to restart timer within 2 seconds and trigger immediate refresh
    - Implement handle_page_visibility_change(visible) to pause/resume based on Page Visibility API
    - Maintain WebSocket client list for broadcasting
    - Implement cycle overlap prevention (skip if previous cycle still running)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.9, 27.1, 27.2, 27.3, 27.8_

  - [ ] 8.2 Implement error handling and retry logic
    - On fetch failure: retry after 30 seconds
    - Track consecutive failures: after 3, pause auto-refresh and alert user
    - On AI analysis failure: generate HOLD with "Analysis Error"
    - On database storage failure: log error but continue operation
    - Cache last successful analysis for graceful degradation
    - Implement 10-second timeout for complete workflow with termination and HOLD signal
    - _Requirements: 1.6, 1.7, 1.8, 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.8, 22.9, 22.10, 22.11_

  - [ ]* 8.3 Write integration tests for Auto Refresh Orchestrator
    - Test 60-second cycle timing
    - Test pause within 1 second
    - Test resume within 2 seconds with immediate refresh
    - Test page visibility change detection
    - Test retry logic with simulated failures
    - Test 3 consecutive failure handling (pause + alert)
    - Test cycle overlap prevention
    - Test cleanup on page unload
    - _Requirements: 1.3, 1.4, 1.5, 1.9, 27.4, 27.5, 27.6_

- [ ] 9. Implement FastAPI endpoints
  - [ ] 9.1 Create POST /api/options-scalper/analyze endpoint
    - Accept JSON body with "underlying" parameter (NIFTY or BANKNIFTY)
    - Validate parameter (must be "NIFTY" or "BANKNIFTY")
    - Execute complete analysis workflow
    - Return AnalysisResult as JSON with 200 status code
    - Return 400 for invalid/missing underlying parameter
    - Return 500 for analysis failures with error details
    - Return 504 for timeout (>10 seconds)
    - Return 401 for invalid/missing authentication token
    - Set Content-Type: application/json header
    - Enforce 3-second response time for 95% of requests
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9, 19.10, 19.11, 23.1_


  - [ ] 9.2 Create GET /api/options-scalper/history endpoint
    - Accept query parameters: underlying, signal_type, date_from, date_to, page, page_size
    - Return paginated analysis history (50 records per page, max 100)
    - Filter by underlying, signal_type, date range as specified
    - Return 200 with JSON array of analysis records
    - Return 400 for invalid query parameters
    - Return 401 for invalid/missing authentication token
    - Complete query within 1 second for up to 1000 records
    - _Requirements: 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 20.10, 20.11, 20.12, 20.13, 23.6_

  - [ ] 9.3 Create GET /api/options-scalper/config and PUT /api/options-scalper/config endpoints
    - GET: Return current user's ScalperConfiguration
    - PUT: Accept JSON body with config fields (refresh_interval, probability_threshold, risk_reward_threshold, max_spread_percentage, min_open_interest)
    - Validate ranges: refresh_interval [30-300], probability_threshold [50-90], risk_reward_threshold [1.0-5.0], max_spread_percentage [1-10], min_open_interest [100-10000]
    - Return 200 with saved configuration on PUT
    - Return 400 for values outside valid ranges or non-numeric values
    - Apply new settings within 500ms after successful save
    - _Requirements: 30.1, 30.2, 30.3, 30.4, 30.5, 30.6, 30.7, 30.8, 30.9, 30.10, 30.11, 30.12_

  - [ ]* 9.4 Write integration tests for FastAPI endpoints
    - Test POST /analyze with valid NIFTY and BANKNIFTY requests
    - Test POST /analyze with invalid underlying (should return 400)
    - Test POST /analyze with missing underlying (should return 400)
    - Test POST /analyze timeout handling (>10s should return 504)
    - Test GET /history with various filter combinations
    - Test GET /history pagination (page, page_size parameters)
    - Test GET/PUT /config with valid and invalid values
    - Test authentication failures (401 responses)
    - _Requirements: 19.7, 19.8, 19.9, 30.7, 30.8_

- [ ] 10. Implement WebSocket endpoint
  - [ ] 10.1 Create WebSocket endpoint at /ws/options-scalper
    - Use wss:// for production, ws:// for development
    - Send most recent analysis to client within 1 second of connection
    - Broadcast analysis updates to all connected clients within 500ms of completion
    - Send heartbeat ping every 30 seconds
    - Close connection after 3 missed pongs (90 seconds)
    - Enforce max 100 concurrent connections per server
    - Reject excess connections with close code 1008 and capacity message
    - Reject unauthenticated connections with close code 1008
    - Use JSON message format: {message_type, timestamp, underlying, signal_data, market_data, error}
    - Clean up resources within 5 seconds of disconnect
    - Remove failed clients from broadcast list and log error
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7, 21.8, 21.9, 21.10, 21.11_


  - [ ]* 10.2 Write integration tests for WebSocket endpoint
    - Test client connection and initial analysis delivery
    - Test broadcast to multiple clients
    - Test heartbeat mechanism (30s pings, 3 missed pongs = disconnect)
    - Test connection limit enforcement (max 100)
    - Test authentication requirement
    - Test graceful disconnect and resource cleanup
    - Test failed client removal from broadcast list
    - _Requirements: 21.2, 21.3, 21.4, 21.5, 21.7, 21.8, 21.9, 21.10_

- [ ] 11. Implement database operations
  - [ ] 11.1 Create repository class for analysis history storage and retrieval
    - Implement store_analysis(analysis_result) to save complete AnalysisResult to analysis_history table
    - Implement get_analysis_history(underlying, signal_type, date_from, date_to, page, page_size) for filtering
    - Implement cleanup_old_records() to delete records older than 90 days (run daily at 00:00 IST)
    - Handle storage failures gracefully (log error, don't interrupt operation)
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.6, 20.7, 20.8, 20.9, 20.10, 20.11, 20.14, 22.6_

  - [ ] 11.2 Create repository class for configuration management
    - Implement get_config(user_id) to retrieve ScalperConfiguration
    - Implement save_config(config) to persist configuration changes
    - Return default values if no config exists for user
    - _Requirements: 30.11, 30.12, 30.13_

  - [ ]* 11.3 Write unit tests for database operations
    - Test analysis storage with complete AnalysisResult
    - Test history retrieval with various filters (underlying, signal_type, date range)
    - Test pagination (50 records/page, max 100)
    - Test empty result handling (no matching records)
    - Test old record cleanup (>90 days deletion)
    - Test config retrieval (existing and non-existing)
    - Test config save and retrieve round-trip
    - _Requirements: 20.6, 20.12, 20.13_

- [ ] 12. Checkpoint - Ensure all backend components pass tests
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 13. Implement React UI Dashboard - Live Status Panel
  - [ ] 13.1 Create LiveStatusPanel component
    - Display pulsing green dot (1.5s interval: 0.75s fade out + 0.75s fade in) when active
    - Display "Last Updated" timestamp in HH:MM:SS AM/PM format (local time)
    - Display countdown timer to next refresh (updates every second, ±50ms deviation)
    - Display "REFRESH NOW" button
    - Display "PAUSE AUTO REFRESH" toggle button
    - Display "PAUSED" indicator when auto-refresh paused (font ≥14px, contrast ≥4.5:1)
    - Change indicator to gray (non-pulsing) when paused
    - Change indicator to red with tooltip error message when fetch fails
    - Display "Initializing..." state before first analysis
    - Update indicator color within 100ms of state change
    - Trigger immediate refresh within 200ms of "REFRESH NOW" click
    - Pause auto-refresh within 1 second of toggle enable
    - Resume auto-refresh within 60 seconds of toggle disable
    - Disable "REFRESH NOW" button while refresh in progress
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 23.3, 23.4_

- [ ] 14. Implement React UI Dashboard - Signal Display and Probability Gauge
  - [ ] 14.1 Create SignalCard component
    - Display signal type ("BUY CE", "BUY PE", "HOLD") with font ≥32px
    - Display strike price with 2 decimals when signal is BUY
    - Display expiry date in DD-MMM-YYYY format when signal is BUY
    - Display entry, target, stop loss prices with 2 decimals when signal is BUY
    - Display probability percentage with 1 decimal
    - Display risk/reward ratio in "1:X.X" format with 1 decimal
    - Display trend, OI interpretation, PCR (2 decimals), trendline status
    - Display support and resistance levels with 2 decimals
    - Display "N/A" for null or missing values
    - Display "Error" with icon for invalid calculations
    - Update display within 500ms of receiving new analysis
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10, 13.11, 13.12, 13.13, 13.14, 13.15, 13.16, 13.17, 23.2_

  - [ ] 14.2 Create ProbabilityGauge component
    - Display numeric percentage 0-100% with visual indicator (≥80px height)
    - Color: red (<50%), yellow (50-70%), green (≥70%)
    - Display percentage with 1 decimal place
    - Display "N/A" with gray color for null/invalid/out-of-range values
    - Display "Calculating..." with gray color before first analysis
    - Update within 500ms of new analysis
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_


- [ ] 15. Implement React UI Dashboard - Trade Details and Market Analysis
  - [ ] 15.1 Create TradeDetailsCard component
    - Display only when signal is BUY, hide within 500ms when signal changes to HOLD
    - Display underlying ("NIFTY" or "BANKNIFTY")
    - Display option type ("CE" or "PE")
    - Display strike price as integer with comma separator (e.g., "19,500")
    - Display expiry in DD-MMM-YYYY format
    - Display entry price as ₹X.XX
    - Display target as ₹X.XX with profit calculation: (Target - Entry) × Lot Size, format "₹X,XXX.XX profit"
    - Display stop loss as ₹X.XX with loss calculation: (Entry - Stop Loss) × Lot Size, format "₹X,XXX.XX loss"
    - Display R:R ratio in "1:X" format (1 decimal)
    - Display lot size as integer
    - Display "N/A" for missing fields
    - Display error message and hide card for invalid strike (≤0) or lot size (≤0)
    - Display warning indicator for expired contracts (expiry date < current date)
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10, 15.11, 15.12, 15.13, 15.14, 15.15_

  - [ ] 15.2 Create MarketAnalysisPanel component
    - Display spot price (2 decimals)
    - Display trend (Bullish/Bearish/Neutral)
    - Display RSI (2 decimals) with indication: >70 "Overbought", <30 "Oversold", 30-70 "Neutral"
    - Display MACD and signal line (2 decimals) with indication: MACD > Signal "Bullish", MACD < Signal "Bearish", equal "Neutral"
    - Display price vs VWAP as percentage: ((price - VWAP) / VWAP) × 100 (2 decimals), label "Above VWAP" or "Below VWAP"
    - Display EMA 5, EMA 15 (2 decimals)
    - Display support and resistance levels (2 decimals)
    - Display trendline status (Bullish/Bearish/Neutral)
    - Display Call OI, Put OI (comma separators)
    - Display Call OI change and Put OI change (absolute with comma, percentage with 2 decimals)
    - Display PCR (2 decimals) with interpretation: >1.5 "Bearish", <0.7 "Bullish", 0.7-1.5 "Neutral"
    - Display ATR (2 decimals)
    - Display "N/A" for missing or null values
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9, 16.10, 16.11, 16.12, 16.13, 16.14, 16.15, 16.16, 16.17, 16.18, 16.19, 16.20, 16.21, 16.22, 16.23, 16.24, 16.25, 16.26, 16.27_

  - [ ]* 15.3 Write property tests for UI calculations
    - **Property 11: Price to VWAP Percentage Calculation**
    - **Validates: Requirements 16.12**
    - **Property 12: PCR Interpretation Classification**
    - **Validates: Requirements 16.23, 16.24, 16.25**


- [ ] 16. Implement React UI Dashboard - Rationale and Action Buttons
  - [ ] 16.1 Create RationalePanel component
    - Display section labeled "Analysis Rationale"
    - Display rationale text (100-300 words from AI)
    - Ensure text includes: price action analysis, trend analysis with indicator, 3+ technical indicators mentioned, 2+ options metrics mentioned, OI change interpretation, support/resistance position, probability/R:R threshold analysis
    - Display "Rationale generation failed" error if rationale is missing
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9, 17.10, 17.11, 17.12_

  - [ ] 16.2 Create ActionButtons component with Paper Trading integration
    - Display "BUY ON PAPER" button when signal is BUY
    - Disable "BUY ON PAPER" button when signal is HOLD
    - Disable button when any trade parameter is missing
    - Disable button while paper trade creation is in progress
    - On button click: create paper trade with underlying, option type, strike, expiry, entry price, target, stop loss, quantity
    - Use quantity: 1 lot = 50 contracts for NIFTY, 25 contracts for BANKNIFTY
    - Display success confirmation for 3 seconds or until dismissed
    - Navigate to paper trading portfolio view within 2 seconds on success
    - Display error message if paper trade creation fails
    - Display error message and remain on page if navigation fails
    - Apply 5-second timeout for Paper_Trading_System API call
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8, 18.9, 26.1, 26.2, 26.3, 26.7, 26.8, 26.9, 26.10_

- [ ] 17. Implement Paper Trading System integration
  - [ ] 17.1 Create integration with existing Paper_Trading_System
    - Call Paper_Trading_System API to create paper trade with exact parameters from signal
    - Tag paper trade with source "Options Scalper"
    - Track P&L separately for scalper-generated trades
    - Provide filterable view in paper trading portfolio (filter by source="Options Scalper")
    - Display cumulative P&L for scalper trades
    - _Requirements: 26.1, 26.2, 26.4, 26.5_

  - [ ]* 17.2 Write integration tests for Paper Trading integration
    - Test paper trade creation with valid signal parameters
    - Test quantity determination (NIFTY 50, BANKNIFTY 25)
    - Test source tagging ("Options Scalper")
    - Test error handling when Paper_Trading_System unavailable
    - Test timeout handling (5 seconds)
    - _Requirements: 26.3, 26.6, 26.8, 26.9_

- [ ] 18. Implement responsive design and accessibility
  - [ ] 18.1 Create responsive layouts with breakpoints
    - Desktop (1920px+): Multi-column grid layout for all panels
    - Tablet (768-1024px): 2-column grid or vertical stack, minimum 44x44px touch targets
    - Mobile (360-428px): Single column vertical stack, minimum 44x44px touch targets, hide market analysis (show via toggle overlay), collapse rationale into expandable accordion
    - Fixed header for live indicator and refresh controls
    - Support vertical scrolling, prevent horizontal scrolling
    - _Requirements: 28.1, 28.2, 28.3, 28.4, 28.9, 28.10_


  - [ ] 18.2 Implement accessibility features
    - Use color contrast ratios ≥4.5:1 for normal text, ≥3:1 for large text (≥18pt or ≥14pt bold)
    - Support keyboard navigation: Tab (forward), Shift+Tab (backward), Enter/Space (activate), Escape (close)
    - Display visible focus indicator (≥2px border/outline, ≥3:1 contrast)
    - Use font sizes: ≥32px for signal action, ≥24px for prices, ≥16px for supporting info
    - _Requirements: 28.5, 28.6, 28.7, 28.8_

- [ ] 19. Implement Settings Panel for configuration customization
  - [ ] 19.1 Create SettingsPanel component
    - Display "SETTINGS" button in navigation bar
    - Display settings panel with numeric inputs for: refresh_interval (default 60, min 30, max 300), probability_threshold (default 70, min 50, max 90), risk_reward_threshold (default 2.0, min 1.0, max 5.0), max_spread_percentage (default 5, min 1, max 10), min_open_interest (default 1000, min 100, max 10000)
    - Validate input ranges and reject out-of-range values with error message
    - Validate numeric input and reject non-numeric values with error message
    - Display "SAVE CHANGES" button to persist configuration
    - Display "RESET TO DEFAULTS" button to restore factory values
    - Apply new settings within 500ms after successful save
    - Load saved configuration on page reload/new session
    - _Requirements: 30.1, 30.2, 30.3, 30.4, 30.5, 30.6, 30.7, 30.8, 30.9, 30.10, 30.11, 30.12, 30.13_

  - [ ]* 19.2 Write unit tests for Settings Panel
    - Test valid configuration saves
    - Test out-of-range rejection with error messages
    - Test non-numeric rejection with error messages
    - Test RESET TO DEFAULTS functionality
    - Test configuration persistence across page reloads
    - _Requirements: 30.7, 30.8_

- [ ] 20. Implement Analysis History view
  - [ ] 20.1 Create AnalysisHistoryView component
    - Display link from dashboard to analysis history
    - Display past signals in reverse chronological order
    - Display filter controls: underlying (dropdown), signal_type (dropdown), date range (date pickers)
    - Fetch filtered results from GET /api/options-scalper/history
    - Display pagination controls (50 records per page)
    - Display "No results" message when filters return empty
    - _Requirements: 20.4, 20.5, 20.6, 20.12_

  - [ ]* 20.2 Write property test for history filtering
    - **Property 13: Analysis History Filtering**
    - **Validates: Requirements 20.6**


- [ ] 21. Implement logging and monitoring
  - [ ] 21.1 Create comprehensive logging system
    - Log each refresh cycle with timestamp and duration (milliseconds)
    - Log all generated signals with complete details (signal type, underlying, option type, strike, expiry, entry, target, stop loss, probability, R:R, timestamp)
    - Log all API failures with timestamp, endpoint URL, HTTP status code, error message, stack trace (up to 50 frames)
    - Log AI analysis execution time (milliseconds)
    - Log data fetch execution time (milliseconds)
    - Log all user actions (manual refresh, pause toggle, paper trade creation) with timestamp and affected entity
    - Write logs in JSON format with fields: timestamp (ISO 8601), log_level (INFO/WARN/ERROR), component_name, event_type, event_data
    - Store logs in application log directory with rotation at 100MB file size
    - Retain logs for minimum 30 days before automatic deletion
    - Increment failed_log_writes counter in memory if log writing fails, continue normal operation
    - _Requirements: 29.1, 29.2, 29.3, 29.4, 29.5, 29.6, 29.7, 29.8, 29.9, 29.10_

- [ ] 22. Wire all components together and implement page lifecycle
  - [ ] 22.1 Create main OptionsScalperPage component
    - Initialize Auto Refresh Orchestrator on page mount
    - Connect WebSocket client for real-time updates
    - Implement Page Visibility API integration (document.addEventListener('visibilitychange'))
    - Pause auto-refresh within 1 second when page becomes hidden
    - Resume auto-refresh within 2 seconds when page becomes visible, trigger immediate refresh
    - Implement debouncing for rapid visibility changes (500ms ignore threshold)
    - Clean up WebSocket and refresh timers on page unmount within 500ms
    - _Requirements: 1.1, 1.4, 1.5, 27.1, 27.2, 27.3, 27.4, 27.5, 27.6, 27.7_

  - [ ]* 22.2 Write integration tests for page lifecycle
    - Test auto-refresh initialization on page mount
    - Test WebSocket connection on page mount
    - Test pause on page visibility change (hidden)
    - Test resume on page visibility change (visible)
    - Test rapid visibility change debouncing
    - Test cleanup on page unmount
    - _Requirements: 27.1, 27.3, 27.5, 27.6, 27.7_

- [ ] 23. Final checkpoint - End-to-end testing and performance validation
  - Ensure all tests pass, ask the user if questions arise.
  - Validate complete analysis workflow <3 seconds (95th percentile)
  - Validate UI rendering <500ms
  - Validate countdown timer <50ms update latency
  - Validate manual refresh <200ms response time
  - Validate database queries <1 second for 1000 records
  - Test complete user flow: navigate to page → auto-refresh → signal display → paper trade creation → view history
  - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6_

## Notes

- Tasks marked with `*` are optional property-based and integration test tasks for comprehensive validation
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties with 100+ iterations
- Integration tests validate external service interactions with mocked dependencies
- Performance targets are enforced at 95th percentile
- The system integrates with existing Phase 7 (Intraday Analysis) and Phase 8 (Options Chain) modules
