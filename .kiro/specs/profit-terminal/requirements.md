# Requirements Document

## Introduction

ProfitTerminal is a local-first AI trading operating system for Indian markets (NSE stocks, NIFTY/BANKNIFTY options). The system provides AI-powered trading recommendations based on quantitative analysis, technical indicators, and trendline analysis while maintaining strict separation between AI reasoning and broker execution. All market data analysis flows through deterministic quant and risk engines before AI evaluation, ensuring AI cannot fabricate data or bypass risk controls.

## Glossary

- **ProfitTerminal**: The complete local-first AI trading operating system
- **Frontend_App**: Next.js application running on localhost:3000
- **Backend_API**: NestJS application running on localhost:4000
- **Quant_Engine**: Python FastAPI service running on localhost:8000 for quantitative analysis
- **Database**: PostgreSQL database running on localhost:5432
- **AI_Service**: Service that provides natural language understanding and trade reasoning
- **Risk_Engine**: Component that validates all trades against risk rules
- **Market_Data_Provider**: Kite Connect API for fetching NSE market data
- **Broker_API**: Kotak Neo API for executing trades
- **Paper_Trading**: Simulated trading without real money
- **Live_Trading**: Real trading with actual broker execution
- **Swing_Trade**: Position held for days to weeks
- **Intraday_Trade**: Position opened and closed within the same trading day
- **Scalping_Trade**: Very short-term intraday position (minutes to hours)
- **NSE**: National Stock Exchange of India
- **Options_Chain**: List of all available options contracts for NIFTY/BANKNIFTY
- **Technical_Indicator**: Calculated metric from price data (RSI, MACD, etc.)
- **Trendline**: Line connecting price points to identify trends
- **User_Prompt**: Natural language input from user requesting analysis or action

## Requirements

### Requirement 1: Local Application Infrastructure

**User Story:** As a trader, I want the entire application to run locally on my machine, so that I have full control and privacy over my trading data.

#### Acceptance Criteria

1. THE Frontend_App SHALL run on localhost:3000
2. THE Backend_API SHALL run on localhost:4000
3. THE Quant_Engine SHALL run on localhost:8000
4. THE Database SHALL run on localhost:5432
5. WHEN Docker Compose is started, THE ProfitTerminal SHALL initialize all services
6. THE ProfitTerminal SHALL store all data in the local Database

### Requirement 2: Market Data Retrieval

**User Story:** As a trader, I want fresh market data from NSE, so that I can make informed trading decisions.

#### Acceptance Criteria

1. WHEN market data is requested, THE Backend_API SHALL fetch data from Market_Data_Provider
2. THE Backend_API SHALL retrieve NSE stock price data including OHLCV
3. THE Backend_API SHALL retrieve NIFTY options chain data
4. THE Backend_API SHALL retrieve BANKNIFTY options chain data
5. WHEN Market_Data_Provider is unavailable, THE Backend_API SHALL return an error status
6. THE Backend_API SHALL cache market data for no longer than 60 seconds

### Requirement 3: Quantitative Analysis Engine

**User Story:** As a trader, I want quantitative analysis of market data, so that I have objective metrics for decision making.

#### Acceptance Criteria

1. WHEN market data is received, THE Quant_Engine SHALL calculate technical indicators
2. THE Quant_Engine SHALL calculate RSI (Relative Strength Index)
3. THE Quant_Engine SHALL calculate MACD (Moving Average Convergence Divergence)
4. THE Quant_Engine SHALL calculate moving averages (SMA, EMA)
5. THE Quant_Engine SHALL calculate Bollinger Bands
6. THE Quant_Engine SHALL identify support and resistance levels
7. THE Quant_Engine SHALL detect trendlines from price data
8. THE Quant_Engine SHALL return structured quantitative results to Backend_API

### Requirement 4: AI-Powered Trade Recommendations

**User Story:** As a trader, I want AI to analyze quantitative data and provide trade recommendations, so that I can leverage AI reasoning while maintaining deterministic risk controls.

#### Acceptance Criteria

