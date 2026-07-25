"""
Market data Pydantic models for the Quant Engine.

These models define the structure for market data inputs and analysis outputs,
with comprehensive validation rules to ensure data integrity.
"""

from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Any
from datetime import datetime
from enum import Enum


class OHLCVData(BaseModel):
    """
    Represents a single candlestick (OHLCV) data point.

    Attributes:
        timestamp: The time point for this data
        open: Opening price
        high: Highest price in the period
        low: Lowest price in the period
        close: Closing price
        volume: Trading volume
    """

    timestamp: datetime = Field(..., description="Timestamp for this data point")
    open: float = Field(..., gt=0, description="Opening price, must be positive")
    high: float = Field(..., gt=0, description="Highest price, must be positive")
    low: float = Field(..., gt=0, description="Lowest price, must be positive")
    close: float = Field(..., gt=0, description="Closing price, must be positive")
    volume: int = Field(..., ge=0, description="Trading volume, must be non-negative")

    @field_validator("high")
    @classmethod
    def validate_high(cls, v: float, values) -> float:
        """Ensure high >= low and high >= open and high >= close."""
        if hasattr(values, "data"):
            data = values.data
            if "low" in data and v < data["low"]:
                raise ValueError("high must be >= low")
            if "open" in data and v < data["open"]:
                raise ValueError("high must be >= open")
            if "close" in data and v < data["close"]:
                raise ValueError("high must be >= close")
        return v

    @field_validator("low")
    @classmethod
    def validate_low(cls, v: float, values) -> float:
        """Ensure low <= open and low <= close."""
        if hasattr(values, "data"):
            data = values.data
            if "open" in data and v > data["open"]:
                raise ValueError("low must be <= open")
            if "close" in data and v > data["close"]:
                raise ValueError("low must be <= close")
        return v

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "timestamp": "2024-01-15T09:15:00Z",
                    "open": 2450.0,
                    "high": 2470.0,
                    "low": 2445.0,
                    "close": 2465.0,
                    "volume": 1000000,
                }
            ]
        }
    }


class MarketDataRequest(BaseModel):
    """
    Request model for market data analysis.

    Attributes:
        symbol: Trading symbol (e.g., 'RELIANCE', 'NIFTY')
        timeframe: Timeframe for the data (e.g., '1m', '5m', '15m', '1h', '1d')
        data: List of OHLCV data points
    """

    symbol: str = Field(..., min_length=1, max_length=20, description="Trading symbol")
    timeframe: str = Field(
        ...,
        pattern=r"^(1m|5m|15m|30m|1h|4h|1d|1w)$",
        description="Timeframe: 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w",
    )
    data: List[OHLCVData] = Field(..., min_length=1, description="OHLCV data points")

    @field_validator("data")
    @classmethod
    def validate_data_sorted(cls, v: List[OHLCVData]) -> List[OHLCVData]:
        """Ensure data is sorted by timestamp in ascending order."""
        if len(v) > 1:
            timestamps = [d.timestamp for d in v]
            if timestamps != sorted(timestamps):
                raise ValueError("data must be sorted by timestamp in ascending order")
        return v

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "symbol": "RELIANCE",
                    "timeframe": "1d",
                    "data": [
                        {
                            "timestamp": "2024-01-15T00:00:00Z",
                            "open": 2450.0,
                            "high": 2470.0,
                            "low": 2445.0,
                            "close": 2465.0,
                            "volume": 1000000,
                        }
                    ],
                }
            ]
        }
    }


class MACDValues(BaseModel):
    """MACD indicator values."""

    value: float = Field(..., description="MACD line value (EMA12 - EMA26)")
    signal: float = Field(..., description="Signal line (9-period EMA of MACD)")
    histogram: float = Field(..., description="MACD histogram (MACD - Signal)")


class BollingerBands(BaseModel):
    """Bollinger Bands values."""

    upper: float = Field(..., description="Upper band (SMA + 2*StdDev)")
    middle: float = Field(..., description="Middle band (SMA)")
    lower: float = Field(..., description="Lower band (SMA - 2*StdDev)")

    @field_validator("upper")
    @classmethod
    def validate_upper(cls, v: float, values) -> float:
        """Ensure upper > middle > lower."""
        if hasattr(values, "data"):
            data = values.data
            if "middle" in data and v <= data["middle"]:
                raise ValueError("upper must be > middle")
        return v

    @field_validator("lower")
    @classmethod
    def validate_lower(cls, v: float, values) -> float:
        """Ensure lower < middle."""
        if hasattr(values, "data"):
            data = values.data
            if "middle" in data and v >= data["middle"]:
                raise ValueError("lower must be < middle")
        return v


