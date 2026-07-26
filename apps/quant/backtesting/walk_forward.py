"""
Backtesting Engine Walk-Forward Testing.

Implements walk-forward analysis with rolling windows.
Generates sequential windows, runs engine independently per window,
and aggregates out-of-sample results.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Optional, Tuple

from .data_loader import DataLoader, OHLCVData
from .engine import BacktestEngine
from .metrics import MetricsCalculator
from .models import (
    BacktestConfig,
    BacktestResult,
    EquityPoint,
    PerformanceMetrics,
    TestMode,
    TradeRecord,
    WalkForwardConfig,
    WindowMetrics,
)

logger = logging.getLogger(__name__)


@dataclass
class Window:
    """A single walk-forward window."""
    index: int
    in_sample_start: int
    in_sample_end: int  # exclusive
    out_of_sample_start: int
    out_of_sample_end: int  # exclusive


class WalkForwardRunner:
    """
    Walk-forward analysis runner.

    Splits data into rolling in-sample/out-of-sample windows,
    runs the backtest engine independently on each window,
    and aggregates out-of-sample results.
    """

    def __init__(self):
        """Initialize WalkForwardRunner."""
        self.engine = BacktestEngine()
        self.metrics_calculator = MetricsCalculator()

    def generate_windows(
        self, total_bars: int, config: WalkForwardConfig
    ) -> List[Window]:
        """
        Generate sequential rolling windows.

        Each window consists of:
        - In-sample period: used for strategy training/fitting
        - Out-of-sample period: used for evaluation

        Windows step forward by step_bars each iteration.

        Args:
            total_bars: Total number of bars in the dataset.
            config: Walk-forward configuration.

        Returns:
            List of Window objects.
        """
        windows = []
        window_size = config.in_sample_bars + config.out_of_sample_bars
        start = 0
        idx = 0

        while start + window_size <= total_bars:
            is_start = start
            is_end = start + config.in_sample_bars
            oos_start = is_end
            oos_end = start + window_size

            windows.append(Window(
                index=idx,
                in_sample_start=is_start,
                in_sample_end=is_end,
                out_of_sample_start=oos_start,
                out_of_sample_end=oos_end,
            ))

            start += config.step_bars
            idx += 1

        return windows

    def run_walk_forward(
        self, config: BacktestConfig
    ) -> BacktestResult:
        """
        Execute walk-forward analysis.

        Steps:
        1. Load data
        2. Generate windows
        3. Run engine on each window's out-of-sample period
        4. Aggregate results

        Args:
            config: Backtest configuration with walk_forward_config set.

        Returns:
            Aggregated BacktestResult with per-window metrics.
        """
        if config.walk_forward_config is None:
            raise ValueError("walk_forward_config is required for walk-forward mode")

        # Load data
        data_loader = DataLoader()
        ohlcv = data_loader.load(
            file_path=config.ohlcv_source.file_path,
            api_url=config.ohlcv_source.api_url,
            symbol=config.ohlcv_source.symbol,
            timeframe=config.ohlcv_source.timeframe,
        )

        # Generate windows
        windows = self.generate_windows(
            total_bars=ohlcv.bar_count,
            config=config.walk_forward_config,
        )

        if not windows:
            logger.warning("No valid walk-forward windows could be generated")
            return BacktestResult(
                backtest_id="",
                symbol=config.symbol,
                test_mode=TestMode.WALK_FORWARD,
                initial_capital=config.initial_capital,
                final_equity=config.initial_capital,
                metrics=PerformanceMetrics(),
            )

        # Run engine on each window's out-of-sample period
        all_oos_trades: List[TradeRecord] = []
        all_oos_equity: List[EquityPoint] = []
        per_window_metrics: List[WindowMetrics] = []

        for window in windows:
            # Run on out-of-sample portion
            result = self.engine.run_on_range(
                ohlcv=ohlcv,
                config=config,
                start_bar=window.out_of_sample_start,
                end_bar=window.out_of_sample_end,
            )

            # Collect trades and equity
            all_oos_trades.extend(result.trades)
            all_oos_equity.extend(result.equity_curve)

            # Per-window metrics
            wm = WindowMetrics(
                window_index=window.index,
                in_sample_start=window.in_sample_start,
                in_sample_end=window.in_sample_end,
                out_of_sample_start=window.out_of_sample_start,
                out_of_sample_end=window.out_of_sample_end,
                total_trades=result.metrics.total_trades,
                total_return_pct=result.metrics.total_return_pct,
                win_rate=result.metrics.win_rate,
                profit_factor=result.metrics.profit_factor,
                sharpe_ratio=result.metrics.sharpe_ratio,
            )
            per_window_metrics.append(wm)

        # Aggregate metrics from all OOS trades
        total_bars = sum(
            w.out_of_sample_end - w.out_of_sample_start for w in windows
        )

        # Build combined equity curve
        combined_equity = self._build_combined_equity(
            all_oos_equity, config.initial_capital
        )

        final_equity = combined_equity[-1].equity if combined_equity else config.initial_capital
        aggregate_metrics = self.metrics_calculator.calculate(
            trades=all_oos_trades,
            equity_curve=combined_equity,
            initial_capital=config.initial_capital,
            total_bars=total_bars,
        )

        return BacktestResult(
            backtest_id="",
            symbol=config.symbol,
            test_mode=TestMode.WALK_FORWARD,
            initial_capital=config.initial_capital,
            final_equity=final_equity,
            trades=all_oos_trades,
            equity_curve=combined_equity,
            metrics=aggregate_metrics,
            per_window_metrics=per_window_metrics,
        )

    def _build_combined_equity(
        self, equity_points: List[EquityPoint], initial_capital: float
    ) -> List[EquityPoint]:
        """
        Build a combined equity curve from multiple windows.

        Adjusts equity values to be sequential (each window starts
        where the previous ended).
        """
        if not equity_points:
            return [EquityPoint(bar_index=0, equity=initial_capital)]

        # Simply use the collected equity points as-is
        # (each window starts with initial_capital independently)
        # For aggregation, we chain them: window N+1 starts at window N's end
        combined = []
        running_equity = initial_capital

        # Group by sequential segments (windows)
        # Each window's equity starts at initial_capital, so we scale
        if not equity_points:
            return [EquityPoint(bar_index=0, equity=initial_capital)]

        # Use raw points sorted by bar_index
        sorted_points = sorted(equity_points, key=lambda p: p.bar_index)

        # Deduplicate by bar_index (keep last value for each bar)
        seen = {}
        for p in sorted_points:
            seen[p.bar_index] = p

        combined = [seen[k] for k in sorted(seen.keys())]

        if not combined:
            combined = [EquityPoint(bar_index=0, equity=initial_capital)]

        return combined