1. WHEN a User_Prompt is received, THE Backend_API SHALL parse the natural language request
2. THE Backend_API SHALL send quantitative data to AI_Service for reasoning
3. THE AI_Service SHALL NOT receive direct market data from Market_Data_Provider
4. THE AI_Service SHALL receive only processed data from Quant_Engine
5. WHEN conditions are unfavorable, THE AI_Service SHALL recommend HOLD or NO TRADE
6. THE AI_Service SHALL provide reasoning for each recommendation
7. THE AI_Service SHALL return structured recommendations including entry price, target, stop loss, and confidence level

### Requirement 5: Swing Trading Analysis

**User Story:** As a swing trader, I want to analyze NSE stocks for multi-day positions, so that I can identify good swing trading opportunities.

#### Acceptance Criteria

1. WHEN a User_Prompt requests swing trade analysis, THE Backend_API SHALL identify the request type
2. THE Backend_API SHALL retrieve historical data for at least 90 days
3. THE Quant_Engine SHALL calculate swing trading indicators (daily timeframe)
4. THE AI_Service SHALL analyze data for swing trading opportunities
5. THE Backend_API SHALL return swing trade recommendations with holding period estimates

### Requirement 6: Intraday Trading Analysis

**User Story:** As an intraday trader, I want to manually trigger analysis for NSE stocks, so that I can find same-day trading opportunities.

#### Acceptance Criteria

1. WHEN a User_Prompt requests intraday analysis, THE Backend_API SHALL identify the request type
2. THE Backend_API SHALL retrieve intraday data (1-minute, 5-minute, 15-minute candles)
3. THE Quant_Engine SHALL calculate intraday technical indicators
4. THE AI_Service SHALL analyze data for intraday opportunities
5. THE Backend_API SHALL return intraday trade recommendations with intraday timeframes

### Requirement 7: Options Scalping Analysis

**User Story:** As an options trader, I want to analyze NIFTY and BANKNIFTY options for scalping, so that I can capture short-term price movements.

#### Acceptance Criteria

1. WHEN a User_Prompt requests options analysis, THE Backend_API SHALL identify NIFTY or BANKNIFTY
2. THE Backend_API SHALL retrieve current options chain data
3. THE Quant_Engine SHALL calculate options Greeks (Delta, Gamma, Theta, Vega)
4. THE Quant_Engine SHALL identify high-volume strike prices
5. THE AI_Service SHALL recommend specific options contracts for scalping
6. THE Backend_API SHALL return options recommendations including strike price, expiry, and contract type

### Requirement 8: Risk Validation Engine

**User Story:** As a trader, I want all trades validated against risk rules, so that I cannot accidentally exceed my risk limits.

#### Acceptance Criteria

1. WHEN a trade is proposed, THE Risk_Engine SHALL validate position size
2. THE Risk_Engine SHALL validate stop loss placement
3. THE Risk_Engine SHALL validate portfolio exposure limits
4. THE Risk_Engine SHALL validate maximum drawdown limits
5. WHEN risk validation fails, THE Risk_Engine SHALL reject the trade with a reason
6. THE AI_Service SHALL NOT bypass Risk_Engine validation

### Requirement 9: Paper Trading Execution

**User Story:** As a trader, I want to execute paper trades, so that I can test strategies without risking real money.

#### Acceptance Criteria

1. WHEN a paper trade is requested, THE Backend_API SHALL record the trade in Database
2. THE Backend_API SHALL simulate trade execution with realistic slippage
3. THE Backend_API SHALL track paper trade PnL (Profit and Loss)
4. THE Backend_API SHALL update paper positions based on live market data
5. THE Backend_API SHALL NOT send paper trades to Broker_API

### Requirement 10: Live Trading Execution

**User Story:** As a trader, I want to execute live trades through Kotak Neo, so that I can act on AI recommendations with real money.

#### Acceptance Criteria

1. WHEN a live trade is recommended, THE Frontend_App SHALL display a confirmation dialog
2. THE Frontend_App SHALL require explicit user confirmation before live trades
3. WHEN user confirms, THE Backend_API SHALL validate the trade with Risk_Engine
4. WHEN Risk_Engine approves, THE Backend_API SHALL send the order to Broker_API
5. THE Backend_API SHALL receive order status from Broker_API
6. THE Backend_API SHALL store trade execution details in Database
7. THE AI_Service SHALL NOT send orders directly to Broker_API

