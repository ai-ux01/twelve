"""Swing point detection calculator for the Quant Engine."""

from typing import List, Tuple
from models import OHLCVData, SwingPoint, SwingType


class SwingDetector:
    """Swing point detector."""

    def __init__(self, lookback_period: int = 3):
        if lookback_period < 1:
            raise ValueError("lookback_period must be at least 1")
        self.lookback_period = lookback_period

    def detect_swing_points(self, data: List[OHLCVData]) -> List[SwingPoint]:
        """Detect swing highs and swing lows."""
        if not data:
            raise ValueError("data cannot be empty")

        if len(data) < 2 * self.lookback_period + 1:
            raise ValueError(
                f"Insufficient data points: {len(data)} < {2 * self.lookback_period + 1}"
            )

        swing_points = []

        for i in range(self.lookback_period, len(data) - self.lookback_period):
            current_high = data[i].high
            current_low = data[i].low

            is_swing_high = all(
                current_high > data[j].high
                for j in range(i - self.lookback_period, i + self.lookback_period + 1)
                if j != i
            )

            if is_swing_high:
                swing_points.append(
                    SwingPoint(
                        timestamp=data[i].timestamp,
                        price=current_high,
                        type=SwingType.HIGH,
                        index=i,
                    )
                )

            is_swing_low = all(
                current_low < data[j].low
                for j in range(i - self.lookback_period, i + self.lookback_period + 1)
                if j != i
            )

            if is_swing_low:
                swing_points.append(
                    SwingPoint(
                        timestamp=data[i].timestamp,
                        price=current_low,
                        type=SwingType.LOW,
                        index=i,
                    )
                )

        swing_points.sort(key=lambda sp: sp.index)
        return swing_points

    def detect_higher_highs_higher_lows(
        self, data: List[OHLCVData], min_swings: int = 2
    ) -> Tuple[bool, float, List[SwingPoint]]:
        """Detect uptrend pattern."""
        if not data:
            raise ValueError("data cannot be empty")
        if min_swings < 2:
            raise ValueError("min_swings must be at least 2")

        swing_points = self.detect_swing_points(data)
        swing_highs = [sp for sp in swing_points if sp.type == SwingType.HIGH]
        swing_lows = [sp for sp in swing_points if sp.type == SwingType.LOW]

        if len(swing_highs) < min_swings or len(swing_lows) < min_swings:
            return (False, 0.0, swing_points)

        higher_highs_count = sum(
            1
            for i in range(1, len(swing_highs))
            if swing_highs[i].price > swing_highs[i - 1].price
        )

        higher_lows_count = sum(
            1
            for i in range(1, len(swing_lows))
            if swing_lows[i].price > swing_lows[i - 1].price
        )

        total_highs = len(swing_highs) - 1
        total_lows = len(swing_lows) - 1

        if total_highs == 0 or total_lows == 0:
            return (False, 0.0, swing_points)

        higher_highs_ratio = higher_highs_count / total_highs
        higher_lows_ratio = higher_lows_count / total_lows

        threshold = 0.7
        if higher_highs_ratio < threshold or higher_lows_ratio < threshold:
            return (False, 0.0, swing_points)

        highs_score = higher_highs_ratio * 40
        lows_score = higher_lows_ratio * 40
        swing_count = min(len(swing_highs) + len(swing_lows), 10)
        count_score = (swing_count / 10) * 20
        confidence = max(0.0, min(100.0, highs_score + lows_score + count_score))

        return (True, confidence, swing_points)

    def detect_lower_highs_lower_lows(
        self, data: List[OHLCVData], min_swings: int = 2
    ) -> Tuple[bool, float, List[SwingPoint]]:
        """Detect downtrend pattern."""
        if not data:
            raise ValueError("data cannot be empty")
        if min_swings < 2:
            raise ValueError("min_swings must be at least 2")

        swing_points = self.detect_swing_points(data)
        swing_highs = [sp for sp in swing_points if sp.type == SwingType.HIGH]
        swing_lows = [sp for sp in swing_points if sp.type == SwingType.LOW]

        if len(swing_highs) < min_swings or len(swing_lows) < min_swings:
            return (False, 0.0, swing_points)

        lower_highs_count = sum(
            1
            for i in range(1, len(swing_highs))
            if swing_highs[i].price < swing_highs[i - 1].price
        )

        lower_lows_count = sum(
            1
            for i in range(1, len(swing_lows))
            if swing_lows[i].price < swing_lows[i - 1].price
        )

        total_highs = len(swing_highs) - 1
        total_lows = len(swing_lows) - 1

        if total_highs == 0 or total_lows == 0:
            return (False, 0.0, swing_points)

        lower_highs_ratio = lower_highs_count / total_highs
        lower_lows_ratio = lower_lows_count / total_lows

        threshold = 0.7
        if lower_highs_ratio < threshold or lower_lows_ratio < threshold:
            return (False, 0.0, swing_points)

        highs_score = lower_highs_ratio * 40
        lows_score = lower_lows_ratio * 40
        swing_count = min(len(swing_highs) + len(swing_lows), 10)
        count_score = (swing_count / 10) * 20
        confidence = max(0.0, min(100.0, highs_score + lows_score + count_score))

        return (True, confidence, swing_points)
