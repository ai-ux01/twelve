"""
VWAP (Volume Weighted Average Price) calculator.

VWAP is a trading indicator that gives the average price a security has traded at
throughout the day, based on both volume and price. It provides important information
about both the trend and value of a security.

Formula:
    VWAP = Cumulative(Typical Price * Volume) / Cumulative(Volume)
    where Typical Price = (High + Low + Close) / 3
"""

from typing import List, Tuple, Optional
import numpy as np


def calculate_vwap(
    highs: List[float],
    lows: List[float],
    closes: List[float],
    volumes: List[float],
    session_starts: Optional[List[bool]] = None,
) -> float:
    """
    Calculate Volume Weighted Average Price (VWAP).

    VWAP is typically calculated for intraday data and resets at the start of each
    trading session. The typical price is the average of high, low, and close.

    Args:
        highs: List of high prices
        lows: List of low prices
        closes: List of closing prices
        volumes: List of volume values
        session_starts: Optional list of booleans indicating session start points.
                       If provided, VWAP resets at each True value.
                       If None, calculates cumulative VWAP for entire period.

    Returns:
        float: The current VWAP value

    Raises:
        ValueError: If input lists have different lengths or invalid data

    Example:
        >>> highs = [100, 102, 104]
        >>> lows = [98, 100, 102]
        >>> closes = [99, 101, 103]
        >>> volumes = [1000, 1500, 2000]
        >>> vwap = calculate_vwap(highs, lows, closes, volumes)
        >>> print(f"VWAP: {vwap:.2f}")
        VWAP: 101.44
    """
    # Validation
    if not (len(highs) == len(lows) == len(closes) == len(volumes)):
        raise ValueError(
            f"All input lists must have the same length. "
            f"Got highs={len(highs)}, lows={len(lows)}, "
            f"closes={len(closes)}, volumes={len(volumes)}"
        )

    if len(highs) == 0:
        raise ValueError("Input lists cannot be empty")

    if session_starts is not None and len(session_starts) != len(highs):
        raise ValueError(
            f"session_starts length ({len(session_starts)}) must match "
            f"price data length ({len(highs)})"
        )

    # Convert to numpy arrays
    highs_array = np.array(highs, dtype=float)
    lows_array = np.array(lows, dtype=float)
    closes_array = np.array(closes, dtype=float)
    volumes_array = np.array(volumes, dtype=float)

    # Validate price relationships (high >= low)
    if np.any(highs_array < lows_array):
        raise ValueError("High prices must be greater than or equal to low prices")

    # Validate volumes are non-negative
    if np.any(volumes_array < 0):
        raise ValueError("Volumes must be non-negative")

    # Calculate typical price
    typical_prices = (highs_array + lows_array + closes_array) / 3.0

    # Handle session resets
    if session_starts is not None:
        session_starts_array = np.array(session_starts, dtype=bool)

        # Find the last session start
        session_indices = np.where(session_starts_array)[0]
        if len(session_indices) > 0:
            last_session_start = session_indices[-1]
        else:
            # No session start found, use entire period
            last_session_start = 0

        # Calculate VWAP from last session start
        typical_prices = typical_prices[last_session_start:]
        volumes_array = volumes_array[last_session_start:]

    # Calculate cumulative price * volume and cumulative volume
    cumulative_pv = np.sum(typical_prices * volumes_array)
    cumulative_volume = np.sum(volumes_array)

    # Handle zero volume case
    if cumulative_volume == 0:
        # Return the last typical price if no volume
        return float(typical_prices[-1])

    vwap = cumulative_pv / cumulative_volume

    return float(vwap)


