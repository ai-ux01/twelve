"""
ADX (Average Directional Index) calculator.

The ADX is a trend strength indicator that measures how strongly a trend is moving,
regardless of direction. It is derived from the directional movement indicators (+DI and -DI).
ADX values range from 0 to 100, with values above 25 indicating a strong trend.

Components:
- +DI (Positive Directional Indicator): Measures upward price movement
- -DI (Negative Directional Indicator): Measures downward price movement
- ADX: Smoothed average of the DX (Directional Index), indicating trend strength

Formula:
    +DM = current high - previous high (if positive and greater than -DM, else 0)
    -DM = previous low - current low (if positive and greater than +DM, else 0)
    TR = max(high - low, abs(high - previous close), abs(low - previous close))
    +DI = 100 * (smoothed +DM / smoothed TR)
    -DI = 100 * (smoothed -DM / smoothed TR)
    DX = 100 * abs(+DI - -DI) / (+DI + -DI)
    ADX = smoothed average of DX
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Tuple


def calculate_true_range(high: float, low: float, prev_close: float) -> float:
    """
    Calculate True Range (TR) for a single period.

    True Range is the greatest of:
    1. Current high minus current low
    2. Absolute value of current high minus previous close
    3. Absolute value of current low minus previous close

    Args:
        high: Current period's high price
        low: Current period's low price
        prev_close: Previous period's close price

    Returns:
        float: True range value
    """
    return max(high - low, abs(high - prev_close), abs(low - prev_close))


def calculate_directional_movement(
    current_high: float, prev_high: float, current_low: float, prev_low: float
) -> Tuple[float, float]:
    """
    Calculate directional movement (+DM and -DM) for a single period.

    +DM (Positive Directional Movement):
        - If current high - previous high > previous low - current low AND > 0: +DM = current high - previous high
        - Otherwise: +DM = 0

    -DM (Negative Directional Movement):
        - If previous low - current low > current high - previous high AND > 0: -DM = previous low - current low
        - Otherwise: -DM = 0

    Args:
        current_high: Current period's high price
        prev_high: Previous period's high price
        current_low: Current period's low price
        prev_low: Previous period's low price

    Returns:
        Tuple[float, float]: (+DM, -DM) values
    """
    up_move = current_high - prev_high
    down_move = prev_low - current_low

    plus_dm = 0.0
    minus_dm = 0.0

    if up_move > down_move and up_move > 0:
        plus_dm = up_move
    elif down_move > up_move and down_move > 0:
        minus_dm = down_move

    return plus_dm, minus_dm


def calculate_adx(
    highs: List[float], lows: List[float], closes: List[float], period: int = 14
) -> Dict[str, float]:
    """
    Calculate ADX (Average Directional Index) and directional indicators.

    The ADX measures trend strength on a scale from 0 to 100:
    - 0-25: Weak or no trend (ranging market)
    - 25-50: Strong trend
    - 50-75: Very strong trend
    - 75-100: Extremely strong trend

    Args:
        highs: List of high prices (most recent last)
        lows: List of low prices (most recent last)
        closes: List of close prices (most recent last)
        period: Smoothing period for ADX calculation (default: 14)

    Returns:
        Dictionary containing:
            - plus_di: +DI (Positive Directional Indicator)
            - minus_di: -DI (Negative Directional Indicator)
            - adx: ADX value (trend strength, 0-100)

    Raises:
        ValueError: If input lists have different lengths, insufficient data, or invalid period

    Example:
        >>> highs = [48.7, 48.72, 48.9, 48.87, 48.82, ...]
        >>> lows = [47.79, 48.14, 48.39, 48.37, 48.24, ...]
        >>> closes = [48.16, 48.61, 48.75, 48.63, 48.74, ...]
        >>> result = calculate_adx(highs, lows, closes, period=14)
        >>> print(f"ADX: {result['adx']:.2f}")
        >>> print(f"+DI: {result['plus_di']:.2f}")
        >>> print(f"-DI: {result['minus_di']:.2f}")
    """
    # Validation
    if period <= 0:
        raise ValueError(f"Period must be positive, got {period}")

    if len(highs) != len(lows) or len(highs) != len(closes):
        raise ValueError(
            f"All input lists must have the same length. "
            f"Got highs={len(highs)}, lows={len(lows)}, closes={len(closes)}"
        )

    # Need at least 2 * period + 1 data points for proper ADX calculation
    min_required = 2 * period + 1
    if len(highs) < min_required:
        raise ValueError(
            f"Need at least {min_required} data points for ADX-{period} calculation, "
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

    # Initialize lists for storing calculations
    plus_dm_list = []
    minus_dm_list = []
    tr_list = []

    # Calculate directional movements and true range for each period
    for i in range(1, len(highs_arr)):
        # Calculate +DM and -DM
        plus_dm, minus_dm = calculate_directional_movement(
            highs_arr[i], highs_arr[i - 1], lows_arr[i], lows_arr[i - 1]
        )
        plus_dm_list.append(plus_dm)
        minus_dm_list.append(minus_dm)

        # Calculate TR
        tr = calculate_true_range(highs_arr[i], lows_arr[i], closes_arr[i - 1])
        tr_list.append(tr)

    # Convert to numpy arrays
    plus_dm_arr = np.array(plus_dm_list)
    minus_dm_arr = np.array(minus_dm_list)
    tr_arr = np.array(tr_list)

    # Calculate smoothed values using Wilder's smoothing method
    # Initial smoothed value = sum of first 'period' values
    smoothed_plus_dm = np.sum(plus_dm_arr[:period])
    smoothed_minus_dm = np.sum(minus_dm_arr[:period])
    smoothed_tr = np.sum(tr_arr[:period])

    # Apply Wilder's smoothing for subsequent values
    for i in range(period, len(plus_dm_arr)):
        smoothed_plus_dm = (
            smoothed_plus_dm - (smoothed_plus_dm / period) + plus_dm_arr[i]
        )
        smoothed_minus_dm = (
            smoothed_minus_dm - (smoothed_minus_dm / period) + minus_dm_arr[i]
        )
        smoothed_tr = smoothed_tr - (smoothed_tr / period) + tr_arr[i]

    # Calculate +DI and -DI
    if smoothed_tr == 0:
        plus_di = 0.0
        minus_di = 0.0
    else:
        plus_di = 100.0 * (smoothed_plus_dm / smoothed_tr)
        minus_di = 100.0 * (smoothed_minus_dm / smoothed_tr)

    # Calculate DX (Directional Index)
    di_sum = plus_di + minus_di
    if di_sum == 0:
        dx = 0.0
    else:
        dx = 100.0 * abs(plus_di - minus_di) / di_sum

    # Calculate ADX (smoothed average of DX values)
    # We need to calculate DX for each period and then smooth them
    dx_list = []

    # Recalculate for all periods to get DX series
    for i in range(period, len(plus_dm_arr) + 1):
        # Calculate smoothed values for this window
        if i == period:
            sm_plus_dm = np.sum(plus_dm_arr[:period])
            sm_minus_dm = np.sum(minus_dm_arr[:period])
            sm_tr = np.sum(tr_arr[:period])
        else:
            sm_plus_dm = sm_plus_dm - (sm_plus_dm / period) + plus_dm_arr[i - 1]
            sm_minus_dm = sm_minus_dm - (sm_minus_dm / period) + minus_dm_arr[i - 1]
            sm_tr = sm_tr - (sm_tr / period) + tr_arr[i - 1]

        # Calculate DI
        if sm_tr == 0:
            temp_plus_di = 0.0
            temp_minus_di = 0.0
        else:
            temp_plus_di = 100.0 * (sm_plus_dm / sm_tr)
            temp_minus_di = 100.0 * (sm_minus_dm / sm_tr)

        # Calculate DX
        temp_di_sum = temp_plus_di + temp_minus_di
        if temp_di_sum == 0:
            temp_dx = 0.0
        else:
            temp_dx = 100.0 * abs(temp_plus_di - temp_minus_di) / temp_di_sum

        dx_list.append(temp_dx)

    # Calculate ADX as smoothed average of DX values
    if len(dx_list) >= period:
        # Initial ADX = average of first 'period' DX values
        adx = np.mean(dx_list[:period])

        # Apply Wilder's smoothing for remaining values
        for i in range(period, len(dx_list)):
            adx = (adx * (period - 1) + dx_list[i]) / period
    else:
        adx = dx_list[-1] if dx_list else 0.0

    return {"plus_di": float(plus_di), "minus_di": float(minus_di), "adx": float(adx)}


def calculate_adx_series(
    highs: List[float], lows: List[float], closes: List[float], period: int = 14
) -> Dict[str, List[float]]:
    """
    Calculate ADX and directional indicators for entire price series.

    This function returns the full +DI, -DI, and ADX series rather than just
    the most recent values. Useful for charting and time series analysis.

    Args:
        highs: List of high prices (most recent last)
        lows: List of low prices (most recent last)
        closes: List of close prices (most recent last)
        period: Smoothing period for ADX calculation (default: 14)

    Returns:
        Dictionary containing:
            - plus_di: List of +DI values
            - minus_di: List of -DI values
            - adx: List of ADX values

    Raises:
        ValueError: If input lists have different lengths, insufficient data, or invalid period
    """
    # Validation
    if period <= 0:
        raise ValueError(f"Period must be positive, got {period}")

    if len(highs) != len(lows) or len(highs) != len(closes):
        raise ValueError(
            f"All input lists must have the same length. "
            f"Got highs={len(highs)}, lows={len(lows)}, closes={len(closes)}"
        )

    min_required = 2 * period + 1
    if len(highs) < min_required:
        raise ValueError(
            f"Need at least {min_required} data points for ADX-{period} calculation, "
            f"got {len(highs)}"
        )

    # Use pandas for easier calculations
    df = pd.DataFrame({"high": highs, "low": lows, "close": closes})

    # Calculate directional movements
    df["prev_high"] = df["high"].shift(1)
    df["prev_low"] = df["low"].shift(1)
    df["prev_close"] = df["close"].shift(1)

    # Calculate +DM and -DM
    df["up_move"] = df["high"] - df["prev_high"]
    df["down_move"] = df["prev_low"] - df["low"]

    df["plus_dm"] = 0.0
    df["minus_dm"] = 0.0

    # Apply directional movement rules
    df.loc[(df["up_move"] > df["down_move"]) & (df["up_move"] > 0), "plus_dm"] = df[
        "up_move"
    ]
    df.loc[(df["down_move"] > df["up_move"]) & (df["down_move"] > 0), "minus_dm"] = df[
        "down_move"
    ]

    # Calculate True Range
    df["tr1"] = df["high"] - df["low"]
    df["tr2"] = abs(df["high"] - df["prev_close"])
    df["tr3"] = abs(df["low"] - df["prev_close"])
    df["tr"] = df[["tr1", "tr2", "tr3"]].max(axis=1)

    # Calculate smoothed values using Wilder's smoothing
    df["smoothed_plus_dm"] = df["plus_dm"].ewm(alpha=1 / period, adjust=False).mean()
    df["smoothed_minus_dm"] = df["minus_dm"].ewm(alpha=1 / period, adjust=False).mean()
    df["smoothed_tr"] = df["tr"].ewm(alpha=1 / period, adjust=False).mean()

    # Calculate +DI and -DI
    df["plus_di"] = 100.0 * (df["smoothed_plus_dm"] / df["smoothed_tr"])
    df["minus_di"] = 100.0 * (df["smoothed_minus_dm"] / df["smoothed_tr"])

    # Calculate DX
    df["di_sum"] = df["plus_di"] + df["minus_di"]
    df["di_diff"] = abs(df["plus_di"] - df["minus_di"])
    df["dx"] = 100.0 * (df["di_diff"] / df["di_sum"])

    # Handle division by zero
    df["dx"] = df["dx"].fillna(0.0)
    df["plus_di"] = df["plus_di"].fillna(0.0)
    df["minus_di"] = df["minus_di"].fillna(0.0)

    # Calculate ADX (smoothed average of DX)
    df["adx"] = df["dx"].ewm(alpha=1 / period, adjust=False).mean()

    return {
        "plus_di": df["plus_di"].tolist(),
        "minus_di": df["minus_di"].tolist(),
        "adx": df["adx"].tolist(),
    }
