# Requirements Document

## Introduction

This feature enables automated paper trade creation based on signals produced by the app's analysis modules. When the Options Scalper, Swing Scanner, or Intraday Scorer generates a tradeable signal meeting configured thresholds, the system automatically forwards it to the Paper Trading API to create a paper trade. This turns analysis outputs into simulated executions without manual intervention.

## Glossary

- **Signal_Forwarder**: A Python service within the quant engine that receives analysis results, evaluates eligibility, maps signal data to the Paper Trading API payload format, and calls the NestJS Paper Trading endpoint to create paper trades.
- **Options_Scalper**: The existing analysis module at `apps/quant/scalper/router.py` that produces BUY CE, BUY PE, or HOLD signals for NIFTY/BANKNIFTY options.
- **Swing_Scanner**: The existing analysis module at `apps/quant/services/swing_scanner_service.py` that scans multiple stocks and produces scored swing trading candidates.
- **Intraday_Scorer**: The existing analysis module at `apps/quant/services/intraday_scoring_service.py` that calculates deterministic intraday trading scores with a strength classification (STRONG, MODERATE, WEAK).
- **Paper_Trading_API**: The NestJS REST endpoint at `POST /api/paper-trades` that accepts a CreatePaperTradeDto and persists a paper trade in Postgres.
- **Auto_Trade_Config**: A per-user configuration controlling which signal sources are enabled for auto-trading and what thresholds apply.
- **Confidence_Threshold**: A configurable minimum score or probability that a signal must meet before the Signal_Forwarder creates a paper trade.
- **Duplicate_Window**: A configurable time period during which a second signal for the same symbol, direction, and trade type is considered a duplicate and is suppressed.

## Requirements

### Requirement 1: Options Scalper Signal Forwarding

**User Story:** As a trader, I want BUY CE and BUY PE signals from the Options Scalper to automatically create paper trades, so that I can backtest scalping strategies without manually entering each trade.

#### Acceptance Criteria

1. WHEN the Options_Scalper returns a signal_type of BUY_CE or BUY_PE with a probability above the configured Confidence_Threshold, THE Signal_Forwarder SHALL create a paper trade via the Paper_Trading_API with tradeType set to OPTIONS_SCALPING.
2. WHEN the Options_Scalper returns a signal_type of HOLD, THE Signal_Forwarder SHALL NOT create a paper trade.
3. THE Signal_Forwarder SHALL map the Options_Scalper response fields (entry_price, target_price, stop_loss, strike_price, expiry_date, underlying, lot_size) to the corresponding CreatePaperTradeDto fields.
4. THE Signal_Forwarder SHALL set the direction to LONG for BUY_CE signals and LONG for BUY_PE signals.
5. THE Signal_Forwarder SHALL set the optionType to CE for BUY_CE signals and PE for BUY_PE signals.
6. THE Signal_Forwarder SHALL set the quantity to the lot_size value returned by the Options_Scalper.
7. THE Signal_Forwarder SHALL include the probability and risk_reward_ratio from the Options_Scalper response in the paper trade record.
8. IF the Paper_Trading_API returns an error, THEN THE Signal_Forwarder SHALL log the error with the full signal payload and continue processing subsequent signals.

### Requirement 2: Swing Scanner Signal Forwarding

**User Story:** As a trader, I want high-scoring swing candidates to automatically become paper trades, so that I can track the performance of the scanner's recommendations without manual data entry.

#### Acceptance Criteria

1. WHEN the Swing_Scanner produces a candidate with a score above the configured Confidence_Threshold, THE Signal_Forwarder SHALL create a paper trade via the Paper_Trading_API with tradeType set to SWING.
2. THE Signal_Forwarder SHALL derive entry_price, stop_loss, and target from the Swing_Scanner candidate's analysis result.
3. THE Signal_Forwarder SHALL set the direction to LONG for candidates where the analysis indicates a bullish setup, and SHORT for bearish setups.
4. THE Signal_Forwarder SHALL set the quantity to a configurable default lot size for swing trades.
5. THE Signal_Forwarder SHALL include the candidate's total_score as the probability field in the paper trade record.
6. IF the Swing_Scanner candidate does not include valid entry, stop_loss, or target prices, THEN THE Signal_Forwarder SHALL skip the candidate and log a warning.

### Requirement 3: Intraday Scorer Signal Forwarding

**User Story:** As a trader, I want high-confidence intraday signals to automatically create paper trades, so that I can evaluate the intraday scoring model's effectiveness through simulated execution.

#### Acceptance Criteria

