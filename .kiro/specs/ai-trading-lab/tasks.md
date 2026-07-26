# Implementation Plan: AI Trading Lab

## Overview

This implementation plan creates a conversational AI trading assistant at `/ai-trading` that accepts natural-language prompts, classifies trading intent via GPT-4, orchestrates data fetching and quantitative analysis from the existing Quant Engine services, applies risk management, and streams structured recommendations via Server-Sent Events. The backend is a new `trading_lab/` module in the FastAPI Quant Engine (`apps/quant/`), and the frontend is a Next.js chat interface at `apps/web/app/ai-trading/page.tsx`.

## Tasks

- [ ] 1. Set up module structure and core data models
  - [ ] 1.1 Create trading_lab module directory and Pydantic models
    - Create `apps/quant/trading_lab/__init__.py` with module exports
    - Create `apps/quant/trading_lab/models.py` with all Pydantic models: TradingIntent enum, ResponseMode enum, SignalDirection enum, IntentClassification, PipelineContext, Recommendation, RiskAssessment, DecisionRecord, PromptRequest, ActionRequest, HistoryResponse, ActionResponse, SSEEvent, StatusEvent, RecommendationEvent
    - Create `apps/quant/trading_lab/exceptions.py` with custom exceptions: IntentDetectionError, QuantEngineError, RecommendationError, StaleDataError, PaperTradeError
    - Follow existing Pydantic patterns from `apps/quant/scalper/` module
    - _Requirements: 1.4, 2.1, 4.1, 5.1, 5.2, 5.3, 9.1, 9.2, 9.3_

  - [ ]* 1.2 Write unit tests for data model validation
    - Test PromptRequest validation (min_length=1, max_length=1000)
    - Test ResponseMode enum values (QUICK, DETAILED, TRADER, QUANT, COACH)
    - Test TradingIntent enum completeness (8 intents)
    - Test DecisionRecord UUID generation and field requirements
    - _Requirements: 1.4, 4.4, 5.1, 5.2_

- [ ] 2. Implement Intent Detector
  - [ ] 2.1 Create IntentDetector class with GPT-4 integration
    - Create `apps/quant/trading_lab/intent_detector.py`
    - Implement `async def classify(self, prompt: str) -> IntentClassification` using GPT-4 structured JSON output
    - Define system prompt for intent classification with all 8 intent types
    - Set confidence threshold at 0.6 — return `needs_clarification=True` when below
    - Extract stock symbols from prompt and include in classification result
    - Handle GPT-4 API errors with retry logic (2 retries, exponential backoff: 1s, 2s)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 8.1, 8.3_

  - [ ]* 2.2 Write property test for intent classification structure
    - **Property 1: Intent classification always returns a valid structured result**
    - **Validates: Requirements 1.1, 1.4**

  - [ ]* 2.3 Write property test for low-confidence clarification
    - **Property 2: Low-confidence prompts trigger clarification**
    - **Validates: Requirements 1.2**

  - [ ]* 2.4 Write property test for symbol extraction
    - **Property 3: Symbol extraction from prompts**
    - **Validates: Requirements 1.3**

  - [ ]* 2.5 Write unit tests for Intent Detector
    - Test classification of swing trade prompts → SWING_STOCK
    - Test classification of intraday prompts → INTRADAY_STOCK
    - Test classification of options prompts → OPTIONS_SCALPING
    - Test low-confidence prompt → needs_clarification=True
    - Test symbol extraction from "buy RELIANCE" → symbols=["RELIANCE"]
    - Test GPT-4 API failure retry behavior
    - _Requirements: 1.1, 1.2, 1.3, 8.1, 8.3_

- [ ] 3. Implement Risk Engine
  - [ ] 3.1 Create RiskEngine class with risk evaluation logic
    - Create `apps/quant/trading_lab/risk_engine.py`
    - Implement `def evaluate(self, entry_price, stop_loss, target_price, portfolio_value) -> RiskAssessment`
    - Calculate risk/reward ratio: (target - entry) / (entry - stop_loss)
    - Flag as high-risk when R:R < 1.5
    - Calculate position size: max_risk_amount (2% of portfolio) / risk_per_share
    - Handle edge cases: stop_loss == entry_price (division by zero), negative values
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 3.2 Write property test for position sizing
    - **Property 11: Position sizing respects 2% max risk**
    - **Validates: Requirements 7.4**

  - [ ]* 3.3 Write property test for recommendation structural completeness
    - **Property 6: Recommendation structural completeness with threshold-based flagging**
    - **Validates: Requirements 4.1, 4.2, 7.2, 7.3**

  - [ ]* 3.4 Write unit tests for Risk Engine
    - Test R:R calculation with known values (entry=100, SL=95, target=115 → R:R=3.0)
    - Test high-risk flag when R:R < 1.5
    - Test position sizing for 2% max risk
    - Test edge case: stop_loss equals entry_price
    - _Requirements: 7.2, 7.3, 7.4_

