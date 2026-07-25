"""
Intraday Trading Analysis Models.

This module defines Pydantic models for intraday trading analysis,
including request/response structures, technical indicators, and
trading recommendations for same-day position trading.

Requirements: 6.1, 6.2
"""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from enum import Enum
from datetime import datetime


class IntradayInterval(str, Enum):
    """Supported intraday timeframe intervals."""

    ONE_MINUTE = "1m"
    FIVE_MINUTES = "5m"
    FIFTEEN_MINUTES = "15m"
    THIRTY_MINUTES = "30m"
    ONE_HOUR = "1h"


class IntradaySignal(str, Enum):
    """Trading signal types for intraday trading."""

    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"
    NO_TRADE = "NO_TRADE"


class IntradayAnalysisRequest(BaseModel):
    """
    Request model for intraday analysis.

    Attributes:
        symbol: Stock trading symbol (e.g., 'RELIANCE', 'TCS')
        interval: Timeframe interval (1m, 5m, 15m, 30m, 1h)
        user_id: Optional user ID for personalized analysis
    """

    symbol: str = Field(
        ...,
        min_length=1,
        max_length=20,
        description="Stock trading symbol",
        pattern=r"^[A-Z0-9]+$",
    )
    interval: IntradayInterval = Field(
        ..., description="Timeframe interval for analysis"
    )
    user_id: Optional[str] = Field(None, description="User ID for personalized analysis")

    @field_validator("symbol")
    @classmethod
    def validate_symbol_uppercase(cls, v: str) -> str:
        """Ensure symbol is uppercase."""
        return v.upper()

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "symbol": "RELIANCE",
                    "interval": "5m",
                    "user_id": "user123",
                }
            ]
        }
    }


class DataFreshness(BaseModel):
    """
    Data freshness tracking information.

    Tracks when data was last updated and whether it's still fresh
    enough for intraday trading decisions.

    Attributes:
        timestamp: When the data was last updated (ISO 8601 format)
        age_seconds: Age of data in seconds since last update
        is_stale: True if data exceeds freshness threshold
    """

    timestamp: str = Field(
        ..., description="Data timestamp in ISO 8601 format"
    )
    age_seconds: float = Field(
        ..., ge=0.0, description="Age of data in seconds"
    )
    is_stale: bool = Field(
        ..., description="True if data is older than acceptable threshold"
    )

    @field_validator("timestamp")
    @classmethod
    def validate_timestamp_format(cls, v: str) -> str:
        """Validate ISO 8601 timestamp format."""
        try:
            datetime.fromisoformat(v.replace("Z", "+00:00"))
        except ValueError:
            raise ValueError(f"timestamp must be in ISO 8601 format, got: {v}")
        return v

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "timestamp": "2024-01-15T10:30:00Z",
                    "age_seconds": 15.5,
                    "is_stale": False,
                }
            ]
        }
    }


class MACDIndicator(BaseModel):
    """MACD indicator values."""

    value: float = Field(..., description="MACD line value")
    signal: float = Field(..., description="Signal line value")
    histogram: float = Field(..., description="MACD histogram value")


class BollingerBands(BaseModel):
    """Bollinger Bands indicator values."""

    upper: float = Field(..., gt=0, description="Upper band")
    middle: float = Field(..., gt=0, description="Middle band (SMA)")
    lower: float = Field(..., gt=0, description="Lower band")

    @field_validator("upper")
    @classmethod
    def validate_upper_band(cls, v: float, info) -> float:
        """Ensure upper band is above middle band."""
        if hasattr(info, "data") and "middle" in info.data:
            middle = info.data["middle"]
            if v <= middle:
                raise ValueError(
                    f"upper band ({v}) must be greater than middle band ({middle})"
                )
        return v

    @field_validator("lower")
    @classmethod
    def validate_lower_band(cls, v: float, info) -> float:
        """Ensure lower band is below middle band."""
        if hasattr(info, "data") and "middle" in info.data:
            middle = info.data["middle"]
            if v >= middle:
                raise ValueError(
                    f"lower band ({v}) must be less than middle band ({middle})"
                )
        return v


