"""
Intraday Scoring Service.

This service calculates deterministic scores for intraday trading setups
based on technical analysis and intraday-specific factors. The scoring
algorithm is completely deterministic with NO AI involvement - same inputs
always produce the same outputs.

Scoring Components (Task 58.1, 58.2):
- Trend (25%): Based on EMA 9/21 alignment and price position
- Momentum (20%): Based on RSI, MACD, rate of change
- Volume (15%): Based on relative volume vs average
- VWAP (15%): Based on price position relative to VWAP
- Opening Range (10%): Based on breakout status and confirmation
- Previous Day Levels (10%): Based on breach status
- Risk/Reward (5%): Based on stop loss distance vs target distance

Requirements: 6.6
"""

from typing import List, Optional
from pydantic import BaseModel, Field
from models.intraday import (
    IntradayTechnicalAnalysis,
    OpeningRangeResult,
    PreviousDayLevelsResult,
    BreakoutStatus,
    BreachStatus,
    VWAPPosition,
)


class IntradayScoreComponents(BaseModel):
    """Individual components of the intraday score."""
    
    trend_score: float = Field(..., ge=0.0, le=100.0, description="Trend score based on EMA alignment (0-100)")
    momentum_score: float = Field(..., ge=0.0, le=100.0, description="Momentum score from RSI, MACD (0-100)")
    volume_score: float = Field(..., ge=0.0, le=100.0, description="Volume strength score (0-100)")
    vwap_score: float = Field(..., ge=0.0, le=100.0, description="VWAP position score (0-100)")
    opening_range_score: float = Field(..., ge=0.0, le=100.0, description="Opening range breakout score (0-100)")
    prev_day_levels_score: float = Field(..., ge=0.0, le=100.0, description="Previous day levels score (0-100)")
    risk_reward_score: float = Field(..., ge=0.0, le=100.0, description="Risk/reward ratio score (0-100)")


class IntradayScoreResult(BaseModel):
    """Complete intraday scoring result."""
    
    total_score: float = Field(..., ge=0.0, le=100.0, description="Total weighted score (0-100)")
    components: IntradayScoreComponents = Field(..., description="Individual score components")
    signals: List[str] = Field(default_factory=list, description="Human-readable signals")
    strength: str = Field(..., description="Overall strength: STRONG, MODERATE, WEAK")


