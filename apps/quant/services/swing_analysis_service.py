"""
Swing Analysis Service for comprehensive technical factor analysis.

This service orchestrates all technical factor calculations for swing trading analysis.
It integrates existing calculators: RSI, ADX, ATR, MACD, EMA, VWAP, volume analysis,
52-week high/low analysis, support/resistance level detection, and trendline analysis.

Requirements: 5.2, 3.1, 3.2
"""

from typing import List, Dict, Optional
from pydantic import BaseModel, Field
from models.market_data import (
    OHLCVData,
    IndicatorResult,
    MACDValues,
    BollingerBands,
    SupportResistanceLevel,
    TrendlineResult,
)
from calculators.rsi import calculate_rsi
from calculators.adx import calculate_adx
from calculators.atr import calculate_atr
from calculators.macd import calculate_macd
from calculators.moving_averages import (
    calculate_ema,
    calculate_sma,
    calculate_multiple_ema,
)
from calculators.vwap import calculate_vwap
from calculators.volume_analysis import (
    calculate_volume_ma,
    calculate_relative_volume,
)
from calculators.price_range import calculate_price_range_analysis
from calculators.bollinger import calculate_bollinger_bands
from services.trendline_service import TrendlineService


class SwingAnalysisResult(BaseModel):
    """
    Complete swing trading technical analysis result.

    This model combines all technical factors required for swing trading analysis:
    - Technical indicators (RSI, ADX, ATR, MACD, EMAs, VWAP, Bollinger Bands)
    - Volume analysis (volume MA, relative volume)
    - Price range analysis (52-week high/low, momentum)
    - Support/resistance levels
    - Trendline analysis (from TrendlineService)

    Attributes:
        symbol: Trading symbol
        timeframe: Timeframe of analysis
        indicators: All technical indicator values
        volume_analysis: Volume metrics
        price_range_analysis: 52-week high/low and momentum
        support_resistance: Detected support and resistance levels
        trendline_analysis: Comprehensive trendline analysis including breakouts
    """

    symbol: str = Field(..., description="Trading symbol")
    timeframe: str = Field(..., description="Timeframe of analysis")
    indicators: IndicatorResult = Field(..., description="Technical indicators")
    volume_analysis: Dict = Field(
        ...,
        description="Volume analysis metrics (volume_ma, relative_volume, volume_trend)",
    )
    price_range_analysis: Dict[str, float] = Field(
        ..., description="52-week high/low, distances, momentum"
    )
    support_resistance: List[SupportResistanceLevel] = Field(
        default_factory=list, description="Support and resistance levels"
    )
    trendline_analysis: Optional[Dict] = Field(
        None, description="Comprehensive trendline analysis from TrendlineService"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "symbol": "RELIANCE",
                    "timeframe": "1d",
                    "indicators": {
                        "rsi": 58.5,
                        "macd": {"value": 12.3, "signal": 10.1, "histogram": 2.2},
                        "sma_20": 2455.0,
                        "sma_50": 2450.0,
                        "sma_200": 2380.0,
                        "ema_5": 2462.5,
                        "ema_15": 2460.0,
                        "ema_20": 2458.0,
                        "ema_50": 2452.0,
                        "ema_200": 2385.0,
                        "bollinger_bands": {
                            "upper": 2500.0,
                            "middle": 2455.0,
                            "lower": 2410.0,
                        },
                        "adx": 32.4,
                        "atr": 45.2,
                        "vwap": 2455.0,
                        "volume_ma": 1200000.0,
                        "relative_volume": 1.35,
                        "week_52_high": 2600.0,
                        "week_52_low": 2200.0,
                        "momentum": 12.5,
                    },
                    "volume_analysis": {
                        "volume_ma": 1200000.0,
                        "relative_volume": 1.35,
                        "volume_trend": "INCREASING",
                    },
                    "price_range_analysis": {
                        "high_52w": 2600.0,
                        "low_52w": 2200.0,
                        "current_price": 2460.0,
                        "distance_from_high_pct": -5.4,
                        "distance_from_low_pct": 11.8,
                        "position_in_range_pct": 65.0,
                        "momentum": 12.5,
                    },
                    "support_resistance": [
                        {"level": 2400.0, "strength": 0.85, "touches": 5},
                        {"level": 2500.0, "strength": 0.72, "touches": 3},
                    ],
                    "trendline_analysis": {
                        "support_trendline": {
                            "slope": 2.5,
                            "intercept": 2350.0,
                            "r_squared": 0.89,
                            "start_point": [0, 2350.0],
                            "end_point": [30, 2425.0],
                        },
                        "resistance_trendline": {
                            "slope": 1.8,
                            "intercept": 2400.0,
                            "r_squared": 0.85,
                            "start_point": [0, 2400.0],
                            "end_point": [30, 2454.0],
                        },
                        "breakout": {
                            "breakout_type": "RESISTANCE_BREAKOUT",
                            "confirmed": True,
                            "volume_ratio": 1.5,
                        },
                    },
                }
            ]
        }
    }


