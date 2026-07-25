"""
Trendline service for comprehensive trendline analysis.

This service orchestrates swing detection, trendline calculation, and breakout
detection to provide a unified trendline analysis result. It combines results
from SwingDetector, TrendlineCalculator, and BreakoutDetector components.

Requirements: 3.1
"""

from typing import List, Optional
from pydantic import BaseModel, Field
from models import OHLCVData, SwingPoint, TrendlineResult
from calculators.swing_detector import SwingDetector
from calculators.trendline_calculator import TrendlineCalculator
from calculators.breakout_detector import (
    detect_breakout,
    BreakoutType,
    BreakoutResult,
)


class TrendlineServiceResult(BaseModel):
    """
    Complete trendline analysis result.

    This model combines swing points, support/resistance trendlines,
    and breakout detection into a unified result.

    Attributes:
        swing_points: All detected swing points (highs and lows)
        support_trendline: Support trendline (fitted to swing lows)
        resistance_trendline: Resistance trendline (fitted to swing highs)
        breakout: Breakout detection result
    """

    swing_points: List[SwingPoint] = Field(
        default_factory=list, description="Detected swing points (highs and lows)"
    )
    support_trendline: Optional[TrendlineResult] = Field(
        None,
        description="Support trendline (fitted to swing lows), None if insufficient points",
    )
    resistance_trendline: Optional[TrendlineResult] = Field(
        None,
        description="Resistance trendline (fitted to swing highs), None if insufficient points",
    )
    breakout: BreakoutResult = Field(
        ...,
        description="Breakout detection result (resistance breakout or support breakdown)",
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "swing_points": [
                        {
                            "timestamp": "2024-01-15T09:15:00Z",
                            "price": 2470.0,
                            "type": "HIGH",
                            "index": 5,
                        },
                        {
                            "timestamp": "2024-01-16T14:30:00Z",
                            "price": 2445.0,
                            "type": "LOW",
                            "index": 12,
                        },
                    ],
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
                        "breakout_index": 25,
                        "breakout_price": 2465.0,
                        "trendline_price": 2455.0,
                    },
                }
            ]
        }
    }


class TrendlineService:
    """
    Service for comprehensive trendline analysis.

    This service orchestrates the complete trendline analysis workflow:
    1. Detect swing points using SwingDetector
    2. Calculate support and resistance trendlines using TrendlineCalculator
    3. Detect breakouts using BreakoutDetector
    4. Combine all results into a unified TrendlineServiceResult

    The service provides configurable parameters for swing detection,
    trendline calculation, and breakout detection.
    """

    def __init__(
        self,
        lookback_period: int = 3,
        min_trendline_points: int = 2,
        volume_period: int = 20,
        volume_threshold: float = 1.0,
    ):
        """
        Initialize the trendline service.

        Args:
            lookback_period: Lookback period for swing detection (default: 3)
            min_trendline_points: Minimum swing points required for trendline (default: 2)
            volume_period: Period for volume average calculation in breakout detection (default: 20)
            volume_threshold: Minimum volume ratio for breakout confirmation (default: 1.0)

        Raises:
            ValueError: If parameters are invalid
        """
        if lookback_period < 1:
            raise ValueError("lookback_period must be at least 1")
        if min_trendline_points < 2:
            raise ValueError("min_trendline_points must be at least 2")
        if volume_period < 1:
            raise ValueError("volume_period must be at least 1")
        if volume_threshold <= 0:
            raise ValueError("volume_threshold must be positive")

        self.lookback_period = lookback_period
        self.min_trendline_points = min_trendline_points
        self.volume_period = volume_period
        self.volume_threshold = volume_threshold

        # Initialize component calculators
        self.swing_detector = SwingDetector(lookback_period=lookback_period)
        self.trendline_calculator = TrendlineCalculator(lookback_period=lookback_period)

    def analyze_trendlines(self, data: List[OHLCVData]) -> TrendlineServiceResult:
        """
        Perform complete trendline analysis on market data.

        This is the main entry point for the trendline service. It orchestrates:
        1. Swing point detection
        2. Support and resistance trendline calculation
        3. Breakout detection

        Args:
            data: List of OHLCV data points (must be sorted by timestamp)

        Returns:
            TrendlineServiceResult: Complete analysis with swing points, trendlines, and breakouts

        Raises:
            ValueError: If data is empty or insufficient for analysis
        """
        if not data:
            raise ValueError("data cannot be empty")

        # Step 1: Detect swing points
        swing_points = self.swing_detector.detect_swing_points(data)

        # Step 2: Calculate trendlines
        support_trendline, resistance_trendline = (
            self.trendline_calculator.calculate_both_trendlines(
                data, self.min_trendline_points
            )
        )

        # Step 3: Detect breakouts
        breakout = self._detect_breakout(data, support_trendline, resistance_trendline)

        # Step 4: Combine results
        return TrendlineServiceResult(
            swing_points=swing_points,
            support_trendline=support_trendline,
            resistance_trendline=resistance_trendline,
            breakout=breakout,
        )

    def _detect_breakout(
        self,
        data: List[OHLCVData],
        support_trendline: Optional[TrendlineResult],
        resistance_trendline: Optional[TrendlineResult],
    ) -> BreakoutResult:
        """
        Detect breakouts using available trendlines.

        If both trendlines are available, checks for both resistance breakout
        and support breakdown. If only one is available, checks only that one.
        If neither is available, returns a NO_BREAKOUT result.

        Args:
            data: OHLCV data for breakout detection
            support_trendline: Optional support trendline
            resistance_trendline: Optional resistance trendline

        Returns:
            BreakoutResult: Breakout detection result
        """
        # If no trendlines available, return NO_BREAKOUT
        if support_trendline is None and resistance_trendline is None:
            return BreakoutResult(
                breakout_type=BreakoutType.NO_BREAKOUT,
                confirmed=False,
                volume_ratio=0.0,
                breakout_index=None,
                breakout_price=None,
                trendline_price=None,
            )

        # Check if we have enough data for volume analysis
        if len(data) < self.volume_period:
            # Not enough data for volume analysis, return NO_BREAKOUT
            return BreakoutResult(
                breakout_type=BreakoutType.NO_BREAKOUT,
                confirmed=False,
                volume_ratio=0.0,
                breakout_index=None,
                breakout_price=None,
                trendline_price=None,
            )

        # Use the detect_breakout function from breakout_detector
        return detect_breakout(
            data=data,
            support_trendline=support_trendline,
            resistance_trendline=resistance_trendline,
            volume_period=self.volume_period,
            volume_threshold=self.volume_threshold,
        )
