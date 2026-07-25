"""
Breakout/Breakdown detector for the Quant Engine.

This module provides detection of resistance breakouts and support breakdowns
with volume confirmation, consolidation range identification, and breakout
strength scoring.
"""

from typing import List, Optional
from pydantic import BaseModel, Field
from enum import Enum
from models import OHLCVData, TrendlineResult
from calculators.volume_analysis import calculate_volume_ma


class BreakoutType(str, Enum):
    """Type of breakout detected."""

    RESISTANCE_BREAKOUT = "RESISTANCE_BREAKOUT"
    SUPPORT_BREAKDOWN = "SUPPORT_BREAKDOWN"
    NO_BREAKOUT = "NO_BREAKOUT"


class RetestType(str, Enum):
    """Type of retest detected."""

    RESISTANCE_TO_SUPPORT = "RESISTANCE_TO_SUPPORT"
    SUPPORT_TO_RESISTANCE = "SUPPORT_TO_RESISTANCE"
    NO_RETEST = "NO_RETEST"


class ConsolidationRange(BaseModel):
    """Represents a price consolidation range."""

    upper_bound: float = Field(
        ..., gt=0, description="Upper bound of consolidation range"
    )
    lower_bound: float = Field(
        ..., gt=0, description="Lower bound of consolidation range"
    )
    range_size: float = Field(..., ge=0, description="Size of range (upper - lower)")
    range_percent: float = Field(
        ..., ge=0, description="Range as percentage of midpoint"
    )
    start_index: int = Field(..., ge=0, description="Index where consolidation starts")
    end_index: int = Field(..., ge=0, description="Index where consolidation ends")
    duration: int = Field(..., gt=0, description="Number of bars in consolidation")
    is_tight: bool = Field(..., description="Whether range is tight (< 3% range)")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "upper_bound": 105.0,
                    "lower_bound": 100.0,
                    "range_size": 5.0,
                    "range_percent": 4.88,
                    "start_index": 10,
                    "end_index": 25,
                    "duration": 15,
                    "is_tight": False,
                }
            ]
        }
    }


class BreakoutResult(BaseModel):
    """Result of breakout detection."""

    breakout_type: BreakoutType = Field(..., description="Type of breakout detected")
    confirmed: bool = Field(..., description="Whether breakout is confirmed by volume")
    volume_ratio: float = Field(
        ..., ge=0, description="Ratio of breakout volume to average volume"
    )
    breakout_index: Optional[int] = Field(
        None, ge=0, description="Index in data where breakout occurred"
    )
    breakout_price: Optional[float] = Field(
        None, gt=0, description="Price at which breakout occurred"
    )
    trendline_price: Optional[float] = Field(
        None, gt=0, description="Trendline price at breakout point"
    )
    strength_score: float = Field(
        0.0, ge=0, le=100, description="Breakout strength score (0-100)"
    )
    consolidation: Optional[ConsolidationRange] = Field(
        None, description="Consolidation range before breakout"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "breakout_type": "RESISTANCE_BREAKOUT",
                    "confirmed": True,
                    "volume_ratio": 1.5,
                    "breakout_index": 25,
                    "breakout_price": 110.0,
                    "trendline_price": 108.0,
                    "strength_score": 75.0,
                    "consolidation": {
                        "upper_bound": 108.0,
                        "lower_bound": 103.0,
                        "range_size": 5.0,
                        "range_percent": 4.74,
                        "start_index": 10,
                        "end_index": 24,
                        "duration": 14,
                        "is_tight": False,
                    },
                }
            ]
        }
    }


