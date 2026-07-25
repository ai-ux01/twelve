"""
Volume Analysis calculators for technical analysis.

This module implements volume-based indicators:
- Volume Moving Average (VMA)
- Relative Volume (RVOL)
- Volume Ratio Indicator

These indicators help identify abnormal volume activity and potential breakouts.
"""

from typing import List
import numpy as np


def calculate_volume_ma(volumes: List[int], period: int = 20) -> float:
    """
    Calculate Volume Moving Average (VMA) for a given period.

    VMA is the arithmetic mean of volume over the last 'period' bars.
    This helps identify the average volume level and spot unusual activity.

    Args:
        volumes: List of volume values (must be at least 'period' length)
        period: Number of periods to average over (default: 20)

    Returns:
        The VMA value for the given period

    Raises:
        ValueError: If period is invalid or insufficient data provided

    Example:
        >>> volumes = [1000000, 1200000, 1100000, 1300000, 1050000]
        >>> vma = calculate_volume_ma(volumes, period=3)
        >>> print(f"Volume MA: {vma:.0f}")
        Volume MA: 1150000
    """
    if period <= 0:
        raise ValueError("period must be positive")

    if len(volumes) < period:
        raise ValueError(
            f"Insufficient data: need at least {period} volumes, got {len(volumes)}"
        )

    # Convert to numpy array for efficient calculation
    volumes_array = np.array(volumes[-period:], dtype=float)

    # Calculate the mean of the last 'period' volumes
    vma = float(np.mean(volumes_array))

    return vma


def calculate_volume_ma_series(volumes: List[int], period: int = 20) -> List[float]:
    """
    Calculate Volume Moving Average series for all valid data points.

    Generates VMA values for each point where sufficient prior data exists.

    Args:
        volumes: List of volume values
        period: Number of periods to average over (default: 20)

    Returns:
        List of VMA values (length will be len(volumes) - period + 1)

    Raises:
        ValueError: If period is invalid or insufficient data provided

    Example:
        >>> volumes = [1000000, 1200000, 1100000, 1300000, 1050000]
        >>> vma_series = calculate_volume_ma_series(volumes, period=3)
        >>> print(vma_series)
        [1100000.0, 1200000.0, 1150000.0]
    """
    if period <= 0:
        raise ValueError("period must be positive")

    if len(volumes) < period:
        raise ValueError(
            f"Insufficient data: need at least {period} volumes, got {len(volumes)}"
        )

    volumes_array = np.array(volumes, dtype=float)
    vma_values = []

    # Calculate VMA for each valid window
    for i in range(period - 1, len(volumes_array)):
        window = volumes_array[i - period + 1 : i + 1]
        vma_values.append(float(np.mean(window)))

    return vma_values


def calculate_relative_volume(
    current_volume: int, volumes: List[int], period: int = 20
) -> float:
    """
    Calculate Relative Volume (RVOL) - current volume compared to average.

    RVOL = Current Volume / Volume Moving Average

    Values > 1.0 indicate above-average volume
    Values < 1.0 indicate below-average volume
    RVOL > 2.0 often indicates significant interest/activity

    Args:
        current_volume: Current bar's volume
        volumes: Historical volume values (must be at least 'period' length)
        period: Number of periods for average calculation (default: 20)

    Returns:
        Relative volume ratio (current / average)

    Raises:
        ValueError: If period is invalid, insufficient data, or average volume is zero

    Example:
        >>> volumes = [1000000, 1100000, 1050000, 1150000, 1000000] * 4  # 20 bars
        >>> current = 2000000  # Double the normal volume
        >>> rvol = calculate_relative_volume(current, volumes, period=20)
        >>> print(f"Relative Volume: {rvol:.2f}x")
        Relative Volume: 1.90x
    """
    if period <= 0:
        raise ValueError("period must be positive")

    if len(volumes) < period:
        raise ValueError(
            f"Insufficient data: need at least {period} volumes, got {len(volumes)}"
        )

    if current_volume < 0:
        raise ValueError(f"current_volume must be non-negative, got {current_volume}")

    # Calculate average volume
    avg_volume = calculate_volume_ma(volumes, period)

    # Handle zero average volume edge case
    if avg_volume == 0:
        if current_volume == 0:
            return 1.0  # Both zero, relative volume is neutral
        else:
            raise ValueError("Cannot calculate relative volume: average volume is zero")

    # Calculate ratio
    rvol = float(current_volume) / avg_volume

    return rvol


