# Options Module

The Options Module provides CORE options chain analysis functionality for NIFTY and BANKNIFTY options trading.

## Overview

This module implements the Options Chain Engine (Phase 8) with the following capabilities:

- **Options Chain Data Retrieval**: Fetches complete options chain from market data provider
- **PCR Analysis**: Calculates Put-Call Ratio from OI and volume to gauge market sentiment
- **ATM Identification**: Identifies At-The-Money strike and near ATM strikes (±3 strikes)
- **OI Analysis**: Detects OI buildup/unwinding patterns and support/resistance levels
- **Liquidity Filtering**: Identifies and warns about illiquid contracts

## Features

### 1. Symbol Validation

Only **NIFTY** and **BANKNIFTY** are supported for options analysis.

```typescript
// Valid requests
await optionsService.getOptionsChain({ symbol: 'NIFTY' });
await optionsService.getOptionsChain({ symbol: 'BANKNIFTY' });

// Invalid - will throw BadRequestException
await optionsService.getOptionsChain({ symbol: 'RELIANCE' });
```

### 2. PCR (Put-Call Ratio) Analysis

Calculates PCR from both OI and volume to determine market sentiment:

- **PCR > 1.2**: Bearish sentiment (more puts than calls)
- **PCR < 0.8**: Bullish sentiment (more calls than puts)
- **PCR ≈ 1.0**: Neutral sentiment

```typescript
{
  pcrAnalysis: {
    pcrByOI: 1.5,              // Put OI / Call OI
    pcrByVolume: 1.2,          // Put Volume / Call Volume
    sentiment: 'BEARISH',      // BULLISH | BEARISH | NEUTRAL
    totalCallOI: 10000000,
    totalPutOI: 15000000,
    totalCallVolume: 500000,
    totalPutVolume: 600000
  }
}
```

### 3. ATM Analysis

Identifies the At-The-Money strike (closest to spot price) and near ATM strikes (±3 strikes):

```typescript
{
  atmAnalysis: {
    spotPrice: 21525,
    atmStrike: 21500,          // Closest strike to spot
    strikeInterval: 100,       // Strike spacing
    nearATMStrikes: [
      {
        strike: 21400,
        distanceFromSpot: -0.58,  // Percentage distance from spot
        callOI: 10000,
        putOI: 12000,
        callVolume: 5000,
        putVolume: 4000
      },
      // ... more strikes
    ]
  }
}
```

### 4. OI Buildup/Unwinding Analysis

Detects market positioning patterns based on OI changes:

- **Long Buildup**: Increasing call OI > put OI (bullish)
- **Short Buildup**: Increasing put OI > call OI (bearish)
- **Long Unwinding**: Decreasing put OI (bearish)
- **Short Unwinding**: Decreasing call OI (bullish)

Also identifies support/resistance levels from high OI concentrations:

```typescript
{
  oiAnalysis: {
    buildupType: 'LONG_BUILDUP',
    explanation: 'Increasing call OI > put OI suggests bullish positioning',
    supportLevels: [
      {
        strike: 21400,
        strength: 0.85,
        reason: 'High put OI (12,000) suggests support'
      }
    ],
    resistanceLevels: [
      {
        strike: 21600,
        strength: 0.72,
        reason: 'High call OI (15,000) suggests resistance'
      }
    ],
    maxCallOIStrike: 21600,
    maxPutOIStrike: 21400,
    oiChangeAnalysis: [...]
  }
}
```

### 5. Liquidity Metrics and Warnings

Identifies illiquid contracts based on multiple criteria:

- **Wide Bid-Ask Spread**: Spread > 5% of mid-price
- **Low Volume**: Volume < 100
- **Low OI**: Open Interest < 500
- **Deep OTM**: > 10% away from spot price

Each contract includes liquidity warnings:

```typescript
{
  contract: {
    symbol: 'NIFTY',
    strikePrice: 22000,
    optionType: 'CALL',
    ltp: 5.5,
    bid: 5.0,
    ask: 6.0,
    openInterest: 300,        // Low OI
    volume: 50,               // Low volume
    liquidityWarning: {
      wideBidAskSpread: false,
      lowVolume: true,
      lowOI: true,
      deepOTM: true
    }
  }
}
```

## Architecture

The Options Module follows the standard ProfitTerminal architecture:

```
Market_Data_Provider (Kite Connect)
    ↓
Backend_API (NestJS) - OptionsService
    ↓
Analysis Engines (PCR, ATM, OI, Liquidity)
    ↓
Structured Response (OptionsChainDataDto)
```

### Data Flow

1. **Validation**: Symbol must be NIFTY or BANKNIFTY
2. **Fetch**: Get options chain from MarketDataService
3. **Transform**: Convert market data to OptionContract DTOs
4. **Calculate Greeks**: (Placeholder - will be implemented in task 66.2)
5. **PCR Analysis**: Calculate put-call ratios and sentiment
6. **ATM Analysis**: Identify ATM strike and near ATM strikes
7. **OI Analysis**: Detect buildup/unwinding patterns and support/resistance
8. **Liquidity Analysis**: Calculate metrics and add warnings
9. **Response**: Return complete options chain data with all analysis

