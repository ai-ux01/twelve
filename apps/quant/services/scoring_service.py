"""
Scoring service for deterministic market analysis.

This service implements trend classification logic and a weighted scoring
algorithm based on multiple technical indicators. It generates deterministic
scores (0-100) and human-readable signal strings to help assess market conditions.

Requirements: 4.1
"""

from typing import List
from models import TrendEnum, ScoreResult, IndicatorResult


class ScoringService:
    """
    Service for scoring market conditions based on technical indicators.

    This service provides deterministic market scoring by:
    1. Classifying market trend (BULLISH/BEARISH/NEUTRAL)
    2. Calculating a weighted score combining multiple indicators
    3. Generating human-readable signal descriptions
    """

    @staticmethod
    def classify_trend(current_price: float, indicators: IndicatorResult) -> TrendEnum:
        """
        Classify market trend based on price position relative to EMAs, RSI, and ADX.

        Trend Classification Rules:
        - BULLISH: price > EMA 20, 50, 200 AND RSI > 50 AND ADX > 20
        - BEARISH: price < EMA 20, 50, 200 AND RSI < 50 AND ADX > 20
        - NEUTRAL: otherwise (mixed signals or weak ADX < 20)

        Args:
            current_price: Current market price
            indicators: IndicatorResult containing all technical indicators

        Returns:
            TrendEnum: BULLISH, BEARISH, or NEUTRAL
        """
        # Check if price is above all major EMAs
        above_emas = (
            current_price > indicators.ema_20
            and current_price > indicators.ema_50
            and current_price > indicators.ema_200
        )

        # Check if price is below all major EMAs
        below_emas = (
            current_price < indicators.ema_20
            and current_price < indicators.ema_50
            and current_price < indicators.ema_200
        )

        # Strong trend requires ADX > 20
        strong_trend = indicators.adx > 20

        # BULLISH: Price above EMAs, RSI bullish, strong trend
        if above_emas and indicators.rsi > 50 and strong_trend:
            return TrendEnum.BULLISH

        # BEARISH: Price below EMAs, RSI bearish, strong trend
        if below_emas and indicators.rsi < 50 and strong_trend:
            return TrendEnum.BEARISH

        # NEUTRAL: All other cases (weak trend, mixed signals)
        return TrendEnum.NEUTRAL

    @staticmethod
    def calculate_score(
        current_price: float,
        indicators: IndicatorResult,
        trend: TrendEnum,
    ) -> float:
        """
        Calculate weighted market score (0-100) based on multiple indicators.

        Scoring Formula:
        - RSI component (30%): Normalized RSI scaled to trend direction
        - ADX component (25%): Trend strength indicator
        - VWAP component (25%): Price position relative to VWAP
        - Volume component (20%): Relative volume strength

        Args:
            current_price: Current market price
            indicators: IndicatorResult containing all technical indicators
            trend: Classified market trend

        Returns:
            float: Score between 0 and 100
        """
        # RSI Component (30%): Normalize RSI and adjust for trend
        if trend == TrendEnum.BULLISH:
            # For bullish: RSI 50-100 maps to higher scores
            rsi_score = (
                ((indicators.rsi - 50) / 50) * 100 if indicators.rsi >= 50 else 0
            )
        elif trend == TrendEnum.BEARISH:
            # For bearish: RSI 0-50 maps to lower scores (inverted)
            rsi_score = (
                ((50 - indicators.rsi) / 50) * 100 if indicators.rsi <= 50 else 0
            )
        else:
            # For neutral: RSI near 50 gets mid-range score
            rsi_score = 50 - abs(indicators.rsi - 50)

        rsi_component = (rsi_score / 100) * 30

        # ADX Component (25%): Higher ADX indicates stronger trend
        # ADX > 25 is considered strong, scale accordingly
        adx_score = min(indicators.adx / 25 * 100, 100)
        adx_component = (adx_score / 100) * 25

        # VWAP Component (25%): Price position relative to VWAP
        vwap_diff_pct = ((current_price - indicators.vwap) / indicators.vwap) * 100

        if trend == TrendEnum.BULLISH:
            # For bullish: Being above VWAP is positive
            vwap_score = min(max(vwap_diff_pct * 10 + 50, 0), 100)
        elif trend == TrendEnum.BEARISH:
            # For bearish: Being below VWAP is positive (for bearish score)
            vwap_score = min(max(-vwap_diff_pct * 10 + 50, 0), 100)
        else:
            # For neutral: Being near VWAP is positive
            vwap_score = max(100 - abs(vwap_diff_pct * 10), 0)

        vwap_component = (vwap_score / 100) * 25

        # Volume Component (20%): Relative volume strength
        # relative_volume > 1 indicates above average volume
        volume_score = min(indicators.relative_volume * 100, 100)
        volume_component = (volume_score / 100) * 20

        # Calculate total score
        total_score = rsi_component + adx_component + vwap_component + volume_component

        # Ensure score is within bounds
        return max(0.0, min(100.0, total_score))

    @staticmethod
    def generate_signals(
        current_price: float,
        indicators: IndicatorResult,
        trend: TrendEnum,
    ) -> List[str]:
        """
        Generate human-readable signal descriptions based on market conditions.

        Args:
            current_price: Current market price
            indicators: IndicatorResult containing all technical indicators
            trend: Classified market trend

        Returns:
            List[str]: List of signal descriptions
        """
        signals = []

        # Trend strength signal
        if indicators.adx > 25:
            if trend == TrendEnum.BULLISH:
                signals.append(
                    f"Strong upward trend detected (ADX: {indicators.adx:.1f})"
                )
            elif trend == TrendEnum.BEARISH:
                signals.append(
                    f"Strong downward trend detected (ADX: {indicators.adx:.1f})"
                )
            else:
                signals.append(f"Strong trend present (ADX: {indicators.adx:.1f})")
        else:
            signals.append(f"Weak trend detected (ADX: {indicators.adx:.1f} < 25)")

        # RSI signal
        if indicators.rsi > 70:
            signals.append(f"RSI overbought ({indicators.rsi:.1f} > 70)")
        elif indicators.rsi > 50:
            signals.append(f"RSI in bullish range ({indicators.rsi:.1f})")
        elif indicators.rsi > 30:
            signals.append(f"RSI in neutral range ({indicators.rsi:.1f})")
        else:
            signals.append(f"RSI oversold ({indicators.rsi:.1f} < 30)")

        # Volume signal
        if indicators.relative_volume > 1.5:
            signals.append(
                f"Very high volume ({indicators.relative_volume:.2f}x average)"
            )
        elif indicators.relative_volume > 1.0:
            signals.append(
                f"Above average volume ({indicators.relative_volume:.2f}x average)"
            )
        elif indicators.relative_volume > 0.7:
            signals.append(
                f"Near average volume ({indicators.relative_volume:.2f}x average)"
            )
        else:
            signals.append(
                f"Below average volume ({indicators.relative_volume:.2f}x average)"
            )

        # VWAP signal
        vwap_diff_pct = ((current_price - indicators.vwap) / indicators.vwap) * 100
        if abs(vwap_diff_pct) < 0.5:
            signals.append(
                f"Price near VWAP ({current_price:.2f} ≈ {indicators.vwap:.2f})"
            )
        elif vwap_diff_pct > 0:
            signals.append(
                f"Price above VWAP (+{vwap_diff_pct:.2f}%: "
                f"{current_price:.2f} > {indicators.vwap:.2f})"
            )
        else:
            signals.append(
                f"Price below VWAP ({vwap_diff_pct:.2f}%: "
                f"{current_price:.2f} < {indicators.vwap:.2f})"
            )

        # EMA alignment signal
        above_emas = (
            current_price > indicators.ema_20
            and current_price > indicators.ema_50
            and current_price > indicators.ema_200
        )
        below_emas = (
            current_price < indicators.ema_20
            and current_price < indicators.ema_50
            and current_price < indicators.ema_200
        )

        if above_emas:
            signals.append(
                f"Price above all major EMAs "
                f"(20/50/200: {indicators.ema_20:.2f}/"
                f"{indicators.ema_50:.2f}/{indicators.ema_200:.2f})"
            )
        elif below_emas:
            signals.append(
                f"Price below all major EMAs "
                f"(20/50/200: {indicators.ema_20:.2f}/"
                f"{indicators.ema_50:.2f}/{indicators.ema_200:.2f})"
            )
        else:
            signals.append("Mixed EMA signals (price between EMAs)")

        # Momentum signal
        if indicators.momentum > 5:
            signals.append(f"Strong positive momentum ({indicators.momentum:.2f})")
        elif indicators.momentum > 0:
            signals.append(f"Positive momentum ({indicators.momentum:.2f})")
        elif indicators.momentum > -5:
            signals.append(f"Negative momentum ({indicators.momentum:.2f})")
        else:
            signals.append(f"Strong negative momentum ({indicators.momentum:.2f})")

        return signals

    @classmethod
    def score_market(
        cls,
        current_price: float,
        indicators: IndicatorResult,
    ) -> ScoreResult:
        """
        Perform complete market scoring analysis.

        This is the main entry point for the scoring service. It orchestrates
        trend classification, score calculation, and signal generation.

        Args:
            current_price: Current market price
            indicators: IndicatorResult containing all technical indicators

        Returns:
            ScoreResult: Complete scoring analysis with trend, score, and signals
        """
        # Step 1: Classify trend
        trend = cls.classify_trend(current_price, indicators)

        # Step 2: Calculate weighted score
        score = cls.calculate_score(current_price, indicators, trend)

        # Step 3: Generate signals
        signals = cls.generate_signals(current_price, indicators, trend)

        # Return complete result
        return ScoreResult(
            trend=trend,
            rsi=indicators.rsi,
            adx=indicators.adx,
            vwap=indicators.vwap,
            volumeRatio=indicators.relative_volume,
            score=score,
            signals=signals,
        )