class IndicatorResult(BaseModel):
    """
    Technical indicator calculation results.

    All standard technical indicators calculated for the given market data.
    """

    rsi: float = Field(..., ge=0, le=100, description="RSI (0-100)")
    macd: MACDValues = Field(..., description="MACD indicator values")
    sma_20: float = Field(..., gt=0, description="20-period Simple Moving Average")
    sma_50: float = Field(..., gt=0, description="50-period Simple Moving Average")
    sma_200: float = Field(..., gt=0, description="200-period Simple Moving Average")
    ema_5: float = Field(..., gt=0, description="5-period Exponential Moving Average")
    ema_15: float = Field(..., gt=0, description="15-period Exponential Moving Average")
    ema_20: float = Field(..., gt=0, description="20-period Exponential Moving Average")
    ema_50: float = Field(..., gt=0, description="50-period Exponential Moving Average")
    ema_200: float = Field(
        ..., gt=0, description="200-period Exponential Moving Average"
    )
    bollinger_bands: BollingerBands = Field(..., description="Bollinger Bands")
    adx: float = Field(
        ..., ge=0, le=100, description="Average Directional Index (0-100)"
    )
    atr: float = Field(..., gt=0, description="Average True Range")
    vwap: float = Field(..., gt=0, description="Volume Weighted Average Price")
    volume_ma: float = Field(..., ge=0, description="Volume Moving Average")
    relative_volume: float = Field(
        ..., ge=0, description="Relative Volume (current volume / average volume)"
    )
    week_52_high: float = Field(..., gt=0, description="52-week high price")
    week_52_low: float = Field(..., gt=0, description="52-week low price")
    momentum: float = Field(..., description="Price momentum")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "rsi": 45.2,
                    "macd": {"value": 12.3, "signal": 10.1, "histogram": 2.2},
                    "sma_20": 2455.0,
                    "sma_50": 2450.0,
                    "sma_200": 2380.0,
                    "ema_5": 2462.5,
                    "ema_15": 2460.0,
                    "ema_20": 2458.0,
                    "ema_50": 2452.0,
                    "ema_200": 2385.0,
                    "bollinger_bands": {
                        "upper": 2500.0,
                        "middle": 2455.0,
                        "lower": 2410.0,
                    },
                    "adx": 25.5,
                    "atr": 45.3,
                    "vwap": 2461.0,
                    "volume_ma": 950000.0,
                    "relative_volume": 1.05,
                    "week_52_high": 2650.0,
                    "week_52_low": 2200.0,
                    "momentum": 15.2,
                }
            ]
        }
    }


class TrendlineResult(BaseModel):
    """
    Detected trendline from price data.

    Represents a linear trend fitted to price data using regression.
    """

    slope: float = Field(..., description="Slope of the trendline")
    intercept: float = Field(..., description="Y-intercept of the trendline")
    r_squared: float = Field(
        ..., ge=0, le=1, description="R² value (goodness of fit, 0-1)"
    )
    start_point: tuple[float, float] = Field(
        ..., description="Starting point (x, y) of the trendline"
    )
    end_point: tuple[float, float] = Field(
        ..., description="Ending point (x, y) of the trendline"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "slope": 2.5,
                    "intercept": 2350.0,
                    "r_squared": 0.89,
                    "start_point": [0, 2350.0],
                    "end_point": [30, 2425.0],
                }
            ]
        }
    }


class SupportResistanceLevel(BaseModel):
    """
    Support or resistance level detected in price data.

    Attributes:
        level: Price level
        strength: Strength of the level (0-1)
        touches: Number of times price touched this level
    """

    level: float = Field(..., gt=0, description="Price level")
    strength: float = Field(
        ..., ge=0, le=1, description="Strength score (0-1, higher is stronger)"
    )
    touches: int = Field(
        ..., ge=1, description="Number of times price touched this level"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {"level": 2400.0, "strength": 0.85, "touches": 5},
                {"level": 2500.0, "strength": 0.72, "touches": 3},
            ]
        }
    }


