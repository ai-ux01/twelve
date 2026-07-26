# Design Document: Options Scalping Agent

## Overview

The Options Scalping Agent is an AI-powered, auto-refreshing module that analyzes NIFTY50 and BANKNIFTY options contracts every 60 seconds and generates actionable BUY/SELL/HOLD signals for intraday scalping. This is the only module in the system with automatic refresh capability, designed for high-frequency options trading with strict probability (≥70%) and risk/reward (≥1:2) thresholds.

### Design Goals

1. **Auto-Refresh Architecture**: Implement a 60-second refresh cycle that fetches market data, calculates technical indicators, analyzes options chain, and generates AI-powered signals automatically
2. **High-Quality Signal Generation**: Enforce strict thresholds (70% probability, 1:2 R:R) to ensure only high-quality scalping opportunities are recommended
3. **Integration with Existing Modules**: Reuse Phase 7 (Intraday Analysis) and Phase 8 (Options Chain) functionality to maintain consistency
4. **Real-Time User Experience**: Provide live status indicators, countdown timers, and WebSocket-based push updates for instant signal delivery
5. **Graceful Degradation**: Handle API failures, stale data, and network issues without disrupting the user experience

### Technology Stack

- **Backend**: Python with FastAPI for REST endpoints and WebSocket support
- **AI Analysis**: OpenAI GPT-4 or similar LLM for market analysis and signal generation
- **Frontend**: React with TypeScript for the UI dashboard
- **Real-Time Communication**: WebSocket for pushing analysis updates
- **Data Storage**: PostgreSQL for analysis history and configuration persistence
- **Integration**: Phase 7 IntradayAnalysisService and Phase 8 OptionsChainService

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        UI Dashboard (React)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Live Status  │  │ Signal Card  │  │ Trade Details│          │
│  │ & Controls   │  │              │  │ Card         │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Probability  │  │ Market       │  │ Rationale    │          │
│  │ Gauge        │  │ Analysis     │  │ Panel        │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                    HTTP/WebSocket
                            │
┌─────────────────────────────────────────────────────────────────┐
│                   FastAPI Backend (Python)                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Auto Refresh Orchestrator                    │   │
│  │  • 60-second refresh timer                                │   │
│  │  • Client WebSocket management                            │   │
│  │  • Error handling & retry logic                           │   │
│  └──────────────┬───────────────────────────────┬────────────┘   │
│                 │                               │                │
│  ┌──────────────▼──────────────┐  ┌─────────────▼────────────┐  │
│  │   Market Data Fetcher       │  │  Signal Generator        │  │
│  │  • Spot price               │  │  • Probability calc      │  │
│  │  • OHLCV data               │  │  • R:R calculation       │  │
│  │  • Options chain            │  │  • Contract selection    │  │
│  │  • Data validation          │  │  • Safety controls       │  │
│  └──────────────┬──────────────┘  └─────────────▲────────────┘  │
│                 │                               │                │
│  ┌──────────────▼──────────────┐  ┌─────────────┴────────────┐  │
│  │   Technical Analyzer        │  │  AI Analysis Engine      │  │
│  │  • Phase 7 Integration      │  │  • LLM-powered analysis  │  │
│  │  • VWAP, EMA, RSI, MACD     │  │  • Pattern recognition   │  │
│  │  • Support/Resistance       │  │  • Signal reasoning      │  │
│  │  • Trendlines               │  │  • Probability scoring   │  │
│  └──────────────┬──────────────┘  └──────────────────────────┘  │
│                 │                                                │
│  ┌──────────────▼──────────────┐                                │
│  │   Options Analyzer          │                                │
│  │  • Phase 8 Integration      │                                │
│  │  • OI, PCR, IV analysis     │                                │
│  │  • Liquidity validation     │                                │
│  │  • Contract filtering       │                                │
│  └─────────────────────────────┘                                │
└─────────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
     ┌──────────▼──────────┐ ┌─────────▼─────────┐
     │ Market Data APIs    │ │  PostgreSQL DB    │
     │ • Spot prices       │ │ • Analysis history│
     │ • OHLCV feed        │ │ • Config storage  │
     │ • Options chain     │ │                   │
     └─────────────────────┘ └───────────────────┘
