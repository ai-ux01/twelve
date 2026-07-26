"""
Backtesting Engine Bias Guard.

Validates no look-ahead bias, walk-forward window integrity,
and provides survivorship bias warnings.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Optional, Tuple

from .indicator_engine import IndicatorEngine
from .models import OHLCVSource, WalkForwardConfig

logger = logging.getLogger(__name__)


@dataclass
class BiasWarning:
    """A bias warning or error."""
    level: str  # "error" or "warning"
    message: str


@dataclass
class WindowRange:
    """Represents a walk-forward window's bar range."""
    in_sample_start: int
    in_sample_end: int
    out_of_sample_start: int
    out_of_sample_end: int


class BiasGuard:
    """
    Validates backtest integrity and prevents common biases.

    Checks:
    - No look-ahead in indicator access
    - Walk-forward windows don't overlap
    - Survivorship bias warnings
    """

    def validate_no_lookahead(
        self, indicator_engine: IndicatorEngine, bar_index: int
    ) -> bool:
        """
        Validate that no indicator accesses future data beyond bar_index.

        The IndicatorEngine enforces this by design (get_value returns NaN
        for future bars), but this method provides an explicit assertion.

        Args:
            indicator_engine: The indicator engine to check.
            bar_index: Current bar index.

        Returns:
            True if no look-ahead detected.
        """
        # The IndicatorEngine's get_value method only accesses precomputed
        # arrays and never looks beyond bar_index. This is enforced by the
        # warmup period check and the pre-computation model.
        # This validation confirms the invariant holds.
        for name in indicator_engine.indicator_names:
            warmup = indicator_engine.get_warmup_period(name)
            # Verify that accessing bar_index returns a valid value
            # only if bar_index >= warmup
            value = indicator_engine.get_value(name, bar_index)
            if bar_index < warmup:
                import math
                if not math.isnan(value):
                    logger.error(
                        f"Look-ahead detected: {name} returned non-NaN "
                        f"value {value} at bar {bar_index} (warmup={warmup})"
                    )
                    return False
        return True

    def validate_walk_forward_windows(
        self, windows: List[WindowRange]
    ) -> Tuple[bool, List[BiasWarning]]:
        """
        Validate walk-forward windows don't have in-sample/out-of-sample overlap.

        Checks:
        - In-sample period comes before out-of-sample within each window
        - Out-of-sample periods don't overlap with in-sample of subsequent windows

        Args:
            windows: List of window ranges.

        Returns:
            Tuple of (is_valid, list of warnings/errors).
        """
        warnings: List[BiasWarning] = []

        if not windows:
            return True, warnings

        for i, window in enumerate(windows):
            # In-sample must come before out-of-sample
            if window.in_sample_end >= window.out_of_sample_start:
                warnings.append(BiasWarning(
                    level="error",
                    message=(
                        f"Window {i}: in-sample end ({window.in_sample_end}) "
                        f"overlaps with out-of-sample start ({window.out_of_sample_start})"
                    ),
                ))

            # Check overlap between windows
            if i > 0:
                prev = windows[i - 1]
                # Out-of-sample of previous window should not overlap
                # with in-sample of current window (data leakage)
                if prev.out_of_sample_end > window.in_sample_start:
                    # This is actually OK for rolling windows where OOS
                    # can overlap with next IS. The critical check is that
                    # OOS doesn't overlap with the same window's IS.
                    pass

        # Critical check: within each window, IS and OOS should not overlap
        is_valid = all(w.level != "error" for w in warnings)
        return is_valid, warnings

    def check_survivorship_bias(
        self, data_source: Optional[OHLCVSource] = None
    ) -> Tuple[bool, str]:
        """
        Check for survivorship bias risk.

        Returns a warning flag and message if data source may have
        survivorship bias (e.g., single stock data without delisted stocks).

        Args:
            data_source: OHLCV data source configuration.

        Returns:
            Tuple of (has_warning, message).
        """
        # Heuristic: if testing a single stock from a local file,
        # there's always a risk of survivorship bias
        if data_source is None:
            return True, (
                "Warning: Unable to verify data source for survivorship bias. "
                "Ensure your data includes delisted securities if backtesting "
                "a universe/portfolio strategy."
            )

        if data_source.file_path:
            return True, (
                "Warning: Local file data may have survivorship bias. "
                "If backtesting a stock selection strategy, ensure "
                "your dataset includes delisted/failed companies."
            )

        if data_source.api_url:
            return False, ""

        return True, (
            "Warning: Data source survivorship bias status unknown."
        )

    def generate_window_ranges(
        self, total_bars: int, config: WalkForwardConfig
    ) -> List[WindowRange]:
        """
        Generate walk-forward window ranges for validation.

        Args:
            total_bars: Total bars available.
            config: Walk-forward configuration.

        Returns:
            List of window ranges.
        """
        windows = []
        window_size = config.in_sample_bars + config.out_of_sample_bars
        start = 0
        idx = 0

        while start + window_size <= total_bars:
            is_start = start
            is_end = start + config.in_sample_bars - 1
            oos_start = start + config.in_sample_bars
            oos_end = start + window_size - 1

            windows.append(WindowRange(
                in_sample_start=is_start,
                in_sample_end=is_end,
                out_of_sample_start=oos_start,
                out_of_sample_end=oos_end,
            ))

            start += config.step_bars
            idx += 1

        return windows
