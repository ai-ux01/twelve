"""
Swing Trading Component Scoring Calculator.

This module implements deterministic scoring functions for each component
of the swing trading analysis. Each function returns a score from 0-100.

Requirements: 5.3
"""

from typing import Optional
from models import IndicatorResult, MarketRegimeEnum


def calculate_trend_score(
    current_price: float,
    indicators: IndicatorResult,
) -> float:
    """
    Calculate trend score based on EMA alignment, price position, and ADX.

    Components:
    - EMA alignment (50%): price > EMA20 > EMA50 > EMA200 = 100
    - ADX strength (30%): ADX > 30 = 100, ADX 20-30 = 70, ADX < 20 = 30
    - Price position (20%): distance from EMAs

    Args:
        current_price: Current market price
        indicators: IndicatorResult containing technical indicators

    Returns:
        float: Trend score (0-100)

    Raises:
        ValueError: If current_price <= 0
    """
    if current_price <= 0:
        raise ValueError("current_price must be positive")

    # EMA Alignment Score (50%)
    ema_alignment_score = 0.0

    # Perfect alignment: price > EMA20 > EMA50 > EMA200
    if (
        current_price > indicators.ema_20
        and indicators.ema_20 > indicators.ema_50
        and indicators.ema_50 > indicators.ema_200
    ):
        ema_alignment_score = 100.0
    # Price above EMA20 and EMA50, but not EMA200
    elif current_price > indicators.ema_20 and indicators.ema_20 > indicators.ema_50:
        ema_alignment_score = 75.0
    # Price above EMA20 only
    elif current_price > indicators.ema_20:
        ema_alignment_score = 50.0
    # Price below all EMAs
    else:
        ema_alignment_score = 25.0

    # ADX Strength Score (30%)
    if indicators.adx > 30:
        adx_score = 100.0
    elif indicators.adx >= 20:
        # Linear interpolation: 20-30 maps to 70-100
        adx_score = 70.0 + ((indicators.adx - 20) / 10) * 30.0
    else:
        # Linear interpolation: 0-20 maps to 30-70
        adx_score = 30.0 + (indicators.adx / 20) * 40.0

    # Price Position Score (20%)
    # Calculate distance from EMA20 as percentage
    distance_from_ema20 = (
        (current_price - indicators.ema_20) / indicators.ema_20
    ) * 100

    # Positive distance is good for uptrend
    # Score decreases if too far above or below
    if distance_from_ema20 > 5:
        # Too far above, might be overextended
        price_position_score = max(0, 100 - (distance_from_ema20 - 5) * 10)
    elif distance_from_ema20 >= 0:
        # 0-5% above EMA20 is ideal
        price_position_score = 100 - (5 - distance_from_ema20) * 10
    else:
        # Below EMA20 is not ideal for swing long
        price_position_score = max(0, 50 + distance_from_ema20 * 10)

    # Weighted combination
    trend_score = (
        ema_alignment_score * 0.5 + adx_score * 0.3 + price_position_score * 0.2
    )

    return max(0.0, min(100.0, trend_score))