class AnalysisResult(BaseModel):
    """
    Complete quantitative analysis result for market data.

    This is the main response model containing all technical analysis results.
    """

    symbol: str = Field(..., description="Trading symbol")
    timeframe: str = Field(..., description="Timeframe of the analysis")
    indicators: IndicatorResult = Field(..., description="Technical indicators")
    price_action: Optional["PriceActionResult"] = Field(
        None,
        description="Price action analysis (trend patterns, candlestick patterns, momentum)",
    )
    support_resistance: List[SupportResistanceLevel] = Field(
        default_factory=list, description="Support and resistance levels"
    )
    trendlines: List[TrendlineResult] = Field(
        default_factory=list, description="Detected trendlines"
    )
    options_greeks: Optional["OptionsGreeks"] = Field(
        None, description="Options Greeks (for options symbols only)"
    )
    trendline: Optional[Any] = Field(
        None,
        description="Comprehensive trendline analysis (TrendlineServiceResult, optional, requested via include_trendline parameter)",
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "symbol": "RELIANCE",
                    "timeframe": "1d",
                    "indicators": {
                        "rsi": 45.2,
                        "macd": {"value": 12.3, "signal": 10.1, "histogram": 2.2},
                        "sma_20": 2455.0,
                        "sma_50": 2450.0,
                        "sma_200": 2380.0,
                        "ema_5": 2462.5,
                        "ema_15": 2460.0,
                        "ema_20": 2458.0,
                        "ema_50": 2452.0,
                        "ema_200": 2385.0,
                        "bollinger_bands": {
                            "upper": 2500.0,
                            "middle": 2455.0,
                            "lower": 2410.0,
                        },
                        "adx": 25.5,
                        "atr": 45.3,
                        "vwap": 2461.0,
                        "volume_ma": 950000.0,
                        "relative_volume": 1.05,
                        "week_52_high": 2650.0,
                        "week_52_low": 2200.0,
                        "momentum": 15.2,
                    },
                    "support_resistance": [
                        {"level": 2400.0, "strength": 0.85, "touches": 5},
                        {"level": 2500.0, "strength": 0.72, "touches": 3},
                    ],
                    "trendlines": [
                        {
                            "slope": 2.5,
                            "intercept": 2350.0,
                            "r_squared": 0.89,
                            "start_point": [0, 2350.0],
                            "end_point": [30, 2425.0],
                        }
                    ],
                }
            ]
        }
    }


class OptionType(str, Enum):
    """Option type enumeration."""

    CALL = "CALL"
    PUT = "PUT"


class OptionsRequest(BaseModel):
    """
    Request model for options Greeks calculation.

    Attributes:
        underlying: Underlying symbol (e.g., 'NIFTY', 'BANKNIFTY')
        spot_price: Current spot price of the underlying
        strike_price: Strike price of the option
        option_type: Type of option (CALL or PUT)
        expiry_date: Expiry date of the option
        volatility: Implied volatility (as decimal, e.g., 0.15 for 15%)
        risk_free_rate: Risk-free interest rate (as decimal, e.g., 0.07 for 7%)
    """

    underlying: str = Field(..., min_length=1, description="Underlying symbol")
    spot_price: float = Field(..., gt=0, description="Current spot price")
    strike_price: float = Field(..., gt=0, description="Strike price")
    option_type: OptionType = Field(..., description="Option type: CALL or PUT")
    expiry_date: datetime = Field(..., description="Option expiry date")
    volatility: float = Field(..., gt=0, le=2, description="Implied volatility (0-2)")
    risk_free_rate: float = Field(
        ..., ge=0, le=0.2, description="Risk-free rate (0-0.2)"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "underlying": "NIFTY",
                    "spot_price": 21500.0,
                    "strike_price": 21600.0,
                    "option_type": "CALL",
                    "expiry_date": "2024-12-26T00:00:00Z",
                    "volatility": 0.15,
                    "risk_free_rate": 0.07,
                }
            ]
        }
    }


class OptionsGreeks(BaseModel):
    """
    Options Greeks calculated using Black-Scholes model.

    Attributes:
        delta: Rate of change of option price with respect to underlying price
        gamma: Rate of change of delta with respect to underlying price
        theta: Rate of change of option price with respect to time (per day)
        vega: Rate of change of option price with respect to volatility
        rho: Rate of change of option price with respect to interest rate
    """

    delta: float = Field(
        ..., ge=-1, le=1, description="Delta (-1 to 1, typically 0 to 1 for calls)"
    )
    gamma: float = Field(..., ge=0, description="Gamma (always positive)")
    theta: float = Field(..., description="Theta (typically negative for long options)")
    vega: float = Field(..., ge=0, description="Vega (always positive)")
    rho: float = Field(..., description="Rho (positive for calls, negative for puts)")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "delta": 0.52,
                    "gamma": 0.003,
                    "theta": -12.5,
                    "vega": 45.2,
                    "rho": 23.4,
                }
            ]
        }
    }


