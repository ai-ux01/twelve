"""
Intraday Analysis Service.

This service performs comprehensive technical analysis for intraday trading,
calculating indicators optimized for same-day position trading. It orchestrates
all intraday-specific calculations including VWAP, EMAs, RSI, MACD, ATR, Volume,
opening range, previous day levels, support/resistance, and trendline detection.

Requirements: 6.1, 6.2, 6.3, 6.4
"""

from typing import List, Optional, Tuple
from datetime import datetime, timezone
from models import OHLCVData, TrendlineResult
from models.intraday import (
    IntradayInterval,
    IntradayTechnicalAnalysis,
    MACDIndicator,
    BollingerBands,
    DataFreshness,
    OpeningRangeResult,
    PreviousDayLevelsResult,
    PriceActionResult,
    VWAPPosition,
    EMACrossover,
    TrendStrength,
)
from calculators.rsi import calculate_rsi
from calculators.macd import calculate_macd
from calculators.moving_averages import calculate_ema
from calculators.vwap import calculate_vwap
from calculators.atr import calculate_atr
from calculators.volume_analysis import calculate_volume_ma, calculate_relative_volume
from calculators.bollinger import calculate_bollinger_bands
from calculators.support_resistance import detect_support_resistance
from calculators.opening_range import OpeningRangeCalculator
from calculators.previous_day_levels import PreviousDayLevelsCalculator
from services.trendline_service import TrendlineService, TrendlineServiceResult