class IntradayTechnicalAnalysis(BaseModel):
    """
    Technical analysis indicators for intraday trading.

    All indicators are calculated from intraday timeframe data
    and optimized for same-day trading decisions.

    Attributes:
        rsi: Relative Strength Index (0-100)
        macd: MACD indicator values
        ema_9: 9-period Exponential Moving Average
        ema_21: 21-period Exponential Moving Average
        ema_50: 50-period Exponential Moving Average
        vwap: Volume Weighted Average Price
        atr: Average True Range (volatility measure)
        volume: Current period volume
        relative_volume: Volume relative to average (1.0 = average)
        bollinger_bands: Bollinger Bands values
        support_levels: Key support price levels
        resistance_levels: Key resistance price levels
    """

    rsi: float = Field(..., ge=0.0, le=100.0, description="RSI (0-100)")
    macd: MACDIndicator = Field(..., description="MACD indicator")
    ema_9: float = Field(..., gt=0, description="9-period EMA")
    ema_21: float = Field(..., gt=0, description="21-period EMA")
    ema_50: float = Field(..., gt=0, description="50-period EMA")
    vwap: float = Field(..., gt=0, description="Volume Weighted Average Price")
    atr: float = Field(..., gt=0, description="Average True Range")
    volume: int = Field(..., ge=0, description="Current volume")
    relative_volume: float = Field(
        ..., ge=0.0, description="Relative volume (1.0 = average)"
    )
    bollinger_bands: BollingerBands = Field(..., description="Bollinger Bands")
    support_levels: List[float] = Field(
        default_factory=list, description="Support price levels"
    )
    resistance_levels: List[float] = Field(
        default_factory=list, description="Resistance price levels"
    )

    @field_validator("support_levels")
    @classmethod
    def validate_support_levels(cls, v: List[float]) -> List[float]:
        """Ensure support levels are positive and sorted."""
        if not all(level > 0 for level in v):
            raise ValueError("all support levels must be positive")
        # Sort in ascending order
        return sorted(v)

    @field_validator("resistance_levels")
    @classmethod
    def validate_resistance_levels(cls, v: List[float]) -> List[float]:
        """Ensure resistance levels are positive and sorted."""
        if not all(level > 0 for level in v):
            raise ValueError("all resistance levels must be positive")
        # Sort in ascending order
        return sorted(v)

    model_config = {
        "json_schema_extra": {
            "examples": [
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
                        "lower": 2440.0,
                    },
                    "support_levels": [2430.0, 2445.0],
                    "resistance_levels": [2475.0, 2490.0],
                }
            ]
        }
    }


