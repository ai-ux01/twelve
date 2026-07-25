"""
Bollinger Bands calculator for the Quant Engine.

Bollinger Bands consist of:
- Middle band: Simple Moving Average (SMA) over a specified period
- Upper band: Middle band + (2 * standard deviation)
- Lower band: Middle band - (2 * standard deviation)

The standard parameters are:
- Period: 20
- Standard deviations: 2

References:
    - John Bollinger, "Bollinger on Bollinger Bands" (2001)
    - https://www.bollingerbands.com/
"""

import numpy as np
from typing import List, Tuple


def calculate_bollinger_bands(
    prices: List[float], period: int = 20, num_std: float = 2.0
) -> Tuple[float, float, float]:
    """
    Calculate Bollinger Bands for the most recent data point.

    Bollinger Bands are a volatility indicator that consists of a middle band
    (Simple Moving Average) and upper/lower bands placed at a specified number
    of standard deviations above and below the middle band.

    Args:
        prices: List of closing prices, ordered chronologically (oldest to newest).
                Must contain at least `period` data points.
        period: Number of periods for the moving average (default: 20).
        num_std: Number of standard deviations for the bands (default: 2.0).

    Returns:
        A tuple of (upper_band, middle_band, lower_band) for the most recent period.

    Raises:
        ValueError: If prices list has fewer than `period` elements.
        ValueError: If period is less than 2.
        ValueError: If num_std is negative.

    Example:
        >>> prices = [100, 102, 101, 103, 105, 104, 106, 108, 107, 109,
        ...           110, 112, 111, 113, 115, 114, 116, 118, 117, 119, 120]
        >>> upper, middle, lower = calculate_bollinger_bands(prices, period=20)
        >>> print(f"Upper: {upper:.2f}, Middle: {middle:.2f}, Lower: {lower:.2f}")
    """
    # Validate inputs
    if period < 2:
        raise ValueError(f"Period must be at least 2, got {period}")

    if num_std < 0:
        raise ValueError(
            f"Number of standard deviations must be non-negative, got {num_std}"
        )

    if len(prices) < period:
        raise ValueError(
            f"Insufficient data: need at least {period} prices, got {len(prices)}"
        )

    # Convert to numpy array for efficient computation
    prices_array = np.array(prices, dtype=np.float64)

    # Take the most recent `period` prices
    recent_prices = prices_array[-period:]

    # Calculate middle band (Simple Moving Average)
    middle_band = float(np.mean(recent_prices))

    # Calculate standard deviation
    # Using ddof=0 for population std (standard for Bollinger Bands)
    std_dev = float(np.std(recent_prices, ddof=0))

    # Calculate upper and lower bands
    upper_band = middle_band + (num_std * std_dev)
    lower_band = middle_band - (num_std * std_dev)

    return upper_band, middle_band, lower_band


def calculate_bollinger_bands_series(
    prices: List[float], period: int = 20, num_std: float = 2.0
) -> Tuple[List[float], List[float], List[float]]:
    """
    Calculate Bollinger Bands for all data points in a series.

    This function calculates Bollinger Bands for each point in the price series
    where sufficient historical data is available. The first (period - 1) values
    will be NaN since there's insufficient data to calculate the bands.

    Args:
        prices: List of closing prices, ordered chronologically (oldest to newest).
        period: Number of periods for the moving average (default: 20).
        num_std: Number of standard deviations for the bands (default: 2.0).

    Returns:
        A tuple of three lists: (upper_bands, middle_bands, lower_bands).
        Each list has the same length as the input prices list.

    Raises:
        ValueError: If period is less than 2.
        ValueError: If num_std is negative.

    Example:
        >>> prices = [100, 102, 101, 103, 105, 104, 106, 108, 107, 109,
        ...           110, 112, 111, 113, 115, 114, 116, 118, 117, 119, 120]
        >>> upper, middle, lower = calculate_bollinger_bands_series(prices, period=20)
        >>> # First 19 values will be NaN, last value will have the bands
    """
    # Validate inputs
    if period < 2:
        raise ValueError(f"Period must be at least 2, got {period}")

    if num_std < 0:
        raise ValueError(
            f"Number of standard deviations must be non-negative, got {num_std}"
        )

    n = len(prices)
    upper_bands = []
    middle_bands = []
    lower_bands = []

    # Convert to numpy array for efficient computation
    prices_array = np.array(prices, dtype=np.float64)

    for i in range(n):
        if i < period - 1:
            # Not enough data yet
            upper_bands.append(float("nan"))
            middle_bands.append(float("nan"))
            lower_bands.append(float("nan"))
        else:
            # Calculate bands for this window
            window = prices_array[i - period + 1 : i + 1]
            middle = float(np.mean(window))
            std_dev = float(np.std(window, ddof=0))
            upper = middle + (num_std * std_dev)
            lower = middle - (num_std * std_dev)

            upper_bands.append(upper)
            middle_bands.append(middle)
            lower_bands.append(lower)

    return upper_bands, middle_bands, lower_bands