- [ ] 4. Implement Interaction Store
  - [ ] 4.1 Create InteractionStore class with in-memory storage
    - Create `apps/quant/trading_lab/interaction_store.py`
    - Implement `def persist(self, session_id, record: DecisionRecord) -> None`
    - Implement `def get_history(self, session_id, page, page_size) -> Tuple[List[DecisionRecord], int]`
    - Store records in dictionary keyed by session_id
    - Assign unique UUID decision_id and agent_id to each record
    - Return history ordered by created_at descending with pagination
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 4.2 Write property test for Decision Record integrity
    - **Property 8: Decision Record integrity**
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [ ]* 4.3 Write property test for history ordering
    - **Property 9: History ordering**
    - **Validates: Requirements 5.4**

  - [ ]* 4.4 Write unit tests for Interaction Store
    - Test persist and retrieve a decision record
    - Test history pagination (page=1, page_size=5 with 12 records)
    - Test descending order by created_at
    - Test unique decision_id across records
    - Test empty session returns empty list
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 5. Implement Response Formatter
  - [ ] 5.1 Create ResponseFormatter class with mode-specific formatting
    - Create `apps/quant/trading_lab/response_formatter.py`
    - Implement `def format(self, recommendation: Recommendation, mode: ResponseMode) -> str`
    - QUICK mode: signal, probability, R:R, key levels only
    - DETAILED mode: full technical analysis breakdown, indicator values, chart patterns
    - TRADER mode: entry, stop loss, targets, position sizing in actionable format
    - QUANT mode: numerical data, statistical metrics, probability distributions
    - COACH mode: educational explanations of indicator meanings
    - _Requirements: 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ]* 5.2 Write property test for response mode differentiation
    - **Property 7: Response mode content differentiation**
    - **Validates: Requirements 4.4, 4.5, 4.6, 4.7, 4.8**

  - [ ]* 5.3 Write unit tests for Response Formatter
    - Test QUICK mode contains only signal/probability/R:R/levels
    - Test DETAILED mode includes indicator breakdown
    - Test TRADER mode includes position sizing
    - Test QUANT mode emphasizes numerical metrics
    - Test COACH mode includes educational content
    - _Requirements: 4.4, 4.5, 4.6, 4.7, 4.8_

- [ ] 6. Implement Recommendation Engine
  - [ ] 6.1 Create RecommendationEngine class with GPT-4 synthesis
    - Create `apps/quant/trading_lab/recommendation_engine.py`
    - Implement `async def generate(self, analysis, risk_assessment, mode, portfolio_value) -> AsyncGenerator[str, None]`
    - Use GPT-4 to synthesize quant analysis into human-readable rationale
    - Apply low-confidence threshold: probability < 60% → label as low-confidence with warning
    - Apply high-risk threshold: R:R < 1.5 → flag as high-risk
    - Calculate position size using 2% max portfolio risk rule
    - Stream recommendation chunks for SSE delivery
    - Include market_data_timestamp in every recommendation
    - _Requirements: 4.1, 4.2, 4.3, 7.2, 7.3, 7.4, 3.1_

  - [ ]* 6.2 Write unit tests for Recommendation Engine
    - Test low-confidence warning when probability < 60%
    - Test high-risk flag when R:R < 1.5
    - Test streaming output generates valid chunks
    - Test market_data_timestamp is included
    - Test GPT-4 failure handling with retries
    - _Requirements: 4.1, 4.2, 4.3, 8.3_