### Requirement 11: Trade Portfolio Management

**User Story:** As a trader, I want to track all my existing trades, so that I can monitor my portfolio performance.

#### Acceptance Criteria

1. THE Backend_API SHALL retrieve all open positions from Database
2. THE Backend_API SHALL calculate current PnL for each position
3. THE Backend_API SHALL calculate portfolio-level metrics (total exposure, win rate)
4. WHEN a User_Prompt requests portfolio analysis, THE AI_Service SHALL analyze portfolio health
5. THE Frontend_App SHALL display all positions with real-time PnL updates

### Requirement 12: Database Schema and Persistence

**User Story:** As a system administrator, I want all trading data persisted in PostgreSQL, so that data survives application restarts.

#### Acceptance Criteria

1. THE Database SHALL store user configuration
2. THE Database SHALL store trade history (paper and live)
3. THE Database SHALL store market data cache
4. THE Database SHALL store AI recommendations history
5. THE Backend_API SHALL use Prisma ORM for database access
6. WHEN ProfitTerminal restarts, THE Backend_API SHALL restore state from Database

### Requirement 13: User Interface Components

**User Story:** As a trader, I want an intuitive web interface, so that I can easily interact with the trading system.

#### Acceptance Criteria

1. THE Frontend_App SHALL provide a natural language input field for User_Prompts
2. THE Frontend_App SHALL display AI recommendations in a structured format
3. THE Frontend_App SHALL display interactive price charts using TradingView Lightweight Charts
4. THE Frontend_App SHALL display portfolio positions and PnL
5. THE Frontend_App SHALL use Tailwind CSS and shadcn/ui components
6. THE Frontend_App SHALL update data reactively using TanStack Query

### Requirement 14: AI Strategy Generation

**User Story:** As a trader, I want to generate custom trading strategies using AI, so that I can adapt to different market conditions.

#### Acceptance Criteria

1. WHEN a User_Prompt requests strategy generation, THE AI_Service SHALL create a trading strategy
2. THE AI_Service SHALL define entry conditions for the strategy
3. THE AI_Service SHALL define exit conditions for the strategy
4. THE AI_Service SHALL define risk parameters for the strategy
5. THE Backend_API SHALL store generated strategies in Database
6. THE Backend_API SHALL allow backtesting of generated strategies against historical data

### Requirement 15: AI Agent Performance Monitoring

**User Story:** As a trader, I want to monitor AI recommendation performance, so that I can assess the system's effectiveness.

#### Acceptance Criteria

1. THE Backend_API SHALL track all AI recommendations
2. THE Backend_API SHALL track actual outcomes of recommended trades
3. THE Backend_API SHALL calculate AI recommendation accuracy rate
4. THE Backend_API SHALL calculate average PnL of AI-recommended trades
5. THE Frontend_App SHALL display AI performance metrics
6. WHEN AI performance degrades below threshold, THE Backend_API SHALL alert the user

### Requirement 16: Code Quality and Testing

**User Story:** As a developer, I want all code validated before completion, so that the system is reliable and maintainable.

#### Acceptance Criteria

1. THE ProfitTerminal SHALL pass all TypeScript type checks
2. THE ProfitTerminal SHALL pass all ESLint rules
3. THE ProfitTerminal SHALL pass all Prettier formatting checks
4. THE Backend_API SHALL have unit tests for all critical business logic
5. THE Quant_Engine SHALL have unit tests for all calculation functions
6. THE Frontend_App SHALL have integration tests for key user flows
7. FOR ALL critical data transformations, THE ProfitTerminal SHALL implement property-based tests

### Requirement 17: API Configuration and Provider Abstraction

**User Story:** As a system administrator, I want to configure market data and broker APIs, so that I can connect to different providers.

#### Acceptance Criteria

1. THE Backend_API SHALL read Market_Data_Provider credentials from environment variables
2. THE Backend_API SHALL read Broker_API credentials from environment variables
3. THE Backend_API SHALL support AI provider abstraction (external API initially)
4. WHERE local LLM support is configured, THE AI_Service SHALL support Ollama integration
5. WHEN API credentials are invalid, THE Backend_API SHALL return authentication errors