1. WHEN the Intraday_Scorer produces a result with strength equal to STRONG and total_score above the configured Confidence_Threshold, THE Signal_Forwarder SHALL create a paper trade via the Paper_Trading_API with tradeType set to INTRADAY.
2. THE Signal_Forwarder SHALL determine direction as LONG when the trend_score component indicates bullish alignment (price above EMA9 above EMA21) and SHORT when it indicates bearish alignment (price below EMA9 below EMA21).
3. THE Signal_Forwarder SHALL use the stop_loss and target values provided to the scoring function as the paper trade stop_loss and target fields.
4. THE Signal_Forwarder SHALL set quantity to a configurable default lot size for intraday trades.
5. IF the Intraday_Scorer result has strength equal to MODERATE or WEAK, THEN THE Signal_Forwarder SHALL NOT create a paper trade.
6. THE Signal_Forwarder SHALL include the intraday score components (trend_score, momentum_score, volume_score, vwap_score) in the paper trade aiContext as the indicators field.

### Requirement 4: Duplicate Signal Suppression

**User Story:** As a trader, I want the system to avoid creating duplicate paper trades when the same signal fires multiple times in quick succession, so that my paper portfolio reflects distinct trade ideas rather than repeated entries.

#### Acceptance Criteria

1. WHEN the Signal_Forwarder receives a signal for a symbol, direction, and tradeType combination that already has an OPEN paper trade, THE Signal_Forwarder SHALL NOT create a new paper trade.
2. WHEN the Signal_Forwarder receives a signal for a symbol, direction, and tradeType combination where the last paper trade was created within the configured Duplicate_Window, THE Signal_Forwarder SHALL NOT create a new paper trade.
3. THE Signal_Forwarder SHALL log a message indicating a duplicate signal was suppressed, including the symbol and time since the last trade.

### Requirement 5: Auto-Trade Configuration

**User Story:** As a trader, I want to configure which signal sources are enabled for auto-trading and set confidence thresholds per source, so that I have control over which signals trigger paper trades.

#### Acceptance Criteria

1. THE Auto_Trade_Config SHALL store per-user settings with fields: options_scalper_enabled (boolean), swing_scanner_enabled (boolean), intraday_scorer_enabled (boolean), options_scalper_threshold (float 50-95), swing_scanner_threshold (float 0-100), intraday_scorer_threshold (float 0-100), default_swing_quantity (integer), default_intraday_quantity (integer), duplicate_window_minutes (integer 1-1440).
2. WHEN a signal source is disabled in the Auto_Trade_Config, THE Signal_Forwarder SHALL skip signals from that source without logging an error.
3. THE Paper_Trading_API SHALL expose GET and PUT endpoints at /api/auto-trade-config for retrieving and updating the Auto_Trade_Config.
4. WHEN no Auto_Trade_Config exists for a user, THE system SHALL use default values: all sources enabled, options_scalper_threshold 70, swing_scanner_threshold 65, intraday_scorer_threshold 70, default_swing_quantity 1, default_intraday_quantity 1, duplicate_window_minutes 60.

### Requirement 6: Signal Forwarding Integration Points

**User Story:** As a developer, I want the signal forwarding to hook into existing analysis workflows cleanly, so that the auto-trade feature does not require rewriting analysis modules.

#### Acceptance Criteria

1. THE Signal_Forwarder SHALL be callable as a post-processing step after the Options_Scalper analyze endpoint returns a result.
2. THE Signal_Forwarder SHALL be callable as a post-processing step after the Swing_Scanner scan_universe method completes.
3. THE Signal_Forwarder SHALL be callable as a post-processing step after the Intraday_Scorer calculate_score method completes.
4. THE Signal_Forwarder SHALL communicate with the Paper_Trading_API via HTTP calls to the NestJS server at the configured API base URL (default http://localhost:4000).
5. IF the Paper_Trading_API is unreachable, THEN THE Signal_Forwarder SHALL retry the request once after a 2-second delay, and log an error if the retry also fails.
6. THE Signal_Forwarder SHALL set the agentId field to identify the originating analysis module (options_scalper, swing_scanner, or intraday_scorer).

### Requirement 7: Observability and Logging

**User Story:** As a developer, I want visibility into auto-trade signal forwarding activity, so that I can debug issues and monitor system health.

#### Acceptance Criteria

1. WHEN the Signal_Forwarder successfully creates a paper trade, THE Signal_Forwarder SHALL log the trade ID, symbol, direction, entry price, and source module at INFO level.
2. WHEN the Signal_Forwarder skips a signal due to threshold, duplicate, or disabled source, THE Signal_Forwarder SHALL log the reason at DEBUG level.
3. WHEN the Signal_Forwarder encounters an error communicating with the Paper_Trading_API, THE Signal_Forwarder SHALL log the error details, HTTP status code, and full request payload at ERROR level.
4. THE Signal_Forwarder SHALL expose a health-check method that returns the count of signals forwarded, signals skipped, and errors in the current session.