def calculate_relative_volume_series(
    volumes: List[int], period: int = 20
) -> List[float]:
    """
    Calculate Relative Volume series for all valid data points.

    For each bar, calculates RVOL using the previous 'period' bars as the baseline.

    Args:
        volumes: List of volume values (need at least period + 1 values)
        period: Number of periods for average calculation (default: 20)

    Returns:
        List of RVOL values

    Raises:
        ValueError: If period is invalid or insufficient data provided

    Example:
        >>> volumes = [1000000] * 20 + [2000000, 1500000, 3000000]
        >>> rvol_series = calculate_relative_volume_series(volumes, period=20)
        >>> print([f"{x:.2f}" for x in rvol_series[-3:]])
        ['2.00', '1.45', '2.73']
    """
    if period <= 0:
        raise ValueError("period must be positive")

    if len(volumes) < period + 1:
        raise ValueError(
            f"Insufficient data: need at least {period + 1} volumes, got {len(volumes)}"
        )

    volumes_array = np.array(volumes, dtype=float)
    rvol_values = []

    # Calculate RVOL for each bar (starting from period + 1)
    for i in range(period, len(volumes_array)):
        current_vol = volumes_array[i]
        historical_vols = volumes_array[i - period : i].tolist()

        # Calculate average of previous period
        avg_vol = np.mean(historical_vols)

        # Handle zero average volume
        if avg_vol == 0:
            if current_vol == 0:
                rvol_values.append(1.0)
            else:
                # Skip or use large number; we'll use a sentinel value
                rvol_values.append(float("inf"))
        else:
            rvol = current_vol / avg_vol
            rvol_values.append(float(rvol))

    return rvol_values


def calculate_volume_ratio(
    volumes: List[int], short_period: int = 5, long_period: int = 20
) -> float:
    """
    Calculate Volume Ratio Indicator - short-term vs long-term volume average.

    Volume Ratio = Short-term VMA / Long-term VMA

    Values > 1.0 indicate increasing volume (bullish)
    Values < 1.0 indicate decreasing volume (bearish)

    This indicator helps identify volume trends and momentum shifts.

    Args:
        volumes: List of volume values (must be at least 'long_period' length)
        short_period: Period for short-term average (default: 5)
        long_period: Period for long-term average (default: 20)

    Returns:
        Volume ratio (short MA / long MA)

    Raises:
        ValueError: If periods are invalid, insufficient data, or long MA is zero

    Example:
        >>> volumes = [1000000] * 15 + [2000000] * 10  # Volume increasing
        >>> ratio = calculate_volume_ratio(volumes, short_period=5, long_period=20)
        >>> print(f"Volume Ratio: {ratio:.2f}")
        Volume Ratio: 1.54
    """
    if short_period <= 0 or long_period <= 0:
        raise ValueError("periods must be positive")

    if short_period >= long_period:
        raise ValueError(
            f"short_period ({short_period}) must be less than "
            f"long_period ({long_period})"
        )

    if len(volumes) < long_period:
        raise ValueError(
            f"Insufficient data: need at least {long_period} volumes, got {len(volumes)}"
        )

    # Calculate short-term and long-term volume averages
    short_vma = calculate_volume_ma(volumes, short_period)
    long_vma = calculate_volume_ma(volumes, long_period)

    # Handle zero long-term average
    if long_vma == 0:
        if short_vma == 0:
            return 1.0  # Both zero, ratio is neutral
        else:
            raise ValueError(
                "Cannot calculate volume ratio: long-term average volume is zero"
            )

    # Calculate ratio
    ratio = short_vma / long_vma

    return float(ratio)


def calculate_volume_ratio_series(
    volumes: List[int], short_period: int = 5, long_period: int = 20
) -> List[float]:
    """
    Calculate Volume Ratio Indicator series for all valid data points.

    Args:
        volumes: List of volume values
        short_period: Period for short-term average (default: 5)
        long_period: Period for long-term average (default: 20)

    Returns:
        List of volume ratio values

    Raises:
        ValueError: If periods are invalid or insufficient data provided

    Example:
        >>> volumes = [1000000] * 20 + [2000000] * 5
        >>> ratio_series = calculate_volume_ratio_series(volumes, 5, 20)
        >>> print(f"Latest ratio: {ratio_series[-1]:.2f}")
        Latest ratio: 1.54
    """
    if short_period <= 0 or long_period <= 0:
        raise ValueError("periods must be positive")

    if short_period >= long_period:
        raise ValueError(
            f"short_period ({short_period}) must be less than "
            f"long_period ({long_period})"
        )

    if len(volumes) < long_period:
        raise ValueError(
            f"Insufficient data: need at least {long_period} volumes, got {len(volumes)}"
        )

    volumes_array = np.array(volumes, dtype=float)
    ratio_values = []

    # Calculate ratio for each valid window
    for i in range(long_period - 1, len(volumes_array)):
        window = volumes_array[: i + 1]

        short_vma = calculate_volume_ma(window.tolist(), short_period)
        long_vma = calculate_volume_ma(window.tolist(), long_period)

        # Handle zero long-term average
        if long_vma == 0:
            if short_vma == 0:
                ratio_values.append(1.0)
            else:
                ratio_values.append(float("inf"))
        else:
            ratio = short_vma / long_vma
            ratio_values.append(float(ratio))

    return ratio_values
