"""
Support and Resistance Level Detection for Quant Engine.

This module implements a clustering-based algorithm to identify significant
support and resistance levels from historical price data. The algorithm:

1. Identifies local price extrema (swing highs and lows)
2. Clusters nearby price levels using tolerance-based grouping
3. Calculates strength scores based on number of touches and volume
4. Returns levels sorted by strength

These levels represent significant price points where price has historically
reversed, which are useful for trading decisions.
"""

import numpy as np
import pandas as pd
from typing import List, Tuple
from models import SupportResistanceLevel, OHLCVData


def find_local_extrema(
    prices: np.ndarray, window: int = 5
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Find local minima (support) and maxima (resistance) in price data.

    Uses a rolling window approach to identify local extrema where the center
    value is the minimum/maximum within its window.

    Args:
        prices: Array of prices (typically close prices)
        window: Size of the window for local extrema detection (default 5)

    Returns:
        Tuple of (local_minima_indices, local_maxima_indices)
    """
    local_minima = []
    local_maxima = []

    # Need at least window+1 data points
    if len(prices) <= window:
        return np.array(local_minima), np.array(local_maxima)

    half_window = window // 2

    # Check each point (excluding edges)
    for i in range(half_window, len(prices) - half_window):
        window_start = i - half_window
        window_end = i + half_window + 1
        window_slice = prices[window_start:window_end]

        # Local minimum: center is the smallest value in window
        if prices[i] == np.min(window_slice):
            local_minima.append(i)

        # Local maximum: center is the largest value in window
        if prices[i] == np.max(window_slice):
            local_maxima.append(i)

    return np.array(local_minima), np.array(local_maxima)


def cluster_levels(
    price_points: List[float], tolerance_pct: float = 0.02
) -> List[Tuple[float, int]]:
    """
    Cluster nearby price levels together using tolerance-based grouping.

    Price points within tolerance_pct of each other are grouped into the same
    cluster. Returns the average price for each cluster and the number of touches.

    Args:
        price_points: List of price values to cluster
        tolerance_pct: Percentage tolerance for clustering (default 2%)

    Returns:
        List of tuples (cluster_price_level, touch_count)
    """
    if not price_points:
        return []

    # Sort prices for efficient clustering
    sorted_prices = sorted(price_points)
    clusters = []
    current_cluster = [sorted_prices[0]]

    for price in sorted_prices[1:]:
        # Calculate the reference price (mean of current cluster)
        cluster_mean = np.mean(current_cluster)

        # Check if price is within tolerance of current cluster
        if abs(price - cluster_mean) / cluster_mean <= tolerance_pct:
            current_cluster.append(price)
        else:
            # Save current cluster and start a new one
            clusters.append((np.mean(current_cluster), len(current_cluster)))
            current_cluster = [price]

    # Don't forget the last cluster
    if current_cluster:
        clusters.append((np.mean(current_cluster), len(current_cluster)))

    return clusters


def calculate_strength(
    touches: int,
    volume_at_level: float,
    avg_volume: float,
    max_touches: int,
) -> float:
    """
    Calculate strength score for a support/resistance level.

    Strength is based on:
    - Number of times price touched the level (more touches = stronger)
    - Volume at the level compared to average volume (higher volume = stronger)

    Args:
        touches: Number of times price touched this level
        volume_at_level: Average volume when price was at this level
        avg_volume: Overall average volume in the dataset
        max_touches: Maximum number of touches across all levels (for normalization)

    Returns:
        Strength score between 0 and 1
    """
    # Normalize touches to 0-1 scale
    touch_score = touches / max(max_touches, 1)

    # Normalize volume ratio (cap at 2x average to prevent outliers from dominating)
    volume_ratio = min(volume_at_level / max(avg_volume, 1), 2.0)
    volume_score = volume_ratio / 2.0  # Scale to 0-1

    # Weighted combination: touches are more important than volume
    strength = 0.7 * touch_score + 0.3 * volume_score

    # Ensure result is in [0, 1]
    return min(max(strength, 0.0), 1.0)


def detect_support_resistance(
    data: List[OHLCVData],
    window: int = 5,
    tolerance_pct: float = 0.02,
    min_touches: int = 2,
) -> List[SupportResistanceLevel]:
    """
    Detect support and resistance levels from OHLCV data.

    This is the main function that orchestrates the support/resistance detection:
    1. Extract price and volume data
    2. Find local extrema (swing highs and lows)
    3. Cluster nearby levels together
    4. Calculate strength scores
    5. Filter and sort results

    Args:
        data: List of OHLCV data points
        window: Window size for local extrema detection (default 5)
        tolerance_pct: Clustering tolerance as percentage (default 2%)
        min_touches: Minimum touches required for a level to be considered (default 2)

    Returns:
        List of SupportResistanceLevel objects, sorted by strength (descending)
    """
    if len(data) < window + 1:
        return []

    # Convert to numpy arrays for efficient computation
    highs = np.array([candle.high for candle in data])
    lows = np.array([candle.low for candle in data])
    volumes = np.array([candle.volume for candle in data])

    # Find local extrema
    support_indices, resistance_indices = find_local_extrema(lows, window=window)
    _, resistance_highs_indices = find_local_extrema(highs, window=window)

    # Collect all potential support levels (from lows)
    support_prices = lows[support_indices].tolist() if len(support_indices) > 0 else []

    # Collect all potential resistance levels (from highs)
    resistance_prices = (
        highs[resistance_highs_indices].tolist()
        if len(resistance_highs_indices) > 0
        else []
    )

    # Combine all price levels
    all_price_levels = support_prices + resistance_prices

    if not all_price_levels:
        return []

    # Cluster the levels
    clustered_levels = cluster_levels(all_price_levels, tolerance_pct=tolerance_pct)

    # Filter by minimum touches
    clustered_levels = [
        (price, touches)
        for price, touches in clustered_levels
        if touches >= min_touches
    ]

    if not clustered_levels:
        return []

    # Calculate average volume
    avg_volume = float(np.mean(volumes))

    # Calculate strength for each level
    max_touches = max(touches for _, touches in clustered_levels)

    results = []
    for price_level, touches in clustered_levels:
        # Find volume at this level (average volume of candles near this price)
        # "Near" means within tolerance of the level
        tolerance = price_level * tolerance_pct
        near_level_mask = np.abs(lows - price_level) <= tolerance
        near_level_mask |= np.abs(highs - price_level) <= tolerance

        if np.any(near_level_mask):
            volume_at_level = float(np.mean(volumes[near_level_mask]))
        else:
            volume_at_level = avg_volume

        # Calculate strength score
        strength = calculate_strength(
            touches=touches,
            volume_at_level=volume_at_level,
            avg_volume=avg_volume,
            max_touches=max_touches,
        )

        results.append(
            SupportResistanceLevel(
                level=float(price_level),
                strength=strength,
                touches=touches,
            )
        )

    # Sort by strength (descending) - strongest levels first
    results.sort(key=lambda x: x.strength, reverse=True)

    return results
