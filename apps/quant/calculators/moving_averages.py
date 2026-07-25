"""
Moving Average calculators for technical analysis.

This module implements Simple Moving Average (SMA) and Exponential Moving Average (EMA)
calculations. These are fundamental indicators used in many other technical calculations.
"""

from typing import List
import numpy as np


def calculate_sma(prices: List[float], period: int) -> float:
    """
    Calculate Simple Moving Average (SMA) for a given period.

    SMA is the arithmetic mean of the last 'period' prices.

    Args:
        prices: List of price values (must be at least 'period' length)
        period: Number of periods to average over (must be > 0)

    Returns:
        The SMA value for the given period

    Raises:
        ValueError: If period is invalid or insufficient data provided

    Example:
        >>> prices = [100, 102, 104, 106, 108]
        >>> calculate_sma(prices, 3)
        106.0
    """
    if period <= 0:
        raise ValueError("period must be positive")

    if len(prices) < period:
        raise ValueError(
            f"Insufficient data: need at least {period} prices, got {len(prices)}"
        )

    # Convert to numpy array for efficient calculation
    prices_array = np.array(prices[-period:])

    # Calculate the mean of the last 'period' prices
    sma = float(np.mean(prices_array))

    return sma


def calculate_sma_series(prices: List[float], period: int) -> List[float]:
    """
    Calculate Simple Moving Average series for all valid data points.

    Generates SMA values for each point where sufficient prior data exists.

    Args:
        prices: List of price values
        period: Number of periods to average over

    Returns:
        List of SMA values (length will be len(prices) - period + 1)

    Raises:
        ValueError: If period is invalid or insufficient data provided

    Example:
        >>> prices = [100, 102, 104, 106, 108]
        >>> calculate_sma_series(prices, 3)
        [102.0, 104.0, 106.0]
    """
    if period <= 0:
        raise ValueError("period must be positive")

    if len(prices) < period:
        raise ValueError(
            f"Insufficient data: need at least {period} prices, got {len(prices)}"
        )

    prices_array = np.array(prices)
    sma_values = []

    # Calculate SMA for each valid window
    for i in range(period - 1, len(prices_array)):
        window = prices_array[i - period + 1 : i + 1]
        sma_values.append(float(np.mean(window)))

    return sma_values


def calculate_ema(prices: List[float], period: int) -> float:
    """
    Calculate Exponential Moving Average (EMA) for a given period.

    EMA gives more weight to recent prices using an exponential weighting factor.
    The multiplier is: 2 / (period + 1)

    The first EMA value uses SMA as the seed, then subsequent values use:
    EMA = (Close - EMA_previous) * multiplier + EMA_previous

    Args:
        prices: List of price values (must be at least 'period' length)
        period: Number of periods for the EMA (must be > 0)

    Returns:
        The current EMA value

    Raises:
        ValueError: If period is invalid or insufficient data provided

    Example:
        >>> prices = [100, 102, 104, 106, 108]
        >>> calculate_ema(prices, 3)
        107.0
    """
    if period <= 0:
        raise ValueError("period must be positive")

    if len(prices) < period:
        raise ValueError(
            f"Insufficient data: need at least {period} prices, got {len(prices)}"
        )

    prices_array = np.array(prices)

    # Calculate the multiplier
    multiplier = 2.0 / (period + 1)

    # Initialize EMA with SMA of first 'period' values
    ema = float(np.mean(prices_array[:period]))

    # Calculate EMA for remaining prices
    for price in prices_array[period:]:
        ema = (price - ema) * multiplier + ema

    return ema


def calculate_ema_series(prices: List[float], period: int) -> List[float]:
    """
    Calculate Exponential Moving Average series for all valid data points.

    Generates EMA values starting from the first point where sufficient data exists.

    Args:
        prices: List of price values
        period: Number of periods for the EMA

    Returns:
        List of EMA values (length will be len(prices) - period + 1)

    Raises:
        ValueError: If period is invalid or insufficient data provided

    Example:
        >>> prices = [100, 102, 104, 106, 108]
        >>> calculate_ema_series(prices, 3)
        [102.0, 104.0, 107.0]
    """
    if period <= 0:
        raise ValueError("period must be positive")

    if len(prices) < period:
        raise ValueError(
            f"Insufficient data: need at least {period} prices, got {len(prices)}"
        )

    prices_array = np.array(prices)
    ema_values = []

    # Calculate the multiplier
    multiplier = 2.0 / (period + 1)

    # Initialize EMA with SMA of first 'period' values
    ema = float(np.mean(prices_array[:period]))
    ema_values.append(ema)

    # Calculate EMA for remaining prices
    for price in prices_array[period:]:
        ema = (price - ema) * multiplier + ema
        ema_values.append(ema)

    return ema_values


def calculate_multiple_sma(prices: List[float], periods: List[int]) -> dict[int, float]:
    """
    Calculate multiple SMA values for different periods efficiently.

    Args:
        prices: List of price values
        periods: List of periods to calculate SMA for

    Returns:
        Dictionary mapping period to SMA value

    Raises:
        ValueError: If any period is invalid or insufficient data provided

    Example:
        >>> prices = [100, 102, 104, 106, 108, 110, 112, 114, 116, 118]
        >>> calculate_multiple_sma(prices, [3, 5, 7])
        {3: 116.0, 5: 114.0, 7: 112.0}
    """
    if not periods:
        raise ValueError("periods list cannot be empty")

    max_period = max(periods)
    if len(prices) < max_period:
        raise ValueError(
            f"Insufficient data: need at least {max_period} prices, got {len(prices)}"
        )

    result = {}
    for period in periods:
        result[period] = calculate_sma(prices, period)

    return result


def calculate_multiple_ema(prices: List[float], periods: List[int]) -> dict[int, float]:
    """
    Calculate multiple EMA values for different periods efficiently.

    Args:
        prices: List of price values
        periods: List of periods to calculate EMA for

    Returns:
        Dictionary mapping period to EMA value

    Raises:
        ValueError: If any period is invalid or insufficient data provided

    Example:
        >>> prices = [100, 102, 104, 106, 108, 110, 112, 114, 116, 118]
        >>> calculate_multiple_ema(prices, [3, 5, 7])
        {3: 117.0, 5: 115.5, 7: 114.2}
    """
    if not periods:
        raise ValueError("periods list cannot be empty")

    max_period = max(periods)
    if len(prices) < max_period:
        raise ValueError(
            f"Insufficient data: need at least {max_period} prices, got {len(prices)}"
        )

    result = {}
    for period in periods:
        result[period] = calculate_ema(prices, period)

    return result
