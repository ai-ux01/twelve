# Implementation Plan: ProfitTerminal

## Overview

This implementation plan builds ProfitTerminal incrementally across four major phases. Each phase is fully tested and validated before proceeding to the next. The system enforces strict architectural separation: AI_Service cannot access Market_Data_Provider or Broker_API directly. All data flows through deterministic Quant_Engine, then Risk_Engine validation, then user confirmation for live trades.

**Technology Stack:**

- Frontend: Next.js 14+ with TypeScript, Tailwind CSS, shadcn/ui, TradingView Lightweight Charts (localhost:3000)
- Backend: NestJS 10+ with TypeScript, Prisma ORM (localhost:4000)
- Quant Engine: Python 3.11+, FastAPI, Pandas, NumPy, TA-Lib (localhost:8000)
- Database: PostgreSQL 15+ (localhost:5432)

**Critical Architectural Constraints:**

1. AI_Service has NO direct access to Market_Data_Provider or Broker_API
2. Data flow: Market → Quant → AI → Risk → User → Broker
3. All trades require Risk_Engine validation
4. Live trades require explicit user confirmation

## Tasks

### Phase 1: Foundation and Infrastructure

- [x] 1. Set up project structure and development environment
  - [x] 1.1 Initialize monorepo with Next.js frontend, NestJS backend, Python Quant Engine
    - Create Next.js 14+ app with App Router at `frontend/`
    - Create NestJS 10+ application at `backend/`
    - Create Python 3.11+ FastAPI project at `quant_engine/`
    - Set up Docker Compose for PostgreSQL only
    - Configure environment variables for all services
    - Set up TypeScript config with strict mode
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.2 Install and configure core dependencies
    - Frontend: Install Next.js, TypeScript, Tailwind CSS, shadcn/ui, Zustand, TanStack Query
    - Backend: Install NestJS, Prisma, class-validator, class-transformer
    - Quant: Install FastAPI, Pandas, NumPy, TA-Lib, SciPy, Pydantic
    - Configure ESLint, Prettier for TypeScript projects
    - Configure Black, Flake8 for Python project
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.3 Set up PostgreSQL database with Prisma schema
    - Create Prisma schema with all models: User, UserConfig, Position, Trade, Recommendation, Strategy, MarketDataCache, AuditLog
    - Define enums: AssetType, TradeType, PositionStatus, TradeAction, TradeStatus, RecommendationOutcome
    - Configure indexes for performance
    - Run Prisma migration to create database tables
    - Generate Prisma client
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [x] 1.4 Create shared TypeScript type definitions
    - Define API request/response types: ParsedPrompt, QuantAnalysisResult, Recommendation, RiskValidationResult
    - Define trade types: TradeRequest, TradeResult
    - Define portfolio types: Portfolio, Position
    - Export types for use across frontend and backend
    - _Requirements: 3.8, 4.7, 8.5_

- [x] 2. Checkpoint - Verify infrastructure setup
  - Ensure all services can start without errors
  - Verify PostgreSQL connection from Backend
  - Run formatter, linter, and type checks on all code
  - Ask the user if questions arise

### Phase 2: Quant Engine - Deterministic Analysis Layer

- [x] 3. Implement Quant Engine technical indicator calculations
  - [x] 3.1 Create Pydantic models for Quant Engine
    - Define OHLCVData, MarketDataRequest, IndicatorResult, TrendlineResult, SupportResistanceLevel, AnalysisResult models
    - Add validation for price data (high >= low, etc.)
    - _Requirements: 3.8_

  - [x] 3.2 Implement RSI (Relative Strength Index) calculator
    - Create `calculators/rsi.py` with standard 14-period RSI calculation
    - Return value between 0-100
    - _Requirements: 3.2_

  - [x]* 3.3 Write property test for RSI bounds
    - **Property 2: Technical Indicator Calculation Correctness (RSI component)**
    - **Validates: Requirements 3.2**

  - [x] 3.4 Implement MACD calculator
    - Create `calculators/macd.py` with 12-period EMA, 26-period EMA, 9-period signal line
    - Return MACD line, signal line, and histogram
    - _Requirements: 3.3_

  - [x]* 3.5 Write property test for MACD relationship
    - **Property 2: Technical Indicator Calculation Correctness (MACD component)**
    - **Validates: Requirements 3.3**

  - [x] 3.6 Implement moving averages (SMA, EMA)
    - Create `calculators/moving_averages.py` for Simple and Exponential Moving Averages
    - Support configurable periods (20, 50, 200)
    - _Requirements: 3.4_

  - [x]* 3.7 Write property test for moving average bounds
    - **Property 3: Moving Average Invariants**
    - **Validates: Requirements 3.4**

  - [x] 3.8 Implement Bollinger Bands calculator
    - Create `calculators/bollinger_bands.py` with 20-period SMA ± 2 standard deviations
    - Return upper, middle, lower bands
    - _Requirements: 3.5_

  - [x]* 3.9 Write property test for Bollinger Bands ordering
    - **Property 2: Technical Indicator Calculation Correctness (Bollinger Bands component)**
    - **Validates: Requirements 3.5**

- [x] 4. Implement Quant Engine trendline and support/resistance detection
  - [x] 4.1 Implement support/resistance level detection
    - Create `services/support_resistance_service.py`
    - Use clustering algorithm on local price extrema
    - Return levels with strength scores
    - _Requirements: 3.6_

  - [x] 4.2 Implement trendline detection
    - Create `services/trendline_service.py`
    - Use linear regression on swing highs/lows with SciPy
    - Return slope, intercept, R² value
    - _Requirements: 3.7_

  - [x] 4.3 Implement Options Greeks calculator
    - Create `calculators/greeks.py` using Black-Scholes model
    - Calculate Delta, Gamma, Theta, Vega for options
    - _Requirements: 7.3_

- [x] 5. Create Quant Engine FastAPI endpoints
  - [x] 5.1 Implement main analysis endpoint POST /analyze
    - Orchestrate all indicator calculations and trendline detection
    - Accept MarketDataRequest with OHLCV data
    - Return complete AnalysisResult
    - _Requirements: 3.1, 3.8_

  - [x] 5.2 Implement indicators endpoint POST /indicators
    - Calculate specific technical indicators on demand
    - _Requirements: 3.1_

  - [x] 5.3 Implement trendlines endpoint POST /trendlines
    - Detect support/resistance and trendlines
    - _Requirements: 3.6, 3.7_

  - [x] 5.4 Implement options Greeks endpoint POST /options/greeks
    - Calculate options Greeks for given contracts
    - _Requirements: 7.3_

  - [x]* 5.5 Write unit tests for Quant Engine endpoints
    - Test all endpoints with valid and invalid input
    - Verify error handling for malformed data
    - _Requirements: 16.5_

- [x] 6. Checkpoint - Verify Quant Engine functionality
  - Start Quant Engine on localhost:8000
  - Manually test /analyze endpoint with sample OHLCV data
  - Verify all technical indicators return valid values
  - Run all Quant Engine tests (unit + property-based)
  - Run Python formatter (Black) and linter (Flake8)
  - Ask the user if questions arise

### Phase 3: Backend API - Data Orchestration and Business Logic

- [x] 7. Set up Backend NestJS modules and dependency injection
  - [x] 7.1 Create core NestJS modules
    - Create modules: ConfigModule, DatabaseModule (Prisma), MarketDataModule, QuantModule, AiModule, RiskModule, TradingModule, PortfolioModule, PromptModule
    - Configure dependency injection following architectural constraints
    - **CRITICAL**: Ensure AiModule does NOT inject MarketDataService or any Broker provider
    - _Requirements: 18.1, 18.2, 18.3_

  - [x] 7.2 Implement Prisma service and database module
    - Create `database/prisma.service.ts` with connection lifecycle
    - Export PrismaModule for use across app
    - _Requirements: 12.5_

  - [x] 7.3 Create configuration service for environment variables
    - Load DATABASE_URL, KITE_API_KEY, KOTAK_API_KEY, AI_PROVIDER, AI_API_KEY
    - Validate required environment variables on startup
    - _Requirements: 17.1, 17.2_

- [x] 8. Implement natural language prompt parsing
  - [x] 8.1 Create PromptService for natural language parsing
    - Parse user prompt to extract intent (FIND_TRADE, ANALYZE_PORTFOLIO, GENERATE_STRATEGY)
    - Extract trading symbols using regex patterns
    - Extract timeframe (swing, intraday, scalping)
    - Extract asset type (stock, options)
    - Return structured ParsedPrompt object
    - _Requirements: 19.1, 19.2, 19.3, 19.4_

  - [x]* 8.2 Write property test for symbol extraction consistency
    - **Property 5: Prompt Parsing Consistency**
    - **Validates: Requirements 19.2**

  - [x]* 8.3 Write property test for timeframe extraction consistency
    - **Property 6: Timeframe Extraction Consistency**
    - **Validates: Requirements 19.3**

  - [x]* 8.4 Write property test for asset type extraction consistency
    - **Property 7: Asset Type Extraction Consistency**
    - **Validates: Requirements 19.4**

- [x] 9. Implement Market Data service with caching
  - [x] 9.1 Create MarketDataService with Kite Connect provider
    - Implement `providers/kite-connect.provider.ts` for Kite Connect API
    - Fetch NSE stock OHLCV data
    - Fetch NIFTY and BANKNIFTY options chain
    - Implement retry with exponential backoff (max 3 attempts)
    - Implement circuit breaker pattern (5 failures → 30s cooldown)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 20.1_

  - [x] 9.2 Implement market data caching with 60-second TTL
    - Store market data in MarketDataCache table
    - Check cache before calling external API
    - Respect 60-second expiration
    - _Requirements: 2.6_

  - [x]* 9.3 Write property test for cache TTL enforcement
    - **Property 1: Cache TTL Enforcement**
    - **Validates: Requirements 2.6**

  - [x]* 9.4 Write unit tests for market data service error handling
    - Test API failures with retry logic
    - Test cache fallback when API unavailable
    - Test circuit breaker behavior
    - _Requirements: 20.1, 20.2_

- [x] 10. Implement Quant service HTTP client
  - [x] 10.1 Create QuantService HTTP client to Quant Engine
    - Implement HTTP client to localhost:8000
    - Call POST /analyze with market data
    - Parse AnalysisResult response
    - Implement timeout (10 seconds) and retry logic (no retry for deterministic calculations)
    - Handle Quant Engine failures gracefully
    - _Requirements: 3.1, 3.8, 20.2_

  - [x]* 10.2 Write property test for quantitative analysis serialization round-trip
    - **Property 4: Quantitative Analysis Serialization Round-Trip**
    - **Validates: Requirements 3.8**

  - [x]* 10.3 Write unit tests for Quant service error handling
    - Test timeout handling
    - Test malformed response handling
    - Verify no retry on calculation errors
    - _Requirements: 20.2_

- [x] 11. Implement AI service with provider abstraction
  - [x] 11.1 Create AiService with OpenAI provider
    - Implement `providers/openai.provider.ts` for external AI API
    - Build structured prompts with quantitative results (NOT raw market data)
    - Parse AI responses into Recommendation objects
    - Implement retry logic (retry once after 2 seconds)
    - **CRITICAL**: Ensure this service NEVER receives raw market data, only quant results
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 18.1_

  - [x] 11.2 Create PromptBuilderService for structured AI prompts
    - Build prompts that include quantitative analysis, user intent, portfolio state
    - Never include raw OHLCV data in prompts
    - _Requirements: 4.2, 4.4_

  - [x] 11.3 Add Ollama provider for local LLM support
    - Implement `providers/ollama.provider.ts` for local inference
    - Make provider selection configurable via AI_PROVIDER env variable
    - _Requirements: 17.4_

  - [x]* 11.4 Write unit tests for AI service error handling
    - Test retry logic on AI failure
    - Test fallback behavior when AI unavailable
    - Verify AI only receives quant results, not raw market data
    - _Requirements: 20.3, 18.1_

- [x] 12. Implement Risk Engine validation
  - [x] 12.1 Create RiskService with validation rules
    - Implement position size validation (price × quantity ≤ maxPositionSize)
    - Implement stop loss placement validation (stopLoss < entryPrice for BUY, stopLoss > entryPrice for SELL)
    - Implement portfolio exposure validation (total exposure ≤ maxPortfolioExposure)
    - Implement maximum drawdown validation
    - Return RiskValidationResult with violations
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x]* 12.2 Write property test for position size validation
    - **Property 8: Risk Engine Position Size Validation**
    - **Validates: Requirements 8.1**

  - [x]* 12.3 Write property test for stop loss placement validation
    - **Property 9: Stop Loss Placement Validation**
    - **Validates: Requirements 8.2**

  - [x]* 12.4 Write property test for portfolio exposure validation
    - **Property 10: Portfolio Exposure Validation**
    - **Validates: Requirements 8.3**

  - [x]* 12.5 Write property test for risk validation failure reason
    - **Property 11: Risk Validation Failure Produces Reason**
    - **Validates: Requirements 8.5**