```


### Component Interaction Flow

1. **Auto-Refresh Cycle Initiation**:
   - User navigates to Options Scalper page → Auto Refresh Orchestrator starts 60-second timer
   - Timer fires → Market Data Fetcher retrieves spot prices, OHLCV, and options chain
   - Data validation checks timestamps (must be <2 min old)

2. **Technical Analysis**:
   - Market Data Fetcher passes OHLCV to Technical Analyzer
   - Technical Analyzer invokes Phase 7 IntradayAnalysisService
   - Calculates VWAP, EMA (5, 15), RSI (14), MACD (12, 26, 9), ATR (14), Volume ratio
   - Identifies support/resistance levels and trendlines

3. **Options Chain Analysis**:
   - Market Data Fetcher passes options chain to Options Analyzer
   - Options Analyzer invokes Phase 8 OptionsChainService
   - Calculates Call OI, Put OI, OI changes, PCR, ATM IV
   - Validates liquidity (spread ≤5%, OI >1000, volume >500)

4. **AI-Powered Analysis**:
   - AI Analysis Engine receives complete data package
   - Evaluates price action, trend, technical indicators, OI metrics
   - Generates structured recommendation with probability and R:R

5. **Signal Generation**:
   - Signal Generator applies thresholds (probability ≥70%, R:R ≥1:2)
   - Selects best contract (ATM or ±2 strikes with highest liquidity)
   - Applies safety controls (market hours, stale data, extreme IV)
   - Generates BUY CE / BUY PE / HOLD signal

6. **UI Update & Storage**:
   - WebSocket broadcasts signal to all connected clients
   - UI Dashboard renders signal, trade details, market analysis
   - Analysis history stored in PostgreSQL

## Components and Interfaces


### 1. Auto Refresh Orchestrator

**Responsibility**: Manages the 60-second refresh cycle, client WebSocket connections, and error recovery

**Key Methods**:
- `start_refresh_cycle(underlying: str)`: Initiates the auto-refresh timer
- `pause_refresh_cycle()`: Pauses automatic refresh
- `resume_refresh_cycle()`: Resumes automatic refresh
- `handle_page_visibility_change(visible: bool)`: Pauses/resumes based on page visibility
- `broadcast_analysis_result(result: AnalysisResult)`: Sends analysis to all WebSocket clients
- `handle_refresh_failure()`: Implements retry logic with exponential backoff

**Configuration**:
- Default refresh interval: 60 seconds (configurable 30-300s)
- Max concurrent WebSocket connections: 100 per server
- Heartbeat interval: 30 seconds
- Failed fetch retry: 30 seconds, max 3 consecutive failures

### 2. Market Data Fetcher

**Responsibility**: Retrieves and validates spot prices, OHLCV data, and options chain

**Key Methods**:
- `fetch_spot_prices() -> Dict[str, float]`: Fetches NIFTY50 and BANKNIFTY spot prices
- `fetch_ohlcv_data(symbol: str, interval: str, count: int) -> List[OHLCVData]`: Fetches 1-minute candles
- `fetch_options_chain(symbol: str, spot_price: float) -> OptionsChainData`: Fetches all contracts
- `validate_data_freshness(data: Any) -> bool`: Checks if data timestamp <2 minutes old

**Integration Points**:
- Phase 8 `OptionsChainService.process_options_chain()` for options data
- Market data APIs for spot prices and OHLCV

**Data Validation Rules**:
- Reject spot prices ≤0 or null
- Reject OHLCV candles with null OHLC values
- Reject options contracts with null bid/ask/volume/OI
- Reject data with timestamps >2 minutes old
- Apply timeout: 5 seconds for API calls, 10 seconds for complete fetch


### 3. Technical Analyzer

**Responsibility**: Calculates technical indicators and identifies support/resistance levels

**Key Methods**:
- `analyze_technical_indicators(ohlcv_data: List[OHLCVData]) -> TechnicalIndicators`: Calculates all indicators
- `identify_support_resistance(ohlcv_data: List[OHLCVData]) -> SupportResistance`: Finds S/R levels
- `detect_trendlines(ohlcv_data: List[OHLCVData]) -> TrendlineStatus`: Identifies trendlines
- `classify_trend(indicators: TechnicalIndicators) -> str`: Returns "Bullish", "Bearish", or "Neutral"

**Integration Points**:
- Phase 7 `IntradayAnalysisService.analyze()` for indicator calculation
- Phase 7 `TrendlineService` for trendline detection

**Indicator Calculations** (via Phase 7):
- VWAP: Session-based from 9:15 AM to 3:30 PM IST
- EMA 5 and EMA 15: Using 1-minute candle closes
- RSI 14: Using 1-minute candle closes
- MACD (12, 26, 9): Returns MACD line, signal line, histogram
- ATR 14: Using 1-minute candle high, low, close
- Volume Ratio: Current volume / 20-period average

**Support/Resistance Logic**:
- Look back 50 bars for swing highs/lows
- Swing high: High > 2 bars before and 2 bars after
- Swing low: Low < 2 bars before and 2 bars after
- Support: Most recent swing low with ≥2 bounces within 0.5% tolerance
- Resistance: Most recent swing high with ≥2 reversals within 0.5% tolerance

**Trendline Classification**:
- Bullish: Positive slope, price above trendline
- Bearish: Negative slope, price below trendline
- Neutral: No active trendline or price between support/resistance


### 4. Options Analyzer

**Responsibility**: Analyzes options chain metrics and validates contract liquidity

**Key Methods**:
- `analyze_options_chain(chain_data: OptionsChainData) -> OptionsAnalysis`: Calculates OI, PCR, IV
- `calculate_oi_metrics(chain_data: OptionsChainData, previous_data: OptionsChainData) -> OIMetrics`: Calculates OI changes
- `validate_contract_liquidity(contract: OptionsContract) -> bool`: Checks liquidity criteria
- `identify_oi_buildup(oi_changes: List[OIChange]) -> List[OIBuildup]`: Finds top 5 OI increases

**Integration Points**:
- Phase 8 `OptionsChainService.process_options_chain()` for contract data

**Options Metrics**:
- Total Call OI: Sum of OI across all Call strikes for nearest weekly expiry
- Total Put OI: Sum of OI across all Put strikes for nearest weekly expiry
- OI Change: Current OI - Previous refresh OI (absolute and percentage)
- PCR: Total Put OI / Total Call OI
- ATM IV: Implied volatility for ATM Call and Put (nearest weekly expiry)

**Liquidity Validation Criteria**:
- Bid-ask spread percentage: (ask - bid) / mid-price × 100 ≤ 5%
- Trading volume: >0
- Open Interest: >100 contracts (for initial validation), >1000 for signal generation
- Bid and ask: Both > 0 and bid < ask (no crossed markets)
- All required fields (bid, ask, volume, OI) must be non-null

**OI Buildup Detection**:
- Identify top 5 contracts with highest absolute OI increase
- Minimum threshold: ≥100 contracts increase
- Tracked separately for Calls and Puts


### 5. AI Analysis Engine

**Responsibility**: Performs comprehensive market analysis using LLM and generates trading recommendations

**Key Methods**:
- `analyze_market_data(data_package: MarketDataPackage) -> AIAnalysisResult`: Main analysis method
- `classify_price_action(ohlcv_data: List[OHLCVData]) -> str`: Identifies patterns
- `interpret_technical_indicators(indicators: TechnicalIndicators) -> Dict[str, str]`: Bullish/Bearish/Neutral
- `interpret_options_metrics(options_analysis: OptionsAnalysis) -> str`: Market sentiment
- `generate_rationale(analysis: Dict) -> str`: Creates 100-300 word explanation

**LLM Integration**:
- Model: GPT-4 or equivalent
- Timeout: 2 seconds for analysis completion
- Persona: Elite intraday options scalper with aggressive risk/reward preferences
- Context: Complete data package with all indicators and metrics

**Analysis Components**:
1. **Price Action Analysis**: Identify candlestick patterns, momentum, volatility
2. **Trend Analysis**: Classify as Bullish, Bearish, or Neutral based on EMA, MACD, trendlines
3. **Technical Indicator Interpretation**:
   - VWAP: Price above = bullish, below = bearish
   - RSI: >70 overbought, <30 oversold
   - MACD: Line > Signal = bullish, Line < Signal = bearish
   - Volume: Above average = confirmation
4. **Options Chain Interpretation**:
   - PCR >1.5 = bearish, <0.7 = bullish
   - Call OI increase = bullish, Put OI increase = bearish
   - High IV = uncertainty/caution
5. **Support/Resistance Context**: Price near support = potential bounce, near resistance = potential reversal

**Output Structure**:
- Signal recommendation: BUY CE, BUY PE, or HOLD
- Probability percentage: 0-100% (AI confidence score)
- Entry, target, stop loss prices
- Strike price and expiry selection
- Trend classification
- OI interpretation
- Detailed rationale (100-300 words)


### 6. Signal Generator

**Responsibility**: Applies probability and R:R thresholds, selects contracts, enforces safety controls

**Key Methods**:
- `generate_signal(ai_result: AIAnalysisResult, contracts: List[OptionsContract]) -> Signal`: Main signal generation
- `calculate_risk_reward_ratio(entry: float, target: float, stop_loss: float) -> float`: Calculates R:R
- `select_best_contract(contracts: List[OptionsContract], option_type: str) -> OptionsContract`: ATM selection
- `apply_safety_controls(signal: Signal, market_data: MarketDataPackage) -> Signal`: Validates safety conditions

**Signal Generation Logic**:
1. **Probability Check**: AI probability ≥ 70%
2. **R:R Check**: (Target - Entry) / (Entry - Stop Loss) ≥ 2.0
3. **Contract Selection**:
   - Identify ATM strike (nearest to spot price)
   - Filter: ATM ± 2 strikes only
   - Apply liquidity filters: Spread ≤5%, OI >1000, Volume >500, IV <100%
   - Rank by strike proximity, then by lowest spread
4. **Result**: BUY signal if all checks pass, HOLD otherwise

**Price Calculation** (from AI recommendations):
- Entry Price: Mid-price = (Bid + Ask) / 2
- Target Price: Entry + (2 × ATR) for CE, Entry + (2 × ATR) for PE
- Stop Loss: Entry - (1 × ATR) for CE, Entry - (1 × ATR) for PE

**Expiry Selection**:
- Prefer nearest weekly expiry with ≥2 days remaining
- Fallback to next weekly if <2 days

**Safety Controls** (generate HOLD if violated):
- Market data timestamp >2 minutes old → "Stale Data"
- Current time outside 9:15 AM - 3:30 PM IST → "Market Closed"
- Date is Saturday/Sunday/holiday → "Market Closed"
- No contract selected → "No Contract Selected"
- Selected contract IV >100% → "Extreme IV"
- Selected contract spread >5% → "Poor Liquidity"
- Any required data field missing → "Incomplete Data"
- Probability <70% → "Low Probability"
- R:R <1:2 → "Insufficient R:R"


### 7. UI Dashboard

**Responsibility**: Displays signals, controls, and market analysis in a responsive interface

**Key Components**:

**Live Status Panel**:
- Pulsing green dot (1.5s interval) when active
- "Last Updated" timestamp (HH:MM:SS AM/PM)
- Countdown timer to next refresh (updates every second)
- "REFRESH NOW" button
- "PAUSE AUTO REFRESH" toggle
- "PAUSED" indicator when refresh is paused

**Signal Card**:
- Large display (≥32px font): "BUY CE", "BUY PE", or "HOLD"
- Strike price, expiry date (DD-MMM-YYYY)
- Entry, target, stop loss prices (₹ format, 2 decimals)
- Probability percentage (1 decimal)
- Risk/reward ratio (1:X.X format)

**Probability Gauge**:
- Visual gauge 0-100%
- Color coding: Red (<50%), Yellow (50-70%), Green (≥70%)
- Updates within 500ms of new analysis

**Trade Details Card** (BUY signals only):
- Underlying: NIFTY or BANKNIFTY
- Option type: CE or PE
- Strike: Integer with comma separator (e.g., 19,500)
- Expiry: DD-MMM-YYYY
- Entry price: ₹X.XX
- Target: ₹X.XX (expected profit ₹X,XXX.XX)
- Stop loss: ₹X.XX (max loss ₹X,XXX.XX)
- R:R ratio: 1:X.X
- Lot size: Integer

**Market Analysis Panel**:
- Spot price, trend classification
- RSI (with overbought/oversold indication)
- MACD (with bullish/bearish indication)
- Price vs VWAP (percentage difference)
- EMA 5, EMA 15
- Support and resistance levels
- Trendline status
- Call OI, Put OI, OI changes
- PCR value with interpretation
- ATR value

**Rationale Panel**:
- 100-300 word AI-generated explanation
- Covers: price action, trend, indicators, OI analysis, S/R, probability/R:R reasoning

**Action Buttons**:
- "BUY ON PAPER": Enabled for BUY signals, disabled for HOLD
- Creates paper trade and navigates to portfolio


## Data Models

### AnalysisResult

```python
@dataclass
class AnalysisResult:
    timestamp: datetime
    underlying: str  # "NIFTY" or "BANKNIFTY"
    signal_type: str  # "BUY CE", "BUY PE", "HOLD"
    probability: float  # 0-100
    risk_reward_ratio: float  # e.g., 2.5 for 1:2.5
    
    # Trade details (None for HOLD)
    strike_price: Optional[float]
    expiry_date: Optional[date]
    entry_price: Optional[float]
    target_price: Optional[float]
    stop_loss: Optional[float]
    lot_size: Optional[int]
    
    # Market metrics
    spot_price: float
    trend: str  # "Bullish", "Bearish", "Neutral"
    oi_interpretation: str  # "Bullish", "Bearish", "Neutral"
    pcr: float
    trendline_status: str  # "Bullish", "Bearish", "Neutral"
    support_level: Optional[float]
    resistance_level: Optional[float]
    
    # Technical indicators
    rsi: float
    macd: float
    macd_signal: float
    vwap: float
    ema_5: float
    ema_15: float
    atr: float
    volume_ratio: float
    
    # Options metrics
    call_oi: int
    put_oi: int
    call_oi_change: int
    put_oi_change: int
    atm_iv: Optional[float]
    
    # AI rationale
    rationale: str  # 100-300 words
    
    # Metadata
    hold_reason: Optional[str]  # e.g., "Low Probability", "Stale Data"
