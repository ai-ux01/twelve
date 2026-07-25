# Intraday Trading Pydantic Models

This document describes the Pydantic models for intraday trading analysis in the ProfitTerminal Quant Engine.

## Overview

The intraday models define request/response structures for same-day trading analysis, including technical indicators, data freshness tracking, and trading recommendations.

## Requirements Coverage

- **Requirement 6.1**: Intraday Trading Analysis
- **Requirement 6.2**: Data Freshness and Timestamp Validation

## Models

### Enums

#### `IntradayInterval`

Supported intraday timeframe intervals:
- `ONE_MINUTE` = "1m"
- `FIVE_MINUTES` = "5m"
- `FIFTEEN_MINUTES` = "15m"
- `THIRTY_MINUTES` = "30m"
- `ONE_HOUR` = "1h"

#### `IntradaySignal`

Trading signal types:
- `BUY`: Long position recommended
- `SELL`: Short position recommended
- `HOLD`: Hold existing positions
- `NO_TRADE`: No trade recommended

### Request Models

#### `IntradayAnalysisRequest`

Request model for initiating intraday analysis.

**Fields:**
- `symbol` (str, required): Stock trading symbol (uppercase, alphanumeric only)
- `interval` (IntradayInterval, required): Timeframe interval
- `user_id` (str, optional): User ID for personalized analysis

**Validation:**
- Symbol pattern: `^[A-Z0-9]+$`
- Symbol automatically converted to uppercase
- Minimum symbol length: 1, maximum: 20

**Example:**
```python
{
    "symbol": "RELIANCE",
    "interval": "5m",
    "user_id": "user123"
}
```

### Data Models

#### `DataFreshness`

Tracks data freshness for intraday trading decisions.

**Fields:**
- `timestamp` (str, required): ISO 8601 timestamp
- `age_seconds` (float, required): Age of data in seconds (≥ 0)
- `is_stale` (bool, required): True if data exceeds freshness threshold

**Validation:**
- Timestamp must be valid ISO 8601 format
- Age must be non-negative

**Example:**
```python
{
    "timestamp": "2024-01-15T10:30:00Z",
    "age_seconds": 15.5,
    "is_stale": False
}
```

#### `MACDIndicator`

MACD indicator values.

**Fields:**
- `value` (float): MACD line value
- `signal` (float): Signal line value
- `histogram` (float): MACD histogram value

#### `BollingerBands`

Bollinger Bands indicator values.

**Fields:**
- `upper` (float, > 0): Upper band
- `middle` (float, > 0): Middle band (SMA)
- `lower` (float, > 0): Lower band

**Validation:**
- All values must be positive
- Upper band must be > middle band
- Lower band must be < middle band

### Technical Analysis Models

#### `IntradayTechnicalAnalysis`

Comprehensive technical indicators for intraday trading.

**Fields:**
- `rsi` (float, 0-100): Relative Strength Index
- `macd` (MACDIndicator): MACD indicator
- `ema_9` (float, > 0): 9-period EMA
- `ema_21` (float, > 0): 21-period EMA
- `ema_50` (float, > 0): 50-period EMA
- `vwap` (float, > 0): Volume Weighted Average Price
- `atr` (float, > 0): Average True Range
- `volume` (int, ≥ 0): Current volume
- `relative_volume` (float, ≥ 0): Volume relative to average
- `bollinger_bands` (BollingerBands): Bollinger Bands
- `support_levels` (List[float]): Support price levels (sorted)
- `resistance_levels` (List[float]): Resistance price levels (sorted)

**Validation:**
- RSI must be 0-100
- All prices must be positive
- Support/resistance levels automatically sorted ascending

**Example:**
```python
{
    "rsi": 58.5,
    "macd": {"value": 12.3, "signal": 10.1, "histogram": 2.2},
    "ema_9": 2465.0,
    "ema_21": 2460.0,
    "ema_50": 2455.0,
    "vwap": 2458.0,
    "atr": 15.5,
    "volume": 150000,
    "relative_volume": 1.35,
    "bollinger_bands": {
        "upper": 2480.0,
        "middle": 2460.0,
        "lower": 2440.0
    },
    "support_levels": [2430.0, 2445.0],
    "resistance_levels": [2475.0, 2490.0]
}
```

### Recommendation Models

#### `IntradayRecommendation`

Complete trading recommendation for intraday positions.