class RetestResult(BaseModel):
    """Result of retest detection."""

    retest_type: RetestType = Field(..., description="Type of retest detected")
    detected: bool = Field(..., description="Whether a retest was detected")
    confidence: float = Field(
        ..., ge=0, le=1, description="Confidence score for the retest (0-1)"
    )
    distance_percent: float = Field(
        ..., ge=0, description="Distance from breakout level as percentage"
    )
    retest_index: Optional[int] = Field(
        None, ge=0, description="Index in data where retest occurred"
    )
    retest_price: Optional[float] = Field(
        None, gt=0, description="Price at which retest occurred"
    )
    level: Optional[float] = Field(
        None, gt=0, description="The breakout level being retested"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "retest_type": "RESISTANCE_TO_SUPPORT",
                    "detected": True,
                    "confidence": 0.85,
                    "distance_percent": 0.5,
                    "retest_index": 32,
                    "retest_price": 109.5,
                    "level": 110.0,
                }
            ]
        }
    }


def identify_consolidation_range(
    data: List[OHLCVData],
    lookback_bars: int = 20,
    range_threshold: float = 5.0,
) -> Optional[ConsolidationRange]:
    """
    Identify if price is consolidating within a range.

    A consolidation occurs when:
    - Price trades within a defined range for a sustained period
    - The range is relatively tight (< range_threshold %)

    Args:
        data: List of OHLCV data points (must be sorted by timestamp)
        lookback_bars: Number of bars to analyze for consolidation (default: 20)
        range_threshold: Maximum range as % of midpoint for consolidation (default: 5.0)

    Returns:
        ConsolidationRange if consolidation detected, None otherwise

    Raises:
        ValueError: If data is insufficient or parameters are invalid
    """
    if not data:
        raise ValueError("data cannot be empty")

    if lookback_bars < 2:
        raise ValueError("lookback_bars must be at least 2")

    if range_threshold <= 0:
        raise ValueError("range_threshold must be positive")

    if len(data) < lookback_bars:
        # Not enough data for consolidation detection
        return None

    # Analyze the most recent lookback_bars
    start_index = len(data) - lookback_bars
    end_index = len(data) - 1
    recent_data = data[start_index:]

    # Calculate range bounds
    highs = [bar.high for bar in recent_data]
    lows = [bar.low for bar in recent_data]

    upper_bound = max(highs)
    lower_bound = min(lows)
    range_size = upper_bound - lower_bound

    # Calculate range as percentage of midpoint
    midpoint = (upper_bound + lower_bound) / 2
    range_percent = (range_size / midpoint) * 100 if midpoint > 0 else 0.0

    # Check if range is tight enough to be consolidation
    if range_percent > range_threshold:
        return None

    # Determine if it's a tight range (< 3%)
    is_tight = range_percent < 3.0

    return ConsolidationRange(
        upper_bound=upper_bound,
        lower_bound=lower_bound,
        range_size=range_size,
        range_percent=range_percent,
        start_index=start_index,
        end_index=end_index,
        duration=lookback_bars,
        is_tight=is_tight,
    )


def calculate_breakout_strength(
    breakout_result: BreakoutResult,
    consolidation: Optional[ConsolidationRange],
    price_move_percent: float,
) -> float:
    """
    Calculate breakout strength score (0-100).

    Factors considered:
    - Volume confirmation (0-30 points)
    - Price move magnitude (0-25 points)
    - Consolidation tightness (0-25 points)
    - Consolidation duration (0-20 points)

    Args:
        breakout_result: The breakout detection result
        consolidation: Optional consolidation range before breakout
        price_move_percent: Percentage price move beyond trendline

    Returns:
        Strength score from 0 to 100
    """
    score = 0.0

    # Volume confirmation score (0-30 points)
    if breakout_result.confirmed:
        volume_score = min(30.0, (breakout_result.volume_ratio - 1.0) * 20)
        score += volume_score

    # Price move magnitude score (0-25 points)
    # Stronger breakouts move further from the trendline
    price_score = min(25.0, abs(price_move_percent) * 5)
    score += price_score

    # Consolidation factors (0-45 points total)
    if consolidation:
        # Tight consolidation score (0-25 points)
        if consolidation.is_tight:
            # Tighter consolidation = stronger potential breakout
            tightness_score = 25.0 - (consolidation.range_percent * 5)
            tightness_score = max(0.0, min(25.0, tightness_score))
            score += tightness_score
        else:
            # Non-tight consolidation gets partial credit
            tightness_score = 15.0 - (consolidation.range_percent * 2)
            tightness_score = max(0.0, min(15.0, tightness_score))
            score += tightness_score

        # Duration score (0-20 points)
        # Longer consolidation = stronger breakout potential
        duration_score = min(20.0, (consolidation.duration / 20) * 20)
        score += duration_score

    # Ensure score is within bounds
    return max(0.0, min(100.0, score))