def calculate_technical_score(indicators: IndicatorResult) -> float:
    """
    Calculate technical score based on RSI, MACD, and ATR.

    Components:
    - RSI (40%): optimal 40-70 range = 100, outside penalized
    - MACD (40%): histogram direction and strength
    - ATR (20%): moderate volatility preferred

    Args:
        indicators: IndicatorResult containing technical indicators

    Returns:
        float: Technical score (0-100)
    """
    # RSI Score (40%)
    # Optimal range: 40-70
    if 40 <= indicators.rsi <= 70:
        # Perfect range, scale to 100
        if 50 <= indicators.rsi <= 60:
            # Sweet spot
            rsi_score = 100.0
        elif indicators.rsi < 50:
            # 40-50: scale from 80-100
            rsi_score = 80.0 + ((indicators.rsi - 40) / 10) * 20.0
        else:
            # 60-70: scale from 100-80
            rsi_score = 100.0 - ((indicators.rsi - 60) / 10) * 20.0
    elif indicators.rsi < 40:
        # Below 40: potentially oversold, but risky
        # 0-40: scale from 0-80
        rsi_score = (indicators.rsi / 40) * 80.0
    else:
        # Above 70: overbought
        # 70-100: scale from 80-0
        rsi_score = max(0, 80.0 - ((indicators.rsi - 70) / 30) * 80.0)

    # MACD Score (40%)
    # Positive histogram indicates bullish momentum
    histogram = indicators.macd.histogram

    if histogram > 0:
        # Positive histogram: bullish
        # Scale based on magnitude (cap at reasonable level)
        macd_score = min(100.0, 60.0 + min(histogram, 10) * 4.0)
    elif histogram == 0:
        # Neutral
        macd_score = 50.0
    else:
        # Negative histogram: bearish
        macd_score = max(0, 50.0 + max(histogram, -10) * 5.0)

    # ATR Score (20%)
    # Moderate volatility is preferred
    # Compare ATR to typical percentage of price (assume we want 1-3% ATR)
    # Since we don't have price here, use relative ATR metrics
    # For now, just normalize ATR (higher ATR = higher risk = lower score for conservative)
    # This is a simplified version; in practice, you'd compare ATR to historical averages

    # Assuming ATR values typically range from 0 to 100+ depending on stock
    # We'll use a heuristic: moderate ATR around 20-50 is good
    if 20 <= indicators.atr <= 50:
        atr_score = 100.0
    elif indicators.atr < 20:
        # Too low ATR = low volatility = less opportunity
        atr_score = (indicators.atr / 20) * 100.0
    else:
        # Too high ATR = high volatility = more risk
        atr_score = max(0, 100.0 - ((indicators.atr - 50) / 50) * 100.0)

    # Weighted combination
    technical_score = rsi_score * 0.4 + macd_score * 0.4 + atr_score * 0.2

    return max(0.0, min(100.0, technical_score))


def calculate_volume_score(indicators: IndicatorResult) -> float:
    """
    Calculate volume score based on relative volume and volume trend.

    Components:
    - Relative volume (70%): > 1.5 = 100, 1.0-1.5 = 70, < 1.0 = 40
    - Volume trend (30%): increasing = bonus

    Args:
        indicators: IndicatorResult containing volume metrics

    Returns:
        float: Volume score (0-100)
    """
    # Relative Volume Score (70%)
    rel_vol = indicators.relative_volume

    if rel_vol >= 1.5:
        # Excellent: high relative volume
        relative_volume_score = 100.0
    elif rel_vol >= 1.0:
        # Good: above average volume
        # 1.0-1.5: scale from 70-100
        relative_volume_score = 70.0 + ((rel_vol - 1.0) / 0.5) * 30.0
    else:
        # Weak: below average volume
        # 0-1.0: scale from 40-70
        relative_volume_score = 40.0 + (rel_vol * 30.0)

    # Volume Trend Score (30%)
    # We use momentum as a proxy for volume trend
    # Positive momentum suggests increasing buying pressure
    volume_trend_score = 50.0  # Neutral baseline

    if indicators.momentum > 0:
        # Positive momentum = increasing trend
        volume_trend_score = min(100.0, 50.0 + indicators.momentum * 5.0)
    elif indicators.momentum < 0:
        # Negative momentum = decreasing trend
        volume_trend_score = max(0, 50.0 + indicators.momentum * 5.0)

    # Weighted combination
    volume_score = relative_volume_score * 0.7 + volume_trend_score * 0.3

    return max(0.0, min(100.0, volume_score))


