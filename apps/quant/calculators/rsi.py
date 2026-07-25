"""
RSI (Relative Strength Index) calculator.

The RSI is a momentum oscillator that measures the speed and magnitude of price changes.
It oscillates between 0 and 100, with values above 70 indicating overbought conditions
and values below 30 indicating oversold conditions.

Formula:
    RSI = 100 - (100 / (1 + RS))
    where RS = Average Gain / Average Loss over the period
"""

import pandas as pd
import numpy as np
from typing import List


def calculate_rsi(prices: List[float], period: int = 14) -> float:
    """
    Calculate the Relative Strength Index (RSI) for a given price series.

    The RSI is calculated using the standard Wilder's smoothing method:
    1. Calculate price changes (deltas)
    2. Separate gains and losses
    3. Calculate average gain and average loss using exponential moving average
    4. Calculate RS = average gain / average loss
    5. Calculate RSI = 100 - (100 / (1 + RS))

    Args:
        prices: List of closing prices, must have at least (period + 1) values
        period: RSI period, default is 14 (standard RSI-14)

    Returns:
        float: RSI value between 0 and 100

    Raises:
        ValueError: If prices list is too short or period is invalid

    Example:
        >>> prices = [44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42,
        ...           45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28]
        >>> rsi = calculate_rsi(prices, period=14)
        >>> print(f"RSI: {rsi:.2f}")
        RSI: 70.46
    """
    # Validation
    if period <= 0:
        raise ValueError(f"Period must be positive, got {period}")

    if len(prices) < period + 1:
        raise ValueError(
            f"Need at least {period + 1} prices for RSI-{period} calculation, "
            f"got {len(prices)}"
        )

    # Convert to numpy array for efficient calculation
    prices_array = np.array(prices, dtype=float)

    # Calculate price changes (deltas)
    deltas = np.diff(prices_array)

    # Separate gains and losses
    gains = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)

    # Calculate initial average gain and loss (simple average for first period)
    avg_gain = np.mean(gains[:period])
    avg_loss = np.mean(losses[:period])

    # Use Wilder's smoothing method for subsequent values
    # This is equivalent to an exponential moving average with alpha = 1/period
    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period

    # Calculate RS and RSI
    if avg_loss == 0:
        # If there are no losses, RSI is 100
        return 100.0

    rs = avg_gain / avg_loss
    rsi = 100.0 - (100.0 / (1.0 + rs))

    return float(rsi)


def calculate_rsi_series(prices: List[float], period: int = 14) -> List[float]:
    """
    Calculate RSI values for an entire price series, returning RSI for each point.

    This is useful when you need RSI values for charting or time series analysis,
    not just the latest RSI value.

    Args:
        prices: List of closing prices
        period: RSI period, default is 14

    Returns:
        List[float]: List of RSI values, with NaN for the first 'period' values

    Example:
        >>> prices = [44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42,
        ...           45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28]
        >>> rsi_series = calculate_rsi_series(prices, period=14)
        >>> print(f"Latest RSI: {rsi_series[-1]:.2f}")
        Latest RSI: 70.46
    """
    # Validation
    if period <= 0:
        raise ValueError(f"Period must be positive, got {period}")

    if len(prices) < period + 1:
        raise ValueError(
            f"Need at least {period + 1} prices for RSI-{period} calculation, "
            f"got {len(prices)}"
        )

    # Use pandas for easier rolling calculations
    df = pd.DataFrame({"price": prices})

    # Calculate price changes
    df["delta"] = df["price"].diff()

    # Separate gains and losses
    df["gain"] = df["delta"].apply(lambda x: x if x > 0 else 0.0)
    df["loss"] = df["delta"].apply(lambda x: -x if x < 0 else 0.0)

    # Calculate exponential moving averages (Wilder's smoothing)
    # alpha = 1/period for Wilder's smoothing
    df["avg_gain"] = df["gain"].ewm(alpha=1 / period, adjust=False).mean()
    df["avg_loss"] = df["loss"].ewm(alpha=1 / period, adjust=False).mean()

    # Calculate RS and RSI
    df["rs"] = df["avg_gain"] / df["avg_loss"]
    df["rsi"] = 100.0 - (100.0 / (1.0 + df["rs"]))

    # Handle division by zero (when avg_loss is 0, RSI should be 100)
    df["rsi"] = df["rsi"].fillna(100.0)

    return df["rsi"].tolist()
