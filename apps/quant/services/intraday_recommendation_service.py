"""
Intraday Recommendation Service.

This service generates trading signals (BUY/SELL/HOLD/NO_TRADE) based on
deterministic technical analysis and scoring. The service implements the
signal generation logic defined in Task 60.2.

Signal Logic:
- BUY: score > 65, bullish trend, price > VWAP, RSI 40-70, data fresh
- SELL: score > 65, bearish trend, price < VWAP, RSI 30-60, data fresh
- HOLD: existing position, no clear directional signal, data fresh
- NO_TRADE: score < 65 OR poor risk/reward OR data stale OR conflicting indicators

Requirements: 6.7
"""

from typing import List, Optional, Tuple
from datetime import datetime, timezone, timedelta
from models.intraday import (
    IntradaySignal,
    IntradayRecommendation,
    IntradayTechnicalAnalysis,
    DataFreshness,
    OpeningRangeResult,
    PreviousDayLevelsResult,
    VWAPPosition,
    TrendStrength,
)
from services.intraday_scoring_service import IntradayScoreResult


class IntradayRecommendationService:
    """
    Service for generating intraday trading recommendations.
    
    Implements deterministic signal generation logic based on:
    - Technical analysis (VWAP, EMAs, RSI, MACD)
    - Composite scoring from IntradayScoringService
    - Data freshness checks
    - Risk/reward validation
    
    This is a DETERMINISTIC service - NO AI is used. Same inputs
    always produce the same outputs.
    
    Requirements: 6.7
    """
    
    def __init__(
        self,
        min_confidence_score: float = 65.0,  # Minimum score for BUY/SELL
        min_risk_reward: float = 1.5,  # Minimum risk/reward for intraday
        rsi_buy_min: float = 40.0,  # RSI minimum for BUY signal
        rsi_buy_max: float = 70.0,  # RSI maximum for BUY signal
        rsi_sell_min: float = 30.0,  # RSI minimum for SELL signal
        rsi_sell_max: float = 60.0,  # RSI maximum for SELL signal
        valid_duration_minutes: int = 30,  # Recommendation validity period
    ):
        """
        Initialize intraday recommendation service.
        
        Args:
            min_confidence_score: Minimum score threshold for BUY/SELL (default: 65.0)
            min_risk_reward: Minimum risk/reward ratio (default: 1.5)
            rsi_buy_min: RSI minimum for BUY signal (default: 40.0)
            rsi_buy_max: RSI maximum for BUY signal (default: 70.0)
            rsi_sell_min: RSI minimum for SELL signal (default: 30.0)
            rsi_sell_max: RSI maximum for SELL signal (default: 60.0)
            valid_duration_minutes: Recommendation validity in minutes (default: 30)
        """
        self.min_confidence_score = min_confidence_score
        self.min_risk_reward = min_risk_reward
        self.rsi_buy_min = rsi_buy_min
        self.rsi_buy_max = rsi_buy_max
        self.rsi_sell_min = rsi_sell_min
        self.rsi_sell_max = rsi_sell_max
        self.valid_duration_minutes = valid_duration_minutes
    
    def generate_recommendation(
        self,
        current_price: float,
        technical_analysis: IntradayTechnicalAnalysis,
        score_result: IntradayScoreResult,
        data_freshness: DataFreshness,
        opening_range: Optional[OpeningRangeResult] = None,
        prev_day_levels: Optional[PreviousDayLevelsResult] = None,
        vwap_position: Optional[VWAPPosition] = None,
        trend_strength: Optional[TrendStrength] = None,
        has_existing_position: bool = False,
    ) -> IntradayRecommendation:
        """
        Generate intraday trading recommendation based on technical analysis.
        
        Signal Generation Logic (Task 60.2):
        - BUY: score > 65, bullish trend, price > VWAP, RSI 40-70, data fresh
        - SELL: score > 65, bearish trend, price < VWAP, RSI 30-60, data fresh
        - HOLD: existing position, no clear directional signal, data fresh
        - NO_TRADE: score < 65 OR poor risk/reward OR data stale OR conflicting indicators
        
        Args:
            current_price: Current market price
            technical_analysis: Technical indicators from IntradayAnalysisService
            score_result: Scoring result from IntradayScoringService
            data_freshness: Data freshness tracking
            opening_range: Optional opening range analysis
            prev_day_levels: Optional previous day levels analysis
            vwap_position: Optional VWAP position (calculated if not provided)
            trend_strength: Optional trend strength (calculated if not provided)
            has_existing_position: Whether trader has existing position in this symbol
        
        Returns:
            IntradayRecommendation with signal, entry, stop loss, target, and rationale
        
        Requirements: 6.7
        """
        # Calculate VWAP position if not provided
        if vwap_position is None:
            vwap_position = self._determine_vwap_position(
                current_price, technical_analysis.vwap
            )
        
        # Determine trend strength if not provided
        if trend_strength is None:
            trend_strength = self._determine_trend_strength(
                current_price, technical_analysis
            )
        
        # Check if data is stale (Task 60.3)
        if data_freshness.is_stale:
            return self._generate_hold_stale_data(
                current_price,
                technical_analysis,
                data_freshness,
            )
        
        # Check score threshold
        score = score_result.total_score
        
        # Extract key indicators
        rsi = technical_analysis.rsi
        
        # Determine signal based on conditions (Task 60.2)
        signal, rationale_parts = self._determine_signal(
            score=score,
            current_price=current_price,
            vwap=technical_analysis.vwap,
            vwap_position=vwap_position,
            rsi=rsi,
            trend_strength=trend_strength,
            has_existing_position=has_existing_position,
            data_freshness=data_freshness,
        )
        
        # Calculate entry, stop loss, and target
        entry, stop_loss, target = self._calculate_levels(
            signal=signal,
            current_price=current_price,
            technical_analysis=technical_analysis,
            opening_range=opening_range,
            prev_day_levels=prev_day_levels,
        )
        
        # Calculate risk/reward ratio
        risk = abs(entry - stop_loss)
        reward = abs(target - entry)
        risk_reward = reward / risk if risk > 0 else 0.0
        
        # Validate risk/reward and potentially downgrade to NO_TRADE
        if signal in [IntradaySignal.BUY, IntradaySignal.SELL]:
            if risk_reward < self.min_risk_reward:
                signal = IntradaySignal.NO_TRADE
                rationale_parts.append(
                    f"Downgraded to NO_TRADE: poor risk/reward ratio ({risk_reward:.2f}:1 < {self.min_risk_reward}:1)"
                )
        
        # Calculate confidence (normalized score)
        confidence = min(1.0, score / 100.0)
        
        # Build rationale
        rationale = self._build_rationale(
            signal=signal,
            rationale_parts=rationale_parts,
            score=score,
            rsi=rsi,
            vwap_position=vwap_position,
            trend_strength=trend_strength,
            score_result=score_result,
        )
        
        # Calculate valid_until timestamp
        valid_until = self._calculate_valid_until()
        
        # Collect warnings
        warnings = self._collect_warnings(
            signal=signal,
            rsi=rsi,
            risk_reward=risk_reward,
            technical_analysis=technical_analysis,
            data_freshness=data_freshness,
        )
        
        return IntradayRecommendation(
            signal=signal,
            confidence=confidence,
            entry=entry,
            stop_loss=stop_loss,
            target=target,
            risk_reward=risk_reward,
            rationale=rationale,
            is_stale=data_freshness.is_stale,
            valid_until=valid_until,
            warnings=warnings,
        )
    
    def _determine_signal(
        self,
        score: float,
        current_price: float,
        vwap: float,
        vwap_position: VWAPPosition,
        rsi: float,
        trend_strength: TrendStrength,
        has_existing_position: bool,
        data_freshness: DataFreshness,
    ) -> Tuple[IntradaySignal, List[str]]:
        """
        Determine trading signal based on conditions (Task 60.2).
        
        Logic:
        - BUY: score > 65, bullish trend, price > VWAP, RSI 40-70, data fresh
        - SELL: score > 65, bearish trend, price < VWAP, RSI 30-60, data fresh
        - HOLD: existing position, no clear directional signal, data fresh
        - NO_TRADE: score < 65 OR poor risk/reward OR data stale OR conflicting indicators
        
        Args:
            score: Composite score from scoring service
            current_price: Current market price
            vwap: Volume Weighted Average Price
            vwap_position: Price position relative to VWAP
            rsi: RSI value
            trend_strength: Trend strength classification
            has_existing_position: Whether trader has existing position
            data_freshness: Data freshness tracking
        
        Returns:
            Tuple of (signal, rationale_parts)
        """
        rationale_parts = []
        
        # Check if score meets minimum threshold
        if score < self.min_confidence_score:
            rationale_parts.append(
                f"Score {score:.1f} below confidence threshold {self.min_confidence_score}"
            )
            return IntradaySignal.NO_TRADE, rationale_parts
        
        # Check for bullish conditions (BUY signal)
        is_bullish_trend = trend_strength in [
            TrendStrength.STRONG_BULLISH,
            TrendStrength.WEAK_BULLISH,
        ]
        is_price_above_vwap = vwap_position == VWAPPosition.ABOVE
        is_rsi_in_buy_range = self.rsi_buy_min <= rsi <= self.rsi_buy_max
        
        if is_bullish_trend and is_price_above_vwap and is_rsi_in_buy_range:
            rationale_parts.append("Bullish trend confirmed")
            rationale_parts.append(f"Price above VWAP ({current_price:.2f} > {vwap:.2f})")
            rationale_parts.append(f"RSI in buy range ({rsi:.1f})")
            return IntradaySignal.BUY, rationale_parts
        
        # Check for bearish conditions (SELL signal)
        is_bearish_trend = trend_strength in [
            TrendStrength.STRONG_BEARISH,
            TrendStrength.WEAK_BEARISH,
        ]
        is_price_below_vwap = vwap_position == VWAPPosition.BELOW
        is_rsi_in_sell_range = self.rsi_sell_min <= rsi <= self.rsi_sell_max
        
        if is_bearish_trend and is_price_below_vwap and is_rsi_in_sell_range:
            rationale_parts.append("Bearish trend confirmed")
            rationale_parts.append(f"Price below VWAP ({current_price:.2f} < {vwap:.2f})")
            rationale_parts.append(f"RSI in sell range ({rsi:.1f})")
            return IntradaySignal.SELL, rationale_parts
        
        # Check for HOLD conditions
        if has_existing_position:
            rationale_parts.append("Existing position maintained")
            rationale_parts.append("No clear directional signal for exit")
            return IntradaySignal.HOLD, rationale_parts
        
        # Default to NO_TRADE if conditions are mixed/conflicting
        rationale_parts.append("Mixed or conflicting indicators")
        
        # Explain why conditions don't meet BUY/SELL criteria
        if not is_bullish_trend and not is_bearish_trend:
            rationale_parts.append(f"Neutral trend ({trend_strength.value})")
        elif is_bullish_trend:
            if not is_price_above_vwap:
                rationale_parts.append(f"Bullish trend but price below VWAP")
            if not is_rsi_in_buy_range:
                rationale_parts.append(f"Bullish trend but RSI outside buy range ({rsi:.1f})")
        elif is_bearish_trend:
            if not is_price_below_vwap:
                rationale_parts.append(f"Bearish trend but price above VWAP")
            if not is_rsi_in_sell_range:
                rationale_parts.append(f"Bearish trend but RSI outside sell range ({rsi:.1f})")
        
        return IntradaySignal.NO_TRADE, rationale_parts
    
    def _calculate_levels(
        self,
        signal: IntradaySignal,
        current_price: float,
        technical_analysis: IntradayTechnicalAnalysis,
        opening_range: Optional[OpeningRangeResult],
        prev_day_levels: Optional[PreviousDayLevelsResult],
    ) -> Tuple[float, float, float]:
        """
        Calculate entry, stop loss, and target levels.
        
        Uses support/resistance, ATR, and previous day levels to set levels.
        
        Args:
            signal: Trading signal
            current_price: Current market price
            technical_analysis: Technical indicators
            opening_range: Optional opening range analysis
            prev_day_levels: Optional previous day levels analysis
        
        Returns:
            Tuple of (entry, stop_loss, target)
        """
        entry = current_price
        atr = technical_analysis.atr
        
        # Get support and resistance levels
        support_levels = technical_analysis.support_levels
        resistance_levels = technical_analysis.resistance_levels
        
        if signal == IntradaySignal.BUY:
            # Stop loss: nearest support or 1.5 * ATR below entry
            if support_levels:
                # Find nearest support below current price
                nearest_support = max([s for s in support_levels if s < current_price], default=None)
                if nearest_support:
                    stop_loss = nearest_support
                else:
                    stop_loss = entry - (1.5 * atr)
            else:
                stop_loss = entry - (1.5 * atr)
            
            # Calculate risk
            risk = entry - stop_loss
            
            # Target: nearest resistance or 2.5 * risk above entry (ensures 2.5:1 R/R minimum)
            if resistance_levels:
                # Find nearest resistance above current price
                nearest_resistance = min([r for r in resistance_levels if r > current_price], default=None)
                if nearest_resistance:
                    # Use resistance as target only if it provides good R/R (at least 1.5:1)
                    resistance_reward = nearest_resistance - entry
                    if resistance_reward >= risk * 1.5:
                        target = nearest_resistance
                    else:
                        # Resistance too close, use 2.5 * risk instead
                        target = entry + (2.5 * risk)
                else:
                    target = entry + (2.5 * risk)
            else:
                target = entry + (2.5 * risk)
        
        elif signal == IntradaySignal.SELL:
            # Stop loss: nearest resistance or 1.5 * ATR above entry
            if resistance_levels:
                # Find nearest resistance above current price
                nearest_resistance = min([r for r in resistance_levels if r > current_price], default=None)
                if nearest_resistance:
                    stop_loss = nearest_resistance
                else:
                    stop_loss = entry + (1.5 * atr)
            else:
                stop_loss = entry + (1.5 * atr)
            
            # Calculate risk
            risk = stop_loss - entry
            
            # Target: nearest support or 2.5 * risk below entry (ensures 2.5:1 R/R minimum)
            if support_levels:
                # Find nearest support below current price
                nearest_support = max([s for s in support_levels if s < current_price], default=None)
                if nearest_support:
                    # Use support as target only if it provides good R/R (at least 1.5:1)
                    support_reward = entry - nearest_support
                    if support_reward >= risk * 1.5:
                        target = nearest_support
                    else:
                        # Support too close, use 2.5 * risk instead
                        target = entry - (2.5 * risk)
                else:
                    target = entry - (2.5 * risk)
            else:
                target = entry - (2.5 * risk)
        
        else:  # HOLD or NO_TRADE
            # Neutral levels for non-directional signals
            stop_loss = entry - (1.5 * atr)
            target = entry + (1.5 * atr)
        
        return entry, stop_loss, target
    
    def _determine_vwap_position(
        self, current_price: float, vwap: float
    ) -> VWAPPosition:
        """
        Determine price position relative to VWAP.
        
        Args:
            current_price: Current market price
            vwap: Volume Weighted Average Price
        
        Returns:
            VWAPPosition (ABOVE/BELOW/AT)
        """
        vwap_diff_pct = abs((current_price - vwap) / vwap) * 100
        
        # Use 0.05% threshold for "AT"
        if vwap_diff_pct < 0.05:
            return VWAPPosition.AT
        elif current_price > vwap:
            return VWAPPosition.ABOVE
        else:
            return VWAPPosition.BELOW
    
    def _determine_trend_strength(
        self, current_price: float, technical_analysis: IntradayTechnicalAnalysis
    ) -> TrendStrength:
        """
        Determine trend strength from technical indicators.
        
        Args:
            current_price: Current market price
            technical_analysis: Technical indicators
        
        Returns:
            TrendStrength classification
        """
        ema_9 = technical_analysis.ema_9
        ema_21 = technical_analysis.ema_21
        ema_50 = technical_analysis.ema_50
        rsi = technical_analysis.rsi
        macd_histogram = technical_analysis.macd.histogram
        
        score = 50.0  # Start at neutral
        
        # 1. EMA alignment (±20 points)
        if current_price > ema_9 > ema_21 > ema_50:
            score += 20  # Strong bullish alignment
        elif current_price > ema_9 > ema_21:
            score += 15  # Moderate bullish alignment
        elif current_price > ema_9:
            score += 10  # Weak bullish alignment
        elif current_price < ema_9 < ema_21 < ema_50:
            score -= 20  # Strong bearish alignment
        elif current_price < ema_9 < ema_21:
            score -= 15  # Moderate bearish alignment
        elif current_price < ema_9:
            score -= 10  # Weak bearish alignment
        
        # 2. RSI (±15 points)
        if rsi > 60:
            score += 15
        elif rsi > 50:
            score += 5
        elif rsi < 40:
            score -= 15
        elif rsi < 50:
            score -= 5
        
        # 3. MACD histogram (±15 points)
        if macd_histogram > 0:
            score += 15
        else:
            score -= 15
        
        # Classify trend strength
        if score >= 70:
            return TrendStrength.STRONG_BULLISH
        elif score >= 55:
            return TrendStrength.WEAK_BULLISH
        elif score >= 45:
            return TrendStrength.NEUTRAL
        elif score >= 30:
            return TrendStrength.WEAK_BEARISH
        else:
            return TrendStrength.STRONG_BEARISH
    
    def _generate_hold_stale_data(
        self,
        current_price: float,
        technical_analysis: IntradayTechnicalAnalysis,
        data_freshness: DataFreshness,
    ) -> IntradayRecommendation:
        """
        Generate HOLD recommendation when data is stale (Task 60.3).
        
        Args:
            current_price: Current market price
            technical_analysis: Technical indicators
            data_freshness: Data freshness tracking
        
        Returns:
            IntradayRecommendation with HOLD signal and stale data message
        """
        atr = technical_analysis.atr
        
        return IntradayRecommendation(
            signal=IntradaySignal.HOLD,
            confidence=0.0,  # No confidence when data is stale
            entry=current_price,
            stop_loss=current_price - (1.5 * atr),
            target=current_price + (1.5 * atr),
            risk_reward=1.0,
            rationale=f"Data is stale. Waiting for fresh data. (Age: {data_freshness.age_seconds:.0f}s)",
            is_stale=True,
            valid_until=None,
            warnings=["Data is stale - recommendation not reliable"],
        )
    
    def _build_rationale(
        self,
        signal: IntradaySignal,
        rationale_parts: List[str],
        score: float,
        rsi: float,
        vwap_position: VWAPPosition,
        trend_strength: TrendStrength,
        score_result: IntradayScoreResult,
    ) -> str:
        """
        Build comprehensive rationale for recommendation.
        
        Args:
            signal: Trading signal
            rationale_parts: List of rationale components
            score: Composite score
            rsi: RSI value
            vwap_position: VWAP position
            trend_strength: Trend strength
            score_result: Scoring result with component breakdown
        
        Returns:
            Human-readable rationale string
        """
        # Start with signal and score
        parts = [
            f"Signal: {signal.value}",
            f"Confidence Score: {score:.1f}/100 ({score_result.strength})",
        ]
        
        # Add main rationale points
        parts.extend(rationale_parts)
        
        # Add key technical details
        parts.append(
            f"Technical: RSI={rsi:.1f}, VWAP Position={vwap_position.value}, "
            f"Trend={trend_strength.value}"
        )
        
        # Add top scoring components
        components = score_result.components
        parts.append(
            f"Top Factors: Trend={components.trend_score:.0f}, "
            f"Momentum={components.momentum_score:.0f}, "
            f"VWAP={components.vwap_score:.0f}"
        )
        
        # Join with ". " and limit length
        rationale = ". ".join(parts)
        if len(rationale) > 1000:
            rationale = rationale[:997] + "..."
        
        return rationale
    
    def _calculate_valid_until(self) -> str:
        """
        Calculate valid_until timestamp for recommendation.
        
        Returns:
            ISO 8601 timestamp string
        """
        valid_until = datetime.now(timezone.utc) + timedelta(
            minutes=self.valid_duration_minutes
        )
        return valid_until.isoformat()
    
    def _collect_warnings(
        self,
        signal: IntradaySignal,
        rsi: float,
        risk_reward: float,
        technical_analysis: IntradayTechnicalAnalysis,
        data_freshness: DataFreshness,
    ) -> List[str]:
        """
        Collect warnings about data quality and market conditions.
        
        Args:
            signal: Trading signal
            rsi: RSI value
            risk_reward: Risk/reward ratio
            technical_analysis: Technical indicators
            data_freshness: Data freshness tracking
        
        Returns:
            List of warning strings
        """
        warnings = []
        
        # RSI extreme warnings
        if rsi > 75:
            warnings.append("RSI extremely overbought - caution on long entries")
        elif rsi < 25:
            warnings.append("RSI extremely oversold - caution on short entries")
        
        # Risk/reward warning
        if signal in [IntradaySignal.BUY, IntradaySignal.SELL]:
            if risk_reward < self.min_risk_reward:
                warnings.append(
                    f"Risk/reward ({risk_reward:.2f}:1) below recommended minimum ({self.min_risk_reward}:1)"
                )
        
        # Low volume warning
        if technical_analysis.relative_volume < 0.5:
            warnings.append("Low volume - reduced liquidity may affect execution")
        
        # Data age warning (even if not stale, warn if getting old)
        if data_freshness.age_seconds > 180:  # 3 minutes
            warnings.append(
                f"Data age {data_freshness.age_seconds:.0f}s - consider refreshing"
            )
        
        return warnings