class IntradayRecommendation(BaseModel):
    """
    Complete intraday trading recommendation.

    Includes trading signal, entry/exit levels, risk metrics,
    and human-readable rationale for the recommendation.

    Attributes:
        signal: Trading signal (BUY, SELL, HOLD, NO_TRADE)
        confidence: Confidence level (0.0 to 1.0)
        entry: Suggested entry price
        stop_loss: Suggested stop loss price
        target: Suggested target price
        risk_reward: Risk/reward ratio (e.g., 2.0 means 2:1)
        rationale: Human-readable explanation
        is_stale: True if based on stale data
        valid_until: Optional expiration timestamp
        warnings: Optional warnings about data quality
    """

    signal: IntradaySignal = Field(..., description="Trading signal")
    confidence: float = Field(
        ..., ge=0.0, le=1.0, description="Confidence level (0.0-1.0)"
    )
    entry: float = Field(..., gt=0, description="Suggested entry price")
    stop_loss: float = Field(..., gt=0, description="Suggested stop loss price")
    target: float = Field(..., gt=0, description="Suggested target price")
    risk_reward: float = Field(
        ..., gt=0, description="Risk/reward ratio (e.g., 2.0 = 2:1)"
    )
    rationale: str = Field(
        ..., min_length=1, max_length=1000, description="Recommendation rationale"
    )
    is_stale: bool = Field(
        ..., description="True if recommendation based on stale data"
    )
    valid_until: Optional[str] = Field(
        None, description="Expiration timestamp (ISO 8601)"
    )
    warnings: List[str] = Field(
        default_factory=list, description="Data quality or market warnings"
    )

    @field_validator("stop_loss")
    @classmethod
    def validate_stop_loss(cls, v: float, info) -> float:
        """Ensure stop loss is appropriate for signal type."""
        if hasattr(info, "data") and "entry" in info.data and "signal" in info.data:
            entry = info.data["entry"]
            signal = info.data["signal"]

            # For BUY signals, stop loss should be below entry
            if signal == IntradaySignal.BUY and v >= entry:
                raise ValueError(
                    f"For BUY signal, stop_loss ({v}) must be below entry ({entry})"
                )

            # For SELL signals, stop loss should be above entry
            if signal == IntradaySignal.SELL and v <= entry:
                raise ValueError(
                    f"For SELL signal, stop_loss ({v}) must be above entry ({entry})"
                )

        return v

    @field_validator("target")
    @classmethod
    def validate_target(cls, v: float, info) -> float:
        """Ensure target is appropriate for signal type."""
        if hasattr(info, "data") and "entry" in info.data and "signal" in info.data:
            entry = info.data["entry"]
            signal = info.data["signal"]

            # For BUY signals, target should be above entry
            if signal == IntradaySignal.BUY and v <= entry:
                raise ValueError(
                    f"For BUY signal, target ({v}) must be above entry ({entry})"
                )

            # For SELL signals, target should be below entry
            if signal == IntradaySignal.SELL and v >= entry:
                raise ValueError(
                    f"For SELL signal, target ({v}) must be below entry ({entry})"
                )

        return v

    @field_validator("risk_reward")
    @classmethod
    def validate_risk_reward(cls, v: float, info) -> float:
        """Validate calculated risk/reward matches entry/stop/target."""
        if hasattr(info, "data"):
            data = info.data
            if all(k in data for k in ["entry", "stop_loss", "target"]):
                entry = data["entry"]
                stop_loss = data["stop_loss"]
                target = data["target"]

                # Calculate expected risk/reward
                risk = abs(entry - stop_loss)
                reward = abs(target - entry)

                if risk > 0:
                    expected_rr = reward / risk
                    # Allow small floating point differences
                    if abs(v - expected_rr) > 0.1:
                        raise ValueError(
                            f"Risk/reward ({v:.2f}) doesn't match "
                            f"calculated value ({expected_rr:.2f}) from "
                            f"entry={entry}, stop={stop_loss}, target={target}"
                        )

        return v

    @field_validator("valid_until")
    @classmethod
    def validate_valid_until(cls, v: Optional[str]) -> Optional[str]:
        """Validate ISO 8601 timestamp format for valid_until."""
        if v is not None:
            try:
                datetime.fromisoformat(v.replace("Z", "+00:00"))
            except ValueError:
                raise ValueError(f"valid_until must be in ISO 8601 format, got: {v}")
        return v

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "signal": "BUY",
                    "confidence": 0.75,
                    "entry": 2460.0,
                    "stop_loss": 2445.0,
                    "target": 2490.0,
                    "risk_reward": 2.0,
                    "rationale": "Strong upward momentum with RSI in bullish zone and price above VWAP",
                    "is_stale": False,
                    "valid_until": "2024-01-15T15:30:00Z",
                    "warnings": [],
                }
            ]
        }
    }