def detect_resistance_breakout(
    data: List[OHLCVData],
    resistance_trendline: TrendlineResult,
    volume_period: int = 20,
    volume_threshold: float = 1.0,
    lookback_bars: int = 20,
) -> BreakoutResult:
    """
    Detect if price has broken above resistance trendline.

    A resistance breakout occurs when:
    - The close price is above the resistance trendline
    - Volume confirms the breakout (volume > average)

    Args:
        data: List of OHLCV data points (must be sorted by timestamp)
        resistance_trendline: Resistance trendline to check against
        volume_period: Period for volume average calculation (default: 20)
        volume_threshold: Minimum volume ratio for confirmation (default: 1.0)
        lookback_bars: Number of bars to check for consolidation (default: 20)

    Returns:
        BreakoutResult with detection details, consolidation, and strength score

    Raises:
        ValueError: If data is empty or insufficient for volume analysis
    """
    if not data:
        raise ValueError("data cannot be empty")

    if volume_period < 1:
        raise ValueError("volume_period must be at least 1")

    if volume_threshold <= 0:
        raise ValueError("volume_threshold must be positive")

    if len(data) < volume_period:
        raise ValueError(
            f"Insufficient data: need at least {volume_period} bars, "
            f"got {len(data)}"
        )

    # Get the latest data point
    latest_bar = data[-1]
    latest_index = len(data) - 1

    # Calculate resistance trendline price at the latest index
    trendline_price = (
        resistance_trendline.slope * latest_index + resistance_trendline.intercept
    )

    # Check if close price is above resistance
    if latest_bar.close <= trendline_price:
        return BreakoutResult(
            breakout_type=BreakoutType.NO_BREAKOUT,
            confirmed=False,
            volume_ratio=0.0,
            breakout_index=None,
            breakout_price=None,
            trendline_price=None,
            strength_score=0.0,
            consolidation=None,
        )

    # Calculate volume confirmation
    volumes = [bar.volume for bar in data]
    avg_volume = calculate_volume_ma(volumes, volume_period)
    volume_ratio = latest_bar.volume / avg_volume if avg_volume > 0 else 0.0

    # Check if volume confirms the breakout
    confirmed = volume_ratio >= volume_threshold

    # Detect consolidation before breakout
    consolidation = (
        identify_consolidation_range(data[:-1], lookback_bars)
        if len(data) > lookback_bars
        else None
    )

    # Calculate price move percentage
    price_move_percent = ((latest_bar.close - trendline_price) / trendline_price) * 100

    # Create initial result
    result = BreakoutResult(
        breakout_type=BreakoutType.RESISTANCE_BREAKOUT,
        confirmed=confirmed,
        volume_ratio=volume_ratio,
        breakout_index=latest_index,
        breakout_price=latest_bar.close,
        trendline_price=trendline_price,
        strength_score=0.0,
        consolidation=consolidation,
    )

    # Calculate strength score
    strength = calculate_breakout_strength(result, consolidation, price_move_percent)
    result.strength_score = strength

    return result