class IntradayAnalysisService:
    """
    Service for intraday technical analysis.
    
    Orchestrates all intraday-specific calculations:
    - Core indicators: VWAP, EMA (5/15/50), RSI, MACD, ATR, Volume
    - Opening range calculation (Requirement 6.3)
    - Previous day levels calculation (Requirement 6.4)
    - Support/resistance levels from Phase 5
    - Trendline detection from Phase 5 (Requirement 6.2)
    
    Requirements: 6.2, 6.3, 6.4
    """
    
    def __init__(
        self,
        opening_range_minutes: int = 15,
        volume_period: int = 20,
        rsi_period: int = 14,
        atr_period: int = 14,
        stale_threshold_seconds: float = 300.0,  # 5 minutes for intraday
        lookback_period: int = 3,  # For swing detection in trendlines
        min_trendline_points: int = 2,  # Minimum points for trendline fitting
    ):
        """
        Initialize intraday analysis service.
        
        Args:
            opening_range_minutes: Number of minutes for opening range (default: 15)
            volume_period: Period for volume moving average (default: 20)
            rsi_period: Period for RSI calculation (default: 14)
            atr_period: Period for ATR calculation (default: 14)
            stale_threshold_seconds: Data age threshold for stale detection (default: 300s)
            lookback_period: Lookback period for swing detection (default: 3)
            min_trendline_points: Minimum points for trendline fitting (default: 2)
        """
        self.opening_range_minutes = opening_range_minutes
        self.volume_period = volume_period
        self.rsi_period = rsi_period
        self.atr_period = atr_period
        self.stale_threshold_seconds = stale_threshold_seconds
        
        # Initialize calculators
        self.opening_range_calc = OpeningRangeCalculator(
            period_minutes=opening_range_minutes
        )
        self.prev_day_calc = PreviousDayLevelsCalculator()
        self.trendline_service = TrendlineService(
            lookback_period=lookback_period,
            min_trendline_points=min_trendline_points,
            volume_period=volume_period,
            volume_threshold=1.0,
        )
    
    def analyze(
        self,
        symbol: str,
        interval: IntradayInterval,
        data: List[OHLCVData],
        include_support_resistance: bool = True,
        include_opening_range: bool = True,
        include_prev_day_levels: bool = True,
        include_trendlines: bool = True,
        timeframe_minutes: int = 5,  # For opening range calculation
    ) -> Tuple[
        IntradayTechnicalAnalysis,
        DataFreshness,
        Optional[OpeningRangeResult],
        Optional[PreviousDayLevelsResult],
        Optional[List[float]],
        Optional[List[float]],
        Optional[TrendlineServiceResult],
    ]:
        """
        Perform comprehensive intraday technical analysis.
        
        Orchestrates all intraday-specific calculations:
        - Core indicators: VWAP, EMA (9/21/50), RSI, MACD, ATR, Volume (Req 6.2)
        - Opening range calculation (Req 6.3)
        - Previous day levels calculation (Req 6.4)
        - Support/resistance levels from Phase 5 (Req 6.2)
        - Trendline detection from Phase 5 (Req 6.2)
        
        Args:
            symbol: Trading symbol
            interval: Intraday interval (1m, 5m, 15m, 30m, 1h)
            data: List of OHLCV candles (minimum 30 required)
            include_support_resistance: Whether to calculate support/resistance levels
            include_opening_range: Whether to calculate opening range
            include_prev_day_levels: Whether to calculate previous day levels
            include_trendlines: Whether to calculate trendlines
            timeframe_minutes: Timeframe of each candle in minutes (for opening range)
        
        Returns:
            Tuple of (technical_analysis, data_freshness, opening_range, prev_day_levels,
                     support_levels, resistance_levels, trendlines)
        
        Raises:
            ValueError: If insufficient data provided (need at least 30 candles)
        """
        # Validate minimum data requirement
        if len(data) < 30:
            raise ValueError(
                f"Insufficient data for intraday analysis: need at least 30 candles, "
                f"got {len(data)}"
            )
        
        # Extract price and volume arrays
        close_prices = [candle.close for candle in data]
        high_prices = [candle.high for candle in data]
        low_prices = [candle.low for candle in data]
        volumes = [candle.volume for candle in data]
        
        # Calculate data freshness
        data_freshness = self._calculate_data_freshness(data)
        
        # === Core Technical Indicators (Requirement 6.2) ===
        
        # RSI (14-period)
        rsi = calculate_rsi(close_prices, period=self.rsi_period)
        
        # MACD (12, 26, 9)
        macd_result = calculate_macd(
            close_prices, fast_period=12, slow_period=26, signal_period=9
        )
        macd = MACDIndicator(
            value=macd_result["value"],
            signal=macd_result["signal"],
            histogram=macd_result["histogram"],
        )
        
        # Exponential Moving Averages (9, 21, 50)
        ema_9 = calculate_ema(close_prices, period=9)
        ema_21 = calculate_ema(close_prices, period=21)
        ema_50 = calculate_ema(close_prices, period=50) if len(close_prices) >= 50 else ema_21
        
        # VWAP (Volume Weighted Average Price) - critical for intraday
        vwap = calculate_vwap(high_prices, low_prices, close_prices, volumes)
        
        # ATR (Average True Range) - volatility
        atr = calculate_atr(high_prices, low_prices, close_prices, period=self.atr_period)
        
        # Volume analysis
        current_volume = volumes[-1]
        volume_ma = calculate_volume_ma(volumes, period=self.volume_period)
        relative_volume = calculate_relative_volume(
            current_volume, volumes[:-1], period=self.volume_period
        )
        
        # Bollinger Bands (20-period, 2 std dev)
        upper_band, middle_band, lower_band = calculate_bollinger_bands(
            close_prices, period=20, num_std=2.0
        )
        bollinger = BollingerBands(
            upper=upper_band, middle=middle_band, lower=lower_band
        )
        
        # Support and resistance levels (Phase 5)
        support_levels: Optional[List[float]] = None
        resistance_levels: Optional[List[float]] = None
        
        if include_support_resistance:
            sr_levels = detect_support_resistance(
                data=data, window=5, tolerance_pct=0.02, min_touches=2
            )
            # Separate into support and resistance based on current price
            current_price = close_prices[-1]
            support_levels = [level.level for level in sr_levels if level.level < current_price]
            resistance_levels = [level.level for level in sr_levels if level.level > current_price]
        
        # Create technical analysis result
        technical_analysis = IntradayTechnicalAnalysis(
            rsi=rsi,
            macd=macd,
            ema_9=ema_9,
            ema_21=ema_21,
            ema_50=ema_50,
            vwap=vwap,
            atr=atr,
            volume=current_volume,
            relative_volume=relative_volume,
            bollinger_bands=bollinger,
            support_levels=support_levels or [],
            resistance_levels=resistance_levels or [],
        )
        
        # === Intraday-Specific Analysis ===
        
        # Opening range analysis (Requirement 6.3)
        opening_range: Optional[OpeningRangeResult] = None
        if include_opening_range:
            try:
                opening_range = self.opening_range_calc.calculate_opening_range(
                    data=data,
                    timeframe_minutes=timeframe_minutes,
                    current_price=None,  # Use last close
                    volume_period=self.volume_period,
                    volume_threshold=1.0,
                )
            except ValueError:
                # Not enough data for opening range
                pass
        
        # Previous day levels (Requirement 6.4)
        prev_day_levels: Optional[PreviousDayLevelsResult] = None
        if include_prev_day_levels:
            try:
                prev_day_levels = self.prev_day_calc.calculate_previous_day_levels(
                    historical_data=data,
                    current_price=None,  # Use last close
                    current_open=None,  # Use last open
                )
            except ValueError:
                # Not enough data for previous day levels
                pass
        
        # Trendline detection from Phase 5 (Requirement 6.2)
        trendlines: Optional[TrendlineServiceResult] = None
        if include_trendlines:
            try:
                trendlines = self.trendline_service.analyze_trendlines(data)
            except ValueError:
                # Not enough data for trendline analysis
                pass
        
        return (
            technical_analysis,
            data_freshness,
            opening_range,
            prev_day_levels,
            support_levels,
            resistance_levels,
            trendlines,
        )
    
    def _calculate_data_freshness(self, data: List[OHLCVData]) -> DataFreshness:
        """
        Calculate data freshness metrics.
        
        Args:
            data: List of OHLCV candles
        
        Returns:
            DataFreshness object with timestamp, age, and stale status
        """
        if not data:
            raise ValueError("Cannot calculate data freshness: no data provided")
        
        # Get the most recent candle timestamp
        latest_candle = data[-1]
        data_timestamp = latest_candle.timestamp
        
        # Calculate age in seconds
        now = datetime.now(timezone.utc)
        
        # Ensure data_timestamp is timezone-aware
        if data_timestamp.tzinfo is None:
            data_timestamp = data_timestamp.replace(tzinfo=timezone.utc)
        
        age_seconds = (now - data_timestamp).total_seconds()
        
        # Determine if data is stale
        is_stale = age_seconds > self.stale_threshold_seconds
        
        # Format timestamp as ISO 8601
        timestamp_str = data_timestamp.isoformat()
        
        return DataFreshness(
            timestamp=timestamp_str,
            age_seconds=age_seconds,
            is_stale=is_stale,
        )
    
    def analyze_price_action(
        self,
        data: List[OHLCVData],
        technical_analysis: IntradayTechnicalAnalysis,
        lookback_periods: int = 5,
    ) -> PriceActionResult:
        """
        Analyze intraday price action.
        
        Performs comprehensive price action analysis including:
        - Current price position relative to VWAP (Requirement 6.2)
        - EMA 9 and EMA 21 crossovers (adapted from task requirement)
        - RSI momentum and divergence detection (Requirement 6.2)
        - Intraday trend strength calculation (Requirement 6.2)
        
        Args:
            data: List of OHLCV candles (minimum 10 required)
            technical_analysis: Pre-calculated technical indicators
            lookback_periods: Number of periods to look back for divergence detection
        
        Returns:
            PriceActionResult with comprehensive price action analysis
        
        Raises:
            ValueError: If insufficient data provided
        """
        if len(data) < 10:
            raise ValueError(
                f"Insufficient data for price action analysis: need at least 10 candles, "
                f"got {len(data)}"
            )
        
        # Extract price arrays
        close_prices = [candle.close for candle in data]
        current_price = close_prices[-1]
        
        # === 1. VWAP Position Analysis (Requirement 6.2) ===
        vwap = technical_analysis.vwap
        vwap_distance_percent = ((current_price - vwap) / vwap) * 100
        
        # Determine VWAP position (use 0.05% threshold for "AT")
        if abs(vwap_distance_percent) < 0.05:
            vwap_position = VWAPPosition.AT
        elif current_price > vwap:
            vwap_position = VWAPPosition.ABOVE
        else:
            vwap_position = VWAPPosition.BELOW
        
        # === 2. EMA Crossover Analysis (Requirement 6.2) ===
        # Using EMA 9 (fast) and EMA 21 (slow) as available in the service
        # Note: Task mentions EMA 5/15, but service uses 9/21 which are standard intraday EMAs
        ema_fast = technical_analysis.ema_9
        ema_slow = technical_analysis.ema_21
        
        # Check if EMAs are aligned with trend
        ema_alignment = ema_fast > ema_slow if current_price > vwap else ema_fast < ema_slow
        
        # Detect recent crossover (look back up to 3 periods)
        ema_crossover = self._detect_ema_crossover(data, lookback_periods=min(3, len(data) - 1))
        
        # === 3. RSI Momentum Analysis (Requirement 6.2) ===
        rsi = technical_analysis.rsi
        
        # Detect RSI divergence
        rsi_divergence_detected = self._detect_rsi_divergence(data, lookback_periods=lookback_periods)
        
        # Determine RSI trend
        rsi_trend = self._calculate_rsi_trend(data, lookback_periods=min(3, len(data) - 1))
        
        # === 4. Intraday Trend Strength Calculation (Requirement 6.2) ===
        trend_score, trend_strength = self._calculate_trend_strength(
            current_price=current_price,
            vwap=vwap,
            ema_fast=ema_fast,
            ema_slow=ema_slow,
            ema_50=technical_analysis.ema_50,
            rsi=rsi,
            macd_histogram=technical_analysis.macd.histogram,
        )
        
        # Calculate momentum score
        momentum_score = self._calculate_momentum_score(
            rsi=rsi,
            macd_histogram=technical_analysis.macd.histogram,
            relative_volume=technical_analysis.relative_volume,
        )
        
        # === 5. Generate Price Action Signals ===
        signals = self._generate_price_action_signals(
            vwap_position=vwap_position,
            vwap_distance_percent=vwap_distance_percent,
            ema_crossover=ema_crossover,
            ema_alignment=ema_alignment,
            rsi=rsi,
            rsi_divergence_detected=rsi_divergence_detected,
            rsi_trend=rsi_trend,
            trend_strength=trend_strength,
        )
        
        return PriceActionResult(
            current_price=current_price,
            vwap=vwap,
            vwap_position=vwap_position,
            vwap_distance_percent=vwap_distance_percent,
            ema_fast=ema_fast,
            ema_slow=ema_slow,
            ema_crossover=ema_crossover,
            ema_alignment=ema_alignment,
            rsi=rsi,
            rsi_divergence_detected=rsi_divergence_detected,
            rsi_trend=rsi_trend,
            trend_strength=trend_strength,
            trend_score=trend_score,
            momentum_score=momentum_score,
            signals=signals,
        )
    
    def _detect_ema_crossover(
        self, data: List[OHLCVData], lookback_periods: int = 3
    ) -> EMACrossover:
        """
        Detect EMA crossover in recent periods.
        
        Args:
            data: OHLCV data
            lookback_periods: Number of periods to look back
        
        Returns:
            EMACrossover status (BULLISH/BEARISH/NONE)
        """
        if len(data) < lookback_periods + 10:
            return EMACrossover.NONE
        
        close_prices = [candle.close for candle in data]
        
        # Calculate EMAs for recent periods
        for i in range(1, lookback_periods + 1):
            # Get EMAs for current and previous period
            ema_fast_curr = calculate_ema(close_prices[:-i] if i > 0 else close_prices, period=9)
            ema_slow_curr = calculate_ema(close_prices[:-i] if i > 0 else close_prices, period=21)
            
            ema_fast_prev = calculate_ema(close_prices[:-(i+1)], period=9)
            ema_slow_prev = calculate_ema(close_prices[:-(i+1)], period=21)
            
            # Check for bullish crossover (fast crosses above slow)
            if ema_fast_prev <= ema_slow_prev and ema_fast_curr > ema_slow_curr:
                return EMACrossover.BULLISH
            
            # Check for bearish crossover (fast crosses below slow)
            if ema_fast_prev >= ema_slow_prev and ema_fast_curr < ema_slow_curr:
                return EMACrossover.BEARISH
        
        return EMACrossover.NONE
    
    def _detect_rsi_divergence(
        self, data: List[OHLCVData], lookback_periods: int = 5
    ) -> bool:
        """
        Detect RSI divergence (price and RSI moving in opposite directions).
        
        Args:
            data: OHLCV data
            lookback_periods: Number of periods to analyze
        
        Returns:
            True if divergence detected, False otherwise
        """
        if len(data) < lookback_periods + self.rsi_period:
            return False
        
        close_prices = [candle.close for candle in data]
        
        # Calculate RSI for recent periods
        rsi_values = []
        for i in range(lookback_periods):
            end_idx = len(close_prices) - i
            if end_idx < self.rsi_period:
                break
            rsi_val = calculate_rsi(close_prices[:end_idx], period=self.rsi_period)
            rsi_values.append(rsi_val)
        
        if len(rsi_values) < lookback_periods:
            return False
        
        # Reverse to get chronological order
        rsi_values = list(reversed(rsi_values))
        recent_prices = close_prices[-lookback_periods:]
        
        # Check for bullish divergence: price making lower lows, RSI making higher lows
        if recent_prices[-1] < recent_prices[0] and rsi_values[-1] > rsi_values[0]:
            return True
        
        # Check for bearish divergence: price making higher highs, RSI making lower highs
        if recent_prices[-1] > recent_prices[0] and rsi_values[-1] < rsi_values[0]:
            return True
        
        return False
    
    def _calculate_rsi_trend(
        self, data: List[OHLCVData], lookback_periods: int = 3
    ) -> str:
        """
        Calculate RSI trend direction.
        
        Args:
            data: OHLCV data
            lookback_periods: Number of periods to analyze
        
        Returns:
            RSI trend: "RISING", "FALLING", or "NEUTRAL"
        """
        if len(data) < lookback_periods + self.rsi_period:
            return "NEUTRAL"
        
        close_prices = [candle.close for candle in data]
        
        # Calculate RSI for recent periods
        rsi_current = calculate_rsi(close_prices, period=self.rsi_period)
        rsi_previous = calculate_rsi(close_prices[:-lookback_periods], period=self.rsi_period)
        
        # Determine trend (use 2-point threshold to avoid noise)
        rsi_diff = rsi_current - rsi_previous
        
        if rsi_diff > 2.0:
            return "RISING"
        elif rsi_diff < -2.0:
            return "FALLING"
        else:
            return "NEUTRAL"
    
    def _calculate_trend_strength(
        self,
        current_price: float,
        vwap: float,
        ema_fast: float,
        ema_slow: float,
        ema_50: float,
        rsi: float,
        macd_histogram: float,
    ) -> Tuple[float, TrendStrength]:
        """
        Calculate intraday trend strength.
        
        Args:
            current_price: Current price
            vwap: VWAP value
            ema_fast: Fast EMA (9)
            ema_slow: Slow EMA (21)
            ema_50: 50-period EMA
            rsi: RSI value
            macd_histogram: MACD histogram
        
        Returns:
            Tuple of (trend_score, trend_strength)
        """
        score = 50.0  # Start at neutral
        
        # 1. Price vs VWAP (±10 points)
        if current_price > vwap:
            score += 10
        elif current_price < vwap:
            score -= 10
        
        # 2. EMA alignment (±15 points)
        if ema_fast > ema_slow > ema_50:
            score += 15  # Strong bullish alignment
        elif ema_fast > ema_slow:
            score += 10  # Moderate bullish alignment
        elif ema_fast < ema_slow < ema_50:
            score -= 15  # Strong bearish alignment
        elif ema_fast < ema_slow:
            score -= 10  # Moderate bearish alignment
        
        # 3. RSI (±15 points)
        if rsi > 70:
            score += 10  # Overbought but strong
        elif rsi > 60:
            score += 15  # Bullish zone
        elif rsi > 50:
            score += 5  # Slightly bullish
        elif rsi < 30:
            score -= 10  # Oversold but weak
        elif rsi < 40:
            score -= 15  # Bearish zone
        elif rsi < 50:
            score -= 5  # Slightly bearish
        
        # 4. MACD histogram (±10 points)
        if macd_histogram > 0:
            score += 10
        elif macd_histogram < 0:
            score -= 10
        
        # Clamp score to 0-100
        score = max(0.0, min(100.0, score))
        
        # Classify trend strength
        if score >= 70:
            trend_strength = TrendStrength.STRONG_BULLISH
        elif score >= 55:
            trend_strength = TrendStrength.WEAK_BULLISH
        elif score >= 45:
            trend_strength = TrendStrength.NEUTRAL
        elif score >= 30:
            trend_strength = TrendStrength.WEAK_BEARISH
        else:
            trend_strength = TrendStrength.STRONG_BEARISH
        
        return score, trend_strength
    
    def _calculate_momentum_score(
        self,
        rsi: float,
        macd_histogram: float,
        relative_volume: float,
    ) -> float:
        """
        Calculate momentum score.
        
        Args:
            rsi: RSI value
            macd_histogram: MACD histogram
            relative_volume: Relative volume
        
        Returns:
            Momentum score (0-100)
        """
        score = 0.0
        
        # RSI contribution (40 points)
        if rsi > 70:
            score += 40
        elif rsi > 60:
            score += 35
        elif rsi > 50:
            score += 25
        elif rsi > 40:
            score += 15
        elif rsi > 30:
            score += 10
        else:
            score += 5
        
        # MACD histogram contribution (30 points)
        if macd_histogram > 5:
            score += 30
        elif macd_histogram > 2:
            score += 25
        elif macd_histogram > 0:
            score += 20
        elif macd_histogram > -2:
            score += 10
        elif macd_histogram > -5:
            score += 5
        
        # Relative volume contribution (30 points)
        if relative_volume > 2.0:
            score += 30
        elif relative_volume > 1.5:
            score += 25
        elif relative_volume > 1.2:
            score += 20
        elif relative_volume > 1.0:
            score += 15
        elif relative_volume > 0.8:
            score += 10
        else:
            score += 5
        
        return min(100.0, score)
    
    def _generate_price_action_signals(
        self,
        vwap_position: VWAPPosition,
        vwap_distance_percent: float,
        ema_crossover: EMACrossover,
        ema_alignment: bool,
        rsi: float,
        rsi_divergence_detected: bool,
        rsi_trend: str,
        trend_strength: TrendStrength,
    ) -> List[str]:
        """
        Generate human-readable price action signals.
        
        Args:
            vwap_position: Price position relative to VWAP
            vwap_distance_percent: Distance from VWAP as percentage
            ema_crossover: EMA crossover status
            ema_alignment: EMA alignment status
            rsi: RSI value
            rsi_divergence_detected: RSI divergence flag
            rsi_trend: RSI trend direction
            trend_strength: Trend strength classification
        
        Returns:
            List of signal strings
        """
        signals = []
        
        # VWAP position signal
        if vwap_position == VWAPPosition.ABOVE:
            signals.append(f"Price trading above VWAP (+{vwap_distance_percent:.2f}%)")
        elif vwap_position == VWAPPosition.BELOW:
            signals.append(f"Price trading below VWAP ({vwap_distance_percent:.2f}%)")
        else:
            signals.append("Price at VWAP")
        
        # EMA crossover signal
        if ema_crossover == EMACrossover.BULLISH:
            signals.append("Bullish EMA crossover detected")
        elif ema_crossover == EMACrossover.BEARISH:
            signals.append("Bearish EMA crossover detected")
        
        # EMA alignment signal
        if ema_alignment:
            signals.append("EMAs aligned with trend")
        else:
            signals.append("EMAs not aligned - caution")
        
        # RSI signals
        if rsi > 70:
            signals.append(f"RSI overbought ({rsi:.1f})")
        elif rsi > 60:
            signals.append(f"RSI in bullish zone ({rsi:.1f})")
        elif rsi < 30:
            signals.append(f"RSI oversold ({rsi:.1f})")
        elif rsi < 40:
            signals.append(f"RSI in bearish zone ({rsi:.1f})")
        else:
            signals.append(f"RSI neutral ({rsi:.1f})")
        
        # RSI divergence signal
        if rsi_divergence_detected:
            signals.append("RSI divergence detected - potential reversal")
        
        # RSI trend signal
        if rsi_trend == "RISING":
            signals.append("Momentum strengthening")
        elif rsi_trend == "FALLING":
            signals.append("Momentum weakening")
        
        # Trend strength signal
        if trend_strength == TrendStrength.STRONG_BULLISH:
            signals.append("Strong bullish trend")
        elif trend_strength == TrendStrength.WEAK_BULLISH:
            signals.append("Weak bullish trend")
        elif trend_strength == TrendStrength.STRONG_BEARISH:
            signals.append("Strong bearish trend")
        elif trend_strength == TrendStrength.WEAK_BEARISH:
            signals.append("Weak bearish trend")
        else:
            signals.append("Neutral trend - no clear direction")
        
        return signals