class IntradayAnalysisResult(BaseModel):
    """
    Complete intraday analysis result.

    Contains all data needed for intraday trading decisions including
    technical analysis, data freshness tracking, scoring, and trading recommendation.

    Attributes:
        symbol: Stock trading symbol
        interval: Timeframe interval used
        timestamp: When analysis was performed
        data_freshness: Data freshness tracking
        technical_analysis: Technical indicators
        current_price: Current market price
        price_change: Absolute price change
        price_change_percent: Percentage price change
        recommendation: Trading recommendation
        opening_range: Optional opening range analysis
        prev_day_levels: Optional previous day levels analysis
    """

    symbol: str = Field(..., min_length=1, max_length=20, description="Stock symbol")
    interval: IntradayInterval = Field(..., description="Timeframe interval")
    timestamp: str = Field(
        ..., description="Analysis timestamp (ISO 8601)"
    )
    data_freshness: DataFreshness = Field(..., description="Data freshness tracking")
    technical_analysis: IntradayTechnicalAnalysis = Field(
        ..., description="Technical indicators"
    )
    current_price: float = Field(..., gt=0, description="Current market price")
    price_change: float = Field(..., description="Absolute price change")
    price_change_percent: float = Field(..., description="Percentage price change")
    recommendation: IntradayRecommendation = Field(
        ..., description="Trading recommendation"
    )
    opening_range: Optional["OpeningRangeResult"] = Field(
        None, description="Optional opening range analysis"
    )
    prev_day_levels: Optional["PreviousDayLevelsResult"] = Field(
        None, description="Optional previous day levels analysis"
    )

    @field_validator("timestamp")
    @classmethod
    def validate_timestamp_format(cls, v: str) -> str:
        """Validate ISO 8601 timestamp format."""
        try:
            datetime.fromisoformat(v.replace("Z", "+00:00"))
        except ValueError:
            raise ValueError(f"timestamp must be in ISO 8601 format, got: {v}")
        return v

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "symbol": "RELIANCE",
                    "interval": "5m",
                    "timestamp": "2024-01-15T10:30:00Z",
                    "data_freshness": {
                        "timestamp": "2024-01-15T10:30:00Z",
                        "age_seconds": 15.5,
                        "is_stale": False,
                    },
                    "technical_analysis": {
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
                            "lower": 2440.0,
                        },
                        "support_levels": [2430.0, 2445.0],
                        "resistance_levels": [2475.0, 2490.0],
                    },
                    "current_price": 2460.0,
                    "price_change": 15.5,
                    "price_change_percent": 0.63,
                    "recommendation": {
                        "signal": "BUY",
                        "confidence": 0.75,
                        "entry": 2460.0,
                        "stop_loss": 2445.0,
                        "target": 2490.0,
                        "risk_reward": 2.0,
                        "rationale": "Strong upward momentum with RSI in bullish zone",
                        "is_stale": False,
                        "valid_until": "2024-01-15T15:30:00Z",
                        "warnings": [],
                    },
                }
            ]
        }
    }


class BreakoutStatus(str, Enum):
    """Breakout status for opening range analysis."""

    BREAKOUT_ABOVE = "BREAKOUT_ABOVE"
    BREAKDOWN_BELOW = "BREAKDOWN_BELOW"
    NO_BREAKOUT = "NO_BREAKOUT"


class OpeningRangeResult(BaseModel):
    """
    Opening range analysis result.

    The opening range is defined as the high/low of the first N minutes
    of trading. Breakouts above or below this range can signal trading
    opportunities.

    Attributes:
        high: Opening range high
        low: Opening range low
        midpoint: Opening range midpoint
        range_size: Absolute size of the opening range
        range_percent: Range size as percentage of midpoint
        breakout_status: Breakout status (BREAKOUT_ABOVE, BREAKDOWN_BELOW, NO_BREAKOUT)
        current_price: Current price used for breakout detection
        breakout_distance: Distance from breakout level as percentage (optional)
        volume_confirmed: Whether breakout is confirmed by volume
        volume_ratio: Current volume relative to average (1.0 = average)
    """

    high: float = Field(..., gt=0, description="Opening range high")
    low: float = Field(..., gt=0, description="Opening range low")
    midpoint: float = Field(..., gt=0, description="Opening range midpoint")
    range_size: float = Field(..., ge=0, description="Opening range size")
    range_percent: float = Field(..., ge=0, description="Range size as % of midpoint")
    breakout_status: BreakoutStatus = Field(..., description="Breakout status")
    current_price: float = Field(..., gt=0, description="Current price")
    breakout_distance: Optional[float] = Field(
        None, description="Breakout distance as percentage"
    )
    volume_confirmed: bool = Field(..., description="Volume confirmation status")
    volume_ratio: float = Field(..., ge=0, description="Volume ratio")

    @field_validator("high")
    @classmethod
    def validate_high_above_low(cls, v: float, info) -> float:
        """Ensure high >= low."""
        if hasattr(info, "data") and "low" in info.data:
            low = info.data["low"]
            if v < low:
                raise ValueError(f"high ({v}) must be >= low ({low})")
        return v

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "high": 2470.0,
                    "low": 2450.0,
                    "midpoint": 2460.0,
                    "range_size": 20.0,
                    "range_percent": 0.81,
                    "breakout_status": "BREAKOUT_ABOVE",
                    "current_price": 2475.0,
                    "breakout_distance": 0.20,
                    "volume_confirmed": True,
                    "volume_ratio": 1.35,
                }
            ]
        }
    }