def detect_support_breakdown(
    data: List[OHLCVData],
    support_trendline: TrendlineResult,
    volume_period: int = 20,
    volume_threshold: float = 1.0,
    lookback_bars: int = 20,
) -> BreakoutResult:
    """
    Detect if price has broken below support trendline.

    A support breakdown occurs when:
    - The close price is below the support trendline
    - Volume confirms the breakdown (volume > average)

    Args:
        data: List of OHLCV data points (must be sorted by timestamp)
        support_trendline: Support trendline to check against
        volume_period: Period for volume average calculation (default: 20)
        volume_threshold: Minimum volume ratio for confirmation (default: 1.0)
        lookback_bars: Number of bars to check for consolidation (default: 20)

    Returns:
        BreakoutResult with detection details, consolidation, and strength score

    Raises:
        ValueError: If data is empty or insufficient for volume analysis
    """
    if not data:
        raise ValueError("data cannot be empty")

    if volume_period < 1:
        raise ValueError("volume_period must be at least 1")

    if volume_threshold <= 0:
        raise ValueError("volume_threshold must be positive")

    if len(data) < volume_period:
        raise ValueError(
            f"Insufficient data: need at least {volume_period} bars, "
            f"got {len(data)}"
        )

    # Get the latest data point
    latest_bar = data[-1]
    latest_index = len(data) - 1

    # Calculate support trendline price at the latest index
    trendline_price = (
        support_trendline.slope * latest_index + support_trendline.intercept
    )

    # Check if close price is below support
    if latest_bar.close >= trendline_price:
        return BreakoutResult(
            breakout_type=BreakoutType.NO_BREAKOUT,
            confirmed=False,
            volume_ratio=0.0,
            breakout_index=None,
            breakout_price=None,
            trendline_price=None,
            strength_score=0.0,
            consolidation=None,
        )

    # Calculate volume confirmation
    volumes = [bar.volume for bar in data]
    avg_volume = calculate_volume_ma(volumes, volume_period)
    volume_ratio = latest_bar.volume / avg_volume if avg_volume > 0 else 0.0

    # Check if volume confirms the breakdown
    confirmed = volume_ratio >= volume_threshold

    # Detect consolidation before breakdown
    consolidation = (
        identify_consolidation_range(data[:-1], lookback_bars)
        if len(data) > lookback_bars
        else None
    )

    # Calculate price move percentage (negative for breakdown)
    price_move_percent = ((trendline_price - latest_bar.close) / trendline_price) * 100

    # Create initial result
    result = BreakoutResult(
        breakout_type=BreakoutType.SUPPORT_BREAKDOWN,
        confirmed=confirmed,
        volume_ratio=volume_ratio,
        breakout_index=latest_index,
        breakout_price=latest_bar.close,
        trendline_price=trendline_price,
        strength_score=0.0,
        consolidation=consolidation,
    )

    # Calculate strength score
    strength = calculate_breakout_strength(result, consolidation, price_move_percent)
    result.strength_score = strength

    return result


def detect_breakout(
    data: List[OHLCVData],
    support_trendline: Optional[TrendlineResult] = None,
    resistance_trendline: Optional[TrendlineResult] = None,
    volume_period: int = 20,
    volume_threshold: float = 1.0,
    lookback_bars: int = 20,
) -> BreakoutResult:
    """
    Detect any breakout (resistance or support).

    Checks both resistance breakout and support breakdown, prioritizing
    resistance breakout if both are detected.

    Args:
        data: List of OHLCV data points (must be sorted by timestamp)
        support_trendline: Optional support trendline to check
        resistance_trendline: Optional resistance trendline to check
        volume_period: Period for volume average calculation (default: 20)
        volume_threshold: Minimum volume ratio for confirmation (default: 1.0)
        lookback_bars: Number of bars to check for consolidation (default: 20)

    Returns:
        BreakoutResult with detection details, consolidation, and strength score

    Raises:
        ValueError: If data is invalid or no trendlines provided
    """
    if not data:
        raise ValueError("data cannot be empty")

    if support_trendline is None and resistance_trendline is None:
        raise ValueError("At least one trendline must be provided")

    # Check resistance breakout first
    if resistance_trendline is not None:
        resistance_result = detect_resistance_breakout(
            data, resistance_trendline, volume_period, volume_threshold, lookback_bars
        )
        if resistance_result.breakout_type != BreakoutType.NO_BREAKOUT:
            return resistance_result

    # Check support breakdown
    if support_trendline is not None:
        support_result = detect_support_breakdown(
            data, support_trendline, volume_period, volume_threshold, lookback_bars
        )
        if support_result.breakout_type != BreakoutType.NO_BREAKOUT:
            return support_result

    # No breakout detected
    return BreakoutResult(
        breakout_type=BreakoutType.NO_BREAKOUT,
        confirmed=False,
        volume_ratio=0.0,
        breakout_index=None,
        breakout_price=None,
        trendline_price=None,
        strength_score=0.0,
        consolidation=None,
    )