- [ ] 7. Checkpoint - Ensure all backend component tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement Orchestration Pipeline
  - [ ] 8.1 Create Orchestrator class with intent-based service routing
    - Create `apps/quant/trading_lab/orchestrator.py`
    - Implement `async def execute(self, intent, response_mode, session_id) -> AsyncGenerator[str, None]`
    - Execute pipeline steps in order: market_selection → strategy_selection → data_fetch → quant_analysis → trendline_analysis → risk_evaluation → ai_reasoning → recommendation
    - Route SWING_STOCK to SwingScannerService + SwingScoringService
    - Route INTRADAY_STOCK to IntradayAnalysisService + IntradayScoringService
    - Route OPTIONS_SCALPING to AIAnalysisEngine (from scalper module)
    - Route PORTFOLIO_ANALYSIS to NestJS Paper Trading API (GET positions)
    - Route PAPER_TRADE to NestJS Paper Trading API (POST trade)
    - Route MARKET_ANALYSIS to ScoringService + TrendlineService
    - Yield SSE status events for each pipeline step
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ] 8.2 Implement stale data detection and re-fetch logic
    - Implement `_is_market_hours()` to check NSE hours (9:15-15:30 IST, weekdays)
    - Implement `_is_data_stale(timestamp)` to check if data > 5 minutes old
    - When data is stale during market hours, trigger re-fetch from Quant Engine
    - When Quant Engine is unreachable, return error refusing to generate stale recommendation
    - Include market_data_timestamp in every response
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ]* 8.3 Write property test for pipeline step ordering
    - **Property 4: Pipeline step ordering**
    - **Validates: Requirements 2.1**

  - [ ]* 8.4 Write property test for stale data detection
    - **Property 5: Stale data triggers re-fetch**
    - **Validates: Requirements 3.2**

  - [ ]* 8.5 Write property test for risk evaluation invariant
    - **Property 10: Risk evaluation invariant**
    - **Validates: Requirements 7.1**

  - [ ]* 8.6 Write integration tests for Orchestration Pipeline
    - Test full pipeline execution with mocked GPT-4 and quant services
    - Test SWING_STOCK routes to swing scanner
    - Test INTRADAY_STOCK routes to intraday service
    - Test OPTIONS_SCALPING routes to options scalper engine
    - Test stale data re-fetch during market hours
    - Test Quant Engine unreachable → error response
    - Test partial data handling with disclaimer
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.2, 3.3, 8.2_

- [ ] 9. Implement FastAPI Router with SSE streaming
  - [ ] 9.1 Create router with POST /api/ai-trading/prompt endpoint
    - Create `apps/quant/trading_lab/router.py`
    - Implement SSE streaming via FastAPI `StreamingResponse` with `text/event-stream` content type
    - Accept PromptRequest JSON body (prompt, response_mode, session_id)
    - Orchestrate: classify intent → execute pipeline → stream chunks → persist DecisionRecord
    - SSE event types: status (progress), chunk (text), recommendation (final JSON), error, done
    - Handle empty prompt with 400 response
    - _Requirements: 9.1, 9.4, 1.1, 2.1_

  - [ ] 9.2 Create GET /api/ai-trading/history endpoint
    - Accept query params: session_id (required), page (default 1), page_size (default 20, max 100)
    - Return paginated HistoryResponse with DecisionRecords
    - Return 404 for unknown session_id
    - _Requirements: 9.2, 5.4_

  - [ ] 9.3 Create POST /api/ai-trading/action endpoint
    - Accept ActionRequest JSON body (action, decision_id, session_id)
    - Handle ANALYZE_MARKET: submit follow-up analysis prompt for same symbol
    - Handle BUY_ON_PAPER: call NestJS paper trading service
    - Handle IGNORE: mark decision as ignored in store
    - Handle STOP: cancel pending pipeline execution
    - Return ActionResponse with success status and data
    - _Requirements: 9.3, 6.5, 6.6, 6.7, 6.8_

  - [ ] 9.4 Register trading_lab router in main FastAPI app
    - Import and include router in `apps/quant/main.py` (or equivalent entry point)
    - Ensure router prefix `/api/ai-trading` is registered
    - Verify no conflicts with existing routes
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ]* 9.5 Write integration tests for API endpoints
    - Test POST /prompt with valid request returns SSE stream
    - Test POST /prompt with empty prompt returns 400
    - Test GET /history returns paginated results
    - Test GET /history with unknown session returns 404
    - Test POST /action with ANALYZE_MARKET triggers follow-up
    - Test POST /action with BUY_ON_PAPER calls paper trade service
    - Test SSE event format (event type + data fields)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 8.4_

- [ ] 10. Checkpoint - Ensure all backend tests pass and API endpoints work
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Implement Frontend Chat Interface page and state management
  - [ ] 11.1 Create AI Trading page and core chat state
    - Create `apps/web/app/ai-trading/page.tsx` with Next.js App Router page component
    - Create `apps/web/components/trading-lab/types.ts` with TypeScript interfaces (ChatMessage, RecommendationData, PromptRequestBody, ActionRequestBody, HistoryResponseBody, ResponseMode, SignalDirection, ActionType)
    - Implement ChatState: messages array, isLoading flag, responseMode, sessionId (UUID), abortController
    - Generate session_id on page mount, persist in sessionStorage
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ] 11.2 Create SSE streaming hook for prompt submission
    - Create `apps/web/components/trading-lab/use-sse-stream.ts` custom hook
    - Use fetch with ReadableStream to consume SSE events from POST /api/ai-trading/prompt
    - Parse SSE events: status → show progress, chunk → append to message, recommendation → parse structured data, error → display error, done → finalize
    - Support AbortController for cancellation (STOP action)
    - Update messages incrementally as chunks arrive (streaming display)
    - _Requirements: 9.4, 6.8_

  - [ ] 11.3 Create ChatInput component with prompt submission
    - Create `apps/web/components/trading-lab/chat-input.tsx`
    - Display text input for natural-language prompts
    - Handle Enter key and submit button to trigger prompt
    - Disable input while loading/streaming
    - Validate non-empty prompt before submission
    - _Requirements: 6.2_

