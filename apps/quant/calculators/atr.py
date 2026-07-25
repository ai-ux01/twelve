"""
ATR (Average True Range) calculator.

The ATR is a volatility indicator that measures the degree of price volatility
by calculating the average of true ranges over a specified period. It was
developed by J. Welles Wilder Jr. and introduced in his 1978 book
"New Concepts in Technical Trading Systems."

ATR values are always positive and represent absolute price movements, not
percentages. Higher ATR values indicate higher volatility, while lower ATR
values indicate lower volatility.

Formula:
    True Range (TR) = max(high - low, abs(high - prev_close),
                         abs(low - prev_close))
    ATR = Average of TR over the period (using Wilder's smoothing)

References:
    - J. Welles Wilder Jr., "New Concepts in Technical Trading Systems"
      (1978)
"""

import numpy as np
from typing import List


def calculate_true_range(high: float, low: float, prev_close: float) -> float:
    """
    Calculate True Range (TR) for a single period.

    True Range is the greatest of:
    1. Current high minus current low
    2. Absolute value of current high minus previous close
    3. Absolute value of current low minus previous close

    This captures the full range of price movement, including gaps.

    Args:
        high: Current period's high price
        low: Current period's low price
        prev_close: Previous period's close price

    Returns:
        float: True range value (always positive)

    Example:
        >>> tr = calculate_true_range(high=105.0, low=103.0, prev_close=104.5)
        >>> print(f"TR: {tr:.2f}")
        TR: 2.00
    """
    return max(high - low, abs(high - prev_close), abs(low - prev_close))


def calculate_atr(
    highs: List[float], lows: List[float], closes: List[float], period: int = 14
) -> float:
    """
    Calculate ATR (Average True Range) for the most recent period.

    The ATR is calculated using Wilder's smoothing method:
    1. Calculate True Range for each period
    2. Calculate initial ATR as simple average of first 'period' TR values
    3. Apply Wilder's smoothing for subsequent values:
       ATR = (Previous ATR * (period - 1) + Current TR) / period

    Args:
        highs: List of high prices (most recent last), must have at least
               period+1 values
        lows: List of low prices (most recent last), must have at least
              period+1 values
        closes: List of close prices (most recent last), must have at least
                period+1 values
        period: ATR period, default is 14 (standard ATR-14)

    Returns:
        float: ATR value (absolute price movement measure, always positive)

    Raises:
        ValueError: If input lists have different lengths, insufficient
                    data, or invalid period
        ValueError: If any high price is less than corresponding low price
        ValueError: If any price is negative

    Example:
        >>> highs = [48.7, 48.72, 48.9, 48.87, 48.82, 49.05, 49.20, 49.35,
        ...          49.92, 50.19, 50.12, 49.66, 49.88, 50.19, 50.36]
        >>> lows = [47.79, 48.14, 48.39, 48.37, 48.24, 48.64, 48.94, 48.86,
        ...         49.50, 49.87, 49.20, 48.90, 49.43, 49.73, 49.26]
        >>> closes = [48.16, 48.61, 48.75, 48.63, 48.74, 49.03, 49.07, 49.32,
        ...           49.91, 50.13, 49.53, 49.50, 49.75, 50.03, 50.31]
        >>> atr = calculate_atr(highs, lows, closes, period=14)
        >>> print(f"ATR: {atr:.2f}")
        ATR: 0.56
    """
    # Validation
    if period <= 0:
        raise ValueError(f"Period must be positive, got {period}")

    if len(highs) != len(lows) or len(highs) != len(closes):
        raise ValueError(
            f"All input lists must have the same length. "
            f"Got highs={len(highs)}, lows={len(lows)}, closes={len(closes)}"
        )

    # Need at least period + 1 data points (one extra for previous close)
    min_required = period + 1
    if len(highs) < min_required:
        raise ValueError(
            f"Need at least {min_required} data points for ATR-{period} calculation, "
            f"got {len(highs)}"
        )

    # Validate price data
    for i in range(len(highs)):
        if highs[i] < lows[i]:
            raise ValueError(f"High price must be >= low price at index {i}")
        if closes[i] < 0 or highs[i] < 0 or lows[i] < 0:
            raise ValueError(f"Prices must be non-negative at index {i}")

    # Convert to numpy arrays
    highs_arr = np.array(highs, dtype=float)
    lows_arr = np.array(lows, dtype=float)
    closes_arr = np.array(closes, dtype=float)

    # Calculate True Range for each period (starting from index 1)
    tr_list = []
    for i in range(1, len(highs_arr)):
        tr = calculate_true_range(highs_arr[i], lows_arr[i], closes_arr[i - 1])
        tr_list.append(tr)

    # Convert to numpy array
    tr_arr = np.array(tr_list)

    # Calculate initial ATR as simple average of first 'period' TR values
    atr = np.mean(tr_arr[:period])

    # Apply Wilder's smoothing method for subsequent values
    # ATR = (Previous ATR * (period - 1) + Current TR) / period
    for i in range(period, len(tr_arr)):
        atr = (atr * (period - 1) + tr_arr[i]) / period

    return float(atr)


