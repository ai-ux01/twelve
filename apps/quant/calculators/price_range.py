"""
Price Range calculators.

This module provides calculators for price range analysis including:
- 52-week high and low detection
- Distance from 52-week high/low (percentage)
- Momentum indicator (rate of change)

These metrics help identify price positioning and momentum characteristics for trading decisions.
"""

import numpy as np
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta


def calculate_52_week_high_low(
    prices: List[float],
    timestamps: Optional[List[datetime]] = None,
    lookback_days: int = 365,
) -> Dict[str, float]:
    """
    Calculate 52-week (or custom period) high and low from historical data.

    This function identifies the highest and lowest prices over the specified
    lookback period (default 365 days for 52 weeks).

    Args:
        prices: List of prices (typically closing prices)
        timestamps: Optional list of datetime objects corresponding to each price.
                   If provided, will use actual time-based filtering.
                   If None, assumes all prices are within the lookback period.
        lookback_days: Number of days to look back (default 365 for 52 weeks)

    Returns:
        Dictionary containing:
            - high_52w: 52-week high price
            - low_52w: 52-week low price

    Raises:
        ValueError: If prices list is empty or lookback_days is invalid

    Example:
        >>> prices = [100, 105, 98, 110, 95, 108, 102]
        >>> result = calculate_52_week_high_low(prices)
        >>> print(f"52W High: {result['high_52w']}, 52W Low: {result['low_52w']}")
        52W High: 110, 52W Low: 95
    """
    if not prices:
        raise ValueError("Prices list cannot be empty")

    if lookback_days <= 0:
        raise ValueError(f"Lookback days must be positive, got {lookback_days}")

    # Convert to numpy array for efficient calculation
    prices_array = np.array(prices, dtype=float)

    # Filter by timestamp if provided
    if timestamps is not None:
        if len(timestamps) != len(prices):
            raise ValueError(
                f"Timestamps and prices must have same length. "
                f"Got timestamps={len(timestamps)}, prices={len(prices)}"
            )

        # Get cutoff date
        latest_date = timestamps[-1]
        cutoff_date = latest_date - timedelta(days=lookback_days)

        # Filter prices within lookback period
        filtered_prices = [
            price for price, ts in zip(prices, timestamps) if ts >= cutoff_date
        ]

        if not filtered_prices:
            raise ValueError(
                f"No prices found within {lookback_days} days lookback period"
            )

        prices_array = np.array(filtered_prices, dtype=float)

    # Calculate high and low
    high_52w = float(np.max(prices_array))
    low_52w = float(np.min(prices_array))

    return {"high_52w": high_52w, "low_52w": low_52w}


def calculate_distance_from_extremes(
    current_price: float, high_52w: float, low_52w: float
) -> Dict[str, float]:
    """
    Calculate percentage distance from 52-week high and low.

    These metrics help identify whether the stock is trading near its highs,
    lows, or somewhere in between. Values closer to 0% from high indicate
    the stock is near its peak, while values closer to 0% from low indicate
    it's near its bottom.

    Args:
        current_price: Current price of the asset
        high_52w: 52-week high price
        low_52w: 52-week low price

    Returns:
        Dictionary containing:
            - distance_from_high_pct: Percentage distance from 52W high (negative value)
            - distance_from_low_pct: Percentage distance from 52W low (positive value)
            - position_in_range_pct: Position within 52W range (0-100%)

    Raises:
        ValueError: If prices are invalid (negative, or high < low)

    Example:
        >>> current = 105
        >>> high = 110
        >>> low = 95
        >>> result = calculate_distance_from_extremes(current, high, low)
        >>> print(f"Distance from high: {result['distance_from_high_pct']:.2f}%")
        >>> print(f"Distance from low: {result['distance_from_low_pct']:.2f}%")
        Distance from high: -4.55%
        Distance from low: 10.53%
    """
    # Validation
    if current_price <= 0 or high_52w <= 0 or low_52w <= 0:
        raise ValueError("All prices must be positive")

    if high_52w < low_52w:
        raise ValueError(f"52W high ({high_52w}) must be >= 52W low ({low_52w})")

    # Calculate distance from high (typically negative or zero)
    distance_from_high_pct = ((current_price - high_52w) / high_52w) * 100.0

    # Calculate distance from low (typically positive or zero)
    distance_from_low_pct = ((current_price - low_52w) / low_52w) * 100.0

    # Calculate position within range (0% = at low, 100% = at high)
    if high_52w == low_52w:
        # Edge case: if high and low are the same
        position_in_range_pct = 50.0
    else:
        position_in_range_pct = (
            (current_price - low_52w) / (high_52w - low_52w)
        ) * 100.0

    # Clamp position to 0-100% range (in case current price is outside 52W range)
    position_in_range_pct = max(0.0, min(100.0, position_in_range_pct))

    return {
        "distance_from_high_pct": float(distance_from_high_pct),
        "distance_from_low_pct": float(distance_from_low_pct),
        "position_in_range_pct": float(position_in_range_pct),
    }


