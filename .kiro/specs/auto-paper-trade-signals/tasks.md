# Implementation Plan: Auto Paper Trade Signals

## Overview

Implement a Signal Forwarder module within the quant engine that intercepts analysis results from three signal sources (Options Scalper, Swing Scanner, Intraday Scorer), evaluates them against configurable thresholds, suppresses duplicates, and forwards qualifying signals to the NestJS Paper Trading API. The implementation proceeds bottom-up: config → mapper → duplicate checker → core forwarder → integration hooks → NestJS endpoints.

## Tasks

- [x] 1. Set up module structure and data models
  - [x] 1.1 Create signal_forwarder package with config module
    - Create `apps/quant/signal_forwarder/__init__.py`
    - Create `apps/quant/signal_forwarder/config.py` with `AutoTradeConfigData` dataclass and `AutoTradeConfigService` class
    - Implement `get_config(user_id)` returning defaults when no config exists
    - Implement `update_config(user_id, updates)` with range validation (options_scalper_threshold 50-95, swing_scanner_threshold 0-100, intraday_scorer_threshold 0-100, duplicate_window_minutes 1-1440)
    - Use JsonFileStore at `apps/quant/data/auto_trade_config.json`
    - _Requirements: 5.1, 5.4_

  - [ ]* 1.2 Write property test for config round-trip and defaults (Property 8)
    - **Property 8: Config round-trip and defaults**
    - Test that any valid AutoTradeConfigData serializes and deserializes to an equivalent config
    - Test that missing user config returns correct defaults
    - **Validates: Requirements 5.1, 5.4**

  - [ ]* 1.3 Write property test for disabled source skipping (Property 9)
    - **Property 9: Disabled source skipping**
    - Test that signals from disabled sources are skipped without error-level logging
    - **Validates: Requirements 5.2**

- [x] 2. Implement signal mapper (pure transforms)
  - [x] 2.1 Create scalper signal mapper
    - Create `apps/quant/signal_forwarder/mapper.py` with `SignalMapper` class
    - Implement `map_scalper_signal(result, user_id)` that produces CreatePaperTradeDto payload
    - Map: direction=LONG, tradeType=OPTIONS_SCALPING, optionType from signal_type, quantity=lot_size, all price fields, probability, riskRewardRatio, agentId="options_scalper"
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 6.6_

  - [x] 2.2 Create swing signal mapper
    - Implement `map_swing_signal(candidate, user_id, quantity)` in mapper.py
    - Map: tradeType=SWING, direction from analysis trend, quantity from config, probability=total_score, entry/stop_loss/target from analysis, agentId="swing_scanner"
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 6.6_

  - [x] 2.3 Create intraday signal mapper
    - Implement `map_intraday_signal(result, symbol, current_price, stop_loss, target, user_id, quantity)` in mapper.py
    - Map: tradeType=INTRADAY, direction from EMA alignment, quantity from config, indicators with all score components, agentId="intraday_scorer"
    - _Requirements: 3.2, 3.3, 3.4, 3.6, 6.6_

  - [ ]* 2.4 Write property test for scalper signal mapping (Property 2)
    - **Property 2: Scalper signal mapping correctness**
    - Verify all mapped fields match the specification for any valid ScalperAnalysisResult
    - **Validates: Requirements 1.3, 1.4, 1.5, 1.6, 1.7, 6.6**

  - [ ]* 2.5 Write property test for swing signal mapping (Property 4)
    - **Property 4: Swing signal mapping correctness**
    - Verify all mapped fields match the specification for any qualifying SwingScanResult
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 6.6**

  - [ ]* 2.6 Write property test for intraday signal mapping (Property 6)
    - **Property 6: Intraday signal mapping correctness**
    - Verify all mapped fields match the specification for any qualifying IntradayScoreResult
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.6, 6.6**