### Requirement 18: Data Flow Architecture Enforcement

**User Story:** As a system architect, I want to enforce the correct data flow, so that AI cannot bypass risk controls or fabricate data.

#### Acceptance Criteria

1. THE AI_Service SHALL NOT have direct access to Market_Data_Provider
2. THE AI_Service SHALL NOT have direct access to Broker_API
3. THE Backend_API SHALL enforce the flow: Market_Data_Provider → Quant_Engine → AI_Service
4. THE Backend_API SHALL enforce the flow: AI_Service → Risk_Engine → Broker_API (for live trades)
5. WHEN AI_Service attempts to bypass flow, THE Backend_API SHALL reject the request
6. THE Backend_API SHALL log all data flow for audit purposes

### Requirement 19: Natural Language Prompt Parsing

**User Story:** As a trader, I want to interact with natural language, so that I don't need to learn complex commands.

#### Acceptance Criteria

1. WHEN a User_Prompt is received, THE Backend_API SHALL parse the intent
2. THE Backend_API SHALL extract trading symbols from User_Prompt
3. THE Backend_API SHALL extract timeframe from User_Prompt (swing, intraday, scalping)
4. THE Backend_API SHALL extract asset type from User_Prompt (stock, options)
5. WHEN User_Prompt is ambiguous, THE Backend_API SHALL request clarification
6. THE Backend_API SHALL support prompts like "Find the best swing trade today"

### Requirement 20: Error Handling and System Reliability

**User Story:** As a trader, I want the system to handle errors gracefully, so that I don't lose data or miss trading opportunities.

#### Acceptance Criteria

1. WHEN Market_Data_Provider fails, THE Backend_API SHALL log the error and notify the user
2. WHEN Quant_Engine fails, THE Backend_API SHALL return an error without AI recommendation
3. WHEN AI_Service fails, THE Backend_API SHALL return the quantitative analysis without AI reasoning
4. WHEN Broker_API fails, THE Backend_API SHALL retry the request up to 3 times
5. WHEN Database is unavailable, THE Backend_API SHALL queue operations in memory
6. THE ProfitTerminal SHALL NOT crash when external services are unavailable

### Requirement 21: Swing Trading Module

**User Story:** As a swing trader, I want an automated scanning and analysis module for NSE stocks, so that I can identify high-quality swing trading opportunities with minimal manual effort.

#### Acceptance Criteria

1. THE Backend_API SHALL provide a configurable stock universe for swing trading scans
2. THE Quant_Engine SHALL analyze all technical factors required for swing trading: price action, EMA (20, 50, 200), RSI, ADX, ATR, MACD, volume metrics, relative volume, 52-week high/low, breakout patterns, breakout retest, support/resistance levels, trendlines, sector strength, and market regime
3. THE Quant_Engine SHALL implement a deterministic scoring algorithm with configurable weights
4. THE Backend_API SHALL provide POST /swing/scan endpoint to scan universe and return ranked candidates
5. THE Backend_API SHALL provide POST /swing/analyze/:symbol endpoint for deep analysis of specific symbols
6. WHEN no setup meets minimum requirements, THE Backend_API SHALL return "NO TRADE" recommendation
7. THE Frontend_App SHALL provide "BUY ON PAPER" button for executing paper trades
8. THE Backend_API SHALL NOT execute live orders automatically for swing trading module
9. WHEN paper trade is executed, THE system SHALL stop and NOT proceed to live trading automatically

**Default Scoring Weights:**
- Trend: 20%
- Technical: 20%
- Volume: 15%
- Relative Strength: 15%
- Breakout: 10%
- Sector: 10%
- Risk/Reward: 10%

**AI Integration:**
- AI reasoning SHALL come AFTER deterministic analysis
- AI SHALL receive only verified data from Quant_Engine (NO raw market data)
- AI recommendation output SHALL include: Stock, Signal, Setup, Entry, Stop Loss, Target, Risk/Reward, Probability, Trend, Volume, Trendline, Support, Resistance, Market Regime, Rationale, Invalidation criteria
