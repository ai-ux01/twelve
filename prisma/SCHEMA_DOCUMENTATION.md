# ProfitTerminal Database Schema Documentation

## Overview

This document describes the comprehensive database schema for ProfitTerminal - a local-first AI trading OS for Indian markets. The schema is designed with **complete AI traceability** as a core requirement.

## Design Principles

1. **AI Traceability**: Every AI recommendation is traceable to its source (prompt, conversation, agent decision, market data snapshot)
2. **Immutability**: Historical data is never modified, only appended
3. **Audit Trail**: Complete audit log for compliance and debugging
4. **Relationships**: Strong foreign key relationships ensure data integrity
5. **Indexing**: Strategic indexes for query performance
6. **Enums**: Type-safe enums for categorical data

---

## Schema Structure (40 Models)

### 1. USER & CONFIGURATION (2 models)

#### User

Core user account model.

- **Relations**: RiskProfile, Portfolio, Prompts, AIConversations, Trades, Backtests, TradeJournals, Agents
- **Indexes**: email

#### RiskProfile

User-specific risk parameters and API credentials.

- **Fields**: Risk limits, position sizing, API keys (encrypted), AI configuration
- **Relations**: One-to-one with User
- **Note**: API credentials should be encrypted at application level

---

### 2. MARKET DATA & INSTRUMENTS (6 models)

#### Instrument

Master list of tradeable instruments (stocks, options, indices).

- **Fields**: symbol, exchange, assetType, sector, ISIN
- **Options Support**: underlying, strikePrice, expiry, optionType
- **Relations**: MarketData, Candles, Indicators, Trendlines, Signals
- **Indexes**: symbol, assetType, (exchange + assetType)

#### MarketData

Real-time and historical market data snapshots.

- **Fields**: OHLCV, volume, open interest, VWAP, bid/ask
- **Unique**: (instrumentId + timestamp)
- **Indexes**: instrumentId + timestamp, timestamp
- **Note**: High-frequency writes, consider partitioning

#### Candle

Aggregated OHLCV data by timeframe.

- **Fields**: OHLCV for different timeframes
- **Timeframes**: TICK, 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w, 1month
- **Unique**: (instrumentId + timeframe + timestamp)
- **Indexes**: instrumentId + timeframe + timestamp

#### IndicatorSnapshot

Calculated technical indicators at a point in time.

- **Trend**: SMA, EMA (various periods)
- **Momentum**: RSI, MACD, Stochastic
- **Volatility**: ATR, Bollinger Bands
- **Volume**: OBV, VWAP
- **Greeks**: Delta, Gamma, Theta, Vega (for options)
- **Relations**: Links to Signals
- **Unique**: (instrumentId + timeframe + timestamp)

#### Trendline

Detected trendlines with statistical properties.

- **Types**: SUPPORT, RESISTANCE, UPTREND, DOWNTREND, CHANNEL
- **Fields**: start/end points, slope, R², touches, confidence
- **Relations**: Links to Instrument and Signals
- **Indexes**: instrumentId + isActive

#### SupportResistance

Identified support and resistance levels.

- **Fields**: priceLevel, strength, touches, first/last touch
- **Relations**: Links to Instrument and Signals
- **Indexes**: instrumentId + isActive, priceLevel

#### MarketRegime

Detected market regimes (trending, ranging, volatile, etc.).

- **Fields**: regime type, start/end time, volatility, trend strength
- **Relations**: Links to Instrument and Signals
- **Indexes**: instrumentId + startTime, regime

---

### 3. AI TRACEABILITY (9 models)

This is the **core traceability layer** that tracks every AI interaction.

#### Prompt

Original user input prompts.

- **Fields**: rawPrompt, intent, extracted symbols/timeframe/tradeType
- **Relations**: PromptVersions, AIConversations, Signals
- **Indexes**: userId + createdAt, intent
- **Traceability**: Source of all AI interactions

#### PromptVersion

Versions of processed prompts (for prompt engineering).

