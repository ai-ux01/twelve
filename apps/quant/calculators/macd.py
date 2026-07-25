"""
MACD (Moving Average Convergence Divergence) calculator.

MACD is a trend-following momentum indicator that shows the relationship between
two exponential moving averages (EMAs) of a security's price. The MACD is
calculated by subtracting the 26-period EMA from the 12-period EMA.
"""

import pandas as pd
from typing import Dict, List


def calculate_ema(data: pd.Series, period: int) -> pd.Series:
    """
    Calculate Exponential Moving Average (EMA).

    EMA gives more weight to recent prices and responds more quickly to price changes
    than a simple moving average.

    Args:
        data: Price series (typically closing prices)
        period: Number of periods for EMA calculation

    Returns:
        Series containing EMA values
    """
    return data.ewm(span=period, adjust=False).mean()


def calculate_macd(
    prices: List[float],
    fast_period: int = 12,
    slow_period: int = 26,
    signal_period: int = 9,
) -> Dict[str, float]:
    """
    Calculate MACD (Moving Average Convergence Divergence) indicator.

    MACD consists of three components:
    1. MACD Line: Difference between fast EMA (12-period) and slow EMA (26-period)
    2. Signal Line: EMA of MACD line (9-period)
    3. Histogram: Difference between MACD line and signal line

    The MACD indicator helps identify:
    - Trend direction and momentum
    - Potential buy/sell signals (MACD crosses signal line)
    - Divergences between price and momentum

    Args:
        prices: List of closing prices (most recent last)
        fast_period: Period for fast EMA (default: 12)
        slow_period: Period for slow EMA (default: 26)
        signal_period: Period for signal line EMA (default: 9)

    Returns:
        Dictionary containing:
            - value: MACD line (fast_ema - slow_ema)
            - signal: Signal line (EMA of MACD line)
            - histogram: MACD histogram (MACD - signal)

    Raises:
        ValueError: If insufficient data points or invalid parameters

    Example:
        >>> prices = [100, 102, 101, 103, 105, 104, 106, 108, 107, 109,
        ...           110, 112, 111, 113, 115, 114, 116, 118, 117, 119,
        ...           120, 122, 121, 123, 125, 124, 126, 128, 127, 129,
        ...           130, 132, 131, 133, 135]
        >>> result = calculate_macd(prices)
        >>> print(f"MACD: {result['value']:.2f}")
        >>> print(f"Signal: {result['signal']:.2f}")
        >>> print(f"Histogram: {result['histogram']:.2f}")
    """
    # Validate input parameters
    if fast_period <= 0 or slow_period <= 0 or signal_period <= 0:
        raise ValueError("All periods must be positive integers")

    if fast_period >= slow_period:
        raise ValueError("Fast period must be less than slow period")

    # Ensure we have enough data points
    min_required = slow_period + signal_period
    if len(prices) < min_required:
        raise ValueError(
            f"Insufficient data: need at least {min_required} data points, "
            f"got {len(prices)}"
        )

    # Validate price data
    if any(p <= 0 for p in prices):
        raise ValueError("All prices must be positive")

    # Convert to pandas Series for EMA calculation
    price_series = pd.Series(prices)

    # Calculate EMAs
    fast_ema = calculate_ema(price_series, fast_period)
    slow_ema = calculate_ema(price_series, slow_period)

    # Calculate MACD line (difference between fast and slow EMAs)
    macd_line = fast_ema - slow_ema

    # Calculate signal line (EMA of MACD line)
    signal_line = calculate_ema(macd_line, signal_period)

    # Calculate histogram (difference between MACD and signal)
    histogram = macd_line - signal_line

    # Return the most recent values
    return {
        "value": float(macd_line.iloc[-1]),
        "signal": float(signal_line.iloc[-1]),
        "histogram": float(histogram.iloc[-1]),
    }


def calculate_macd_series(
    prices: List[float],
    fast_period: int = 12,
    slow_period: int = 26,
    signal_period: int = 9,
) -> Dict[str, List[float]]:
    """
    Calculate MACD indicator for entire price series.

    This function returns the full MACD, signal, and histogram series
    rather than just the most recent values.

    Args:
        prices: List of closing prices (most recent last)
        fast_period: Period for fast EMA (default: 12)
        slow_period: Period for slow EMA (default: 26)
        signal_period: Period for signal line EMA (default: 9)

    Returns:
        Dictionary containing:
            - value: List of MACD line values
            - signal: List of signal line values
            - histogram: List of histogram values

    Raises:
        ValueError: If insufficient data points or invalid parameters
    """
    # Validate input parameters
    if fast_period <= 0 or slow_period <= 0 or signal_period <= 0:
        raise ValueError("All periods must be positive integers")

    if fast_period >= slow_period:
        raise ValueError("Fast period must be less than slow period")

    min_required = slow_period + signal_period
    if len(prices) < min_required:
        raise ValueError(
            f"Insufficient data: need at least {min_required} data points, "
            f"got {len(prices)}"
        )

    if any(p <= 0 for p in prices):
        raise ValueError("All prices must be positive")

    # Convert to pandas Series
    price_series = pd.Series(prices)

    # Calculate EMAs
    fast_ema = calculate_ema(price_series, fast_period)
    slow_ema = calculate_ema(price_series, slow_period)

    # Calculate MACD line
    macd_line = fast_ema - slow_ema

    # Calculate signal line
    signal_line = calculate_ema(macd_line, signal_period)

    # Calculate histogram
    histogram = macd_line - signal_line

    return {
        "value": macd_line.tolist(),
        "signal": signal_line.tolist(),
        "histogram": histogram.tolist(),
    }