class IntradayScoringService:
    """
    Service for calculating deterministic intraday trading scores.
    
    Implements a weighted scoring algorithm with 7 components:
    - Trend (25%): EMA 9/21 alignment, price position
    - Momentum (20%): RSI, MACD, rate of change
    - Volume (15%): Relative volume vs average
    - VWAP (15%): Price position relative to VWAP
    - Opening Range (10%): Breakout status and confirmation
    - Previous Day Levels (10%): Breach status
    - Risk/Reward (5%): Stop loss distance vs target distance
    
    This is a DETERMINISTIC service - NO AI is used. Same inputs
    always produce the same outputs.
    
    Requirements: 6.6
    """
    
    # Default scoring weights (must sum to 1.0) - Task 58.1
    DEFAULT_WEIGHTS = {
        "trend": 0.25,              # Trend alignment
        "momentum": 0.20,           # RSI, MACD momentum
        "volume": 0.15,             # Relative volume
        "vwap": 0.15,               # VWAP position
        "opening_range": 0.10,      # Opening range breakout
        "prev_day_levels": 0.10,    # Previous day levels
        "risk_reward": 0.05,        # Risk/reward ratio
    }
    
    def __init__(
        self,
        weights: Optional[dict] = None,
        rsi_oversold: float = 30.0,
        rsi_overbought: float = 70.0,
        volume_threshold: float = 1.0,
        min_risk_reward: float = 1.5,  # Minimum risk/reward for intraday
    ):
        """
        Initialize intraday scoring service.
        
        Args:
            weights: Optional custom scoring weights (must sum to 1.0)
            rsi_oversold: RSI threshold for oversold (default: 30)
            rsi_overbought: RSI threshold for overbought (default: 70)
            volume_threshold: Relative volume threshold for strong volume (default: 1.0)
            min_risk_reward: Minimum risk/reward ratio (default: 1.5)
        """
        self.weights = weights or self.DEFAULT_WEIGHTS
        self.rsi_oversold = rsi_oversold
        self.rsi_overbought = rsi_overbought
        self.volume_threshold = volume_threshold
        self.min_risk_reward = min_risk_reward
        
        # Validate weights sum to 1.0
        weight_sum = sum(self.weights.values())
        if abs(weight_sum - 1.0) > 0.01:
            raise ValueError(f"Weights must sum to 1.0, got {weight_sum}")
    
    def calculate_score(
        self,
        current_price: float,
        technical_analysis: IntradayTechnicalAnalysis,
        opening_range: Optional[OpeningRangeResult] = None,
        prev_day_levels: Optional[PreviousDayLevelsResult] = None,
        stop_loss: Optional[float] = None,
        target: Optional[float] = None,
    ) -> IntradayScoreResult:
        """
        Calculate comprehensive intraday trading score.
        
        This is a DETERMINISTIC function - same inputs always produce
        the same outputs. NO AI is used in scoring.
        
        Args:
            current_price: Current market price
            technical_analysis: Technical indicators from IntradayAnalysisService
            opening_range: Optional opening range analysis
            prev_day_levels: Optional previous day levels analysis
            stop_loss: Optional stop loss price for risk/reward calculation
            target: Optional target price for risk/reward calculation
        
        Returns:
            IntradayScoreResult with total score (0-100) and component breakdown
            
        Requirements: 6.6
        """
        signals: List[str] = []
        
        # Calculate individual component scores (Task 58.2)
        
        # 1. Trend Score (25%) - Based on EMA 9/21 alignment and price position
        trend_score = self._calculate_trend_score(
            current_price, technical_analysis, signals
        )
        
        # 2. Momentum Score (20%) - Based on RSI, MACD, rate of change
        momentum_score = self._calculate_momentum_score(
            technical_analysis, signals
        )
        
        # 3. Volume Score (15%) - Based on relative volume vs average
        volume_score = self._calculate_volume_score(
            technical_analysis, signals
        )
        
        # 4. VWAP Score (15%) - Based on price position relative to VWAP
        vwap_score = self._calculate_vwap_score(
            current_price, technical_analysis, signals
        )
        
        # 5. Opening Range Score (10%) - Based on breakout status and confirmation
        opening_range_score = self._calculate_opening_range_score(
            opening_range, signals
        )
        
        # 6. Previous Day Levels Score (10%) - Based on breach status
        prev_day_levels_score = self._calculate_prev_day_levels_score(
            prev_day_levels, signals
        )
        
        # 7. Risk/Reward Score (5%) - Based on stop loss distance vs target distance
        risk_reward_score = self._calculate_risk_reward_score(
            current_price, stop_loss, target, signals
        )
        
        # Calculate weighted total score
        total_score = (
            trend_score * self.weights["trend"]
            + momentum_score * self.weights["momentum"]
            + volume_score * self.weights["volume"]
            + vwap_score * self.weights["vwap"]
            + opening_range_score * self.weights["opening_range"]
            + prev_day_levels_score * self.weights["prev_day_levels"]
            + risk_reward_score * self.weights["risk_reward"]
        )
        
        # Determine overall strength
        if total_score >= 70.0:
            strength = "STRONG"
        elif total_score >= 50.0:
            strength = "MODERATE"
        else:
            strength = "WEAK"
        
        return IntradayScoreResult(
            total_score=total_score,
            components=IntradayScoreComponents(
                trend_score=trend_score,
                momentum_score=momentum_score,
                volume_score=volume_score,
                vwap_score=vwap_score,
                opening_range_score=opening_range_score,
                prev_day_levels_score=prev_day_levels_score,
                risk_reward_score=risk_reward_score,
            ),
            signals=signals,
            strength=strength,
        )
    
    def _calculate_momentum_score(
        self,
        technical: IntradayTechnicalAnalysis,
        signals: List[str],
    ) -> float:
        """
        Calculate momentum score based on RSI, MACD, and rate of change.
        
        Scoring logic (Task 58.2):
        - RSI component (40%): Optimal range 40-60, penalties for extremes
        - MACD component (40%): Positive histogram = bullish, negative = bearish
        - Rate of change (20%): Derived from price movement indicators
        
        Args:
            technical: Technical indicators
            signals: List to append signals to
        
        Returns:
            Momentum score (0-100)
        """
        score = 0.0
        
        # RSI component (40%)
        rsi = technical.rsi
        
        if 40 <= rsi <= 60:
            # Optimal momentum zone for intraday trading
            rsi_score = 100.0
            signals.append(f"RSI in optimal momentum zone ({rsi:.1f})")
        elif 30 <= rsi < 40:
            # Bullish momentum building
            rsi_score = 70.0 + (rsi - 30) * 3
            signals.append(f"RSI showing bullish momentum ({rsi:.1f})")
        elif 60 < rsi <= 70:
            # Bearish momentum building
            rsi_score = 70.0 + (70 - rsi) * 3
            signals.append(f"RSI showing strong momentum ({rsi:.1f})")
        elif rsi > 70:
            # Overbought - reduce score
            rsi_score = max(40.0, 100.0 - (rsi - 70) * 2)
            signals.append(f"RSI overbought ({rsi:.1f}) - caution on longs")
        else:  # rsi < 30
            # Oversold - reduce score
            rsi_score = max(40.0, 100.0 - (30 - rsi) * 2)
            signals.append(f"RSI oversold ({rsi:.1f}) - caution on shorts")
        
        score += rsi_score * 0.4
        
        # MACD component (40%)
        macd = technical.macd
        histogram = macd.histogram
        
        # MACD histogram shows momentum direction and strength
        if histogram > 5.0:
            macd_score = 100.0
            signals.append(f"Strong bullish MACD momentum (histogram: {histogram:.2f})")
        elif histogram > 2.0:
            macd_score = 80.0 + (histogram - 2.0) * 6.67
            signals.append(f"Bullish MACD momentum (histogram: {histogram:.2f})")
        elif histogram > 0:
            macd_score = 60.0 + histogram * 10
            signals.append(f"Weak bullish MACD (histogram: {histogram:.2f})")
        elif histogram > -2.0:
            macd_score = 60.0 + abs(histogram) * 10
            signals.append(f"Weak bearish MACD (histogram: {histogram:.2f})")
        elif histogram > -5.0:
            macd_score = 80.0 + (abs(histogram) - 2.0) * 6.67
            signals.append(f"Bearish MACD momentum (histogram: {histogram:.2f})")
        else:
            macd_score = 100.0
            signals.append(f"Strong bearish MACD momentum (histogram: {histogram:.2f})")
        
        score += macd_score * 0.4
        
        # Rate of change component (20%) - derived from relative volume and momentum
        # Higher relative volume with momentum = stronger rate of change
        relative_vol = technical.relative_volume
        
        if relative_vol > 1.5:
            roc_score = 100.0
        elif relative_vol > 1.2:
            roc_score = 85.0
        elif relative_vol >= 1.0:
            roc_score = 70.0
        else:
            roc_score = max(30.0, 70.0 - (1.0 - relative_vol) * 50)
        
        score += roc_score * 0.2
        
        return score
    
    def _calculate_trend_score(
        self,
        current_price: float,
        technical: IntradayTechnicalAnalysis,
        signals: List[str],
    ) -> float:
        """
        Calculate trend score based on EMA 9/21 alignment and price position.
        
        Scoring logic (Task 58.2):
        - Strong bullish alignment (price > EMA9 > EMA21): 90-100 points
        - Moderate bullish alignment (price > EMA9): 70-85 points
        - Neutral (EMAs mixed): 40-60 points
        - Moderate bearish alignment (price < EMA9): 70-85 points
        - Strong bearish alignment (price < EMA9 < EMA21): 90-100 points
        
        Args:
            current_price: Current market price
            technical: Technical indicators
            signals: List to append signals to
        
        Returns:
            Trend score (0-100)
        """
        ema_9 = technical.ema_9
        ema_21 = technical.ema_21
        
        # Calculate percentage distances for fine-tuning
        dist_from_ema9_pct = ((current_price - ema_9) / ema_9) * 100
        
        # Check bullish alignment
        if current_price > ema_9 > ema_21:
            # Strong bullish alignment
            score = min(100.0, 90.0 + abs(dist_from_ema9_pct) * 2)
            signals.append(f"Strong bullish trend: Price > EMA9 > EMA21 ({dist_from_ema9_pct:+.2f}%)")
        elif current_price > ema_9:
            # Moderate bullish
            score = min(85.0, 70.0 + abs(dist_from_ema9_pct) * 3)
            signals.append(f"Moderate bullish trend: Price > EMA9 ({dist_from_ema9_pct:+.2f}%)")
        # Check bearish alignment
        elif current_price < ema_9 < ema_21:
            # Strong bearish alignment
            score = min(100.0, 90.0 + abs(dist_from_ema9_pct) * 2)
            signals.append(f"Strong bearish trend: Price < EMA9 < EMA21 ({dist_from_ema9_pct:+.2f}%)")
        elif current_price < ema_9:
            # Moderate bearish
            score = min(85.0, 70.0 + abs(dist_from_ema9_pct) * 3)
            signals.append(f"Moderate bearish trend: Price < EMA9 ({dist_from_ema9_pct:+.2f}%)")
        else:
            # Neutral / mixed
            score = 50.0
            signals.append("Neutral trend: EMAs not aligned")
        
        return score
    
    def _calculate_volume_score(
        self,
        technical: IntradayTechnicalAnalysis,
        signals: List[str],
    ) -> float:
        """
        Calculate volume score based on relative volume vs average.
        
        Scoring logic (Task 58.2):
        - Very high volume (>1.5x): 95-100 points
        - High volume (1.2-1.5x): 80-95 points
        - Above average (1.0-1.2x): 65-80 points
        - Average (0.8-1.0x): 50-65 points
        - Below average (<0.8x): 20-50 points
        
        Args:
            technical: Technical indicators
            signals: List to append signals to
        
        Returns:
            Volume score (0-100)
        """
        relative_volume = technical.relative_volume
        
        if relative_volume >= 1.5:
            score = min(100.0, 95.0 + (relative_volume - 1.5) * 10)
            signals.append(f"Very high volume ({relative_volume:.2f}x average)")
        elif relative_volume >= 1.2:
            score = 80.0 + (relative_volume - 1.2) * 50
            signals.append(f"High volume ({relative_volume:.2f}x average)")
        elif relative_volume >= 1.0:
            score = 65.0 + (relative_volume - 1.0) * 75
            signals.append(f"Above average volume ({relative_volume:.2f}x)")
        elif relative_volume >= 0.8:
            score = 50.0 + (relative_volume - 0.8) * 75
            signals.append(f"Average volume ({relative_volume:.2f}x)")
        else:
            score = max(20.0, 50.0 - (0.8 - relative_volume) * 37.5)
            signals.append(f"Below average volume ({relative_volume:.2f}x)")
        
        return score
    
    def _calculate_vwap_score(
        self,
        current_price: float,
        technical: IntradayTechnicalAnalysis,
        signals: List[str],
    ) -> float:
        """
        Calculate VWAP score based on price position relative to VWAP.
        
        Scoring logic (Task 58.2):
        - Price significantly above/below VWAP: Higher score (trending)
        - Price at VWAP: Moderate score (neutral)
        
        Args:
            current_price: Current market price
            technical: Technical indicators
            signals: List to append signals to
        
        Returns:
            VWAP score (0-100)
        """
        vwap = technical.vwap
        vwap_diff_pct = ((current_price - vwap) / vwap) * 100
        
        # Distance from VWAP indicates trend strength
        abs_diff = abs(vwap_diff_pct)
        
        if abs_diff >= 1.0:
            # Strong deviation from VWAP
            score = min(100.0, 85.0 + (abs_diff - 1.0) * 15)
            if vwap_diff_pct > 0:
                signals.append(f"Price significantly above VWAP ({vwap_diff_pct:+.2f}%) - strong bullish")
            else:
                signals.append(f"Price significantly below VWAP ({vwap_diff_pct:+.2f}%) - strong bearish")
        elif abs_diff >= 0.5:
            # Moderate deviation
            score = 70.0 + (abs_diff - 0.5) * 30
            if vwap_diff_pct > 0:
                signals.append(f"Price above VWAP ({vwap_diff_pct:+.2f}%) - bullish")
            else:
                signals.append(f"Price below VWAP ({vwap_diff_pct:+.2f}%) - bearish")
        elif abs_diff >= 0.2:
            # Slight deviation
            score = 60.0 + (abs_diff - 0.2) * 33.33
            signals.append(f"Price near VWAP ({vwap_diff_pct:+.2f}%)")
        else:
            # Very close to VWAP - neutral
            score = 50.0 + abs_diff * 50
            signals.append(f"Price at VWAP ({vwap_diff_pct:+.2f}%) - neutral")
        
        return score
    
    def _calculate_opening_range_score(
        self,
        opening_range: Optional[OpeningRangeResult],
        signals: List[str],
    ) -> float:
        """
        Calculate opening range score based on breakout status and confirmation.
        
        Scoring logic (Task 58.2):
        - Breakout with volume confirmation: 95-100 points
        - Breakout without volume confirmation: 65-75 points
        - Within opening range: 40-50 points
        - No data available: 50 points (neutral)
        
        Args:
            opening_range: Opening range analysis result
            signals: List to append signals to
        
        Returns:
            Opening range score (0-100)
        """
        if not opening_range:
            # No opening range data available - neutral score
            signals.append("Opening range data not available")
            return 50.0
        
        status = opening_range.breakout_status
        
        if status == BreakoutStatus.BREAKOUT_ABOVE:
            if opening_range.volume_confirmed:
                score = min(100.0, 95.0 + opening_range.volume_ratio * 2)
                signals.append(
                    f"Opening range breakout above with volume confirmation "
                    f"({opening_range.volume_ratio:.2f}x)"
                )
            else:
                score = 65.0 + min(10.0, opening_range.volume_ratio * 5)
                signals.append(
                    f"Opening range breakout above (unconfirmed volume: {opening_range.volume_ratio:.2f}x)"
                )
        elif status == BreakoutStatus.BREAKDOWN_BELOW:
            if opening_range.volume_confirmed:
                score = min(100.0, 95.0 + opening_range.volume_ratio * 2)
                signals.append(
                    f"Opening range breakdown below with volume confirmation "
                    f"({opening_range.volume_ratio:.2f}x)"
                )
            else:
                score = 65.0 + min(10.0, opening_range.volume_ratio * 5)
                signals.append(
                    f"Opening range breakdown below (unconfirmed volume: {opening_range.volume_ratio:.2f}x)"
                )
        else:  # WITHIN_RANGE
            score = 40.0
            signals.append("Price within opening range - waiting for breakout")
        
        return score
    
    def _calculate_prev_day_levels_score(
        self,
        prev_day_levels: Optional[PreviousDayLevelsResult],
        signals: List[str],
    ) -> float:
        """
        Calculate previous day levels score based on breach status.
        
        Scoring logic (Task 58.2):
        - Above previous day high: 75-100 points (based on significance)
        - Below previous day low: 75-100 points (based on significance)
        - Within previous day range: 40-60 points
        - No data available: 50 points (neutral)
        
        Args:
            prev_day_levels: Previous day levels analysis result
            signals: List to append signals to
        
        Returns:
            Previous day levels score (0-100)
        """
        if not prev_day_levels:
            # No previous day levels data - neutral score
            signals.append("Previous day levels data not available")
            return 50.0
        
        status = prev_day_levels.breach_status
        significance = prev_day_levels.breach_significance
        
        if status == BreachStatus.ABOVE_HIGH:
            score = min(100.0, 75.0 + significance * 25)
            signals.append(
                f"Price above previous day high (significance: {significance:.2f})"
            )
        elif status == BreachStatus.BELOW_LOW:
            score = min(100.0, 75.0 + significance * 25)
            signals.append(
                f"Price below previous day low (significance: {significance:.2f})"
            )
        else:  # WITHIN_RANGE
            # Within range - score based on position
            score = 45.0 + significance * 15
            signals.append("Price within previous day range")
        
        return score
    
    def _calculate_risk_reward_score(
        self,
        current_price: float,
        stop_loss: Optional[float],
        target: Optional[float],
        signals: List[str],
    ) -> float:
        """
        Calculate risk/reward score based on stop loss distance vs target distance.
        
        Scoring logic (Task 58.2):
        - R:R >= 3.0: 100 points
        - R:R >= 2.0: 85-100 points
        - R:R >= 1.5 (minimum for intraday): 70-85 points
        - R:R < 1.5: 20-70 points (poor)
        - No stop/target: 50 points (neutral)
        
        Args:
            current_price: Current market price
            stop_loss: Stop loss price (optional)
            target: Target price (optional)
            signals: List to append signals to
        
        Returns:
            Risk/reward score (0-100)
        """
        if not stop_loss or not target:
            # No risk/reward data available
            signals.append("Risk/reward data not available")
            return 50.0
        
        # Calculate risk (distance to stop loss)
        risk = abs(current_price - stop_loss)
        
        # Calculate reward (distance to target)
        reward = abs(target - current_price)
        
        # Avoid division by zero
        if risk == 0:
            signals.append("Invalid risk/reward: stop loss at current price")
            return 20.0
        
        # Calculate risk/reward ratio
        rr_ratio = reward / risk
        
        # Score based on ratio
        if rr_ratio >= 3.0:
            score = 100.0
            signals.append(f"Excellent risk/reward ratio ({rr_ratio:.2f}:1)")
        elif rr_ratio >= 2.0:
            score = 85.0 + (rr_ratio - 2.0) * 15
            signals.append(f"Good risk/reward ratio ({rr_ratio:.2f}:1)")
        elif rr_ratio >= self.min_risk_reward:
            score = 70.0 + (rr_ratio - self.min_risk_reward) * 30
            signals.append(f"Acceptable risk/reward ratio ({rr_ratio:.2f}:1)")
        elif rr_ratio >= 1.0:
            score = 40.0 + (rr_ratio - 1.0) * 60
            signals.append(f"Suboptimal risk/reward ratio ({rr_ratio:.2f}:1)")
        else:
            score = max(20.0, 40.0 * rr_ratio)
            signals.append(f"Poor risk/reward ratio ({rr_ratio:.2f}:1) - avoid trade")
        
        return score