- **Fields**: version number, processed text, template, variables
- **Relations**: Links to Prompt and AIMessages
- **Unique**: (promptId + version)
- **Note**: Allows A/B testing of prompts

#### AIConversation

Multi-turn conversations with AI.

- **Types**: TRADE_ANALYSIS, STRATEGY_DEVELOPMENT, PORTFOLIO_REVIEW, etc.
- **Status**: ACTIVE, COMPLETED, ABANDONED, ERROR
- **Relations**: User, Prompt, AIMessages
- **Indexes**: userId + startedAt, status

#### AIMessage

Individual messages in AI conversations.

- **Fields**: role (USER/ASSISTANT/SYSTEM), content, AI model metadata
- **Performance Metrics**: tokensUsed, latencyMs, cost
- **Context**: Snapshot of market data/indicators provided to AI
- **Relations**: Conversation, PromptVersion, AgentDecisions, Signals
- **Indexes**: conversationId + createdAt, aiModel
- **CRITICAL**: This is where we track what data the AI saw

#### Agent

AI agents with specific roles (Market Analyst, Risk Manager, etc.).

- **Types**: 6 agent types (MARKET_ANALYST, RISK_MANAGER, etc.)
- **Configuration**: AI model, temperature, max tokens
- **Relations**: Observations, Decisions, Memories
- **Indexes**: userId + agentType, isActive

#### AgentObservation

What agents observe in the market.

- **Types**: PRICE_MOVEMENT, VOLUME_SPIKE, INDICATOR_SIGNAL, etc.
- **Fields**: observationType, data (JSON), timestamp, importance
- **Relations**: Agent, AgentDecisions
- **Indexes**: agentId + timestamp, observationType

#### AgentDecision

Decisions made by agents.

- **Types**: ENTER_TRADE, EXIT_TRADE, ADJUST_POSITION, HOLD, SKIP
- **Fields**: decision text, reasoning, confidence, wasExecuted, outcome
- **Relations**: Agent, Observation, AIMessage, Signals
- **Indexes**: agentId + timestamp, decisionType
- **CRITICAL**: Links agent reasoning to trading signals

#### AgentMemory

Long-term memory for agents.

- **Types**: EPISODIC (experiences), SEMANTIC (facts), PROCEDURAL (how-to), WORKING (short-term)
- **Fields**: content, importance, accessCount, lastAccessed
- **Note**: Embedding field commented out (optional arrays not supported)
- **Future**: Can add vector embeddings for semantic search

---

### 4. SIGNALS (1 model)

#### Signal

**The most important model for traceability** - connects everything.

**Source Traceability (Foreign Keys)**:

- promptId → Links to user prompt
- aiMessageId → Links to specific AI message
- agentDecisionId → Links to agent decision

**Market Context (Foreign Keys)**:

- instrumentId → What instrument
- indicatorSnapshotId → Indicator values at signal time
- trendlineId → Relevant trendline
- supportResistanceId → Relevant S/R level
- marketRegimeId → Market regime at signal time

**Signal Details**:

- signalType: ENTRY, EXIT, STOP_LOSS_ADJUST, etc.
- direction: LONG, SHORT, FLAT
- strength: 0.0 to 1.0
- confidence: 0.0 to 1.0

**Trade Recommendation**:

- entryPrice, stopLoss, target, positionSize
- riskAmount, rewardAmount, riskRewardRatio
- successProbability (AI estimate)

**Reasoning**:

- reasoning (text)
- keyFactors (array of strings)

**Execution Tracking**:

- status: ACTIVE, EXECUTED, EXPIRED, CANCELLED, INVALIDATED
- expiresAt (optional)

**Relations**:

- Links to PaperTrades and LiveTrades

**Indexes**:

- instrumentId + timestamp
- signalType + status
- confidence

**Why This Matters**:
Every paper trade and live trade can be traced back through Signal → AIMessage/AgentDecision → Prompt → Market Data Snapshot. This provides complete accountability for AI recommendations.