class GreeksResult(BaseModel):
    """
    Response model for options Greeks calculation.

    Contains the calculated Greeks along with the input parameters for reference.
    """

    underlying: str = Field(..., description="Underlying symbol")
    spot_price: float = Field(..., description="Spot price used in calculation")
    strike_price: float = Field(..., description="Strike price")
    option_type: OptionType = Field(..., description="Option type")
    expiry_date: datetime = Field(..., description="Expiry date")
    greeks: OptionsGreeks = Field(..., description="Calculated Greeks")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "underlying": "NIFTY",
                    "spot_price": 21500.0,
                    "strike_price": 21600.0,
                    "option_type": "CALL",
                    "expiry_date": "2024-12-26T00:00:00Z",
                    "greeks": {
                        "delta": 0.52,
                        "gamma": 0.003,
                        "theta": -12.5,
                        "vega": 45.2,
                        "rho": 23.4,
                    },
                }
            ]
        }
    }


class BatchGreeksContract(BaseModel):
    """
    Input model for a single contract in batch Greeks calculation.

    Represents one option contract for which Greeks should be calculated.
    """

    strike_price: float = Field(..., gt=0, description="Strike price of the option")
    expiry_date: datetime = Field(..., description="Option expiry datetime")
    volatility: float = Field(
        ...,
        gt=0,
        le=2.0,
        description="Implied volatility (as decimal, e.g., 0.15 for 15%)",
    )
    option_type: OptionType = Field(..., description="Option type (CALL or PUT)")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "strike_price": 21500.0,
                    "expiry_date": "2024-12-26T00:00:00Z",
                    "volatility": 0.15,
                    "option_type": "CALL",
                }
            ]
        }
    }


class BatchGreeksRequest(BaseModel):
    """
    Request model for batch Greeks calculation endpoint.

    Used to calculate Greeks for entire options chain (100+ contracts) efficiently.
    """

    underlying: str = Field(
        ..., description="Underlying symbol (e.g., 'NIFTY', 'BANKNIFTY')"
    )
    spot_price: float = Field(..., gt=0, description="Current price of underlying")
    contracts: List[BatchGreeksContract] = Field(
        ..., min_length=1, description="List of option contracts to calculate Greeks for"
    )
    risk_free_rate: float = Field(
        default=0.07,
        ge=0,
        le=0.25,
        description="Risk-free interest rate (as decimal, default: 0.07 for 7%)",
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "underlying": "NIFTY",
                    "spot_price": 21500.0,
                    "contracts": [
                        {
                            "strike_price": 21400.0,
                            "expiry_date": "2024-12-26T00:00:00Z",
                            "volatility": 0.15,
                            "option_type": "CALL",
                        },
                        {
                            "strike_price": 21400.0,
                            "expiry_date": "2024-12-26T00:00:00Z",
                            "volatility": 0.15,
                            "option_type": "PUT",
                        },
                        {
                            "strike_price": 21500.0,
                            "expiry_date": "2024-12-26T00:00:00Z",
                            "volatility": 0.14,
                            "option_type": "CALL",
                        },
                    ],
                    "risk_free_rate": 0.07,
                }
            ]
        }
    }


class BatchGreeksContractResult(BaseModel):
    """
    Result model for a single contract in batch Greeks calculation.

    Contains basic Greeks (Delta, Gamma, Theta, Vega) for one option contract.
    Note: Rho is omitted in batch mode for performance optimization.
    """

    strike_price: float = Field(..., description="Strike price of the option")
    expiry_date: datetime = Field(..., description="Option expiry datetime")
    option_type: OptionType = Field(..., description="Option type")
    delta: float = Field(
        ..., ge=-1, le=1, description="Delta (-1 to 1, typically 0 to 1 for calls)"
    )
    gamma: float = Field(..., ge=0, description="Gamma (always positive)")
    theta: float = Field(..., description="Theta (typically negative for long options)")
    vega: float = Field(..., ge=0, description="Vega (always positive)")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "strike_price": 21500.0,
                    "expiry_date": "2024-12-26T00:00:00Z",
                    "option_type": "CALL",
                    "delta": 0.52,
                    "gamma": 0.003,
                    "theta": -12.5,
                    "vega": 45.2,
                }
            ]
        }
    }