class BreachStatus(str, Enum):
    """Breach status for previous day levels."""

    ABOVE_HIGH = "ABOVE_HIGH"
    BELOW_LOW = "BELOW_LOW"
    WITHIN_RANGE = "WITHIN_RANGE"


class GapType(str, Enum):
    """Gap type classification."""

    GAP_UP = "GAP_UP"
    GAP_DOWN = "GAP_DOWN"
    NO_GAP = "NO_GAP"


class PreviousDayLevelsResult(BaseModel):
    """
    Previous day levels analysis result.

    Tracks previous trading day's high, low, close and detects
    when current price breaches these levels.

    Attributes:
        prev_day_high: Previous trading day high
        prev_day_low: Previous trading day low
        prev_day_close: Previous trading day close
        gap_percent: Gap percentage (current open vs previous close)
        gap_type: Gap classification (GAP_UP, GAP_DOWN, NO_GAP)
        breach_status: Current breach status
        current_price: Current price
        distance_from_high_percent: Distance from prev high as %
        distance_from_low_percent: Distance from prev low as %
        breach_significance: Breach significance score (0.0-1.0)
    """

    prev_day_high: float = Field(..., gt=0, description="Previous day high")
    prev_day_low: float = Field(..., gt=0, description="Previous day low")
    prev_day_close: float = Field(..., gt=0, description="Previous day close")
    gap_percent: float = Field(..., description="Gap percentage")
    gap_type: GapType = Field(..., description="Gap type")
    breach_status: BreachStatus = Field(..., description="Breach status")
    current_price: float = Field(..., gt=0, description="Current price")
    distance_from_high_percent: float = Field(
        ..., description="Distance from prev high as %"
    )
    distance_from_low_percent: float = Field(
        ..., description="Distance from prev low as %"
    )
    breach_significance: float = Field(
        ..., ge=0.0, le=1.0, description="Breach significance (0.0-1.0)"
    )

    @field_validator("prev_day_high")
    @classmethod
    def validate_prev_high_above_low(cls, v: float, info) -> float:
        """Ensure prev_day_high >= prev_day_low."""
        if hasattr(info, "data") and "prev_day_low" in info.data:
            low = info.data["prev_day_low"]
            if v < low:
                raise ValueError(f"prev_day_high ({v}) must be >= prev_day_low ({low})")
        return v

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "prev_day_high": 2500.0,
                    "prev_day_low": 2450.0,
                    "prev_day_close": 2480.0,
                    "gap_percent": 0.81,
                    "gap_type": "GAP_UP",
                    "breach_status": "ABOVE_HIGH",
                    "current_price": 2510.0,
                    "distance_from_high_percent": 0.40,
                    "distance_from_low_percent": 2.45,
                    "breach_significance": 0.75,
                }
            ]
        }
    }


class VWAPPosition(str, Enum):
    """Price position relative to VWAP."""

    ABOVE = "ABOVE"
    BELOW = "BELOW"
    AT = "AT"