class SwingAnalysisService:
    """
    Service for comprehensive swing trading technical factor analysis.

    This service orchestrates all technical factor calculations required for
    swing trading analysis. It integrates existing calculators and services:

    Indicators:
    - RSI (Relative Strength Index)
    - ADX (Average Directional Index) - trend strength
    - ATR (Average True Range) - volatility
    - MACD (Moving Average Convergence Divergence)
    - EMAs (5, 15, 20, 50, 200)
    - SMAs (20, 50, 200)
    - VWAP (Volume Weighted Average Price)
    - Bollinger Bands

    Volume Analysis:
    - Volume Moving Average (20-period)
    - Relative Volume (current vs average)
    - Volume trend identification

    Price Range Analysis:
    - 52-week high and low
    - Distance from extremes (percentage)
    - Position within range
    - Momentum (rate of change)

    Pattern Analysis:
    - Support and resistance levels
    - Trendlines (support and resistance)
    - Breakout detection
    """

    def __init__(
        self,
        rsi_period: int = 14,
        adx_period: int = 14,
        atr_period: int = 14,
        macd_fast: int = 12,
        macd_slow: int = 26,
        macd_signal: int = 9,
        volume_period: int = 20,
        momentum_period: int = 10,
        lookback_days: int = 365,
        trendline_lookback: int = 3,
    ):
        """
        Initialize the swing analysis service.

        Args:
            rsi_period: RSI calculation period (default: 14)
            adx_period: ADX calculation period (default: 14)
            atr_period: ATR calculation period (default: 14)
            macd_fast: MACD fast EMA period (default: 12)
            macd_slow: MACD slow EMA period (default: 26)
            macd_signal: MACD signal line period (default: 9)
            volume_period: Volume MA period (default: 20)
            momentum_period: Momentum calculation period (default: 10)
            lookback_days: Days for 52-week high/low (default: 365)
            trendline_lookback: Lookback period for trendline detection (default: 3)

        Raises:
            ValueError: If parameters are invalid
        """
        # Validate parameters
        if rsi_period <= 0:
            raise ValueError("rsi_period must be positive")
        if adx_period <= 0:
            raise ValueError("adx_period must be positive")
        if atr_period <= 0:
            raise ValueError("atr_period must be positive")
        if macd_fast <= 0 or macd_slow <= 0 or macd_signal <= 0:
            raise ValueError("MACD periods must be positive")
        if macd_fast >= macd_slow:
            raise ValueError("MACD fast period must be less than slow period")
        if volume_period <= 0:
            raise ValueError("volume_period must be positive")
        if momentum_period <= 0:
            raise ValueError("momentum_period must be positive")
        if lookback_days <= 0:
            raise ValueError("lookback_days must be positive")
        if trendline_lookback <= 0:
            raise ValueError("trendline_lookback must be positive")

        self.rsi_period = rsi_period
        self.adx_period = adx_period
        self.atr_period = atr_period
        self.macd_fast = macd_fast
        self.macd_slow = macd_slow
        self.macd_signal = macd_signal
        self.volume_period = volume_period
        self.momentum_period = momentum_period
        self.lookback_days = lookback_days
        self.trendline_lookback = trendline_lookback

        # Initialize trendline service
        self.trendline_service = TrendlineService(
            lookback_period=trendline_lookback,
            min_trendline_points=2,
            volume_period=volume_period,
            volume_threshold=1.0,
        )

    def analyze(
        self,
        symbol: str,
        timeframe: str,
        data: List[OHLCVData],
        include_trendlines: bool = True,
    ) -> SwingAnalysisResult:
        """
        Perform comprehensive swing trading technical factor analysis.

        This is the main entry point for swing analysis. It orchestrates:
        1. Technical indicator calculations (RSI, ADX, ATR, MACD, EMAs, VWAP, Bollinger Bands)
        2. Volume analysis (volume MA, relative volume)
        3. Price range analysis (52-week high/low, momentum)
        4. Support/resistance level detection (delegated to trendline service)
        5. Trendline analysis with breakout detection (optional)

        Args:
            symbol: Trading symbol
            timeframe: Timeframe of analysis (e.g., '1d', '1h')
            data: List of OHLCV data points (must be sorted by timestamp)
            include_trendlines: Whether to include trendline analysis (default: True)

        Returns:
            SwingAnalysisResult: Complete swing trading analysis

        Raises:
            ValueError: If data is empty or insufficient for analysis
        """
        if not data:
            raise ValueError("data cannot be empty")

        # Validate minimum data requirements
        min_required = max(
            self.rsi_period + 1,
            self.atr_period + 1,
            2 * self.adx_period + 1,
            self.macd_slow + self.macd_signal,
            200,  # For 200-period moving averages
            self.volume_period,
            self.momentum_period + 1,
        )

        if len(data) < min_required:
            raise ValueError(
                f"Insufficient data: need at least {min_required} data points, "
                f"got {len(data)}"
            )

        # Extract price arrays from OHLCV data
        closes = [d.close for d in data]
        highs = [d.high for d in data]
        lows = [d.low for d in data]
        volumes = [d.volume for d in data]
        timestamps = [d.timestamp for d in data]

        # 1. Calculate technical indicators
        indicators = self._calculate_indicators(closes, highs, lows, volumes)

        # 2. Calculate volume analysis
        volume_analysis = self._calculate_volume_analysis(volumes)

        # 3. Calculate price range analysis
        price_range_analysis = self._calculate_price_range_analysis(closes, timestamps)

        # 4. Perform trendline analysis (includes support/resistance)
        trendline_analysis = None
        support_resistance = []

        if include_trendlines:
            try:
                trendline_result = self.trendline_service.analyze_trendlines(data)

                # Convert trendline result to dict
                trendline_analysis = {
                    "support_trendline": (
                        trendline_result.support_trendline.model_dump()
                        if trendline_result.support_trendline
                        else None
                    ),
                    "resistance_trendline": (
                        trendline_result.resistance_trendline.model_dump()
                        if trendline_result.resistance_trendline
                        else None
                    ),
                    "breakout": trendline_result.breakout.model_dump(),
                    "swing_points": [
                        sp.model_dump() for sp in trendline_result.swing_points
                    ],
                }

                # Extract support/resistance levels from swing points
                # (This is a simplified extraction; you could use a more sophisticated algorithm)
                support_resistance = self._extract_support_resistance_from_swings(
                    trendline_result.swing_points
                )

            except Exception as e:
                # If trendline analysis fails, log and continue without it
                # (In production, you'd want proper logging here)
                trendline_analysis = {"error": str(e)}

        # 5. Combine all results
        return SwingAnalysisResult(
            symbol=symbol,
            timeframe=timeframe,
            indicators=indicators,
            volume_analysis=volume_analysis,
            price_range_analysis=price_range_analysis,
            support_resistance=support_resistance,
            trendline_analysis=trendline_analysis,
        )

    def _calculate_indicators(
        self,
        closes: List[float],
        highs: List[float],
        lows: List[float],
        volumes: List[float],
    ) -> IndicatorResult:
        """
        Calculate all technical indicators.

        Args:
            closes: List of closing prices
            highs: List of high prices
            lows: List of low prices
            volumes: List of volumes

        Returns:
            IndicatorResult: All technical indicators
        """
        # Calculate RSI
        rsi = calculate_rsi(closes, self.rsi_period)

        # Calculate ADX
        adx_result = calculate_adx(highs, lows, closes, self.adx_period)
        adx = adx_result["adx"]

        # Calculate ATR
        atr = calculate_atr(highs, lows, closes, self.atr_period)

        # Calculate MACD
        macd_result = calculate_macd(
            closes, self.macd_fast, self.macd_slow, self.macd_signal
        )
        macd = MACDValues(
            value=macd_result["value"],
            signal=macd_result["signal"],
            histogram=macd_result["histogram"],
        )

        # Calculate EMAs
        ema_5 = calculate_ema(closes, 5)
        ema_15 = calculate_ema(closes, 15)
        ema_20 = calculate_ema(closes, 20)
        ema_50 = calculate_ema(closes, 50)
        ema_200 = calculate_ema(closes, 200)

        # Calculate SMAs
        sma_20 = calculate_sma(closes, 20)
        sma_50 = calculate_sma(closes, 50)
        sma_200 = calculate_sma(closes, 200)

        # Calculate VWAP
        vwap = calculate_vwap(highs, lows, closes, volumes)

        # Calculate Bollinger Bands
        bb_upper, bb_middle, bb_lower = calculate_bollinger_bands(
            closes, period=20, num_std=2
        )

        # Handle edge case where price is constant (std dev = 0)
        # In this case, all bands will be equal, but Pydantic validation expects upper > middle > lower
        # We'll add a small epsilon to maintain the ordering
        if bb_upper == bb_middle == bb_lower:
            epsilon = bb_middle * 0.0001  # 0.01% of price
            bb_upper = bb_middle + epsilon
            bb_lower = bb_middle - epsilon

        bollinger_bands = BollingerBands(
            upper=bb_upper,
            middle=bb_middle,
            lower=bb_lower,
        )

        # Calculate volume indicators
        volume_ma = calculate_volume_ma(volumes, self.volume_period)
        relative_volume = calculate_relative_volume(
            volumes[-1], volumes, self.volume_period
        )

        # Calculate 52-week high/low and momentum
        price_range = calculate_price_range_analysis(
            closes,
            lookback_days=self.lookback_days,
            momentum_period=self.momentum_period,
        )

        return IndicatorResult(
            rsi=rsi,
            macd=macd,
            sma_20=sma_20,
            sma_50=sma_50,
            sma_200=sma_200,
            ema_5=ema_5,
            ema_15=ema_15,
            ema_20=ema_20,
            ema_50=ema_50,
            ema_200=ema_200,
            bollinger_bands=bollinger_bands,
            adx=adx,
            atr=atr,
            vwap=vwap,
            volume_ma=volume_ma,
            relative_volume=relative_volume,
            week_52_high=price_range["high_52w"],
            week_52_low=price_range["low_52w"],
            momentum=price_range["momentum"],
        )

    def _calculate_volume_analysis(self, volumes: List[float]) -> Dict[str, float]:
        """
        Calculate volume analysis metrics.

        Args:
            volumes: List of volume values

        Returns:
            Dictionary with volume analysis metrics
        """
        volume_ma = calculate_volume_ma(volumes, self.volume_period)
        relative_volume = calculate_relative_volume(
            volumes[-1], volumes, self.volume_period
        )

        # Determine volume trend
        # Calculate volume MA for recent period (last 5 bars) vs older period
        if len(volumes) >= self.volume_period + 5:
            recent_volume_ma = calculate_volume_ma(volumes[-5:], 5)
            # Calculate the volume MA from an older window (not including last 5 bars)
            older_volumes = volumes[-(self.volume_period + 5) : -5]
            if len(older_volumes) >= self.volume_period:
                older_volume_ma = calculate_volume_ma(older_volumes, self.volume_period)
            else:
                # If not enough data, use what we have
                older_volume_ma = calculate_volume_ma(older_volumes, len(older_volumes))

            if recent_volume_ma > older_volume_ma * 1.1:
                volume_trend = "INCREASING"
            elif recent_volume_ma < older_volume_ma * 0.9:
                volume_trend = "DECREASING"
            else:
                volume_trend = "STABLE"
        else:
            volume_trend = "UNKNOWN"

        return {
            "volume_ma": volume_ma,
            "relative_volume": relative_volume,
            "volume_trend": volume_trend,
        }

    def _calculate_price_range_analysis(
        self, closes: List[float], timestamps: List
    ) -> Dict[str, float]:
        """
        Calculate price range analysis (52-week high/low, momentum).

        Args:
            closes: List of closing prices
            timestamps: List of timestamps

        Returns:
            Dictionary with price range metrics
        """
        return calculate_price_range_analysis(
            closes,
            timestamps=timestamps,
            lookback_days=self.lookback_days,
            momentum_period=self.momentum_period,
        )

    def _extract_support_resistance_from_swings(
        self, swing_points: List
    ) -> List[SupportResistanceLevel]:
        """
        Extract support and resistance levels from swing points.

        This is a simplified algorithm that clusters swing points to identify
        significant support and resistance levels.

        Args:
            swing_points: List of swing points from trendline analysis

        Returns:
            List of support and resistance levels
        """
        if not swing_points:
            return []

        # Group swing points by price (with tolerance)
        price_clusters = {}
        tolerance = 0.02  # 2% price tolerance for clustering

        for swing in swing_points:
            price = swing.price
            found_cluster = False

            # Check if this price belongs to an existing cluster
            for cluster_price in list(price_clusters.keys()):
                if abs(price - cluster_price) / cluster_price <= tolerance:
                    price_clusters[cluster_price].append(swing)
                    found_cluster = True
                    break

            # Create new cluster if not found
            if not found_cluster:
                price_clusters[price] = [swing]

        # Convert clusters to support/resistance levels
        levels = []
        for cluster_price, swings in price_clusters.items():
            # Calculate average price for this cluster
            avg_price = sum(s.price for s in swings) / len(swings)

            # Strength based on number of touches
            touches = len(swings)
            strength = min(1.0, touches / 5.0)  # Max strength at 5+ touches

            levels.append(
                SupportResistanceLevel(
                    level=avg_price,
                    strength=strength,
                    touches=touches,
                )
            )

        # Sort by strength (strongest first)
        levels.sort(key=lambda x: x.strength, reverse=True)

        return levels