```


### MarketDataPackage

```python
@dataclass
class MarketDataPackage:
    timestamp: datetime
    underlying: str
    spot_price: float
    ohlcv_data: List[OHLCVData]  # 1-minute candles
    options_chain: List[OptionsContract]
    previous_analysis: Optional[AnalysisResult]  # For OI change calculation
```

### TechnicalIndicators

```python
@dataclass
class TechnicalIndicators:
    vwap: float
    ema_5: float
    ema_15: float
    rsi: float
    macd: float
    macd_signal: float
    macd_histogram: float
    atr: float
    current_volume: int
    avg_volume: float
    volume_ratio: float
```

### OptionsAnalysis

```python
@dataclass
class OptionsAnalysis:
    call_oi: int
    put_oi: int
    call_oi_change: int
    put_oi_change: int
    call_oi_change_pct: float
    put_oi_change_pct: float
    pcr: float
    atm_call_iv: Optional[float]
    atm_put_iv: Optional[float]
    top_call_oi_buildup: List[OIBuildup]
    top_put_oi_buildup: List[OIBuildup]
```

### OptionsContract

```python
@dataclass
class OptionsContract:
    strike_price: float
    option_type: str  # "CE" or "PE"
    expiry_date: date
    bid: float
    ask: float
    ltp: float
    volume: int
    open_interest: int
    implied_volatility: Optional[float]
    
    # Liquidity metrics
    mid_price: float
    spread: float
    spread_percentage: float
    is_liquid: bool
    
    # Greeks (from Phase 8)
    delta: Optional[float]
    gamma: Optional[float]
    theta: Optional[float]
    vega: Optional[float]