class BatchGreeksResult(BaseModel):
    """
    Response model for batch Greeks calculation endpoint.

    Contains Greeks for all contracts in the options chain.
    """

    underlying: str = Field(..., description="Underlying symbol")
    spot_price: float = Field(..., description="Spot price used in calculations")
    total_contracts: int = Field(..., description="Total number of contracts processed")
    contracts: List[BatchGreeksContractResult] = Field(
        ..., description="Greeks for each contract"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "underlying": "NIFTY",
                    "spot_price": 21500.0,
                    "total_contracts": 3,
                    "contracts": [
                        {
                            "strike_price": 21400.0,
                            "expiry_date": "2024-12-26T00:00:00Z",
                            "option_type": "CALL",
                            "delta": 0.62,
                            "gamma": 0.0035,
                            "theta": -15.2,
                            "vega": 42.1,
                        },
                        {
                            "strike_price": 21400.0,
                            "expiry_date": "2024-12-26T00:00:00Z",
                            "option_type": "PUT",
                            "delta": -0.38,
                            "gamma": 0.0035,
                            "theta": -14.8,
                            "vega": 42.1,
                        },
                        {
                            "strike_price": 21500.0,
                            "expiry_date": "2024-12-26T00:00:00Z",
                            "option_type": "CALL",
                            "delta": 0.51,
                            "gamma": 0.004,
                            "theta": -18.5,
                            "vega": 48.3,
                        },
                    ],
                }
            ]
        }
    }


class SwingType(str, Enum):
    """Swing point type enumeration."""

    HIGH = "HIGH"
    LOW = "LOW"


class TrendPattern(str, Enum):
    """Trend pattern classification for price action analysis."""

    UPTREND = "UPTREND"  # Higher highs and higher lows
    DOWNTREND = "DOWNTREND"  # Lower highs and lower lows
    SIDEWAYS = "SIDEWAYS"  # No clear trend
    UNKNOWN = "UNKNOWN"  # Insufficient data


class CandlestickPattern(str, Enum):
    """Candlestick pattern types for price action analysis."""

    BULLISH_ENGULFING = "BULLISH_ENGULFING"
    BEARISH_ENGULFING = "BEARISH_ENGULFING"
    HAMMER = "HAMMER"
    INVERTED_HAMMER = "INVERTED_HAMMER"
    DOJI = "DOJI"
    NONE = "NONE"


class SwingPoint(BaseModel):
    """
    Represents a swing point (swing high or swing low) in price data.

    Attributes:
        timestamp: The timestamp of the swing point
        price: The price at the swing point
        type: Type of swing point (HIGH or LOW)
        index: Index position in the original data array
    """

    timestamp: datetime = Field(..., description="Timestamp of the swing point")
    price: float = Field(..., gt=0, description="Price at the swing point")
    type: SwingType = Field(..., description="Type of swing point (HIGH or LOW)")
    index: int = Field(..., ge=0, description="Index position in the data array")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "timestamp": "2024-01-15T09:15:00Z",
                    "price": 2470.0,
                    "type": "HIGH",
                    "index": 5,
                },
                {
                    "timestamp": "2024-01-16T14:30:00Z",
                    "price": 2445.0,
                    "type": "LOW",
                    "index": 12,
                },
            ]
        }
    }


class PriceActionResult(BaseModel):
    """
    Price action analysis result.

    Provides comprehensive price action analysis including trend patterns,
    higher/lower highs and lows detection, candlestick patterns, and momentum.

    Attributes:
        trend_pattern: Detected trend pattern (UPTREND, DOWNTREND, SIDEWAYS, or UNKNOWN)
        higher_highs: Whether price shows higher highs
        higher_lows: Whether price shows higher lows
        lower_highs: Whether price shows lower highs
        lower_lows: Whether price shows lower lows
        trend_confidence: Confidence score for trend (0-100)
        candlestick_patterns: List of detected candlestick patterns in recent candles
        momentum: Rate of change momentum indicator (percentage)
        momentum_period: Period used for momentum calculation
    """

    trend_pattern: TrendPattern = Field(..., description="Detected trend pattern")
    higher_highs: bool = Field(..., description="Price shows higher highs")
    higher_lows: bool = Field(..., description="Price shows higher lows")
    lower_highs: bool = Field(..., description="Price shows lower highs")
    lower_lows: bool = Field(..., description="Price shows lower lows")
    trend_confidence: float = Field(
        ..., ge=0, le=100, description="Trend confidence (0-100)"
    )
    candlestick_patterns: List[CandlestickPattern] = Field(
        default_factory=list,
        description="Detected candlestick patterns in recent candles",
    )
    momentum: float = Field(..., description="Price momentum (rate of change %)")
    momentum_period: int = Field(
        ..., gt=0, description="Period for momentum calculation"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "trend_pattern": "UPTREND",
                    "higher_highs": True,
                    "higher_lows": True,
                    "lower_highs": False,
                    "lower_lows": False,
                    "trend_confidence": 85.5,
                    "candlestick_patterns": ["HAMMER", "BULLISH_ENGULFING"],
                    "momentum": 12.5,
                    "momentum_period": 10,
                }
            ]
        }
    }