**Fields:**
- `signal` (IntradaySignal, required): Trading signal
- `confidence` (float, 0-1, required): Confidence level
- `entry` (float, > 0, required): Suggested entry price
- `stop_loss` (float, > 0, required): Suggested stop loss
- `target` (float, > 0, required): Suggested target
- `risk_reward` (float, > 0, required): Risk/reward ratio
- `rationale` (str, required): Human-readable explanation
- `is_stale` (bool, required): True if based on stale data
- `valid_until` (str, optional): Expiration timestamp (ISO 8601)
- `warnings` (List[str], optional): Data quality warnings

**Validation Rules:**

1. **BUY Signal:**
   - Stop loss must be < entry
   - Target must be > entry

2. **SELL Signal:**
   - Stop loss must be > entry
   - Target must be < entry

3. **Risk/Reward Calculation:**
   - Must match: `risk_reward = |target - entry| / |entry - stop_loss|`
   - Tolerance: ±0.1 for floating point differences

**Example:**
```python
{
    "signal": "BUY",
    "confidence": 0.75,
    "entry": 2460.0,
    "stop_loss": 2445.0,
    "target": 2490.0,
    "risk_reward": 2.0,
    "rationale": "Strong upward momentum with RSI in bullish zone",
    "is_stale": False,
    "valid_until": "2024-01-15T15:30:00Z",
    "warnings": []
}
```

### Result Models

#### `IntradayAnalysisResult`

Complete intraday analysis result combining all components.

**Fields:**
- `symbol` (str, required): Stock symbol
- `interval` (IntradayInterval, required): Timeframe used
- `timestamp` (str, required): Analysis timestamp (ISO 8601)
- `data_freshness` (DataFreshness, required): Freshness tracking
- `technical_analysis` (IntradayTechnicalAnalysis, required): Technical indicators
- `current_price` (float, > 0, required): Current market price
- `price_change` (float, required): Absolute price change
- `price_change_percent` (float, required): Percentage price change
- `recommendation` (IntradayRecommendation, required): Trading recommendation

**Validation:**
- Timestamp must be valid ISO 8601 format
- Symbol length: 1-20 characters

**Example:**
```python
{
    "symbol": "RELIANCE",
    "interval": "5m",
    "timestamp": "2024-01-15T10:30:00Z",
    "data_freshness": {
        "timestamp": "2024-01-15T10:30:00Z",
        "age_seconds": 15.5,
        "is_stale": False
    },
    "technical_analysis": { ... },
    "current_price": 2460.0,
    "price_change": 15.5,
    "price_change_percent": 0.63,
    "recommendation": { ... }
}
```

## Usage

### Import Models

```python
from models.intraday import (
    IntradayInterval,
    IntradaySignal,
    IntradayAnalysisRequest,
    DataFreshness,
    IntradayTechnicalAnalysis,
    IntradayRecommendation,
    IntradayAnalysisResult,
)
```

### Create Request

```python
request = IntradayAnalysisRequest(
    symbol="RELIANCE",
    interval=IntradayInterval.FIVE_MINUTES,
    user_id="user123"
)
```

### Validate Data

```python
# Pydantic automatically validates on instantiation
try:
    recommendation = IntradayRecommendation(
        signal=IntradaySignal.BUY,
        confidence=0.75,
        entry=2460.0,
        stop_loss=2445.0,
        target=2490.0,
        risk_reward=2.0,
        rationale="Strong momentum",
        is_stale=False
    )
except ValidationError as e:
    print(f"Validation failed: {e}")
```

## Validation Features

### Field Validators

1. **Symbol Validation**
   - Converts to uppercase
   - Validates pattern: `^[A-Z0-9]+$`

2. **Timestamp Validation**
   - Validates ISO 8601 format
   - Accepts various ISO formats

3. **Price Level Validation**
   - Automatically sorts support/resistance levels
   - Validates all levels are positive

4. **Stop Loss/Target Validation**
   - Validates directional correctness for BUY/SELL
   - Ensures logical price relationships

5. **Risk/Reward Validation**
   - Validates calculated value matches provided value
   - Allows 0.1 tolerance for floating point

## Testing

Unit tests are located in `/apps/quant/tests/test_intraday_models.py`.

Run tests:
```bash
cd apps/quant
python -m pytest tests/test_intraday_models.py -v
```

## Related Files

- TypeScript DTOs: `/apps/api/src/intraday/dto/`
- Quant Engine Services: `/apps/quant/services/`
- FastAPI Routes: `/apps/quant/main.py`

## Notes

1. All timestamps should use ISO 8601 format with timezone (e.g., `2024-01-15T10:30:00Z`)
2. Prices must be positive
3. Risk/reward ratios are always positive (absolute values used)
4. Support and resistance levels are automatically sorted in ascending order
5. Symbol validation happens before uppercase conversion in Pydantic v2