- [x] 13. Implement paper trading service
  - [x] 13.1 Create PaperTradingService
    - Record paper trades in database (Trade table with isPaper=true)
    - Simulate trade execution with realistic slippage (0-1% of price)
    - Create or update Position entries
    - Do NOT call broker API for paper trades
    - _Requirements: 9.1, 9.2, 9.5_

  - [x]* 13.2 Write property test for paper trade persistence round-trip
    - **Property 12: Paper Trade Persistence Round-Trip**
    - **Validates: Requirements 9.1**

  - [ ]* 13.3 Write property test for paper trade slippage bounds
    - **Property 13: Paper Trade Slippage Bounds**
    - **Validates: Requirements 9.2**

  - [ ]* 13.4 Write unit test verifying paper trades never call broker API
    - Mock broker provider and verify it's never called for paper trades
    - _Requirements: 9.5_

- [x] 14. Implement portfolio management service
  - [x] 14.1 Create PortfolioService
    - Retrieve all open positions from database
    - Calculate unrealized PnL for each position: (currentPrice - entryPrice) × quantity
    - Calculate portfolio-level metrics: totalValue, totalPnL, dailyPnL, exposure, win rate
    - Update position current prices from market data
    - _Requirements: 11.1, 11.2, 11.3_

  - [ ]* 14.2 Write property test for PnL calculation accuracy
    - **Property 14: PnL Calculation Accuracy**
    - **Validates: Requirements 9.3, 11.2**

  - [ ]* 14.3 Write property test for position update idempotency
    - **Property 15: Position Update Idempotency**
    - **Validates: Requirements 9.4**

  - [ ]* 14.4 Write property test for position retrieval completeness
    - **Property 17: Position Retrieval Completeness**
    - **Validates: Requirements 11.1**

  - [ ]* 14.5 Write property test for portfolio metrics consistency
    - **Property 18: Portfolio Metrics Consistency**
    - **Validates: Requirements 11.3**

- [x] 15. Create Backend REST API controllers
  - [x] 15.1 Create PromptController for POST /api/prompt
    - Accept user prompt
    - Orchestrate: PromptService → MarketDataService → QuantService → AiService
    - Return parsed prompt and recommendation
    - **CRITICAL**: Ensure AI only receives quant results, not raw market data
    - _Requirements: 4.1, 4.2, 18.3_

  - [x] 15.2 Create PortfolioController for GET /api/portfolio
    - Return complete portfolio with positions and metrics
    - _Requirements: 11.1, 11.5_

  - [x] 15.3 Create TradingController for POST /api/trade/paper
    - Validate trade with RiskService
    - Execute paper trade via PaperTradingService
    - Return trade result
    - _Requirements: 9.1_

  - [x] 15.4 Create RiskController for POST /api/risk/validate
    - Accept trade request
    - Return risk validation result
    - _Requirements: 8.1, 8.5_

  - [ ]* 15.5 Write integration tests for all Backend controllers
    - Test POST /api/prompt with mocked external services
    - Test GET /api/portfolio with test database
    - Test POST /api/trade/paper end-to-end
    - Test POST /api/risk/validate with various trade scenarios
    - _Requirements: 16.6_

- [x] 16. Checkpoint - Verify Backend API functionality
  - Start Backend API on localhost:4000
  - Start Quant Engine on localhost:8000
  - Manually test POST /api/prompt with sample prompt
  - Verify data flow: MarketData → Quant → AI → Risk
  - Verify AI service does NOT receive raw market data
  - Run all Backend tests (unit + property-based + integration)
  - Run TypeScript type checks, linter, and formatter
  - Ask the user if questions arise

### Phase 4: Frontend, Live Trading, and System Integration