class TrendEnum(str, Enum):
    """Market trend classification enumeration."""

    BULLISH = "BULLISH"
    BEARISH = "BEARISH"
    NEUTRAL = "NEUTRAL"


class MarketRegimeEnum(str, Enum):
    """Market regime classification enumeration."""

    BULL_MARKET = "BULL_MARKET"
    BEAR_MARKET = "BEAR_MARKET"
    SIDEWAYS = "SIDEWAYS"
    VOLATILE = "VOLATILE"


class ScoreResult(BaseModel):
    """
    Deterministic market scoring result for the scoring endpoint.

    This model contains a comprehensive analysis of market conditions
    with a deterministic score and trend classification based on
    technical indicators.

    Attributes:
        trend: Market trend classification (BULLISH, BEARISH, or NEUTRAL)
        rsi: Relative Strength Index value (0-100)
        adx: Average Directional Index value (0-100)
        vwap: Volume Weighted Average Price
        volumeRatio: Relative volume ratio (current volume / average volume)
        score: Overall market score (0-100, higher indicates stronger conditions)
        signals: List of signal descriptions explaining the score
    """

    trend: TrendEnum = Field(..., description="Market trend classification")
    rsi: float = Field(..., ge=0, le=100, description="RSI value (0-100)")
    adx: float = Field(..., ge=0, le=100, description="ADX value (0-100)")
    vwap: float = Field(..., gt=0, description="Volume Weighted Average Price")
    volumeRatio: float = Field(..., ge=0, description="Relative volume ratio (>= 0)")
    score: float = Field(..., ge=0, le=100, description="Overall market score (0-100)")
    signals: List[str] = Field(
        default_factory=list, description="List of signal descriptions"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "trend": "BULLISH",
                    "rsi": 65.4,
                    "adx": 28.5,
                    "vwap": 2461.0,
                    "volumeRatio": 1.25,
                    "score": 78.5,
                    "signals": [
                        "Strong upward trend detected (ADX > 25)",
                        "RSI in bullish range (50-70)",
                        "Above average volume (1.25x)",
                        "Price trading above VWAP",
                    ],
                },
                {
                    "trend": "BEARISH",
                    "rsi": 32.1,
                    "adx": 31.2,
                    "vwap": 2440.0,
                    "volumeRatio": 1.45,
                    "score": 25.8,
                    "signals": [
                        "Strong downward trend detected (ADX > 25)",
                        "RSI in bearish range (<40)",
                        "Above average volume (1.45x)",
                        "Price trading below VWAP",
                    ],
                },
                {
                    "trend": "NEUTRAL",
                    "rsi": 48.3,
                    "adx": 18.7,
                    "vwap": 2455.0,
                    "volumeRatio": 0.85,
                    "score": 50.0,
                    "signals": [
                        "Weak trend (ADX < 25)",
                        "RSI near neutral (45-55)",
                        "Below average volume (0.85x)",
                        "Price near VWAP",
                    ],
                },
            ]
        }
    }


