# Quant Engine Pydantic Models

This directory contains Pydantic v2 models for the ProfitTerminal Quant Engine. These models define the data structures for market data inputs, technical analysis outputs, and options calculations.

## Overview

The models provide:

- **Type safety** with Python type hints
- **Data validation** with comprehensive rules
- **JSON serialization** for API communication
- **Documentation** via field descriptions and examples

## Models

### Input Models

#### `OHLCVData`

Represents a single candlestick (Open, High, Low, Close, Volume) data point.

**Fields:**

- `timestamp`: Datetime of the data point
- `open`: Opening price (must be positive)
- `high`: Highest price (must be >= low, open, close)
- `low`: Lowest price (must be <= open, close)
- `close`: Closing price (must be positive)
- `volume`: Trading volume (must be non-negative)

**Validation:**

- All prices must be positive
- High must be the maximum of OHLC
- Low must be the minimum of OHLC
- Volume cannot be negative

#### `MarketDataRequest`

Request model for market data analysis containing symbol, timeframe, and OHLCV data.

**Fields:**

- `symbol`: Trading symbol (1-20 characters)
- `timeframe`: One of: 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w
- `data`: List of OHLCV data points (must have at least 1)

**Validation:**

- Symbol must not be empty
- Timeframe must match allowed values
- Data must be sorted by timestamp in ascending order

#### `OptionsRequest`

Request model for options Greeks calculation using Black-Scholes model.

**Fields:**

- `underlying`: Underlying symbol (e.g., NIFTY, BANKNIFTY)
- `spot_price`: Current spot price (must be positive)
- `strike_price`: Strike price (must be positive)
- `option_type`: CALL or PUT
- `expiry_date`: Option expiry date
- `volatility`: Implied volatility (0-2 as decimal, e.g., 0.15 = 15%)
- `risk_free_rate`: Risk-free interest rate (0-0.2 as decimal)

### Output Models

#### `IndicatorResult`

Technical indicator calculation results.

**Fields:**

- `rsi`: Relative Strength Index (0-100)
- `macd`: MACD values (value, signal, histogram)
- `sma_20`, `sma_50`, `sma_200`: Simple Moving Averages
- `ema_20`: Exponential Moving Average
- `bollinger_bands`: Upper, middle, lower bands

**Validation:**

- RSI must be between 0 and 100
- All moving averages must be positive
- Bollinger Bands: upper > middle > lower

#### `TrendlineResult`

Detected trendline from linear regression on price data.

**Fields:**

- `slope`: Slope of the trendline
- `intercept`: Y-intercept
- `r_squared`: Goodness of fit (0-1)
- `start_point`: (x, y) tuple for start
- `end_point`: (x, y) tuple for end

**Validation:**

- R² must be between 0 and 1

#### `SupportResistanceLevel`

Support or resistance level detected in price data.

**Fields:**

- `level`: Price level (must be positive)
- `strength`: Strength score (0-1)
- `touches`: Number of times price touched this level (minimum 1)

**Validation:**

- Level must be positive
- Strength must be between 0 and 1
- Touches must be at least 1

#### `AnalysisResult`

Complete quantitative analysis result containing all technical indicators, trendlines, and support/resistance levels.

**Fields:**

- `symbol`: Trading symbol
- `timeframe`: Timeframe of analysis
- `indicators`: IndicatorResult
- `support_resistance`: List of support/resistance levels (can be empty)
- `trendlines`: List of trendlines (can be empty)
- `options_greeks`: Optional Greeks for options symbols

#### `OptionsGreeks`

Options Greeks calculated using Black-Scholes model.

**Fields:**

- `delta`: Rate of change with respect to underlying price (-1 to 1)
- `gamma`: Rate of change of delta (always positive)
- `theta`: Time decay (typically negative for long options)
- `vega`: Sensitivity to volatility (always positive)
- `rho`: Sensitivity to interest rate

**Validation:**

- Delta must be between -1 and 1
- Gamma must be non-negative
- Vega must be non-negative

#### `GreeksResult`

Response model containing calculated Greeks and input parameters.

**Fields:**

- `underlying`: Underlying symbol
- `spot_price`: Spot price used
- `strike_price`: Strike price
- `option_type`: CALL or PUT
- `expiry_date`: Expiry date
- `greeks`: Calculated OptionsGreeks

## Usage Examples

### Creating Market Data Request

```python
from models import OHLCVData, MarketDataRequest
from datetime import datetime, timezone

# Create OHLCV data
ohlcv = OHLCVData(
    timestamp=datetime(2024, 1, 15, 9, 15, 0, tzinfo=timezone.utc),
    open=2450.0,
    high=2470.0,
    low=2445.0,
    close=2465.0,
    volume=1000000
)

# Create request
request = MarketDataRequest(
    symbol="RELIANCE",
    timeframe="1d",
    data=[ohlcv]
)
```

### Creating Analysis Result

```python
from models import AnalysisResult, IndicatorResult, MACDValues, BollingerBands

analysis = AnalysisResult(
    symbol="RELIANCE",
    timeframe="1d",
    indicators=IndicatorResult(
        rsi=45.2,
        macd=MACDValues(value=12.3, signal=10.1, histogram=2.2),
        sma_20=2455.0,
        sma_50=2450.0,
        sma_200=2380.0,
        ema_20=2458.0,
        bollinger_bands=BollingerBands(
            upper=2500.0,
            middle=2455.0,
            lower=2410.0
        )
    ),
    support_resistance=[],
    trendlines=[]
)
```

### JSON Serialization

```python
# Serialize to JSON
json_str = analysis.model_dump_json()

# Deserialize from JSON
parsed = AnalysisResult.model_validate_json(json_str)
```

### Options Greeks Request

```python
from models import OptionsRequest, OptionType
from datetime import datetime, timezone

request = OptionsRequest(
    underlying="NIFTY",
    spot_price=21500.0,
    strike_price=21600.0,
    option_type=OptionType.CALL,
    expiry_date=datetime(2024, 12, 26, tzinfo=timezone.utc),
    volatility=0.15,
    risk_free_rate=0.07
)
```

## Validation

All models include comprehensive validation:

1. **Type validation**: Ensures correct data types
2. **Range validation**: Ensures values are within valid ranges (e.g., RSI 0-100)
3. **Relationship validation**: Ensures logical relationships (e.g., high >= low)
4. **Format validation**: Ensures correct formats (e.g., timeframe pattern)

Invalid data will raise `pydantic.ValidationError` with detailed error messages.

## Architecture

These models enforce the architectural principle that **all market data flows through deterministic quantitative analysis** before reaching the AI service. The models ensure:

- Type safety throughout the analysis pipeline
- Consistent data structures between services
- Validation at API boundaries
- Clear documentation of expected data formats

## Requirements

- Python 3.11+
- Pydantic 2.7+

## Testing

Models are tested for:

- Valid data creation
- Validation rule enforcement
- JSON serialization/deserialization
- Round-trip data integrity

See `tests/test_models.py` for comprehensive test suite.