---

### 5. TRADING (6 models)

#### PaperTrade

Simulated trades for testing strategies.

- **Fields**: symbol, direction, quantity, entry/stop/target
- **Simulation**: simulatedSlippage, simulatedFees
- **Status**: OPEN, CLOSED, STOPPED
- **PnL Tracking**: unrealizedPnL, realizedPnL
- **Relations**: User, Signal, TradeExecutions, TradeJournals
- **Indexes**: userId + status, symbol, signalId
- **CRITICAL**: signalId preserves exact recommendation

#### LiveTrade

Real trades executed through broker.

- **Fields**: Same as PaperTrade + broker details
- **Broker**: brokerOrderId, broker name
- **Fees**: brokerageFees, sttCharges, otherCharges
- **Relations**: User, Signal, TradeExecutions, TradeJournals
- **Indexes**: userId + status, symbol, signalId, brokerOrderId

#### TradeExecution

Individual executions (entry, partial exit, stop loss, etc.).

- **Links**: Either paperTradeId OR liveTradeId
- **Fields**: executionType, quantity, price, fees, brokerOrderId
- **Types**: ENTRY, PARTIAL_EXIT, FULL_EXIT, STOP_LOSS, TARGET, MANUAL
- **Indexes**: paperTradeId, liveTradeId, executedAt

---

### 6. BACKTESTING (2 models)

#### Backtest

Backtest runs with configuration and results.

- **Parameters**: symbols, date range, initial capital, strategy config
- **Results**: totalTrades, winRate, totalReturn, maxDrawdown, sharpeRatio
- **Status**: PENDING, RUNNING, COMPLETED, FAILED
- **Relations**: User, BacktestTrades
- **Indexes**: userId + createdAt, status

#### BacktestTrade

Individual trades within a backtest.

- **Fields**: symbol, direction, entry/exit prices, PnL
- **Metrics**: holdingPeriod, exitReason
- **Relations**: Backtest
- **Indexes**: backtestId, symbol

---

### 7. PORTFOLIO & POSITIONS (4 models)

#### Portfolio

User's portfolio summary.

- **Fields**: totalValue, cashBalance, investedValue, PnL
- **Relations**: One-to-one with User, has many Positions
- **Indexes**: userId

#### Position

Individual positions in portfolio.

- **Fields**: symbol, quantity, averagePrice, currentPrice, PnL
- **Links**: paperTradeId OR liveTradeId
- **Status**: OPEN, CLOSED, PARTIALLY_CLOSED
- **Relations**: Portfolio, Orders
- **Indexes**: portfolioId + status, symbol

#### Order

Orders placed (market, limit, stop loss, etc.).

- **Types**: MARKET, LIMIT, STOP_LOSS, STOP_LOSS_LIMIT, TRAILING_STOP
- **Status**: PENDING, PLACED, PARTIALLY_FILLED, FILLED, CANCELLED, REJECTED, EXPIRED
- **Fields**: symbol, orderType, direction, quantity, price, triggerPrice
- **Relations**: Position
- **Indexes**: positionId, status, brokerOrderId

---

### 8. TRADE JOURNAL (1 model)

#### TradeJournal

Reflective journaling for trades.

- **Types**: PRE_TRADE, DURING_TRADE, POST_TRADE, WEEKLY_REVIEW, MONTHLY_REVIEW
- **Fields**: notes, lessons, emotions, tags
- **Pre-Trade**: preTradeSetup
- **Post-Trade**: postTradeReview, mistakesMade, rating (1-5)
- **Relations**: User, PaperTrade OR LiveTrade
- **Indexes**: userId + createdAt, entryType

---

### 9. AUDIT LOG (1 model)

#### AuditLog

Complete audit trail for compliance and debugging.

- **Fields**: userId, service, action, entityType, entityId
- **Details**: payload (JSON), result (JSON), success, error
- **Traceability**: ipAddress, userAgent
- **Indexes**: userId + timestamp, service + action, timestamp