class MarketRegimeResult(BaseModel):
    """
    Market regime detection result.

    Analyzes NIFTY 50 or other market indices to determine overall market conditions.
    Classifies the market into one of four regimes and provides a strength score.

    Attributes:
        regime: Market regime classification (BULL_MARKET, BEAR_MARKET, SIDEWAYS, VOLATILE)
        strength: Regime strength score (0.0-1.0, higher indicates stronger regime)
        ema_20: 20-period EMA value
        ema_50: 50-period EMA value
        ema_200: 200-period EMA value
        rsi: RSI value
        adx: ADX value (trend strength)
        atr: ATR value (volatility)
        volatility: Recent volatility percentage
        signals: List of signals that contributed to regime classification
    """

    regime: MarketRegimeEnum = Field(..., description="Market regime classification")
    strength: float = Field(..., ge=0, le=1, description="Regime strength (0.0-1.0)")
    ema_20: float = Field(..., gt=0, description="20-period EMA")
    ema_50: float = Field(..., gt=0, description="50-period EMA")
    ema_200: float = Field(..., gt=0, description="200-period EMA")
    rsi: float = Field(..., ge=0, le=100, description="RSI value")
    adx: float = Field(..., ge=0, le=100, description="ADX value")
    atr: float = Field(..., gt=0, description="ATR value")
    volatility: float = Field(..., ge=0, description="Recent volatility percentage")
    signals: List[str] = Field(
        default_factory=list, description="Signals explaining the regime classification"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "regime": "BULL_MARKET",
                    "strength": 0.78,
                    "ema_20": 21500.0,
                    "ema_50": 21300.0,
                    "ema_200": 21000.0,
                    "rsi": 62.5,
                    "adx": 32.4,
                    "atr": 245.5,
                    "volatility": 1.2,
                    "signals": [
                        "Price above all EMAs (bullish alignment)",
                        "Strong uptrend (ADX > 25)",
                        "RSI in bullish range (50-70)",
                        "Low volatility (< 2%)",
                    ],
                },
                {
                    "regime": "BEAR_MARKET",
                    "strength": 0.82,
                    "ema_20": 21000.0,
                    "ema_50": 21200.0,
                    "ema_200": 21500.0,
                    "rsi": 35.2,
                    "adx": 38.1,
                    "atr": 325.8,
                    "volatility": 1.8,
                    "signals": [
                        "Price below all EMAs (bearish alignment)",
                        "Strong downtrend (ADX > 25)",
                        "RSI in bearish range (< 40)",
                        "Moderate volatility",
                    ],
                },
                {
                    "regime": "SIDEWAYS",
                    "strength": 0.65,
                    "ema_20": 21250.0,
                    "ema_50": 21240.0,
                    "ema_200": 21220.0,
                    "rsi": 48.5,
                    "adx": 18.2,
                    "atr": 180.3,
                    "volatility": 0.9,
                    "signals": [
                        "EMAs clustered together (< 2% range)",
                        "Weak trend (ADX < 25)",
                        "RSI near neutral (40-60)",
                        "Low volatility",
                    ],
                },
                {
                    "regime": "VOLATILE",
                    "strength": 0.88,
                    "ema_20": 21350.0,
                    "ema_50": 21300.0,
                    "ema_200": 21400.0,
                    "rsi": 52.1,
                    "adx": 22.5,
                    "atr": 420.7,
                    "volatility": 3.2,
                    "signals": [
                        "High volatility (> 2.5%)",
                        "Large ATR relative to price",
                        "Choppy price action",
                        "Mixed EMA signals",
                    ],
                },
            ]
        }
    }



class OptionsChainRequest(BaseModel):
    """
    Request model for POST /quant/options/chain endpoint.
    
    Accepts an options chain with symbol and expiry information,
    processes all contracts to calculate Greeks and apply liquidity filtering.
    
    Attributes:
        symbol: Underlying symbol (NIFTY or BANKNIFTY only)
        expiry: Expiry date of the options contracts
        spot_price: Current spot price of the underlying
        risk_free_rate: Risk-free interest rate (default: 0.07)
        contracts: List of option contract data
    """
    symbol: str = Field(..., description="Underlying symbol (NIFTY or BANKNIFTY)")
    expiry: datetime = Field(..., description="Expiry date of options contracts")
    spot_price: float = Field(..., gt=0, description="Current spot price of underlying")
    risk_free_rate: float = Field(
        default=0.07,
        ge=0,
        le=0.25,
        description="Risk-free interest rate (default: 0.07 for 7%)"
    )
    contracts: List["OptionsChainContractRequest"] = Field(
        ..., min_length=1, description="List of option contracts in the chain"
    )
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "symbol": "NIFTY",
                    "expiry": "2024-12-26T00:00:00Z",
                    "spot_price": 21500.0,
                    "risk_free_rate": 0.07,
                    "contracts": [
                        {
                            "strike_price": 21400.0,
                            "option_type": "CALL",
                            "volatility": 0.15,
                            "ltp": 120.0,
                            "open_interest": 10000,
                            "volume": 5000,
                            "bid": 118.0,
                            "ask": 122.0
                        },
                        {
                            "strike_price": 21400.0,
                            "option_type": "PUT",
                            "volatility": 0.15,
                            "ltp": 85.0,
                            "open_interest": 12000,
                            "volume": 6000,
                            "bid": 83.0,
                            "ask": 87.0
                        }
                    ]
                }
            ]
        }
    }


class OptionsChainContractRequest(BaseModel):
    """
    Individual option contract data for options chain request.
    
    Attributes:
        strike_price: Strike price of the option
        option_type: Type of option (CALL or PUT)
        volatility: Implied volatility
        ltp: Last traded price
        open_interest: Current open interest
        volume: Trading volume
        bid: Bid price (optional)
        ask: Ask price (optional)
    """
    strike_price: float = Field(..., gt=0, description="Strike price")
    option_type: OptionType = Field(..., description="Option type (CALL or PUT)")
    volatility: float = Field(..., gt=0, le=2.0, description="Implied volatility")
    ltp: float = Field(..., ge=0, description="Last traded price")
    open_interest: int = Field(..., ge=0, description="Current open interest")
    volume: int = Field(..., ge=0, description="Trading volume")
    bid: Optional[float] = Field(default=None, ge=0, description="Bid price")
    ask: Optional[float] = Field(default=None, ge=0, description="Ask price")
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "strike_price": 21500.0,
                    "option_type": "CALL",
                    "volatility": 0.15,
                    "ltp": 100.0,
                    "open_interest": 10000,
                    "volume": 5000,
                    "bid": 98.0,
                    "ask": 102.0
                }
            ]
        }
    }