## API Endpoints

### POST /options/chain

Fetch options chain with complete analysis.

**Request:**

```json
{
  "symbol": "NIFTY",
  "expiry": "2024-12-26"  // Optional
}
```

**Response:**

```json
{
  "symbol": "NIFTY",
  "expiryDate": "2024-12-26",
  "spotPrice": 21525,
  "timestamp": "2024-12-15T10:30:00Z",
  "contracts": [
    {
      "symbol": "NIFTY",
      "strikePrice": 21500,
      "optionType": "CALL",
      "expiryDate": "2024-12-26",
      "ltp": 120.5,
      "bid": 119.3,
      "ask": 121.7,
      "openInterest": 50000,
      "changeInOI": 2000,
      "volume": 10000,
      "impliedVolatility": 15.5,
      "delta": 0.52,
      "gamma": 0.003,
      "theta": -12.5,
      "vega": 45.2,
      "bidAskSpread": 2.4,
      "bidAskSpreadPercent": 2.0,
      "liquidityWarning": null
    }
    // ... more contracts
  ],
  "pcrAnalysis": {
    "pcrByOI": 1.05,
    "pcrByVolume": 0.98,
    "sentiment": "NEUTRAL",
    "totalCallOI": 10000000,
    "totalPutOI": 10500000,
    "totalCallVolume": 500000,
    "totalPutVolume": 490000
  },
  "atmAnalysis": {
    "spotPrice": 21525,
    "atmStrike": 21500,
    "strikeInterval": 100,
    "nearATMStrikes": [...]
  },
  "oiAnalysis": {
    "buildupType": "LONG_BUILDUP",
    "explanation": "...",
    "supportLevels": [...],
    "resistanceLevels": [...],
    "maxCallOIStrike": 21600,
    "maxPutOIStrike": 21400,
    "oiChangeAnalysis": [...]
  },
  "liquidityMetrics": {
    "totalContracts": 100,
    "liquidContracts": 85,
    "illiquidContracts": 15,
    "averageVolume": 5000,
    "averageOI": 25000,
    "averageBidAskSpread": 2.5,
    "illiquidContractsList": [...]
  }
}
```

## Module Structure

```
options/
├── dto/
│   └── options-chain.dto.ts        # DTOs for requests and responses
├── options.controller.ts            # HTTP endpoints
├── options.service.ts               # Business logic orchestration
├── options.module.ts                # NestJS module definition
├── options.service.spec.ts          # Unit tests
├── index.ts                         # Module exports
└── README.md                        # This file
```

## Testing

Run unit tests:

```bash
npm test -- options.service.spec.ts
```

Test coverage:

- Symbol validation (NIFTY/BANKNIFTY only)
- PCR calculation accuracy
- ATM strike identification
- Liquidity warning detection
- Contract transformation

## Requirements Covered

- **Requirement 7.1**: Options scalping analysis for NIFTY/BANKNIFTY
  - PCR calculation from OI and volume
  - ATM strike identification and near ATM strikes (±3)
  - OI buildup/unwinding detection
  - Support/resistance levels from OI concentrations
  - Liquidity filtering and warnings

- **Requirement 18.1**: Data flow enforcement
  - AI will receive only verified analysis data (not implemented yet)
  - Market data flows through deterministic analysis first
  - No direct AI access to raw market data

## Limitations and Future Work

### Current Limitations

1. **Greeks Calculation**: Placeholder values - will be implemented in task 66.2
2. **OI Change Detection**: Uses current OI only - historical comparison will be added
3. **Bid-Ask Spread**: Approximated from LTP - will use real bid/ask when available
4. **Implied Volatility**: Placeholder - will be calculated from real data

### Future Tasks

- **Task 66.2**: Enhance Greeks calculator for batch chain analysis
- **Task 66.3**: Create Options Analysis Service in Quant Engine (Python)
- **Task 66.4**: Write comprehensive unit tests
- **Task 67**: Implement liquidity filtering and safety controls
- **Task 68**: Create Quant Engine endpoints for options chain
- **Task 69**: Add rate limiting for options endpoints
- **Task 70**: Create frontend visualization components

## Safety Controls

The Options Module implements strict safety controls:

1. **Symbol Validation**: Only NIFTY and BANKNIFTY allowed
2. **Liquidity Warnings**: Clear identification of illiquid contracts
3. **No Auto-Trading**: This module provides analysis only, NO execution
4. **No Multi-Leg Strategies**: CORE functionality only

## Notes

- This is Phase 8 of the ProfitTerminal project
- Focus is on CORE options analysis functionality
- NO multi-leg strategies (spreads, straddles, etc.)
- NO automatic trade execution
- Manual controls only