def calculate_atr_series(
    highs: List[float], lows: List[float], closes: List[float], period: int = 14
) -> List[float]:
    """
    Calculate ATR values for an entire price series, returning ATR for each point.

    This is useful when you need ATR values for charting or time series analysis,
    not just the latest ATR value. The first 'period' values will be NaN since
    there's insufficient data to calculate ATR.

    Args:
        highs: List of high prices (most recent last)
        lows: List of low prices (most recent last)
        closes: List of close prices (most recent last)
        period: ATR period, default is 14

    Returns:
        List[float]: List of ATR values, with NaN for the first 'period' values

    Raises:
        ValueError: If input lists have different lengths, insufficient
                    data, or invalid period

    Example:
        >>> highs = [48.7, 48.72, 48.9, 48.87, 48.82, 49.05, 49.20, 49.35,
        ...          49.92, 50.19, 50.12, 49.66, 49.88, 50.19, 50.36]
        >>> lows = [47.79, 48.14, 48.39, 48.37, 48.24, 48.64, 48.94, 48.86,
        ...         49.50, 49.87, 49.20, 48.90, 49.43, 49.73, 49.26]
        >>> closes = [48.16, 48.61, 48.75, 48.63, 48.74, 49.03, 49.07, 49.32,
        ...           49.91, 50.13, 49.53, 49.50, 49.75, 50.03, 50.31]
        >>> atr_series = calculate_atr_series(highs, lows, closes, period=14)
        >>> print(f"Latest ATR: {atr_series[-1]:.2f}")
        Latest ATR: 0.56
    """
    # Validation
    if period <= 0:
        raise ValueError(f"Period must be positive, got {period}")

    if len(highs) != len(lows) or len(highs) != len(closes):
        raise ValueError(
            f"All input lists must have the same length. "
            f"Got highs={len(highs)}, lows={len(lows)}, closes={len(closes)}"
        )

    min_required = period + 1
    if len(highs) < min_required:
        raise ValueError(
            f"Need at least {min_required} data points for ATR-{period} calculation, "
            f"got {len(highs)}"
        )

    # Validate price data
    for i in range(len(highs)):
        if highs[i] < lows[i]:
            raise ValueError(f"High price must be >= low price at index {i}")
        if closes[i] < 0 or highs[i] < 0 or lows[i] < 0:
            raise ValueError(f"Prices must be non-negative at index {i}")

    # Convert to numpy arrays
    highs_arr = np.array(highs, dtype=float)
    lows_arr = np.array(lows, dtype=float)
    closes_arr = np.array(closes, dtype=float)

    # Calculate True Range for each period
    tr_list = [float("nan")]  # First value is NaN (no previous close)
    for i in range(1, len(highs_arr)):
        tr = calculate_true_range(highs_arr[i], lows_arr[i], closes_arr[i - 1])
        tr_list.append(tr)

    # Initialize ATR series with NaN values
    atr_series = [float("nan")] * len(highs_arr)

    # Calculate ATR values starting from index 'period'
    # (we need 'period' TR values to calculate the first ATR)
    if len(tr_list) >= period + 1:
        # Initial ATR (at index 'period')
        valid_tr = [tr for tr in tr_list[1 : period + 1] if not np.isnan(tr)]
        atr = np.mean(valid_tr)
        atr_series[period] = atr

        # Apply Wilder's smoothing for subsequent values
        for i in range(period + 1, len(tr_list)):
            if not np.isnan(tr_list[i]):
                atr = (atr * (period - 1) + tr_list[i]) / period
                atr_series[i] = atr

    return atr_series