def calculate_momentum(prices: List[float], period: int = 10) -> float:
    """
    Calculate momentum indicator (rate of change).

    Momentum measures the rate of change in price over a specified period.
    It's calculated as: ((Current Price - Price N periods ago) / Price N periods ago) * 100

    Positive momentum indicates upward price movement, while negative momentum
    indicates downward price movement. The magnitude indicates the strength of the move.

    Args:
        prices: List of prices (most recent last)
        period: Lookback period for momentum calculation (default 10)

    Returns:
        float: Momentum as percentage change over the period

    Raises:
        ValueError: If insufficient data or invalid period

    Example:
        >>> prices = [100, 102, 101, 105, 108, 107, 110, 112, 111, 115, 118]
        >>> momentum = calculate_momentum(prices, period=10)
        >>> print(f"Momentum: {momentum:.2f}%")
        Momentum: 18.00%
    """
    # Validation
    if period <= 0:
        raise ValueError(f"Period must be positive, got {period}")

    if len(prices) < period + 1:
        raise ValueError(
            f"Need at least {period + 1} prices for momentum calculation, "
            f"got {len(prices)}"
        )

    # Validate prices are positive
    if any(p <= 0 for p in prices):
        raise ValueError("All prices must be positive")

    # Get current price and price N periods ago
    current_price = prices[-1]
    past_price = prices[-(period + 1)]

    # Calculate rate of change
    momentum = ((current_price - past_price) / past_price) * 100.0

    return float(momentum)


def calculate_momentum_series(prices: List[float], period: int = 10) -> List[float]:
    """
    Calculate momentum indicator series for entire price history.

    Returns momentum values for each point in the price series (after the
    initial period required for calculation).

    Args:
        prices: List of prices (most recent last)
        period: Lookback period for momentum calculation (default 10)

    Returns:
        List[float]: List of momentum values (NaN for first 'period' values)

    Raises:
        ValueError: If insufficient data or invalid period

    Example:
        >>> prices = [100, 102, 101, 105, 108, 107, 110, 112, 111, 115, 118]
        >>> momentum_series = calculate_momentum_series(prices, period=5)
        >>> print(f"Latest momentum: {momentum_series[-1]:.2f}%")
    """
    # Validation
    if period <= 0:
        raise ValueError(f"Period must be positive, got {period}")

    if len(prices) < period + 1:
        raise ValueError(
            f"Need at least {period + 1} prices for momentum calculation, "
            f"got {len(prices)}"
        )

    # Validate prices are positive
    if any(p <= 0 for p in prices):
        raise ValueError("All prices must be positive")

    # Convert to numpy array
    prices_array = np.array(prices, dtype=float)

    # Initialize result with NaNs for the first 'period' values
    momentum_list = [np.nan] * period

    # Calculate momentum for each point
    for i in range(period, len(prices_array)):
        current = prices_array[i]
        past = prices_array[i - period]
        momentum = ((current - past) / past) * 100.0
        momentum_list.append(momentum)

    return momentum_list


def calculate_price_range_analysis(
    prices: List[float],
    timestamps: Optional[List[datetime]] = None,
    lookback_days: int = 365,
    momentum_period: int = 10,
) -> Dict[str, float]:
    """
    Complete price range analysis combining 52-week highs/lows, distances, and momentum.

    This is a convenience function that calculates all price range metrics in one call.

    Args:
        prices: List of prices (most recent last)
        timestamps: Optional list of datetime objects for time-based filtering
        lookback_days: Number of days for high/low calculation (default 365)
        momentum_period: Period for momentum calculation (default 10)

    Returns:
        Dictionary containing all price range metrics:
            - high_52w: 52-week high
            - low_52w: 52-week low
            - current_price: Most recent price
            - distance_from_high_pct: % distance from 52W high
            - distance_from_low_pct: % distance from 52W low
            - position_in_range_pct: Position in 52W range (0-100%)
            - momentum: Rate of change over momentum_period

    Raises:
        ValueError: If insufficient data or invalid parameters

    Example:
        >>> prices = [95, 100, 105, 98, 110, 95, 108, 102, 107, 112, 109]
        >>> result = calculate_price_range_analysis(prices, momentum_period=5)
        >>> print(f"52W High: {result['high_52w']:.2f}")
        >>> print(f"Position in range: {result['position_in_range_pct']:.2f}%")
        >>> print(f"Momentum: {result['momentum']:.2f}%")
    """
    if not prices:
        raise ValueError("Prices list cannot be empty")

    # Calculate 52-week high and low
    high_low = calculate_52_week_high_low(prices, timestamps, lookback_days)

    # Get current price
    current_price = prices[-1]

    # Calculate distances from extremes
    distances = calculate_distance_from_extremes(
        current_price, high_low["high_52w"], high_low["low_52w"]
    )

    # Calculate momentum
    momentum = calculate_momentum(prices, momentum_period)

    # Combine all results
    return {
        "high_52w": high_low["high_52w"],
        "low_52w": high_low["low_52w"],
        "current_price": float(current_price),
        "distance_from_high_pct": distances["distance_from_high_pct"],
        "distance_from_low_pct": distances["distance_from_low_pct"],
        "position_in_range_pct": distances["position_in_range_pct"],
        "momentum": momentum,
    }