---

## Key Traceability Flows

### Flow 1: User Prompt → AI Recommendation → Trade

```
User types prompt
    ↓
Prompt (rawPrompt, intent)
    ↓
PromptVersion (processed prompt)
    ↓
AIConversation → AIMessage (AI response with contextSnapshot)
    ↓
Signal (recommendation with all market context)
    ↓
PaperTrade or LiveTrade (execution with signalId)
    ↓
TradeExecution (actual fills)
    ↓
TradeJournal (reflection)
```

### Flow 2: Agent Decision → Trade

```
AgentObservation (market event detected)
    ↓
AgentDecision (agent makes decision with reasoning)
    ↓
Signal (trading signal with agentDecisionId)
    ↓
Trade (execution)
```

### Flow 3: Market Data → Indicators → Signal

```
MarketData (raw prices)
    ↓
Candle (aggregated by timeframe)
    ↓
IndicatorSnapshot (calculated indicators)
    ↓
Trendline / SupportResistance / MarketRegime (analysis)
    ↓
Signal (with all FK links to market context)
```

---

## Indexes Strategy

### High-Priority Indexes (Frequently Queried)

- User: email
- Instrument: symbol, assetType, (exchange + assetType)
- MarketData: (instrumentId + timestamp), timestamp
- Candle: (instrumentId + timeframe + timestamp)
- IndicatorSnapshot: (instrumentId + timeframe + timestamp)
- Signal: (instrumentId + timestamp), (signalType + status), confidence
- PaperTrade/LiveTrade: (userId + status), symbol, signalId
- AIMessage: (conversationId + createdAt), aiModel
- Agent: (userId + agentType), isActive
- AuditLog: (userId + timestamp), (service + action), timestamp

### Composite Indexes

Used for range queries and filtering combinations.

---

## Enums

### 12 Enums Defined

1. **AIProvider**: OPENAI, OLLAMA, ANTHROPIC, CUSTOM
2. **AssetType**: STOCK, OPTION_CALL, OPTION_PUT, INDEX, FUTURES
3. **OptionType**: CALL, PUT
4. **Timeframe**: TICK, ONE_MIN, FIVE_MIN, ..., ONE_DAY, ONE_WEEK, ONE_MONTH
5. **TrendlineType**: SUPPORT, RESISTANCE, UPTREND, DOWNTREND, CHANNEL_UPPER, CHANNEL_LOWER
6. **LevelType**: SUPPORT, RESISTANCE, PIVOT
7. **RegimeType**: TRENDING_UP, TRENDING_DOWN, RANGING, VOLATILE, BREAKOUT, BREAKDOWN, CONSOLIDATION
8. **PromptIntent**: FIND_TRADE, ANALYZE_MARKET, GENERATE_STRATEGY, etc.
9. **TradeType**: SWING, INTRADAY, SCALPING, POSITIONAL
10. **ConversationType**: TRADE_ANALYSIS, STRATEGY_DEVELOPMENT, PORTFOLIO_REVIEW, etc.
11. **ConversationStatus**: ACTIVE, COMPLETED, ABANDONED, ERROR
12. **MessageRole**: USER, ASSISTANT, SYSTEM, FUNCTION
13. **AgentType**: MARKET_ANALYST, RISK_MANAGER, STRATEGY_DEVELOPER, etc.
14. **ObservationType**: PRICE_MOVEMENT, VOLUME_SPIKE, INDICATOR_SIGNAL, etc.
15. **DecisionType**: ENTER_TRADE, EXIT_TRADE, ADJUST_POSITION, HOLD, SKIP, etc.
16. **DecisionOutcome**: SUCCESS, FAILURE, PARTIAL, CANCELLED, PENDING
17. **MemoryType**: EPISODIC, SEMANTIC, PROCEDURAL, WORKING
18. **SignalType**: ENTRY, EXIT, STOP_LOSS_ADJUST, TARGET_ADJUST, ALERT
19. **SignalDirection**: LONG, SHORT, FLAT
20. **SignalStatus**: ACTIVE, EXECUTED, EXPIRED, CANCELLED, INVALIDATED
21. **TradeExecutionStatus**: PENDING, OPEN, CLOSED, STOPPED, CANCELLED, FAILED
22. **ExecutionType**: ENTRY, PARTIAL_EXIT, FULL_EXIT, STOP_LOSS, TARGET, MANUAL
23. **BacktestStatus**: PENDING, RUNNING, COMPLETED, FAILED
24. **PositionStatus**: OPEN, CLOSED, PARTIALLY_CLOSED
25. **OrderType**: MARKET, LIMIT, STOP_LOSS, STOP_LOSS_LIMIT, TRAILING_STOP
26. **OrderStatus**: PENDING, PLACED, PARTIALLY_FILLED, FILLED, CANCELLED, REJECTED, EXPIRED
27. **JournalEntryType**: PRE_TRADE, DURING_TRADE, POST_TRADE, WEEKLY_REVIEW, MONTHLY_REVIEW