```


### SupportResistance

```python
@dataclass
class SupportResistance:
    support_level: Optional[float]
    resistance_level: Optional[float]
    distance_to_support_pct: Optional[float]
    distance_to_resistance_pct: Optional[float]
```

### Signal

```python
@dataclass
class Signal:
    signal_type: str  # "BUY CE", "BUY PE", "HOLD"
    probability: float
    risk_reward_ratio: float
    selected_contract: Optional[OptionsContract]
    entry_price: Optional[float]
    target_price: Optional[float]
    stop_loss: Optional[float]
    hold_reason: Optional[str]
```

### Configuration

```python
@dataclass
class ScalperConfiguration:
    user_id: int
    refresh_interval: int = 60  # seconds, min=30, max=300
    probability_threshold: float = 70.0  # percent, min=50, max=90
    risk_reward_threshold: float = 2.0  # ratio, min=1.0, max=5.0
    max_spread_percentage: float = 5.0  # percent, min=1, max=10
    min_open_interest: int = 1000  # contracts, min=100, max=10000
```

### WebSocketMessage

```python
@dataclass
class WebSocketMessage:
    message_type: str  # "analysis_update", "heartbeat", "error"
    timestamp: datetime
    underlying: Optional[str]
    signal_data: Optional[AnalysisResult]
    market_data: Optional[Dict]
    error: Optional[str]
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: OHLCV Validation Rejects Invalid Data

