"""
Swing Scoring Service for deterministic swing trading scoring.

This service implements a deterministic, reproducible scoring algorithm for swing trading
candidates. It evaluates 7 key components: Trend, Technical, Volume, Relative Strength,
Breakout, Sector, and Risk/Reward. Each component is scored 0-100, then weighted to produce
a final total score (0-100).

This is completely deterministic with NO AI involvement. Same inputs ALWAYS produce
same outputs.

Requirements: 5.3
"""

from typing import Dict, Optional, List
from pydantic import BaseModel, Field


class ScoringWeights(BaseModel):
    """
    Configurable weights for scoring components.

    Default weights (sum to 1.0):
    - Trend: 20%
    - Technical: 20%
    - Volume: 15%
    - Relative Strength: 15%
    - Breakout: 10%
    - Sector: 10%
    - Risk/Reward: 10%
    """

    trend_weight: float = Field(
        default=0.20,
        ge=0.0,
        le=1.0,
        description="Weight for trend score (default 20%)",
    )
    technical_weight: float = Field(
        default=0.20,
        ge=0.0,
        le=1.0,
        description="Weight for technical score (default 20%)",
    )
    volume_weight: float = Field(
        default=0.15,
        ge=0.0,
        le=1.0,
        description="Weight for volume score (default 15%)",
    )
    relative_strength_weight: float = Field(
        default=0.15,
        ge=0.0,
        le=1.0,
        description="Weight for relative strength score (default 15%)",
    )
    breakout_weight: float = Field(
        default=0.10,
        ge=0.0,
        le=1.0,
        description="Weight for breakout score (default 10%)",
    )
    sector_weight: float = Field(
        default=0.10,
        ge=0.0,
        le=1.0,
        description="Weight for sector score (default 10%)",
    )
    risk_reward_weight: float = Field(
        default=0.10,
        ge=0.0,
        le=1.0,
        description="Weight for risk/reward score (default 10%)",
    )

    def validate_weights(self) -> bool:
        """Validate that weights sum to approximately 1.0."""
        total = (
            self.trend_weight
            + self.technical_weight
            + self.volume_weight
            + self.relative_strength_weight
            + self.breakout_weight
            + self.sector_weight
            + self.risk_reward_weight
        )
        return abs(total - 1.0) < 0.01


class ComponentScores(BaseModel):
    """Individual component scores (each 0-100)."""

    trend_score: float = Field(..., ge=0.0, le=100.0, description="Trend score (0-100)")
    technical_score: float = Field(
        ..., ge=0.0, le=100.0, description="Technical score (0-100)"
    )
    volume_score: float = Field(
        ..., ge=0.0, le=100.0, description="Volume score (0-100)"
    )
    relative_strength_score: float = Field(
        ..., ge=0.0, le=100.0, description="Relative strength score (0-100)"
    )
    breakout_score: float = Field(
        ..., ge=0.0, le=100.0, description="Breakout score (0-100)"
    )
    sector_score: float = Field(
        ..., ge=0.0, le=100.0, description="Sector score (0-100)"
    )
    risk_reward_score: float = Field(
        ..., ge=0.0, le=100.0, description="Risk/reward score (0-100)"
    )


class SwingScoreResult(BaseModel):
    """Complete swing trading score result."""

    total_score: float = Field(
        ..., ge=0.0, le=100.0, description="Total weighted score (0-100)"
    )
    components: ComponentScores = Field(..., description="Individual component scores")
    signals: List[str] = Field(
        default_factory=list,
        description="Human-readable signals explaining the score",
    )