class EMACrossover(str, Enum):
    """EMA crossover status."""

    BULLISH = "BULLISH"  # Fast EMA crossed above slow EMA
    BEARISH = "BEARISH"  # Fast EMA crossed below slow EMA
    NONE = "NONE"  # No recent crossover


class TrendStrength(str, Enum):
    """Intraday trend strength classification."""

    STRONG_BULLISH = "STRONG_BULLISH"
    WEAK_BULLISH = "WEAK_BULLISH"
    NEUTRAL = "NEUTRAL"
    WEAK_BEARISH = "WEAK_BEARISH"
    STRONG_BEARISH = "STRONG_BEARISH"


class PriceActionResult(BaseModel):
    """
    Intraday price action analysis result.

    Analyzes current price action including position relative to VWAP,
    EMA crossovers, RSI momentum, and overall trend strength.

    Attributes:
        current_price: Current market price
        vwap: Volume Weighted Average Price
        vwap_position: Price position relative to VWAP (ABOVE/BELOW/AT)
        vwap_distance_percent: Distance from VWAP as percentage
        ema_fast: Fast EMA value (9-period)
        ema_slow: Slow EMA value (21-period)
        ema_crossover: EMA crossover status (BULLISH/BEARISH/NONE)
        ema_alignment: Whether EMAs are aligned with trend (fast > slow for uptrend)
        rsi: Current RSI value
        rsi_divergence_detected: Whether RSI divergence is detected
        rsi_trend: RSI trend direction (RISING/FALLING/NEUTRAL)
        trend_strength: Overall intraday trend strength classification
        trend_score: Numerical trend strength score (0-100)
        momentum_score: Momentum score based on RSI and MACD (0-100)
        signals: List of human-readable price action signals
    """

    current_price: float = Field(..., gt=0, description="Current market price")
    vwap: float = Field(..., gt=0, description="Volume Weighted Average Price")
    vwap_position: VWAPPosition = Field(
        ..., description="Price position relative to VWAP"
    )
    vwap_distance_percent: float = Field(
        ..., description="Distance from VWAP as percentage"
    )
    ema_fast: float = Field(..., gt=0, description="Fast EMA (9-period)")
    ema_slow: float = Field(..., gt=0, description="Slow EMA (21-period)")
    ema_crossover: EMACrossover = Field(..., description="EMA crossover status")
    ema_alignment: bool = Field(
        ..., description="Whether EMAs are aligned with trend"
    )
    rsi: float = Field(..., ge=0, le=100, description="Current RSI value")
    rsi_divergence_detected: bool = Field(
        ..., description="Whether RSI divergence is detected"
    )
    rsi_trend: str = Field(..., description="RSI trend (RISING/FALLING/NEUTRAL)")
    trend_strength: TrendStrength = Field(
        ..., description="Overall trend strength classification"
    )
    trend_score: float = Field(
        ..., ge=0, le=100, description="Trend strength score (0-100)"
    )
    momentum_score: float = Field(
        ..., ge=0, le=100, description="Momentum score (0-100)"
    )
    signals: List[str] = Field(
        default_factory=list, description="Human-readable price action signals"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "current_price": 2465.0,
                    "vwap": 2458.0,
                    "vwap_position": "ABOVE",
                    "vwap_distance_percent": 0.28,
                    "ema_fast": 2465.0,
                    "ema_slow": 2460.0,
                    "ema_crossover": "BULLISH",
                    "ema_alignment": True,
                    "rsi": 58.5,
                    "rsi_divergence_detected": False,
                    "rsi_trend": "RISING",
                    "trend_strength": "WEAK_BULLISH",
                    "trend_score": 65.0,
                    "momentum_score": 70.0,
                    "signals": [
                        "Price trading above VWAP (+0.28%)",
                        "Bullish EMA crossover detected",
                        "RSI in bullish zone (58.5)",
                        "Momentum strengthening",
                    ],
                }
            ]
        }
    }


# Rebuild models to resolve forward references
IntradayAnalysisResult.model_rebuild()