- [x] 17. Build Next.js frontend application structure
  - [x] 17.1 Create Next.js App Router pages and layouts
    - Create `app/layout.tsx` with root layout
    - Create `app/page.tsx` as main dashboard
    - Create `app/portfolio/page.tsx` for portfolio view
    - Create `app/analysis/page.tsx` for analysis interface
    - _Requirements: 13.1_

  - [x] 17.2 Set up shadcn/ui component library
    - Initialize shadcn/ui
    - Install core components: Button, Input, Card, Dialog, Table
    - Configure Tailwind CSS theme
    - _Requirements: 13.5_

  - [x] 17.3 Create API client service
    - Implement `lib/api-client.ts` with typed methods for all Backend endpoints
    - Configure base URL (http://localhost:4000)
    - _Requirements: 13.1_

  - [x] 17.4 Set up Zustand stores for client state
    - Create `stores/ui-store.ts` for UI state (theme, sidebar)
    - Create `stores/auth-store.ts` for authentication state
    - _Requirements: 13.6_

  - [x] 17.5 Set up TanStack Query for server state management
    - Configure QueryClient with default options
    - Define query keys by domain: market, portfolio, recommendations
    - _Requirements: 13.6_

- [x] 18. Implement core frontend UI components
  - [x] 18.1 Create PromptInput component
    - Natural language text input field
    - Submit button to send prompt to Backend
    - Display parsing feedback (extracted symbols, timeframe)
    - _Requirements: 13.1, 13.2_

  - [x] 18.2 Create RecommendationCard component
    - Display AI recommendation: action, symbol, entry, target, stop-loss, confidence
    - Show quantitative analysis summary
    - Show AI reasoning text
    - Include "Execute Paper Trade" button
    - Include "Execute Live Trade" button (for Phase 4)
    - _Requirements: 13.2_

  - [x] 18.3 Create PortfolioTable component
    - Display all open positions in table format
    - Show symbol, quantity, entry price, current price, unrealized PnL, PnL%
    - Color-code profit (green) and loss (red)
    - Update in real-time using TanStack Query refetch
    - _Requirements: 13.4, 11.5_

  - [x] 18.4 Create ChartViewer component with TradingView Lightweight Charts
    - Wrap TradingView Lightweight Charts library
    - Display candlestick chart for selected symbol
    - Overlay technical indicators (SMA, EMA)
    - Annotate support/resistance levels
    - Draw trendlines from quant analysis
    - _Requirements: 13.3_

- [x] 19. Wire frontend to backend API
  - [x] 19.1 Connect PromptInput to POST /api/prompt
    - Submit user prompt on button click
    - Display loading state during API call
    - Display RecommendationCard with result
    - Handle API errors gracefully
    - _Requirements: 4.1, 13.1_

  - [x] 19.2 Connect PortfolioTable to GET /api/portfolio
    - Fetch portfolio on component mount
    - Auto-refetch every 10 seconds for real-time PnL
    - Display loading and error states
    - _Requirements: 11.1, 11.5_

  - [x] 19.3 Connect paper trade button to POST /api/trade/paper
    - Send trade request on "Execute Paper Trade" button click
    - Display success/failure message
    - Refresh portfolio after successful trade
    - _Requirements: 9.1_

  - [ ]* 19.4 Write E2E tests for paper trading flow
    - Test complete flow: submit prompt → receive recommendation → execute paper trade → verify in portfolio
    - Use Playwright for browser automation
    - _Requirements: 16.6_

- [x] 20. Implement live trading with Kotak Neo broker
  - [x] 20.1 Create Kotak Neo broker provider
    - Implement `brokers/kotak-neo.provider.ts`
    - Implement placeOrder method to send orders to Kotak Neo API
    - Implement getOrderStatus method to fetch execution status
    - Handle broker API errors and return meaningful error messages
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 20.2 Create TradingService for live trade execution
    - Enforce user confirmation check (userConfirmed flag)
    - Validate trade with RiskService before sending to broker
    - Call Kotak Neo provider to place order
    - Store trade execution details in database with brokerOrderId
    - **CRITICAL**: Ensure AI cannot bypass this service
    - _Requirements: 10.1, 10.2, 10.4, 10.6, 18.2, 18.4_

  - [ ]* 20.3 Write property test for live trade execution persistence
    - **Property 16: Live Trade Execution Persistence**
    - **Validates: Requirements 10.6**

  - [ ]* 20.4 Write unit test verifying AI cannot execute trades directly
    - Verify AiService has no dependency on TradingService or broker providers
    - Test architectural constraint enforcement
    - _Requirements: 10.7, 18.2_

  - [x] 20.5 Create TradingController endpoint POST /api/trade/live
    - Accept trade request with userConfirmed flag
    - Reject if userConfirmed is false
    - Validate with RiskService
    - Execute via TradingService
    - Return trade result with broker order ID
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 21. Implement user confirmation dialog for live trades
  - [x] 21.1 Create TradeConfirmationDialog component
    - Modal dialog with trade details: symbol, action, quantity, price, stop-loss, target
    - Display risk validation result
    - Show portfolio impact estimate
    - "Confirm" button to proceed
    - "Cancel" button to abort
    - _Requirements: 10.1, 10.2_

  - [x] 21.2 Wire "Execute Live Trade" button to confirmation dialog
    - Open dialog on button click
    - On confirm, call POST /api/trade/live with userConfirmed=true
    - Display success/failure message
    - Refresh portfolio after successful trade
    - _Requirements: 10.1, 10.2, 10.3_

  - [ ]* 21.3 Write E2E test for live trade user confirmation flow
    - Test that live trade button opens confirmation dialog
    - Test that trade is NOT executed if user cancels
    - Test that trade IS executed if user confirms
    - _Requirements: 10.1, 10.2_

- [x] 22. Implement WebSocket for real-time market data updates
  - [x] 22.1 Create WebSocket gateway in Backend
    - Implement WebSocket server at ws://localhost:4000
    - Handle client subscriptions to symbols
    - Push real-time price updates to subscribed clients
    - Push portfolio PnL updates
    - _Requirements: 13.6_

  - [x] 22.2 Create WebSocket client in Frontend
    - Implement `lib/websocket.ts` client
    - Subscribe to symbols when chart is viewed
    - Update chart data on price updates
    - Update portfolio PnL on portfolio updates
    - _Requirements: 13.6_

- [x] 23. Implement audit logging for data flow enforcement
  - [x] 23.1 Create AuditLogService in Backend
    - Log all service-to-service calls to AuditLog table
    - Record: service name, action, payload (no sensitive data), success/failure
    - _Requirements: 18.6_

  - [x] 23.2 Add audit logging to critical paths
    - Log all Market Data API calls
    - Log all Quant Engine calls
    - Log all AI Service calls
    - Log all Risk Engine validations
    - Log all Broker API calls
    - _Requirements: 18.6_

  - [ ]* 23.3 Write architectural constraint test for AI data flow
    - Verify AI service only receives quant results from audit logs
    - Verify no direct Market Data → AI calls in audit logs
    - Verify no direct AI → Broker calls in audit logs
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

- [x] 24. Add error handling and retry logic across all services
  - [x] 24.1 Implement exponential backoff retry for Market Data API
    - Already implemented in Phase 3, verify it works end-to-end
    - _Requirements: 20.1_

  - [x] 24.2 Implement circuit breaker for Broker API
    - Add circuit breaker to Kotak Neo provider (5 failures → 30s cooldown)
    - _Requirements: 20.4_

  - [x] 24.3 Implement graceful degradation for AI failures
    - Return quantitative analysis without AI reasoning if AI fails
    - Display "AI analysis unavailable" in frontend
    - _Requirements: 20.3_

  - [ ]* 24.4 Write unit tests for all error handling scenarios
    - Test Market Data retry and cache fallback
    - Test Quant Engine failure handling
    - Test AI retry and graceful degradation
    - Test Broker circuit breaker
    - _Requirements: 20.1, 20.2, 20.3, 20.4_

- [x] 25. Final checkpoint - Complete system integration and testing
  - Start all services: PostgreSQL, Quant Engine, Backend API, Frontend
  - Test complete user flow: prompt → recommendation → paper trade → portfolio update
  - Test complete live trade flow with confirmation dialog
  - Verify architectural constraints: AI cannot access Market Data or Broker APIs
  - Run all tests: unit, property-based, integration, E2E
  - Generate test coverage report (target: 80% line coverage)
  - Run all formatters: Prettier (TypeScript), Black (Python)
  - Run all linters: ESLint (TypeScript), Flake8 (Python)
  - Run all type checks: TypeScript compiler (tsc --noEmit)
  - Verify all 18 correctness properties are tested
  - Ask the user if questions arise

### Phase 4 Enhancements: Advanced Indicators and Scoring

- [x] 26. Implement additional technical indicators
  - [x] 26.1 Implement ADX (Average Directional Index) calculator
    - Create `calculators/adx.py` with standard 14-period ADX calculation
    - Calculate +DI, -DI, and ADX from high, low, close prices
    - Return ADX value (0-100, >25 indicates strong trend)
    - _Requirements: 3.2_

  - [ ]* 26.2 Write unit tests for ADX calculator
    - Test with known values
    - Test edge cases (low volatility, high volatility)
    - Verify ADX bounds (0-100)
    - _Requirements: 3.2_

  - [x] 26.3 Implement ATR (Average True Range) calculator
    - Create `calculators/atr.py` with 14-period ATR calculation
    - Calculate True Range from high, low, close
    - Return ATR value (absolute volatility measure)
    - _Requirements: 3.2_

  - [ ]* 26.4 Write unit tests for ATR calculator
    - Test with known values
    - Test that ATR is always positive
    - Test with varying volatility levels
    - _Requirements: 3.2_

  - [x] 26.5 Implement VWAP (Volume Weighted Average Price) calculator
    - Create `calculators/vwap.py` for intraday VWAP calculation
    - Calculate cumulative (price * volume) / cumulative volume
    - Support intraday resets at session start
    - _Requirements: 3.2_

  - [ ]* 26.6 Write unit tests for VWAP calculator
    - Test with varying volume profiles
    - Test that VWAP stays within price range
    - Test session reset logic
    - _Requirements: 3.2_

  - [x] 26.7 Implement volume analysis calculators
    - Create `calculators/volume_analysis.py`
    - Implement volume moving average (20-period)
    - Implement relative volume (current vs average)
    - Calculate volume ratio indicator
    - _Requirements: 3.2_

  - [ ]* 26.8 Write unit tests for volume analysis
    - Test volume moving average calculation
    - Test relative volume ratio bounds
    - Test with zero volume edge case
    - _Requirements: 3.2_

  - [x] 26.9 Implement price range calculators
    - Create `calculators/price_range.py`
    - Calculate 52-week high and low from historical data
    - Calculate distance from 52-week high/low (percentage)
    - Implement momentum indicator (rate of change)
    - _Requirements: 3.2_

  - [ ]* 26.10 Write unit tests for price range calculators
    - Test 52-week high/low detection
    - Test percentage distance calculations
    - Test momentum indicator accuracy
    - _Requirements: 3.2_

- [x] 27. Implement additional EMA periods
  - [x] 27.1 Add EMA 5, 15, 50, 200 to IndicatorResult model
    - Update `models/market_data.py` to include ema_5, ema_15, ema_50, ema_200 fields
    - Add validation (gt=0 for all EMA values)
    - Update model examples
    - _Requirements: 3.4_

  - [x] 27.2 Calculate multiple EMA periods in indicators endpoint
    - Update POST /indicators to calculate EMA 5, 15, 50, 200 using existing calculator
    - Update POST /analyze to include all new EMA values
    - _Requirements: 3.4_

  - [ ]* 27.3 Write unit tests for multiple EMA calculation
    - Test all EMA periods are calculated correctly
    - Test ordering: shorter periods react faster to price changes
    - _Requirements: 3.4_

- [x] 28. Update Quant Engine endpoints with new structure
  - [x] 28.1 Change POST /indicators to GET /quant/indicators
    - Create new GET endpoint at /quant/indicators
    - Return list of all available indicators with descriptions
    - Return JSON: `{"indicators": [{"name": "RSI", "description": "...", "parameters": {...}}, ...]}`
    - Mark old POST /indicators as deprecated but keep functional
    - _Requirements: 3.1_

  - [x] 28.2 Change POST /analyze to POST /quant/analyze
    - Create new POST endpoint at /quant/analyze
    - Move existing /analyze logic to new endpoint
    - Include all new indicators (ADX, ATR, VWAP, volume analysis, EMA variants)
    - Update AnalysisResult model to include new fields
    - Mark old POST /analyze as deprecated but keep functional
    - _Requirements: 3.1, 3.8_

  - [x] 28.3 Implement POST /quant/score endpoint for deterministic scoring
    - Create new scoring endpoint that returns structured analysis
    - Calculate trend classification (BULLISH/BEARISH/NEUTRAL) based on indicators
    - Generate deterministic score (0-100) using weighted indicator formula
    - Return structured JSON with: trend, rsi, adx, vwap, volumeRatio, score, signals array
    - **CRITICAL**: All calculations must be deterministic (no AI)
    - _Requirements: 3.1, 4.1_

  - [ ]* 28.4 Write unit tests for scoring endpoint
    - Test trend classification logic
    - Test score calculation (verify deterministic)
    - Test signals generation
    - Test edge cases (neutral markets, extreme values)
    - _Requirements: 3.1_

- [x] 29. Update IndicatorResult and AnalysisResult models
  - [x] 29.1 Add new indicator fields to IndicatorResult
    - Add ema_5, ema_15, ema_50, ema_200 (float, gt=0)
    - Add adx (float, ge=0, le=100)
    - Add atr (float, gt=0)
    - Add vwap (float, gt=0)
    - Add volume_ma (float, ge=0)
    - Add relative_volume (float, ge=0)
    - Add week_52_high, week_52_low (float, gt=0)
    - Add momentum (float)
    - Update model examples and validation
    - _Requirements: 3.8_

  - [x] 29.2 Create ScoreResult model for scoring endpoint
    - Define Pydantic model with: trend (enum: BULLISH/BEARISH/NEUTRAL), rsi, adx, vwap, volumeRatio, score, signals (List[str])
    - Add field validation (score: 0-100, volumeRatio >= 0)
    - Add comprehensive examples
    - _Requirements: 3.8_

- [x] 30. Implement deterministic scoring algorithm
  - [x] 30.1 Create scoring service
    - Create `services/scoring_service.py`
    - Implement trend classification logic:
      - BULLISH: price > EMA 20, 50, 200 && RSI > 50 && ADX > 20
      - BEARISH: price < EMA 20, 50, 200 && RSI < 50 && ADX > 20
      - NEUTRAL: otherwise or weak ADX (< 20)
    - Implement weighted scoring formula combining RSI, ADX, VWAP position, volume ratio
    - Generate human-readable signal strings
    - _Requirements: 4.1_

  - [ ]* 30.2 Write property tests for scoring determinism
    - **Property 19: Scoring Determinism**
    - **Validates**: Same input always produces same score
    - Test with multiple identical requests
    - _Requirements: 4.1_

  - [ ]* 30.3 Write unit tests for scoring algorithm
    - Test trend classification with various indicator combinations
    - Test score bounds (0-100)
    - Test signal generation logic
    - Test edge cases (missing data, extreme values)
    - _Requirements: 4.1_

- [x] 31. Wire new endpoints to main FastAPI app
  - [x] 31.1 Update main.py with new routes
    - Add GET /quant/indicators handler
    - Add POST /quant/analyze handler (with all new indicators)
    - Add POST /quant/score handler
    - Maintain backward compatibility with old endpoints
    - Update API documentation strings
    - _Requirements: 3.1_

  - [x] 31.2 Update CORS and middleware configuration
    - Ensure new endpoints are accessible from frontend
    - Add request logging for new endpoints
    - _Requirements: 17.1_

  - [ ]* 31.3 Write integration tests for new endpoints
    - Test GET /quant/indicators returns complete list
    - Test POST /quant/analyze with sample data
    - Test POST /quant/score with various market conditions
    - Test backward compatibility with old endpoints
    - _Requirements: 16.5_

- [x] 32. Update Backend API to use new Quant endpoints
  - [x] 32.1 Update QuantService to call new endpoints
    - Update HTTP client to call POST /quant/analyze instead of POST /analyze
    - Add method to call POST /quant/score for scoring
    - Parse new indicator fields from response
    - _Requirements: 3.1_

  - [x] 32.2 Update PromptController to use scoring endpoint
    - Call POST /quant/score when user requests scoring/rating
    - Include score in AI prompt context when available
    - Return score in recommendation response
    - _Requirements: 4.1, 4.2_

  - [ ]* 32.3 Write unit tests for updated QuantService
    - Test new endpoint integration
    - Test error handling for new endpoints
    - Test response parsing with new fields
    - _Requirements: 20.2_

- [x] 33. Update Frontend to display new indicators
  - [x] 33.1 Update ChartViewer to show additional EMAs
    - Add EMA 5, 15, 50, 200 overlays to chart
    - Use distinct colors for each EMA line
    - Add legend showing all EMAs
    - _Requirements: 13.3_

  - [x] 33.2 Create IndicatorPanel component
    - Display all calculated indicators in organized panel
    - Show ADX with trend strength interpretation
    - Show ATR with volatility assessment
    - Show VWAP with current price position
    - Show volume analysis (MA and relative volume)
    - Show 52-week high/low with percentage distance
    - Show momentum indicator
    - _Requirements: 13.2_

  - [x] 33.3 Create ScoreCard component
    - Display deterministic score (0-100) with visual gauge
    - Show trend classification (BULLISH/BEARISH/NEUTRAL) with color coding
    - Display signal bullets in organized list
    - Show key metrics: RSI, ADX, VWAP position, volume ratio
    - _Requirements: 13.2_

  - [x] 33.4 Wire new components to recommendation flow
    - Fetch score from backend when displaying recommendations
    - Display ScoreCard alongside RecommendationCard
    - Show IndicatorPanel in expandable section
    - Update chart with all EMA overlays
    - _Requirements: 13.1, 13.2_

- [x] 34. Checkpoint - Verify Phase 4 enhancements
  - Start Quant Engine and verify new endpoints respond
  - Test GET /quant/indicators returns all indicator definitions
  - Test POST /quant/analyze with 200+ candles includes all new indicators
  - Test POST /quant/score returns deterministic scores
  - Verify scoring is deterministic (same input = same output)
  - Test Backend integration with new endpoints
  - Test Frontend displays new indicators and score card
  - Run all new unit tests and property tests
  - Run Python formatter (Black) and linter (Flake8)
  - Ask the user if questions arise

### Phase 5: Trendline Engine

- [x] 35. Implement Swing Point Detection
  - [x] 35.1 Create SwingDetector calculator
    - Implement swing high/low detection with configurable lookback period
    - Detect higher highs and higher lows (uptrend pattern)
    - Detect lower highs and lower lows (downtrend pattern)
    - Create `calculators/swing_detector.py`
    - Return list of swing points with timestamp, price, type (high/low)
    - _Requirements: 3.1_

  - [x] 35.2 Implement higher highs/higher lows logic
    - Create method to identify uptrend swing patterns
    - Validate sequence: each swing high > previous swing high
    - Validate sequence: each swing low > previous swing low
    - Return confidence score based on pattern strength
    - _Requirements: 3.1_

  - [x] 35.3 Implement lower highs/lower lows logic
    - Create method to identify downtrend swing patterns
    - Validate sequence: each swing high < previous swing high
    - Validate sequence: each swing low < previous swing low
    - Return confidence score based on pattern strength
    - _Requirements: 3.1_

  - [ ]* 35.4 Write unit tests for swing detection
    - Test swing high detection with sample data
    - Test swing low detection with sample data
    - Test uptrend pattern recognition
    - Test downtrend pattern recognition
    - Test edge cases (flat price, gaps)
    - _Requirements: 3.1_

- [x] 36. Implement Trendline Calculation
  - [x] 36.1 Create TrendlineCalculator
    - Implement support trendline using linear regression on swing lows
    - Implement resistance trendline using linear regression on swing highs
    - Create `calculators/trendline_calculator.py`
    - Return slope, intercept, R² value for each trendline
    - _Requirements: 3.1_

  - [x] 36.2 Implement trendline validation
    - Validate minimum touch points (at least 2 swing points)
    - Calculate trendline strength score (0-100) based on R² and touch count
    - Detect trendline angle (steep vs flat)
    - Filter out weak trendlines (R² < 0.7 or strength < 40)
    - _Requirements: 3.1_

  - [ ]* 36.3 Write unit tests for trendline calculation
    - Test linear regression on sample swing points
    - Test trendline validation logic
    - Test strength score calculation
    - Test angle detection
    - _Requirements: 3.1_

- [x] 37. Implement Breakout/Breakdown Detection
  - [x] 37.1 Create BreakoutDetector
    - Detect resistance breakout (price closes above resistance trendline)
    - Detect support breakdown (price closes below support trendline)
    - Implement volume confirmation (volume > average on breakout)
    - Create `calculators/breakout_detector.py`
    - Return breakout type, confirmation status, volume ratio
    - _Requirements: 3.1_

  - [x] 37.2 Implement retest detection
    - Detect when broken resistance acts as new support
    - Detect when broken support acts as new resistance
    - Calculate distance from breakout level (percentage)
    - Return retest confidence score
    - _Requirements: 3.1_

  - [ ]* 37.3 Write unit tests for breakout detection
    - Test resistance breakout detection
    - Test support breakdown detection
    - Test volume confirmation logic
    - Test retest detection
    - _Requirements: 3.1_

- [x] 38. Create Trendline Models and Service
  - [x] 38.1 Create TrendlineResult model
    - Define Pydantic model in `models/trendline.py`
    - Create TrendDirectionEnum (UPTREND, DOWNTREND, SIDEWAYS)
    - Create TrendlineStatusEnum (ACTIVE, BROKEN, RETESTING)
    - Create BreakoutStatusEnum (NONE, BREAKOUT, BREAKDOWN, CONFIRMED)
    - Add fields: support_line, resistance_line, swing_points, breakout_status, direction
    - Add validation and examples
    - _Requirements: 3.8_

  - [x] 38.2 Create TrendlineService
    - Create `services/trendline_service.py`
    - Orchestrate SwingDetector to find swing points
    - Call TrendlineCalculator to compute support/resistance lines
    - Call BreakoutDetector to identify breakouts
    - Combine results into TrendlineResult model
    - _Requirements: 3.1_

  - [ ]* 38.3 Write unit tests for TrendlineService
    - Test service orchestration with mocked calculators
    - Test complete trendline analysis flow
    - Test error handling for insufficient data
    - _Requirements: 3.1_

- [x] 39. Create Trendline Endpoint
  - [x] 39.1 Implement POST /quant/trendline endpoint
    - Accept OHLCV data and lookback period parameter
    - Call TrendlineService to perform analysis
    - Return TrendlineResult JSON response
    - Add endpoint to main FastAPI app
    - _Requirements: 3.1_

  - [ ]* 39.2 Write unit tests for trendline endpoint
    - Test endpoint with valid OHLCV data
    - Test with various lookback periods
    - Test error handling for invalid input
    - _Requirements: 16.5_

- [x] 40. Integrate Trendline with Quant Engine
  - [x] 40.1 Update main.py with trendline route
    - Add POST /quant/trendline route to FastAPI app
    - Add trendline field to AnalysisResult model (optional)
    - Update POST /quant/analyze to include trendline analysis when requested
    - Update API documentation
    - _Requirements: 3.1, 3.8_

  - [x] 40.2 Update TypeScript types
    - Create TrendlineResult interface in frontend/backend types
    - Define TrendDirectionEnum, TrendlineStatusEnum, BreakoutStatusEnum
    - Add trendline field to QuantAnalysisResult type
    - _Requirements: 3.8_

  - [ ]* 40.3 Write integration tests
    - Test POST /quant/trendline with real market data
    - Test POST /quant/analyze includes trendline when requested
    - Test TypeScript type safety
    - _Requirements: 16.6_

- [x] 41. Update Backend API for Trendlines
  - [x] 41.1 Update QuantService with trendline method
    - Add method to call POST /quant/trendline
    - Parse TrendlineResult response
    - Add error handling for trendline calculation failures
    - _Requirements: 3.1_

  - [x] 41.2 Integrate trendline with recommendation flow
    - Update PromptController to request trendline analysis
    - Include trendline results in AI prompt context
    - Add trendline insights to recommendation output
    - Update recommendation to consider breakouts/breakdowns
    - _Requirements: 3.1, 4.1_

  - [ ]* 41.3 Write unit tests for trendline integration
    - Test QuantService trendline method
    - Test PromptController with trendline data
    - Test error handling
    - _Requirements: 20.2_

- [x] 42. Checkpoint - Verify Phase 5 Trendline Engine
  - [x] 42.1 Verify trendline detection
    - Start Quant Engine and test POST /quant/trendline endpoint
    - Test with uptrend data (verify support line detected)
    - Test with downtrend data (verify resistance line detected)
    - Verify swing point detection accuracy
    - _Requirements: 3.1_

  - [x] 42.2 Verify breakout/breakdown detection
    - Test breakout detection with volume confirmation
    - Test breakdown detection with volume confirmation
    - Test retest detection logic
    - Verify breakout status transitions (NONE → BREAKOUT → CONFIRMED)
    - _Requirements: 3.1_

  - [x] 42.3 Verify end-to-end integration
    - Test Backend integration with trendline endpoint
    - Verify trendline data flows to recommendation system
    - Test complete flow: market data → swing detection → trendline calculation → breakout detection → AI recommendation
    - Run all Phase 5 tests (unit + integration)
    - Run Python formatter (Black) and linter (Flake8)
    - Ask the user if questions arise

### Phase 6: Swing Trading Module

- [x] 43. Implement Swing Trading Scanner Infrastructure
  - [x] 43.1 Create swing trading route group
    - Create `/swing` route group in Backend API
    - Set up SwingModule in NestJS with dependency injection
    - Create SwingController for HTTP endpoints
    - Create SwingService for business logic orchestration
    - _Requirements: 5.1, 18.1_

  - [x] 43.2 Define configurable stock universe
    - Create StockUniverse configuration table in Prisma schema
    - Add fields: symbol, sector, marketCap, isActive
    - Create API endpoints for managing universe (add/remove stocks)
    - Implement default NSE F&O stocks universe
    - _Requirements: 5.1_

  - [ ]* 43.3 Write unit tests for universe management
    - Test adding stocks to universe
    - Test removing stocks from universe
    - Test retrieving active universe
    - _Requirements: 16.4_

- [x] 44. Implement Comprehensive Technical Analysis for Swing Trading
  - [x] 44.1 Create SwingAnalysisService
    - Create service that orchestrates all technical factor analysis
    - Integrate existing calculators: RSI, ADX, ATR, MACD, EMA, VWAP
    - Add volume analysis (volume MA, relative volume)
    - Add 52-week high/low analysis
    - Add support/resistance level detection
    - Add trendline analysis from Phase 5
    - _Requirements: 5.2, 3.1, 3.2_

  - [x] 44.2 Implement price action analysis
    - Create price action patterns detector (higher highs/lows, lower highs/lows)
    - Detect candlestick patterns (engulfing, hammer, doji)
    - Calculate momentum indicators (rate of change)
    - Return structured PriceActionResult
    - _Requirements: 5.2_

  - [x] 44.3 Implement breakout pattern detection
    - Detect resistance breakout with volume confirmation
    - Detect support breakdown with volume confirmation
    - Identify consolidation ranges
    - Calculate breakout strength score
    - _Requirements: 5.2_

  - [x] 44.4 Implement breakout retest detection
    - Detect when broken resistance acts as new support
    - Detect when broken support acts as new resistance
    - Calculate retest confidence based on price distance and volume
    - Return retest status and confidence score
    - _Requirements: 5.2_

  - [x] 44.5 Implement sector strength analysis
    - Create SectorAnalysisService
    - Calculate sector-relative performance
    - Identify leading and lagging sectors
    - Return sector strength score (0-100)
    - _Requirements: 5.2_

  - [x] 44.6 Implement market regime detection
    - Create MarketRegimeService
    - Analyze NIFTY 50 to determine overall market trend
    - Classify regime: BULL_MARKET, BEAR_MARKET, SIDEWAYS, VOLATILE
    - Calculate market regime strength
    - Return MarketRegimeResult
    - _Requirements: 5.2_

  - [ ]* 44.7 Write unit tests for technical analysis services
    - Test price action pattern detection
    - Test breakout detection with various scenarios
    - Test retest detection logic
    - Test sector strength calculation
    - Test market regime classification
    - _Requirements: 16.4_

- [x] 45. Implement Deterministic Scoring Algorithm
  - [x] 45.1 Create SwingScoringService
    - Create deterministic scoring service (NO AI)
    - Define scoring components: trend, technical, volume, relative strength, breakout, sector, risk/reward
    - Implement weighted formula with default weights
    - Default weights: Trend 20%, Technical 20%, Volume 15%, Relative Strength 15%, Breakout 10%, Sector 10%, Risk/Reward 10%
    - Return total score (0-100) and component scores
    - _Requirements: 5.3_

  - [x] 45.2 Implement configurable weight system
    - Create ScoringWeights configuration in database
    - Allow per-user customization of weights
    - Validate weights sum to 100%
    - Load weights from config, fall back to defaults
    - _Requirements: 5.3_

  - [x] 45.3 Implement component scoring functions
    - Trend score: based on EMA alignment, price position, ADX
    - Technical score: based on RSI, MACD, oscillators
    - Volume score: based on relative volume, volume trend
    - Relative strength score: based on sector comparison, market comparison
    - Breakout score: based on breakout detection, volume confirmation
    - Sector score: based on sector strength analysis
    - Risk/Reward score: based on stop loss distance, target distance
    - _Requirements: 5.3_

  - [ ]* 45.4 Write property tests for scoring determinism
    - **Property 20: Swing Scoring Determinism**
    - **Validates**: Same input always produces same score
    - Test with multiple identical analysis requests
    - _Requirements: 5.3_

  - [ ]* 45.5 Write unit tests for scoring components
    - Test each component scoring function independently
    - Test weight application
    - Test score normalization (0-100 bounds)
    - Test edge cases (missing data, extreme values)
    - _Requirements: 5.3_

- [x] 46. Create Swing Scanner and Ranking System
  - [x] 46.1 Implement POST /swing/scan endpoint
    - Create endpoint in SwingController
    - Accept optional parameters: minScore, sectorFilter, maxResults
    - Iterate through configurable stock universe
    - Fetch market data for each stock
    - Call SwingAnalysisService for technical analysis
    - Call SwingScoringService to calculate scores
    - Rank stocks by score (descending)
    - Return top N candidates with scores and analysis
    - _Requirements: 5.4_

  - [x] 46.2 Implement candidate result model
    - Create SwingCandidate Pydantic model
    - Fields: symbol, score, trend, setupType, entry, stopLoss, target, riskReward
    - Include component scores breakdown
    - Include key technical factors (RSI, ADX, volume ratio)
    - Add validation for all fields
    - _Requirements: 5.4_

  - [x] 46.3 Optimize scanner performance
    - Implement parallel processing for universe scanning
    - Use cached market data when available
    - Add progress tracking for large universes
    - Implement timeout protection (max 60 seconds per scan)
    - _Requirements: 20.1_

  - [ ]* 46.4 Write integration tests for scan endpoint
    - Test scan with sample universe (5 stocks)
    - Test filtering by minimum score
    - Test sector filtering
    - Test ranking order (highest score first)
    - Test timeout handling
    - _Requirements: 16.6_

- [x] 47. Implement Deep Analysis Endpoint
  - [x] 47.1 Implement POST /swing/analyze/:symbol endpoint
    - Create endpoint for analyzing specific symbol
    - Fetch comprehensive historical data (200+ candles)
    - Perform complete technical analysis
    - Calculate all scoring components
    - Return detailed SwingAnalysisResult
    - _Requirements: 5.4_

  - [x] 47.2 Create detailed analysis result model
    - Create SwingAnalysisResult model with all factors
    - Include: price action, EMA values, RSI, ADX, ATR, MACD
    - Include: volume metrics, relative volume, 52-week high/low
    - Include: breakout status, retest status
    - Include: support levels, resistance levels, trendlines
    - Include: sector strength, market regime
    - Include: component scores and total score
    - _Requirements: 5.4_

  - [ ]* 47.3 Write unit tests for deep analysis
    - Test analysis with various market conditions
    - Test all fields are populated correctly
    - Test error handling for invalid symbols
    - _Requirements: 16.4_

- [x] 48. Integrate AI Reasoning with Swing Analysis
  - [x] 48.1 Update PromptBuilderService for swing trading
    - Create structured prompts for swing trade analysis
    - Include ALL deterministic analysis results in prompt
    - Include scoring breakdown and key factors
    - **CRITICAL**: AI receives ONLY verified data, NO raw market data
    - Format prompt to request specific recommendation structure
    - _Requirements: 4.2, 4.4, 18.1_

  - [x] 48.2 Define AI recommendation output format
    - Create SwingRecommendation model
    - Required fields: stock, signal (BUY/SELL/NO_TRADE), setup description
    - Required fields: entry, stopLoss, target, riskReward, probability
    - Required fields: trend, volume, trendline, support, resistance
    - Required fields: marketRegime, rationale, invalidation criteria
    - Add validation ensuring all fields are present
    - _Requirements: 5.5_

  - [x] 48.3 Implement AI response parser for swing recommendations
    - Parse AI response into SwingRecommendation object
    - Validate all required fields are present
    - Validate numerical values are reasonable (entry > 0, etc.)
    - Handle AI returning "NO TRADE" recommendation
    - Return structured recommendation or null if no valid setup
    - _Requirements: 5.5, 5.6_

  - [ ]* 48.4 Write unit tests for AI integration
    - Test prompt building with swing analysis data
    - Test recommendation parsing with valid AI response
    - Test handling of "NO TRADE" response
    - Test error handling for malformed AI responses
    - Verify AI never receives raw market data
    - _Requirements: 18.1, 20.3_

- [x] 49. Implement Safety Controls and Paper Trading
  - [x] 49.1 Implement "NO TRADE" logic
    - Check if score meets minimum threshold (default: 60)
    - Check if market regime is favorable
    - Check if risk/reward ratio meets minimum (default: 2.0)
    - If conditions not met, return "NO TRADE" recommendation
    - Log reason for rejecting trade setup
    - _Requirements: 5.6_

  - [x] 49.2 Create "BUY ON PAPER" functionality
    - Add paper trade button to swing recommendation UI component
    - Connect button to existing POST /api/trade/paper endpoint
    - Pre-fill trade request with recommendation data
    - Show confirmation before executing paper trade
    - Display success message and update portfolio
    - **CRITICAL**: Button does NOT execute live trades automatically
    - _Requirements: 5.7, 5.8_

  - [x] 49.3 Implement execution flow control
    - After paper trade button, display results and STOP
    - Do NOT show live trade button by default for swing module
    - Require explicit navigation to trading controller for live trades
    - Add audit log entry for all paper trades
    - _Requirements: 5.8, 18.6_

  - [ ]* 49.4 Write E2E tests for safety controls
    - Test "NO TRADE" returned when conditions not met
    - Test paper trade button flow
    - Test that live trades require separate action
    - Test audit logging
    - _Requirements: 16.6_

- [x] 50. Create Swing Trading Frontend Components
  - [x] 50.1 Create SwingScanner component
    - Text input for filtering stocks
    - Button to trigger scan
    - Loading state during scan (show progress)
    - Display ranked list of candidates in table
    - Table columns: Symbol, Score, Setup, Entry, Target, Stop Loss, Risk/Reward
    - Click row to see detailed analysis
    - _Requirements: 13.1, 13.2_

  - [x] 50.2 Create SwingAnalysisPanel component
    - Display all technical factors in organized sections
    - Section: Price Action (trend, momentum, patterns)
    - Section: Technical Indicators (RSI, ADX, ATR, MACD, EMAs)
    - Section: Volume Analysis (relative volume, volume trend)
    - Section: Breakout Status (breakout/retest detection)
    - Section: Support/Resistance Levels (visual list)
    - Section: Sector & Market (sector strength, market regime)
    - Section: Scoring Breakdown (component scores with weights)
    - _Requirements: 13.2_

  - [x] 50.3 Create SwingRecommendationCard component
    - Display AI recommendation in structured format
    - Show all required fields from SwingRecommendation model
    - Highlight signal (BUY/SELL/NO_TRADE) with color coding
    - Display entry, stop loss, target with visual price ladder
    - Show probability and risk/reward prominently
    - Display rationale and invalidation criteria
    - Include "BUY ON PAPER" button at bottom
    - **CRITICAL**: NO automatic live trade execution
    - _Requirements: 13.2, 5.5_

  - [x] 50.4 Wire swing components to backend API
    - Connect SwingScanner to POST /swing/scan
    - Connect detail view to POST /swing/analyze/:symbol
    - Connect paper trade button to POST /api/trade/paper
    - Handle loading and error states
    - Display success/failure notifications
    - _Requirements: 13.1_

  - [ ]* 50.5 Write frontend component tests
    - Test SwingScanner renders and triggers scan
    - Test SwingAnalysisPanel displays all sections
    - Test SwingRecommendationCard displays all fields
    - Test paper trade button click flow
    - _Requirements: 16.6_

- [x] 51. Update Backend API for Swing Module Integration
  - [x] 51.1 Create SwingModule in Backend API
    - Create NestJS module with SwingController and SwingService
    - Inject QuantService, AiService, RiskService, PaperTradingService
    - Configure dependency injection following architectural constraints
    - **CRITICAL**: Ensure AI only receives analysis results, not raw data
    - _Requirements: 18.1, 18.3_

  - [x] 51.2 Implement swing scan orchestration
    - SwingService.scan(): orchestrate universe scanning
    - For each stock: fetch data → analyze → score → rank
    - Implement error handling for individual stock failures
    - Continue scanning even if some stocks fail
    - Return successful results with partial failure reporting
    - _Requirements: 20.1_

  - [x] 51.3 Implement swing analyze orchestration
    - SwingService.analyzeSymbol(): orchestrate deep analysis
    - Fetch market data → call Quant Engine → call Scoring Service
    - Optionally call AI Service for recommendation
    - Validate with Risk Engine if recommendation generated
    - Return complete analysis result
    - _Requirements: 4.1, 8.1_

  - [ ]* 51.4 Write integration tests for swing orchestration
    - Test scan with mock services
    - Test analyze with mock services
    - Test error handling and partial failures
    - Test AI integration flow
    - _Requirements: 16.6_

- [x] 52. Implement Swing Module in Quant Engine
  - [x] 52.1 Create POST /quant/swing/analyze endpoint
    - Accept symbol and OHLCV data (200+ candles)
    - Calculate all technical factors required for swing trading
    - Return comprehensive SwingTechnicalAnalysis result
    - Include all indicators, patterns, breakouts, support/resistance
    - _Requirements: 3.1, 5.2_

  - [x] 52.2 Create POST /quant/swing/score endpoint
    - Accept SwingTechnicalAnalysis input
    - Calculate all component scores
    - Load user scoring weights (or use defaults)
    - Apply weights and calculate total score
    - Return SwingScoreResult with breakdown
    - **CRITICAL**: Must be deterministic (no randomness)
    - _Requirements: 5.3_

  - [x] 52.3 Update main.py with swing routes
    - Add /quant/swing/analyze route handler
    - Add /quant/swing/score route handler
    - Update API documentation
    - Ensure CORS configuration allows frontend access
    - _Requirements: 3.1, 17.1_

  - [ ]* 52.4 Write unit tests for swing endpoints
    - Test analyze endpoint with sample data
    - Test score endpoint with various configurations
    - Test scoring determinism
    - Test edge cases (insufficient data, missing indicators)
    - _Requirements: 16.5_

- [x] 53. Checkpoint - Verify Phase 6 Swing Trading Module
  - [x] 53.1 Verify scanner functionality
    - Start all services (Backend, Quant Engine, Frontend, Database)
    - Configure stock universe with 10-20 NSE stocks
    - Trigger POST /swing/scan and verify results
    - Verify stocks are ranked by score
    - Verify all component scores are calculated
    - Test filtering by minimum score and sector
    - _Requirements: 5.4_

  - [x] 53.2 Verify deep analysis functionality
    - Test POST /swing/analyze/:symbol with specific stocks
    - Verify all technical factors are calculated correctly
    - Verify breakout and retest detection works
    - Verify sector strength and market regime analysis
    - Verify scoring is deterministic (same input = same score)
    - _Requirements: 5.2, 5.3_

  - [x] 53.3 Verify AI integration and safety controls
    - Test AI receives only verified analysis data (not raw market data)
    - Test AI returns properly formatted SwingRecommendation
    - Test "NO TRADE" logic when conditions not met
    - Verify paper trade button functionality
    - Verify NO automatic live trade execution
    - Check audit logs for all operations
    - _Requirements: 4.1, 5.6, 5.7, 5.8, 18.1_

  - [x] 53.4 Verify frontend integration
    - Test SwingScanner component triggers scan correctly
    - Test candidate list displays with all columns
    - Test clicking candidate shows detailed analysis
    - Test SwingRecommendationCard displays all fields
    - Test "BUY ON PAPER" button executes paper trade
    - Test portfolio updates after paper trade
    - _Requirements: 13.1, 13.2_

  - [x] 53.5 Run all Phase 6 tests and quality checks
    - Run all new unit tests (Quant Engine + Backend)
    - Run property test for scoring determinism (Property 20)
    - Run integration tests for swing endpoints
    - Run E2E tests for swing trading flow
    - Run Python formatter (Black) and linter (Flake8)
    - Run TypeScript type checks, ESLint, Prettier
    - Verify test coverage for new code (target: 80%)
    - Ask the user if questions arise

### Phase 7: Intraday Stock Analysis Module

- [x] 54. Implement Intraday Analysis Infrastructure
  - [x] 54.1 Create intraday route group
    - Create `/intraday` route group in Backend API
    - Set up IntradayModule in NestJS with dependency injection
    - Create IntradayController for HTTP endpoints
    - Create IntradayService for business logic orchestration
    - _Requirements: 6.1, 18.1_

  - [x] 54.2 Create intraday-specific models
    - Create IntradayAnalysisRequest model (symbol, interval)
    - Create IntradayAnalysisResult model with all required fields
    - Create IntradayRecommendation model (BUY/SELL/HOLD/NO_TRADE)
    - Add timestamp and data freshness fields
    - _Requirements: 6.1, 6.2_

  - [ ]* 54.3 Write unit tests for intraday module structure
    - Test module dependency injection
    - Test controller initialization
    - Test service initialization
    - _Requirements: 16.4_

- [x] 55. Implement Opening Range Calculator
  - [x] 55.1 Create OpeningRangeCalculator
    - Create `calculators/opening_range.py` in Quant Engine
    - Calculate first 15-minute candle range (high, low)
    - Calculate opening range midpoint
    - Detect breakout above/below opening range
    - Return OpeningRangeResult with high, low, midpoint, breakoutStatus
    - _Requirements: 6.3_

  - [x] 55.2 Implement opening range breakout detection
    - Detect when current price breaks above opening range high
    - Detect when current price breaks below opening range low
    - Calculate breakout distance (percentage)
    - Return breakout confirmation based on volume
    - _Requirements: 6.3_

  - [ ]* 55.3 Write unit tests for opening range calculator
    - Test opening range calculation with sample intraday data
    - Test breakout detection logic
    - Test edge cases (gap up/down, flat open)
    - _Requirements: 6.3_

- [x] 56. Implement Previous Day Levels Calculator
  - [x] 56.1 Create PreviousDayLevelsCalculator
    - Create `calculators/previous_day_levels.py`
    - Calculate previous day high and low from historical data
    - Calculate previous day close
    - Calculate gap percentage (current open vs previous close)
    - Return PreviousDayLevelsResult
    - _Requirements: 6.4_

  - [x] 56.2 Implement level breach detection
    - Detect when current price crosses previous day high
    - Detect when current price crosses previous day low
    - Calculate distance from previous day levels
    - Return breach status and significance
    - _Requirements: 6.4_

  - [ ]* 56.3 Write unit tests for previous day levels
    - Test level calculation with historical data
    - Test breach detection
    - Test gap calculation
    - _Requirements: 6.4_

- [x] 57. Create Comprehensive Intraday Analysis Service
  - [x] 57.1 Create IntradayAnalysisService in Quant Engine
    - Create `services/intraday_analysis_service.py`
    - Orchestrate all intraday-specific calculations
    - Integrate existing calculators: VWAP, EMA 5/15, RSI, MACD, ATR, Volume
    - Add opening range calculation
    - Add previous day levels calculation
    - Add support/resistance from Phase 5
    - Add trendline detection from Phase 5
    - _Requirements: 6.2, 6.3, 6.4_

  - [x] 57.2 Implement intraday price action analysis
    - Analyze current price position relative to VWAP
    - Analyze EMA 5 and EMA 15 crossovers
    - Detect momentum shifts (RSI divergence)
    - Calculate intraday trend strength
    - Return structured PriceActionResult
    - _Requirements: 6.2_

  - [x] 57.3 Implement data freshness validation
    - Check timestamp of latest candle
    - Calculate data age (current time - latest candle time)
    - Set freshness threshold (5 minutes for intraday)
    - Return isStale flag if data exceeds threshold
    - _Requirements: 6.5_

  - [ ]* 57.4 Write unit tests for intraday analysis service
    - Test service orchestration
    - Test price action analysis with various scenarios
    - Test data freshness validation
    - _Requirements: 6.2, 6.5_

- [x] 58. Implement Intraday Scoring Algorithm
  - [x] 58.1 Create IntradayScoringService
    - Create deterministic scoring service (NO AI)
    - Define scoring components: trend, momentum, volume, VWAP position, opening range, previous day levels, risk/reward
    - Implement weighted formula with default weights
    - Default weights: Trend 25%, Momentum 20%, Volume 15%, VWAP 15%, Opening Range 10%, Prev Day Levels 10%, Risk/Reward 5%
    - Return total score (0-100) and component scores
    - _Requirements: 6.6_

  - [x] 58.2 Implement component scoring functions
    - Trend score: based on EMA 5/15 alignment, price position
    - Momentum score: based on RSI, MACD, rate of change
    - Volume score: based on relative volume vs average
    - VWAP score: based on price position relative to VWAP
    - Opening range score: based on breakout status and confirmation
    - Previous day levels score: based on breach status
    - Risk/reward score: based on stop loss distance vs target distance
    - _Requirements: 6.6_

  - [ ]* 58.3 Write property tests for intraday scoring determinism
    - **Property 21: Intraday Scoring Determinism**
    - **Validates**: Same input always produces same score
    - Test with multiple identical analysis requests
    - _Requirements: 6.6_

  - [ ]* 58.4 Write unit tests for scoring components
    - Test each component scoring function independently
    - Test weight application
    - Test score normalization (0-100 bounds)
    - _Requirements: 6.6_

- [x] 59. Create Intraday Analysis Endpoint in Quant Engine
  - [x] 59.1 Implement POST /quant/intraday/analyze endpoint
    - Accept symbol and intraday OHLCV data (minimum 30 candles)
    - Accept interval parameter (1min, 5min, 15min)
    - Call IntradayAnalysisService for technical analysis
    - Call IntradayScoringService for scoring
    - Include data timestamp and freshness status in response
    - Return comprehensive IntradayAnalysisResult
    - _Requirements: 6.1, 6.2_

  - [x] 59.2 Update main.py with intraday routes
    - Add POST /quant/intraday/analyze route handler
    - Update API documentation
    - Ensure CORS configuration allows frontend access
    - _Requirements: 6.1, 17.1_

  - [ ]* 59.3 Write unit tests for intraday endpoint
    - Test endpoint with sample intraday data
    - Test with various intervals (1min, 5min, 15min)
    - Test data freshness validation
    - Test error handling for insufficient data
    - _Requirements: 16.5_

- [x] 60. Implement Intraday Recommendation Logic
  - [x] 60.1 Create IntradayRecommendationService
    - Create service in Backend API for generating recommendations
    - Integrate with IntradayAnalysisService results
    - Implement confidence threshold (minimum 65 for intraday)
    - Implement risk/reward threshold (minimum 1.5 for intraday)
    - Implement data freshness check
    - _Requirements: 6.6, 6.7, 6.5_

  - [x] 60.2 Implement signal generation logic
    - BUY signal: score > 65, bullish trend, price > VWAP, RSI 40-70, data fresh
    - SELL signal: score > 65, bearish trend, price < VWAP, RSI 30-60, data fresh
    - HOLD signal: existing position, no clear directional signal, data fresh
    - NO_TRADE signal: score < 65 OR poor risk/reward OR data stale OR conflicting indicators
    - _Requirements: 6.7_

  - [x] 60.3 Implement stale data handling
    - If data freshness check fails (isStale = true), return HOLD
    - Add staleness message: "Data is stale. Waiting for fresh data."
    - Log stale data event for monitoring
    - Prevent any BUY/SELL signals when data is stale
    - _Requirements: 6.5, 6.8_

  - [x] 60.4 Define recommendation output structure
    - Create IntradayRecommendation model
    - Required fields: symbol, signal (BUY/SELL/HOLD/NO_TRADE), confidence, timestamp
    - Required fields: entry, stopLoss, target, riskReward
    - Required fields: currentPrice, vwap, ema5, ema15, rsi, macd
    - Required fields: openingRange, previousDayHigh, previousDayLow
    - Required fields: isStale, dataTimestamp, rationale
    - Add validation for all fields
    - _Requirements: 6.7_

  - [ ]* 60.5 Write unit tests for recommendation logic
    - Test BUY signal generation with valid conditions
    - Test SELL signal generation with valid conditions
    - Test HOLD signal when data is stale
    - Test NO_TRADE when thresholds not met
    - Test stale data handling
    - _Requirements: 6.5, 6.7, 6.8_

- [x] 61. Create Backend API Endpoints for Intraday
  - [x] 61.1 Implement POST /api/intraday/analyze endpoint
    - Accept symbol and optional interval parameter
    - Fetch intraday market data from MarketDataService
    - Call Quant Engine POST /quant/intraday/analyze
    - Call IntradayRecommendationService to generate signal
    - Validate with RiskService if BUY/SELL signal generated
    - Return complete IntradayAnalysisResult with recommendation
    - **CRITICAL**: NO automatic refresh - manual trigger only
    - _Requirements: 6.1, 6.7, 18.1_

  - [x] 61.2 Add data timestamp to response
    - Include dataTimestamp field in response
    - Include dataAge field (seconds since latest candle)
    - Include isStale boolean flag
    - Add lastRefreshTime field (server time when analysis ran)
    - _Requirements: 6.5, 6.8_

  - [ ]* 61.3 Write integration tests for intraday endpoint
    - Test POST /api/intraday/analyze with mock services
    - Test signal generation flow
    - Test stale data handling
    - Test risk validation integration
    - _Requirements: 16.6_

- [x] 62. Create Frontend Components for Intraday Analysis
  - [x] 62.1 Create IntradayAnalyzer component
    - Text input for stock symbol
    - Dropdown for interval selection (1min, 5min, 15min)
    - **"REFRESH & ANALYZE" button** (manual trigger - NO auto-refresh)
    - Loading state during analysis
    - Display last refresh timestamp prominently
    - Display data timestamp and freshness indicator
    - _Requirements: 6.8, 13.1_

  - [x] 62.2 Create IntradayDataPanel component
    - Display all technical indicators in organized sections
    - Section: Price Action (current price, VWAP, EMA 5, EMA 15)
    - Section: Momentum (RSI, MACD histogram)
    - Section: Volume (current volume, relative volume, ATR)
    - Section: Intraday Levels (opening range high/low, previous day high/low)
    - Section: Support/Resistance (nearest levels)
    - Section: Trendlines (active trendlines from Phase 5)
    - Highlight stale data with warning color if isStale = true
    - _Requirements: 6.8, 13.2_

  - [x] 62.3 Create IntradayRecommendationCard component
    - Display recommendation signal with color coding (BUY=green, SELL=red, HOLD=yellow, NO_TRADE=gray)
    - Show confidence score as progress bar
    - Display entry, stop loss, target levels
    - Show risk/reward ratio
    - Display key indicators (VWAP, RSI, MACD)
    - Display rationale text
    - **If isStale = true: Show "HOLD - Data is stale" message prominently**
    - **If NO_TRADE: Show reason why trade not recommended**
    - Include "BUY ON PAPER" button (only if signal is BUY or SELL and data is fresh)
    - _Requirements: 6.7, 6.8, 13.2_

  - [x] 62.4 Implement data freshness UI indicators
    - Display data timestamp in readable format (e.g., "Updated: 2:45:30 PM")
    - Calculate and display data age (e.g., "2 minutes ago")
    - Show freshness indicator: Green (< 2 min), Yellow (2-5 min), Red (> 5 min)
    - If data is stale (Red), show warning banner: "⚠️ Data is stale. Click REFRESH & ANALYZE for latest data."
    - Disable trade buttons when data is stale
    - _Requirements: 6.5, 6.8_

  - [x] 62.5 Wire intraday components to backend API
    - Connect "REFRESH & ANALYZE" button to POST /api/intraday/analyze
    - Pass selected symbol and interval
    - Handle loading state during API call
    - Update all panels with new data on success
    - Display error message on failure
    - **CRITICAL**: NO automatic refresh timer - user must click button
    - _Requirements: 6.8, 13.1_

  - [ ]* 62.6 Write frontend component tests
    - Test IntradayAnalyzer renders correctly
    - Test REFRESH & ANALYZE button triggers analysis
    - Test data freshness indicators update
    - Test stale data warning displays
    - Test recommendation card displays all fields
    - _Requirements: 16.6_

- [x] 63. Implement Safety Controls for Intraday Trading
  - [x] 63.1 Enforce stale data protection
    - If isStale = true, force recommendation to HOLD
    - Log stale data events to audit log
    - Prevent paper/live trade execution when data is stale
    - Display clear warning message to user
    - _Requirements: 6.5, 6.8, 18.6_

  - [x] 63.2 Implement confidence and risk/reward thresholds
    - Reject trades with confidence < 65
    - Reject trades with risk/reward < 1.5
    - Return NO_TRADE with clear reason
    - Log rejected trades to audit log
    - _Requirements: 6.6, 6.7, 18.6_

  - [x] 63.3 Add intraday-specific risk validation
    - Validate stop loss is appropriate for intraday volatility (use ATR)
    - Validate position size considers intraday risk (smaller than swing)
    - Validate entry price is within 1% of current price
    - Return validation errors if checks fail
    - _Requirements: 8.1, 6.7_

  - [ ]* 63.4 Write unit tests for safety controls
    - Test stale data protection
    - Test confidence threshold enforcement
    - Test risk/reward threshold enforcement
    - Test intraday-specific risk validation
    - _Requirements: 6.5, 6.7, 8.1_

- [x] 64. Add Intraday Paper Trading Integration
  - [x] 64.1 Connect paper trade button to existing service
    - Reuse existing POST /api/trade/paper endpoint
    - Pre-fill trade request with intraday recommendation data
    - Mark trades with intradayFlag for tracking
    - Show confirmation before executing
    - Update portfolio on success
    - _Requirements: 9.1, 6.7_

  - [x] 64.2 Implement intraday position tracking
    - Add intradayFlag to Position model
    - Track intraday positions separately in portfolio view
    - Calculate intraday-specific metrics (P&L since market open)
    - Display intraday positions with different styling
    - _Requirements: 11.1, 6.1_

  - [ ]* 64.3 Write E2E tests for intraday paper trading
    - Test complete flow: analyze → BUY signal → execute paper trade → verify in portfolio
    - Test stale data prevents trade execution
    - Test NO_TRADE prevents trade execution
    - _Requirements: 16.6_

- [x] 65. Checkpoint - Verify Phase 7 Intraday Analysis Module
  - [x] 65.1 Verify manual refresh behavior
    - Start all services (Backend, Quant Engine, Frontend)
    - Open intraday analyzer component
    - Verify NO automatic refresh occurs
    - Click "REFRESH & ANALYZE" button
    - Verify analysis triggers only on button click
    - Verify data timestamp updates after refresh
    - _Requirements: 6.8_

  - [x] 65.2 Verify intraday analysis calculations
    - Test POST /quant/intraday/analyze with intraday data
    - Verify all indicators calculated: VWAP, EMA 5/15, RSI, MACD, Volume, ATR
    - Verify opening range calculation (first 15-min candle)
    - Verify previous day high/low detection
    - Verify support/resistance levels from Phase 5
    - Verify trendlines from Phase 5
    - _Requirements: 6.2, 6.3, 6.4_

  - [x] 65.3 Verify signal generation and safety controls
    - Test BUY signal with strong bullish conditions
    - Test SELL signal with strong bearish conditions
    - Test HOLD signal when data is stale
    - Test NO_TRADE when confidence < 65
    - Test NO_TRADE when risk/reward < 1.5
    - Verify paper trade button only active for BUY/SELL with fresh data
    - _Requirements: 6.5, 6.6, 6.7, 6.8_

  - [x] 65.4 Verify data freshness indicators
    - Test with fresh data (< 2 minutes old)
    - Verify green freshness indicator
    - Test with moderately old data (2-5 minutes)
    - Verify yellow freshness indicator
    - Test with stale data (> 5 minutes)
    - Verify red freshness indicator and HOLD signal
    - Verify warning banner displays for stale data
    - _Requirements: 6.5, 6.8_

  - [x] 65.5 Verify frontend integration
    - Test IntradayAnalyzer component UI
    - Test "REFRESH & ANALYZE" button functionality
    - Test data freshness indicators display correctly
    - Test IntradayDataPanel shows all technical factors
    - Test IntradayRecommendationCard displays signal correctly
    - Test stale data warning displays when appropriate
    - Test paper trade integration
    - _Requirements: 6.8, 13.1, 13.2_

  - [x] 65.6 Run all Phase 7 tests and quality checks
    - Run all new unit tests (Quant Engine + Backend)
    - Run property test for intraday scoring determinism (Property 21)
    - Run integration tests for intraday endpoints
    - Run E2E tests for intraday analysis flow
    - Run Python formatter (Black) and linter (Flake8)
    - Run TypeScript type checks, ESLint, Prettier
    - Verify test coverage for new code (target: 80%)
    - Ask the user if questions arise

### Phase 8: Options Chain Engine - Core Options Analysis

**SCOPE**: NIFTY/BANKNIFTY options chain fetching, analysis (PCR, ATM, OI buildup/unwinding, support/resistance), and visualization. NO multi-leg strategies, NO auto-trading, paper trading button ONLY.

- [x] 66. Implement Options Chain Infrastructure and Basic Analysis
  - [x] 66.1 Create options route group and data models
    - Create `/options` route group in Backend API
    - Set up OptionsModule in NestJS with dependency injection
    - Create OptionsController for HTTP endpoints
    - Create OptionsService for business logic orchestration
    - Define OptionsChainRequest, OptionsChainData, OptionContract models
    - Define PCRAnalysis, ATMAnalysis, OIAnalysis, LiquidityMetrics models
    - _Requirements: 7.1, 18.1_

  - [x] 66.2 Enhance Options Greeks calculator for chain analysis
    - Extend existing `calculators/greeks.py` from Phase 2
    - Add batch calculation support (entire options chain)
    - Calculate Greeks for all strikes and expiries simultaneously
    - Keep only basic Greeks: Delta, Gamma, Theta, Vega (NO complex Greeks-based strategies)
    - Optimize performance for large options chains (100+ contracts)
    - Return structured GreeksResult with all contracts
    - _Requirements: 7.3_

  - [x] 66.3 Create Options Analysis Service in Quant Engine
    - Create `services/options_analysis_service.py` in Quant Engine
    - Implement PCR (Put-Call Ratio) calculation from OI and Volume
    - Identify ATM strike (closest to current price) and near ATM strikes (±3 strikes)
    - Calculate OI buildup/unwinding detection: long buildup (price up + OI up), short buildup (price down + OI up), long unwinding (price down + OI down), short unwinding (price up + OI down)
    - Identify support/resistance zones from high OI concentrations
    - Return OptionsAnalysisResult with PCR, ATM strikes, OI analysis, support/resistance levels
    - _Requirements: 7.1_

  - [x]* 66.4 Write unit tests for options infrastructure
    - Test options chain data parsing
    - Test PCR calculation with various OI scenarios
    - Test ATM strike identification
    - Test OI buildup/unwinding detection logic
    - Test support/resistance zone identification
    - _Requirements: 7.1, 16.5_

- [x] 67. Implement Liquidity Filtering and Safety Controls
  - [x] 67.1 Create Liquidity Analyzer
    - Create `services/liquidity_analyzer.py` in Quant Engine
    - Calculate bid-ask spread for each contract
    - Identify wide spreads (spread > 5% of mid-price)
    - Identify low volume contracts (volume < 100)
    - Identify low OI contracts (OI < 500)
    - Identify deep OTM contracts (> 10% away from ATM)
    - Return LiquidityMetrics with warnings for illiquid contracts
    - _Requirements: 7.1, 8.1_

  - [x] 67.2 Implement Symbol Validation Service
    - Create `validators/symbol_validator.py` in Quant Engine
    - Validate symbol is NIFTY or BANKNIFTY only
    - Reject all other symbols with clear error message
    - Return validation result with accepted symbols list
    - _Requirements: 7.1, 18.1_

  - [x] 67.3 Implement Rate Limiting for Options Endpoints
    - Add rate limiting to OptionsController in Backend
    - Limit: 10 requests per minute per user
    - Return 429 status code with retry-after header when limit exceeded
    - Log all rate limit violations
    - _Requirements: 8.1, 20.1_

  - [ ]* 67.4 Write unit tests for safety controls
    - Test liquidity filtering logic with various scenarios
    - Test symbol validation (valid and invalid symbols)
    - Test rate limiting enforcement
    - Test edge cases (zero volume, zero OI, missing data)
    - _Requirements: 7.1, 8.1, 16.5_

- [x] 68. Create Quant Engine Endpoints for Options Chain
  - [x] 68.1 Implement POST /quant/options/chain endpoint
    - Accept OptionsChainRequest (symbol, expiry)
    - Validate symbol (NIFTY/BANKNIFTY only)
    - Calculate Greeks for all contracts in chain (batch)
    - Apply liquidity filtering (identify illiquid contracts)
    - Return OptionsChainData with Greeks, IV, liquidity warnings
    - _Requirements: 7.1, 7.3_

  - [x] 68.2 Implement POST /quant/options/analyze endpoint
    - Accept OptionsAnalysisRequest (chain data with all contracts)
    - Calculate PCR (Put-Call Ratio) from OI and volume
    - Identify ATM strike and near ATM strikes (±3)
    - Detect OI buildup patterns (long buildup, short buildup, long unwinding, short unwinding)
    - Identify support zones (strikes with high put OI)
    - Identify resistance zones (strikes with high call OI)
    - Return OptionsAnalysisResult with PCR, ATM, OI analysis, support/resistance
    - _Requirements: 7.1_

  - [x] 68.3 Update main.py with options routes
    - Add options endpoints to FastAPI app
    - Configure rate limiting middleware (10 req/min)
    - Update API documentation with examples
    - Ensure CORS configuration for frontend
    - _Requirements: 7.1, 17.1_

  - [ ]* 68.4 Write integration tests for options endpoints
    - Test POST /quant/options/chain with NIFTY data
    - Test POST /quant/options/chain with BANKNIFTY data
    - Test POST /quant/options/analyze with sample chain
    - Test symbol validation (reject invalid symbols)
    - Test rate limiting (enforce 10 req/min)
    - _Requirements: 16.6_

- [x] 69. Implement Backend API for Options Chain
  - [x] 69.1 Create POST /api/options/chain endpoint
    - Accept underlying symbol (NIFTY, BANKNIFTY) and expiry date
    - Validate symbol via SymbolValidator (reject non-NIFTY/BANKNIFTY)
    - Fetch options chain from MarketDataService (Kite Connect API)
    - Call Quant Engine POST /quant/options/chain for Greeks and liquidity
    - Apply rate limiting (10 req/min)
    - Cache chain data with 60-second TTL
    - Return structured options chain with Greeks, IV, liquidity warnings
    - _Requirements: 2.3, 2.4, 7.1, 8.1_

  - [x] 69.2 Create POST /api/options/analyze endpoint
    - Accept underlying symbol (NIFTY, BANKNIFTY) and expiry date
    - Fetch options chain via MarketDataService
    - Call Quant Engine POST /quant/options/analyze
    - Return analysis result with PCR, ATM strikes, OI analysis, support/resistance
    - Apply rate limiting (10 req/min)
    - Log all requests for audit
    - _Requirements: 7.1, 8.1, 18.2_

  - [x] 69.3 Implement Audit Logging for Options API
    - Add audit logging to all options endpoints
    - Log: timestamp, user, symbol, endpoint, response status
    - Store logs in AuditLog table
    - Include data flow tracing (Market Data → Quant → Backend → Frontend)
    - _Requirements: 18.2, 20.1_

  - [ ]* 69.4 Write integration tests for options API
    - Test POST /api/options/chain with mock Kite Connect
    - Test POST /api/options/analyze with NIFTY data
    - Test symbol validation (reject RELIANCE, accept NIFTY)
    - Test rate limiting enforcement
    - Test audit logging captures all requests
    - _Requirements: 16.6_

- [x] 70. Create Options Chain Visualization Components
  - [x] 70.1 Create OptionsChainViewer component
    - Display options chain in tabular format with Call and Put columns
    - Columns: Call LTP, Call OI, Call ChangeOI, Call Vol, Call IV, Call Bid/Ask, Strike, Put Bid/Ask, Put LTP, Put OI, Put ChangeOI, Put Vol, Put IV
    - Highlight ATM strike (closest to current price) with bold text
    - Show near ATM strikes (±3 strikes) with light highlight
    - Color-code ITM (in-the-money) vs OTM (out-of-the-money)
    - Display liquidity warnings (badge for wide spreads, low volume, low OI)
    - Add manual "FETCH CHAIN" button (NO auto-refresh)
    - _Requirements: 13.2_

  - [x] 70.2 Create OptionsAnalysisPanel component
    - Display PCR (Put-Call Ratio) with gauge visualization
    - Show ATM strike and nearest strikes (±3)
    - Display OI buildup/unwinding signals in colored badges (green: long buildup, red: short buildup, yellow: unwinding)
    - Show support zones (strikes with high put OI) as horizontal lines on mini chart
    - Show resistance zones (strikes with high call OI) as horizontal lines on mini chart
    - Include refresh timestamp and data staleness indicator
    - _Requirements: 7.1, 13.2_

  - [x] 70.3 Create OIChart component
    - Display bar chart comparing Call OI vs Put OI across strikes
    - X-axis: Strike prices
    - Y-axis: Open Interest
    - Two bars per strike: Call OI (blue), Put OI (red)
    - Mark ATM strike with vertical line
    - Highlight support/resistance zones
    - Add tooltip showing exact OI values on hover
    - _Requirements: 7.1, 13.3_

  - [x] 70.4 Wire options components to backend
    - Connect "FETCH CHAIN" button to POST /api/options/chain
    - Connect OptionsAnalysisPanel to POST /api/options/analyze
    - Display loading states during API calls
    - Show error messages for rate limiting (429) or symbol validation failures
    - Display liquidity warnings prominently
    - NO auto-refresh - require manual button click
    - _Requirements: 13.1, 7.1_

  - [ ]* 70.5 Write frontend component tests
    - Test OptionsChainViewer renders chain data correctly
    - Test ATM strike highlighting
    - Test liquidity warning badges display
    - Test OptionsAnalysisPanel displays PCR and OI analysis
    - Test OIChart renders call/put OI bars
    - _Requirements: 16.6_

- [x] 71. Implement Options Risk Management
  - [x] 71.1 Add options-specific risk rules to RiskService
    - Validate total options exposure <= 20% of portfolio (configurable)
    - Validate position size limits for options (smaller than stocks)
    - Validate liquidity requirements (reject illiquid options)
    - Validate margin requirements for options positions
    - Return risk validation result with pass/fail + warnings
    - _Requirements: 8.1, 8.3_

  - [x] 71.2 Create OptionsRiskPanel component
    - Display options risk metrics summary
    - Show: Total options exposure %, Position count, Liquidity warnings
    - Show risk violations in red if any limits breached
    - Show warnings in yellow if approaching limits (80% of max)
    - Display risk recommendations for user action
    - _Requirements: 8.5, 13.2_

  - [ ]* 71.3 Write unit tests for options risk validation
    - Test exposure limit validation with various portfolio sizes
    - Test position size limit validation
    - Test liquidity requirement validation (wide spreads, low OI)
    - Test risk rule violations trigger correct responses
    - _Requirements: 8.1, 16.4_

- [x] 72. Integrate Options with Existing Architecture
  - [x] 72.1 Extend Database Schema for Options
    - Add OptionsPosition table to Prisma schema
    - Fields: symbol (NIFTY/BANKNIFTY), strikePrice, optionType (CALL/PUT), expiry, entryPrice, quantity, Greeks (JSON), isPaper
    - Link to existing Position model with foreignKey
    - Add indexes on symbol, expiry, isPaper
    - Generate Prisma client and run migrations
    - _Requirements: 11.1, 7.1_

  - [x] 72.2 Extend PortfolioService for options positions
    - Add getOptionsPositions() method to PortfolioService
    - Calculate options-specific P&L (mark-to-market)
    - Track Greeks for all option positions
    - Identify expiring positions (< 7 days to expiry) with alerts
    - Return options positions with current P&L and Greeks
    - _Requirements: 11.1, 11.2, 7.3_

  - [x] 72.3 Add Options to Portfolio Dashboard
    - Extend PortfolioTable component to show options positions
    - Display options separately from stock positions
    - Show: Symbol, Strike, Type, Expiry, Entry, Current, P&L, Greeks (Delta, Theta)
    - Highlight expiring soon (< 7 days) with warning badge
    - Show aggregated options exposure percentage
    - _Requirements: 11.5, 13.4_

  - [ ]* 72.4 Write integration tests for options portfolio
    - Test OptionsPosition model CRUD operations
    - Test getOptionsPositions() returns correct data
    - Test P&L calculation for options positions
    - Test expiring positions detection
    - _Requirements: 11.1, 16.6_

- [x] 73. Implement Paper Trading for Options (ONLY)
  - [x] 73.1 Extend PaperTradingService for options
    - Add executePaperOptionTrade() method
    - Validate trade request with RiskService (options-specific rules)
    - Record option trade in OptionsPosition table with isPaper=true
    - Simulate realistic execution (slippage based on spread)
    - Return execution result with trade ID
    - _Requirements: 9.1, 7.1_

  - [x] 73.2 Add Paper Trade button to Options UI
    - Add "PAPER TRADE" button to OptionsChainViewer (per contract)
    - Show trade confirmation dialog with contract details, risk metrics
    - Display liquidity warnings prominently in dialog
    - On confirmation, call POST /api/trade/paper/option
    - Show success message with trade ID or error message
    - **CRITICAL**: NO live trade button - paper trading ONLY for options
    - _Requirements: 9.1, 13.2, 18.2_

  - [x] 73.3 Create POST /api/trade/paper/option endpoint
    - Accept option trade request (symbol, strike, type, expiry, quantity, price)
    - Validate symbol (NIFTY/BANKNIFTY only)
    - Validate with RiskService (options-specific rules)
    - Execute via PaperTradingService
    - Log trade execution in AuditLog
    - Return trade result with execution details
    - _Requirements: 9.1, 10.1, 18.2_

  - [ ]* 73.4 Write unit tests for paper options trading
    - Test executePaperOptionTrade() flow
    - Test risk validation enforcement
    - Test paper trade recording in database
    - Test audit logging captures all executions
    - _Requirements: 9.1, 10.1, 16.4_

- [x] 74. Add Options Analysis to AI Flow (Optional Enhancement)
  - [x] 74.1 Extend PromptBuilderService for options
    - Support prompts like "Analyze NIFTY options chain"
    - Include options analysis data in AI prompt (PCR, ATM, OI buildup, support/resistance)
    - **CRITICAL**: AI receives only processed analysis data, NOT raw options chain
    - Format prompt to request trade reasoning and risk assessment
    - _Requirements: 4.2, 4.4, 7.1, 18.1_

  - [x] 74.2 Create OptionsRecommendation parser
    - Parse AI response into OptionsRecommendation object
    - Required fields: symbol, strike, type, expiry, action, confidence, reasoning
    - Include risk assessment and invalidation criteria
    - Validate recommendation matches available contracts
    - _Requirements: 4.7, 7.1_

  - [ ]* 74.3 Write unit tests for options AI integration
    - Test prompt building with options analysis data
    - Test recommendation parsing from AI response
    - Verify AI never receives raw options chain data (data flow validation)
    - Test invalid recommendations are rejected
    - _Requirements: 4.2, 18.1, 16.4_

- [x] 75. Checkpoint - Verify Phase 8 Options Chain Engine
  - [x] 75.1 Verify options chain fetching and analysis
    - Start all services (Backend, Quant Engine, Frontend)
    - Test POST /api/options/chain with NIFTY symbol
    - Verify chain displays correctly in OptionsChainViewer
    - Verify ATM strike is highlighted
    - Verify liquidity warnings display for illiquid contracts
    - Test POST /api/options/analyze with BANKNIFTY symbol
    - Verify PCR, ATM, OI analysis, support/resistance display correctly in OptionsAnalysisPanel
    - _Requirements: 7.1, 7.3_

  - [x] 75.2 Verify safety controls and validation
    - Test symbol validation rejects non-NIFTY/BANKNIFTY symbols (e.g., RELIANCE)
    - Test rate limiting enforcement (exceed 10 req/min)
    - Test liquidity filtering identifies wide spreads, low volume, low OI
    - Verify risk validation enforces exposure limits
    - Verify audit logging captures all API requests
    - _Requirements: 8.1, 18.1, 18.2, 20.1_

  - [x] 75.3 Verify paper trading for options
    - Test "PAPER TRADE" button on options chain
    - Verify trade confirmation dialog shows contract details and risk metrics
    - Execute paper option trade and verify recording in database
    - Check options position appears in Portfolio Dashboard
    - Verify P&L calculation updates with market data
    - **VERIFY**: NO live trade button exists for options
    - _Requirements: 9.1, 11.1, 11.5_

  - [x] 75.4 Verify frontend integration and manual controls
    - Verify "FETCH CHAIN" button fetches data (NO auto-refresh)
    - Test OptionsChainViewer displays all columns correctly
    - Test OIChart renders call/put OI comparison
    - Test OptionsAnalysisPanel displays PCR and OI buildup signals
    - Test expiring options positions show warning badges
    - Verify loading states and error messages display correctly
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

  - [x] 75.5 Run all Phase 8 tests and quality checks
    - Run all new unit tests (Quant Engine + Backend)
    - Run integration tests for options endpoints
    - Run frontend component tests
    - Run Python formatter (Black) and linter (Flake8)
    - Run TypeScript type checks, ESLint, Prettier
    - Verify test coverage for new code (target: 80%)
    - Ask the user if questions arise

## Notes

- **Phased Implementation**: This task list is structured in 7 phases. Complete each phase fully before moving to the next.
- **Phase 4 Focus**: Phase 4 adds advanced technical indicators (ADX, ATR, VWAP, volume analysis, 52-week ranges, momentum), multiple EMA periods (5, 15, 50, 200), restructured endpoints (/quant/*), and deterministic scoring.
- **Phase 5 Focus**: Phase 5 implements the Trendline Engine with swing point detection, trendline calculation using linear regression, breakout/breakdown detection with volume confirmation, and retest detection. This provides advanced technical analysis for trend-following strategies.
- **Phase 6 Focus**: Phase 6 implements the Swing Trading Module with configurable stock universe scanning, comprehensive technical analysis (15+ factors), deterministic multi-component scoring with configurable weights, AI reasoning integration with safety controls, and paper trading functionality. Critical safety feature: NO automatic live trade execution.
- **Phase 7 Focus**: Phase 7 implements the Intraday Stock Analysis Module with manual refresh (NO auto-refresh), comprehensive technical analysis (VWAP, EMA 5/15, RSI, MACD, Volume, ATR, Opening Range, Previous Day Levels, Support/Resistance, Trendlines), data freshness validation, and safety controls. Critical features: Manual "REFRESH & ANALYZE" button only, HOLD signal when data is stale, confidence and risk/reward thresholds enforced.
- **Phase 8 Focus**: Phase 8 implements the Options Chain Engine with CORE functionality ONLY. Features include: NIFTY/BANKNIFTY options chain fetching via Kite Connect, basic analysis (Expiry, Strike, Call/Put LTP, Call/Put OI, Change in OI, Volume, IV, Bid/Ask, Spread), PCR (Put-Call Ratio) calculation, ATM strike identification and near ATM strikes, OI buildup/unwinding detection (long buildup, short buildup), support/resistance zones from OI data, liquidity filtering (wide spreads, illiquid options, deep OTM contracts), Greeks calculation (Delta, Gamma, Theta, Vega), visualization with manual refresh, and paper trading ONLY. **CRITICAL**: Manual "FETCH CHAIN" button (NO auto-refresh), symbol validation (NIFTY/BANKNIFTY only), rate limiting (10 req/min), audit logging, NO multi-leg strategies, NO strategy execution, NO automatic options trading.
- **Testing Requirements**: After each phase, run formatter, linter, type checks, and all tests. Do not proceed until all checks pass.
- **Optional Tasks**: Tasks marked with `*` are optional test sub-tasks. They can be skipped for faster MVP but are recommended for production quality.
- **Property-Based Tests**: All correctness properties from the design document have corresponding property test sub-tasks (Phase 7 adds Property 21: Intraday Scoring Determinism).
- **Architectural Constraints**: Multiple tasks enforce the critical constraint that AI_Service cannot access Market_Data_Provider or Broker_API directly. Phase 4, Phase 6, and Phase 7 scoring are deterministic (no AI calculations).
- **Requirements Traceability**: Each task references specific requirements for full traceability.
- **Checkpoints**: Seven checkpoint tasks ensure incremental validation and prevent proceeding with broken functionality.
- **Backward Compatibility**: Phase 4 maintains old endpoints as deprecated but functional during transition period.
- **Safety First**: Phase 6 and Phase 7 enforce multiple safety controls: "NO TRADE" logic, paper trading only by default, explicit user action required for live trades, comprehensive audit logging. Phase 7 adds critical stale data protection.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2", "3.4", "3.6", "3.8", "4.1", "4.2", "4.3"] },
    { "id": 4, "tasks": ["3.3", "3.5", "3.7", "3.9"] },
    { "id": 5, "tasks": ["5.1", "5.2", "5.3", "5.4"] },
    { "id": 6, "tasks": ["5.5"] },
    { "id": 7, "tasks": ["7.1", "7.2", "7.3"] },
    { "id": 8, "tasks": ["8.1"] },
    { "id": 9, "tasks": ["8.2", "8.3", "8.4"] },
    { "id": 10, "tasks": ["9.1"] },
    { "id": 11, "tasks": ["9.2"] },
    { "id": 12, "tasks": ["9.3", "9.4"] },
    { "id": 13, "tasks": ["10.1"] },
    { "id": 14, "tasks": ["10.2", "10.3"] },
    { "id": 15, "tasks": ["11.1", "11.2"] },
    { "id": 16, "tasks": ["11.3", "11.4"] },
    { "id": 17, "tasks": ["12.1"] },
    { "id": 18, "tasks": ["12.2", "12.3", "12.4", "12.5"] },
    { "id": 19, "tasks": ["13.1"] },
    { "id": 20, "tasks": ["13.2", "13.3", "13.4"] },
    { "id": 21, "tasks": ["14.1"] },
    { "id": 22, "tasks": ["14.2", "14.3", "14.4", "14.5"] },
    { "id": 23, "tasks": ["15.1", "15.2", "15.3", "15.4"] },
    { "id": 24, "tasks": ["15.5"] },
    { "id": 25, "tasks": ["17.1", "17.2", "17.3", "17.4", "17.5"] },
    { "id": 26, "tasks": ["18.1", "18.2", "18.3", "18.4"] },
    { "id": 27, "tasks": ["19.1", "19.2", "19.3"] },
    { "id": 28, "tasks": ["19.4"] },
    { "id": 29, "tasks": ["20.1", "20.2"] },
    { "id": 30, "tasks": ["20.3", "20.4", "20.5"] },
    { "id": 31, "tasks": ["21.1"] },
    { "id": 32, "tasks": ["21.2"] },
    { "id": 33, "tasks": ["21.3"] },
    { "id": 34, "tasks": ["22.1", "22.2"] },
    { "id": 35, "tasks": ["23.1"] },
    { "id": 36, "tasks": ["23.2"] },
    { "id": 37, "tasks": ["23.3"] },
    { "id": 38, "tasks": ["24.1", "24.2", "24.3"] },
    { "id": 39, "tasks": ["24.4"] },
    { "id": 40, "tasks": ["26.1", "26.3", "26.5", "26.7", "26.9"] },
    { "id": 41, "tasks": ["26.2", "26.4", "26.6", "26.8", "26.10"] },
    { "id": 42, "tasks": ["27.1"] },
    { "id": 43, "tasks": ["27.2"] },
    { "id": 44, "tasks": ["27.3"] },
    { "id": 45, "tasks": ["29.1", "29.2"] },
    { "id": 46, "tasks": ["30.1"] },
    { "id": 47, "tasks": ["30.2", "30.3"] },
    { "id": 48, "tasks": ["28.1", "28.2"] },
    { "id": 49, "tasks": ["28.3"] },
    { "id": 50, "tasks": ["28.4"] },
    { "id": 51, "tasks": ["31.1", "31.2"] },
    { "id": 52, "tasks": ["31.3"] },
    { "id": 53, "tasks": ["32.1", "32.2"] },
    { "id": 54, "tasks": ["32.3"] },
    { "id": 55, "tasks": ["33.1", "33.2", "33.3"] },
    { "id": 56, "tasks": ["33.4"] },
    { "id": 57, "tasks": ["35.1"] },
    { "id": 58, "tasks": ["35.2", "35.3"] },
    { "id": 59, "tasks": ["35.4"] },
    { "id": 60, "tasks": ["36.1"] },
    { "id": 61, "tasks": ["36.2"] },
    { "id": 62, "tasks": ["36.3"] },
    { "id": 63, "tasks": ["37.1", "37.2"] },
    { "id": 64, "tasks": ["37.3"] },
    { "id": 65, "tasks": ["38.1"] },
    { "id": 66, "tasks": ["38.2"] },
    { "id": 67, "tasks": ["38.3"] },
    { "id": 68, "tasks": ["39.1"] },
    { "id": 69, "tasks": ["39.2"] },
    { "id": 70, "tasks": ["40.1", "40.2"] },
    { "id": 71, "tasks": ["40.3"] },
    { "id": 72, "tasks": ["41.1"] },
    { "id": 73, "tasks": ["41.2"] },
    { "id": 74, "tasks": ["41.3"] },
    { "id": 75, "tasks": ["42.1", "42.2", "42.3"] },
    { "id": 76, "tasks": ["43.1", "43.2"] },
    { "id": 77, "tasks": ["43.3"] },
    { "id": 78, "tasks": ["44.1", "44.5", "44.6"] },
    { "id": 79, "tasks": ["44.2", "44.3", "44.4"] },
    { "id": 80, "tasks": ["44.7"] },
    { "id": 81, "tasks": ["45.1", "45.2"] },
    { "id": 82, "tasks": ["45.3"] },
    { "id": 83, "tasks": ["45.4", "45.5"] },
    { "id": 84, "tasks": ["46.1", "46.2"] },
    { "id": 85, "tasks": ["46.3"] },
    { "id": 86, "tasks": ["46.4"] },
    { "id": 87, "tasks": ["47.1", "47.2"] },
    { "id": 88, "tasks": ["47.3"] },
    { "id": 89, "tasks": ["48.1"] },
    { "id": 90, "tasks": ["48.2", "48.3"] },
    { "id": 91, "tasks": ["48.4"] },
    { "id": 92, "tasks": ["49.1", "49.2", "49.3"] },
    { "id": 93, "tasks": ["49.4"] },
    { "id": 94, "tasks": ["50.1", "50.2", "50.3"] },
    { "id": 95, "tasks": ["50.4"] },
    { "id": 96, "tasks": ["50.5"] },
    { "id": 97, "tasks": ["51.1"] },
    { "id": 98, "tasks": ["51.2", "51.3"] },
    { "id": 99, "tasks": ["51.4"] },
    { "id": 100, "tasks": ["52.1", "52.2"] },
    { "id": 101, "tasks": ["52.3"] },
    { "id": 102, "tasks": ["52.4"] },
    { "id": 103, "tasks": ["53.1", "53.2", "53.3", "53.4", "53.5"] },
    { "id": 104, "tasks": ["54.1", "54.2"] },
    { "id": 105, "tasks": ["54.3"] },
    { "id": 106, "tasks": ["55.1"] },
    { "id": 107, "tasks": ["55.2"] },
    { "id": 108, "tasks": ["55.3"] },
    { "id": 109, "tasks": ["56.1"] },
    { "id": 110, "tasks": ["56.2"] },
    { "id": 111, "tasks": ["56.3"] },
    { "id": 112, "tasks": ["57.1"] },
    { "id": 113, "tasks": ["57.2", "57.3"] },
    { "id": 114, "tasks": ["57.4"] },
    { "id": 115, "tasks": ["58.1"] },
    { "id": 116, "tasks": ["58.2"] },
    { "id": 117, "tasks": ["58.3", "58.4"] },
    { "id": 118, "tasks": ["59.1"] },
    { "id": 119, "tasks": ["59.2"] },
    { "id": 120, "tasks": ["59.3"] },
    { "id": 121, "tasks": ["60.1", "60.2", "60.3", "60.4"] },
    { "id": 122, "tasks": ["60.5"] },
    { "id": 123, "tasks": ["61.1"] },
    { "id": 124, "tasks": ["61.2"] },
    { "id": 125, "tasks": ["61.3"] },
    { "id": 126, "tasks": ["62.1", "62.2", "62.3", "62.4"] },
    { "id": 127, "tasks": ["62.5"] },
    { "id": 128, "tasks": ["62.6"] },
    { "id": 129, "tasks": ["63.1", "63.2", "63.3"] },
    { "id": 130, "tasks": ["63.4"] },
    { "id": 131, "tasks": ["64.1", "64.2"] },
    { "id": 132, "tasks": ["64.3"] },
    { "id": 133, "tasks": ["65.1", "65.2", "65.3", "65.4", "65.5", "65.6"] },
    { "id": 134, "tasks": ["66.1", "66.2"] },
    { "id": 135, "tasks": ["66.3"] },
    { "id": 136, "tasks": ["66.4"] },
    { "id": 137, "tasks": ["67.1", "67.2", "67.3"] },
    { "id": 138, "tasks": ["67.4"] },
    { "id": 139, "tasks": ["68.1", "68.2"] },
    { "id": 140, "tasks": ["68.3"] },
    { "id": 141, "tasks": ["68.4"] },
    { "id": 142, "tasks": ["69.1", "69.2"] },
    { "id": 143, "tasks": ["69.3"] },
    { "id": 144, "tasks": ["69.4"] },
    { "id": 145, "tasks": ["70.1", "70.2", "70.3"] },
    { "id": 146, "tasks": ["70.4"] },
    { "id": 147, "tasks": ["70.5"] },
    { "id": 148, "tasks": ["71.1", "71.2"] },
    { "id": 149, "tasks": ["71.3"] },
    { "id": 150, "tasks": ["72.1"] },
    { "id": 151, "tasks": ["72.2", "72.3"] },
    { "id": 152, "tasks": ["72.4"] },
    { "id": 153, "tasks": ["73.1", "73.2"] },
    { "id": 154, "tasks": ["73.3"] },
    { "id": 155, "tasks": ["73.4"] },
    { "id": 156, "tasks": ["74.1"] },
    { "id": 157, "tasks": ["74.2"] },
    { "id": 158, "tasks": ["74.3"] },
    { "id": 159, "tasks": ["75.1", "75.2", "75.3", "75.4", "75.5"] }
  ]
}
```
