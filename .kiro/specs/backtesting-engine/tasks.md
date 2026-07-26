# Tasks

## Task 1: Project Setup and Data Models

Set up the backtesting module directory structure and define all Pydantic/dataclass models.

- [ ] 1.1 Create `apps/quant/backtesting/__init__.py` with module docstring
- [ ] 1.2 Create `apps/quant/backtesting/models.py` with all data models: `BacktestConfig`, `OHLCVSource`, `IndicatorConfig`, `RuleCondition`, `RuleConfig`, `StopLossConfig`, `TargetConfig`, `TrailingStopConfig`, `SlippageConfig`, `BrokerageConfig`, `WalkForwardConfig`, `TestMode` enum, `TradeRecord`, `EquityPoint`, `WindowMetrics`, `PerformanceMetrics`, `BacktestResult`
- [ ] 1.3 Add Pydantic request/response models for API layer: `BacktestRunRequest`, `BacktestRunResponse`, `BacktestResultResponse`

## Task 2: Data Loader

Implement OHLCV data loading from JSON files and API with validation.

- [ ] 2.1 Create `apps/quant/backtesting/data_loader.py` with `DataLoader` class
- [ ] 2.2 Implement `load_from_json(file_path: str)` method that reads JSON OHLCV data into numpy arrays (timestamps, opens, highs, lows, closes, volumes)
- [ ] 2.3 Implement `load_from_api(url: str)` method that fetches OHLCV data via HTTP and parses into numpy arrays
- [ ] 2.4 Implement validation: chronological timestamp order, no NaN/None values, minimum bar count check
- [ ] 2.5 Write property test: loading valid OHLCV data and re-serializing produces equivalent data (round-trip) [PBT]

## Task 3: Indicator Engine

Implement the indicator computation orchestrator that wraps existing calculators.

- [ ] 3.1 Create `apps/quant/backtesting/indicator_engine.py` with `IndicatorEngine` class
- [ ] 3.2 Implement `compute_all(ohlcv_data, indicator_configs)` that computes RSI, ADX, EMA, MACD, ATR, VWAP using existing `apps/quant/calculators/` functions and stores results as numpy arrays
- [ ] 3.3 Implement `get_value(indicator_name, bar_index)` that returns NaN for warmup bars and the computed value for valid bars (enforces no look-ahead)
- [ ] 3.4 Implement trendline evaluation: `evaluate_trendline(trendline, bar_index)` returning distance and crossover signals
- [ ] 3.5 Write property test: for all valid bar indices, `get_value(name, i)` returns NaN for i < warmup_period and a finite float for i >= warmup_period [PBT]

## Task 4: Rule Evaluator

Implement entry rule evaluation with AND-combination logic.

- [ ] 4.1 Create `apps/quant/backtesting/rule_evaluator.py` with `RuleEvaluator` class
- [ ] 4.2 Implement condition evaluation supporting comparators: GT, LT, GTE, LTE, CROSSES_ABOVE, CROSSES_BELOW, EQ
- [ ] 4.3 Implement `evaluate_entry(rules, indicator_engine, bar_index)` that returns True only when ALL conditions in a rule are satisfied
- [ ] 4.4 Implement cross-detection logic: CROSSES_ABOVE is true when value[i-1] <= threshold and value[i] > threshold
- [ ] 4.5 Write property test: rule evaluator never accesses indicator values beyond the provided bar_index (no look-ahead) [PBT]

## Task 5: Position Manager

Implement position tracking with stop loss, target, trailing stop, and holding period.

- [ ] 5.1 Create `apps/quant/backtesting/position_manager.py` with `PositionManager` class
- [ ] 5.2 Implement `open_position(entry_price, bar_index, direction, stop_loss, target, trailing_stop, max_holding)` method
- [ ] 5.3 Implement `evaluate_exit(current_bar)` that checks stop loss, target, trailing stop, and holding period against current bar OHLC
- [ ] 5.4 Implement trailing stop update logic: for longs, trail_stop = max(trail_stop, high - trail_amount); for shorts, trail_stop = min(trail_stop, low + trail_amount)
- [ ] 5.5 Implement same-bar conflict resolution: when both stop and target could be hit, use conservative assumption (stop hit first for longs when open is closer to stop)
- [ ] 5.6 Write property test: trailing stop never moves against the trade direction (monotonically non-decreasing for longs, non-increasing for shorts) [PBT]

## Task 6: Cost Model

Implement slippage and brokerage fee simulation.

- [ ] 6.1 Create `apps/quant/backtesting/cost_model.py` with `CostModel` class
- [ ] 6.2 Implement `apply_slippage(price, direction, slippage_config)` — for buys: price + slippage, for sells: price - slippage
- [ ] 6.3 Implement `calculate_brokerage(trade_value, brokerage_config)` — fixed fee or percentage of trade value
- [ ] 6.4 Implement `calculate_net_pnl(gross_pnl, entry_cost, exit_cost)` that returns P&L after all costs
- [ ] 6.5 Write property test: slippage always increases cost (entry with slippage is worse than without, exit with slippage is worse than without) [PBT]

## Task 7: Metrics Calculator

Implement performance metrics computation, reusing TradePerformanceCalculator.