def calculate_vwap_series(
    highs: List[float],
    lows: List[float],
    closes: List[float],
    volumes: List[float],
    session_starts: Optional[List[bool]] = None,
) -> List[float]:
    """
    Calculate VWAP values for an entire price series.

    This generates VWAP values for each time point, resetting at session starts
    if provided.

    Args:
        highs: List of high prices
        lows: List of low prices
        closes: List of closing prices
        volumes: List of volume values
        session_starts: Optional list of booleans indicating session start points

    Returns:
        List[float]: List of VWAP values for each time point

    Raises:
        ValueError: If input lists have different lengths or invalid data

    Example:
        >>> highs = [100, 102, 104, 106]
        >>> lows = [98, 100, 102, 104]
        >>> closes = [99, 101, 103, 105]
        >>> volumes = [1000, 1500, 2000, 1800]
        >>> vwap_series = calculate_vwap_series(highs, lows, closes, volumes)
        >>> for i, vwap in enumerate(vwap_series):
        ...     print(f"Period {i}: VWAP = {vwap:.2f}")
    """
    # Validation
    if not (len(highs) == len(lows) == len(closes) == len(volumes)):
        raise ValueError(
            f"All input lists must have the same length. "
            f"Got highs={len(highs)}, lows={len(lows)}, "
            f"closes={len(closes)}, volumes={len(volumes)}"
        )

    if len(highs) == 0:
        raise ValueError("Input lists cannot be empty")

    if session_starts is not None and len(session_starts) != len(highs):
        raise ValueError(
            f"session_starts length ({len(session_starts)}) must match "
            f"price data length ({len(highs)})"
        )

    # Convert to numpy arrays
    highs_array = np.array(highs, dtype=float)
    lows_array = np.array(lows, dtype=float)
    closes_array = np.array(closes, dtype=float)
    volumes_array = np.array(volumes, dtype=float)

    # Validate price relationships
    if np.any(highs_array < lows_array):
        raise ValueError("High prices must be greater than or equal to low prices")

    # Validate volumes are non-negative
    if np.any(volumes_array < 0):
        raise ValueError("Volumes must be non-negative")

    # Calculate typical prices
    typical_prices = (highs_array + lows_array + closes_array) / 3.0

    vwap_series = []

    # Initialize accumulators
    cumulative_pv = 0.0
    cumulative_volume = 0.0

    for i in range(len(typical_prices)):
        # Reset at session start
        if session_starts is not None and session_starts[i]:
            cumulative_pv = 0.0
            cumulative_volume = 0.0

        # Accumulate
        cumulative_pv += typical_prices[i] * volumes_array[i]
        cumulative_volume += volumes_array[i]

        # Calculate VWAP
        if cumulative_volume > 0:
            vwap = cumulative_pv / cumulative_volume
        else:
            # If no volume yet, use typical price
            vwap = typical_prices[i]

        vwap_series.append(float(vwap))

    return vwap_series


def calculate_vwap_with_bands(
    highs: List[float],
    lows: List[float],
    closes: List[float],
    volumes: List[float],
    num_std_dev: float = 1.0,
    session_starts: Optional[List[bool]] = None,
) -> Tuple[float, float, float]:
    """
    Calculate VWAP with upper and lower bands based on standard deviation.

    This is similar to Bollinger Bands but for VWAP, providing bands that show
    potential overbought/oversold conditions relative to the volume-weighted price.

    Args:
        highs: List of high prices
        lows: List of low prices
        closes: List of closing prices
        volumes: List of volume values
        num_std_dev: Number of standard deviations for the bands (default 1.0)
        session_starts: Optional list of booleans indicating session start points

    Returns:
        Tuple[float, float, float]: (vwap, upper_band, lower_band)

    Raises:
        ValueError: If input lists have different lengths or invalid data

    Example:
        >>> highs = [100, 102, 104, 106]
        >>> lows = [98, 100, 102, 104]
        >>> closes = [99, 101, 103, 105]
        >>> volumes = [1000, 1500, 2000, 1800]
        >>> vwap, upper, lower = calculate_vwap_with_bands(highs, lows, closes, volumes)
        >>> print(f"VWAP: {vwap:.2f}, Upper: {upper:.2f}, Lower: {lower:.2f}")
    """
    # Calculate VWAP
    vwap = calculate_vwap(highs, lows, closes, volumes, session_starts)

    # Convert to numpy arrays
    highs_array = np.array(highs, dtype=float)
    lows_array = np.array(lows, dtype=float)
    closes_array = np.array(closes, dtype=float)
    volumes_array = np.array(volumes, dtype=float)

    # Handle session resets
    if session_starts is not None:
        session_starts_array = np.array(session_starts, dtype=bool)
        session_indices = np.where(session_starts_array)[0]
        if len(session_indices) > 0:
            last_session_start = session_indices[-1]
        else:
            last_session_start = 0

        highs_array = highs_array[last_session_start:]
        lows_array = lows_array[last_session_start:]
        closes_array = closes_array[last_session_start:]
        volumes_array = volumes_array[last_session_start:]

    # Calculate typical prices
    typical_prices = (highs_array + lows_array + closes_array) / 3.0

    # Calculate volume-weighted variance
    cumulative_volume = np.sum(volumes_array)
    if cumulative_volume > 0:
        # Calculate squared deviations from VWAP weighted by volume
        squared_deviations = ((typical_prices - vwap) ** 2) * volumes_array
        variance = np.sum(squared_deviations) / cumulative_volume
        std_dev = np.sqrt(variance)
    else:
        std_dev = 0.0

    # Calculate bands
    upper_band = vwap + (num_std_dev * std_dev)
    lower_band = vwap - (num_std_dev * std_dev)

    return float(vwap), float(upper_band), float(lower_band)