*For any* OHLCV candle with null values, zero or negative prices, or non-numeric values in any of its OHLC fields, the Technical_Analyzer SHALL reject that candle and return a validation error.

**Validates: Requirements 5.10**

### Property 2: Support Distance Calculation Accuracy

*For any* valid current price and support level where current price > support level, the calculated distance percentage SHALL equal ((current_price - support_level) / current_price) × 100 with precision to 2 decimal places.

**Validates: Requirements 6.10**

### Property 3: Resistance Distance Calculation Accuracy

*For any* valid current price and resistance level where resistance level > current price, the calculated distance percentage SHALL equal ((resistance_level - current_price) / current_price) × 100 with precision to 2 decimal places.

**Validates: Requirements 6.11**

### Property 4: Liquidity Metrics Calculation Chain

*For any* options contract with valid bid price and ask price where 0 < bid < ask, the following calculations SHALL hold:
- Spread = ask - bid
- Mid-price = (bid + ask) / 2
- Spread percentage = (spread / mid-price) × 100

All intermediate and final values SHALL be mathematically consistent.

**Validates: Requirements 8.1, 8.2, 8.3**


### Property 5: Liquidity Validation Rules

*For any* options contract, the liquidity_valid field SHALL be false if ANY of the following conditions hold:
- Spread percentage > 5%
- Trading volume = 0
- Open interest ≤ 100
- Bid price ≤ 0
- Ask price ≤ 0
- Bid price > ask price (crossed market)
- Bid price is null
- Ask price is null

