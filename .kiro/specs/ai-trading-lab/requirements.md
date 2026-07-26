# Requirements Document

## Introduction

The AI Trading Lab is a conversational trading assistant accessible at `/ai-trading`. Users enter natural-language prompts to receive structured trading recommendations. The system detects user intent, selects the appropriate market and strategy, fetches fresh market data from the quant engine, performs quantitative and trendline analysis, applies risk management, and uses AI reasoning to produce actionable recommendations. All recommendations are derived from live application data, not from the AI model's training knowledge.

## Glossary

- **AI_Trading_Lab**: The full-stack feature comprising the chat interface, intent detection, orchestration pipeline, and recommendation engine at route `/ai-trading`
- **Intent_Detector**: The component that classifies a user prompt into one of the defined trading intents using GPT-4
- **Orchestration_Pipeline**: The backend pipeline that coordinates market selection, strategy selection, data fetching, analysis, and recommendation generation
- **Quant_Engine**: The existing Python/FastAPI service at `apps/quant` (port 8000) providing technical indicators, support/resistance, trendlines, and options analysis
- **Recommendation_Engine**: The component that combines quant analysis results with AI reasoning to produce a structured trading recommendation
- **Chat_Interface**: The frontend UI component providing a conversational experience with message history and action controls
- **Interaction_Store**: The persistence layer that records every prompt-response interaction with associated metadata
- **Response_Mode**: A user-selectable display mode that controls the verbosity and style of recommendations (QUICK, DETAILED, TRADER, QUANT, COACH)
- **Decision_Record**: A single stored interaction containing the prompt, response, market data timestamp, signal, probability, risk/reward, agent ID, and decision ID

## Requirements

### Requirement 1: Intent Detection

**User Story:** As a trader, I want the system to automatically understand what type of trading analysis I need from my natural-language prompt, so that I receive the correct type of recommendation without manual configuration.

#### Acceptance Criteria

1. WHEN a user submits a prompt, THE Intent_Detector SHALL classify the prompt into exactly one of the following intents: SWING_STOCK, INTRADAY_STOCK, OPTIONS_SCALPING, TRADE_ANALYSIS, PORTFOLIO_ANALYSIS, MARKET_ANALYSIS, STRATEGY_ANALYSIS, or PAPER_TRADE
2. WHEN the Intent_Detector cannot classify a prompt with sufficient confidence, THE Intent_Detector SHALL request clarification from the user
3. WHEN a prompt contains a specific stock symbol, THE Intent_Detector SHALL extract and include the symbol in the classification result
4. THE Intent_Detector SHALL use GPT-4 for classification and return a structured result containing the detected intent, extracted symbols, and confidence score

### Requirement 2: Orchestration Pipeline

**User Story:** As a trader, I want my prompt to trigger a complete analysis workflow, so that I receive a recommendation based on fresh market data and comprehensive quantitative analysis.

#### Acceptance Criteria

1. WHEN an intent is detected, THE Orchestration_Pipeline SHALL execute the following steps in order: market selection, strategy selection, fresh market data fetch, quant analysis, trendline analysis, risk engine evaluation, AI reasoning, and structured recommendation generation
2. THE Orchestration_Pipeline SHALL fetch all market data from the Quant_Engine and existing application services rather than relying on the AI model's training knowledge for current prices
3. WHEN the intent is SWING_STOCK, THE Orchestration_Pipeline SHALL invoke the existing swing scanner and scoring services from the Quant_Engine
4. WHEN the intent is INTRADAY_STOCK, THE Orchestration_Pipeline SHALL invoke the existing intraday analysis service from the Quant_Engine
5. WHEN the intent is OPTIONS_SCALPING, THE Orchestration_Pipeline SHALL invoke the existing options scalper analysis engine from the Quant_Engine
6. WHEN the intent is PAPER_TRADE, THE Orchestration_Pipeline SHALL invoke the existing paper trading service to execute the trade
7. WHEN the intent is PORTFOLIO_ANALYSIS, THE Orchestration_Pipeline SHALL retrieve active paper trades and positions from the existing portfolio service

### Requirement 3: Fresh Market Data Enforcement

**User Story:** As a trader, I want all recommendations to be based on current market data, so that I can trust the signals reflect real-time market conditions.

#### Acceptance Criteria

1. THE Orchestration_Pipeline SHALL include a market data timestamp in every recommendation response
2. WHEN market data is older than 5 minutes during market hours, THE Orchestration_Pipeline SHALL re-fetch data from the Quant_Engine before generating a recommendation
3. IF the Quant_Engine is unreachable or returns an error, THEN THE Orchestration_Pipeline SHALL inform the user that fresh data is unavailable and refuse to generate a recommendation based on stale data

### Requirement 4: Structured Recommendation Generation

**User Story:** As a trader, I want recommendations presented in a consistent structured format, so that I can quickly assess signal direction, probability, and risk/reward.

#### Acceptance Criteria