def calculate_relative_strength_score(
    stock_performance: float,
    sector_performance: float,
    market_performance: float,
) -> float:
    """
    Calculate relative strength score based on stock vs sector and market performance.

    Components:
    - Stock vs sector (60%): outperformance = higher score
    - Stock vs market (40%): outperformance = higher score

    Args:
        stock_performance: Stock performance percentage
        sector_performance: Sector performance percentage
        market_performance: Market (NIFTY) performance percentage

    Returns:
        float: Relative strength score (0-100)
    """
    # Stock vs Sector Score (60%)
    sector_diff = stock_performance - sector_performance

    if sector_diff > 5:
        # Significantly outperforming sector
        sector_comparison_score = 100.0
    elif sector_diff > 0:
        # Outperforming sector
        # 0-5: scale from 70-100
        sector_comparison_score = 70.0 + (sector_diff / 5.0) * 30.0
    elif sector_diff > -5:
        # Slightly underperforming sector
        # -5 to 0: scale from 30-70
        sector_comparison_score = 70.0 + (sector_diff / 5.0) * 40.0
    else:
        # Significantly underperforming sector
        sector_comparison_score = max(0, 30.0 + (sector_diff + 5) * 6.0)

    # Stock vs Market Score (40%)
    market_diff = stock_performance - market_performance

    if market_diff > 5:
        # Significantly outperforming market
        market_comparison_score = 100.0
    elif market_diff > 0:
        # Outperforming market
        # 0-5: scale from 70-100
        market_comparison_score = 70.0 + (market_diff / 5.0) * 30.0
    elif market_diff > -5:
        # Slightly underperforming market
        # -5 to 0: scale from 30-70
        market_comparison_score = 70.0 + (market_diff / 5.0) * 40.0
    else:
        # Significantly underperforming market
        market_comparison_score = max(0, 30.0 + (market_diff + 5) * 6.0)

    # Weighted combination
    relative_strength_score = (
        sector_comparison_score * 0.6 + market_comparison_score * 0.4
    )

    return max(0.0, min(100.0, relative_strength_score))


def calculate_breakout_score(
    breakout_detected: bool,
    volume_confirmed: bool,
    retest_detected: bool,
    breakout_strength: float = 0.0,
) -> float:
    """
    Calculate breakout score based on breakout detection, volume confirmation, and retest.

    Scoring:
    - Breakout detected + volume confirmed = 100
    - Breakout without volume = 60
    - No breakout = 0
    - Retest bonus: +20 if retest detected

    Args:
        breakout_detected: Whether a breakout is detected
        volume_confirmed: Whether breakout is volume confirmed
        retest_detected: Whether a retest is detected
        breakout_strength: Breakout strength (0.0-1.0, optional)

    Returns:
        float: Breakout score (0-100)
    """
    if not breakout_detected:
        return 0.0

    # Base score
    if volume_confirmed:
        base_score = 100.0
    else:
        base_score = 60.0

    # Apply breakout strength modifier if provided
    if breakout_strength > 0:
        base_score = base_score * breakout_strength

    # Retest bonus
    retest_bonus = 20.0 if retest_detected else 0.0

    # Final score (capped at 100)
    breakout_score = min(100.0, base_score + retest_bonus)

    return max(0.0, min(100.0, breakout_score))


def calculate_sector_score(sector_strength: float) -> float:
    """
    Calculate sector score based on sector strength.

    Direct mapping of sector strength (0-100).

    Args:
        sector_strength: Sector strength score (0-100)

    Returns:
        float: Sector score (0-100)

    Raises:
        ValueError: If sector_strength is not in range [0, 100]
    """
    if not 0 <= sector_strength <= 100:
        raise ValueError("sector_strength must be between 0 and 100")

    return sector_strength