- [x] 3. Implement duplicate checker
  - [x] 3.1 Create duplicate checker module
    - Create `apps/quant/signal_forwarder/duplicate_checker.py` with `DuplicateChecker` class
    - Implement `is_duplicate(symbol, direction, trade_type, duplicate_window_minutes)` that checks for open trades and time-windowed duplicates
    - Implement `record_trade(symbol, direction, trade_type, trade_id)` to record a new trade creation
    - Implement `mark_trade_closed(symbol, direction, trade_type)` to allow new signals for that key
    - Use JsonFileStore at `apps/quant/data/dedup_state.json` for persistence across restarts
    - Key format: `{symbol}|{direction}|{trade_type}`
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 3.2 Write property test for duplicate signal suppression (Property 7)
    - **Property 7: Duplicate signal suppression**
    - Test that signals with an OPEN trade or within the duplicate window are suppressed
    - Test that signals outside the window with no open trade pass through
    - **Validates: Requirements 4.1, 4.2**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement core Signal Forwarder service
  - [x] 5.1 Create forwarder with HTTP forwarding and retry logic
    - Create `apps/quant/signal_forwarder/forwarder.py` with `SignalForwarder` class
    - Implement constructor with `api_base_url` (default http://localhost:4000) and `user_id`
    - Implement `_send_to_api(payload)` with httpx async POST to `/api/paper-trades`
    - Implement retry logic: retry once after 2-second delay on connection errors and 5xx responses
    - Log errors with full payload on failure, do not retry on 4xx
    - Track ForwarderHealth counters (signals_forwarded, signals_skipped, errors)
    - _Requirements: 6.4, 6.5, 1.8, 7.3_

  - [x] 5.2 Implement forward_scalper_signal method
    - Check config for options_scalper_enabled and threshold
    - Gate: only forward BUY_CE/BUY_PE with probability above threshold (skip HOLD)
    - Check duplicate before forwarding
    - Map via SignalMapper, send to API, record trade on success
    - Log INFO on success, DEBUG on skip
    - _Requirements: 1.1, 1.2, 5.2, 7.1, 7.2_

  - [x] 5.3 Implement forward_swing_signals method
    - Check config for swing_scanner_enabled and threshold
    - Gate: only forward candidates with score above threshold AND valid price data
    - Skip candidates missing entry/stop_loss/target with WARNING
    - Check duplicate per candidate before forwarding
    - Map via SignalMapper, send to API, record trade on success
    - Return list of created trade_ids
    - _Requirements: 2.1, 2.6, 5.2, 7.1, 7.2_

  - [x] 5.4 Implement forward_intraday_signal method
    - Check config for intraday_scorer_enabled and threshold
    - Gate: only forward STRONG signals with total_score above threshold
    - Skip MODERATE/WEAK regardless of score
    - Check duplicate before forwarding
    - Map via SignalMapper, send to API, record trade on success
    - _Requirements: 3.1, 3.5, 5.2, 7.1, 7.2_

  - [x] 5.5 Implement get_health method
    - Return ForwarderHealth dataclass with current session counters
    - _Requirements: 7.4_

  - [ ]* 5.6 Write property test for scalper signal gating (Property 1)
    - **Property 1: Scalper signal gating**
    - Test that trades are created iff signal_type is BUY_CE/BUY_PE AND probability > threshold
    - **Validates: Requirements 1.1, 1.2**

  - [ ]* 5.7 Write property test for swing signal gating (Property 3)
    - **Property 3: Swing signal gating**
    - Test that trades are created iff score > threshold AND valid price data present
    - **Validates: Requirements 2.1, 2.6**

  - [ ]* 5.8 Write property test for intraday signal gating (Property 5)
    - **Property 5: Intraday signal gating**
    - Test that trades are created iff strength=STRONG AND score > threshold
    - **Validates: Requirements 3.1, 3.5**

  - [ ]* 5.9 Write property test for health counter accuracy (Property 10)
    - **Property 10: Health counter accuracy**
    - Test that ForwarderHealth counters exactly equal the count of each operation type in a sequence
    - **Validates: Requirements 7.4**

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Wire integration hooks into existing analysis endpoints
  - [x] 7.1 Hook Signal Forwarder into Options Scalper endpoint
    - Modify the Options Scalper analyze endpoint handler (at `apps/quant/scalper/router.py`) to call `signal_forwarder.forward_scalper_signal(result)` as a post-processing step after returning the analysis response
    - Wrap the forwarder call in try/except so analysis is unaffected by forwarding errors
    - _Requirements: 6.1_

  - [x] 7.2 Hook Signal Forwarder into Swing Scanner workflow
    - Modify the Swing Scanner integration point to call `signal_forwarder.forward_swing_signals(candidates)` after `scan_universe()` completes
    - Wrap in try/except for graceful degradation
    - _Requirements: 6.2_

  - [x] 7.3 Hook Signal Forwarder into Intraday Scorer workflow
    - Modify the Intraday Scorer integration point to call `signal_forwarder.forward_intraday_signal(result, symbol, stop_loss, target)` after `calculate_score()` completes
    - Wrap in try/except for graceful degradation
    - _Requirements: 6.3_

  - [ ]* 7.4 Write unit tests for integration wiring and error isolation
    - Test that analysis endpoints still return results even if forwarder raises exceptions
    - Test that forwarder is called with correct arguments after each analysis module
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 8. Implement NestJS Auto-Trade Config endpoints
  - [x] 8.1 Create AutoTradeConfig controller and service on NestJS side
    - Create `apps/api/src/trading/auto-trade-config.controller.ts` with GET and PUT endpoints at `/api/auto-trade-config`
    - Create DTO for config updates with validation (class-validator decorators)
    - Implement service to read/write config in Postgres via Prisma
    - Add Prisma schema for AutoTradeConfig model if not present
    - _Requirements: 5.3_

  - [ ]* 8.2 Write unit tests for AutoTradeConfig NestJS endpoints
    - Test GET returns defaults when no config exists
    - Test PUT validates ranges and persists correctly
    - Test PUT rejects invalid values
    - _Requirements: 5.3, 5.1_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (10 total)
- Unit tests validate specific examples and edge cases
- The quant engine runs on port 8000 (Python/FastAPI), the NestJS API on port 4000
- All Python modules use the existing JsonFileStore pattern for persistence
- httpx is used for async HTTP calls from quant engine to NestJS API

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.2", "2.3", "3.1"] },
    { "id": 2, "tasks": ["2.4", "2.5", "2.6", "3.2"] },
    { "id": 3, "tasks": ["5.1"] },
    { "id": 4, "tasks": ["5.2", "5.3", "5.4", "5.5"] },
    { "id": 5, "tasks": ["5.6", "5.7", "5.8", "5.9"] },
    { "id": 6, "tasks": ["7.1", "7.2", "7.3", "8.1"] },
    { "id": 7, "tasks": ["7.4", "8.2"] }
  ]
}
```