- [ ] 7.1 Create `apps/quant/backtesting/metrics.py` with `MetricsCalculator` class
- [ ] 7.2 Implement Total Return calculation: (final_equity - initial_equity) / initial_equity × 100
- [ ] 7.3 Implement CAGR calculation: ((final_equity / initial_equity) ^ (365 / total_days)) - 1
- [ ] 7.4 Implement Sharpe Ratio: (mean_daily_return - risk_free_rate) / std_daily_return × sqrt(252)
- [ ] 7.5 Implement Average Winner, Average Loser, Average Holding Period calculations
- [ ] 7.6 Integrate with TradePerformanceCalculator for Win Rate, Profit Factor, Expectancy, Max Drawdown
- [ ] 7.7 Write property test: profit_factor > 1 if and only if total_pnl > 0 (when there are both winners and losers) [PBT]

## Task 8: Bias Guard

Implement look-ahead bias prevention and data leakage checks.

- [ ] 8.1 Create `apps/quant/backtesting/bias_guard.py` with `BiasGuard` class
- [ ] 8.2 Implement `validate_no_lookahead(indicator_engine, bar_index)` that asserts no future data accessed
- [ ] 8.3 Implement `validate_walk_forward_windows(windows)` that asserts no overlap between in-sample and out-of-sample periods
- [ ] 8.4 Implement `check_survivorship_bias(data_source)` that returns a warning flag and message
- [ ] 8.5 Write property test: for any generated walk-forward window configuration, in-sample and out-of-sample date ranges never overlap [PBT]

## Task 9: Core Backtesting Engine

Implement the main execution loop that orchestrates all components.

- [ ] 9.1 Create `apps/quant/backtesting/engine.py` with `BacktestEngine` class
- [ ] 9.2 Implement `run(config: BacktestConfig) -> BacktestResult` orchestrating: data load → indicators → bar loop → metrics
- [ ] 9.3 Implement the main bar loop: iterate from warmup_end to last bar, evaluate entry/exit rules, manage positions
- [ ] 9.4 Implement equity curve tracking: record equity value after each bar
- [ ] 9.5 Implement in-sample/out-of-sample split logic based on `test_mode` and `split_ratio`
- [ ] 9.6 Write property test: engine with no entry rules produces zero trades and final_equity equals initial_capital [PBT]

## Task 10: Walk-Forward Testing

Implement walk-forward analysis with rolling windows.

- [ ] 10.1 Create `apps/quant/backtesting/walk_forward.py` with `WalkForwardRunner` class
- [ ] 10.2 Implement `generate_windows(total_bars, config)` that creates sequential rolling windows
- [ ] 10.3 Implement `run_walk_forward(engine, config)` that executes backtest on each window independently
- [ ] 10.4 Implement result aggregation: combine out-of-sample trades across windows, compute aggregate metrics
- [ ] 10.5 Write property test: generated windows cover the full data range without gaps and maintain in-sample before out-of-sample ordering [PBT]

## Task 11: FastAPI Router and Backend Integration

Create the API endpoints and register the router.

- [ ] 11.1 Create `apps/quant/backtesting/router.py` with FastAPI router, prefix `/quant/backtesting`
- [ ] 11.2 Implement `POST /quant/backtesting/run` endpoint: validate request, call engine, store result, return response
- [ ] 11.3 Implement `GET /quant/backtesting/results/{backtest_id}` endpoint: retrieve from in-memory store or return 404
- [ ] 11.4 Register the backtesting router in `apps/quant/main.py` using `app.include_router()`
- [ ] 11.5 Add error handling: 422 for validation errors, 400 for data load failures, 500 for unexpected errors

## Task 12: Frontend Page and Components

Build the Next.js backtesting page with configuration form and results visualization.

- [ ] 12.1 Create `apps/web/app/backtesting/page.tsx` as the main backtesting page with layout
- [ ] 12.2 Create `apps/web/components/backtesting/BacktestConfigForm.tsx` with fields for indicators, entry rules, exit rules, slippage, brokerage, test mode
- [ ] 12.3 Create `apps/web/components/backtesting/MetricsSummary.tsx` displaying all 11 performance metrics in a grid layout
- [ ] 12.4 Create `apps/web/components/backtesting/EquityCurveChart.tsx` rendering a line chart of portfolio equity over time
- [ ] 12.5 Create `apps/web/components/backtesting/TradeList.tsx` showing a table of trades with entry/exit dates, prices, P&L, holding period
- [ ] 12.6 Create `apps/web/components/backtesting/BacktestResults.tsx` as the container composing MetricsSummary, EquityCurveChart, TradeList, and optional WalkForwardResults
- [ ] 12.7 Add sidebar navigation link for `/backtesting` route

## Task 13: Integration Testing and Verification

End-to-end verification of the complete backtesting pipeline.

- [ ] 13.1 Write integration test: run a simple moving average crossover strategy on sample OHLCV data and verify trades are generated with correct entry/exit logic
- [ ] 13.2 Write integration test: verify transaction costs reduce final equity compared to zero-cost backtest on same data
- [ ] 13.3 Write integration test: verify walk-forward mode produces per-window metrics and aggregate metrics
- [ ] 13.4 Write integration test: verify API endpoint returns valid BacktestResult with all metrics populated
- [ ] 13.5 Verify no pandas import exists anywhere in the backtesting module