def detect_retest(
    data: List[OHLCVData],
    breakout_level: float,
    breakout_type: BreakoutType,
    lookback_bars: int = 10,
    tolerance: float = 0.02,
) -> RetestResult:
    """
    Detect if price is retesting a broken level.

    After a breakout, price often pulls back to retest the broken level:
    - Broken resistance should act as new support (bullish retest)
    - Broken support should act as new resistance (bearish retest)

    Args:
        data: List of OHLCV data points (must be sorted by timestamp)
        breakout_level: The price level that was broken
        breakout_type: Type of breakout (RESISTANCE_BREAKOUT or SUPPORT_BREAKDOWN)
        lookback_bars: Number of recent bars to analyze for retest (default: 10)
        tolerance: Percentage tolerance for retest detection (default: 0.02 = 2%)

    Returns:
        RetestResult with detection details and confidence score

    Raises:
        ValueError: If data is invalid or parameters are invalid
    """
    if not data:
        raise ValueError("data cannot be empty")

    if breakout_level <= 0:
        raise ValueError("breakout_level must be positive")

    if lookback_bars < 1:
        raise ValueError("lookback_bars must be at least 1")

    if tolerance <= 0:
        raise ValueError("tolerance must be positive")

    if breakout_type == BreakoutType.NO_BREAKOUT:
        return RetestResult(
            retest_type=RetestType.NO_RETEST,
            detected=False,
            confidence=0.0,
            distance_percent=0.0,
            retest_index=None,
            retest_price=None,
            level=breakout_level,
        )

    # Route to appropriate retest detection based on breakout type
    if breakout_type == BreakoutType.RESISTANCE_BREAKOUT:
        return _detect_resistance_to_support_retest(
            data, breakout_level, lookback_bars, tolerance
        )
    elif breakout_type == BreakoutType.SUPPORT_BREAKDOWN:
        return _detect_support_to_resistance_retest(
            data, breakout_level, lookback_bars, tolerance
        )
    else:
        return RetestResult(
            retest_type=RetestType.NO_RETEST,
            detected=False,
            confidence=0.0,
            distance_percent=0.0,
            retest_index=None,
            retest_price=None,
            level=breakout_level,
        )