- [ ] 12. Implement Frontend Chat UI components
  - [ ] 12.1 Create MessageList component with conversation history
    - Create `apps/web/components/trading-lab/message-list.tsx`
    - Display user prompts and assistant recommendations in chronological order
    - Show streaming indicator when response is being generated
    - Auto-scroll to latest message
    - Render markdown-formatted recommendation content
    - _Requirements: 6.3_

  - [ ] 12.2 Create ResponseModeSelector component
    - Create `apps/web/components/trading-lab/response-mode-selector.tsx`
    - Display selectable mode options: QUICK, DETAILED, TRADER, QUANT, COACH
    - Persist selected mode in component state
    - Pass selected mode with each prompt request
    - _Requirements: 6.4_

  - [ ] 12.3 Create ActionButtons component for recommendations
    - Create `apps/web/components/trading-lab/action-buttons.tsx`
    - Display buttons: ANALYZE MARKET, BUY ON PAPER, IGNORE, STOP
    - ANALYZE MARKET: submit follow-up market analysis prompt for same symbol
    - BUY ON PAPER: call POST /api/ai-trading/action with BUY_ON_PAPER and decision_id
    - IGNORE: dismiss recommendation
    - STOP: abort current AbortController to cancel streaming
    - Disable BUY ON PAPER while action is in progress
    - Display success/error feedback for paper trade actions
    - _Requirements: 6.5, 6.6, 6.7, 6.8, 8.4_

  - [ ] 12.4 Create RecommendationCard component for structured display
    - Create `apps/web/components/trading-lab/recommendation-card.tsx`
    - Display signal direction (BUY/SELL/HOLD) with color coding
    - Display probability percentage, risk/reward ratio
    - Display entry price, stop loss, target price, position size
    - Show low-confidence warning when applicable
    - Show high-risk flag when applicable
    - Display market_data_timestamp
    - _Requirements: 4.1, 4.2, 7.3, 3.1_

  - [ ]* 12.5 Write unit tests for frontend components
    - Test ChatInput submission and validation
    - Test MessageList renders user and assistant messages
    - Test ResponseModeSelector mode switching
    - Test ActionButtons click handlers
    - Test RecommendationCard displays all fields
    - Test SSE hook parses events correctly
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6_

- [ ] 13. Implement error handling and resilience in frontend
  - [ ] 13.1 Create error handling UI and retry logic
    - Display user-friendly error messages for intent detection failures ("Try rephrasing your prompt")
    - Display "Market data unavailable" when Quant Engine is unreachable
    - Show "Retrying..." indicator during GPT-4 retry attempts
    - Display paper trade failure reason with retry button
    - Handle SSE connection drops gracefully (show last content + "connection lost")
    - Handle session expiry (prompt page refresh)
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Backend follows existing patterns from `apps/quant/scalper/` (Pydantic models, FastAPI routers, async operations)
- Frontend follows Next.js App Router conventions at `apps/web/app/ai-trading/`
- SSE streaming uses `text/event-stream` content type with structured event types
- In-memory session store follows same pattern as scalper module (can migrate to DB later)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "3.1", "4.1", "5.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "3.2", "3.3", "3.4", "4.2", "4.3", "4.4", "5.2", "5.3"] },
    { "id": 3, "tasks": ["6.1"] },
    { "id": 4, "tasks": ["6.2", "8.1"] },
    { "id": 5, "tasks": ["8.2", "8.3", "8.4", "8.5", "8.6"] },
    { "id": 6, "tasks": ["9.1", "9.2", "9.3", "9.4"] },
    { "id": 7, "tasks": ["9.5", "11.1"] },
    { "id": 8, "tasks": ["11.2", "11.3"] },
    { "id": 9, "tasks": ["12.1", "12.2", "12.3", "12.4"] },
    { "id": 10, "tasks": ["12.5", "13.1"] }
  ]
}
```