Otherwise, liquidity_valid SHALL be true (assuming all required fields are present).

**Validates: Requirements 8.6, 8.7, 8.9, 8.11**

### Property 6: Risk/Reward Ratio Calculation

*For any* valid entry price, target price, and stop loss price where entry < target and stop loss < entry, the risk/reward ratio SHALL equal (target - entry) / (entry - stop_loss).

**Validates: Requirements 10.3**

### Property 7: Signal Generation Threshold Logic

*For any* AI analysis result with probability percentage and risk/reward ratio:
- IF probability ≥ 70% AND risk/reward ratio ≥ 2.0, THEN signal type SHALL be BUY (CE or PE based on trend)
- IF probability < 70% OR risk/reward ratio < 2.0, THEN signal type SHALL be HOLD

This decision logic SHALL be consistent for all probability/R:R combinations.

**Validates: Requirements 10.4, 10.5**

### Property 8: Contract Strike Proximity Filtering

*For any* options chain with identified ATM strike and a list of contracts, applying the strike proximity filter SHALL include only contracts where abs(strike_price - atm_strike) ≤ (2 × strike_interval), where strike_interval is the gap between consecutive strikes.

All other contracts SHALL be excluded from the filtered result.

**Validates: Requirements 11.2**


### Property 9: Contract Ranking by Strike Proximity

*For any* list of contracts that pass all filters, when ranked by strike proximity to ATM, contracts SHALL be ordered such that contracts closer to ATM (smaller abs(strike - atm)) appear before contracts farther from ATM. Contracts at equal distance SHALL be ranked by lowest spread percentage.

**Validates: Requirements 11.5**

### Property 10: Stale Data Detection

*For any* market data timestamp and current time in IST timezone, IF the difference between current time and data timestamp exceeds 2 minutes (120 seconds), THEN the Signal_Generator SHALL generate a HOLD signal with reason "Stale Data".

**Validates: Requirements 12.1**

### Property 11: Price to VWAP Percentage Calculation

*For any* valid current price and VWAP value where both are positive, the percentage difference SHALL equal ((current_price - VWAP) / VWAP) × 100, rounded to 2 decimal places.

**Validates: Requirements 16.12**

### Property 12: PCR Interpretation Classification

*For any* Put-Call Ratio (PCR) value:
- IF PCR > 1.5, THEN interpretation SHALL be "Bearish"
- IF PCR < 0.7, THEN interpretation SHALL be "Bullish"  
- IF 0.7 ≤ PCR ≤ 1.5, THEN interpretation SHALL be "Neutral"

This classification SHALL be consistent and complete, covering all possible PCR values.

**Validates: Requirements 16.23, 16.24, 16.25**

### Property 13: Analysis History Filtering

*For any* analysis history collection and filter criteria (underlying, signal type, date range), the filtered results SHALL include only records where:
- Record.underlying matches the underlying filter (if specified), AND
- Record.signal_type matches the signal type filter (if specified), AND
- Record.timestamp falls within the date range filter (if specified)

All records not matching the criteria SHALL be excluded.

**Validates: Requirements 20.6**


## Error Handling

### Market Data Fetch Failures

**Scenario**: External API calls to fetch spot prices, OHLCV data, or options chain fail

**Handling Strategy**:
1. **Immediate Retry**: Retry failed requests up to 2 times with 1-second delay between attempts
2. **Timeout**: Apply 5-second timeout per API call, 10-second timeout for complete fetch operation
3. **Graceful Degradation**: Display last successfully retrieved analysis with "Stale Data" warning
4. **Auto-Recovery**: Schedule next retry attempt after 30 seconds
5. **User Alert**: After 3 consecutive failures, pause auto-refresh and display alert with error details
6. **Resume Mechanism**: Allow user to manually trigger refresh or automatically resume when API recovers

**Implementation**:
```python
async def fetch_with_retry(api_call, max_retries=2):
    for attempt in range(max_retries + 1):
        try:
            result = await asyncio.wait_for(api_call(), timeout=5.0)
            return result
        except (TimeoutError, APIError) as e:
            if attempt < max_retries:
                await asyncio.sleep(1.0)
                continue
            raise FetchFailureError(f"Failed after {max_retries + 1} attempts: {e}")
```

### AI Analysis Failures

**Scenario**: LLM API fails, times out, or returns invalid response