def calculate_risk_reward_score(
    current_price: float,
    stop_loss: float,
    target: float,
) -> float:
    """
    Calculate risk/reward score based on stop loss and target levels.

    Scoring:
    - Risk/Reward ratio > 3 = 100
    - Risk/Reward ratio 2-3 = 80
    - Risk/Reward ratio 1.5-2 = 60
    - Risk/Reward ratio < 1.5 = 30
    - Tighter stops (closer to price) get bonus points

    Args:
        current_price: Current market price
        stop_loss: Stop loss level
        target: Target price level

    Returns:
        float: Risk/reward score (0-100)

    Raises:
        ValueError: If prices are invalid or risk/reward is negative
    """
    if current_price <= 0 or stop_loss <= 0 or target <= 0:
        raise ValueError("All prices must be positive")

    if stop_loss >= current_price:
        raise ValueError("Stop loss must be below current price")

    if target <= current_price:
        raise ValueError("Target must be above current price")

    # Calculate risk and reward
    risk = current_price - stop_loss
    reward = target - current_price

    if risk <= 0:
        raise ValueError("Risk must be positive")

    # Calculate risk/reward ratio
    rr_ratio = reward / risk

    # Base score from R:R ratio
    if rr_ratio >= 3.0:
        base_score = 100.0
    elif rr_ratio >= 2.0:
        # 2-3: scale from 80-100
        base_score = 80.0 + ((rr_ratio - 2.0) / 1.0) * 20.0
    elif rr_ratio >= 1.5:
        # 1.5-2: scale from 60-80
        base_score = 60.0 + ((rr_ratio - 1.5) / 0.5) * 20.0
    else:
        # < 1.5: scale from 30 down
        base_score = max(30.0, 30.0 + (rr_ratio - 1.0) * 30.0)

    # Stop loss proximity bonus
    # Tighter stops (1-2% away) are preferred for swing trading
    stop_loss_distance_pct = ((current_price - stop_loss) / current_price) * 100

    if 1.0 <= stop_loss_distance_pct <= 2.5:
        # Ideal stop distance
        proximity_bonus = 10.0
    elif 0.5 <= stop_loss_distance_pct < 1.0:
        # Very tight stop (might be too tight)
        proximity_bonus = 5.0
    elif 2.5 < stop_loss_distance_pct <= 4.0:
        # Slightly wider stop
        proximity_bonus = 5.0
    else:
        # Too tight or too wide
        proximity_bonus = 0.0

    # Final score (capped at 100)
    risk_reward_score = min(100.0, base_score + proximity_bonus)

    return max(0.0, min(100.0, risk_reward_score))


def calculate_total_swing_score(
    trend_score: float,
    technical_score: float,
    volume_score: float,
    relative_strength_score: float,
    breakout_score: float,
    sector_score: float,
    risk_reward_score: float,
    trend_weight: float = 0.20,
    technical_weight: float = 0.20,
    volume_weight: float = 0.15,
    relative_strength_weight: float = 0.15,
    breakout_weight: float = 0.10,
    sector_weight: float = 0.10,
    risk_reward_weight: float = 0.10,
) -> float:
    """
    Calculate total swing score using weighted combination of component scores.

    Default weights:
    - Trend: 20%
    - Technical: 20%
    - Volume: 15%
    - Relative Strength: 15%
    - Breakout: 10%
    - Sector: 10%
    - Risk/Reward: 10%

    Args:
        trend_score: Trend component score (0-100)
        technical_score: Technical component score (0-100)
        volume_score: Volume component score (0-100)
        relative_strength_score: Relative strength component score (0-100)
        breakout_score: Breakout component score (0-100)
        sector_score: Sector component score (0-100)
        risk_reward_score: Risk/reward component score (0-100)
        trend_weight: Weight for trend component (default: 0.20)
        technical_weight: Weight for technical component (default: 0.20)
        volume_weight: Weight for volume component (default: 0.15)
        relative_strength_weight: Weight for relative strength component (default: 0.15)
        breakout_weight: Weight for breakout component (default: 0.10)
        sector_weight: Weight for sector component (default: 0.10)
        risk_reward_weight: Weight for risk/reward component (default: 0.10)

    Returns:
        float: Total swing score (0-100)

    Raises:
        ValueError: If weights don't sum to 1.0 or scores are out of range
    """
    # Validate weights sum to 1.0 (with small tolerance for floating point)
    total_weight = (
        trend_weight
        + technical_weight
        + volume_weight
        + relative_strength_weight
        + breakout_weight
        + sector_weight
        + risk_reward_weight
    )

    if not (0.99 <= total_weight <= 1.01):
        raise ValueError(f"Weights must sum to 1.0, got {total_weight}")

    # Validate all scores are in range [0, 100]
    scores = [
        trend_score,
        technical_score,
        volume_score,
        relative_strength_score,
        breakout_score,
        sector_score,
        risk_reward_score,
    ]

    for score in scores:
        if not 0 <= score <= 100:
            raise ValueError(f"All scores must be between 0 and 100, got {score}")

    # Calculate weighted total
    total_score = (
        trend_score * trend_weight
        + technical_score * technical_weight
        + volume_score * volume_weight
        + relative_strength_score * relative_strength_weight
        + breakout_score * breakout_weight
        + sector_score * sector_weight
        + risk_reward_score * risk_reward_weight
    )

    return max(0.0, min(100.0, total_score))