class SwingScoringService:
    """
    Deterministic scoring service for swing trading analysis.

    This service implements a reproducible scoring algorithm that evaluates
    7 key technical factors:

    1. Trend Score (20%): EMA alignment, ADX strength, price position
    2. Technical Score (20%): RSI, MACD, ATR
    3. Volume Score (15%): Relative volume, volume trend
    4. Relative Strength Score (15%): Stock vs sector vs market
    5. Breakout Score (10%): Breakout detection, volume confirmation, retest
    6. Sector Score (10%): Sector strength mapping
    7. Risk/Reward Score (10%): Risk/reward ratio, stop loss proximity

    All scoring is deterministic - same inputs always produce same outputs.
    NO AI or randomness involved.
    """

    @staticmethod
    def calculate_trend_score(
        current_price: float,
        ema_20: float,
        ema_50: float,
        ema_200: float,
        adx: float,
    ) -> float:
        """
        Calculate trend score (0-100) based on EMA alignment and ADX strength.

        Formula: (ema_alignment * 0.5 + adx_strength * 0.3 + price_position * 0.2)

        EMA Alignment:
        - price > EMA20 > EMA50 > EMA200 = 100
        - Violations decrease score proportionally

        ADX Strength:
        - ADX > 30 = strong trend (100)
        - ADX 20-30 = moderate (70)
        - ADX < 20 = weak (30)

        Price Position:
        - Distance from EMAs (closer to EMAs = higher score in uptrend)

        Args:
            current_price: Current market price
            ema_20: 20-period EMA
            ema_50: 50-period EMA
            ema_200: 200-period EMA
            adx: ADX (Average Directional Index)

        Returns:
            float: Trend score (0-100)
        """
        # 1. EMA Alignment Score (0-100)
        ema_alignment_score = 0.0

        # Check perfect alignment: price > EMA20 > EMA50 > EMA200
        if current_price > ema_20 > ema_50 > ema_200:
            ema_alignment_score = 100.0
        elif current_price > ema_20 > ema_50:
            ema_alignment_score = 80.0  # 3 out of 4 conditions
        elif current_price > ema_20:
            ema_alignment_score = 60.0  # 2 out of 4 conditions
        elif current_price > ema_50:
            ema_alignment_score = 40.0  # Above 50 EMA
        elif current_price > ema_200:
            ema_alignment_score = 30.0  # Above 200 EMA only
        else:
            ema_alignment_score = 10.0  # Below all EMAs

        # 2. ADX Strength Score (0-100)
        if adx > 30:
            adx_strength_score = 100.0  # Strong trend
        elif adx >= 20:
            # Linear interpolation between 70-100 for ADX 20-30
            adx_strength_score = 70.0 + (adx - 20) * 3.0
        else:
            # Linear interpolation between 30-70 for ADX 0-20
            adx_strength_score = 30.0 + (adx / 20) * 40.0

        # 3. Price Position Score (0-100)
        # Measure how close price is to EMA20 (optimal for swing entries)
        distance_from_ema20_pct = abs((current_price - ema_20) / ema_20) * 100

        if distance_from_ema20_pct < 2.0:
            price_position_score = 100.0  # Very close to EMA20
        elif distance_from_ema20_pct < 5.0:
            price_position_score = 80.0  # Near EMA20
        elif distance_from_ema20_pct < 10.0:
            price_position_score = 60.0  # Moderate distance
        else:
            price_position_score = 40.0  # Far from EMA20

        # Weighted combination
        trend_score = (
            ema_alignment_score * 0.5
            + adx_strength_score * 0.3
            + price_position_score * 0.2
        )

        return max(0.0, min(100.0, trend_score))

    @staticmethod
    def calculate_technical_score(
        rsi: float,
        macd_histogram: float,
        atr: float,
        current_price: float,
    ) -> float:
        """
        Calculate technical score (0-100) based on RSI, MACD, and ATR.

        Formula: (rsi_score * 0.4 + macd_score * 0.4 + atr_score * 0.2)

        RSI:
        - Optimal range 40-70 = 100
        - Outside range penalized

        MACD:
        - Histogram direction and strength

        ATR:
        - Moderate volatility preferred (2-4% of price)

        Args:
            rsi: RSI value
            macd_histogram: MACD histogram value
            atr: ATR (Average True Range)
            current_price: Current market price

        Returns:
            float: Technical score (0-100)
        """
        # 1. RSI Score (0-100)
        if 40 <= rsi <= 70:
            rsi_score = 100.0  # Optimal range
        elif 30 <= rsi < 40:
            rsi_score = 70.0 + (rsi - 30) * 3.0  # 70-100
        elif 70 < rsi <= 80:
            rsi_score = 70.0 + (80 - rsi) * 3.0  # 100-70
        elif 20 <= rsi < 30:
            rsi_score = 50.0 + (rsi - 20) * 2.0  # 50-70
        elif 80 < rsi <= 90:
            rsi_score = 50.0 + (90 - rsi) * 2.0  # 70-50
        else:
            rsi_score = 30.0  # Extreme overbought/oversold

        # 2. MACD Score (0-100)
        # Positive histogram = bullish, negative = bearish
        if macd_histogram > 0:
            # Scale positive histogram (normalized by typical range)
            macd_score = min(100.0, 50.0 + macd_histogram * 10)
        else:
            # Scale negative histogram
            macd_score = max(0.0, 50.0 + macd_histogram * 10)

        # 3. ATR Score (0-100)
        # Calculate ATR as percentage of price
        atr_pct = (atr / current_price) * 100

        if 2.0 <= atr_pct <= 4.0:
            atr_score = 100.0  # Optimal volatility
        elif 1.0 <= atr_pct < 2.0:
            atr_score = 70.0 + (atr_pct - 1.0) * 30.0  # 70-100
        elif 4.0 < atr_pct <= 6.0:
            atr_score = 70.0 + (6.0 - atr_pct) * 15.0  # 100-70
        elif atr_pct < 1.0:
            atr_score = 50.0  # Too low volatility
        else:
            atr_score = 40.0  # Too high volatility

        # Weighted combination
        technical_score = rsi_score * 0.4 + macd_score * 0.4 + atr_score * 0.2

        return max(0.0, min(100.0, technical_score))

    @staticmethod
    def calculate_volume_score(
        relative_volume: float,
        volume_trend: str,
    ) -> float:
        """
        Calculate volume score (0-100) based on relative volume and trend.

        Formula: relative_volume_score * 0.7 + volume_trend_score * 0.3

        Relative Volume:
        - > 1.5 = excellent (100)
        - 1.0-1.5 = good (70)
        - < 1.0 = weak (40)

        Volume Trend:
        - INCREASING = bonus

        Args:
            relative_volume: Current volume / average volume
            volume_trend: "INCREASING", "DECREASING", or "STABLE"

        Returns:
            float: Volume score (0-100)
        """
        # 1. Relative Volume Score (0-100)
        if relative_volume >= 1.5:
            rv_score = 100.0  # Excellent volume
        elif relative_volume >= 1.0:
            # Linear interpolation between 70-100 for rel_vol 1.0-1.5
            rv_score = 70.0 + (relative_volume - 1.0) * 60.0
        elif relative_volume >= 0.7:
            # Linear interpolation between 40-70 for rel_vol 0.7-1.0
            rv_score = 40.0 + (relative_volume - 0.7) * 100.0
        else:
            rv_score = 40.0 * (relative_volume / 0.7)  # Scale down for very low volume

        # 2. Volume Trend Score (0-100)
        if volume_trend == "INCREASING":
            vt_score = 100.0
        elif volume_trend == "STABLE":
            vt_score = 70.0
        elif volume_trend == "DECREASING":
            vt_score = 40.0
        else:  # UNKNOWN
            vt_score = 50.0

        # Weighted combination
        volume_score = rv_score * 0.7 + vt_score * 0.3

        return max(0.0, min(100.0, volume_score))

    @staticmethod
    def calculate_relative_strength_score(
        sector_comparison: float,
        market_comparison: float,
    ) -> float:
        """
        Calculate relative strength score (0-100).

        Formula: (sector_comparison * 0.6 + market_comparison * 0.4)

        Compare stock performance to:
        - Sector index (0-100)
        - Market benchmark like NIFTY (0-100)

        Args:
            sector_comparison: Stock vs sector performance (0-100)
            market_comparison: Stock vs market performance (0-100)

        Returns:
            float: Relative strength score (0-100)
        """
        # Ensure inputs are in valid range
        sector_comparison = max(0.0, min(100.0, sector_comparison))
        market_comparison = max(0.0, min(100.0, market_comparison))

        # Weighted combination (sector more important than market)
        rs_score = sector_comparison * 0.6 + market_comparison * 0.4

        return max(0.0, min(100.0, rs_score))

    @staticmethod
    def calculate_breakout_score(
        breakout_detected: bool,
        volume_confirmed: bool,
        retest_detected: bool = False,
    ) -> float:
        """
        Calculate breakout score (0-100).

        Scoring:
        - Breakout detected + volume confirmed = 100
        - Breakout without volume = 60
        - No breakout = 0
        - Retest bonus: +20 if retest detected (capped at 100)

        Args:
            breakout_detected: Whether a breakout pattern is detected
            volume_confirmed: Whether breakout has volume confirmation
            retest_detected: Whether a retest pattern is detected (default: False)

        Returns:
            float: Breakout score (0-100)
        """
        if not breakout_detected:
            return 0.0

        # Base score for breakout
        if volume_confirmed:
            base_score = 100.0
        else:
            base_score = 60.0

        # Add retest bonus
        if retest_detected:
            base_score = min(100.0, base_score + 20.0)

        return base_score

    @staticmethod
    def calculate_sector_score(sector_strength: float) -> float:
        """
        Calculate sector score (0-100).

        Direct mapping of sector strength.
        Leading sectors get higher scores.

        Args:
            sector_strength: Sector strength value (0-100)

        Returns:
            float: Sector score (0-100)
        """
        # Direct mapping (ensure in valid range)
        return max(0.0, min(100.0, sector_strength))

    @staticmethod
    def calculate_risk_reward_score(
        entry_price: float,
        stop_loss: float,
        target: float,
    ) -> float:
        """
        Calculate risk/reward score (0-100).

        Calculate based on stop loss distance and target distance.

        Risk/Reward Ratio:
        - > 3:1 = 100
        - 2-3:1 = 80
        - 1.5-2:1 = 60
        - < 1.5:1 = 30

        Tighter stops are preferred (bonus for stop < 3% from entry).

        Args:
            entry_price: Entry price
            stop_loss: Stop loss price
            target: Target price

        Returns:
            float: Risk/reward score (0-100)
        """
        # Calculate risk and reward
        risk = abs(entry_price - stop_loss)
        reward = abs(target - entry_price)

        # Avoid division by zero
        if risk == 0:
            return 0.0

        # Calculate risk/reward ratio
        rr_ratio = reward / risk

        # Score based on R:R ratio
        if rr_ratio >= 3.0:
            base_score = 100.0
        elif rr_ratio >= 2.0:
            # Linear interpolation between 80-100 for R:R 2-3
            base_score = 80.0 + (rr_ratio - 2.0) * 20.0
        elif rr_ratio >= 1.5:
            # Linear interpolation between 60-80 for R:R 1.5-2
            base_score = 60.0 + (rr_ratio - 1.5) * 40.0
        else:
            # Linear interpolation between 30-60 for R:R 0-1.5
            base_score = 30.0 + (rr_ratio / 1.5) * 30.0

        # Bonus for tight stops (< 3% from entry)
        stop_distance_pct = (risk / entry_price) * 100
        if stop_distance_pct < 3.0:
            # Add up to 10 point bonus for tight stops
            bonus = min(10.0, (3.0 - stop_distance_pct) * 3.33)
            base_score = min(100.0, base_score + bonus)

        return max(0.0, min(100.0, base_score))

    @classmethod
    def calculate_total_score(
        cls,
        current_price: float,
        ema_20: float,
        ema_50: float,
        ema_200: float,
        adx: float,
        rsi: float,
        macd_histogram: float,
        atr: float,
        relative_volume: float,
        volume_trend: str,
        sector_comparison: float,
        market_comparison: float,
        breakout_detected: bool,
        volume_confirmed: bool,
        retest_detected: bool,
        sector_strength: float,
        entry_price: float,
        stop_loss: float,
        target: float,
        weights: Optional[ScoringWeights] = None,
    ) -> SwingScoreResult:
        """
        Calculate complete swing trading score.

        This is the main entry point for swing scoring. It calculates all
        7 component scores and combines them using configurable weights.

        Args:
            current_price: Current market price
            ema_20: 20-period EMA
            ema_50: 50-period EMA
            ema_200: 200-period EMA
            adx: ADX (Average Directional Index)
            rsi: RSI value
            macd_histogram: MACD histogram value
            atr: ATR (Average True Range)
            relative_volume: Current volume / average volume
            volume_trend: "INCREASING", "DECREASING", or "STABLE"
            sector_comparison: Stock vs sector performance (0-100)
            market_comparison: Stock vs market performance (0-100)
            breakout_detected: Whether a breakout pattern is detected
            volume_confirmed: Whether breakout has volume confirmation
            retest_detected: Whether a retest pattern is detected
            sector_strength: Sector strength value (0-100)
            entry_price: Entry price
            stop_loss: Stop loss price
            target: Target price
            weights: Optional custom weights (uses defaults if not provided)

        Returns:
            SwingScoreResult: Complete scoring result with total score and components
        """
        # Use default weights if not provided
        if weights is None:
            weights = ScoringWeights()

        # Validate weights
        if not weights.validate_weights():
            raise ValueError("Weights must sum to approximately 1.0")

        # Calculate all component scores
        trend_score = cls.calculate_trend_score(
            current_price, ema_20, ema_50, ema_200, adx
        )

        technical_score = cls.calculate_technical_score(
            rsi, macd_histogram, atr, current_price
        )

        volume_score = cls.calculate_volume_score(relative_volume, volume_trend)

        relative_strength_score = cls.calculate_relative_strength_score(
            sector_comparison, market_comparison
        )

        breakout_score = cls.calculate_breakout_score(
            breakout_detected, volume_confirmed, retest_detected
        )

        sector_score = cls.calculate_sector_score(sector_strength)

        risk_reward_score = cls.calculate_risk_reward_score(
            entry_price, stop_loss, target
        )

        # Calculate weighted total score
        total_score = (
            trend_score * weights.trend_weight
            + technical_score * weights.technical_weight
            + volume_score * weights.volume_weight
            + relative_strength_score * weights.relative_strength_weight
            + breakout_score * weights.breakout_weight
            + sector_score * weights.sector_weight
            + risk_reward_score * weights.risk_reward_weight
        )

        # Generate human-readable signals
        signals = cls._generate_signals(
            trend_score,
            technical_score,
            volume_score,
            relative_strength_score,
            breakout_score,
            sector_score,
            risk_reward_score,
            total_score,
        )

        # Create component scores object
        components = ComponentScores(
            trend_score=trend_score,
            technical_score=technical_score,
            volume_score=volume_score,
            relative_strength_score=relative_strength_score,
            breakout_score=breakout_score,
            sector_score=sector_score,
            risk_reward_score=risk_reward_score,
        )

        return SwingScoreResult(
            total_score=total_score,
            components=components,
            signals=signals,
        )

    @staticmethod
    def _generate_signals(
        trend_score: float,
        technical_score: float,
        volume_score: float,
        relative_strength_score: float,
        breakout_score: float,
        sector_score: float,
        risk_reward_score: float,
        total_score: float,
    ) -> List[str]:
        """
        Generate human-readable signals based on component scores.

        Args:
            trend_score: Trend component score
            technical_score: Technical component score
            volume_score: Volume component score
            relative_strength_score: Relative strength component score
            breakout_score: Breakout component score
            sector_score: Sector component score
            risk_reward_score: Risk/reward component score
            total_score: Total weighted score

        Returns:
            List[str]: Human-readable signals
        """
        signals = []

        # Overall score assessment
        if total_score >= 70:
            signals.append(
                f"Strong swing candidate (Total Score: {total_score:.1f}/100)"
            )
        elif total_score >= 60:
            signals.append(f"Good swing candidate (Total Score: {total_score:.1f}/100)")
        elif total_score >= 50:
            signals.append(
                f"Moderate swing candidate (Total Score: {total_score:.1f}/100)"
            )
        else:
            signals.append(f"Weak swing candidate (Total Score: {total_score:.1f}/100)")

        # Trend assessment
        if trend_score >= 80:
            signals.append(
                f"Strong uptrend with EMA alignment (Score: {trend_score:.1f})"
            )
        elif trend_score >= 60:
            signals.append(f"Moderate uptrend (Score: {trend_score:.1f})")
        else:
            signals.append(f"Weak or no trend (Score: {trend_score:.1f})")

        # Technical assessment
        if technical_score >= 80:
            signals.append(
                f"Excellent technical indicators (Score: {technical_score:.1f})"
            )
        elif technical_score >= 60:
            signals.append(
                f"Favorable technical indicators (Score: {technical_score:.1f})"
            )
        else:
            signals.append(f"Weak technical indicators (Score: {technical_score:.1f})")

        # Volume assessment
        if volume_score >= 80:
            signals.append(f"Strong volume confirmation (Score: {volume_score:.1f})")
        elif volume_score >= 60:
            signals.append(f"Adequate volume (Score: {volume_score:.1f})")
        else:
            signals.append(f"Weak volume (Score: {volume_score:.1f})")

        # Relative strength assessment
        if relative_strength_score >= 70:
            signals.append(
                f"Outperforming sector and market (Score: {relative_strength_score:.1f})"
            )
        elif relative_strength_score >= 50:
            signals.append(
                f"Moderate relative strength (Score: {relative_strength_score:.1f})"
            )
        else:
            signals.append(f"Underperforming (Score: {relative_strength_score:.1f})")

        # Breakout assessment
        if breakout_score >= 80:
            signals.append(f"Confirmed breakout pattern (Score: {breakout_score:.1f})")
        elif breakout_score > 0:
            signals.append(f"Breakout detected (Score: {breakout_score:.1f})")
        else:
            signals.append("No breakout pattern detected")

        # Sector assessment
        if sector_score >= 70:
            signals.append(f"Strong sector performance (Score: {sector_score:.1f})")
        elif sector_score >= 50:
            signals.append(f"Moderate sector performance (Score: {sector_score:.1f})")
        else:
            signals.append(f"Weak sector performance (Score: {sector_score:.1f})")

        # Risk/Reward assessment
        if risk_reward_score >= 80:
            signals.append(
                f"Excellent risk/reward ratio (Score: {risk_reward_score:.1f})"
            )
        elif risk_reward_score >= 60:
            signals.append(
                f"Favorable risk/reward ratio (Score: {risk_reward_score:.1f})"
            )
        else:
            signals.append(f"Poor risk/reward ratio (Score: {risk_reward_score:.1f})")

        return signals