def _detect_resistance_to_support_retest(
    data: List[OHLCVData],
    breakout_level: float,
    lookback_bars: int,
    tolerance: float,
) -> RetestResult:
    """
    Detect broken resistance acting as new support.

    After resistance breakout, look for:
    - Price pullback to the breakout level
    - Bullish bounce (close > low, showing support)

    Args:
        data: List of OHLCV data points
        breakout_level: The resistance level that was broken
        lookback_bars: Number of recent bars to analyze
        tolerance: Percentage tolerance for proximity to level

    Returns:
        RetestResult with detection details
    """
    if len(data) < lookback_bars:
        lookback_bars = len(data)

    # Analyze recent bars for retest
    recent_data = data[-lookback_bars:]

    best_retest_index = None
    best_confidence = 0.0
    best_retest_price = None
    closest_distance = float("inf")

    for i, bar in enumerate(recent_data):
        # Calculate distance from breakout level
        distance_percent = abs(bar.low - breakout_level) / breakout_level * 100

        # Check if low is within tolerance of breakout level
        if distance_percent <= (tolerance * 100):
            # This is a potential retest - calculate confidence

            # Proximity score (closer = higher confidence)
            proximity_score = 1.0 - (distance_percent / (tolerance * 100))

            # Bounce strength (bullish rejection from level)
            bar_range = bar.high - bar.low
            if bar_range > 0:
                bounce_strength = (bar.close - bar.low) / bar_range
            else:
                bounce_strength = 0.5  # Neutral if no range

            # Combined confidence (weighted average)
            confidence = (proximity_score * 0.5) + (bounce_strength * 0.5)

            # Keep the best retest (highest confidence)
            if confidence > best_confidence:
                best_confidence = confidence
                best_retest_index = len(data) - lookback_bars + i
                best_retest_price = bar.low
                closest_distance = distance_percent

    if best_retest_index is not None:
        return RetestResult(
            retest_type=RetestType.RESISTANCE_TO_SUPPORT,
            detected=True,
            confidence=best_confidence,
            distance_percent=closest_distance,
            retest_index=best_retest_index,
            retest_price=best_retest_price,
            level=breakout_level,
        )
    else:
        # No retest detected - calculate distance to current price
        latest_bar = data[-1]
        distance_percent = abs(latest_bar.close - breakout_level) / breakout_level * 100

        return RetestResult(
            retest_type=RetestType.NO_RETEST,
            detected=False,
            confidence=0.0,
            distance_percent=distance_percent,
            retest_index=None,
            retest_price=None,
            level=breakout_level,
        )


def _detect_support_to_resistance_retest(
    data: List[OHLCVData],
    breakdown_level: float,
    lookback_bars: int,
    tolerance: float,
) -> RetestResult:
    """
    Detect broken support acting as new resistance.

    After support breakdown, look for:
    - Price rally back to the breakdown level
    - Bearish rejection (close < high, showing resistance)

    Args:
        data: List of OHLCV data points
        breakdown_level: The support level that was broken
        lookback_bars: Number of recent bars to analyze
        tolerance: Percentage tolerance for proximity to level

    Returns:
        RetestResult with detection details
    """
    if len(data) < lookback_bars:
        lookback_bars = len(data)

    # Analyze recent bars for retest
    recent_data = data[-lookback_bars:]

    best_retest_index = None
    best_confidence = 0.0
    best_retest_price = None
    closest_distance = float("inf")

    for i, bar in enumerate(recent_data):
        # Calculate distance from breakdown level
        distance_percent = abs(bar.high - breakdown_level) / breakdown_level * 100

        # Check if high is within tolerance of breakdown level
        if distance_percent <= (tolerance * 100):
            # This is a potential retest - calculate confidence

            # Proximity score (closer = higher confidence)
            proximity_score = 1.0 - (distance_percent / (tolerance * 100))

            # Rejection strength (bearish rejection from level)
            bar_range = bar.high - bar.low
            if bar_range > 0:
                rejection_strength = (bar.high - bar.close) / bar_range
            else:
                rejection_strength = 0.5  # Neutral if no range

            # Combined confidence (weighted average)
            confidence = (proximity_score * 0.5) + (rejection_strength * 0.5)

            # Keep the best retest (highest confidence)
            if confidence > best_confidence:
                best_confidence = confidence
                best_retest_index = len(data) - lookback_bars + i
                best_retest_price = bar.high
                closest_distance = distance_percent

    if best_retest_index is not None:
        return RetestResult(
            retest_type=RetestType.SUPPORT_TO_RESISTANCE,
            detected=True,
            confidence=best_confidence,
            distance_percent=closest_distance,
            retest_index=best_retest_index,
            retest_price=best_retest_price,
            level=breakdown_level,
        )
    else:
        # No retest detected - calculate distance to current price
        latest_bar = data[-1]
        distance_percent = (
            abs(latest_bar.close - breakdown_level) / breakdown_level * 100
        )

        return RetestResult(
            retest_type=RetestType.NO_RETEST,
            detected=False,
            confidence=0.0,
            distance_percent=distance_percent,
            retest_index=None,
            retest_price=None,
            level=breakdown_level,
        )