**Handling Strategy**:
1. **Timeout**: Enforce 2-second timeout for AI analysis completion
2. **Fallback Signal**: Generate HOLD signal with reason "Analysis Error"
3. **Logging**: Log complete error details including prompt, response, and stack trace
4. **No Retry**: Do not retry AI analysis within the same refresh cycle (avoid cascading delays)
5. **Next Cycle**: Normal operation resumes in next refresh cycle


### Data Validation Failures

**Scenario**: Retrieved data contains null values, invalid timestamps, or malformed structures

**Handling Strategy**:
1. **Field-Level Validation**: Reject individual contracts or candles with invalid data
2. **Minimum Threshold**: Require minimum 10 liquid contracts; if not met, generate HOLD with "Insufficient Liquid Contracts"
3. **Timestamp Validation**: Reject entire dataset if timestamp >2 minutes old
4. **Partial Data**: Treat partial data retrieval as complete failure (e.g., if OHLCV fetch succeeds but options chain fails, reject entire cycle)

### WebSocket Connection Failures

**Scenario**: WebSocket connection drops, client fails to respond to heartbeat, or broadcast fails

**Handling Strategy**:
1. **Heartbeat Monitoring**: Send ping every 30 seconds, close connection after 3 missed pongs (90 seconds)
2. **Graceful Disconnect**: Clean up resources within 5 seconds of disconnect
3. **Broadcast Error Isolation**: If broadcast to specific client fails, remove only that client from broadcast list
4. **Connection Limit**: Reject new connections with WebSocket close code 1008 when limit (100) is reached
5. **UI Fallback**: UI automatically falls back to HTTP polling if WebSocket fails

### Database Storage Failures

**Scenario**: Failed to store analysis history or retrieve configuration

**Handling Strategy**:
1. **Non-Blocking**: Continue normal operation even if storage fails
2. **Logging**: Log error with details but don't interrupt refresh cycle
3. **Retry**: Attempt to store in next refresh cycle
4. **User Impact**: Analysis history may be incomplete but real-time signals unaffected

### Safety Control Violations

**Scenario**: Signal generation encounters safety violations (stale data, market closed, extreme IV, poor liquidity)

**Handling Strategy**:
1. **Immediate HOLD**: Generate HOLD signal with specific reason
2. **Priority Order**: Check violations in order: Stale Data → Market Closed → Incomplete Data → Extreme IV → Poor Liquidity → Low Probability → Insufficient R:R
3. **Rationale Inclusion**: Include safety violation reason in AI rationale for transparency
4. **No Override**: Safety controls cannot be overridden; user must resolve underlying issue


## Testing Strategy

### Dual Testing Approach

The Options Scalping Agent employs a comprehensive testing strategy combining property-based tests for pure calculation logic and integration tests for external service interactions.

**Property-Based Tests**: Validate universal properties across randomized inputs for pure functions
- Liquidity calculation and validation logic
- Distance and percentage calculations
- Signal generation threshold logic
- Contract filtering and ranking algorithms
- Data validation rules

**Integration Tests**: Validate external service interactions and timing-sensitive operations
- Market data API calls (mocked)
- Phase 7 IntradayAnalysisService integration
- Phase 8 OptionsChainService integration
- WebSocket communication
- Auto-refresh timing and orchestration
- UI rendering and user interactions

**Unit Tests**: Validate specific examples and edge cases
- Specific market scenarios (breakouts, reversals)
- Boundary conditions (exactly 70% probability, exactly 1:2 R:R)
- Error conditions (null data, API failures)
- Configuration edge cases (min/max values)

### Property-Based Testing Configuration

**Test Library**: Hypothesis (Python)

**Test Configuration**:
- Minimum 100 iterations per property test
- Deadline: 5 seconds per test case
- Database: Use Hypothesis database for failure reproduction

**Property Test Tag Format**:
```python
# Feature: options-scalping-agent, Property 1: OHLCV Validation Rejects Invalid Data
@given(ohlcv_candle=invalid_ohlcv_strategy())
def test_property_1_ohlcv_validation(ohlcv_candle):
    ...
```


### Property Test Implementations

**Property 1: OHLCV Validation**
- Generator: Random OHLCV candles with various invalid attributes (null, zero, negative, non-numeric)
- Assertion: All invalid candles are rejected with appropriate error message

**Property 2-3: Distance Calculations**
- Generator: Random price and support/resistance level pairs
- Assertion: Calculated percentages match formula exactly

**Property 4: Liquidity Metrics Chain**
- Generator: Random valid bid/ask pairs where 0 < bid < ask
- Assertion: Spread, mid-price, and spread percentage satisfy mathematical relationships

**Property 5: Liquidity Validation**
- Generator: Random contracts with varying liquidity attributes
- Assertion: liquidity_valid field correctly reflects violation of any validation rule