1. THE Recommendation_Engine SHALL produce a recommendation containing: signal direction (BUY, SELL, or HOLD), probability percentage, risk/reward ratio, entry price, stop loss, and target price
2. WHEN the calculated probability is below 60%, THE Recommendation_Engine SHALL label the recommendation as low-confidence and include a warning
3. THE Recommendation_Engine SHALL use GPT-4 to synthesize quant analysis results into a human-readable rationale that explains the reasoning behind the recommendation
4. WHEN the Response_Mode is QUICK, THE Recommendation_Engine SHALL return a concise summary limited to signal, probability, risk/reward, and key levels
5. WHEN the Response_Mode is DETAILED, THE Recommendation_Engine SHALL include full technical analysis breakdown, indicator values, and chart pattern descriptions
6. WHEN the Response_Mode is TRADER, THE Recommendation_Engine SHALL present the recommendation in actionable trade format with entry, stop loss, targets, and position sizing
7. WHEN the Response_Mode is QUANT, THE Recommendation_Engine SHALL emphasize numerical data, statistical metrics, and probability distributions
8. WHEN the Response_Mode is COACH, THE Recommendation_Engine SHALL include educational explanations of why indicators suggest the given direction

### Requirement 5: Interaction Storage

**User Story:** As a trader, I want every interaction stored with full context, so that I can review my trading history and analyze recommendation accuracy over time.

#### Acceptance Criteria

1. WHEN a recommendation is generated, THE Interaction_Store SHALL persist a Decision_Record containing: original prompt, AI response, prompt version, market data timestamp, signal direction, probability, risk/reward ratio, agent ID, and decision ID
2. THE Interaction_Store SHALL assign a unique decision ID (UUID) to each Decision_Record
3. THE Interaction_Store SHALL assign an agent ID identifying the AI Trading Lab instance that generated the recommendation
4. WHEN the user requests conversation history, THE Interaction_Store SHALL return Decision_Records ordered by creation timestamp in descending order

### Requirement 6: Chat Interface

**User Story:** As a trader, I want a chat-style interface with conversation history, so that I can interact naturally and reference previous recommendations.

#### Acceptance Criteria

1. THE Chat_Interface SHALL be accessible at the route `/ai-trading`
2. THE Chat_Interface SHALL display a text input for entering natural-language prompts
3. THE Chat_Interface SHALL display conversation history showing both user prompts and system recommendations in chronological order
4. THE Chat_Interface SHALL provide a mode selector allowing the user to switch between QUICK, DETAILED, TRADER, QUANT, and COACH response modes
5. WHEN a recommendation is displayed, THE Chat_Interface SHALL show action buttons: ANALYZE MARKET, BUY ON PAPER, IGNORE, and STOP
6. WHEN the user clicks BUY ON PAPER, THE Chat_Interface SHALL trigger a paper trade execution via the existing paper trading service
7. WHEN the user clicks ANALYZE MARKET, THE Chat_Interface SHALL submit a follow-up market analysis prompt for the same symbol
8. WHEN the user clicks STOP, THE Chat_Interface SHALL cancel any pending analysis request

### Requirement 7: Risk Engine Integration

**User Story:** As a trader, I want every recommendation validated through a risk engine, so that position sizing and stop-loss levels reflect my risk tolerance.

#### Acceptance Criteria

1. THE Orchestration_Pipeline SHALL apply risk evaluation to every recommendation before presenting it to the user
2. THE Recommendation_Engine SHALL calculate and include a risk/reward ratio for every trade recommendation
3. WHEN the risk/reward ratio is below 1:1.5, THE Recommendation_Engine SHALL flag the trade as high-risk in the recommendation output
4. THE Recommendation_Engine SHALL suggest position sizing based on a maximum risk of 2% of portfolio value per trade

### Requirement 8: Error Handling and Resilience

**User Story:** As a trader, I want clear feedback when something goes wrong, so that I understand why a recommendation could not be generated.

#### Acceptance Criteria

1. IF the Intent_Detector fails to process a prompt, THEN THE AI_Trading_Lab SHALL display an error message to the user and suggest rephrasing the prompt
2. IF the Quant_Engine returns incomplete data for any analysis step, THEN THE Orchestration_Pipeline SHALL indicate which data is missing and provide a partial analysis with a disclaimer
3. IF GPT-4 API calls fail or timeout, THEN THE AI_Trading_Lab SHALL retry up to 2 times with exponential backoff before returning an error to the user
4. IF a paper trade execution fails, THEN THE Chat_Interface SHALL display the failure reason and allow the user to retry

### Requirement 9: API Endpoint Design

**User Story:** As a frontend developer, I want well-defined API endpoints for the AI Trading Lab, so that the chat interface can communicate with the backend reliably.

#### Acceptance Criteria

1. THE AI_Trading_Lab SHALL expose a POST endpoint at `/api/ai-trading/prompt` that accepts a JSON body with the user prompt and selected response mode
2. THE AI_Trading_Lab SHALL expose a GET endpoint at `/api/ai-trading/history` that returns paginated conversation history for the current session
3. THE AI_Trading_Lab SHALL expose a POST endpoint at `/api/ai-trading/action` that accepts action button commands (ANALYZE_MARKET, BUY_ON_PAPER, IGNORE, STOP) with the associated decision ID
4. WHEN a prompt is submitted, THE API SHALL return a streaming response to allow the Chat_Interface to display incremental output as the recommendation is generated
