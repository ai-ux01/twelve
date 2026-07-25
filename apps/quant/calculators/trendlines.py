"""
Trendline detection calculator for the Quant Engine.

This module implements trendline detection using linear regression on swing highs
and lows to identify uptrends and downtrends in price data.
"""

import numpy as np
from scipy import stats
from typing import List, Tuple, Optional
from models import OHLCVData, TrendlineResult
from calculators.trendline_validator import TrendlineValidator


def detect_trendlines(
    data: List[OHLCVData], min_touches: int = 3, min_r_squared: float = 0.5
) -> List[TrendlineResult]:
    """
    Detect trendlines in price data using linear regression on swing points.

    This function identifies both uptrend lines (using swing lows) and downtrend
    lines (using swing highs) by finding local extrema and fitting linear
    regressions to them.

    Args:
        data: List of OHLCV data points, must be sorted by timestamp
        min_touches: Minimum number of swing points required for a valid trendline
        min_r_squared: Minimum R² value for a valid trendline (0-1)

    Returns:
        List of detected trendlines, sorted by R² value (best fit first)

    Raises:
        ValueError: If data list is empty or has insufficient data points
    """
    if not data:
        raise ValueError("data cannot be empty")

    if len(data) < min_touches:
        raise ValueError(
            f"Insufficient data points: {len(data)} < {min_touches} (min_touches)"
        )

    trendlines = []

    # Detect uptrend (using swing lows)
    uptrend = _detect_single_trendline(data, use_lows=True, min_touches=min_touches)
    if uptrend and uptrend.r_squared >= min_r_squared:
        trendlines.append(uptrend)

    # Detect downtrend (using swing highs)
    downtrend = _detect_single_trendline(data, use_lows=False, min_touches=min_touches)
    if downtrend and downtrend.r_squared >= min_r_squared:
        trendlines.append(downtrend)

    # Sort by R² value (best fit first)
    trendlines.sort(key=lambda t: t.r_squared, reverse=True)

    return trendlines


def _detect_single_trendline(
    data: List[OHLCVData], use_lows: bool, min_touches: int
) -> Optional[TrendlineResult]:
    """
    Detect a single trendline using either swing lows or swing highs.

    Args:
        data: List of OHLCV data points
        use_lows: If True, use swing lows (uptrend). If False, use swing highs (downtrend)
        min_touches: Minimum number of swing points required

    Returns:
        Detected trendline or None if no valid trendline found
    """
    # Extract swing points
    swing_points = _find_swing_points(data, use_lows=use_lows)

    if len(swing_points) < min_touches:
        return None

    # Extract x (indices) and y (prices) for regression
    x_values = np.array([point[0] for point in swing_points])
    y_values = np.array([point[1] for point in swing_points])

    # Perform linear regression
    slope, intercept, r_value, _, _ = stats.linregress(x_values, y_values)
    r_squared = r_value**2

    # Calculate start and end points for the trendline
    start_x = 0
    end_x = len(data) - 1
    start_y = slope * start_x + intercept
    end_y = slope * end_x + intercept

    return TrendlineResult(
        slope=slope,
        intercept=intercept,
        r_squared=r_squared,
        start_point=(float(start_x), float(start_y)),
        end_point=(float(end_x), float(end_y)),
    )


def _find_swing_points(
    data: List[OHLCVData], use_lows: bool, window: int = 3
) -> List[Tuple[int, float]]:
    """
    Find swing highs or swing lows in price data.

    A swing point is a local extremum - a point that is higher/lower than
    its neighbors within a given window.

    Args:
        data: List of OHLCV data points
        use_lows: If True, find swing lows. If False, find swing highs
        window: Number of periods on each side to check for local extremum

    Returns:
        List of tuples (index, price) representing swing points
    """
    swing_points = []
    prices = [candle.low if use_lows else candle.high for candle in data]

    # Scan for local extrema
    for i in range(window, len(prices) - window):
        is_swing_point = True
        current_price = prices[i]

        # Check if current point is a local extremum
        for j in range(i - window, i + window + 1):
            if j == i:
                continue

            if use_lows:
                # For swing lows, current should be lower than or equal to neighbors
                if current_price > prices[j]:
                    is_swing_point = False
                    break
            else:
                # For swing highs, current should be higher than or equal to neighbors
                if current_price < prices[j]:
                    is_swing_point = False
                    break

        if is_swing_point:
            swing_points.append((i, current_price))

    # If not enough swing points found with window, try with smaller window
    if len(swing_points) < 3 and window > 1:
        return _find_swing_points(data, use_lows, window=window - 1)

    return swing_points


def calculate_trendline_touches(
    data: List[OHLCVData], trendline: TrendlineResult, tolerance: float = 0.01
) -> int:
    """
    Calculate how many times price touches or crosses a trendline.

    A "touch" is defined as the price coming within a specified tolerance
    percentage of the trendline value.

    Args:
        data: List of OHLCV data points
        trendline: The trendline to check touches against
        tolerance: Price tolerance as a percentage (e.g., 0.01 = 1%)

    Returns:
        Number of touches detected
    """
    touches = 0

    for i, candle in enumerate(data):
        expected_price = trendline.slope * i + trendline.intercept
        threshold = expected_price * tolerance

        # Check if low or high touches the trendline
        if (
            abs(candle.low - expected_price) <= threshold
            or abs(candle.high - expected_price) <= threshold
        ):
            touches += 1

    return touches


def detect_and_validate_trendlines(
    data: List[OHLCVData],
    min_touches: int = 2,
    min_r_squared: float = 0.7,
    min_strength: float = 40.0,
    tolerance: float = 0.01,
) -> List[dict]:
    """
    Detect trendlines with validation and scoring.

    This is an enhanced version of detect_trendlines that includes:
    - Validation of minimum touch points
    - Strength scoring (0-100)
    - Angle classification (STEEP/MODERATE/FLAT)
    - Filtering of weak trendlines

    Args:
        data: List of OHLCV data points
        min_touches: Minimum number of touch points required (default: 2)
        min_r_squared: Minimum R² value for valid trendlines (default: 0.7)
        min_strength: Minimum strength score (default: 40.0)
        tolerance: Price tolerance for touch detection (default: 0.01 = 1%)

    Returns:
        List of validated trendlines with validation metrics
    """
    if not data:
        raise ValueError("data cannot be empty")

    # Create validator
    validator = TrendlineValidator(
        min_touches=min_touches, min_r_squared=min_r_squared, min_strength=min_strength
    )

    # Detect raw trendlines (using existing logic with relaxed thresholds)
    raw_trendlines = detect_trendlines(
        data,
        min_touches=min_touches,
        min_r_squared=0.5,  # Use lower threshold for initial detection
    )

    # Validate and score each trendline
    validated_trendlines = []
    for trendline in raw_trendlines:
        metrics = validator.validate_and_score_trendline(trendline, data, tolerance)

        if metrics and metrics["is_valid"]:
            validated_trendlines.append(
                {
                    "trendline": trendline,
                    "strength": metrics["strength"],
                    "touches": metrics["touches"],
                    "angle": metrics["angle"],
                    "r_squared": metrics["r_squared"],
                    "slope": metrics["slope"],
                }
            )

    # Sort by strength score (highest first)
    validated_trendlines.sort(key=lambda t: t["strength"], reverse=True)

    return validated_trendlines