**Property 6: R:R Calculation**
- Generator: Random entry/target/stop loss triples where stop_loss < entry < target
- Assertion: R:R ratio matches formula (target - entry) / (entry - stop_loss)

**Property 7: Signal Threshold Logic**
- Generator: Random probability/R:R pairs across full range [0-100] and [0-10]
- Assertion: BUY signal IFF probability ≥70% AND R:R ≥2.0; otherwise HOLD

**Property 8-9: Contract Filtering and Ranking**
- Generator: Random options chains with varying strikes and liquidity metrics
- Assertion: Filtered contracts within ±2 strikes, ranked by proximity then spread

**Property 10: Stale Data Detection**
- Generator: Random timestamp pairs (data timestamp, current time)
- Assertion: HOLD signal with "Stale Data" reason when difference >120 seconds

**Property 11: Price/VWAP Calculation**
- Generator: Random positive price/VWAP pairs
- Assertion: Percentage difference matches formula with 2 decimal precision

**Property 12: PCR Interpretation**
- Generator: Random PCR values across full range [0-10]
- Assertion: Classification matches thresholds (>1.5 Bearish, <0.7 Bullish, else Neutral)

**Property 13: History Filtering**
- Generator: Random analysis history collections with diverse attributes
- Assertion: Filtered results contain only matching records, all non-matching excluded


### Integration Testing Strategy

**Market Data Integration Tests**:
- Mock external APIs for spot prices, OHLCV, options chain
- Test retry logic with simulated failures
- Test timeout handling (5s per call, 10s total)
- Test data validation with invalid responses
- Verify graceful degradation with cached data

**Phase 7 Integration Tests**:
- Use actual IntradayAnalysisService with test data
- Verify all indicators calculated correctly
- Test error handling when Phase 7 fails
- Verify data model compatibility

**Phase 8 Integration Tests**:
- Use actual OptionsChainService with test data
- Verify liquidity validation uses Phase 8 results
- Test error handling when Phase 8 fails
- Verify Greeks are properly extracted

**WebSocket Integration Tests**:
- Test client connection/disconnection
- Test broadcast to multiple clients
- Test heartbeat mechanism (30s intervals, 3 missed = disconnect)
- Test connection limit (max 100)
- Test graceful cleanup on disconnect

**Auto-Refresh Integration Tests**:
- Test 60-second cycle timing
- Test pause/resume functionality
- Test page visibility change detection
- Test manual refresh override
- Test cleanup on page unload

**Performance Tests**:
- Complete analysis workflow <3 seconds (95th percentile)
- UI rendering <500ms
- Countdown timer <50ms update latency
- Database queries <1 second for 1000 records
- Manual refresh response <200ms


### Unit Testing Strategy

**Example-Based Unit Tests**:

1. **Specific Market Scenarios**:
   - Strong bullish breakout above resistance → BUY CE signal
   - Strong bearish breakdown below support → BUY PE signal
   - Choppy range-bound market → HOLD signal
   - High IV spike (>100%) → HOLD with "Extreme IV"

2. **Boundary Conditions**:
   - Probability exactly 70% with R:R 2.0 → BUY signal
   - Probability 69.9% with R:R 2.0 → HOLD signal
   - Probability 70% with R:R 1.99 → HOLD signal
   - Spread exactly 5.0% → Liquid
   - Spread 5.01% → Illiquid

3. **Edge Cases**:
   - Empty options chain → HOLD "No Contracts Available"
   - All contracts illiquid → HOLD "No Liquid Contracts Available"
   - ATM strike not available → Select nearest available strike
   - Multiple contracts with same spread → Select by OI

4. **Safety Control Tests**:
   - Time 9:14:59 AM → HOLD "Market Closed"
   - Time 9:15:00 AM → Allow signal
   - Time 3:30:00 PM → Allow signal
   - Time 3:30:01 PM → HOLD "Market Closed"
   - Saturday/Sunday → HOLD "Market Closed"
   - Market holiday → HOLD "Market Closed"

5. **Configuration Tests**:
   - Refresh interval 30s (min) → Valid
   - Refresh interval 29s → Rejected
   - Refresh interval 300s (max) → Valid
   - Refresh interval 301s → Rejected
   - Probability threshold 50-90% → Valid range
   - R:R threshold 1:1 to 1:5 → Valid range

### Test Coverage Goals

- **Property Tests**: 100% coverage of pure calculation functions
- **Integration Tests**: 90% coverage of service interactions and orchestration
- **Unit Tests**: 95% coverage overall, with focus on edge cases and error paths
- **Performance Tests**: 95th percentile targets for all timing requirements

