"""
Backtesting Engine Core.

Main execution loop that orchestrates all components:
load data → compute indicators → bar loop → calculate metrics → return result.

Entry signals on bar N execute on bar N+1 open.
In-sample/out-of-sample split based on split_ratio.
"""

from __future__ import annotations

import logging
import uuid
from typing import List, Optional, Tuple

from .bias_guard import BiasGuard
from .cost_model import CostModel
from .data_loader import DataLoader, OHLCVData
from .indicator_engine import IndicatorEngine
from .metrics import MetricsCalculator
from .models import (
    BacktestConfig,
    BacktestResult,
    EquityPoint,
    PerformanceMetrics,
    TestMode,
    TradeDirection,
    TradeRecord,
)
from .position_manager import PositionManager
from .rule_evaluator import RuleEvaluator

logger = logging.getLogger(__name__)


class BacktestEngine:
    """
    Core backtesting engine.

    Orchestrates data loading, indicator computation, bar-by-bar simulation,
    position management, and metrics calculation.
    """

    def __init__(self):
        """Initialize BacktestEngine."""
        self.data_loader = DataLoader()
        self.metrics_calculator = MetricsCalculator()
        self.bias_guard = BiasGuard()

    def run(self, config: BacktestConfig) -> BacktestResult:
        """
        Run a backtest with the given configuration.

        Steps:
        1. Load OHLCV data
        2. Determine data range (in-sample/out-of-sample split)
        3. Compute indicators
        4. Run bar loop
        5. Calculate metrics
        6. Return result

        Args:
            config: Complete backtesting configuration.

        Returns:
            BacktestResult with trades, equity curve, and metrics.
        """
        backtest_id = str(uuid.uuid4())

        # 1. Load data
        ohlcv = self.data_loader.load(
            file_path=config.ohlcv_source.file_path,
            api_url=config.ohlcv_source.api_url,
            symbol=config.ohlcv_source.symbol,
            timeframe=config.ohlcv_source.timeframe,
        )

        # 2. Determine data range based on test_mode
        start_bar, end_bar = self._get_data_range(ohlcv, config)

        # 3. Compute indicators (on full data for warmup)
        indicator_engine = IndicatorEngine()
        indicator_engine.compute_all(ohlcv, config.indicators)

        # 4. Run the bar loop
        trades, equity_curve = self._run_bar_loop(
            ohlcv=ohlcv,
            config=config,
            indicator_engine=indicator_engine,
            start_bar=start_bar,
            end_bar=end_bar,
        )

        # 5. Calculate metrics
        total_bars = end_bar - start_bar
        final_equity = equity_curve[-1].equity if equity_curve else config.initial_capital
        metrics = self.metrics_calculator.calculate(
            trades=trades,
            equity_curve=equity_curve,
            initial_capital=config.initial_capital,
            total_bars=total_bars,
        )

        # 6. Check survivorship bias
        has_warning, _ = self.bias_guard.check_survivorship_bias(config.ohlcv_source)

        return BacktestResult(
            backtest_id=backtest_id,
            symbol=config.symbol,
            test_mode=config.test_mode,
            start_date=None,
            end_date=None,
            initial_capital=config.initial_capital,
            final_equity=final_equity,
            trades=trades,
            equity_curve=equity_curve,
            metrics=metrics,
            per_window_metrics=None,
            survivorship_bias_warning=has_warning,
            config=config,
        )

    def run_on_range(
        self,
        ohlcv: OHLCVData,
        config: BacktestConfig,
        start_bar: int,
        end_bar: int,
    ) -> BacktestResult:
        """
        Run backtest on a specific bar range (used by walk-forward runner).

        Args:
            ohlcv: Pre-loaded OHLCV data.
            config: Backtest configuration.
            start_bar: Start bar index (inclusive).
            end_bar: End bar index (exclusive).

        Returns:
            BacktestResult for the specified range.
        """
        backtest_id = str(uuid.uuid4())

        # Compute indicators on full data for warmup
        indicator_engine = IndicatorEngine()
        indicator_engine.compute_all(ohlcv, config.indicators)

        # Run bar loop on specified range
        trades, equity_curve = self._run_bar_loop(
            ohlcv=ohlcv,
            config=config,
            indicator_engine=indicator_engine,
            start_bar=start_bar,
            end_bar=end_bar,
        )

        total_bars = end_bar - start_bar
        final_equity = equity_curve[-1].equity if equity_curve else config.initial_capital
        metrics = self.metrics_calculator.calculate(
            trades=trades,
            equity_curve=equity_curve,
            initial_capital=config.initial_capital,
            total_bars=total_bars,
        )

        return BacktestResult(
            backtest_id=backtest_id,
            symbol=config.symbol,
            test_mode=config.test_mode,
            initial_capital=config.initial_capital,
            final_equity=final_equity,
            trades=trades,
            equity_curve=equity_curve,
            metrics=metrics,
        )

    def _get_data_range(
        self, ohlcv: OHLCVData, config: BacktestConfig
    ) -> Tuple[int, int]:
        """
        Determine the bar range based on test mode and split ratio.

        IN_SAMPLE: first split_ratio portion of data
        OUT_OF_SAMPLE: last (1 - split_ratio) portion
        WALK_FORWARD: full data (walk-forward runner handles splits)

        Returns:
            (start_bar, end_bar) tuple.
        """
        total = ohlcv.bar_count

        if config.test_mode == TestMode.IN_SAMPLE:
            split_point = int(total * config.split_ratio)
            return 0, split_point
        elif config.test_mode == TestMode.OUT_OF_SAMPLE:
            split_point = int(total * config.split_ratio)
            return split_point, total
        else:
            # WALK_FORWARD or full run
            return 0, total

    def _run_bar_loop(
        self,
        ohlcv: OHLCVData,
        config: BacktestConfig,
        indicator_engine: IndicatorEngine,
        start_bar: int,
        end_bar: int,
    ) -> Tuple[List[TradeRecord], List[EquityPoint]]:
        """
        Execute the main bar-by-bar simulation loop.

        Signal on bar N → execution on bar N+1 open.

        Args:
            ohlcv: OHLCV data.
            config: Backtest configuration.
            indicator_engine: Computed indicator engine.
            start_bar: Start bar (inclusive).
            end_bar: End bar (exclusive).

        Returns:
            Tuple of (trade_records, equity_curve).
        """
        # Initialize components
        cost_model = CostModel(config.slippage, config.brokerage)
        position_manager = PositionManager()
        rule_evaluator = RuleEvaluator(indicator_engine)

        trades: List[TradeRecord] = []
        equity_curve: List[EquityPoint] = []
        trade_counter = 0

        equity = config.initial_capital
        pending_entry = False  # Signal on bar N, execute on N+1

        # Determine effective start (must be past warmup)
        warmup_end = indicator_engine.get_max_warmup()
        effective_start = max(start_bar, warmup_end)

        # Record initial equity
        equity_curve.append(EquityPoint(
            bar_index=effective_start,
            equity=equity,
            timestamp=float(ohlcv.timestamps[effective_start]) if effective_start < ohlcv.bar_count else None,
        ))

        for bar in range(effective_start, end_bar):
            bar_open = float(ohlcv.opens[bar])
            bar_high = float(ohlcv.highs[bar])
            bar_low = float(ohlcv.lows[bar])
            bar_close = float(ohlcv.closes[bar])

            # Execute pending entry on this bar's open
            if pending_entry and not position_manager.has_position:
                # Calculate entry price with slippage
                entry_price = cost_model.apply_slippage(
                    bar_open, TradeDirection.LONG, is_entry=True
                )

                # Calculate position size
                position_value = equity * config.position_size
                quantity = position_value / entry_price if entry_price > 0 else 0

                if quantity > 0:
                    position_manager.open_position(
                        entry_price=entry_price,
                        bar_index=bar,
                        direction=TradeDirection.LONG,
                        quantity=quantity,
                        stop_loss=config.stop_loss,
                        target=config.target,
                        trailing_stop=config.trailing_stop,
                        max_holding_period=config.max_holding_period,
                    )

                pending_entry = False

            # Evaluate exit conditions for open positions
            if position_manager.has_position:
                exit_signal = position_manager.evaluate_exit(
                    bar_index=bar,
                    open_price=bar_open,
                    high_price=bar_high,
                    low_price=bar_low,
                    close_price=bar_close,
                )

                if exit_signal.should_exit:
                    pos = position_manager.close_position()
                    if pos:
                        # Apply slippage to exit
                        exit_price = cost_model.apply_slippage(
                            exit_signal.exit_price, pos.direction, is_entry=False
                        )

                        # Calculate P&L
                        if pos.direction == TradeDirection.LONG:
                            gross_pnl = (exit_price - pos.entry_price) * pos.quantity
                        else:
                            gross_pnl = (pos.entry_price - exit_price) * pos.quantity

                        # Calculate costs
                        entry_cost, exit_cost = cost_model.calculate_entry_exit_costs(
                            pos.entry_price, exit_price, pos.quantity
                        )
                        net_pnl = cost_model.calculate_net_pnl(gross_pnl, entry_cost, exit_cost)

                        # Record trade
                        trade_counter += 1
                        trade = TradeRecord(
                            trade_id=trade_counter,
                            direction=pos.direction,
                            entry_bar=pos.entry_bar,
                            exit_bar=bar,
                            entry_price=pos.entry_price,
                            exit_price=exit_price,
                            quantity=pos.quantity,
                            gross_pnl=gross_pnl,
                            net_pnl=net_pnl,
                            entry_cost=entry_cost,
                            exit_cost=exit_cost,
                            exit_reason=exit_signal.exit_reason,
                            holding_period=bar - pos.entry_bar,
                        )
                        trades.append(trade)

                        # Update equity
                        equity += net_pnl

            # Evaluate entry rules (signal for next bar)
            if not position_manager.has_position and not pending_entry:
                if rule_evaluator.evaluate_entry(config.entry_rules, bar):
                    pending_entry = True

            # Record equity at end of bar
            # For open positions, mark-to-market using close price
            current_equity = equity
            if position_manager.has_position:
                pos = position_manager.current_position
                if pos.direction == TradeDirection.LONG:
                    unrealized = (bar_close - pos.entry_price) * pos.quantity
                else:
                    unrealized = (pos.entry_price - bar_close) * pos.quantity
                current_equity = equity + unrealized

            equity_curve.append(EquityPoint(
                bar_index=bar,
                equity=current_equity,
                timestamp=float(ohlcv.timestamps[bar]),
            ))

        # Close any remaining open position at last bar's close
        if position_manager.has_position and end_bar > effective_start:
            last_bar = end_bar - 1
            last_close = float(ohlcv.closes[last_bar])
            pos = position_manager.close_position()
            if pos:
                exit_price = cost_model.apply_slippage(
                    last_close, pos.direction, is_entry=False
                )
                if pos.direction == TradeDirection.LONG:
                    gross_pnl = (exit_price - pos.entry_price) * pos.quantity
                else:
                    gross_pnl = (pos.entry_price - exit_price) * pos.quantity

                entry_cost, exit_cost = cost_model.calculate_entry_exit_costs(
                    pos.entry_price, exit_price, pos.quantity
                )
                net_pnl = cost_model.calculate_net_pnl(gross_pnl, entry_cost, exit_cost)

                trade_counter += 1
                trade = TradeRecord(
                    trade_id=trade_counter,
                    direction=pos.direction,
                    entry_bar=pos.entry_bar,
                    exit_bar=last_bar,
                    entry_price=pos.entry_price,
                    exit_price=exit_price,
                    quantity=pos.quantity,
                    gross_pnl=gross_pnl,
                    net_pnl=net_pnl,
                    entry_cost=entry_cost,
                    exit_cost=exit_cost,
                    exit_reason="end_of_data",
                    holding_period=last_bar - pos.entry_bar,
                )
                trades.append(trade)
                equity += net_pnl

        return trades, equity_curve