---

## Data Integrity Rules

### Cascading Deletes

- User deleted → Cascade to RiskProfile, Portfolio, Trades, etc.
- Instrument deleted → Cascade to MarketData, Candles, Indicators
- Agent deleted → Cascade to Observations, Decisions, Memories

### Set Null on Delete

- Signal deleted → Set null in Trade (preserve trade, lose signal reference)
- Recommendation deleted → Set null in Trade (Phase 1 compatibility)

### Foreign Key Constraints

All foreign keys are enforced at database level.

---

## Performance Considerations

### High-Write Tables

- **MarketData**: Real-time data, consider partitioning by date
- **Candle**: Time-series data, partition by timeframe and date
- **AuditLog**: High volume, consider archiving old logs

### Large Tables

- **AIMessage**: Can grow large, consider retention policy
- **TradeExecution**: One-to-many with trades, index well
- **AgentMemory**: Can grow indefinitely, implement cleanup strategy

### Caching Strategy

- **Instrument**: Cache in application (rarely changes)
- **RiskProfile**: Cache per user session
- **IndicatorSnapshot**: Cache latest snapshot per instrument

---

## Migration Notes

### From Phase 1 Schema

The Phase 2 schema is a complete rewrite. Key differences:

- Added 30+ new models for AI traceability
- Separated User → User + RiskProfile
- Added Instrument master table
- Renamed Recommendation → kept for backward compatibility
- Added Signal as new core model
- Split Trade → PaperTrade + LiveTrade

### Migration Path

1. Export existing data (if any)
2. Drop old schema
3. Apply new schema
4. Import data with mapping

---

## Future Enhancements

### Vector Embeddings

- Add pgvector extension for semantic search
- Store embeddings in AgentMemory
- Enable similarity search for past decisions

### Partitioning

- Partition MarketData by date
- Partition AuditLog by month
- Archive old data to cold storage

### Materialized Views

- Portfolio summary view
- Agent performance metrics
- Trading statistics by user

---

## Compliance & Privacy

### Data Encryption

- API credentials in RiskProfile **must** be encrypted at application level
- Consider field-level encryption for sensitive data

### Data Retention

- Define retention policies for:
  - Market data (keep X days of tick data)
  - Audit logs (keep X months)
  - AI conversations (keep X months)

### GDPR Considerations

- User deletion cascades properly
- Audit log preserves userId for accountability
- Consider anonymization for long-term analytics

---

## Summary

This schema provides:
✅ Complete AI traceability (prompt → AI response → signal → trade)
✅ Comprehensive market data tracking
✅ Agent system with observations, decisions, and memory
✅ Paper and live trading with full execution history
✅ Backtesting infrastructure
✅ Trade journaling for reflection
✅ Complete audit trail

**Total Models**: 40  
**Total Enums**: 27  
**Total Foreign Keys**: 60+  
**Total Indexes**: 50+

This is a production-ready schema for a sophisticated AI trading platform.
