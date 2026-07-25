# Intraday Trading DTOs

This directory contains TypeScript Data Transfer Objects (DTOs) for the intraday trading module.

## Overview

The intraday trading DTOs define the request/response structures for same-day trading analysis and recommendations. They include validation rules, data freshness tracking, and comprehensive technical analysis fields.

## Requirements Coverage

- **Requirement 6.1**: Intraday Trading Analysis
- **Requirement 6.2**: Data Freshness and Timestamp Validation

## Files

### `intraday-analysis-request.dto.ts`

Defines the request structure for intraday analysis.

**Fields:**
- `symbol` (required): Stock trading symbol (uppercase letters and numbers only)
- `interval` (required): Timeframe interval - one of: `1m`, `5m`, `15m`, `30m`, `1h`
- `userId` (optional): User ID for personalized risk validation

**Validation:**
- Symbol must match pattern: `/^[A-Z0-9]+$/`
- Interval must be one of the supported values
- All fields validated using `class-validator`

**Example:**
```typescript
{
  "symbol": "RELIANCE",
  "interval": "5m",
  "userId": "user123"
}
```

### `intraday-analysis-result.dto.ts`

Defines the complete analysis result structure.

**Main Interface: `IntradayAnalysisResultDto`**

Contains all data needed for intraday trading decisions:
- Symbol and interval used
- Analysis timestamp
- Data freshness tracking
- Technical analysis indicators
- Current price and price changes
- Trading recommendation

**Sub-Interface: `DataFreshness`**

Tracks data freshness for intraday decisions:
- `timestamp`: When data was last updated (ISO 8601)
- `ageSeconds`: Age of data in seconds
- `isStale`: Boolean flag indicating if data is too old

**Sub-Interface: `IntradayTechnicalAnalysis`**

Comprehensive technical indicators:
- RSI, MACD, EMAs (9, 21, 50)
- VWAP, ATR
- Volume and relative volume
- Bollinger Bands
- Support and resistance levels

**Example:**
```typescript
{
  "symbol": "RELIANCE",
  "interval": "5m",
  "timestamp": "2024-01-15T10:30:00Z",
  "dataFreshness": {
    "timestamp": "2024-01-15T10:30:00Z",
    "ageSeconds": 15.5,
    "isStale": false
  },
  "technicalAnalysis": {
    "rsi": 58.5,
    "macd": { "value": 12.3, "signal": 10.1, "histogram": 2.2 },
    "ema_9": 2465.0,
    "ema_21": 2460.0,
    "ema_50": 2455.0,
    "vwap": 2458.0,
    "atr": 15.5,
    "volume": 150000,
    "relativeVolume": 1.35,
    "bollingerBands": { "upper": 2480.0, "middle": 2460.0, "lower": 2440.0 },
    "supportLevels": [2430.0, 2445.0],
    "resistanceLevels": [2475.0, 2490.0]
  },
  "currentPrice": 2460.0,
  "priceChange": 15.5,
  "priceChangePercent": 0.63,
  "recommendation": { ... }
}
```

### `intraday-recommendation.dto.ts`

Defines trading recommendation structure.

**Enum: `IntradaySignal`**

Trading signal types:
- `BUY`: Long position recommended
- `SELL`: Short position recommended
- `HOLD`: Hold existing positions
- `NO_TRADE`: No trade recommended (conditions not favorable)

**Interface: `IntradayRecommendation`**

Complete trading recommendation:
- Signal type
- Confidence level (0.0 to 1.0)
- Entry, stop loss, and target prices
- Risk/reward ratio
- Human-readable rationale
- Staleness flag
- Optional expiration time
- Optional warnings

**Example:**
```typescript
{
  "signal": "BUY",
  "confidence": 0.75,
  "entry": 2460.0,
  "stopLoss": 2445.0,
  "target": 2490.0,
  "riskReward": 2.0,
  "rationale": "Strong upward momentum with RSI in bullish zone",
  "isStale": false,
  "validUntil": "2024-01-15T15:30:00Z",
  "warnings": []
}
```

## Usage

Import all DTOs from the index:

```typescript
import {
  IntradayAnalysisRequestDto,
  IntradayAnalysisResultDto,
  IntradayRecommendation,
  IntradaySignal,
  DataFreshness,
  IntradayTechnicalAnalysis,
} from './intraday/dto';
```

## Validation Rules

All DTOs use `class-validator` for runtime validation:

1. **Symbol Validation**
   - Must be uppercase
   - Only letters and numbers allowed
   - No special characters or spaces

2. **Interval Validation**
   - Must be one of: `1m`, `5m`, `15m`, `30m`, `1h`
   - Case-sensitive

3. **Timestamp Validation**
   - Must be ISO 8601 format
   - Example: `2024-01-15T10:30:00Z`

4. **Data Freshness**
   - Age must be non-negative
   - Staleness threshold configurable

## Testing

Unit tests are located in `*.spec.ts` files.

Run tests:
```bash
npm test -- src/intraday/dto/
```

## Related Files

- Python Pydantic models: `/apps/quant/models/intraday.py`
- Controller: `/apps/api/src/intraday/intraday.controller.ts`
- Service: `/apps/api/src/intraday/intraday.service.ts`
