"""
Trendline validation module for the Quant Engine.

This module implements trendline validation logic to ensure quality trendlines
are returned to users, including strength scoring, angle classification, and
quality filtering.
"""

from typing import List, Optional
from models import OHLCVData, TrendlineResult


class TrendlineAngleClassification:
    """Enum-like class for trendline angle classifications."""

    STEEP = "STEEP"
    MODERATE = "MODERATE"
    FLAT = "FLAT"


class TrendlineValidator:
    """
    Validates trendlines based on quality metrics.

    This validator ensures that only high-quality trendlines are used for
    trading decisions by filtering based on:
    - Minimum touch points (at least 2 swing points)
    - R² goodness of fit (>= 0.7 for strong trendlines)
    - Strength score (>= 40 for reliable trendlines)
    - Angle classification (steep vs flat)
    """

    def __init__(
        self,
        min_touches: int = 2,
        min_r_squared: float = 0.7,
        min_strength: float = 40.0,
        steep_angle_threshold: float = 3.0,
        flat_angle_threshold: float = 0.5,
    ):
        """
        Initialize the trendline validator.

        Args:
            min_touches: Minimum number of touch points required (default: 2)
            min_r_squared: Minimum R² value for valid trendlines (default: 0.7)
            min_strength: Minimum strength score for valid trendlines (default: 40.0)
            steep_angle_threshold: Slope threshold for steep classification (default: 3.0)
            flat_angle_threshold: Slope threshold for flat classification (default: 0.5)
        """
        if min_touches < 2:
            raise ValueError("min_touches must be at least 2")
        if not 0 <= min_r_squared <= 1:
            raise ValueError("min_r_squared must be between 0 and 1")
        if not 0 <= min_strength <= 100:
            raise ValueError("min_strength must be between 0 and 100")
        if steep_angle_threshold <= flat_angle_threshold:
            raise ValueError("steep_angle_threshold must be > flat_angle_threshold")

        self.min_touches = min_touches
        self.min_r_squared = min_r_squared
        self.min_strength = min_strength
        self.steep_angle_threshold = steep_angle_threshold
        self.flat_angle_threshold = flat_angle_threshold

    def validate_minimum_touches(
        self, trendline: TrendlineResult, data: List[OHLCVData], tolerance: float = 0.01
    ) -> bool:
        """
        Validate that a trendline has minimum touch points.

        A "touch" is when price comes within a tolerance percentage of the
        trendline value.

        Args:
            trendline: The trendline to validate
            data: Market data to check touches against
            tolerance: Price tolerance as percentage (default: 0.01 = 1%)

        Returns:
            True if trendline has at least min_touches, False otherwise
        """
        touches = self._count_touches(trendline, data, tolerance)
        return touches >= self.min_touches

    def _count_touches(
        self, trendline: TrendlineResult, data: List[OHLCVData], tolerance: float = 0.01
    ) -> int:
        """
        Count how many times price touches or crosses a trendline.

        Args:
            trendline: The trendline to check
            data: Market data to check against
            tolerance: Price tolerance as percentage (default: 0.01 = 1%)

        Returns:
            Number of touches detected
        """
        touches = 0

        for i, candle in enumerate(data):
            expected_price = trendline.slope * i + trendline.intercept
            threshold = abs(expected_price * tolerance)

            # Check if low or high touches the trendline
            if (
                abs(candle.low - expected_price) <= threshold
                or abs(candle.high - expected_price) <= threshold
            ):
                touches += 1

        return touches

    def calculate_strength_score(
        self, trendline: TrendlineResult, data: List[OHLCVData], tolerance: float = 0.01
    ) -> float:
        """
        Calculate trendline strength score (0-100) based on R² and touch count.

        The strength score is a weighted combination of:
        - R² value (goodness of fit): 70% weight
        - Touch count (normalized): 30% weight

        Args:
            trendline: The trendline to score
            data: Market data to check touches against
            tolerance: Price tolerance for touch detection (default: 0.01 = 1%)

        Returns:
            Strength score between 0 and 100
        """
        # R² component (0-100, weighted 70%)
        r_squared_score = trendline.r_squared * 70

        # Touch count component (0-100, weighted 30%)
        touches = self._count_touches(trendline, data, tolerance)
        # Normalize touch count (cap at 10 touches for max score)
        normalized_touches = min(touches / 10.0, 1.0)
        touch_score = normalized_touches * 30

        # Combined strength score
        strength = r_squared_score + touch_score

        # Ensure score is in valid range [0, 100]
        return max(0.0, min(100.0, strength))

    def detect_angle_classification(
        self, trendline: TrendlineResult, data: List[OHLCVData]
    ) -> str:
        """
        Detect trendline angle classification (steep vs moderate vs flat).

        Classification is based on the absolute value of the slope relative
        to the average price:
        - STEEP: |slope| >= steep_angle_threshold
        - FLAT: |slope| <= flat_angle_threshold
        - MODERATE: otherwise

        Args:
            trendline: The trendline to classify
            data: Market data for context (to calculate average price)

        Returns:
            Angle classification: "STEEP", "MODERATE", or "FLAT"
        """
        if not data:
            raise ValueError("data cannot be empty")

        # Calculate average price for context
        avg_price = sum(candle.close for candle in data) / len(data)

        # Normalize slope relative to average price to get percentage change per period
        if avg_price == 0:
            normalized_slope = 0
        else:
            normalized_slope = abs(trendline.slope / avg_price * 100)

        # Classify based on normalized slope
        if normalized_slope >= self.steep_angle_threshold:
            return TrendlineAngleClassification.STEEP
        elif normalized_slope <= self.flat_angle_threshold:
            return TrendlineAngleClassification.FLAT
        else:
            return TrendlineAngleClassification.MODERATE

    def filter_weak_trendlines(
        self,
        trendlines: List[TrendlineResult],
        data: List[OHLCVData],
        tolerance: float = 0.01,
    ) -> List[TrendlineResult]:
        """
        Filter out weak trendlines based on R² and strength score.

        A trendline is considered weak if:
        - R² < min_r_squared (default: 0.7), OR
        - Strength score < min_strength (default: 40)

        Results are sorted by strength score (highest first).

        Args:
            trendlines: List of trendlines to filter
            data: Market data for strength calculation
            tolerance: Price tolerance for touch detection (default: 0.01 = 1%)

        Returns:
            List of strong trendlines that pass validation, sorted by strength
        """
        strong_trendlines = []

        for trendline in trendlines:
            # Check R² threshold
            if trendline.r_squared < self.min_r_squared:
                continue

            # Check strength score threshold
            strength = self.calculate_strength_score(trendline, data, tolerance)
            if strength < self.min_strength:
                continue

            # Check minimum touches
            if not self.validate_minimum_touches(trendline, data, tolerance):
                continue

            strong_trendlines.append((trendline, strength))

        # Sort by strength (highest first)
        strong_trendlines.sort(key=lambda x: x[1], reverse=True)

        # Return just the trendlines (without strength)
        return [t[0] for t in strong_trendlines]

    def validate_and_score_trendline(
        self, trendline: TrendlineResult, data: List[OHLCVData], tolerance: float = 0.01
    ) -> Optional[dict]:
        """
        Validate a trendline and return its validation metrics.

        This is a comprehensive validation that returns all metrics:
        - is_valid: Whether trendline passes all validation criteria
        - strength: Strength score (0-100)
        - touches: Number of touch points
        - angle: Angle classification (STEEP, MODERATE, FLAT)

        Args:
            trendline: The trendline to validate
            data: Market data for validation
            tolerance: Price tolerance for touch detection (default: 0.01 = 1%)

        Returns:
            Dictionary with validation metrics, or None if invalid
        """
        # Calculate all metrics
        strength = self.calculate_strength_score(trendline, data, tolerance)
        touches = self._count_touches(trendline, data, tolerance)
        angle = self.detect_angle_classification(trendline, data)

        # Determine if valid
        is_valid = (
            trendline.r_squared >= self.min_r_squared
            and strength >= self.min_strength
            and touches >= self.min_touches
        )

        return {
            "is_valid": is_valid,
            "strength": strength,
            "touches": touches,
            "angle": angle,
            "r_squared": trendline.r_squared,
            "slope": trendline.slope,
        }