class LiquidityWarning(str, Enum):
    """Liquidity warning level enumeration."""
    NONE = "NONE"
    LOW_VOLUME = "LOW_VOLUME"
    LOW_OI = "LOW_OI"
    WIDE_SPREAD = "WIDE_SPREAD"
    ILLIQUID = "ILLIQUID"


class OptionsChainContractResult(BaseModel):
    """
    Result model for a single option contract with Greeks and liquidity data.
    
    Attributes:
        strike_price: Strike price of the option
        option_type: Type of option (CALL or PUT)
        ltp: Last traded price
        open_interest: Current open interest
        volume: Trading volume
        bid: Bid price
        ask: Ask price
        greeks: Calculated Greeks (Delta, Gamma, Theta, Vega)
        iv: Implied volatility
        liquidity_warnings: List of liquidity warning types
        is_liquid: Whether contract meets minimum liquidity threshold
    """
    strike_price: float = Field(..., description="Strike price")
    option_type: OptionType = Field(..., description="Option type")
    ltp: float = Field(..., description="Last traded price")
    open_interest: int = Field(..., description="Current open interest")
    volume: int = Field(..., description="Trading volume")
    bid: Optional[float] = Field(default=None, description="Bid price")
    ask: Optional[float] = Field(default=None, description="Ask price")
    greeks: dict = Field(..., description="Calculated Greeks (delta, gamma, theta, vega)")
    iv: float = Field(..., description="Implied volatility")
    liquidity_warnings: List[LiquidityWarning] = Field(
        default_factory=list, description="Liquidity warning flags"
    )
    is_liquid: bool = Field(..., description="Whether contract meets liquidity threshold")
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "strike_price": 21500.0,
                    "option_type": "CALL",
                    "ltp": 100.0,
                    "open_interest": 10000,
                    "volume": 5000,
                    "bid": 98.0,
                    "ask": 102.0,
                    "greeks": {
                        "delta": 0.52,
                        "gamma": 0.003,
                        "theta": -12.5,
                        "vega": 45.2
                    },
                    "iv": 0.15,
                    "liquidity_warnings": [],
                    "is_liquid": True
                }
            ]
        }
    }


class OptionsChainData(BaseModel):
    """
    Complete options chain result with all contracts, Greeks, and liquidity analysis.
    
    This is the main response model for POST /quant/options/chain endpoint.
    
    Attributes:
        symbol: Underlying symbol
        expiry: Expiry date
        spot_price: Current spot price
        timestamp: Analysis timestamp
        total_contracts: Total number of contracts processed
        liquid_contracts: Number of liquid contracts
        illiquid_contracts: Number of illiquid contracts
        contracts: List of all contracts with Greeks and liquidity data
    """
    symbol: str = Field(..., description="Underlying symbol")
    expiry: datetime = Field(..., description="Expiry date")
    spot_price: float = Field(..., description="Current spot price")
    timestamp: datetime = Field(..., description="Analysis timestamp")
    total_contracts: int = Field(..., description="Total contracts processed")
    liquid_contracts: int = Field(..., description="Number of liquid contracts")
    illiquid_contracts: int = Field(..., description="Number of illiquid contracts")
    contracts: List[OptionsChainContractResult] = Field(
        ..., description="All contracts with Greeks and liquidity data"
    )
    
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "symbol": "NIFTY",
                    "expiry": "2024-12-26T00:00:00Z",
                    "spot_price": 21500.0,
                    "timestamp": "2024-12-20T10:30:00Z",
                    "total_contracts": 100,
                    "liquid_contracts": 85,
                    "illiquid_contracts": 15,
                    "contracts": [
                        {
                            "strike_price": 21500.0,
                            "option_type": "CALL",
                            "ltp": 100.0,
                            "open_interest": 10000,
                            "volume": 5000,
                            "bid": 98.0,
                            "ask": 102.0,
                            "greeks": {
                                "delta": 0.52,
                                "gamma": 0.003,
                                "theta": -12.5,
                                "vega": 45.2
                            },
                            "iv": 0.15,
                            "liquidity_warnings": [],
                            "is_liquid": True
                        }
                    ]
                }
            ]
        }
    }
